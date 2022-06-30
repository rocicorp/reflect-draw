import { useEffect, useState } from "react";
import { Reflect } from "@rocicorp/reflect";
import { Designer } from "../../frontend/designer";
import { Nav } from "../../frontend/nav";
import { M, clientMutators } from "../../datamodel/mutators";
import { randUserInfo } from "../../datamodel/client-state";
import { nanoid } from "nanoid";
import { consoleLogSink, OptionalLoggerImpl } from "@rocicorp/logger";
import { DataDogBrowserLogSink } from "../../frontend/data-dog-browser-log-sink";
import { UndoManager } from "@rocicorp/undo";

export default function Home() {
  const [reflect, setReflectClient] = useState<Reflect<M> | null>(null);
  const [online, setOnline] = useState(false);
  const [undoManager, setUndoManager] = useState<UndoManager | null>(null);

  const [canUndoRedo, setCanUndoRedo] = useState({
    canUndo: false,
    canRedo: false,
  });

  const logSink = process.env.NEXT_PUBLIC_DATADOG_CLIENT_TOKEN
    ? new DataDogBrowserLogSink()
    : consoleLogSink;
  const logger = new OptionalLoggerImpl(logSink);

  useEffect(() => {
    const [, , roomID] = location.pathname.split("/");

    (async () => {
      const workerOrigin =
        process.env.NEXT_PUBLIC_WORKER_HOST ??
        "wss://replidraw.replicache.workers.dev";
      logger.info?.(`Connecting to worker at ${workerOrigin}`);
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
        logSinks: [logSink],
        mutators: clientMutators,
      });

      const defaultUserInfo = randUserInfo();
      await r.mutate.initClientState({
        id: await r.clientID,
        defaultUserInfo,
      });
      await r.mutate.initShapes();

      setUndoManager(
        new UndoManager({
          onChange: setCanUndoRedo,
        })
      );

      setReflectClient(r);
    })();
  }, []);

  if (!reflect) {
    return null;
  }

  if (!undoManager) {
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
      <Nav
        reflect={reflect}
        online={online}
        canUndoRedo={canUndoRedo}
        undoManager={undoManager}
      />
      <Designer reflect={reflect} logger={logger} undoManager={undoManager} />
    </div>
  );
}
