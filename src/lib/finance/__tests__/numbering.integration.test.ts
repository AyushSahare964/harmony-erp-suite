/**
 * Document-numbering integration tests — these hit a REAL MongoDB.
 *
 * Skipped by default so `npm run test:unit` stays a fast, offline, pure suite.
 * Run them deliberately:
 *
 *   RUN_DB_TESTS=1 npx vitest run src/lib/finance/__tests__/numbering.integration.test.ts
 *
 * Everything is scoped to branchId "TESTBRANCH" and torn down afterwards, so
 * the live INV/QTN/... series are never touched.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { connectDB } from "@/lib/mongodb/client";
import { NumberSeriesModel } from "@/lib/mongodb/models/NumberSeries";
import { allocateDocNumber, peekDocNumber, syncDocSeries } from "@/lib/mongodb/serverFns/counters";

const RUN = !!process.env["RUN_DB_TESTS"];
const TEST_BRANCH = "TESTBRANCH";

describe.skipIf(!RUN)("allocateDocNumber (real MongoDB)", () => {
  beforeAll(async () => {
    await connectDB();
    await NumberSeriesModel.deleteMany({ branchId: TEST_BRANCH });
  });

  afterAll(async () => {
    await NumberSeriesModel.deleteMany({ branchId: TEST_BRANCH });
    const mongoose = await import("mongoose");
    await mongoose.default.disconnect();
  });

  it("starts a fresh series at 0001 and increments without gaps", async () => {
    const a = await allocateDocNumber("INV", "2026-09-16", TEST_BRANCH);
    const b = await allocateDocNumber("INV", "2026-09-16", TEST_BRANCH);
    const c = await allocateDocNumber("INV", "2026-09-16", TEST_BRANCH);

    expect(a.docNumber).toBe("INV/2026-27/0001");
    expect(b.docNumber).toBe("INV/2026-27/0002");
    expect(c.docNumber).toBe("INV/2026-27/0003");
    expect(a.fyCode).toBe("2026-27");
  });

  it("never issues the same number twice under concurrency", async () => {
    // 40 simultaneous posts, the two-terminal scenario from the plan.
    const results = await Promise.all(
      Array.from({ length: 40 }, () => allocateDocNumber("QTN", "2026-09-16", TEST_BRANCH)),
    );

    const numbers = results.map((r) => r.docNumber);
    expect(new Set(numbers).size).toBe(40);

    // And no gaps: the sequences are exactly 1..40.
    const seqs = results.map((r) => r.seq).sort((x, y) => x - y);
    expect(seqs).toEqual(Array.from({ length: 40 }, (_, i) => i + 1));
  });

  it("derives the FY from the document date, not from today", async () => {
    // 28/03/2027 still belongs to FY 2026-27 ...
    const march = await allocateDocNumber("CRN", "2027-03-28", TEST_BRANCH);
    expect(march.docNumber).toBe("CRN/2026-27/0001");

    // ... while 02/04/2027 opens FY 2027-28 with its own 0001.
    const april = await allocateDocNumber("CRN", "2027-04-02", TEST_BRANCH);
    expect(april.docNumber).toBe("CRN/2027-28/0001");
  });

  it("peek shows the next number without consuming it", async () => {
    const before = await peekDocNumber("PUR", "2026-09-16", TEST_BRANCH);
    expect(before).toBe("PUR/2026-27/0001");

    // Peeking twice must not advance anything.
    expect(await peekDocNumber("PUR", "2026-09-16", TEST_BRANCH)).toBe(before);

    const claimed = await allocateDocNumber("PUR", "2026-09-16", TEST_BRANCH);
    expect(claimed.docNumber).toBe(before);
    expect(await peekDocNumber("PUR", "2026-09-16", TEST_BRANCH)).toBe("PUR/2026-27/0002");
  });

  it("syncDocSeries fast-forwards past imported history and never rewinds", async () => {
    await syncDocSeries("DBN", "2026-27", 250, TEST_BRANCH);
    expect(await peekDocNumber("DBN", "2026-09-16", TEST_BRANCH)).toBe("DBN/2026-27/0251");

    // A lower value must be ignored — $max never moves the series backwards.
    await syncDocSeries("DBN", "2026-27", 10, TEST_BRANCH);
    expect(await peekDocNumber("DBN", "2026-09-16", TEST_BRANCH)).toBe("DBN/2026-27/0251");
  });

  it("keeps each branch's series independent", async () => {
    const other = `${TEST_BRANCH}2`;
    try {
      const mine = await allocateDocNumber("EXP", "2026-09-16", TEST_BRANCH);
      const theirs = await allocateDocNumber("EXP", "2026-09-16", other);
      expect(mine.seq).toBe(1);
      expect(theirs.seq).toBe(1);
    } finally {
      await NumberSeriesModel.deleteMany({ branchId: other });
    }
  });
});
