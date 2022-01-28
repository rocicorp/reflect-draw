import { JSONValue } from "replicache";
import { delEntry, getEntry, putEntry } from "../db/data";
import { Executor } from "../db/pg";
import type { Storage } from "./storage";
import { ZodSchema } from "zod";

/**
 * Implements the Storage interface in terms of the database.
 */
export class DBStorage implements Storage {
  private _executor: Executor;
  private _roomID: string;

  constructor(executor: Executor, roomID: string) {
    this._executor = executor;
    this._roomID = roomID;
  }

  async put<T extends JSONValue>(key: string, value: T): Promise<void> {
    return putEntry(this._executor, this._roomID, key, value);
  }
  async del(key: string): Promise<void> {
    return delEntry(this._executor, this._roomID, key);
  }
  async get<T extends JSONValue>(
    key: string,
    schema: ZodSchema<T>
  ): Promise<T | undefined> {
    return await getEntry(this._executor, this._roomID, key, schema);
  }
}
