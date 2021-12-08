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

  // A list of mutations awaiting application from this client. This list has
  // a funny invariant. It is sorted by mutationID AND serverTimestamp ascending.
  // The list needs to be sorted by mutationID because we need to process
  // mutations in that order to preserve causality. But it also needs to be sorted
  // by serverTimestamp so that mutations get processed in an order roughly
  // corresponding to realtime. The push handler (below) ensures this invariant
  // is preserved by adjusting serverTimestamp if necessary so that it is
  // monotonically increasing.
  pending: PendingMutation[];

  // How long is the client's timestamp behind the local timestamp?
  clockBehindByMs: number;
};

export type PendingMutation = Mutation & {
  serverTimestamp: number;
};
