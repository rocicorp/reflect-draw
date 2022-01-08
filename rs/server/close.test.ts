import { expect } from "chai";
import { test } from "mocha";
import { RoomMap } from "../types/room-state";
import { client, Mocket, room, roomMap } from "../util/test-utils";
import { handleClose } from "./close";
import { LogContext } from "../util/logger";

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
    const rooms = c.existingRooms;
    handleClose(new LogContext("info"), rooms, "r1", "c1");
    expect(rooms, c.name).deep.equal(c.expectedRooms);
  }
});
