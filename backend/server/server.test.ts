import { ClientID, Socket } from "../types/client-state";
import { RoomID, RoomMap } from "../types/room-state";
import { Mocket, sleep } from "../../util/test-utils";
import { expect } from "chai";
import { test } from "mocha";
import { Server } from "./server";
import { MessageHandler, CloseHandler } from "./connect";
/*
test("serialization", async () => {
  const s1 = new Mocket();
  const url = "u1";
  const rooms: RoomMap = new Map();
  const roomID = "r1";
  const clientID = "c1";
  const data = "data";

  let log: string[] = [];

  const messageHandler = (
    pRooms: RoomMap,
    pRoomID: RoomID,
    pClientID: ClientID,
    pData: string,
    pWS: Socket
  ) => {
    log.push("> message");
    expect(pRooms).equal(rooms);
    expect(pRoomID).equal(roomID);
    expect(pClientID).equal(clientID);
    expect(pData).equal(data);
    expect(pWS).equal(s1);
    log.push("< message");
  };

  const closeHandler = (
    pRooms: RoomMap,
    pRoomID: RoomID,
    pClientID: ClientID
  ) => {
    log.push("> close");
    expect(pRooms).equal(rooms);
    expect(pRoomID).equal(roomID);
    expect(pClientID).equal(clientID);
    log.push("< close");
  };

  const connectHandler = async (
    pWS: Socket,
    pURL: string,
    pRooms: RoomMap,
    onMessage: MessageHandler,
    onClose: CloseHandler
  ): Promise<void> => {
    expect(pWS).equal(s1);
    expect(pURL).equal(url);
    expect(pRooms).deep.equal(rooms);
    log.push("> connect");
    onMessage(roomID, clientID, data, pWS);
    onClose(roomID, clientID);
    await sleep(10);
    onMessage(roomID, clientID, data, pWS);
    onClose(roomID, clientID);
    log.push("< connect");
  };

  const server = new Server(
    rooms,
    () => {},
    () => 42,
    () => {}
  );
  server.handleConnection(s1, url);
  server.handleConnection(s1, url);
  await sleep(50);
  expect(log).deep.equal([
    "> connect",
    "< connect",
    "> connect",
    "< connect",
    "> message",
    "< message",
    "> close",
    "< close",
    "> message",
    "< message",
    "> close",
    "< close",
    "> message",
    "< message",
    "> close",
    "< close",
    "> message",
    "< message",
    "> close",
    "< close",
  ]);
});
*/
