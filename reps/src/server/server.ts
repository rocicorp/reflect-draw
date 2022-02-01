import { processPending } from "../process/process-pending";
import { MutatorMap } from "../process/process-mutation";
import { FRAME_LENGTH_MS } from "../process/process-room";
import { ClientID, ClientMap, Socket } from "../types/client-state";
import { Lock } from "../util/lock";
import { LogContext } from "../util/logger";
import { handleClose } from "./close";
import { handleConnection } from "./connect";
import { handleMessage } from "./message";
import { LogLevel, MutatorDefs } from "replicache";

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

export class Server<MD extends MutatorDefs> {
  private readonly _clients: ClientMap = new Map();
  private readonly _lock = new Lock();
  private readonly _mutators: MutatorMap;
  private readonly _logLevel: LogLevel;
  private _turnTimerID: number | null = null;

  constructor(mutators: MD, private readonly _state: DurableObjectState) {
    this._mutators = new Map([...Object.entries(mutators)]) as MutatorMap;
    // TODO: make configurable
    this._logLevel = "debug";
    this._clients = new Map();
  }

  async fetch(request: Request) {
    const url = new URL(request.url);

    if (url.pathname === "/connect") {
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("expected websocket", { status: 400 });
      }
      const pair = new WebSocketPair();
      void this.handleConnection(pair[1], url);
      return new Response(null, { status: 101, webSocket: pair[0] });
    }

    throw new Error("unexpected path");
  }

  async handleConnection(ws: Socket, url: URL) {
    const lc = new LogContext(this._logLevel).addContext(
      "req",
      Math.random().toString(36).substr(2)
    );

    lc.debug?.("connection request", url.toString(), "waiting for lock");
    ws.accept();

    await this._lock.withLock(async () => {
      lc.debug?.("received lock");
      await handleConnection(
        lc,
        ws,
        this._state.storage,
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
    if (this._turnTimerID !== null) {
      lc.debug?.("already processing, nothing to do");
      return;
    }
    this._turnTimerID = setInterval(() => {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.processNext(lc);
    }, 1000 / 60);
  }

  async processNext(lc: LogContext) {
    lc.debug?.(
      `processNext - starting turn at ${Date.now()} - waiting for lock`
    );
    await this._lock.withLock(async () => {
      lc.debug?.(`received lock at ${Date.now()}`);

      if (!hasPendingMutations(this._clients)) {
        lc.debug?.("No pending mutations to process, exiting");
        clearInterval(this._turnTimerID!);
        this._turnTimerID = null;
        return;
      }

      await processPending(
        lc,
        this._state.storage,
        this._clients,
        this._mutators,
        Date.now()
      );
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
