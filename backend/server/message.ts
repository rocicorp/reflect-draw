import { sendError } from "../util/socket";
import { upstreamSchema } from "../../protocol/up";
import { PushBody } from "../../protocol/push";
import { ClientID, Socket } from "../types/client-state";
import { RoomID, RoomMap } from "../types/room-state";

export type PushHandler = (
  roomMap: RoomMap,
  roomID: RoomID,
  clientID: ClientID,
  body: PushBody,
  ws: Socket
) => void;

/**
 * Handles an upstream message coming into the server by dispatching to the
 * appropriate handler. Currently there's just one handler :).
 * @param handlePush handles a push message
 * @param roomMap currently running rooms
 * @param roomID destination room
 * @param clientID client message came from
 * @param data raw message data
 * @param ws socket connection to source client
 * @returns
 */
export function handleMessage(
  handlePush: PushHandler,
  roomMap: RoomMap,
  roomID: RoomID,
  clientID: ClientID,
  data: string,
  ws: Socket
) {
  const { result: message, error } = getMessage(data);
  if (error) {
    sendError(ws, error);
    return;
  }

  const [type, body] = message!;
  switch (type) {
    case "push":
      handlePush(roomMap, roomID, clientID, body, ws);
      break;
    default:
      throw new Error(`Unknown message type: ${type}`);
  }
}

function getMessage(data: string) {
  let json;
  try {
    json = JSON.parse(data);
    const message = upstreamSchema.parse(json);
    return { result: message };
  } catch (e) {
    return { error: String(e) };
  }
}
