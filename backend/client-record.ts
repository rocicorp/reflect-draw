import { nullableVersionSchema } from "./version";
import { z } from "zod";

export type ClientID = string;

export const clientRecordSchema = z.object({
  lastMutationID: z.number(),
  baseCookie: nullableVersionSchema,
});

export type ClientRecord = z.infer<typeof clientRecordSchema>;

export const clientRecordPrefix = "client/";

export function clientRecordKey(clientID: ClientID): string {
  return `${clientRecordPrefix}${clientID}`;
}
