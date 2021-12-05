import { JSONValue, ScanResult, WriteTransaction } from "replicache";
import { Version } from "./version";
import { EntryCache } from "./entry-cache";
import { UserValue, userValueSchema } from "./user-value";
import { JSONType } from "protocol/json";
import { ClientID } from "./client-state";

/**
 * Implements Replicache's WriteTransaction in terms of EntryCache.
 */
export class ReplicacheTransaction implements WriteTransaction {
  private _clientID: ClientID;
  private _inner: EntryCache;
  private _version: Version;

  get clientID(): string {
    return this._clientID;
  }

  constructor(inner: EntryCache, clientID: string, version: Version) {
    this._inner = inner;
    this._clientID = clientID;
    this._version = version;
  }

  async put(key: string, value: JSONValue): Promise<void> {
    const userValue: UserValue = {
      deleted: false,
      version: this._version,
      value: value as JSONType,
    };
    await this._inner.put(key, userValue);
  }

  async del(key: string): Promise<boolean> {
    const prev = await this.get(key);
    if (prev === undefined) {
      return false;
    }

    // Implement del with soft delete so we can detect deletes for diff.
    const userValue: UserValue = {
      deleted: true,
      version: this._version,
      value: prev as JSONType,
    };
    await this._inner.put(key, userValue);
    return prev !== undefined;
  }

  async get(key: string): Promise<JSONValue | undefined> {
    const entry = await this._inner.get(key, userValueSchema);
    if (entry === undefined) {
      return undefined;
    }
    return entry.deleted ? undefined : entry.value;
  }

  async has(key: string): Promise<boolean> {
    const val = await this.get(key);
    return val !== undefined;
  }

  // TODO!
  async isEmpty(): Promise<boolean> {
    throw new Error("not implemented");
  }
  scan(): ScanResult<string> {
    throw new Error("not implemented");
  }
  scanAll(): Promise<[string, JSONValue][]> {
    throw new Error("not implemented");
  }
}
