import { parse } from "url";
import { transact } from "../db/pg";
import { DBStorage } from "../storage/db-storage";
import {
  ClientRecord,
  clientRecordKey,
  clientRecordSchema,
} from "../types/client-record";
import { ClientID, ClientState, Socket } from "../types/client-state";
import { RoomID, RoomMap } from "../types/room-state";
import { LogContext } from "../util/logger";
import { ConnectedMessage } from "../protocol/connected";

export type MessageHandler = (
  roomID: RoomID,
  clientID: ClientID,
  data: string,
  ws: Socket
) => void;

export type CloseHandler = (roomID: RoomID, clientID: ClientID) => void;

/**
 * Handles the connect message from a client, registering the client state in memory and updating the persistent client-record.
 * @param ws socket connection to requesting client
 * @param url raw URL of connect request
 * @param rooms currently running rooms
 * @param onMessage message handler for this connection
 * @param onClose callback for when connection closes
 * @returns
 */
export async function handleConnection(
  lc: LogContext,
  ws: Socket,
  url: string,
  rooms: RoomMap,
  onMessage: MessageHandler,
  onClose: CloseHandler
) {
  const { result, error } = getConnectRequest(url);
  if (result === null) {
    lc.info?.("invalid connection request", error);
    ws.send(error!);
    ws.close();
    return;
  }

  lc = lc
    .addContext("room", result.roomID)
    .addContext("client", result.clientID);
  lc.debug?.("parsed request", result);

  const { clientID, roomID, baseCookie, timestamp } = result;
  await transact(async (executor) => {
    const storage = new DBStorage(executor, roomID);
    const existingRecord = await storage.get(
      clientRecordKey(clientID),
      clientRecordSchema
    );
    lc.debug?.("Existing client record", existingRecord);
    const lastMutationID = existingRecord?.lastMutationID ?? 0;
    const record: ClientRecord = {
      baseCookie,
      lastMutationID,
    };
    await storage.put(clientRecordKey(clientID), record);
    lc.debug?.("Put client record", record);
  });
  let room = rooms.get(roomID);
  if (!room) {
    room = {
      clients: new Map(),
    };
    rooms.set(roomID, room);
  }

  // Add or update ClientState.
  const existing = room.clients.get(clientID);
  if (existing) {
    lc.debug?.("Closing old socket");
    existing.socket.close();
  }

  ws.onmessage = (event) =>
    onMessage(roomID, clientID, event.data.toString(), ws);
  ws.onclose = () => onClose(roomID, clientID);

  const client: ClientState = {
    socket: ws,
    clockBehindByMs: undefined,
    pending: [],
  };
  room.clients.set(clientID, client);

  const connectedMessage: ConnectedMessage = ["connected", {}];
  ws.send(JSON.stringify(connectedMessage));
}

export function getConnectRequest(urlString: string) {
  const url = parse(urlString, true);

  const getParam = (name: string, required: boolean) => {
    const value = url.query[name];
    if (value === "") {
      if (required) {
        throw new Error(`invalid querystring - missing ${name}`);
      }
      return null;
    }
    if (typeof value !== "string") {
      throw new Error(
        `invalid querystring parameter ${name}, url: ${urlString}, got: ${value}`
      );
    }
    return value;
  };
  const getIntegerParam = (name: string, required: boolean) => {
    const value = getParam(name, required);
    if (value === null) {
      return null;
    }
    const int = parseInt(value);
    if (isNaN(int)) {
      throw new Error(
        `invalid querystring parameter ${name}, url: ${urlString}, got: ${value}`
      );
    }
    return int;
  };

  try {
    const roomID = getParam("roomID", true)!;
    const clientID = getParam("clientID", true)!;
    const baseCookie = getIntegerParam("baseCookie", false);
    const timestamp = getIntegerParam("ts", true)!;

    return {
      result: {
        clientID,
        roomID,
        baseCookie,
        timestamp,
      },
      error: null,
    };
  } catch (e) {
    return {
      result: null,
      error: String(e),
    };
  }
}
