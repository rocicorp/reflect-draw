import { expect } from "chai";
import { setup, test } from "mocha";
import { PatchOperation } from "replicache";
import { createDatabase } from "./data";
import { withExecutor } from "./pg";
import { getPatch } from "./get-patch";
import { NullableVersion } from "./version";
import { ReplicacheTransaction } from "./replicache-transaction";
import { EntryCache } from "./entry-cache";
import { DBStorage } from "./db-storage";

setup(async () => {
  await withExecutor(async () => {
    await createDatabase();
  });
});

test("getPatch", async () => {
  await withExecutor(async (executor) => {
    type Case = {
      name: string;
      // undefined value means delete
      muts?: { key: string; roomID: string; value?: number; version: number }[];
      roomID: string;
      fromCookie: NullableVersion;
      expected: PatchOperation[];
    };

    const cases: Case[] = [
      {
        name: "add a, diff from null",
        muts: [{ key: "a", roomID: "d1", value: 1, version: 2 }],
        fromCookie: null,
        roomID: "d1",
        expected: [
          {
            op: "put",
            key: "a",
            value: 1,
          },
        ],
      },
      {
        name: "add a, diff from 1",
        fromCookie: 1,
        roomID: "d1",
        expected: [
          {
            op: "put",
            key: "a",
            value: 1,
          },
        ],
      },
      {
        name: "add a, diff from 2",
        fromCookie: 2,
        roomID: "d1",
        expected: [],
      },
      {
        name: "add a + b, diff from null",
        muts: [{ key: "b", roomID: "d1", value: 2, version: 3 }],
        roomID: "d1",
        fromCookie: null,
        expected: [
          {
            op: "put",
            key: "a",
            value: 1,
          },
          {
            op: "put",
            key: "b",
            value: 2,
          },
        ],
      },
      {
        name: "add a + b, diff from 2",
        muts: [],
        roomID: "d1",
        fromCookie: 2,
        expected: [
          {
            op: "put",
            key: "b",
            value: 2,
          },
        ],
      },
      {
        name: "add a + b, diff from 3",
        muts: [],
        roomID: "d1",
        fromCookie: 3,
        expected: [],
      },
      {
        name: "add a + b, diff from 4",
        muts: [],
        roomID: "d1",
        fromCookie: 4,
        expected: [],
      },
      {
        name: "del a, diff from 3",
        muts: [{ key: "a", roomID: "d1", version: 4 }],
        roomID: "d1",
        fromCookie: 3,
        expected: [
          {
            op: "del",
            key: "a",
          },
        ],
      },
      {
        name: "del a, diff from 4",
        fromCookie: 4,
        roomID: "d1",
        expected: [],
      },
      // add something in another doc, no affect
      {
        name: "add a in other room, diff from 4",
        muts: [
          {
            key: "a",
            roomID: "d2",
            value: 42,
            version: 5,
          },
        ],
        roomID: "d1",
        fromCookie: 4,
        expected: [],
      },
    ];

    for (const c of cases) {
      for (const p of c.muts || []) {
        const cache = new EntryCache(new DBStorage(executor, p.roomID));
        const tx = new ReplicacheTransaction(cache, "c1", p.version);
        if (p.value !== undefined) {
          await tx.put(p.key, p.value);
        } else {
          await tx.del(p.key);
        }
        await cache.flush();
      }
      const patch = await getPatch(executor, c.roomID, c.fromCookie);
      expect(patch, c.name).to.deep.equal(c.expected);
    }
  });
});
