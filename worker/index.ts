import {
  consoleLogger,
  DatadogLogger,
  Server as BaseServer,
  TeeLogger,
} from "reps-do";
import { Server as BaseServer } from "reps-do";
import { createWorker } from "reps-do";
import { mutators, type M } from "../src/datamodel/mutators.js";

export class Server extends BaseServer<M> {
  constructor(state: DurableObjectState, env: Record<string, string>) {
    let logger = consoleLogger;
    if (env.DATADOG_LOG_LEVEL) {
      logger = new TeeLogger([
        logger,
        new DatadogLogger({
          apiKey: env.DATADOG_API_KEY,
          service: "replidraw",
        }),
      ]);
    }

    super({
      mutators,
      state,
      logger,
    });
  }
}

export default createWorker(
  async (authToken: string, url: URL, clientID: string, roomID: string) => {
    console.log("authenticateAndAuthorize", authToken, url, clientID, roomID);
    if (authToken) {
      return {
        userID: authToken,
        userName: "Bob",
      };
    }
    throw Error("Unauthorized");
  }
);
