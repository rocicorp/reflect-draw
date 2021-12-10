import { parse } from "url";
import { RoomID, RoomMap } from "./types/room-state";
import { Lock } from "./util/lock";
import { ClientID, ClientState, Socket } from "./types/client-state";
import {
  clientRecordKey,
  clientRecordSchema,
  ClientRecord,
} from "./types/client-record";
import { DBStorage } from "./storage/db-storage";
import { transact } from "./db/pg";
import { PushBody } from "../protocol/push";
import { sendError } from "./util/socket";
import { upstreamSchema } from "../protocol/up";

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

      ws.onmessage = (event) =>
        this.handleMessage(roomID, clientID, event.data.toString(), ws);
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

  async handleMessage(
    roomID: RoomID,
    clientID: ClientID,
    data: string,
    ws: Socket
  ) {
    const getMessage = () => {
      let json;
      try {
        json = JSON.parse(data);
        const message = upstreamSchema.parse(json);
        return { result: message };
      } catch (e) {
        return { error: String(e) };
      }
    };
    await this._lock.withLock(async () => {
      const { result: message, error } = getMessage();
      if (error) {
        sendError(ws, error);
        return;
      }

      const [type, body] = message!;
      switch (type) {
        case "push":
          this.handlePush(roomID, clientID, body, ws);
          break;
        default:
          throw new Error(`Unknown message type: ${type}`);
      }
    });
  }

  async handlePush(
    roomID: RoomID,
    clientID: ClientID,
    body: PushBody,
    ws: Socket
  ) {
    const room = this._rooms.get(roomID);
    if (!room) {
      sendError(ws, `no such room: ${roomID}`);
      return;
    }

    const client = room.clients.get(clientID);
    if (!client) {
      sendError(ws, `no such client: ${clientID}`);
      return;
    }

    for (const m of body.mutations) {
      let idx = client.pending.findIndex((pm) => pm.id >= m.id);
      if (idx === -1) {
        idx = client.pending.length;
      } else if (client.pending[idx].id === m.id) {
        console.log(`Mutation ${m.id} has already been queued`);
        continue;
      }
      m.timestamp += client.clockBehindByMs;
      client.pending.splice(idx, 0, m);
    }
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
