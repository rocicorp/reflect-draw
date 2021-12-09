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
import { RoomID, RoomMap, RoomState } from "./room-state";
import { Socket } from "./client-state";
import { Mutation } from "../protocol/push";
import {
  client,
  clientRecord,
  Mocket,
  mutation,
  room,
  roomMap,
  sleep,
} from "./test-utils";

setup(async () => {
  await withExecutor(async () => {
    await createDatabase();
  });
});

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
  const c2 = client("c1");
  const c3 = client("c2");
  const cases: Case[] = [
    {
      name: "empty",
      url: "",
      expectErrorResponse:
        "Error: invalid querystring parameter roomID, url: , got: undefined",
      existingRooms: roomMap(),
      expectedRooms: (_) => roomMap(),
    },
    {
      name: "invalid roomid",
      url: "?clientID=c1&baseCookie=1&timestamp=t1",
      expectErrorResponse:
        "Error: invalid querystring parameter roomID, url: ?clientID=c1&baseCookie=1&timestamp=t1, got: undefined",
      existingRooms: roomMap(),
      expectedRooms: (_) => roomMap(),
    },
    {
      name: "invalid clientid",
      url: "?roomID=r1&baseCookie=1&timestamp=t1",
      expectErrorResponse:
        "Error: invalid querystring parameter clientID, url: ?roomID=r1&baseCookie=1&timestamp=t1, got: undefined",
      existingRooms: roomMap(),
      expectedRooms: (_) => roomMap(),
    },
    {
      name: "invalid timestamp",
      url: "?roomID=r1&clientID=c1&baseCookie=1",
      expectErrorResponse:
        "Error: invalid querystring parameter ts, url: ?roomID=r1&clientID=c1&baseCookie=1, got: undefined",
      existingRooms: roomMap(),
      expectedRooms: (_) => roomMap(),
    },
    {
      name: "invalid (non-numeric) timestamp",
      url: "?roomID=r1&clientID=c1&baseCookie=1&ts=xx",
      expectErrorResponse:
        "Error: invalid querystring parameter ts, url: ?roomID=r1&clientID=c1&baseCookie=1&ts=xx, got: xx",
      existingRooms: roomMap(),
      expectedRooms: (_) => roomMap(),
    },
    {
      name: "no existing rooms",
      url: "?clientID=c1&roomID=r1&baseCookie=1&ts=42",
      existingRooms: roomMap(),
      expectedRooms: (socket) => roomMap(room("r1", client("c1", socket))),
      expectedRecord: clientRecord(1, 0),
    },
    {
      name: "baseCookie: null",
      url: "?clientID=c1&roomID=r1&baseCookie=&ts=42",
      existingRooms: roomMap(),
      expectedRooms: (socket) => roomMap(room("r1", client("c1", socket))),
      expectedRecord: clientRecord(null, 0),
    },
    {
      name: "existing clients",
      url: "?clientID=c1&roomID=r1&baseCookie=1&ts=42",
      existingRooms: roomMap(room("r1", c2)),
      expectedRooms: (socket) => roomMap(room("r1", client("c1", socket), c2)),
      expectedRecord: clientRecord(1, 0),
    },
    {
      name: "existing rooms",
      url: "?clientID=c1&roomID=r1&baseCookie=1&ts=42",
      existingRooms: roomMap(room("r1", c2), room("r2", c3)),
      expectedRooms: (socket) =>
        roomMap(room("r1", client("c1", socket), c2), room("r2", c3)),
      expectedRecord: clientRecord(1, 0),
    },
    {
      name: "existing record",
      url: "?clientID=c1&roomID=r1&baseCookie=7&ts=42",
      existingRooms: roomMap(),
      expectedRooms: (socket) => roomMap(room("r1", client("c1", socket))),
      existingRecord: clientRecord(1, 88),
      expectedRecord: clientRecord(7, 88),
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
  const c1 = client("c1", new Mocket(), 1);
  const c2 = client("c2", new Mocket(), 2);
  const c3 = client("c3", new Mocket(), 3);
  const cases: Case[] = [
    {
      name: "no rooms??",
      existingRooms: roomMap(),
      expectedRooms: roomMap(),
    },
    {
      name: "no clients",
      existingRooms: roomMap(room("r1")),
      expectedRooms: roomMap(),
    },
    {
      name: "one client",
      existingRooms: roomMap(room("r1", c1)),
      expectedRooms: new Map([]),
    },
    {
      name: "two clients",
      existingRooms: roomMap(room("r1", c1, c2)),
      expectedRooms: roomMap(room("r1", c2)),
    },
    {
      name: "two rooms",
      existingRooms: roomMap(room("r1", c1, c2), room("r2", c3)),
      expectedRooms: roomMap(room("r1", c2), room("r2", c3)),
    },
  ];

  for (const c of cases) {
    const server = new Server(c.existingRooms, () => 42);
    await server.handleClose("r1", "c1");
    expect(server.rooms, c.name).deep.equal(c.expectedRooms);
  }
});

