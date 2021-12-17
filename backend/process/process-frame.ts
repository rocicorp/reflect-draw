import { EntryCache } from "../storage/entry-cache";
import { unwrapPatch } from "../storage/replicache-transaction";
import { Storage } from "../storage/storage";
import { ClientMutation } from "../types/client-mutation";
import { ClientPokeBody } from "../types/client-poke-body";
import { getClientRecord, putClientRecord } from "../types/client-record";
import { ClientID } from "../types/client-state";
import { getVersion } from "../types/version";
import { must } from "../util/must";
import { PeekIterator } from "../util/peek-iterator";
import { MutatorMap, processMutation } from "./process-mutation";

// Processes zero or more mutations as a single "frame", returning pokes.
// Pokes are returned if the version changes, even if there is no patch,
// because we need clients to be in sync with server version so that pokes
// can continue to apply.
export async function processFrame(
  mutations: PeekIterator<ClientMutation>,
  mutators: MutatorMap,
  clients: ClientID[],
  storage: Storage,
  startTime: number,
  endTime: number
): Promise<ClientPokeBody[]> {
  const cache = new EntryCache(storage);
  const prevVersion = must(await getVersion(cache));
  const nextVersion = (prevVersion ?? 0) + 1;

  for (; !mutations.peek().done; mutations.next()) {
    const { value: mutation } = mutations.peek();
    if (mutation!.timestamp >= endTime) {
      break;
    }
    await processMutation(mutation!, mutators, cache, nextVersion);
  }

  if (must(await getVersion(cache)) === prevVersion) {
    return [];
  }

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
