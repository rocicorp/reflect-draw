import { z } from "zod";
import { errorMessageSchema } from "./error";
import { pokeMessageSchema } from "./poke";

export const downstreamSchema = z.union([
  pokeMessageSchema,
  errorMessageSchema,
]);

export type Downstream = z.infer<typeof downstreamSchema>;
