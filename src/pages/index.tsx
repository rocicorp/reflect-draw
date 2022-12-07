import { nanoid } from "nanoid";
import { env } from "process";
import { consoleLogSink, OptionalLoggerImpl } from "@rocicorp/logger";
import { DataDogBrowserLogSink } from "../frontend/data-dog-browser-log-sink";
import { workerURL } from "../util/host";

const logSink = process.env.NEXT_PUBLIC_DATADOG_CLIENT_TOKEN
  ? new DataDogBrowserLogSink()
  : consoleLogSink;
const logger = new OptionalLoggerImpl(logSink);

function Page() {
  return "";
}

// We select a roomID probabilistically. If it is taken or there is some
// other error when we try to create it, try a total of this many times
// before giving up.
const maxCreateRoomTries = 2;

export async function getServerSideProps() {
  for (let i = 0; i < maxCreateRoomTries; i++) {
    const newRoomID = nanoid(6);
    const created = await maybeCreateRoom(newRoomID);
    if (created) {
      return {
        redirect: {
          destination: `/d/${newRoomID}`,
          permanent: false,
        },
      };
    }
  }

  return {
    redirect: {
      destination: `/d/failed`,
      permanent: false,
    },
  };
}

export default Page;

const createRoomURL = new URL("/createRoom", workerURL).toString();

const createRoomHeaders = new Headers();
createRoomHeaders.set("Content-Type", "application/json");
const reflectApiKey = env.REFLECT_API_KEY || "";
createRoomHeaders.set("x-reflect-auth-api-key", reflectApiKey);

async function maybeCreateRoom(roomID: string) {
  logger.info?.(`Creating room '${roomID}' at ${createRoomURL}`);
  const createRoomResponse = await fetch(createRoomURL, {
    method: "POST",
    headers: createRoomHeaders,
    body: JSON.stringify({ roomID }),
  });
  if (createRoomResponse.status === 200) {
    return true;
  }
  logger.error?.(
    `Failed to create room ${roomID}: ${
      createRoomResponse.status
    }: ${await createRoomResponse.text()}`
  );
  return false;
}
