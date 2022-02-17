import {
  consoleLog,
  DatadogLogger,
  Server as BaseServer,
  TeeLog,
} from "reps-do";
export { worker as default } from "reps-do";
import { mutators, type M } from "../src/datamodel/mutators.js";

export class Server extends BaseServer<M> {
  constructor(state: DurableObjectState, env: Record<string, string>) {
    let log = consoleLog;
    if (env.DATADOG_LOG_LEVEL) {
      log = new TeeLog([
        log,
        new DatadogLogger({
          apiKey: env.DATADOG_API_KEY,
          service: "replidraw",
        }),
      ]);
    }

    super({
      mutators,
      state,
      log,
    });
  }
}
