import {
  LogSink,
  createReflectServer,
  ReflectServerBaseEnv,
  createWorkerDatadogLogSink,
} from "@rocicorp/reflect/server";
import { nodeConsoleLogSink } from "@rocicorp/logger";
import { clearCursorAndSelectionState } from "../src/datamodel/client-state.js";
import { serverMutators } from "../src/datamodel/mutators.js";
function getLogSinks(env: ReplidrawEnv): LogSink[] {
  let logSinks = [nodeConsoleLogSink];
  if (env.REFLECT_DATADOG_API_KEY) {
    logSinks.push(
      createWorkerDatadogLogSink({
        apiKey: env.REFLECT_DATADOG_API_KEY,
        service: "replidraw-do",
      })
    );
  }
  return logSinks;
}

interface ReplidrawEnv extends ReflectServerBaseEnv {
  REFLECT_DATADOG_API_KEY?: string;
}

const authHandler = async (auth: string, roomID: string) => {
  // Note a real implementation should use signed and encrypted auth tokens,
  // or store the auth tokens in a session database for validation.
  const authJson = JSON.parse(auth);
  if (!authJson) {
    throw Error("Empty auth");
  }
  if (authJson.roomID !== roomID) {
    throw new Error("incorrect roomID");
  }
  if (!authJson.userID || typeof authJson.userID !== "string") {
    throw new Error("Missing userID");
  }
  return {
    userID: authJson.userID,
  };
};

const { worker, RoomDO, AuthDO } = createReflectServer((env: ReplidrawEnv) => ({
  mutators: serverMutators,
  authHandler,
  disconnectHandler: async (write) => {
    await clearCursorAndSelectionState(write, { id: write.clientID });
  },
  logSinks: getLogSinks(env),
  logLevel: "debug",
  allowUnconfirmedWrites: false,
}));
export { worker as default, RoomDO, AuthDO };
