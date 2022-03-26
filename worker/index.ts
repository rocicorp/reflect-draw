import {
  consoleLogger,
  DatadogLogger,
  Logger,
  TeeLogger,
  createReflect,
  ReflectBaseEnv,
} from "reflect";
import { mutators, type M } from "../src/datamodel/mutators.js";

function createLogger(env: ReplidrawEnv): Logger {
  let logger = consoleLogger;
  if (env.DATADOG_API_KEY) {
    logger = new TeeLogger([
      logger,
      new DatadogLogger({
        apiKey: env.DATADOG_API_KEY,
      }),
    ]);
  }
  return logger;
}

interface ReplidrawEnv extends ReflectBaseEnv {
  DATADOG_API_KEY?: string;
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

const { worker, RoomDO, AuthDO } = createReflect({
  mutators,
  authHandler,
  createLogger,
  getLogLevel: () => "info",
});
export { worker as default, RoomDO, AuthDO };
