import { JSONValue } from "replicache";
import { Executor, transact } from "./pg";

export async function createDatabase() {
  await transact(async (executor) => {
    // TODO: Proper versioning for schema.
    await executor("drop table if exists client cascade");
    await executor("drop table if exists object cascade");

    await executor(`create table client (
      id varchar(100) primary key not null,
      lastmutationid int not null)`);

    await executor(`create table object (
      k varchar(100) not null,
      v text not null,
      documentid varchar(100) not null,
      deleted bool not null default false,
      lastmodified timestamp(6) not null,
      unique (documentid, k)
      )`);

    await executor(`create index on object (documentid)`);
    await executor(`create index on object (deleted)`);
    await executor(`create index on object (lastmodified)`);
  });
}
