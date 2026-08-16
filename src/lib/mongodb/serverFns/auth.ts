/**
 * Auth Server Functions — TanStack Start `createServerFn` handlers.
 * Run ONLY on the server, never in the browser bundle.
 */

import { createServerFn } from "@tanstack/react-start";
import { setCookie, getCookie } from "@tanstack/react-start/server";
import bcrypt from "bcrypt";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb/client";
import { User } from "@/lib/mongodb/models/User";
import { RefreshToken } from "@/lib/mongodb/models/RefreshToken";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
} from "@/lib/mongodb/tokens";
import { ROLES, type RoleId } from "@/lib/erp/config";
import type { UserProfile, AuthResponse } from "@/lib/erp/auth";

const SALT_ROUNDS = 12;
const COOKIE_NAME = "vetos_refresh";
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// ─── Helpers ────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return (parts[0] ?? name).slice(0, 2).toUpperCase();
  return ((parts[0]?.[0] ?? "?") + (parts[parts.length - 1]?.[0] ?? "?")).toUpperCase();
}

/** Convert a raw lean Mongoose document to a safe UserProfile for the client */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toProfile(user: Record<string, any>): UserProfile {
  const profile: UserProfile = {
    id:        String(user["_id"]),
    fullName:  String(user["fullName"]),
    email:     String(user["email"]),
    clinicName: String(user["clinicName"]),
    branch:    String(user["branch"]),
    roleId:    user["roleId"] as RoleId,
    roleName:  String(user["roleName"]),
    initials:  String(user["initials"]),
    createdAt: user["createdAt"] instanceof Date
      ? user["createdAt"].toISOString()
      : String(user["createdAt"]),
  };
  // Only set optional fields when they actually have a value
  if (user["phone"])         profile.phone         = String(user["phone"]);
  if (user["licenseNumber"]) profile.licenseNumber = String(user["licenseNumber"]);
  if (user["department"])    profile.department    = String(user["department"]);
  if (user["specialty"])     profile.specialty     = user["specialty"] as NonNullable<UserProfile["specialty"]>;
  if (user["avatarUrl"])     profile.avatarUrl     = String(user["avatarUrl"]);
  return profile;
}

async function issueTokens(userId: string, email: string, roleId: string) {
  const accessToken = signAccessToken(userId, email, roleId);
  const { token: refreshToken } = signRefreshToken(userId);
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
  // Cast userId string to any so Mongoose can coerce it to ObjectId
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await RefreshToken.create({ userId: userId as any, tokenHash: hashToken(refreshToken), expiresAt });
  return { accessToken, refreshToken, expiresAt };
}

// ─── loginFn ────────────────────────────────────────────────────────────────

const loginSchema = z.object({
  email:      z.string().email(),
  password:   z.string().min(1),
  rememberMe: z.boolean().optional(),
});

export const loginFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => loginSchema.parse(raw))
  .handler(async ({ data }): Promise<AuthResponse & { accessToken?: string }> => {
    await connectDB();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = await User.findOne({ email: data.email.toLowerCase().trim() }).lean() as Record<string, any> | null;
    if (!user) {
      return { success: false, message: "No staff profile found with this email address." };
    }

    const passwordOk = await bcrypt.compare(data.password, user["passwordHash"] as string);
    if (!passwordOk) {
      return { success: false, message: "Incorrect password. Please verify your clinic credentials." };
    }

    await User.updateOne(
      { _id: user["_id"] },
      { $set: { lastLoginAt: new Date() }, $inc: { loginCount: 1 } }
    );

    const userId = String(user["_id"]);
    const { accessToken, refreshToken, expiresAt } = await issueTokens(
      userId, user["email"] as string, user["roleId"] as string
    );

    setCookie(COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure:   process.env["NODE_ENV"] === "production",
      sameSite: "lax",
      path:     "/",
      expires:  expiresAt,
    });

    return {
      success: true,
      user: toProfile(user),
      accessToken,
      message: `Welcome back, ${user["fullName"]}!`,
    };
  });

// ─── registerFn ─────────────────────────────────────────────────────────────

const registerSchema = z.object({
  fullName:      z.string().min(2),
  email:         z.string().email(),
  password:      z.string().min(6, "Password must be at least 6 characters"),
  phone:         z.string().optional(),
  clinicName:    z.string().min(1),
  branch:        z.string().min(1),
  roleId:        z.enum(["platform", "admin", "reception", "accounts"]),
  licenseNumber: z.string().optional(),
  department:    z.string().optional(),
  specialty:     z.enum(["Canine","Feline","Avian","Exotic","Surgery","General Practice","Administration"]).optional(),
});

