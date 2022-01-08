import { ClientID } from "../types/client-state";
import { RoomID, RoomMap } from "../types/room-state";
import { LogContext } from "../../util/logger";

export function handleClose(
  lc: LogContext,
  rooms: RoomMap,
  roomID: RoomID,
  clientID: ClientID
) {
  const room = rooms.get(roomID);
  if (!room) {
    lc.info?.("room not found");
    return;
  }
  room.clients.delete(clientID);
  if (room.clients.size === 0) {
    lc.debug?.("no more clients in room - deleting room");
    rooms.delete(roomID);
  }
}
