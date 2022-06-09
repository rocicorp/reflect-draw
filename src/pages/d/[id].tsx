import { useEffect, useState } from "react";
import { Reflect } from "@rocicorp/reflect";
import { Designer } from "../../frontend/designer";
import { Nav } from "../../frontend/nav";
import { M, clientMutators } from "../../datamodel/mutators";
import { randUserInfo } from "../../datamodel/client-state";
import { nanoid } from "nanoid";

export default function Home() {
  const [reflect, setReflectClient] = useState<Reflect<M> | null>(null);
  const [online, setOnline] = useState(false);
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
        onOnlineChange: setOnline,
        userID,
        roomID,
        auth: JSON.stringify({
          userID,
          roomID,
        }),
        mutators: clientMutators,
      });

      const defaultUserInfo = randUserInfo();
      await r.mutate.initClientState({
        id: await r.clientID,
        defaultUserInfo,
      });
      await r.mutate.initShapes();

      setReflectClient(r);
    })();
  }, []);

  if (!reflect) {
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
      <Nav reflect={reflect} online={online} />
      <Designer {...{ reflect }} />
    </div>
  );
}
