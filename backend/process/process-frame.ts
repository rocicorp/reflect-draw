import { EntryCache } from "../storage/entry-cache";
import { Storage } from "../storage/storage";
import { ClientPokeBody } from "../types/client-poke-body";
import { PeekIterator } from "../util/peek-iterator";
import { ClientMutation } from "../types/client-mutation";
import { getClientRecord, putClientRecord } from "../types/client-record";
import { ClientID } from "../types/client-state";
import { versionKey, versionSchema } from "../types/version";
import { MutatorMap, processMutation } from "./process-mutation";
import { unwrapPatch } from "../storage/replicache-transaction";

// Processes zero or more mutations as a single "frame", returning pokes.
export async function processFrame(
  mutations: Iterator<ClientMutation>,
  mutators: MutatorMap,
  clients: ClientID[],
  storage: Storage,
  startTime: number,
  endTime: number
): Promise<ClientPokeBody[]> {
  const cache = new EntryCache(storage);
  const prevVersion = (await cache.get(versionKey, versionSchema))!;
  const nextVersion = (prevVersion ?? 0) + 1;

  await cache.put(versionKey, nextVersion);

  for (const it = new PeekIterator(mutations); !it.peek().done; it.next()) {
    const { value: mutation } = it.peek();
    if (mutation!.timestamp >= endTime) {
      break;
    }
    await processMutation(mutation!, mutators, cache, nextVersion);
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
