import { RoomID, RoomMap } from "../types/room-state";
import { Lock } from "../util/lock";
import { ClientID, Socket } from "../types/client-state";

export type Now = () => number;

export type ConnectionHandler = (
  ws: Socket,
  url: string,
  rooms: RoomMap,
  onMessage: (
    roomID: RoomID,
    clientID: ClientID,
    data: string,
    ws: Socket
  ) => void,
  onClose: (roomID: RoomID, clientID: ClientID) => void,
  now: Now
) => Promise<void>;

export type MessageHandler = (
  roomMap: RoomMap,
  roomID: RoomID,
  clientID: ClientID,
  data: string,
  ws: Socket
) => void;

export type CloseHandler = (
  roomMap: RoomMap,
  roomID: RoomID,
  clientID: ClientID
) => void;

export class Server {
  private _rooms: RoomMap = new Map();
  private _lock = new Lock();
  private _connectionHandler: ConnectionHandler;
  private _messageHandler: MessageHandler;
  private _closeHandler: CloseHandler;
  private _now: Now;

  constructor(
    rooms: RoomMap,
    connectionHandler: ConnectionHandler,
    messageHandler: MessageHandler,
    closeHandler: CloseHandler,
    now: Now
  ) {
    this._rooms = rooms;
    this._connectionHandler = connectionHandler;
    this._messageHandler = messageHandler;
    this._closeHandler = closeHandler;
    this._now = now;
  }

  // Mainly for testing.
  get rooms() {
    return this._rooms;
  }

  async handleConnection(ws: Socket, url: string) {
    await this._lock.withLock(async () => {
      await this._connectionHandler(
        ws,
        url,
        this._rooms,
        this.handleMessage.bind(this),
        this.handleClose.bind(this),
        this._now
      );
    });
  }

  async handleMessage(
    roomID: RoomID,
    clientID: ClientID,
    data: string,
    ws: Socket
  ) {
    await this._lock.withLock(async () => {
      this._messageHandler(this.rooms, roomID, clientID, data, ws);
    });
  }

  async handleClose(roomID: RoomID, clientID: ClientID): Promise<void> {
    await this._lock.withLock(async () => {
      this._closeHandler(this.rooms, roomID, clientID);
    });
  }
}
