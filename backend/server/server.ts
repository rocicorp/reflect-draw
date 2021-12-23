import { parse } from "url";
import { mutators } from "../../frontend/mutators";
import { MutatorMap } from "../process/process-mutation";
import { FRAME_LENGTH_MS } from "../process/process-room";
import { ClientID, Socket } from "../types/client-state";
import { RoomID, RoomMap } from "../types/room-state";
import { Lock } from "../../util/lock";
import { LogContext } from "../../util/logger";
import { handleClose } from "./close";
import { handleConnection } from "./connect";
import { handleMessage } from "./message";

// We aim to process frames 30 times per second.
const PROCESS_INTERVAL_MS = 1000 / 30;

// We wait one frame before executing newly received mutations to allow for
// straggler mutations that should have been included in the frame to show up.
const SERVER_BUFFER_MS = FRAME_LENGTH_MS;

export type Now = () => number;
export type SetTimeout = (callback: () => void, delay: number) => void;

export type ProcessHandler = (
  lc: LogContext,
  rooms: RoomMap,
  mutators: MutatorMap,
  startTime: number,
  endTime: number
) => Promise<void>;

export class Server {
  private _rooms: RoomMap = new Map();
  private _lock = new Lock();
  private _processHandler: ProcessHandler;
  private _now: Now;
  private _setTimeout: SetTimeout;
  private _processing = false;

  constructor(
    rooms: RoomMap,
    processHandler: ProcessHandler,
    now: Now,
    setTimeout: SetTimeout
  ) {
    this._rooms = rooms;
    this._processHandler = processHandler;
    this._now = now;
    this._setTimeout = setTimeout;
  }

  // Mainly for testing.
  get rooms() {
    return this._rooms;
  }

  async handleConnection(ws: Socket, url: string) {
    const lc = new LogContext("debug").addContext(
      "req",
      Math.random().toString(36).substr(2)
    );

    const parsed = parse(url);
    if (parsed.pathname !== "/") {
      lc.debug?.("connection request for non-replidraw url - ignoring", url);
      return;
    }

    lc.debug?.("connection request", url, "waiting for lock");
    await this._lock.withLock(async () => {
      lc.debug?.("received lock");
      await handleConnection(
        lc,
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
    const lc = new LogContext("debug")
      .addContext("req", Math.random().toString(36).substr(2))
      .addContext("room", roomID)
      .addContext("client", clientID);
    lc.debug?.("handling message", data, "waiting for lock");

    await this._lock.withLock(async () => {
      lc.debug?.("received lock");
      handleMessage(lc, this.rooms, roomID, clientID, data, ws, () =>
        this.processUntilDone()
      );
    });
  }

  async processUntilDone() {
    const lc = new LogContext("debug").addContext(
      "req",
      Math.random().toString(36).substr(2)
    );
    lc.debug?.("handling processUntilDone");
    if (this._processing) {
      lc.debug?.("already processing, nothing to do");
      return;
    }
    this._processing = true;
    this.processNext(lc);
  }

  async processNext(lc: LogContext) {
    lc.debug?.("processNext - waiting for lock");
    await this._lock.withLock(async () => {
      lc.debug?.("received lock");

      if (!hasPendingMutations(this.rooms)) {
        lc.debug?.("No pending mutations to process, exiting");
        this._processing = false;
        return;
      }

      const taskStartTime = this._now();
      const simEndTime = taskStartTime - SERVER_BUFFER_MS;
      const simStartTime = simEndTime - PROCESS_INTERVAL_MS;
      await this._processHandler(
        lc,
        this.rooms,
        // TODO: client and server should agree whether this thing is an object or map.
        new Map([...Object.entries(mutators)]),
        simStartTime,
        simEndTime
      );
      const elapsed = this._now() - taskStartTime;
      const delay = Math.max(0, PROCESS_INTERVAL_MS - elapsed);
      lc.debug?.("scheduling processNext in", delay, "ms");
      this._setTimeout(() => this.processNext(lc), delay);
    });
  }

  async handleClose(roomID: RoomID, clientID: ClientID): Promise<void> {
    const lc = new LogContext("debug")
      .addContext("req", Math.random().toString(36).substr(2))
      .addContext("room", roomID)
      .addContext("client", clientID);
    lc.debug?.("handling close - waiting for lock");
    await this._lock.withLock(async () => {
      lc.debug?.("received lock");
      handleClose(lc, this.rooms, roomID, clientID);
    });
  }
}

function hasPendingMutations(rooms: RoomMap) {
  for (const roomState of rooms.values()) {
    for (const clientState of roomState.clients.values()) {
      if (clientState.pending.length > 0) {
        return true;
      }
    }
  }
  return false;
}
