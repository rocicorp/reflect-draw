import { expect } from "chai";
import { test } from "mocha";
import { PokeBody } from "../protocol/poke";
import { WriteTransaction } from "replicache";
import { createDatabase } from "../db/data";
import { transact } from "../db/pg";
import { DBStorage } from "../storage/db-storage";
import {
  ClientRecord,
  getClientRecord,
  putClientRecord,
} from "../types/client-record";
import { ClientID } from "../types/client-state";
import { RoomID, RoomMap } from "../types/room-state";
import { getUserValue, UserValue } from "../types/user-value";
import { getVersion, putVersion, Version } from "../types/version";
import {
  client,
  clientRecord,
  Mocket,
  mutation,
  room,
  roomMap,
} from "../util/test-utils";
import { processPending } from "./process-pending";
import { FRAME_LENGTH_MS } from "./process-room";
import { LogContext } from "../util/logger";

test("processPending", async () => {
  type Case = {
    name: string;
    start: Map<
      RoomID,
      {
        version: Version;
        clientRecords: Map<ClientID, ClientRecord>;
      }
    >;
    rooms: RoomMap;
    expectedError?: string;
    expectedRooms: RoomMap;
    expected: Map<
      RoomID,
      {
        version: Version;
        pokes?: Map<Mocket, PokeBody[]>;
        userValues?: Map<String, UserValue>;
        clientRecords?: Map<ClientID, ClientRecord>;
      }
    >;
  };

  const s1 = new Mocket();
  const s2 = new Mocket();

  const cases: Case[] = [
    {
      name: "none pending",
      start: new Map([
        [
          "r1",
          {
            version: 1,
            clientRecords: new Map([["c1", clientRecord(1)]]),
          },
        ],
      ]),
      rooms: roomMap(),
      expectedRooms: roomMap(),
      expected: new Map([
        [
          "r1",
          {
            version: 1,
            pokes: new Map(),
            userValues: new Map(),
            clientRecords: new Map([["c1", clientRecord(1)]]),
          },
        ],
      ]),
    },
    {
      name: "one room, one client, one mutation",
      start: new Map([
        [
          "r1",
          {
            version: 1,
            clientRecords: new Map([["c1", clientRecord(1)]]),
          },
        ],
      ]),
      rooms: roomMap(
        room("r1", client("c1", s1, 0, mutation(2, "inc", null, 100)))
      ),
      expectedRooms: roomMap(),
      expected: new Map([
        [
          "r1",
          {
            version: 2,
            pokes: new Map([
              [
                s1,
                [
                  {
                    baseCookie: 1,
                    cookie: 2,
                    lastMutationID: 2,
                    patch: [
                      {
                        op: "put",
                        key: "count",
                        value: 1,
                      },
                    ],
                    timestamp: 100,
                  },
                ],
              ],
            ]),
            userValues: new Map([
              ["count", { value: 1, version: 2, deleted: false }],
            ]),
            clientRecords: new Map([["c1", clientRecord(2, 2)]]),
          },
        ],
      ]),
    },
    {
      name: "two rooms, two clients, two mutations",
      start: new Map([
        [
          "r1",
          {
            version: 1,
            clientRecords: new Map([["c1", clientRecord(1)]]),
          },
        ],
        [
          "r2",
          {
            version: 2,
            clientRecords: new Map([["c2", clientRecord(2)]]),
          },
        ],
      ]),
      rooms: roomMap(
        room("r1", client("c1", s1, 0, mutation(2, "inc", null, 100))),
        room("r2", client("c2", s2, 0, mutation(2, "inc", null, 120)))
      ),
      expectedRooms: roomMap(),
      expected: new Map([
        [
          "r1",
          {
            version: 2,
            pokes: new Map([
              [
                s1,
                [
                  {
                    baseCookie: 1,
                    cookie: 2,
                    lastMutationID: 2,
                    patch: [
                      {
                        op: "put",
                        key: "count",
                        value: 1,
                      },
                    ],
                    timestamp: 100,
                  },
                ],
              ],
            ]),
            userValues: new Map([
              ["count", { value: 1, version: 2, deleted: false }],
            ]),
            clientRecords: new Map([["c1", clientRecord(2, 2)]]),
          },
        ],
        [
          "r2",
          {
            version: 3,
            pokes: new Map([
              [
                s2,
                [
                  {
                    baseCookie: 2,
                    cookie: 3,
                    lastMutationID: 2,
                    patch: [
                      {
                        op: "put",
                        key: "count",
                        value: 1,
                      },
                    ],
                    timestamp: 100 + FRAME_LENGTH_MS,
                  },
                ],
              ],
            ]),
            userValues: new Map([
              ["count", { value: 1, version: 3, deleted: false }],
            ]),
            clientRecords: new Map([["c2", clientRecord(3, 2)]]),
          },
        ],
      ]),
    },
    {
      name: "two rooms, two clients, two mutations, one not ready",
      start: new Map([
        [
          "r1",
          {
            version: 1,
            clientRecords: new Map([["c1", clientRecord(1)]]),
          },
        ],
        [
          "r2",
          {
            version: 2,
            clientRecords: new Map([["c2", clientRecord(2)]]),
          },
        ],
      ]),
      rooms: roomMap(
        room("r1", client("c1", s1, 0, mutation(2, "inc", null, 100))),
        room("r2", client("c2", s2, 0, mutation(2, "inc", null, 300)))
      ),
      expectedRooms: roomMap(
        room("r2", client("c2", s2, 0, mutation(2, "inc", null, 300)))
      ),
      expected: new Map([
        [
          "r1",
          {
            version: 2,
            pokes: new Map([
              [
                s1,
                [
                  {
                    baseCookie: 1,
                    cookie: 2,
                    lastMutationID: 2,
                    patch: [
                      {
                        op: "put",
                        key: "count",
                        value: 1,
                      },
                    ],
                    timestamp: 100,
                  },
                ],
              ],
            ]),
            userValues: new Map([
              ["count", { value: 1, version: 2, deleted: false }],
            ]),
            clientRecords: new Map([["c1", clientRecord(2, 2)]]),
          },
        ],
      ]),
    },
  ];

  const mutators = new Map(
    Object.entries({
      inc: async (tx: WriteTransaction) => {
        let count = ((await tx.get("count")) as number) ?? 0;
        count++;
        await tx.put("count", count);
      },
    })
  );

  const startTime = 100;
  const endTime = 200;

  for (const c of cases) {
    await createDatabase();
    await transact(async (executor) => {
      for (const [roomID, { version, clientRecords }] of c.start) {
        const storage = new DBStorage(executor, roomID);
        await putVersion(version, storage);
        for (const [clientID, record] of clientRecords) {
          await putClientRecord(clientID, record, storage);
        }
      }
    });
    for (const [, roomState] of c.rooms) {
      for (const [, clientState] of roomState.clients) {
        (clientState.socket as Mocket).log.length = 0;
      }
    }
    const p = processPending(
      new LogContext("info"),
      c.rooms,
      mutators,
      startTime,
      endTime
    );
    if (c.expectedError) {
      try {
        await p;
        expect.fail("should have thrown");
      } catch (e) {
        expect(String(e), c.name).equal(c.expectedError);
      }
      continue;
    }

    await p;
    expect(c.rooms, c.name).deep.equal(c.expectedRooms);

    await transact(async (executor) => {
      expect(c.expectedError).undefined;
      for (const [roomID, exp] of c.expected) {
        const storage = new DBStorage(executor, roomID);
        expect(await getVersion(storage), c.name).equal(exp.version);
        for (const [mocket, clientPokes] of exp.pokes ?? []) {
          expect(mocket.log, c.name).deep.equal(
            clientPokes.map((poke) => ["send", JSON.stringify(["poke", poke])])
          );
        }
        for (const [expKey, expValue] of exp.userValues ?? new Map()) {
          expect(await getUserValue(expKey, storage), c.name).deep.equal(
            expValue
          );
        }
        for (const [expClientID, expRecord] of exp.clientRecords ?? new Map()) {
          expect(
            await getClientRecord(expClientID, storage),
            c.name
          ).deep.equal(expRecord);
        }
      }
    });
  }
});
