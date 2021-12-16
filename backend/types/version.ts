import { Storage } from "../storage/storage";
import { must } from "../util/must";
import { z } from "zod";

export const versionSchema = z.number();
export const nullableVersionSchema = z.union([versionSchema, z.null()]);

export type Version = z.infer<typeof versionSchema>;
export type NullableVersion = z.infer<typeof nullableVersionSchema>;

export const versionKey = "version";

export async function getVersion(storage: Storage): Promise<Version> {
  return must(await storage.get(versionKey, versionSchema));
}