export const registerFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => registerSchema.parse(raw))
  .handler(async ({ data }): Promise<AuthResponse & { accessToken?: string }> => {
    await connectDB();

    const cleanEmail = data.email.toLowerCase().trim();
    const existing = await User.findOne({ email: cleanEmail }).lean();
    if (existing) {
      return { success: false, message: "A staff account with this email already exists." };
    }

    const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);
    const roleName     = ROLES[data.roleId as RoleId]?.name ?? "Clinic Staff";
    const initials     = getInitials(data.fullName);

    // Build the create payload avoiding optional undefined fields in strict mode
    const createPayload: Record<string, unknown> = {
      fullName:   data.fullName.trim(),
      email:      cleanEmail,
      passwordHash,
      clinicName: data.clinicName.trim() || "Harmony Veterinary Care",
      branch:     data.branch.trim()     || "Central Hospital",
      roleId:     data.roleId,
      roleName,
      initials,
      department: data.department?.trim() ?? "Clinical Operations",
      specialty:  data.specialty          ?? "General Practice",
    };
    if (data.phone?.trim())         createPayload["phone"]         = data.phone.trim();
    if (data.licenseNumber?.trim()) createPayload["licenseNumber"] = data.licenseNumber.trim();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = await User.create(createPayload) as any;

    const userId = String(user["_id"]);
    const { accessToken, refreshToken, expiresAt } = await issueTokens(
      userId, user["email"] as string, user["roleId"] as string
    );

    setCookie(COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure:   process.env["NODE_ENV"] === "production",
      sameSite: "lax",
      path:     "/",
      expires:  expiresAt,
    });

    return {
      success: true,
      user: toProfile(user.toObject ? user.toObject() : user),
      accessToken,
      message: `Profile created successfully for ${user["fullName"]}!`,
    };
  });

// ─── logoutFn ───────────────────────────────────────────────────────────────

export const logoutFn = createServerFn({ method: "POST" })
  .handler(async (): Promise<{ success: boolean }> => {
    await connectDB();
    const rawToken = getCookie(COOKIE_NAME);
    if (rawToken) {
      await RefreshToken.deleteOne({ tokenHash: hashToken(rawToken) });
    }
    setCookie(COOKIE_NAME, "", { maxAge: 0, path: "/" });
    return { success: true };
  });

// ─── getMeFn ────────────────────────────────────────────────────────────────

export const getMeFn = createServerFn({ method: "GET" })
  .handler(async (): Promise<UserProfile | null> => {
    await connectDB();
    const rawToken = getCookie(COOKIE_NAME);
    if (!rawToken) return null;

    try {
      const payload = verifyRefreshToken(rawToken);
      const stored  = await RefreshToken.findOne({ tokenHash: hashToken(rawToken) }).lean();
      if (!stored) return null;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const user = await User.findById(payload.sub).lean() as Record<string, any> | null;
      if (!user || !user["isActive"]) return null;

      return toProfile(user);
    } catch {
      return null;
    }
  });

// ─── seedDemoUsersFn ─────────────────────────────────────────────────────────

export const seedDemoUsersFn = createServerFn({ method: "POST" })
  .handler(async (): Promise<{ seeded: number; message: string }> => {
    await connectDB();

    const demoUsers = [
      { fullName: "Ishaan Verma",    email: "ishaan.verma@vetos.cloud",  password: "demo123", phone: "+91 98200 11223", clinicName: "VetOS Cloud Infrastructure",               branch: "Production · ap-south-1",            roleId: "platform", roleName: "Platform Administrator",              initials: "IV", licenseNumber: "VET-SYS-9901",  department: "Cloud Operations",                      specialty: "Administration" },
      { fullName: "Dr. Aisha Nair",  email: "aisha.nair@vetos.cloud",    password: "demo123", phone: "+91 98111 44556", clinicName: "Harmony Pet Super-Specialty Hospital", branch: "Central Hospital · Koramangala",       roleId: "admin",    roleName: "Clinic Administrator / Medical Director", initials: "AN", licenseNumber: "VCI-KAR-2018-8842", department: "Veterinary Surgery & Internal Medicine", specialty: "Surgery" },
      { fullName: "Rohan Sen",       email: "rohan.sen@vetos.cloud",     password: "demo123", phone: "+91 98333 77889", clinicName: "Harmony Pet Super-Specialty Hospital", branch: "Central Hospital · Front Desk",         roleId: "reception", roleName: "Receptionist & Triage Lead",          initials: "RS", licenseNumber: "STF-REC-204",       department: "Patient Admittance & Triage",           specialty: "General Practice" },
      { fullName: "Maya Iyer",       email: "maya.iyer@vetos.cloud",     password: "demo123", phone: "+91 98444 66778", clinicName: "Harmony Pet Super-Specialty Hospital", branch: "Central Hospital · Accounts Office",   roleId: "accounts",  roleName: "Accounts & Billing Manager",           initials: "MI", licenseNumber: "FIN-ACC-552",       department: "Finance & Taxation",                    specialty: "Administration" },
    ];

    let seeded = 0;
    for (const u of demoUsers) {
      const exists = await User.findOne({ email: u.email }).lean();
      if (exists) continue;
      const { password, ...rest } = u;
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await User.create({ ...rest, passwordHash } as any);
      seeded++;
    }

    return {
      seeded,
      message: seeded > 0
        ? `✅ Seeded ${seeded} demo staff users into MongoDB Atlas.`
        : "ℹ️ All demo users already exist — nothing to seed.",
    };
  });
