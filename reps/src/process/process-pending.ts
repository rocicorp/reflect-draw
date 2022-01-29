// Processes all pending mutations from [[clients]] that are ready to be
// processed in one or more frames, up to [[endTime]] and sends necessary

import { ClientMap } from "@/types/client-state";
import { PokeMessage } from "../protocol/poke";
import { ClientPokeBody } from "../types/client-poke-body";
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
  durable: DurableObjectStorage,
  // Rooms to process mutations for
  clients: ClientMap,
  // All known mutators
  mutators: MutatorMap,
  // Span of server time to execute
  startTime: number,
  endTime: number
): Promise<void> {
  lc.debug?.("process pending - startTime", startTime, "endTime", endTime);

  const t0 = Date.now();
  try {
    const pokes = await processRoom(
      lc,
      clients,
      mutators,
      startTime,
      endTime,
      durable
    );

    sendPokes(lc, pokes, clients);
    clearPendingMutations(lc, pokes, clients);
  } finally {
    lc.debug?.(`processPending took ${Date.now() - t0} ms`);
  }
}

function sendPokes(
  lc: LogContext,
  pokes: ClientPokeBody[],
  clients: ClientMap
) {
  for (const pokeBody of pokes) {
    const client = must(clients.get(pokeBody.clientID));
    const poke: PokeMessage = ["poke", pokeBody.poke];
    lc.debug?.("sending client", pokeBody.clientID, "poke", pokeBody.poke);
    client.socket.send(JSON.stringify(poke));
  }
}

function clearPendingMutations(
  lc: LogContext,
  pokes: ClientPokeBody[],
  clients: ClientMap
) {
  lc.debug?.("clearing pending mutations");
  for (const pokeBody of pokes) {
    lc.debug?.("clearing for poke", pokeBody.poke);
    const client = must(clients.get(pokeBody.clientID));
    lc.debug?.("client current pending", client.pending);
    const idx = client.pending.findIndex(
      (mutation) => mutation.id > pokeBody.poke.lastMutationID
    );
    lc.debug?.("idx", idx);
    client.pending.splice(0, idx > -1 ? idx : client.pending.length);
    lc.debug?.("client after pending", client.pending);
  }
}
