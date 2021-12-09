import { Downstream } from "protocol/down";
import { Socket } from "./client-state";

export function sendError(ws: Socket, body: string) {
  const message: Downstream = ["error", body];
  ws.send(JSON.stringify(message));
}
