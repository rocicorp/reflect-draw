// Processes all pending mutations from [[clients]] that are ready to be
// processed in one or more frames, up to [[endTime]] and sends necessary

import { PokeMessage } from "../../protocol/poke";
import { transact } from "../db/pg";
import { ClientPokeBody } from "../types/client-poke-body";
import { RoomID, RoomMap } from "../types/room-state";
import { LogContext } from "../util/logger";
import { must } from "../util/must";
import { MutatorMap } from "./process-mutation";
import { processRoom } from "./process-room";

/**
 * Processes all mutations in all rooms for a time range, and send relevant pokes.
 * @param rooms All active rooms
 * @param mutators All known mutators
 * @param startTime Timespan start
 * @param endTime Timespan end
 */
export async function processPending(
  lc: LogContext,
  // Rooms to process mutations for
  rooms: RoomMap,
  // All known mutators
  mutators: MutatorMap,
  // Span of server time to execute
  startTime: number,
  endTime: number
): Promise<void> {
  lc.debug?.("process pending - startTime", startTime, "endTime", endTime);

  const pokes = await transact(async (executor) => {
    const pokes: Map<RoomID, ClientPokeBody[]> = new Map();
    for (const [roomID, roomState] of rooms) {
      pokes.set(
        roomID,
        await processRoom(
          lc,
          roomID,
          roomState.clients,
          mutators,
          startTime,
          endTime,
          executor
        )
      );
    }
    return pokes;
  });

  sendPokes(lc, pokes, rooms);
  clearPendingMutations(lc, pokes, rooms);
}

function sendPokes(
  lc: LogContext,
  pokes: Map<RoomID, ClientPokeBody[]>,
  rooms: RoomMap
) {
  lc.debug?.("sending pokes", pokes);
  for (const [roomID, pokesForRoom] of pokes) {
    const roomState = must(rooms.get(roomID));
    for (const pokeBody of pokesForRoom) {
      const client = must(roomState.clients.get(pokeBody.clientID));
      const poke: PokeMessage = ["poke", pokeBody.poke];
      client.socket.send(JSON.stringify(poke));
    }
  }
}

function clearPendingMutations(
  lc: LogContext,
  pokes: Map<RoomID, ClientPokeBody[]>,
  rooms: RoomMap
) {
  lc.debug?.("clearing pending mutations");
  for (const [roomID, pokesForRoom] of pokes) {
    const roomState = must(rooms.get(roomID));
    for (const pokeBody of pokesForRoom) {
      const client = must(roomState.clients.get(pokeBody.clientID));
      const idx = client.pending.findIndex(
        (mutation) => mutation.id > pokeBody.poke.lastMutationID
      );
      client.pending.splice(0, idx > -1 ? idx : client.pending.length);
    }
  }
}
