import { jsonSchema } from "../protocol/json";
import { versionSchema } from "./version";
import { z } from "zod";

export const userValueSchema = z.object({
  version: versionSchema,
  deleted: z.boolean(),
  value: jsonSchema,
});

export type UserValue = z.infer<typeof userValueSchema>;

export const userValuePrefix = "user/";

export function userValueKey(key: string): string {
  return `${userValuePrefix}${key}`;
}
