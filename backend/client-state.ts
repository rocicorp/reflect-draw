import { Mutation } from "protocol/push";
import { CloseEvent, MessageEvent } from "ws";

export type ClientID = string;

export type ClientMap = Map<ClientID, ClientState>;

export interface Socket {
  send(data: string): void;
  close(): void;
  onclose?: (event: CloseEvent) => void;
  onmessage?: (event: MessageEvent) => void;
}

export type ClientState = {
  socket: Socket;

  // A list of mutations awaiting application from this client. Sorted by
  // lastMutationID and de-duplicated. The timestamps in these mutations
  // are in the server's timeframe. Note that they will generally increase
  // with respect to mutationID but that is not guaranteed.
  pending: Mutation[];

  // How long is the client's timestamp behind the local timestamp?
  clockBehindByMs: number;
};
