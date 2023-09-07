import type { Reflect } from "@rocicorp/reflect/client";
import { useSubscribe } from "replicache-react";
import { getClientState, listClientStates } from "./client-state";
import { getShape, listShapes } from "./shape";
import type { M } from "./mutators";

export function useShapeIDs(reflect: Reflect<M>) {
  return useSubscribe(
    reflect,
    async (tx) => {
      const shapes = await listShapes(tx);
      return shapes.map((s) => s.id);
    },
    []
  );
}

export function useShapeByID(reflect: Reflect<M>, id: string) {
  return useSubscribe(
    reflect,
    async (tx) => {
      return await getShape(tx, id);
    },
    null
  );
}

export function useCollaboratorIDs(reflect: Reflect<M>) {
  return useSubscribe(
    reflect,
    async (tx) => {
      const cs = await listClientStates(tx);
      return cs.map((c) => c.id).filter((id) => id !== tx.clientID);
    },
    []
  );
}

export function useMyClientState(reflect: Reflect<M>) {
  return useSubscribe(
    reflect,
    async (tx) => {
      return await getClientState(tx, tx.clientID);
    },
    null
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
