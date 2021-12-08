import { expect } from "chai";
import { setup, test } from "mocha";
import {
  ClientRecord,
  clientRecordKey,
  clientRecordSchema,
} from "./client-record";
import { createDatabase, getEntry, putEntry } from "./data";
import { transact, withExecutor } from "./pg";
import { Server } from "./server";
import { RoomMap } from "./room-state";
import { Socket } from "./client-state";

setup(async () => {
  await withExecutor(async () => {
    await createDatabase();
  });
});

class Mocket implements Socket {
  log: string[][] = [];
  send(data: string): void {
    this.log.push(["send", data]);
  }
  close(): void {
    this.log.push(["close"]);
  }
  onclose: undefined;
  onmessage: undefined;
}

test("handleConnection", async () => {
  type Case = {
    name: string;
    url: string;
    expectErrorResponse?: string;
    existingRecord?: ClientRecord;
    expectedRecord?: ClientRecord;
    existingRooms: RoomMap;
    expectedRooms: (socket: Socket) => RoomMap;
    socket?: Socket;
  };
  const c2 = { clockBehindByMs: 0, pending: [], socket: new Mocket() };
  const c3 = { clockBehindByMs: 0, pending: [], socket: new Mocket() };
  const cases: Case[] = [
    {
      name: "empty",
      url: "",
      expectErrorResponse:
        "Error: invalid querystring parameter roomID, url: , got: undefined",
      existingRooms: new Map(),
      expectedRooms: (_) => new Map(),
    },
    {
      name: "invalid roomid",
      url: "?clientID=c1&baseCookie=1&timestamp=t1",
      expectErrorResponse:
        "Error: invalid querystring parameter roomID, url: ?clientID=c1&baseCookie=1&timestamp=t1, got: undefined",
      existingRooms: new Map(),
      expectedRooms: (_) => new Map(),
    },
    {
      name: "invalid clientid",
      url: "?roomID=r1&baseCookie=1&timestamp=t1",
      expectErrorResponse:
        "Error: invalid querystring parameter clientID, url: ?roomID=r1&baseCookie=1&timestamp=t1, got: undefined",
      existingRooms: new Map(),
      expectedRooms: (_) => new Map(),
    },
    {
      name: "invalid timestamp",
      url: "?roomID=r1&clientID=c1&baseCookie=1",
      expectErrorResponse:
        "Error: invalid querystring parameter ts, url: ?roomID=r1&clientID=c1&baseCookie=1, got: undefined",
      existingRooms: new Map(),
      expectedRooms: (_) => new Map(),
    },
    {
      name: "invalid (non-numeric) timestamp",
      url: "?roomID=r1&clientID=c1&baseCookie=1&ts=xx",
      expectErrorResponse:
        "Error: invalid querystring parameter ts, url: ?roomID=r1&clientID=c1&baseCookie=1&ts=xx, got: xx",
      existingRooms: new Map(),
      expectedRooms: (_) => new Map(),
    },
    {
      name: "no existing rooms",
      url: "?clientID=c1&roomID=r1&baseCookie=1&ts=42",
      existingRooms: new Map(),
      expectedRooms: (socket) =>
        new Map([
          [
            "r1",
            {
              clients: new Map([
                ["c1", { clockBehindByMs: 0, pending: [], socket }],
              ]),
            },
          ],
        ]),
      expectedRecord: {
        baseCookie: 1,
        lastMutationID: 0,
      },
    },
    {
      name: "baseCookie: null",
      url: "?clientID=c1&roomID=r1&baseCookie=&ts=42",
      existingRooms: new Map(),
      expectedRooms: (socket) =>
        new Map([
          [
            "r1",
            {
              clients: new Map([
                ["c1", { clockBehindByMs: 0, pending: [], socket }],
              ]),
            },
          ],
        ]),
      expectedRecord: {
        baseCookie: null,
        lastMutationID: 0,
      },
    },
    {
      name: "existing clients",
      url: "?clientID=c1&roomID=r1&baseCookie=1&ts=42",
      existingRooms: new Map([
        [
          "r1",
          {
            clients: new Map([["c2", c2]]),
          },
        ],
      ]),
      expectedRooms: (socket) =>
        new Map([
          [
            "r1",
            {
              clients: new Map([
                ["c1", { clockBehindByMs: 0, pending: [], socket }],
                ["c2", c2],
              ]),
            },
          ],
        ]),
      expectedRecord: {
        baseCookie: 1,
        lastMutationID: 0,
      },
    },
    {
      name: "existing rooms",
      url: "?clientID=c1&roomID=r1&baseCookie=1&ts=42",
      existingRooms: new Map([
        [
          "r1",
          {
            clients: new Map([["c2", c2]]),
          },
        ],
        [
          "r2",
          {
            clients: new Map([["c3", c3]]),
          },
        ],
      ]),
      expectedRooms: (socket) =>
        new Map([
          [
            "r1",
            {
              clients: new Map([
                ["c1", { clockBehindByMs: 0, pending: [], socket }],
                ["c2", c2],
              ]),
            },
          ],
          [
            "r2",
            {
              clients: new Map([["c3", c3]]),
            },
          ],
        ]),
      expectedRecord: {
        baseCookie: 1,
        lastMutationID: 0,
      },
    },
    {
      name: "existing record",
      url: "?clientID=c1&roomID=r1&baseCookie=7&ts=42",
      existingRooms: new Map(),
      expectedRooms: (socket) =>
        new Map([
          [
            "r1",
            {
              clients: new Map([
                ["c1", { clockBehindByMs: 0, pending: [], socket }],
              ]),
            },
          ],
        ]),
      existingRecord: {
        baseCookie: 1,
        lastMutationID: 88,
      },
      expectedRecord: {
        baseCookie: 7,
        lastMutationID: 88,
      },
    },
  ];

  const now = () => 42;

  for (const c of cases) {
    await transact(async (executor) => {
      if (c.existingRecord) {
        await putEntry(executor, "r1", clientRecordKey("c1"), c.existingRecord);
      }
    });
    const server = new Server(c.existingRooms, now);
    const mocket = new Mocket();
    await server.handleConnection(mocket, c.url);
    if (c.expectErrorResponse) {
      expect(mocket.log, c.name).to.deep.equal([
        ["send", c.expectErrorResponse],
        ["close"],
      ]);
      expect(server.rooms, c.name).to.deep.equal(c.existingRooms);
      return;
    }
    expect(mocket.log, c.name).to.deep.equal([]);
    expect(mocket.onmessage, c.name).to.be.a("function");
    expect(mocket.onclose, c.name).to.be.a("function");

    const expectedRooms = c.expectedRooms(mocket);
    expect(server.rooms, c.name).deep.equal(expectedRooms);

    await transact(async (executor) => {
      const actualRecord = await getEntry(
        executor,
        "r1",
        clientRecordKey("c1"),
        clientRecordSchema
      );
      expect(actualRecord, c.name).to.deep.equal(c.expectedRecord);
    });
  }
});

