import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb/client";
import { SubscriptionPlanModel } from "@/lib/mongodb/models/SubscriptionPlan";
import { ClientSubscriptionModel } from "@/lib/mongodb/models/ClientSubscription";
import { nextSeq } from "@/lib/mongodb/serverFns/counters";
import { todayIST } from "@/lib/utils/dateUtils";

function toPlain<T>(v: unknown): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export interface SubscriptionPlanRow {
  planId: string;
  name: string;
  price: number;
  billingType: "recurring" | "session_pack";
  frequency: "monthly" | "quarterly" | "annual" | null;
  sessionCount: number | null;
  validityDays: number;
  category: string;
}

export interface ClientSubscriptionRow {
  subId: string;
  planId: string;
  planName: string;
  petId: string;
  petName: string;
  ownerId: string;
  ownerName: string;
  status: "Active" | "Expiring" | "Expired" | "Cancelled";
  startDate: string;
  endDate: string | null;
  sessionsRemaining: number | null;
  nextBillingDate: string | null;
  totalPaid: number;
}

const CreatePlanInputZ = z.object({
  name: z.string().min(1),
  price: z.number().positive(),
  billingType: z.enum(["recurring", "session_pack"]),
  frequency: z.enum(["monthly", "quarterly", "annual"]).nullable().optional(),
  sessionCount: z.number().int().positive().nullable().optional(),
  validityDays: z.number().int().positive(),
  category: z.string().default("Clinic"),
});

export const createSubscriptionPlanFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => CreatePlanInputZ.parse(raw))
  .handler(async ({ data }): Promise<SubscriptionPlanRow> => {
    await connectDB();
    const planId = await nextSeq("subscription_plan", "PLN", 4);
    const plan = {
      planId,
      name: data.name,
      price: data.price,
      billingType: data.billingType,
      frequency: data.billingType === "recurring" ? data.frequency ?? "monthly" : null,
      sessionCount: data.billingType === "session_pack" ? data.sessionCount ?? null : null,
      validityDays: data.validityDays,
      category: data.category,
    };
    await SubscriptionPlanModel.create(plan);
    return toPlain(plan);
  });

export const listSubscriptionPlansFn = createServerFn({ method: "GET" })
  .handler(async (): Promise<SubscriptionPlanRow[]> => {
    await connectDB();
    const docs = await SubscriptionPlanModel.find({ isActive: true }).sort({ createdAt: -1 }).lean();
    return toPlain(docs.map((d) => ({
      planId: d.planId,
      name: d.name,
      price: d.price,
      billingType: d.billingType,
      frequency: d.frequency,
      sessionCount: d.sessionCount,
      validityDays: d.validityDays,
      category: d.category,
    })));
  });

const SellSubscriptionInputZ = z.object({
  planId: z.string().min(1),
  petId: z.string().min(1),
  petName: z.string().min(1),
  ownerId: z.string().min(1),
  ownerName: z.string().min(1),
  startDate: z.string().min(1),
});

export const sellSubscriptionFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => SellSubscriptionInputZ.parse(raw))
  .handler(async ({ data }): Promise<ClientSubscriptionRow> => {
    await connectDB();
    const plan = await SubscriptionPlanModel.findOne({ planId: data.planId, isActive: true }).lean();
    if (!plan) throw new Error(`Subscription plan ${data.planId} not found`);

    const start = new Date(data.startDate);
    const endDate = new Date(start.getTime() + plan.validityDays * 86400000).toISOString().slice(0, 10);

    const subId = await nextSeq("client_subscription", "SUB", 4);
    const sub = {
      subId,
      planId: plan.planId,
      planName: plan.name,
      petId: data.petId,
      petName: data.petName,
      ownerId: data.ownerId,
      ownerName: data.ownerName,
      status: "Active" as const,
      startDate: data.startDate,
      endDate,
      sessionsRemaining: plan.sessionCount,
      nextBillingDate: plan.billingType === "recurring" ? endDate : null,
      totalPaid: plan.price,
    };
    await ClientSubscriptionModel.create(sub);
    return toPlain(sub);
  });

export const listClientSubscriptionsFn = createServerFn({ method: "GET" })
  .handler(async (): Promise<ClientSubscriptionRow[]> => {
    await connectDB();
    const docs = await ClientSubscriptionModel.find({}).sort({ createdAt: -1 }).lean();
    const today = todayIST();
    const soon = new Date(new Date(today).getTime() + 7 * 86400000).toISOString().slice(0, 10);

    return toPlain(docs.map((d) => {
      let status = d.status;
      if (status === "Active" && d.endDate) {
        if (d.endDate < today) status = "Expired";
        else if (d.endDate <= soon) status = "Expiring";
      }
      return {
        subId: d.subId,
        planId: d.planId,
        planName: d.planName,
        petId: d.petId,
        petName: d.petName,
        ownerId: d.ownerId,
        ownerName: d.ownerName,
        status,
        startDate: d.startDate,
        endDate: d.endDate,
        sessionsRemaining: d.sessionsRemaining,
        nextBillingDate: d.nextBillingDate,
        totalPaid: d.totalPaid,
      };
    }));
  });

const SubIdInputZ = z.object({ subId: z.string().min(1) });

export const cancelSubscriptionFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => SubIdInputZ.parse(raw))
  .handler(async ({ data }): Promise<{ success: boolean }> => {
    await connectDB();
    await ClientSubscriptionModel.findOneAndUpdate({ subId: data.subId }, { $set: { status: "Cancelled" } });
    return { success: true };
  });

export const renewSubscriptionFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => SubIdInputZ.parse(raw))
  .handler(async ({ data }): Promise<ClientSubscriptionRow> => {
    await connectDB();
    const sub = await ClientSubscriptionModel.findOne({ subId: data.subId });
    if (!sub) throw new Error(`Subscription ${data.subId} not found`);
    const plan = await SubscriptionPlanModel.findOne({ planId: sub.planId }).lean();
    if (!plan) throw new Error(`Subscription plan ${sub.planId} not found`);

    const base = sub.endDate && sub.endDate > todayIST() ? sub.endDate : todayIST();
    const endDate = new Date(new Date(base).getTime() + plan.validityDays * 86400000).toISOString().slice(0, 10);

    sub.status = "Active";
    sub.endDate = endDate;
    sub.sessionsRemaining = plan.sessionCount;
    sub.nextBillingDate = plan.billingType === "recurring" ? endDate : null;
    sub.totalPaid = sub.totalPaid + plan.price;
    await sub.save();

    return toPlain(sub.toObject());
  });
