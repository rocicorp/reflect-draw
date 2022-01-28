import { JSONValue } from "replicache";
import { ZodSchema } from "zod";
import { Executor, transact } from "./pg";
import { RoomID } from "../types/room-state";
import { LogContext } from "../util/logger";
import { nanoid } from "nanoid";

export async function createDatabase() {
  const lc = new LogContext("debug", "createDatabase").addContext(
    "req",
    nanoid()
  );

  await transact(lc, async (executor) => {
    // TODO: Proper versioning for schema.
    await executor("drop table if exists entry cascade");

    await executor(`create table entry (
      roomid text not null,
      key text not null,
      value json not null,
      lastmodified timestamp(6) not null,
      unique (roomid, key)
      )`);

    await executor(`create index on entry (roomid)`);
    await executor(
      `create index on entry (((value->>'deleted')::boolean)) where key like '/user/*'`
    );
    await executor(
      `create index on entry (((value->>'version')::integer)) where key like '/user/*'`
    );
  });
}

export async function getEntry<T extends JSONValue>(
  executor: Executor,
  roomid: string,
  key: string,
  schema: ZodSchema<T>
): Promise<T | undefined> {
  const { rows } = await executor(
    "select value from entry where roomid = $1 and key = $2",
    [roomid, key]
  );
  const value = rows[0]?.value;
  if (value === undefined) {
    return undefined;
  }
  return schema.parse(value);
}

export async function putEntry<T extends JSONValue>(
  executor: Executor,
  roomID: RoomID,
  key: string,
  value: T
): Promise<void> {
  await executor(
    `
    insert into entry (roomid, key, value, lastmodified)
    values ($1, $2, $3, now())
      on conflict (roomid, key) do update set value = $3, lastmodified = now()
    `,
    [roomID, key, JSON.stringify(value)]
  );
}

export async function delEntry(
  executor: Executor,
  roomID: RoomID,
  key: string
): Promise<void> {
  await executor(`delete from entry where roomid = $1 and key = $2`, [
    roomID,
    key,
  ]);
}
