import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb/client";
import { ErpRow } from "@/lib/mongodb/models/ErpRow";

function toPlain<T>(v: any): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

// ─── Boarding Server Functions ───────────────────────────────────────────────

export const listBoardingBookingsFn = createServerFn({ method: "GET" })
  .handler(async (): Promise<any[]> => {
    await connectDB();
    const docs = await ErpRow.find({ moduleId: "boarding_bookings" }).sort({ createdAt: -1 }).lean();
    return toPlain(docs.map((d) => d.data));
  });

export const createBoardingBookingFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => z.record(z.any()).parse(raw))
  .handler(async ({ data }): Promise<any> => {
    await connectDB();
    const doc = await ErpRow.create({
      moduleId: "boarding_bookings",
      data,
    });
    return toPlain(doc.data);
  });

export const updateBoardingStatusFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => z.object({ id: z.string(), status: z.string() }).parse(raw))
  .handler(async ({ data }): Promise<boolean> => {
    await connectDB();
    await ErpRow.findOneAndUpdate(
      {
        moduleId: "boarding_bookings",
        $or: [
          { "data.id": data.id },
          { "data.booking": data.id },
          { "data.bookingId": data.id },
        ],
      },
      { $set: { "data.status": data.status } }
    );
    return true;
  });

export const deleteBoardingBookingFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => z.object({ id: z.string() }).parse(raw))
  .handler(async ({ data }): Promise<boolean> => {
    await connectDB();
    await ErpRow.findOneAndDelete({
      moduleId: "boarding_bookings",
      $or: [
        { "data.id": data.id },
        { "data.booking": data.id },
        { "data.bookingId": data.id },
      ],
    });
    return true;
  });

// ─── Swimming & Hydrotherapy Server Functions ───────────────────────────────

export const listSwimSessionsFn = createServerFn({ method: "GET" })
  .handler(async (): Promise<any[]> => {
    await connectDB();
    const docs = await ErpRow.find({ moduleId: "swimming_sessions" }).sort({ createdAt: -1 }).lean();
    return toPlain(docs.map((d) => d.data));
  });

export const createSwimSessionFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => z.record(z.any()).parse(raw))
  .handler(async ({ data }): Promise<any> => {
    await connectDB();
    const doc = await ErpRow.create({
      moduleId: "swimming_sessions",
      data,
    });
    return toPlain(doc.data);
  });

export const updateSwimStatusFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => z.object({ id: z.string(), status: z.string() }).parse(raw))
  .handler(async ({ data }): Promise<boolean> => {
    await connectDB();
    await ErpRow.findOneAndUpdate(
      {
        moduleId: "swimming_sessions",
        $or: [
          { "data.id": data.id },
          { "data.session": data.id },
          { "data.sessionId": data.id },
        ],
      },
      { $set: { "data.status": data.status } }
    );
    return true;
  });

export const deleteSwimSessionFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => z.object({ id: z.string() }).parse(raw))
  .handler(async ({ data }): Promise<boolean> => {
    await connectDB();
    await ErpRow.findOneAndDelete({
      moduleId: "swimming_sessions",
      $or: [
        { "data.id": data.id },
        { "data.session": data.id },
        { "data.sessionId": data.id },
      ],
    });
    return true;
  });
