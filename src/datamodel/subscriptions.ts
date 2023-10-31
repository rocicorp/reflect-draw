import type { Reflect } from "@rocicorp/reflect/client";
import { useSubscribe, usePresence } from "@rocicorp/reflect/react";
import { getClientState, mustGetClientState } from "./client-state";
import { getShape, listShapeIDs } from "./shape";
import type { M } from "./mutators";
import { useEffect, useState } from "react";

export function useShapeIDs(reflect: Reflect<M>) {
  return useSubscribe(reflect, listShapeIDs, []);
}

export function useShapeByID(reflect: Reflect<M>, id: string) {
  return useSubscribe(reflect, (tx) => getShape(tx, id), null);
}

export function useCollaboratorIDs(reflect: Reflect<M>) {
  // TODO: This will go away soon, we are making r.clientID synchronous in an
  // upcoming Reflect release.
  const [myClientID, setClientID] = useState<string | null>(null);
  useEffect(() => {
    reflect.clientID.then(setClientID);
  }, [reflect]);

  const clientIDs = usePresence(reflect);

  if (myClientID === null) {
    return [];
  }

  return clientIDs.filter((id) => id !== myClientID);
}

export function useMyUserInfo(reflect: Reflect<M>) {
  return useSubscribe(
    reflect,
    async (tx) => {
      const cs = await mustGetClientState(tx, tx.clientID);
      return cs.userInfo;
    },
    null
  );
}

export function useSelectionState(reflect: Reflect<M>) {
  return useSubscribe(
    reflect,
    async (tx) => {
      const cs = await mustGetClientState(tx, tx.clientID);
      const { selectedID, overID } = cs;
      return { selectedID, overID };
    },
    { selectedID: "", overID: "" }
  );
}

export function useClientState(reflect: Reflect<M>, clientID: string) {
  return useSubscribe(
    reflect,
    async (tx) => {
      return await getClientState(tx, clientID);
    },
    null
  );
}
