import { upstreamSchema } from "../protocol/up";
import { ClientID, Socket } from "../types/client-state";
import { RoomID, RoomMap } from "../types/room-state";
import { LogContext } from "../util/logger";
import { sendError } from "../util/socket";
import { handlePush, ProcessUntilDone } from "./push";
import { handlePing } from "./ping";

/**
 * Handles an upstream message coming into the server by dispatching to the
 * appropriate handler.
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
  const msg = getMessage(data);
  if (msg.error) {
    lc.info?.("invalid message", msg.error);
    sendError(ws, msg.error);
    return;
  }

  const message = msg.result!;

  switch (message[0]) {
    case "ping":
      handlePing(lc, ws);
      break;
    case "push":
      handlePush(
        lc,
        roomMap,
        roomID,
        clientID,
        message[1],
        ws,
        () => performance.now(),
        processUntilDone
      );
      break;
    default:
      throw new Error(`Unknown message type: ${message[0]}`);
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