test("handlePush", async () => {
  const s1 = new Mocket();
  const s2 = new Mocket();
  const s3 = new Mocket();

  type Case = {
    name: string;
    existingRooms: RoomMap;
    mutations: Mutation[];
    expectedError: string;
    expectedRooms: RoomMap;
  };

  const cases: Case[] = [
    {
      name: "no rooms",
      existingRooms: roomMap(),
      mutations: [],
      expectedError: "no such room: r1",
      expectedRooms: roomMap(),
    },
    {
      name: "no clients",
      existingRooms: roomMap(room("r1")),
      mutations: [],
      expectedError: "no such client: c1",
      expectedRooms: roomMap(room("r1")),
    },
    {
      name: "wrong client",
      existingRooms: roomMap(room("r1", client("c2", s2))),
      mutations: [],
      expectedError: "no such client: c1",
      expectedRooms: roomMap(room("r1", client("c2", s2))),
    },
    {
      name: "no mutations",
      existingRooms: roomMap(
        room("r1", client("c1", s1, 1, mutation(1, "foo", {}, 1)))
      ),
      mutations: [],
      expectedError: "",
      expectedRooms: roomMap(
        room("r1", client("c1", s1, 1, mutation(1, "foo", {}, 1)))
      ),
    },
    {
      name: "empty pending, single mutation",
      existingRooms: roomMap(room("r1", client("c1", s1, 0))),
      mutations: [mutation(1)],
      expectedError: "",
      expectedRooms: roomMap(room("r1", client("c1", s1, 0, mutation(1)))),
    },
    {
      name: "empty pending, multiple mutations",
      existingRooms: roomMap(room("r1", client("c1", s1, 0))),
      mutations: [mutation(1), mutation(2)],
      expectedError: "",
      expectedRooms: roomMap(
        room("r1", client("c1", s1, 0, mutation(1), mutation(2)))
      ),
    },
    {
      name: "empty pending, multiple mutations ooo",
      existingRooms: roomMap(room("r1", client("c1", s1, 0))),
      mutations: [mutation(2), mutation(1)],
      expectedError: "",
      expectedRooms: roomMap(
        room("r1", client("c1", s1, 0, mutation(1), mutation(2)))
      ),
    },
    {
      name: "single pending, single mutation end",
      existingRooms: roomMap(room("r1", client("c1", s1, 0, mutation(1)))),
      mutations: [mutation(2)],
      expectedError: "",
      expectedRooms: roomMap(
        room("r1", client("c1", s1, 0, mutation(1), mutation(2)))
      ),
    },
    {
      name: "single pending, single mutation start",
      existingRooms: roomMap(room("r1", client("c1", s1, 0, mutation(2)))),
      mutations: [mutation(1)],
      expectedError: "",
      expectedRooms: roomMap(
        room("r1", client("c1", s1, 0, mutation(1), mutation(2)))
      ),
    },
    {
      name: "multi pending, single mutation middle",
      existingRooms: roomMap(
        room("r1", client("c1", s1, 0, mutation(1), mutation(3)))
      ),
      mutations: [mutation(2)],
      expectedError: "",
      expectedRooms: roomMap(
        room("r1", client("c1", s1, 0, mutation(1), mutation(2), mutation(3)))
      ),
    },
    {
      name: "single pending, gap after",
      existingRooms: roomMap(room("r1", client("c1", s1, 0, mutation(1)))),
      mutations: [mutation(3)],
      expectedError: "",
      expectedRooms: roomMap(
        room("r1", client("c1", s1, 0, mutation(1), mutation(3)))
      ),
    },
    {
      name: "single pending, gap before",
      existingRooms: roomMap(room("r1", client("c1", s1, 0, mutation(3)))),
      mutations: [mutation(1)],
      expectedError: "",
      expectedRooms: roomMap(
        room("r1", client("c1", s1, 0, mutation(1), mutation(3)))
      ),
    },
    {
      name: "single pending, duplicate",
      existingRooms: roomMap(room("r1", client("c1", s1, 0, mutation(1)))),
      mutations: [mutation(1)],
      expectedError: "",
      expectedRooms: roomMap(room("r1", client("c1", s1, 0, mutation(1)))),
    },
    {
      name: "multi pending, duplicate",
      existingRooms: roomMap(
        room("r1", client("c1", s1, 0, mutation(1), mutation(2)))
      ),
      mutations: [mutation(1)],
      expectedError: "",
      expectedRooms: roomMap(
        room("r1", client("c1", s1, 0, mutation(1), mutation(2)))
      ),
    },
    {
      name: "timestamp adjustment",
      existingRooms: roomMap(room("r1", client("c1", s1, 7))),
      mutations: [mutation(1, "foo", {}, 3)],
      expectedError: "",
      expectedRooms: roomMap(
        room("r1", client("c1", s1, 7, mutation(1, "foo", {}, 10)))
      ),
    },
    {
      name: "negative timestamp adjustment",
      existingRooms: roomMap(room("r1", client("c1", s1, -7))),
      mutations: [mutation(1, "foo", {}, 3)],
      expectedError: "",
      expectedRooms: roomMap(
        room("r1", client("c1", s1, -7, mutation(1, "foo", {}, -4)))
      ),
    },
  ];

  for (const c of cases) {
    s1.log.length = 0;
    s2.log.length = 0;
    s3.log.length = 0;

    const server = new Server(c.existingRooms, () => 42);
    const push = {
      mutations: c.mutations,
      pushVersion: 0,
      schemaVersion: "",
    };
    server.handlePush("r1", "c1", push, s1);
    if (c.expectedError) {
      expect(s1.log, c.name).deep.equal([
        ["send", JSON.stringify(["error", c.expectedError])],
      ]);
    } else {
      expect(s1.log, c.name).deep.equal([]);
    }
    /*
    console.log(
      JSON.stringify(server.rooms.get("r1")?.clients.get("c1")?.pending)
    );
    console.log(
      JSON.stringify(c.expectedRooms.get("r1")?.clients.get("c1")?.pending)
    );
    */
    expect(server.rooms, c.name).deep.equal(c.expectedRooms);
  }
});

