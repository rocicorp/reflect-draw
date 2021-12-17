import { expect } from "chai";
import { test } from "mocha";
import { JSONType } from "protocol/json";
import { WriteTransaction } from "replicache";
import { MemStorage } from "../storage/mem-storage";
import { ClientMutation } from "../types/client-mutation";
import {
  ClientRecord,
  getClientRecord,
  putClientRecord,
} from "../types/client-record";
import { getUserValue } from "../types/user-value";
import { getVersion } from "../types/version";
import { clientMutation, clientRecord } from "../util/test-utils";
import { MutatorMap, processMutation } from "./process-mutation";

test("processMutation", async () => {
  type Case = {
    name: string;
    existingRecord?: ClientRecord;
    mutation: ClientMutation;
    expectedError?: string;
    expectedRecord?: ClientRecord;
    expectAppWrite: boolean;
    expectVersionWrite: boolean;
  };

  const cases: Case[] = [
    {
      name: "clientID not found",
      mutation: clientMutation("c1", 1),
      expectedError: "Error: Client c1 not found",
      expectAppWrite: false,
      expectVersionWrite: false,
    },
    {
      name: "duplicate mutation",
      existingRecord: clientRecord(null, 1),
      mutation: clientMutation("c1", 1),
      expectedRecord: clientRecord(null, 1),
      expectAppWrite: false,
      expectVersionWrite: false,
    },
    {
      name: "ooo mutation",
      existingRecord: clientRecord(null, 1),
      mutation: clientMutation("c1", 3),
      expectedRecord: clientRecord(null, 1),
      expectAppWrite: false,
      expectVersionWrite: false,
    },
    {
      name: "unknown mutator",
      existingRecord: clientRecord(null, 1),
      mutation: clientMutation("c1", 2, "unknown"),
      expectedRecord: clientRecord(null, 2),
      expectAppWrite: false,
      expectVersionWrite: true,
    },
    {
      name: "mutator throws",
      existingRecord: clientRecord(null, 1),
      mutation: clientMutation("c1", 2, "throws"),
      expectedRecord: clientRecord(null, 2),
      expectAppWrite: false,
      expectVersionWrite: true,
    },
    {
      name: "success",
      existingRecord: clientRecord(null, 1),
      mutation: clientMutation("c1", 2, "foo"),
      expectedRecord: clientRecord(null, 2),
      expectAppWrite: true,
      expectVersionWrite: true,
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
    const { clientID } = c.mutation;

    if (c.existingRecord) {
      await putClientRecord(clientID, c.existingRecord, storage);
    }

    let err: string | undefined;
    try {
      await processMutation(c.mutation, mutators, storage, version);
    } catch (e) {
      err = String(e);
    }

    expect(err, c.name).equal(c.expectedError);
    expect(await getClientRecord(clientID, storage), c.name).deep.equal(
      c.expectedRecord
    );
    expect(await getUserValue("foo", storage), c.name).deep.equal(
      c.expectAppWrite ? { version, deleted: false, value: "bar" } : undefined
    );

    const expectedVersion = c.expectVersionWrite ? version : undefined;
    expect(await getVersion(storage), c.name).equal(expectedVersion);
  }
});
