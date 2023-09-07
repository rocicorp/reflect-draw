import type { Reflect } from "@rocicorp/reflect/client";
import { useSubscribe } from "replicache-react";
import { getClientState, listClientStateIDs } from "./client-state";
import { getShape, listShapeIDs } from "./shape";
import type { M } from "./mutators";

export function useShapeIDs(reflect: Reflect<M>) {
  return useSubscribe(reflect, listShapeIDs, []);
}

export function useShapeByID(reflect: Reflect<M>, id: string) {
  return useSubscribe(reflect, (tx) => getShape(tx, id), null);
}

export function useCollaboratorIDs(reflect: Reflect<M>) {
  return useSubscribe(
    reflect,
    async (tx) => {
      const cs = await listClientStateIDs(tx);
      return cs.filter((id) => id !== tx.clientID);
    },
    []
  );
}

export function useMyUserInfo(reflect: Reflect<M>) {
  return useSubscribe(
    reflect,
    async (tx) => {
      const cs = await getClientState(tx, tx.clientID);
      return cs.userInfo;
    },
    null
  );
}

export function useSelectionState(reflect: Reflect<M>) {
  return useSubscribe(
    reflect,
    async (tx) => {
      const cs = await getClientState(tx, tx.clientID);
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
