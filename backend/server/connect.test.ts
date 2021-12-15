import { expect } from "chai";
import { setup, test } from "mocha";
import {
  ClientRecord,
  clientRecordKey,
  clientRecordSchema,
} from "../types/client-record";
import { createDatabase, getEntry, putEntry } from "../db/data";
import { transact, withExecutor } from "../db/pg";
import { RoomMap } from "../types/room-state";
import { Socket } from "../types/client-state";
import {
  client,
  clientRecord,
  Mocket,
  room,
  roomMap,
} from "../util/test-utils";
import { handleConnection } from "./connect";

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

    const rooms = new Map(c.existingRooms);
    const onMessage = () => {};
    const onClose = () => {};
    const mocket = new Mocket();

    await handleConnection(mocket, c.url, rooms, onMessage, onClose, now);

    if (c.expectErrorResponse) {
      expect(mocket.log, c.name).to.deep.equal([
        ["send", c.expectErrorResponse],
        ["close"],
      ]);
      return;
    }
    expect(mocket.log, c.name).to.deep.equal([]);
    expect(mocket.onmessage, c.name).equal(onMessage);
    expect(mocket.onclose, c.name).equal(onClose);

    const expectedRooms = c.expectedRooms(mocket);
    expect(rooms, c.name).deep.equal(expectedRooms);

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
