import { EntryCache } from "../storage/entry-cache";
import { ReplicacheTransaction } from "../storage/replicache-transaction";
import { Storage } from "../storage/storage";
import { ClientMutation } from "../types/client-mutation";
import { getClientRecord, putClientRecord } from "../types/client-record";
import { putVersion, Version } from "../types/version";

export type Mutator = (tx: ReplicacheTransaction, args: any) => Promise<void>;
export type MutatorMap = Map<string, Mutator>;

// Runs a single mutation and updates storage accordingly.
// At exit:
// - storage will have been updated with effect of mutation
// - version key will have been updated if any change was made
// - client record of mutating client will have been updated
export async function processMutation(
  mutation: ClientMutation,
  mutators: MutatorMap,
  storage: Storage,
  version: Version
): Promise<void> {
  const { clientID } = mutation;
  const cache = new EntryCache(storage);
  const record = await getClientRecord(clientID, cache);
  if (!record) {
    throw new Error(`Client ${clientID} not found`);
  }

  const expectedMutationID = record.lastMutationID + 1;
  if (mutation.id < expectedMutationID) {
    console.info(`Skipping duplicate mutation ${mutation}`);
    return;
  }

  if (mutation.id > expectedMutationID) {
    console.warn(`Skipping out of order mutation: ${mutation}`);
    return;
  }

  const tx = new ReplicacheTransaction(cache, clientID, version);
  try {
    const mutator = mutators.get(mutation.name);
    if (!mutator) {
      console.warn(`Skipping mutation with unknown mutator: ${mutation}`);
    } else {
      await mutator(tx, mutation.args);
    }
  } catch (e) {
    console.warn(`Skipping mutation: ${mutation} because error: ${e}`);
  }

  record.lastMutationID = expectedMutationID;
  await putClientRecord(clientID, record, cache);
  await putVersion(version, cache);
  await cache.flush();
}
