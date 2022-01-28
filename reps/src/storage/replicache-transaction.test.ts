import { ReplicacheTransaction } from "./replicache-transaction";
import { expect } from "chai";
import { test } from "mocha";
import { EntryCache } from "./entry-cache";
import { UserValue, userValueKey, userValueSchema } from "../types/user-value";
import { MemStorage } from "./mem-storage";

test("ReplicacheTransaction", async () => {
  const storage = new MemStorage();
  const entryCache = new EntryCache(storage);
  const writeTx = new ReplicacheTransaction(entryCache, "c1", 1);

  expect(await writeTx.has("foo")).false;
  expect(await writeTx.get("foo")).undefined;

  await writeTx.put("foo", "bar");
  expect(await writeTx.has("foo")).true;
  expect(await writeTx.get("foo")).to.equal("bar");

  // They don't overlap until one flushes and the other is reloaded.
  const writeTx2 = new ReplicacheTransaction(new EntryCache(storage), "c1", 2);
  expect(await writeTx2.has("foo")).false;
  expect(await writeTx2.get("foo")).undefined;

  // TODO: scan, isEmpty

  // Go ahead and flush one
  await entryCache.flush();
  const writeTx3 = new ReplicacheTransaction(entryCache, "c1", 3);
  expect(await writeTx3.has("foo")).true;
  expect(await writeTx3.get("foo")).to.equal("bar");

  // Check the underlying storage gets written in the way we expect.
  const expected: UserValue = {
    deleted: false,
    value: "bar",
    version: 1,
  };
  expect(await storage.get(userValueKey("foo"), userValueSchema)).deep.equal(
    expected
  );

  // delete has special return value
  expect(await writeTx3.del("foo")).true;
  expect(await writeTx3.del("bar")).false;
});
