import { processPending } from "../process/process-pending";
import { Mutator, MutatorMap } from "../process/process-mutation";
import { FRAME_LENGTH_MS } from "../process/process-room";
import { ClientID, Socket } from "../types/client-state";
import { RoomID, RoomMap } from "../types/room-state";
import { Lock } from "../util/lock";
import { LogContext } from "../util/logger";
import { handleClose } from "./close";
import { handleConnection } from "./connect";
import { handleMessage } from "./message";
import { performance } from "perf_hooks";
import { LogLevel } from "replicache";

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
  private readonly _rooms: RoomMap = new Map();
  private readonly _lock = new Lock();
  private readonly _processHandler: ProcessHandler;
  private readonly _now: Now;
  private readonly _setTimeout: SetTimeout;
  private readonly _mutators: MutatorMap;
  private readonly _logLevel: LogLevel;
  private _processing = false;

  constructor(
    mutators: Record<string, Mutator>,
    logLevel = "info" as LogLevel,
    rooms: RoomMap = new Map(),
    processHandler: ProcessHandler = processPending,
    now: Now = performance.now,
    setTimeout: SetTimeout = globalThis.setTimeout
  ) {
    this._mutators = new Map([...Object.entries(mutators)]);
    this._logLevel = logLevel;
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
    const lc = new LogContext(this._logLevel).addContext(
      "req",
      Math.random().toString(36).substr(2)
    );

    lc.debug?.("connection request", url, "waiting for lock");
    await this._lock.withLock(async () => {
      lc.debug?.("received lock");
      await handleConnection(
        lc,
        ws,
        url,
        this._rooms,
        this.handleMessage.bind(this),
        this.handleClose.bind(this)
      );
    });
  }

  async handleMessage(
    roomID: RoomID,
    clientID: ClientID,
    data: string,
    ws: Socket
  ) {
    const lc = new LogContext(this._logLevel)
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
    const lc = new LogContext(this._logLevel).addContext(
      "req",
      Math.random().toString(36).substr(2)
    );
    lc.debug?.("handling processUntilDone");
    if (this._processing) {
      lc.debug?.("already processing, nothing to do");
      return;
    }
    this._processing = true;
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
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
        this._mutators,
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
    const lc = new LogContext(this._logLevel)
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
