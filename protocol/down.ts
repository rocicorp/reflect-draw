import { z } from "zod";
import { connectedMessageSchema } from "./connected";
import { errorMessageSchema } from "./error";
import { pokeMessageSchema } from "./poke";

export const downstreamSchema = z.union([
  connectedMessageSchema,
  pokeMessageSchema,
  errorMessageSchema,
]);

export type Downstream = z.infer<typeof downstreamSchema>;
