import { expect } from "chai";
import { test } from "mocha";
import { RoomMap } from "../types/room-state";
import { Mutation } from "../../protocol/push";
import { client, Mocket, mutation, room, roomMap } from "../../util/test-utils";
import { handlePush } from "./push";
import { LogContext } from "../../util/logger";

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

    const push = {
      mutations: c.mutations,
      pushVersion: 0,
      schemaVersion: "",
      timestamp: 42,
    };
    const rooms = c.existingRooms;
    handlePush(
      new LogContext("info"),
      rooms,
      "r1",
      "c1",
      push,
      s1,
      () => 42,
      () => {}
    );
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
    expect(rooms, c.name).deep.equal(c.expectedRooms);
  }
});
