import { nanoid } from "nanoid";
import { Replicache, Poke, PullerResult } from "replicache";
import {
  NullableVersion,
  nullableVersionSchema,
} from "../backend/types/version";
import { downstreamSchema } from "../protocol/down";
import { PokeBody } from "../protocol/poke";
import { PushBody, PushMessage } from "../protocol/push";
import { GapTracker } from "../util/gap-tracker";
import { LogContext } from "../util/logger";
import { M } from "./mutators";
import { resolver } from "./resolver";

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

  constructor(rep: Replicache<M>, roomID: string) {
    this._rep = rep;
    this._rep.pusher = (req: Request) => this._pusher(req);
    this._roomID = roomID;
    this._l = new LogContext("debug").addContext("roomID", roomID);
    this._lastMutationIDSent = -1;
    this._state = "DISCONNECTED";

    this._connect();
  }

  private async _connect() {
    if (this._state === "CONNECTING") {
      this._l.debug?.("Skipping duplicate connect request");
      return;
    }
    this._l.info?.("Connecting...");

    this._state = "CONNECTING";

    const baseCookie = await getBaseCookie(this._rep);
    const ws = createSocket(baseCookie, await this._rep.clientID, this._roomID);

    ws.addEventListener("message", (e) => {
      const l = this._l.addContext("req", nanoid());
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

      if (downMessage[0] !== "poke") {
        throw new Error(`Unexpected message: ${downMessage}`);
      }

      const pokeBody = downMessage[1];
      this._handlePoke(l, pokeBody);
    });

    ws.addEventListener("close", (e) => {
      this._l.info?.("socket closed", e);
      this._state = "DISCONNECTED";
      this._socket = undefined;
      this._serverBehindBy = undefined;
      this._lastMutationIDSent = -1;
    });
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

    window.setTimeout(() => {
      this._rep.poke(p);
    }, delay);
  }

  private async _pusher(req: Request) {
    if (!this._socket) {
      this._connect();
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
  url.pathname = "/";
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
