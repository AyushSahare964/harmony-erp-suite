/**
 * nextSeq — atomic auto-ID generator using MongoDB counters.
 * Guarantees uniqueness across concurrent requests via findOneAndUpdate + $inc.
 *
 * Self-healing: if the counter's stored seq is behind what's already in the
 * collection (e.g. seed data was inserted directly), syncSeq() will fast-forward
 * the counter to match the max existing number before generating the next one.
 *
 * Usage:
 *   const id = await nextSeq("inventory_item", "M", 4); // "M-0011"
 *   const id = await nextSeq("journal_entry",  "JV", 4); // "JV-0001"
 */

import { connectDB } from "@/lib/mongodb/client";
import { Counter } from "@/lib/mongodb/models/Counters";

/**
 * Parse the numeric part out of an ID like "M-0010" → 10, "JV-0003" → 3.
 * Returns 0 if the string doesn't match the expected format.
 */
function parseSeqNum(id: string, prefix: string): number {
  const dashIdx = id.indexOf("-");
  if (dashIdx === -1) return 0;
  const p = id.slice(0, dashIdx);
  if (p !== prefix) return 0;
  return parseInt(id.slice(dashIdx + 1), 10) || 0;
}

/**
 * Advance the counter so it is at least `minSeq`.
 * Uses $max so it never goes backward — safe to call concurrently.
 */
export async function syncSeq(counterId: string, minSeq: number): Promise<void> {
  await connectDB();
  await Counter.findOneAndUpdate(
    { _id: counterId },
    // $max only updates the field if the new value is greater than the current value
    { $max: { seq: minSeq } },
    { upsert: true, returnDocument: "after" }
  );
}

/**
 * Ensure counter reflects the actual max existing ID in the given collection field.
 * Pass a function that resolves the current max numeric value from the DB.
 */
export async function ensureCounterInSync(
  counterId: string,
  getMaxExisting: () => Promise<number>
): Promise<void> {
  await connectDB();
  const doc = await Counter.findOne({ _id: counterId }).lean();
  const storedSeq = doc?.seq ?? 0;
  const maxExisting = await getMaxExisting();
  if (maxExisting > storedSeq) {
    await syncSeq(counterId, maxExisting);
  }
}

/**
 * Generate the next ID atomically.
 *
 * @param counterId  - unique key for this sequence e.g. "inventory_item"
 * @param prefix     - string prefix for the ID e.g. "M" or "JV"
 * @param pad        - zero-pad length (default 4 → "0001")
 * @param maxFn      - optional: async fn returning current max numeric seq from the real collection.
 *                     When provided, the counter is synced before incrementing to prevent clashes.
 */
export async function nextSeq(
  counterId: string,
  prefix: string,
  pad = 4,
  maxFn?: () => Promise<number>
): Promise<string> {
  await connectDB();

  // If caller supplies a maxFn, fast-forward counter to match reality first
  if (maxFn) {
    const maxExisting = await maxFn();
    if (maxExisting > 0) {
      // $max ensures we never go backwards — safe under concurrency
      await Counter.findOneAndUpdate(
        { _id: counterId },
        { $max: { seq: maxExisting } },
        { upsert: true, returnDocument: "after" }
      );
    }
  }

  const result = await Counter.findOneAndUpdate(
    { _id: counterId },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after" }
  );

  if (!result) throw new Error(`[Counter] Failed to generate ID for: ${counterId}`);

  const paddedSeq = String(result.seq).padStart(pad, "0");
  return `${prefix}-${paddedSeq}`;
}

/**
 * Peek at the next seq value without incrementing (for preview in forms).
 * Accepts an optional maxFn so the preview reflects actual data.
 */
export async function peekNextSeq(
  counterId: string,
  prefix: string,
  pad = 4,
  maxFn?: () => Promise<number>
): Promise<string> {
  await connectDB();

  let currentSeq = (await Counter.findOne({ _id: counterId }).lean())?.seq ?? 0;

  if (maxFn) {
    const maxExisting = await maxFn();
    if (maxExisting > currentSeq) currentSeq = maxExisting;
  }

  const nextVal = currentSeq + 1;
  return `${prefix}-${String(nextVal).padStart(pad, "0")}`;
}

export { parseSeqNum };
