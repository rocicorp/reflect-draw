import { expect } from "chai";
import { test } from "mocha";
import { PushBody } from "../protocol/push";
import { ClientID, Socket } from "../types/client-state";
import { RoomID, RoomMap } from "../types/room-state";
import { Mocket, mutation } from "../util/test-utils";
import { handleMessage } from "./message";
import { LogContext } from "../util/logger";

const lc = new LogContext("info");

test("handleMessage", async () => {
  type Case = {
    name: string;
    data: string;
    expectedError?: string;
    expectedPush?: PushBody;
  };

  const cases: Case[] = [
    {
      name: "empty",
      data: "",
      expectedError: "SyntaxError: Unexpected end of JSON input",
    },
    {
      name: "invalid push",
      data: "[]",
      expectedError: "Should have at least 2 items",
    },
    {
      name: "valid push",
      data: JSON.stringify([
        "push",
        {
          mutations: [mutation(1), mutation(2)],
          pushVersion: 1,
          schemaVersion: "",
        },
      ]),
      expectedPush: {
        mutations: [mutation(1), mutation(2)],
        pushVersion: 1,
        schemaVersion: "",
        timestamp: 42,
      },
    },
  ];

  for (const c of cases) {
    const rooms: RoomMap = new Map();
    const roomID = "r1";
    const clientID = "c1";
    const s1 = new Mocket();
    let called = false;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const handlePush = (
      pRooms: RoomMap,
      pRoomID: RoomID,
      pClientID: ClientID,
      pBody: PushBody,
      pWS: Socket
    ) => {
      expect(pRooms, c.name).equal(rooms);
      expect(pRoomID, c.name).equal(roomID);
      expect(pClientID, c.name).equal(clientID);
      expect(pBody, c.name).deep.equal(c.expectedPush);
      expect(pWS, c.name).equal(s1);
      called = true;
    };
    await handleMessage(
      lc,
      rooms,
      roomID,
      clientID,
      c.data,
      s1,
      () => undefined
    );
    if (c.expectedError) {
      expect(s1.log.length, c.name).equal(1);
      const [type, message] = s1.log[0];
      expect(type, c.name).equal("send");
      expect(message, c.name).contains(c.expectedError);
    } else {
      expect(called, c.name).true;
    }
  }
});
