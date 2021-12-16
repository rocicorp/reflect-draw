import { DBStorage } from "../storage/db-storage";
import { ClientPokeBody } from "../types/client-poke-body";
import {
  ClientRecord,
  getClientRecord,
  putClientRecord,
} from "../types/client-record";
import { ClientID } from "../types/client-state";
import { RoomID } from "../types/room-state";
import { putUserValue, UserValue } from "../types/user-value";
import { Version } from "../types/version";
import { must } from "../util/must";
import { expect } from "chai";
import { setup, test } from "mocha";
import { createDatabase } from "../db/data";
import { transact, withExecutor } from "../db/pg";
import { fastForwardRoom } from "./fast-forward";

test("fastForward", async () => {
  type Case = {
    name: string;
    state: Map<string, UserValue>;
    clientRecords: Map<string, ClientRecord>;
    roomID: RoomID;
    clients: ClientID[];
    headVersion: Version;
    timestamp: number;
    expectedError?: string;
    expectedPokes?: ClientPokeBody[];
  };

  const cases: Case[] = [
    {
      name: "no clients",
      state: new Map([["foo", { value: "bar", version: 1, deleted: false }]]),
      clientRecords: new Map([["c1", { lastMutationID: 1, baseCookie: 0 }]]),
      roomID: "r1",
      clients: [],
      headVersion: 1,
      timestamp: 1,
      expectedPokes: [],
    },
    {
      name: "no data",
      state: new Map(),
      clientRecords: new Map([["c1", { lastMutationID: 1, baseCookie: 0 }]]),
      roomID: "r1",
      clients: ["c1"],
      headVersion: 1,
      timestamp: 1,
      expectedPokes: [
        {
          clientID: "c1",
          poke: {
            baseCookie: 0,
            cookie: 42,
            lastMutationID: 1,
            patch: [],
            timestamp: 1,
          },
        },
      ],
    },
    {
      name: "up to date",
      state: new Map(),
      clientRecords: new Map([["c1", { lastMutationID: 1, baseCookie: 42 }]]),
      roomID: "r1",
      clients: ["c1"],
      headVersion: 1,
      timestamp: 1,
      expectedPokes: [],
    },
    {
      name: "one client two changes",
      state: new Map([
        ["foo", { value: "bar", version: 42, deleted: false }],
        ["hot", { value: "dog", version: 42, deleted: true }],
      ]),
      clientRecords: new Map([["c1", { lastMutationID: 3, baseCookie: 41 }]]),
      roomID: "r1",
      clients: ["c1"],
      headVersion: 1,
      timestamp: 1,
      expectedPokes: [
        {
          clientID: "c1",
          poke: {
            baseCookie: 41,
            cookie: 42,
            lastMutationID: 3,
            patch: [
              {
                op: "put",
                key: "foo",
                value: "bar",
              },
              {
                op: "del",
                key: "hot",
              },
            ],
            timestamp: 1,
          },
        },
      ],
    },
    {
      name: "two clients different changes",
      state: new Map([
        ["foo", { value: "bar", version: 41, deleted: false }],
        ["hot", { value: "dog", version: 42, deleted: true }],
      ]),
      clientRecords: new Map([
        ["c1", { lastMutationID: 3, baseCookie: 40 }],
        ["c2", { lastMutationID: 1, baseCookie: 41 }],
      ]),
      roomID: "r1",
      clients: ["c1", "c2"],
      headVersion: 1,
      timestamp: 1,
      expectedPokes: [
        {
          clientID: "c1",
          poke: {
            baseCookie: 40,
            cookie: 42,
            lastMutationID: 3,
            patch: [
              {
                op: "put",
                key: "foo",
                value: "bar",
              },
              {
                op: "del",
                key: "hot",
              },
            ],
            timestamp: 1,
          },
        },
        {
          clientID: "c2",
          poke: {
            baseCookie: 41,
            cookie: 42,
            lastMutationID: 1,
            patch: [
              {
                op: "del",
                key: "hot",
              },
            ],
            timestamp: 1,
          },
        },
      ],
    },
    {
      name: "two clients with changes but only one active",
      state: new Map([
        ["foo", { value: "bar", version: 41, deleted: false }],
        ["hot", { value: "dog", version: 42, deleted: true }],
      ]),
      clientRecords: new Map([
        ["c1", { lastMutationID: 3, baseCookie: 40 }],
        ["c2", { lastMutationID: 1, baseCookie: 41 }],
      ]),
      roomID: "r1",
      clients: ["c1"],
      headVersion: 1,
      timestamp: 1,
      expectedPokes: [
        {
          clientID: "c1",
          poke: {
            baseCookie: 40,
            cookie: 42,
            lastMutationID: 3,
            patch: [
              {
                op: "put",
                key: "foo",
                value: "bar",
              },
              {
                op: "del",
                key: "hot",
              },
            ],
            timestamp: 1,
          },
        },
      ],
    },
  ];

  for (const c of cases) {
    await createDatabase();
    await transact(async (executor) => {
      const storage = new DBStorage(executor, c.roomID);
      for (const [clientID, clientRecord] of c.clientRecords) {
        await putClientRecord(clientID, clientRecord, storage);
      }
      for (const [key, value] of c.state) {
        await putUserValue(key, value, storage);
      }

      const gcr = async (clientID: ClientID) => {
        return must(await getClientRecord(clientID, storage));
      };

      const pokes = await fastForwardRoom(
        c.roomID,
        c.clients,
        gcr,
        42,
        executor,
        c.timestamp
      );

      expect(pokes, c.name).deep.equal(c.expectedPokes);
    });
  }
});
