import type { Reflect } from "@rocicorp/reflect/client";
import { usePresence, useSubscribe } from "@rocicorp/reflect/react";
import { getClientState, mustGetClientState } from "./client-state";
import type { M } from "./mutators";
import { getShape, listShapeIDs } from "./shape";

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
      const cs = await mustGetClientState(tx);
      return cs.userInfo;
    },
    null
  );
}

export function useSelectionState(reflect: Reflect<M>) {
  return useSubscribe(
    reflect,
    async (tx) => {
      const cs = await mustGetClientState(tx);
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
      return await getClientState(tx, { clientID });
    },
    null
  );
}
