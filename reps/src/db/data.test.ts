import { expect } from "chai";
import { setup, test } from "mocha";
import { LogContext } from "../util/logger";
import { z } from "zod";
import { createDatabase, delEntry, getEntry, putEntry } from "./data";
import { withExecutor } from "./pg";

const lc = new LogContext("info");

setup(async () => {
  // TODO: This is a very expensive way to unit test :).
  // Is there an in-memory postgres or something?
  await createDatabase();
});

test("getEntry", async () => {
  type Case = {
    name: string;
    exists: boolean;
    validSchema: boolean;
  };
  const cases: Case[] = [
    {
      name: "does not exist",
      exists: false,
      validSchema: true,
    },
    {
      name: "exists, invalid schema",
      exists: true,
      validSchema: false,
    },
    {
      name: "exists, valid JSON, valid schema",
      exists: true,
      validSchema: true,
    },
  ];

  await withExecutor(lc, async (executor) => {
    for (const c of cases) {
      await executor(`delete from entry where roomid = 'r1' and key = 'foo'`);
      if (c.exists) {
        if (!c.validSchema) {
          await executor(
            `insert into entry (roomid, key, value, lastmodified) values ('r1', 'foo', '{}', now())`
          );
        } else {
          await executor(
            `insert into entry (roomid, key, value, lastmodified) values ('r1', 'foo', '42', now())`
          );
        }
      }

      const promise = getEntry(executor, "r1", "foo", z.number());
      let result: number | undefined;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let error: any | undefined;
      await promise.then(
        (r) => (result = r),
        (e) => (error = String(e))
      );
      if (!c.exists) {
        expect(result, c.name).undefined;
        expect(error, c.name).undefined;
      } else if (!c.validSchema) {
        expect(result, c.name).undefined;
        expect(error, c.name).contains("Expected number, received object");
      } else {
        expect(result, c.name).eq(42);
        expect(error, c.name).undefined;
      }
    }
  });
});

test("getEntry RoundTrip types", async () => {
  await withExecutor(lc, async (executor) => {
    await putEntry(executor, "r1", "boolean", true);
    await putEntry(executor, "r1", "number", 42);
    await putEntry(executor, "r1", "string", "foo");
    await putEntry(executor, "r1", "array", [1, 2, 3]);
    await putEntry(executor, "r1", "object", { a: 1, b: 2 });

    expect(await getEntry(executor, "r1", "boolean", z.boolean())).eq(true);
    expect(await getEntry(executor, "r1", "number", z.number())).eq(42);
    expect(await getEntry(executor, "r1", "string", z.string())).eq("foo");
    expect(
      await getEntry(executor, "r1", "array", z.array(z.number()))
    ).deep.equal([1, 2, 3]);
    expect(
      await getEntry(
        executor,
        "r1",
        "object",
        z.object({ a: z.number(), b: z.number() })
      )
    ).deep.equal({ a: 1, b: 2 });
  });
});

test("putEntry", async () => {
  type Case = {
    name: string;
    duplicate: boolean;
  };

  const cases: Case[] = [
    {
      name: "not duplicate",
      duplicate: false,
    },
    {
      name: "duplicate",
      duplicate: true,
    },
  ];

  await withExecutor(lc, async (executor) => {
    for (const c of cases) {
      await executor(`delete from entry where roomid = 'r1' and key = 'foo'`);

      let res: Promise<void>;
      if (c.duplicate) {
        await putEntry(executor, "r1", "foo", 41);
        res = putEntry(executor, "r1", "foo", 42);
      } else {
        res = putEntry(executor, "r1", "foo", 42);
      }

      await res.catch(() => ({}));

      const qr = await executor(
        `select roomid, key, value from entry where roomid = 'r1' and key = 'foo'`
      );
      const [row] = qr.rows;

      expect(row, c.name).not.undefined;
      const { roomid, key, value } = row;
      expect(roomid, c.name).eq("r1");
      expect(key, c.name).eq("foo");
      expect(value, c.name).eq(42);
    }
  });
});

test("delEntry", async () => {
  type Case = {
    name: string;
    exists: boolean;
  };
  const cases: Case[] = [
    {
      name: "does not exist",
      exists: false,
    },
    {
      name: "exists",
      exists: true,
    },
  ];
  for (const c of cases) {
    await withExecutor(lc, async (executor) => {
      await executor(`delete from entry where roomid = 'r1' and key = 'foo'`);
      if (c.exists) {
        await executor(
          `insert into entry (roomid, key, value, lastmodified) values ('r1', 'foo', '42', now())`
        );
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let error: any | undefined;
      await delEntry(executor, "r1", "foo").catch((e) => (error = String(e)));

      const qr = await executor(
        `select roomid, key, value from entry where roomid = 'r1' and key = 'foo'`
      );
      const [row] = qr.rows;

      expect(row, c.name).undefined;
      expect(error, c.name).undefined;
    });
  }
});
