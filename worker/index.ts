import {
  consoleLogger,
  DatadogLogger,
  Server as BaseServer,
  TeeLogger,
} from "reps-do";
export { worker as default } from "reps-do";
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
