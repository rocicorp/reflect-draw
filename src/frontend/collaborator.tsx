import styles from "./collaborator.module.css";
import { Rect } from "./rect";
import type { M } from "../datamodel/mutators";
import { useClientState } from "../datamodel/subscriptions";
import type { Reflect } from "@rocicorp/reflect/client";
import type { Mutators as YJSMutators } from "@rocicorp/reflect-yjs";

export function Collaborator({
  r,
  clientID,
}: {
  r: Reflect<M & YJSMutators>;
  clientID: string;
}) {
  const clientState = useClientState(r, clientID);

  if (!clientState || !clientState.cursor) {
    return null;
  }

  const { userInfo, cursor } = clientState;

  return (
    <div className={styles.collaborator}>
      {clientState.selectedID && (
        <Rect
          {...{
            r,
            key: `selection-${clientState.selectedID}`,
            id: clientState.selectedID,
            highlight: true,
            highlightColor: userInfo.color,
          }}
        />
      )}

      <div
        className={styles.cursor}
        style={{
          left: cursor.x,
          top: cursor.y,
          overflow: "auto",
        }}
      >
        <div className={styles.pointer} style={{ color: userInfo.color }}>
          ➤
        </div>
        <div
          className={styles.userinfo}
          style={{
            backgroundColor: userInfo.color,
            color: "white",
          }}
        >
          {userInfo.avatar}&nbsp;{userInfo.name}
        </div>
      </div>
    </div>
  );
}
