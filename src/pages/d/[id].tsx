import { Reflect } from "@rocicorp/reflect/client";
import { nanoid } from "nanoid";
import { useEffect, useState } from "react";
import { randUserInfo } from "../../datamodel/client-state";
import { M, clientMutators } from "../../datamodel/mutators";
import { Designer } from "../../frontend/designer";
import { Nav } from "../../frontend/nav";
import { reflectServer } from "../../util/host";

export default function Home() {
  const [reflect, setReflectClient] = useState<Reflect<M> | null>(null);
  const [online, setOnline] = useState(false);

  useEffect(() => {
    const [, , roomID] = location.pathname.split("/");

    console.info(`Connecting to Reflect server at ${reflectServer}`);
    const userID = nanoid();

    const r = new Reflect<M>({
      server: reflectServer,
      onOnlineChange: setOnline,
      userID,
      roomID,
      mutators: clientMutators,
    });

    const defaultUserInfo = randUserInfo();
    void r.mutate.initClientState({
      cursor: null,
      overID: "",
      selectedID: "",
      userInfo: defaultUserInfo,
    });
    void r.mutate.initShapes();

    setReflectClient(r);
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
      <Designer r={reflect} />
    </div>
  );
}
