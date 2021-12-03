import { useEffect, useState } from "react";
import { Replicache } from "replicache";
import { Designer } from "../../frontend/designer";
import { Nav } from "../../frontend/nav";
import { M, mutators } from "../../frontend/mutators";
import { randUserInfo } from "../../frontend/client-state";
import { randomShape } from "../../frontend/shape";
import { PushMessage, PushBody } from "../../protocol/push";
import { resolver } from "frontend/resolver";
import { nanoid } from "nanoid";
import { pokeMessageSchema } from "protocol/poke";

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
        useMemstore: true,
        name: docID,
        mutators,

        // TODO: figure out backoff?

        pusher: async (req) => {
          const ws = await socket;
          const pushBody = (await req.json()) as PushBody;
          pushBody.id = nanoid();
          const msg: PushMessage = ["push", pushBody];
          ws.send(JSON.stringify(msg));
          return {
            errorMessage: "",
            httpStatusCode: 200,
          };
        },
      });

      const socket = (async () => {
        const url = new URL(location.href);
        url.protocol = url.protocol.replace("http", "ws");
        url.searchParams.set("clientID", await r.clientID);
        const ws = new WebSocket(url.toString());
        const { promise, resolve } = resolver<WebSocket>();
        ws.addEventListener("open", () => {
          resolve(ws);
        });
        ws.addEventListener("message", (e) => {
          const data = JSON.parse(e.data);
          pokeMessageSchema.parse(data);
          // TODO
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
