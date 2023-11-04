import type { Reflect } from "@rocicorp/reflect/client";
import { useSubscribe, usePresence } from "@rocicorp/reflect/react";
import { getClientState, mustGetClientState } from "./client-state";
import { getShape, listShapeIDs } from "./shape";
import type { M } from "./mutators";

export function useShapeIDs(reflect: Reflect<M>) {
  return useSubscribe(reflect, listShapeIDs, []);
}

export function useShapeByID(reflect: Reflect<M>, id: string) {
  return useSubscribe(reflect, (tx) => getShape(tx, id), null);
}

export function useCollaboratorIDs(reflect: Reflect<M>) {
  const clientIDs = usePresence(reflect);
  return clientIDs.filter((id) => id !== reflect.clientID);
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