test("handleMessage", async () => {
  type Case = {
    name: string;
    existingRooms: RoomMap;
    messages: string[];
    expectedError: string;
    expectedRooms: RoomMap;
  };

  const s1 = new Mocket();
  const cases: Case[] = [
    {
      name: "empty",
      existingRooms: roomMap(room("r1")),
      messages: [""],
      expectedError: "SyntaxError: Unexpected end of JSON input",
      expectedRooms: roomMap(room("r1")),
    },
    {
      name: "invalid push",
      existingRooms: roomMap(room("r1")),
      messages: [JSON.stringify([])],
      expectedError: "Should have at least 2 items",
      expectedRooms: roomMap(room("r1")),
    },
    {
      name: "valid push",
      existingRooms: roomMap(room("r1", client("c1", s1, 0))),
      messages: [
        JSON.stringify([
          "push",
          {
            mutations: [mutation(1), mutation(2)],
            pushVersion: 1,
            schemaVersion: "",
          },
        ]),
      ],
      expectedError: "",
      expectedRooms: roomMap(
        room("r1", client("c1", s1, 0, mutation(1), mutation(2)))
      ),
    },
    {
      name: "overlapped pushes",
      existingRooms: roomMap(room("r1", client("c1", s1, 0))),
      messages: [
        JSON.stringify([
          "push",
          {
            mutations: [mutation(1)],
            pushVersion: 1,
            schemaVersion: "",
          },
        ]),
        JSON.stringify([
          "push",
          {
            mutations: [mutation(2)],
            pushVersion: 1,
            schemaVersion: "",
          },
        ]),
      ],
      expectedError: "",
      expectedRooms: roomMap(
        room("r1", client("c1", s1, 0, mutation(1), mutation(2)))
      ),
    },
  ];

  for (const c of cases) {
    s1.log.length = 0;
    const server = new Server(c.existingRooms, () => 42);
    for (const message of c.messages) {
      server.handleMessage("r1", "c1", message, s1);
    }
    await sleep();
    if (c.expectedError) {
      expect(s1.log.length, c.name).equal(1);
      const [type, message] = s1.log[0];
      expect(type, c.name).equal("send");
      expect(message, c.name).contains(c.expectedError);
    } else {
      expect(s1.log, c.name).deep.equal([]);
    }
    expect(server.rooms, c.name).deep.equal(c.expectedRooms);
  }
});
