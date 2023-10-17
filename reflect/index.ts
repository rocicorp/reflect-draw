import type { ReflectServerOptions } from "@rocicorp/reflect/server";
import { serverMutators, M } from "../src/datamodel/mutators.js";

function makeOptions(): ReflectServerOptions<M> {
  return {
    mutators: serverMutators,
    logLevel: "debug",
  };
}

export { makeOptions as default };
