import type { ReflectClient } from "reflect-client";
import { useSubscribe } from "replicache-react";
import { getClientState, clientStatePrefix } from "./client-state";
import { getShape, shapePrefix } from "./shape";
import type { mutators } from "./mutators";

export function useShapeIDs(reflectClient: ReflectClient<typeof mutators>) {
  return useSubscribe(
    reflectClient,
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

export function useShapeByID(
  reflectClient: ReflectClient<typeof mutators>,
  id: string
) {
  return useSubscribe(
    reflectClient,
    async (tx) => {
      return await getShape(tx, id);
    },
    null
  );
}

export function useUserInfo(reflectClient: ReflectClient<typeof mutators>) {
  return useSubscribe(
    reflectClient,
    async (tx) => {
      return (await getClientState(tx, await reflectClient.clientID)).userInfo;
    },
    null
  );
}

export function useOverShapeID(reflectClient: ReflectClient<typeof mutators>) {
  return useSubscribe(
    reflectClient,
    async (tx) => {
      return (await getClientState(tx, await reflectClient.clientID)).overID;
    },
    ""
  );
}

export function useSelectedShapeID(
  reflectClient: ReflectClient<typeof mutators>
) {
  return useSubscribe(
    reflectClient,
    async (tx) => {
      return (await getClientState(tx, await reflectClient.clientID))
        .selectedID;
    },
    ""
  );
}

export function useCollaboratorIDs(
  reflectClient: ReflectClient<typeof mutators>
) {
  return useSubscribe(
    reflectClient,
    async (tx) => {
      const clientIDs = (await tx
        .scan({ prefix: clientStatePrefix })
        .keys()
        .toArray()) as string[];
      const myClientID = await reflectClient.clientID;
      return clientIDs
        .filter((k) => !k.endsWith(myClientID))
        .map((k) => k.substr(clientStatePrefix.length));
    },
    []
  );
}

export function useClientInfo(
  reflectClient: ReflectClient<typeof mutators>,
  clientID: string
) {
  return useSubscribe(
    reflectClient,
    async (tx) => {
      return await getClientState(tx, clientID);
    },
    null
  );
}
