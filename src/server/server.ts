import { processPending } from "../process/process-pending";
import { Mutator, MutatorMap } from "../process/process-mutation";
import { FRAME_LENGTH_MS } from "../process/process-room";
import { ClientID, ClientMap, Socket } from "../types/client-state";
import { Lock } from "../util/lock";
import { LogContext } from "../util/logger";
import { handleClose } from "./close";
import { handleConnection } from "./connect";
import { handleMessage } from "./message";
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
  durable: DurableObjectStorage,
  clients: ClientMap,
  mutators: MutatorMap,
  startTime: number,
  endTime: number
) => Promise<void>;

export class Server {
  private readonly _durable: DurableObjectStorage;
  private readonly _clients: ClientMap = new Map();
  private readonly _lock = new Lock();
  private readonly _processHandler: ProcessHandler;
  private readonly _now: Now;
  private readonly _setTimeout: SetTimeout;
  private readonly _mutators: MutatorMap;
  private readonly _logLevel: LogLevel;
  private _processing = false;

  constructor(
    durable: DurableObjectStorage,
    mutators: Record<string, Mutator>,
    logLevel = "info" as LogLevel,
    clients: ClientMap = new Map(),
    processHandler: ProcessHandler = processPending,
    now: Now = Date.now,
    setTimeout: SetTimeout = globalThis.setTimeout
  ) {
    this._durable = durable;
    this._mutators = new Map([...Object.entries(mutators)]);
    this._logLevel = logLevel;
    this._clients = clients;
    this._processHandler = processHandler;
    this._now = now;
    this._setTimeout = setTimeout;
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
        this._durable,
        url,
        this._clients,
        this.handleMessage.bind(this),
        this.handleClose.bind(this)
      );
    });
  }

  async handleMessage(clientID: ClientID, data: string, ws: Socket) {
    const lc = new LogContext(this._logLevel)
      .addContext("req", Math.random().toString(36).substr(2))
      .addContext("client", clientID);
    lc.debug?.("handling message", data, "waiting for lock");

    await this._lock.withLock(async () => {
      lc.debug?.("received lock");
      handleMessage(lc, this._clients, clientID, data, ws, () =>
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

      if (!hasPendingMutations(this._clients)) {
        lc.debug?.("No pending mutations to process, exiting");
        this._processing = false;
        return;
      }

      const taskStartTime = this._now();
      const simEndTime = taskStartTime - SERVER_BUFFER_MS;
      const simStartTime = simEndTime - PROCESS_INTERVAL_MS;
      await this._processHandler(
        lc,
        this._durable,
        this._clients,
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

  async handleClose(clientID: ClientID): Promise<void> {
    const lc = new LogContext(this._logLevel)
      .addContext("req", Math.random().toString(36).substr(2))
      .addContext("client", clientID);
    lc.debug?.("handling close - waiting for lock");
    await this._lock.withLock(async () => {
      lc.debug?.("received lock");
      handleClose(this._clients, clientID);
    });
  }
}

function hasPendingMutations(clients: ClientMap) {
  for (const clientState of clients.values()) {
    if (clientState.pending.length > 0) {
      return true;
    }
  }
  return false;
}
