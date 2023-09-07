import type { Reflect } from "@rocicorp/reflect/client";
import { useSubscribe } from "replicache-react";
import { getClientState, listClientStates } from "./client-state";
import { getShape, shapePrefix } from "./shape";
import type { M } from "./mutators";

export function useShapeIDs(reflect: Reflect<M>) {
  return useSubscribe(
    reflect,
    async (tx) => {
      const shapes = (await tx
        .scan({ prefix: shapePrefix })
        .keys()
        .toArray()) as string[];
      return shapes.map((k) => k.substring(shapePrefix.length));
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

export function useUserInfo(reflect: Reflect<M>) {
  return useSubscribe(
    reflect,
    async (tx) => {
      return (await getClientState(tx, await reflect.clientID)).userInfo;
    },
    null
  );
}

export function useOverShapeID(reflect: Reflect<M>) {
  return useSubscribe(
    reflect,
    async (tx) => {
      return (await getClientState(tx, await reflect.clientID)).overID;
    },
    ""
  );
}

export function useSelectedShapeID(reflect: Reflect<M>) {
  return useSubscribe(
    reflect,
    async (tx) => {
      return (await getClientState(tx, await reflect.clientID)).selectedID;
    },
    ""
  );
}

export function useCollaboratorIDs(reflect: Reflect<M>) {
  return useSubscribe(
    reflect,
    async (tx) => {
      const cs = await listClientStates(tx);
      return cs.map((c) => c.id);
    },
    []
  );
}

export function useClientInfo(reflect: Reflect<M>, clientID: string) {
  return useSubscribe(
    reflect,
    async (tx) => {
      return await getClientState(tx, clientID);
    },
    null
  );
}
