import type { Reflect } from "@rocicorp/reflect";
import { useSubscribe } from "replicache-react";
import { getClientState, clientStatePrefix } from "./client-state";
import { getShape, getShapes } from "./shape";
import type { M } from "./mutators";

export function useShapes(reflect: Reflect<M>) {
  return useSubscribe(
    reflect,
    async (tx) => {
      return getShapes(tx);
    },
    []
  );
}

export function useUserInfo(reflect: Reflect<M>) {
  return useSubscribe(
    reflect,
    async (tx) => {
      return (await getClientState(tx, tx.clientID)).userInfo;
    },
    null
  );
}

export function useOverShape(reflect: Reflect<M>) {
  return useSubscribe(
    reflect,
    async (tx) => {
      const { overID } = await getClientState(tx, tx.clientID);
      return overID ? (await getShape(tx, overID)) ?? null : null;
    },
    null
  );
}

export function useSelectedShape(reflect: Reflect<M>) {
  return useSubscribe(
    reflect,
    async (tx) => {
      const { selectedID } = await getClientState(tx, tx.clientID);
      return selectedID ? (await getShape(tx, selectedID)) ?? null : null;
    },
    null
  );
}

export function useCollaboratorIDs(reflect: Reflect<M>) {
  return useSubscribe(
    reflect,
    async (tx) => {
      const clientIDs = (await tx
        .scan({ prefix: clientStatePrefix })
        .keys()
        .toArray()) as string[];
      const myClientID = tx.clientID;
      return clientIDs
        .filter((k) => !k.endsWith(myClientID))
        .map((k) => k.substr(clientStatePrefix.length));
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