test("handleClose", async () => {
  type Case = {
    name: string;
    existingRooms: RoomMap;
    expectedRooms: RoomMap;
  };
  const c1Socket = new Mocket();
  const c1 = { clockBehindByMs: 1, pending: [], socket: c1Socket };
  const c2 = { clockBehindByMs: 2, pending: [], socket: new Mocket() };
  const c3 = { clockBehindByMs: 3, pending: [], socket: new Mocket() };
  const cases: Case[] = [
    {
      name: "no rooms??",
      existingRooms: new Map(),
      expectedRooms: new Map(),
    },
    {
      name: "no clients",
      existingRooms: new Map([["r1", { clients: new Map() }]]),
      expectedRooms: new Map([]),
    },
    {
      name: "one client",
      existingRooms: new Map([["r1", { clients: new Map([["c1", c1]]) }]]),
      expectedRooms: new Map([]),
    },
    {
      name: "two clients",
      existingRooms: new Map([
        [
          "r1",
          {
            clients: new Map([
              ["c1", c1],
              ["c2", c2],
            ]),
          },
        ],
      ]),
      expectedRooms: new Map([
        [
          "r1",
          {
            clients: new Map([["c2", c2]]),
          },
        ],
      ]),
    },
    {
      name: "two rooms",
      existingRooms: new Map([
        [
          "r1",
          {
            clients: new Map([
              ["c1", c1],
              ["c2", c2],
            ]),
          },
        ],
        [
          "r2",
          {
            clients: new Map([["c3", c3]]),
          },
        ],
      ]),
      expectedRooms: new Map([
        [
          "r1",
          {
            clients: new Map([["c2", c2]]),
          },
        ],
        [
          "r2",
          {
            clients: new Map([["c3", c3]]),
          },
        ],
      ]),
    },
  ];

  for (const c of cases) {
    const server = new Server(c.existingRooms, () => 42);
    await server.handleClose("r1", "c1");
    expect(server.rooms, c.name).deep.equal(c.expectedRooms);
  }
});
