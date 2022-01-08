import { nanoid } from "nanoid";
import { PingMessage } from "../protocol/ping";
import { Replicache, Poke, PullerResult } from "replicache";
import { NullableVersion, nullableVersionSchema } from "../types/version";
import { downstreamSchema } from "../protocol/down";
import { PokeBody } from "../protocol/poke";
import { PushBody, PushMessage } from "../protocol/push";
import { GapTracker } from "../util/gap-tracker";
import { LogContext } from "../util/logger";
import { M } from "../../datamodel/mutators";
import { resolver } from "../util/resolver";
import { sleep } from "../util/sleep";

const pushTracker = new GapTracker("push");
const updateTracker = new GapTracker("update");
const timestampTracker = new GapTracker("timestamp");

export type ConnectionState = "DISCONNECTED" | "CONNECTING" | "CONNECTED";

export class Connection {
  private _rep: Replicache<M>;
  private _socket?: WebSocket;
  private _serverBehindBy?: number;
  private _lastMutationIDSent: number;
  private _roomID: string;
  private _l: LogContext;
  private _state: ConnectionState;
  private _onPong: () => void = () => {};

  constructor(rep: Replicache<M>, roomID: string) {
    this._rep = rep;
    this._rep.pusher = (req: Request) => this._pusher(req);
    this._roomID = roomID;
    this._l = new LogContext("debug").addContext("roomID", roomID);
    this._lastMutationIDSent = -1;
    this._state = "DISCONNECTED";
    this._watchdog();
  }

  private async _connect(l: LogContext) {
    if (this._state === "CONNECTING") {
      l.debug?.("Skipping duplicate connect request");
      return;
    }
    l.info?.("Connecting...");

    this._state = "CONNECTING";

    const baseCookie = await getBaseCookie(this._rep);
    const ws = createSocket(baseCookie, await this._rep.clientID, this._roomID);

    ws.addEventListener("message", (e) => {
      l.addContext("req", nanoid());
      l.debug?.("received message", e.data);

      const data = JSON.parse(e.data);
      const downMessage = downstreamSchema.parse(data);

      if (downMessage[0] === "connected") {
        l.info?.("Connected");

        this._state = "CONNECTED";
        this._socket = ws;
        this._serverBehindBy = undefined;
        this._lastMutationIDSent = -1;

        forcePush(this._rep);
        return;
      }

      if (downMessage[0] === "error") {
        throw new Error(downMessage[1]);
      }

      if (downMessage[0] == "pong") {
        this._onPong();
        return;
      }

      if (downMessage[0] !== "poke") {
        throw new Error(`Unexpected message: ${downMessage}`);
      }

      const pokeBody = downMessage[1];
      this._handlePoke(l, pokeBody);
    });

    ws.addEventListener("close", (e) => {
      l.info?.("got socket close event", e);
      this._disconnect();
    });
  }

  private _disconnect() {
    this._state = "DISCONNECTED";
    this._socket = undefined;
    this._serverBehindBy = undefined;
    this._lastMutationIDSent = -1;
  }

  private _handlePoke(l: LogContext, pokeBody: PokeBody) {
    updateTracker.push(performance.now());
    timestampTracker.push(pokeBody.timestamp);

    if (this._serverBehindBy === undefined) {
      this._serverBehindBy = performance.now() - pokeBody.timestamp;
      l.debug?.(
        "local clock is",
        performance.now(),
        "serverBehindBy",
        this._serverBehindBy
      );
    }

    const localTimestamp = pokeBody.timestamp + this._serverBehindBy;
    const delay = Math.max(0, localTimestamp - performance.now());
    const p: Poke = {
      baseCookie: pokeBody.baseCookie,
      pullResponse: {
        lastMutationID: pokeBody.lastMutationID,
        patch: pokeBody.patch,
        cookie: pokeBody.cookie,
      },
    };
    l.debug?.("localTimestamp of poke", localTimestamp);
    l.debug?.("playing poke", p, "with delay", delay);

    window.setTimeout(async () => {
      try {
        await this._rep.poke(p);
      } catch (e) {
        if (String(e).indexOf("unexpected base cookie for poke") > -1) {
          this._l.info?.("out of order poke, disconnecting");
          this._socket?.close();
          return;
        }
        throw e;
      }
    }, delay);
  }

  private async _pusher(req: Request) {
    if (!this._socket) {
      this._connect(this._l);
      return {
        errorMessage: "",
        httpStatusCode: 200,
      };
    }

    const pushBody = (await req.json()) as PushBody;
    const msg: PushMessage = ["push", pushBody];

    const newMutations = [];
    for (const m of msg[1].mutations) {
      if (m.id > this._lastMutationIDSent) {
        this._lastMutationIDSent = m.id;
        newMutations.push(m);
      }
    }

    if (newMutations.length > 0) {
      pushBody.mutations = newMutations;
      pushBody.timestamp = performance.now();
      pushTracker.push(performance.now());
      this._socket!.send(JSON.stringify(msg));
    }

    return {
      errorMessage: "",
      httpStatusCode: 200,
    };
  }

  private async _watchdog() {
    while (true) {
      const l = this._l.addContext("req", nanoid());
      l.debug?.("watchdog fired");
      if (this._state === "CONNECTED") {
        await this._ping(l);
      } else {
        this._connect(l);
      }
      await sleep(5000);
    }
  }

  private async _ping(l: LogContext) {
    l.debug?.("pinging");
    const { promise, resolve } = resolver();
    this._onPong = resolve;
    const pingMessage: PingMessage = ["ping", {}];
    const t0 = performance.now();
    this._socket!.send(JSON.stringify(pingMessage));
    const connected = await Promise.race([
      promise.then(() => true),
      sleep(2000).then(() => false),
    ]);
    const delta = performance.now() - t0;
    if (connected) {
      l.debug?.("ping succeeded in", delta, "ms");
    } else {
      l.debug?.("ping failed in", delta, "ms - disconnecting");
      this._socket?.close();
    }
  }
}

// Hack to force a push to occur
async function forcePush(rep: Replicache<M>) {
  await rep.mutate.nop();
}

// Total hack to get base cookie
async function getBaseCookie(rep: Replicache) {
  const { promise, resolve } = await resolver<NullableVersion>();
  rep.puller = async (req): Promise<PullerResult> => {
    const val = await req.json();
    const parsed = nullableVersionSchema.parse(val.cookie);
    resolve(parsed);
    return {
      httpRequestInfo: {
        errorMessage: "",
        httpStatusCode: 200,
      },
    };
  };
  rep.pull();
  return await promise;
}

function createSocket(
  baseCookie: NullableVersion,
  clientID: string,
  roomID: string
) {
  const url = new URL(location.href);
  url.pathname = "/rs";
  url.protocol = url.protocol.replace("http", "ws");
  url.searchParams.set("clientID", clientID);
  url.searchParams.set("roomID", roomID);
  url.searchParams.set(
    "baseCookie",
    baseCookie === null ? "" : String(baseCookie)
  );
  url.searchParams.set("ts", String(performance.now()));
  return new WebSocket(url.toString());
}
