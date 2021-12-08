import { IncomingMessage } from "http";
import { parse } from "url";
import { RoomID, RoomMap } from "./room-state";
import { z, ZodSchema } from "zod";
import { NullableVersion, nullableVersionSchema } from "./version";
import { Lock } from "./lock";
import { ClientID, ClientState, Socket } from "./client-state";
import {
  clientRecordKey,
  clientRecordSchema,
  ClientRecord,
} from "./client-record";
import { DBStorage } from "./db-storage";
import { transact } from "./pg";

export type Now = () => number;

export class Server {
  private _rooms: RoomMap = new Map();
  private _lock = new Lock();
  private _now: Now;

  constructor(rooms: RoomMap, now: Now) {
    this._rooms = rooms;
    this._now = now;
  }

  // Mainly for testing.
  get rooms() {
    return this._rooms;
  }

  async handleConnection(ws: Socket, url: string) {
    const { result, error } = getConnectRequest(url);
    if (result === null) {
      ws.send(error!);
      ws.close();
      return;
    }
    const { clientID, roomID, baseCookie, timestamp } = result;
    await transact(async (executor) => {
      const storage = new DBStorage(executor, roomID);
      const existingRecord = await storage.get(
        clientRecordKey(clientID),
        clientRecordSchema
      );
      const lastMutationID = existingRecord?.lastMutationID ?? 0;
      const record: ClientRecord = {
        baseCookie,
        lastMutationID,
      };
      await storage.put(clientRecordKey(clientID), record);
    });
    await this._lock.withLock(async () => {
      let room = this._rooms.get(roomID);
      if (!room) {
        room = {
          clients: new Map(),
        };
        this._rooms.set(roomID, room);
      }

      // Add or update ClientState.
      const existing = room.clients.get(clientID);
      if (existing) {
        existing.socket.close();
      }

      ws.onmessage = () => {}; // TODO
      ws.onclose = () => this.handleClose(roomID, clientID);

      const clockBehindByMs = this._now() - timestamp;

      const client: ClientState = {
        socket: ws,
        clockBehindByMs,
        pending: [],
      };
      room.clients.set(clientID, client);
    });
  }

  async handleClose(roomID: RoomID, clientID: ClientID): Promise<void> {
    await this._lock.withLock(async () => {
      const room = this._rooms.get(roomID);
      if (!room) {
        return;
      }
      room.clients.delete(clientID);
      if (room.clients.size === 0) {
        this._rooms.delete(roomID);
      }
    });
  }
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
