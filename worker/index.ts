import { DatadogLogger, Server as BaseServer } from "reps-do";
export { worker as default } from "reps-do";
import { mutators, type M } from "../src/datamodel/mutators.js";

type TODO = any;
export class Server extends BaseServer<M> {
  constructor(state: DurableObjectState, env: TODO) {
    const abortController = new AbortController();
    const logger = new DatadogLogger({
      apiKey: env.DATADOG_API_KEY,
      service: "replidraw-do",
      signal: abortController.signal,
    });
    // console.log(logger);

    console.log("xxx env", env);

    super({
      mutators,
      state,
      logger,
      async onClose() {
        await logger.flush();
        abortController.abort();
      },
    });
  }
}
