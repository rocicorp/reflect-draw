import { Server as BaseServer } from "reps-do";
export { worker as default } from "reps-do";
import { mutators, type M } from "../src/datamodel/mutators.js";

export class Server extends BaseServer<M> {
  constructor(state: DurableObjectState) {
    super(mutators, state);
  }
}
