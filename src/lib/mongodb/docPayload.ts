/**
 * Mongoose's `create()` / `insertMany()` overloads cannot resolve a payload
 * that is composed dynamically (spread from a zod-validated input plus computed
 * totals) while `exactOptionalPropertyTypes` is on: an optional property typed
 * `string | undefined` is not assignable to one typed `string?`, so overload
 * resolution collapses to `never`.
 *
 * Loosening the tsconfig or the schema to work around that would cost real
 * type safety everywhere. Instead the cast lives here, in one named place, so
 * it is greppable and obvious. The payload is still validated twice — by zod on
 * the way in and by the mongoose schema on the way out.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Cast a dynamically-composed document payload for `Model.create()`. */
export function docPayload(obj: Record<string, unknown>): any {
  return obj;
}

/** Same, for an array passed to `Model.create([...])` or `insertMany`. */
export function docPayloads(objs: Record<string, unknown>[]): any {
  return objs;
}
