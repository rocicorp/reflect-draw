import { useEffect, useState } from "react";
import { Poke, PullerResult, Replicache } from "replicache";
import { Designer } from "../../frontend/designer";
import { Nav } from "../../frontend/nav";
import { M, mutators } from "../../frontend/mutators";
import { randUserInfo } from "../../frontend/client-state";
import { randomShape } from "../../frontend/shape";
import { PushMessage, PushBody } from "../../protocol/push";
import { resolver } from "frontend/resolver";
import { downstreamSchema } from "protocol/down";
import { NullableVersion, nullableVersionSchema } from "backend/types/version";
import { GapTracker } from "util/gap-tracker";
import { LogContext } from "util/logger";
import { nanoid } from "nanoid";

const pushTracker = new GapTracker("push");
let lastMutationIDSent = -1;
let serverBehindBy = NaN;

export default function Home() {
  const [rep, setRep] = useState<Replicache<M> | null>(null);

  // TODO: Replicache + SSR could be cool!
  useEffect(() => {
    (async () => {
      if (rep) {
        return;
      }

      const [, , docID] = location.pathname.split("/");
      const r = new Replicache({
        name: docID,
        mutators,

        // TODO: Do we need these?
        // TODO: figure out backoff?
        pushDelay: 0,
        requestOptions: {
          maxDelayMs: 0,
          minDelayMs: 0,
        },

        // We only use pull to get the base cookie.
        pullInterval: null,

        pusher: async (req) => {
          const ws = await socket;
          const pushBody = (await req.json()) as PushBody;
          const msg: PushMessage = ["push", pushBody];

          const newMutations = [];
          for (const m of msg[1].mutations) {
            if (m.id > lastMutationIDSent) {
              lastMutationIDSent = m.id;
              newMutations.push(m);
            }
          }

          if (newMutations.length > 0) {
            pushBody.mutations = newMutations;
            pushTracker.push(performance.now());
            ws.send(JSON.stringify(msg));
          }

          return {
            errorMessage: "",
            httpStatusCode: 200,
          };
        },
      });

      const socket = (async () => {
        const {
          promise: baseCookiePromise,
          resolve: baseCookieResolver,
        } = await resolver<NullableVersion>();
        r.puller = async (req): Promise<PullerResult> => {
          const val = await req.json();
          const parsed = nullableVersionSchema.parse(val.cookie);
          baseCookieResolver(parsed);
          return {
            httpRequestInfo: {
              errorMessage: "",
              httpStatusCode: 200,
            },
          };
        };
        r.pull();

        const baseCookie = await baseCookiePromise;

        const url = new URL(location.href);
        url.pathname = "/";
        url.protocol = url.protocol.replace("http", "ws");
        url.searchParams.set("clientID", await r.clientID);
        url.searchParams.set("roomID", docID);
        url.searchParams.set(
          "baseCookie",
          baseCookie === null ? "" : String(baseCookie)
        );
        url.searchParams.set("ts", String(performance.now()));
        const ws = new WebSocket(url.toString());
        const { promise, resolve } = resolver<WebSocket>();
        ws.addEventListener("open", () => {
          resolve(ws);
        });
        const updateTracker = new GapTracker("update");
        const timestampTracker = new GapTracker("timestamp");
        ws.addEventListener("message", (e) => {
          const l = new LogContext("debug").addContext("req", nanoid());
          const data = JSON.parse(e.data);
          const downMessage = downstreamSchema.parse(data);
          if (downMessage[0] === "error") {
            throw new Error(downMessage[1]);
          }

          const pokeBody = downMessage[1];

          updateTracker.push(performance.now());
          timestampTracker.push(pokeBody.timestamp);

          if (isNaN(serverBehindBy)) {
            serverBehindBy = performance.now() - pokeBody.timestamp;
            l.debug?.(
              "local clock is",
              performance.now(),
              "serverBehindBy",
              serverBehindBy
            );
          }

          const localTimestamp = pokeBody.timestamp + serverBehindBy;
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
            r.poke(p);
          }, delay);
        });
        return await promise;
      })();

      const defaultUserInfo = randUserInfo();
      await r.mutate.initClientState({
        id: await r.clientID,
        defaultUserInfo,
      });
      r.onSync = (syncing: boolean) => {
        if (!syncing) {
          r.onSync = null;
          r.mutate.initShapes(Array.from({ length: 5 }, () => randomShape()));
        }
      };

      setRep(r);
    })();
  }, []);

  if (!rep) {
    return null;
  }

  return (
    <div
      style={{
        position: "absolute",
        display: "flex",
        flexDirection: "column",
        left: 0,
        top: 0,
        width: "100%",
        height: "100%",
        background: "rgb(229,229,229)",
      }}
    >
      <Nav rep={rep} />
      <Designer {...{ rep }} />
    </div>
  );
}
