import { transact, withExecutor } from "./pg";
import { expect } from "chai";
import { setup, test } from "mocha";
import { EntryCache } from "./entry-cache";
import { DBStorage } from "./db-storage";
import { createDatabase, getEntry } from "./data";
import { z } from "zod";

setup(async () => {
  await withExecutor(async () => {
    await createDatabase();
  });
});

test("EntryCache", async () => {
  await transact(async (executor) => {
    const storage = new DBStorage(executor, "r1");
    const entryCache = new EntryCache(storage);

    expect(await entryCache.get("foo", z.string())).undefined;

    await entryCache.put("foo", "bar");
    expect(await entryCache.get("foo", z.string())).eq("bar");

    // They don't overlap until one flushes and the other is reloaded.
    const entryCache2 = new EntryCache(storage);
    expect(await entryCache2.get("foo", z.string())).undefined;

    // They also don't show up in underlying storage.
    expect(await getEntry(executor, "r1", "foo", z.string())).undefined;

    // TODO: scan, isEmpty

    // Go ahead and flush one now. The change shows up in new caches and in storage.
    await entryCache.flush();
    const entryCache3 = new EntryCache(storage);
    expect(await entryCache3.get("foo", z.string())).eq("bar");
    expect(await getEntry(executor, "r1", "foo", z.string())).eq("bar");

    // stacking!
    const entryCache4 = new EntryCache(entryCache3);
    await entryCache4.put("hot", "dog");
    expect(await entryCache4.get("hot", z.string())).eq("dog");

    // If we don't flush, it doesn't show up in underlying storage
    expect(await entryCache3.get("hot", z.string())).undefined;

    // ... but as soon as we flush, it does.
    await entryCache4.flush();
    expect(await entryCache3.get("hot", z.string())).eq("dog");
    expect(await getEntry(executor, "r1", "foo", z.string())).eq("bar");
  });
});

test("pending", async () => {
  await transact(async (executor) => {
    const storage = new DBStorage(executor, "r1");
    const entryCache = new EntryCache(storage);
    expect(entryCache.pending()).deep.equal([]);

    entryCache.put("foo", "bar");
    expect(entryCache.pending()).deep.equal([
      {
        op: "put",
        key: "foo",
        value: "bar",
      },
    ]);

    // change the value at a key, should still have one entry in patch
    entryCache.put("foo", "baz");
    expect(entryCache.pending()).deep.equal([
      {
        op: "put",
        key: "foo",
        value: "baz",
      },
    ]);

    // don't change anything, just reset
    entryCache.put("foo", "baz");
    expect(entryCache.pending()).deep.equal([
      {
        op: "put",
        key: "foo",
        value: "baz",
      },
    ]);

    // change only version
    entryCache.put("foo", "qux");
    expect(entryCache.pending()).deep.equal([
      {
        op: "put",
        key: "foo",
        value: "qux",
      },
    ]);

    // change only version
    entryCache.del("foo");
    expect(entryCache.pending()).deep.equal([
      {
        op: "del",
        key: "foo",
      },
    ]);

    // change only version
    entryCache.put("hot", "dog");
    expect(entryCache.pending()).deep.equal([
      {
        op: "del",
        key: "foo",
      },
      {
        op: "put",
        key: "hot",
        value: "dog",
      },
    ]);
  });
});
