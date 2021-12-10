import { MemStorage } from "../storage/mem-storage";
import { ClientMutation } from "../types/client-mutation";
import { ClientPokeBody } from "../types/client-poke-body";
import { clientRecordKey, putClientRecord } from "../types/client-record";
import { ClientID } from "../types/client-state";
import { versionKey, versionSchema } from "../types/version";
import { clientMutation, clientRecord, userValue } from "../util/test-utils";
import { expect } from "chai";
import { test } from "mocha";
import { JSONType } from "protocol/json";
import { WriteTransaction } from "replicache";
import { z } from "zod";
import { processFrame } from "./process-frame";
import { userValueKey } from "../types/user-value";

test("processFrame", async () => {
  const records = new Map([
    ["c1", clientRecord(null, 1)],
    ["c2", clientRecord(1, 7)],
  ]);
  const startTime = 100;
  const endTime = 200;
  const startVersion = 1;
  const endVersion = 2;

  type Case = {
    name: string;
    mutations: ClientMutation[];
    clients: ClientID[];
    expectedPokes: ClientPokeBody[];
    expectedState: Record<string, JSONType>;
  };

  const mutators = new Map(
    Object.entries({
      put: async (
        tx: WriteTransaction,
        { key, value }: { key: string; value: JSONType }
      ) => {
        await tx.put(key, value);
      },
      del: async (tx: WriteTransaction, { key }: { key: string }) => {
        await tx.del(key);
      },
    })
  );

  const baseExpectedState = {
    [versionKey]: endVersion,
    [clientRecordKey("c1")]: records.get("c1")!,
    [clientRecordKey("c2")]: records.get("c2")!,
  };

  const cases: Case[] = [
    {
      name: "no mutations, no clients",
      mutations: [],
      clients: [],
      expectedPokes: [],
      expectedState: baseExpectedState,
    },
    {
      name: "no mutations, one client",
      mutations: [],
      clients: ["c1"],
      expectedPokes: [
        {
          clientID: "c1",
          poke: {
            baseCookie: startVersion,
            cookie: endVersion,
            lastMutationID: 1,
            patch: [],
            timestamp: startTime,
          },
        },
      ],
      expectedState: {
        ...baseExpectedState,
        [clientRecordKey("c1")]: {
          baseCookie: endVersion,
          lastMutationID: 1,
        },
      },
    },
    {
      name: "one mutation, one client",
      mutations: [clientMutation("c1", 2, "put", { key: "foo", value: "bar" })],
      clients: ["c1"],
      expectedPokes: [
        {
          clientID: "c1",
          poke: {
            baseCookie: startVersion,
            cookie: endVersion,
            lastMutationID: 2,
            patch: [
              {
                op: "put",
                key: "foo",
                value: "bar",
              },
            ],
            timestamp: startTime,
          },
        },
      ],
      expectedState: {
        ...baseExpectedState,
        [clientRecordKey("c1")]: {
          baseCookie: endVersion,
          lastMutationID: 2,
        },
        [userValueKey("foo")]: userValue("bar", endVersion),
      },
    },
    {
      name: "one mutation, two clients",
      mutations: [clientMutation("c1", 2, "put", { key: "foo", value: "bar" })],
      clients: ["c1", "c2"],
      expectedPokes: [
        {
          clientID: "c1",
          poke: {
            baseCookie: startVersion,
            cookie: endVersion,
            lastMutationID: 2,
            patch: [
              {
                op: "put",
                key: "foo",
                value: "bar",
              },
            ],
            timestamp: startTime,
          },
        },
        {
          clientID: "c2",
          poke: {
            baseCookie: startVersion,
            cookie: endVersion,
            lastMutationID: 7,
            patch: [
              {
                op: "put",
                key: "foo",
                value: "bar",
              },
            ],
            timestamp: startTime,
          },
        },
      ],
      expectedState: {
        ...baseExpectedState,
        [clientRecordKey("c1")]: {
          baseCookie: endVersion,
          lastMutationID: 2,
        },
        [clientRecordKey("c2")]: {
          baseCookie: endVersion,
          lastMutationID: 7,
        },
        [userValueKey("foo")]: userValue("bar", endVersion),
      },
    },
    {
      name: "two mutations, one client, one key",
      mutations: [
        clientMutation("c1", 2, "put", { key: "foo", value: "bar" }),
        clientMutation("c1", 3, "put", { key: "foo", value: "baz" }),
      ],
      clients: ["c1"],
      expectedPokes: [
        {
          clientID: "c1",
          poke: {
            baseCookie: startVersion,
            cookie: endVersion,
            lastMutationID: 3,
            patch: [
              {
                op: "put",
                key: "foo",
                value: "baz",
              },
            ],
            timestamp: startTime,
          },
        },
      ],
      expectedState: {
        ...baseExpectedState,
        [clientRecordKey("c1")]: {
          baseCookie: endVersion,
          lastMutationID: 3,
        },
        [userValueKey("foo")]: userValue("baz", endVersion),
      },
    },
    {
      name: "frame cutoff",
      mutations: [
        clientMutation("c1", 2, "put", { key: "foo", value: "bar" }, 50),
        clientMutation("c1", 3, "put", { key: "foo", value: "baz" }, 150),
        clientMutation("c1", 4, "put", { key: "foo", value: "bonk" }, 250),
      ],
      clients: ["c1"],
      expectedPokes: [
        {
          clientID: "c1",
          poke: {
            baseCookie: startVersion,
            cookie: endVersion,
            lastMutationID: 3,
            patch: [
              {
                op: "put",
                key: "foo",
                value: "baz",
              },
            ],
            timestamp: startTime,
          },
        },
      ],
      expectedState: {
        ...baseExpectedState,
        [clientRecordKey("c1")]: {
          baseCookie: endVersion,
          lastMutationID: 3,
        },
        [userValueKey("foo")]: userValue("baz", endVersion),
      },
    },
  ];

  for (const c of cases) {
    const storage = new MemStorage();

    await storage.put(versionKey, startVersion);
    for (const [key, value] of records) {
      await putClientRecord(key, value, storage);
    }

    const result = await processFrame(
      c.mutations[Symbol.iterator](),
      mutators,
      c.clients,
      storage,
      startTime,
      endTime
    );

    expect(result, c.name).deep.equal(c.expectedPokes);

    expect(await storage.get(versionKey, versionSchema)).equal(endVersion);

    expect(storage.size, c.name).equal(Object.keys(c.expectedState).length);
    for (const [key, value] of Object.entries(c.expectedState)) {
      expect(await storage.get(key, z.any()), c.name).deep.equal(value);
    }
  }
});
