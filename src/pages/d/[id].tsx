import { useEffect, useState } from "react";
import { Reflect } from "reflect";
import { Designer } from "../../frontend/designer";
import { Nav } from "../../frontend/nav";
import { M, mutators } from "../../datamodel/mutators";
import { randUserInfo } from "../../datamodel/client-state";
import { nanoid } from "nanoid";

export default function Home() {
  const [reflectClient, setReflectClient] = useState<Reflect<M> | null>(null);
  useEffect(() => {
    const [, , roomID] = location.pathname.split("/");

    (async () => {
      const workerOrigin =
        process.env.NEXT_PUBLIC_WORKER_HOST ??
        "wss://replidraw.replicache.workers.dev";
      console.info(`Connecting to worker at ${workerOrigin}`);
      const userID = nanoid();
      const r = new Reflect<M>({
        socketOrigin: workerOrigin,
        userID,
        roomID,
        auth: JSON.stringify({
          userID: nanoid(),
          roomID: roomID,
        }),
        mutators,
      });

      const defaultUserInfo = randUserInfo();
      await r.mutate.initClientState({
        id: await r.clientID,
        defaultUserInfo,
      });
      // r.onSync = (syncing: boolean) => {
      //   if (!syncing) {
      //     r.onSync = null;
      //     r.mutate.initShapes(Array.from({ length: 5 }, () => randomShape()));
      //   }
      // };

      setReflectClient(r);
    })();
  }, []);

  if (!reflectClient) {
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
      <Nav reflectClient={reflectClient} />
      <Designer {...{ reflectClient }} />
    </div>
  );
}
