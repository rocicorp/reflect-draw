import { consoleLogSink, OptionalLoggerImpl } from "@rocicorp/logger";
import { createClientDatadogLogSink } from "@rocicorp/reflect/client";
import { nanoid } from "nanoid";
import { workerURL } from "../util/host";

const logSink = process.env.NEXT_PUBLIC_DATADOG_CLIENT_TOKEN
  ? createClientDatadogLogSink({
      clientToken: process.env.NEXT_PUBLIC_DATADOG_CLIENT_TOKEN,
      service: "replidraw-do",
    })
  : consoleLogSink;
const logger = new OptionalLoggerImpl(logSink, "info");

function Page() {
  return "";
}

export async function getServerSideProps() {
  const newRoomID = nanoid(6);
  await createRoom(newRoomID);
  return {
    redirect: {
      destination: `/d/${newRoomID}`,
      permanent: false,
    },
  };
}

export default Page;

const createRoomURL = new URL("/createRoom", workerURL).toString();

const createRoomHeaders = new Headers();
createRoomHeaders.set("Content-Type", "application/json");
const reflectApiKey = process.env.REFLECT_API_KEY || "";
createRoomHeaders.set("x-reflect-auth-api-key", reflectApiKey);

async function createRoom(roomID: string) {
  logger.info?.(`Creating room '${roomID}' at ${createRoomURL}`);
  const createRoomResponse = await fetch(createRoomURL, {
    method: "POST",
    headers: createRoomHeaders,
    body: JSON.stringify({ roomID }),
  });
  if (createRoomResponse.status !== 200) {
    throw new Error(
      `Failed to create room ${roomID}: ${
        createRoomResponse.status
      }: ${await createRoomResponse.text()}`
    );
  }
}
