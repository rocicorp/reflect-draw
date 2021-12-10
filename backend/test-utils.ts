import { JSONType } from "protocol/json";
import { Mutation } from "protocol/push";
import { ClientID, ClientState, Socket } from "./client-state";
import { RoomID, RoomMap, RoomState } from "./room-state";
import { NullableVersion } from "./version";

export function roomMap(...rooms: [RoomID, RoomState][]): RoomMap {
  return new Map(rooms);
}

export function room(
  id: RoomID,
  ...clients: [ClientID, ClientState][]
): [RoomID, RoomState] {
  return [id, { clients: new Map(clients) }];
}

export function client(
  id: ClientID,
  socket: Socket = new Mocket(),
  clockBehindByMs: number = 1,
  ...mutations: Mutation[]
): [ClientID, ClientState] {
  return [id, { clockBehindByMs, pending: mutations, socket }] as [
    string,
    ClientState
  ];
}

export function mutation(
  id: number,
  name: string = "foo",
  args: JSONType = [],
  timestamp = 1
): Mutation {
  return {
    id,
    name,
    args,
    timestamp,
  };
}

export class Mocket implements Socket {
  log: string[][] = [];
  send(data: string): void {
    this.log.push(["send", data]);
  }
  close(): void {
    this.log.push(["close"]);
  }
  onclose: undefined;
  onmessage: undefined;
}

export function clientRecord(
  baseCookie: NullableVersion = null,
  lastMutationID: number = 1
) {
  return {
    baseCookie,
    lastMutationID,
  };
}

export function sleep(ms: number = 0) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
