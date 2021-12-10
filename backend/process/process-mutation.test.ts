import {
  ClientRecord,
  getClientRecord,
  putClientRecord,
} from "../client-record";
import { MemStorage } from "../mem-storage";
import { clientRecord, mutation } from "../test-utils";
import { expect } from "chai";
import { test } from "mocha";
import { JSONType } from "protocol/json";
import { Mutation } from "protocol/push";
import { WriteTransaction } from "replicache";
import { MutatorMap, processMutation } from "./process-mutation";
import { getUserValue } from "../user-value";

test("processMutation", async () => {
  type Case = {
    name: string;
    clientID: string;
    existingRecord?: ClientRecord;
    mutation: Mutation;
    expectedError?: string;
    expectedRecord?: ClientRecord;
    expectAppWrite: boolean;
  };

  const cases: Case[] = [
    {
      name: "clientID not found",
      clientID: "c1",
      mutation: mutation(1),
      expectedError: "Error: Client c1 not found",
      expectAppWrite: false,
    },
    {
      name: "duplicate mutation",
      clientID: "c1",
      existingRecord: clientRecord(null, 1),
      mutation: mutation(1),
      expectedRecord: clientRecord(null, 1),
      expectAppWrite: false,
    },
    {
      name: "ooo mutation",
      clientID: "c1",
      existingRecord: clientRecord(null, 1),
      mutation: mutation(3),
      expectedRecord: clientRecord(null, 1),
      expectAppWrite: false,
    },
    {
      name: "unknown mutator",
      clientID: "c1",
      existingRecord: clientRecord(null, 1),
      mutation: mutation(2, "unknown"),
      expectedRecord: clientRecord(null, 2),
      expectAppWrite: false,
    },
    {
      name: "mutator throws",
      clientID: "c1",
      existingRecord: clientRecord(null, 1),
      mutation: mutation(2, "throws"),
      expectedRecord: clientRecord(null, 2),
      expectAppWrite: false,
    },
    {
      name: "success",
      clientID: "c1",
      existingRecord: clientRecord(null, 1),
      mutation: mutation(2, "foo"),
      expectedRecord: clientRecord(null, 2),
      expectAppWrite: true,
    },
  ];

  const mutators: MutatorMap = new Map([
    [
      "foo",
      async (tx: WriteTransaction, args: JSONType) => {
        await tx.put("foo", "bar");
      },
    ],
    [
      "throws",
      async (tx: WriteTransaction, args: JSONType) => {
        throw new Error("bonk");
      },
    ],
  ]);

  for (const c of cases) {
    const storage = new MemStorage();
    const version = 2;

    if (c.existingRecord) {
      await putClientRecord(c.clientID, c.existingRecord, storage);
    }

    let err: string | undefined;
    try {
      await processMutation(c.clientID, c.mutation, mutators, storage, version);
    } catch (e) {
      err = String(e);
    }

    expect(err, c.name).equal(c.expectedError);
    expect(await getClientRecord(c.clientID, storage), c.name).deep.equal(
      c.expectedRecord
    );
    expect(await getUserValue("foo", storage), c.name).deep.equal(
      c.expectAppWrite ? { version, deleted: false, value: "bar" } : undefined
    );
  }
});
