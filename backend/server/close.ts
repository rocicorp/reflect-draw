import { ClientID } from "../types/client-state";
import { RoomID, RoomMap } from "../types/room-state";

export function handleClose(
  rooms: RoomMap,
  roomID: RoomID,
  clientID: ClientID
) {
  const room = rooms.get(roomID);
  if (!room) {
    return;
  }
  room.clients.delete(clientID);
  if (room.clients.size === 0) {
    rooms.delete(roomID);
  }
}
