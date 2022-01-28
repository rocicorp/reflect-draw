import { transact } from "../db/pg";
import { expect } from "chai";
import { setup, test } from "mocha";
import { DBStorage } from "./db-storage";
import { createDatabase, getEntry } from "../db/data";
import { z } from "zod";
import { resolver } from "../util/resolver";
import { LogContext } from "../util/logger";

const lc = new LogContext("info");

setup(async () => {
  await createDatabase();
});

test("DBStorage", async () => {
  const { promise, resolve } = resolver();

  const transactPromise = transact(lc, async (executor) => {
    const storage = new DBStorage(executor, "r1");

    expect(await getEntry(executor, "r1", "foo", z.string())).undefined;
    expect(await storage.get("foo", z.string())).undefined;

    await storage.put("foo", "bar");

    expect(await getEntry(executor, "r1", "foo", z.string())).eq("bar");
    expect(await storage.get("foo", z.string())).eq("bar");

    await promise;
  });

  // Until transaction commits, we don't see data in postgres.
  await transact(lc, async (executor) => {
    const storage = new DBStorage(executor, "r1");
    expect(await storage.get("foo", z.string())).undefined;
  });

  resolve();
  await transactPromise;

  // When transaction commits, they are durably in database.
  await transact(lc, async (executor) => {
    const storage = new DBStorage(executor, "r1");
    expect(await storage.get("foo", z.string())).eq("bar");
  });
});
