import { Downstream } from "rs/protocol/down";
import { Socket } from "../rs/types/client-state";

export function sendError(ws: Socket, body: string) {
  const message: Downstream = ["error", body];
  ws.send(JSON.stringify(message));
}
