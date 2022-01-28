import { ClientMap } from "./client-state";

export type RoomID = string;

export type RoomMap = Map<RoomID, RoomState>;

export type RoomState = {
  clients: ClientMap;
};
