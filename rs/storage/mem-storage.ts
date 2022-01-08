import { deepClone } from "../../util/deep-clone";
import { JSONType } from "protocol/json";
import { JSONValue } from "replicache";
import { ZodType, ZodTypeDef } from "zod";
import { Storage } from "./storage";

export class MemStorage implements Storage {
  private _map: Map<string, JSONValue> = new Map();

  get size(): number {
    return this._map.size;
  }

  async put<T extends JSONValue>(key: string, value: T): Promise<void> {
    this._map.set(key, value);
  }

  async del(key: string): Promise<void> {
    this._map.delete(key);
  }

  async get<T extends JSONValue>(
    key: string,
    schema: ZodType<T, ZodTypeDef, T>
  ): Promise<T | undefined> {
    const val = this._map.get(key);
    if (val === undefined) {
      return val;
    }
    // have to deep clone to replicate semantics of persistent storage.
    return deepClone(schema.parse(val) as JSONType) as T;
  }
}
