import { useEffect, useState } from "react";
import { Reflect } from "@rocicorp/reflect/client";
import { Designer } from "../../frontend/designer";
import { Nav } from "../../frontend/nav";
import { M, clientMutators } from "../../datamodel/mutators";
import { randUserInfo } from "../../datamodel/client-state";
import { nodeConsoleLogSink, OptionalLoggerImpl } from "@rocicorp/logger";
import { workerWsURI } from "../../util/host";
import { nanoid } from "nanoid";

export default function Home() {
  const [reflect, setReflectClient] = useState<Reflect<M> | null>(null);
  const [online, setOnline] = useState(false);

  const logSink = nodeConsoleLogSink;
  const logger = new OptionalLoggerImpl(logSink);

  useEffect(() => {
    const [, , roomID] = location.pathname.split("/");

    (async () => {
      logger.info?.(`Connecting to worker at ${workerWsURI}`);
      const userID = nanoid();

      const r = new Reflect<M>({
        socketOrigin: workerWsURI,
        onOnlineChange: setOnline,
        userID,
        roomID,
        mutators: clientMutators,
      });

      const defaultUserInfo = randUserInfo();
      await r.mutate.initClientState({
        id: await r.clientID,
        cursor: null,
        overID: "",
        selectedID: "",
        userInfo: defaultUserInfo,
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
      <Nav r={reflect} online={online} />
      <Designer r={reflect} logger={logger} />
    </div>
  );
}
