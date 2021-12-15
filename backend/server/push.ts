import { ClientID, Socket } from "../types/client-state";
import { RoomID, RoomMap } from "../types/room-state";
import { sendError } from "../util/socket";
import { PushBody } from "protocol/push";

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
  rooms: RoomMap,
  roomID: RoomID,
  clientID: ClientID,
  body: PushBody,
  ws: Socket
) {
  const room = rooms.get(roomID);
  if (!room) {
    sendError(ws, `no such room: ${roomID}`);
    return;
  }

  const client = room.clients.get(clientID);
  if (!client) {
    sendError(ws, `no such client: ${clientID}`);
    return;
  }

  for (const m of body.mutations) {
    let idx = client.pending.findIndex((pm) => pm.id >= m.id);
    if (idx === -1) {
      idx = client.pending.length;
    } else if (client.pending[idx].id === m.id) {
      console.log(`Mutation ${m.id} has already been queued`);
      continue;
    }
    m.timestamp += client.clockBehindByMs;
    client.pending.splice(idx, 0, m);
  }
}
