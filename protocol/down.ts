import { z } from "zod";
import { errorMessageSchema } from "./error";
import { pokeBodySchema } from "./poke";

export const downstreamSchema = z.union([pokeBodySchema, errorMessageSchema]);

export type Downstream = z.infer<typeof downstreamSchema>;
