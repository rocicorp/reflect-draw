import { Mutation } from "../../protocol/push";
import { ReplicacheTransaction } from "../storage/replicache-transaction";
import { Version } from "../types/version";
import { Storage } from "../storage/storage";
import { EntryCache } from "../storage/entry-cache";
import { getClientRecord, putClientRecord } from "../types/client-record";
import { ClientID } from "../types/client-state";

export type Mutator = (tx: ReplicacheTransaction, args: any) => Promise<void>;
export type MutatorMap = Map<string, Mutator>;

// Runs a single mutation and updates storage accordingly.
export async function processMutation(
  clientID: ClientID,
  mutation: Mutation,
  mutators: MutatorMap,
  storage: Storage,
  version: Version
): Promise<void> {
  const cache = new EntryCache(storage);
  const record = await getClientRecord(clientID, storage);
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
  await putClientRecord(clientID, record, storage);
  await cache.flush();
}
