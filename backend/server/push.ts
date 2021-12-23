import { PushBody } from "protocol/push";
import { ClientID, Socket } from "../types/client-state";
import { RoomID, RoomMap } from "../types/room-state";
import { LogContext } from "../../util/logger";
import { sendError } from "../../util/socket";

export type ProcessUntilDone = () => void;

/**
 * handles the 'push' upstream message by queueing the mutations included in
 * [[body]] in the appropriate client state.
 * @param rooms currently running rooms
 * @param roomID destination room
 * @param clientID source client
 * @param body body of push message
 * @param ws socket connection to requesting client
 * @returns
 */
export function handlePush(
  lc: LogContext,
  rooms: RoomMap,
  roomID: RoomID,
  clientID: ClientID,
  body: PushBody,
  ws: Socket,
  processUntilDone: ProcessUntilDone
) {
  lc.debug?.("handling push", JSON.stringify(body));
  const room = rooms.get(roomID);
  if (!room) {
    lc.info?.("room not found");
    sendError(ws, `no such room: ${roomID}`);
    return;
  }

  const client = room.clients.get(clientID);
  if (!client) {
    lc.info?.("client not found");
    sendError(ws, `no such client: ${clientID}`);
    return;
  }

  for (const m of body.mutations) {
    let idx = client.pending.findIndex((pm) => pm.id >= m.id);
    if (idx === -1) {
      idx = client.pending.length;
    } else if (client.pending[idx].id === m.id) {
      lc.debug?.("mutation already been queued", m.id);
      continue;
    }
    m.timestamp += client.clockBehindByMs;
    client.pending.splice(idx, 0, m);
    lc.debug?.(
      "inserted mutation, pending is now",
      JSON.stringify(client.pending)
    );
  }

  processUntilDone();
}
