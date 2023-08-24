import type { ReflectServerOptions } from "@rocicorp/reflect/server";
import { clearCursorAndSelectionState } from "../src/datamodel/client-state.js";
import { serverMutators, M } from "../src/datamodel/mutators.js";

function makeOptions(): ReflectServerOptions<M> {
  return {
    mutators: serverMutators,
    disconnectHandler: async (write) => {
      await clearCursorAndSelectionState(write, { id: write.clientID });
    },
    logLevel: "debug",
  };
}

export { makeOptions as default };
