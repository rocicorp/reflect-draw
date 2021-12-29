import { upstreamSchema } from "../../protocol/up";
import { ClientID, Socket } from "../types/client-state";
import { RoomID, RoomMap } from "../types/room-state";
import { LogContext } from "../../util/logger";
import { sendError } from "../../util/socket";
import { handlePush, ProcessUntilDone } from "./push";

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
  lc: LogContext,
  roomMap: RoomMap,
  roomID: RoomID,
  clientID: ClientID,
  data: string,
  ws: Socket,
  processUntilDone: ProcessUntilDone
) {
  const { result: message, error } = getMessage(data);
  if (error) {
    lc.info?.("invalid message", error);
    sendError(ws, error);
    return;
  }

  const [type, body] = message!;
  switch (type) {
    case "push":
      handlePush(
        lc,
        roomMap,
        roomID,
        clientID,
        body,
        ws,
        () => performance.now(),
        processUntilDone
      );
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
