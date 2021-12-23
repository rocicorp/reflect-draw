import { EntryCache } from "../storage/entry-cache";
import { unwrapPatch } from "../storage/replicache-transaction";
import { Storage } from "../storage/storage";
import { ClientMutation } from "../types/client-mutation";
import { ClientPokeBody } from "../types/client-poke-body";
import { getClientRecord, putClientRecord } from "../types/client-record";
import { ClientID } from "../types/client-state";
import { getVersion } from "../types/version";
import { LogContext } from "../util/logger";
import { must } from "../util/must";
import { PeekIterator } from "../util/peek-iterator";
import { MutatorMap, processMutation } from "./process-mutation";
import { TDigest } from "tdigest";

const digest = new TDigest({ mode: "disc" });
let lastFrameTime = 0;

// Processes zero or more mutations as a single "frame", returning pokes.
// Pokes are returned if the version changes, even if there is no patch,
// because we need clients to be in sync with server version so that pokes
// can continue to apply.
export async function processFrame(
  lc: LogContext,
  mutations: PeekIterator<ClientMutation>,
  mutators: MutatorMap,
  clients: ClientID[],
  storage: Storage,
  startTime: number,
  endTime: number
): Promise<ClientPokeBody[]> {
  lc.debug?.(
    "processing frame - startTime",
    startTime,
    "endTime",
    endTime,
    "clients",
    clients
  );

  const cache = new EntryCache(storage);
  const prevVersion = must(await getVersion(cache));
  const nextVersion = (prevVersion ?? 0) + 1;

  lc.debug?.("prevVersion", prevVersion, "nextVersion", nextVersion);

  for (; !mutations.peek().done; mutations.next()) {
    const { value: mutation } = mutations.peek();
    if (mutation!.timestamp >= endTime) {
      lc.debug?.("reached end of frame", mutation);
      break;
    }
    await processMutation(lc, mutation!, mutators, cache, nextVersion);
  }

  if (must(await getVersion(cache)) === prevVersion) {
    lc.debug?.("no change in frame, skipping poke");
    return [];
  }

  if (lastFrameTime !== 0) {
    const diff = startTime - lastFrameTime;
    digest.push(diff);
    if (Math.random() < 0.1) {
      console.log("frame time", digest.summary());
    }
  }
  lastFrameTime = startTime;

  const patch = unwrapPatch(cache.pending());
  const ret: ClientPokeBody[] = [];
  for (const clientID of clients) {
    const clientRecord = (await getClientRecord(clientID, cache))!;
    clientRecord.baseCookie = nextVersion;
    await putClientRecord(clientID, clientRecord, cache);

    const poke: ClientPokeBody = {
      clientID,
      poke: {
        baseCookie: prevVersion,
        cookie: nextVersion,
        lastMutationID: clientRecord.lastMutationID,
        patch,
        timestamp: startTime,
      },
    };
    ret.push(poke);
  }

  await cache.flush();
  return ret;
}
