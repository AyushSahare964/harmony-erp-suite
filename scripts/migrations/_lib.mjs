/**
 * Shared helpers for the finance migration scripts.
 *
 * Connection resolution order: MONGODB_URI env → atlas-credentials.env →
 * the DEFAULT_URI the app itself falls back to, read out of client.ts rather
 * than copied, so the credential still lives in exactly one place.
 */

import mongoose from "mongoose";
import process from "node:process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const DRY_RUN = process.argv.includes("--dry-run");

export function redact(uri) {
  return uri.replace(/:\/\/([^:]+):[^@]+@/, "://$1:****@");
}

function candidates() {
  const out = [];
  if (process.env.MONGODB_URI) out.push(["MONGODB_URI env", process.env.MONGODB_URI]);

  const envPath = path.join(ROOT, "atlas-credentials.env");
  if (fs.existsSync(envPath)) {
    const line = fs
      .readFileSync(envPath, "utf8")
      .split(/\r?\n/)
      .find((l) => l.startsWith("MONGODB_URI="));
    const value = line?.slice("MONGODB_URI=".length).trim().replace(/^["']|["']$/g, "");
    if (value) out.push(["atlas-credentials.env", value]);
  }

  const clientPath = path.join(ROOT, "src", "lib", "mongodb", "client.ts");
  if (fs.existsSync(clientPath)) {
    const m = fs
      .readFileSync(clientPath, "utf8")
      .match(/DEFAULT_URI\s*=\s*["'`]([^"'`]+)["'`]/);
    if (m?.[1]) out.push(["client.ts DEFAULT_URI", m[1]]);
  }
  return out;
}

export async function connect(tag) {
  const list = candidates();
  if (!list.length) throw new Error("No MongoDB connection string found.");

  let lastError;
  for (const [source, uri] of list) {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
      console.log(`[${tag}] connected via ${source}`);
      return;
    } catch (err) {
      console.log(`[${tag}]   ${source} failed: ${err.message}`);
      lastError = err;
      await mongoose.disconnect().catch(() => {});
    }
  }
  throw lastError;
}

export const db = () => mongoose.connection;
export const coll = (name) => mongoose.connection.collection(name);

/** Strip +91 / leading 0 / punctuation so a mobile can be used as a match key. */
export function normaliseMobile(value) {
  let v = String(value ?? "").replace(/[\s\-()]/g, "");
  if (v.startsWith("+91")) v = v.slice(3);
  else if (v.startsWith("91") && v.length === 12) v = v.slice(2);
  if (v.startsWith("0") && v.length === 11) v = v.slice(1);
  return v;
}

export function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/** FY code for an ISO date, e.g. "2026-09-16" → "2026-27". */
export function fyCodeFor(iso) {
  const [y, m] = String(iso).split("-").map(Number);
  const start = m >= 4 ? y : y - 1;
  return `${start}-${String(start + 1).slice(2)}`;
}

/**
 * Sequential ID generator that keeps the shared Counter collection in step, so
 * IDs minted here never collide with ones the running app mints later.
 */
export async function makeSeq(counterId, prefix, pad = 4) {
  const counters = coll("counters");
  const current = await counters.findOne({ _id: counterId });
  let n = current?.seq ?? 0;

  return {
    next() {
      n += 1;
      return `${prefix}-${String(n).padStart(pad, "0")}`;
    },
    async commit() {
      if (DRY_RUN) return;
      await counters.updateOne({ _id: counterId }, { $max: { seq: n } }, { upsert: true });
    },
  };
}

export async function finish(tag, rows) {
  if (rows?.length) console.table(rows);
  console.log(
    DRY_RUN
      ? `[${tag}] dry run complete — nothing was written.`
      : `[${tag}] done.`,
  );
  await mongoose.disconnect();
}

export function fail(tag, err) {
  console.error(`[${tag}] FAILED:`, err.message);
  process.exitCode = 1;
  return mongoose.disconnect().catch(() => {});
}
