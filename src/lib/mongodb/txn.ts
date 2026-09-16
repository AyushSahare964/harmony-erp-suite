/**
 * Transaction helper.
 *
 * Atlas replica sets support multi-document transactions; a standalone mongod
 * does not. Rather than make the posting code care, this wraps the work and
 * degrades gracefully: with transactions we get real atomicity, without them
 * the caller's compensation callback undoes whatever landed.
 *
 * The write order in every posting function is chosen so that a failure part
 * way through leaves the least damage: document first (identifiable and
 * removable), ledgers last (the thing that must never be half-written).
 */

import mongoose, { type ClientSession } from "mongoose";

export interface TxnContext {
  /** Undefined when the cluster has no transaction support. */
  session: ClientSession | undefined;
  /** True when the work really is atomic. */
  atomic: boolean;
}

/** Only session-related failures should trigger the non-transactional retry. */
function isUnsupportedTransactionError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("Transaction numbers are only allowed") ||
    msg.includes("Transactions are not supported") ||
    msg.includes("does not support transactions") ||
    msg.includes("replica set") ||
    msg.includes("IllegalOperation")
  );
}

/**
 * Run `work` inside a transaction when the cluster allows it.
 *
 * @param work     receives a TxnContext; pass `ctx.session` to every write
 * @param compense called only on the non-transactional path, to undo partial work
 */
export async function withTransaction<T>(
  work: (ctx: TxnContext) => Promise<T>,
  compense?: (err: unknown) => Promise<void>,
): Promise<T> {
  let session: ClientSession | undefined;

  try {
    session = await mongoose.startSession();
  } catch {
    session = undefined;
  }

  if (session) {
    try {
      let result!: T;
      await session.withTransaction(async () => {
        result = await work({ session, atomic: true });
      });
      return result;
    } catch (err) {
      if (!isUnsupportedTransactionError(err)) throw err;
      // Fall through to the non-transactional path below.
    } finally {
      await session.endSession().catch(() => {});
    }
  }

  try {
    return await work({ session: undefined, atomic: false });
  } catch (err) {
    if (compense) {
      // A failed compensation must not mask the original error.
      await compense(err).catch(() => {});
    }
    throw err;
  }
}

/** Spread into a mongoose query's options: `{ ...sessionOpt(ctx.session) }`. */
export function sessionOpt(session: ClientSession | undefined): { session?: ClientSession } {
  return session ? { session } : {};
}
