/**
 * Auth & Identity Server Functions — TanStack Start `createServerFn` handlers.
 * Run ONLY on the server, never in the browser bundle.
 */

import { createServerFn } from "@tanstack/react-start";
import { setCookie, getCookie } from "@tanstack/react-start/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb/client";
import { User, type ApprovalStatus } from "@/lib/mongodb/models/User";
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
    id:             String(user["_id"]),
    fullName:       String(user["fullName"]),
    email:          String(user["email"]),
    clinicName:     String(user["clinicName"]),
    branch:         String(user["branch"]),
    roleId:         user["roleId"] as RoleId,
    roleName:       String(user["roleName"]),
    initials:       String(user["initials"]),
    approvalStatus: (user["approvalStatus"] || "approved") as ApprovalStatus,
    createdAt:      user["createdAt"] instanceof Date
      ? user["createdAt"].toISOString()
      : String(user["createdAt"]),
  };
  // Only set optional fields when they actually have a value
  if (user["phone"])         profile.phone         = String(user["phone"]);
  if (user["licenseNumber"]) profile.licenseNumber = String(user["licenseNumber"]);
  if (user["qualification"]) profile.qualification = String(user["qualification"]);
  if (user["department"])    profile.department    = String(user["department"]);
  if (user["specialty"])     profile.specialty     = user["specialty"] as NonNullable<UserProfile["specialty"]>;
  if (user["avatarUrl"])     profile.avatarUrl     = String(user["avatarUrl"]);
  return profile;
}

async function issueTokens(userId: string, email: string, roleId: string) {
  const accessToken = signAccessToken(userId, email, roleId);
  const { token: refreshToken } = signRefreshToken(userId);
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
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

    const approvalStatus = (user["approvalStatus"] || "approved") as ApprovalStatus;

    if (approvalStatus === "pending") {
      return {
        success: false,
        pendingApproval: true,
        user: toProfile(user),
        message: "Your staff access registration is pending Administrator approval.",
      };
    }

    if (approvalStatus === "rejected") {
      return {
        success: false,
        message: user["rejectionReason"] 
          ? `Access request declined: ${user["rejectionReason"]}`
          : "Your account registration was not approved by clinic administration.",
      };
    }

    if (!user["isActive"]) {
      return { success: false, message: "Your staff account has been deactivated. Please contact your Clinic Administrator." };
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

// ─── registerFn (Self Registration -> Pending Admin Approval) ───────────────

const registerSchema = z.object({
  fullName:      z.string().min(2),
  email:         z.string().email(),
  password:      z.string().min(6, "Password must be at least 6 characters"),
  phone:         z.string().optional(),
  clinicName:    z.string().min(1).default("Harmony Pet Super-Specialty Hospital"),
  branch:        z.string().min(1).default("Central Hospital · Koramangala"),
  roleId:        z.enum(["doctor", "admin", "reception", "accounts", "platform"]).default("doctor"),
  licenseNumber: z.string().optional(),
  qualification: z.string().optional(),
  department:    z.string().optional(),
  specialty:     z.enum(["Canine","Feline","Avian","Exotic","Surgery","General Practice","Administration"]).optional(),
});

export const registerFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => registerSchema.parse(raw))
  .handler(async ({ data }): Promise<AuthResponse> => {
    await connectDB();

    const cleanEmail = data.email.toLowerCase().trim();
    const existing = await User.findOne({ email: cleanEmail }).lean();
    if (existing) {
      return { success: false, message: "A staff account with this email already exists." };
    }

    const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);
    const roleName     = ROLES[data.roleId as RoleId]?.name ?? "Clinic Staff";
    const initials     = getInitials(data.fullName);

    const createPayload: Record<string, unknown> = {
      fullName:       data.fullName.trim(),
      email:          cleanEmail,
      passwordHash,
      clinicName:     data.clinicName.trim() || "Harmony Pet Super-Specialty Hospital",
      branch:         data.branch.trim()     || "Central Hospital · Koramangala",
      roleId:         data.roleId,
      roleName,
      initials,
      approvalStatus: "pending",
      department:     data.department?.trim() || "Clinical Care",
      specialty:      data.specialty          || "General Practice",
      isActive:       true,
    };
    if (data.phone?.trim())         createPayload["phone"]         = data.phone.trim();
    if (data.licenseNumber?.trim()) createPayload["licenseNumber"] = data.licenseNumber.trim();
    if (data.qualification?.trim()) createPayload["qualification"] = data.qualification.trim();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = await User.create(createPayload) as any;

    return {
      success: true,
      pendingApproval: true,
      user: toProfile(user.toObject ? user.toObject() : user),
      message: "Registration submitted successfully! Your account is awaiting clinic administrator review and approval.",
    };
  });

// ─── checkStaffStatusFn (Used by Pending Approval Preview Page) ─────────────

export const checkStaffStatusFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => z.object({ email: z.string().email() }).parse(raw))
  .handler(async ({ data }): Promise<{ found: boolean; status?: ApprovalStatus; user?: UserProfile; message?: string }> => {
    await connectDB();
    const user = await User.findOne({ email: data.email.toLowerCase().trim() }).lean() as Record<string, any> | null;
    if (!user) {
      return { found: false, message: "No registration record found." };
    }
    return {
      found: true,
      status: (user["approvalStatus"] || "approved") as ApprovalStatus,
      user: toProfile(user),
    };
  });

// ─── listStaffMembersFn (Used in Identity & Access Management Hub) ──────────

export const listStaffMembersFn = createServerFn({ method: "GET" })
  .handler(async (): Promise<any[]> => {
    await connectDB();
    const users = await User.find({}).sort({ createdAt: -1 }).lean();
    return JSON.parse(JSON.stringify(users.map((u) => ({
      id:              String(u._id),
      fullName:        u.fullName,
      email:           u.email,
      phone:           u.phone,
      clinicName:      u.clinicName,
      branch:          u.branch,
      roleId:          u.roleId,
      roleName:        u.roleName,
      initials:        u.initials,
      licenseNumber:   u.licenseNumber,
      qualification:   u.qualification,
      department:      u.department,
      specialty:       u.specialty,
      approvalStatus:  u.approvalStatus || "approved",
      approvedBy:      u.approvedBy,
      approvedAt:      u.approvedAt ? u.approvedAt.toISOString() : undefined,
      rejectionReason: u.rejectionReason,
      isActive:        u.isActive,
      lastLoginAt:     u.lastLoginAt ? u.lastLoginAt.toISOString() : undefined,
      createdAt:       u.createdAt ? u.createdAt.toISOString() : undefined,
    }))));
  });

// ─── approveStaffMemberFn ───────────────────────────────────────────────────

export const approveStaffMemberFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => z.object({
    userId:     z.string(),
    roleId:     z.enum(["doctor", "admin", "reception", "accounts", "platform"]),
    department: z.string().optional(),
    approvedBy: z.string().optional(),
  }).parse(raw))
  .handler(async ({ data }): Promise<{ success: boolean; message: string }> => {
    await connectDB();
    const roleName = ROLES[data.roleId]?.name || "Clinic Staff";
    await User.findByIdAndUpdate(data.userId, {
      $set: {
        approvalStatus: "approved",
        roleId: data.roleId,
        roleName,
        ...(data.department ? { department: data.department } : {}),
        approvedBy: data.approvedBy || "Clinic Administrator",
        approvedAt: new Date(),
        isActive: true,
      },
    });
    return { success: true, message: `Staff member approved and assigned role: ${roleName}` };
  });

// ─── rejectStaffMemberFn ────────────────────────────────────────────────────

export const rejectStaffMemberFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => z.object({
    userId: z.string(),
    reason: z.string().optional(),
  }).parse(raw))
  .handler(async ({ data }): Promise<{ success: boolean; message: string }> => {
    await connectDB();
    await User.findByIdAndUpdate(data.userId, {
      $set: {
        approvalStatus: "rejected",
        rejectionReason: data.reason || "Application declined by administrator",
        isActive: false,
      },
    });
    return { success: true, message: "Staff access request declined." };
  });

// ─── createStaffMemberByAdminFn ─────────────────────────────────────────────

const adminCreateSchema = z.object({
  fullName:      z.string().min(2),
  email:         z.string().email(),
  password:      z.string().min(6),
  phone:         z.string().optional(),
  clinicName:    z.string().default("Harmony Pet Super-Specialty Hospital"),
  branch:        z.string().default("Central Hospital · Koramangala"),
  roleId:        z.enum(["doctor", "admin", "reception", "accounts", "platform"]),
  licenseNumber: z.string().optional(),
  qualification: z.string().optional(),
  department:    z.string().default("Clinical Care"),
  specialty:     z.enum(["Canine","Feline","Avian","Exotic","Surgery","General Practice","Administration"]).default("General Practice"),
});

export const createStaffMemberByAdminFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => adminCreateSchema.parse(raw))
  .handler(async ({ data }): Promise<{ success: boolean; message: string; user?: any }> => {
    await connectDB();
    const cleanEmail = data.email.toLowerCase().trim();
    const existing = await User.findOne({ email: cleanEmail }).lean();
    if (existing) {
      return { success: false, message: "A staff account with this email already exists." };
    }

    const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);
    const roleName     = ROLES[data.roleId]?.name ?? "Clinic Staff";
    const initials     = getInitials(data.fullName);

    const createPayload: Record<string, unknown> = {
      fullName:       data.fullName.trim(),
      email:          cleanEmail,
      passwordHash,
      clinicName:     data.clinicName || "Harmony Pet Super-Specialty Hospital",
      branch:         data.branch || "Central Hospital · Koramangala",
      roleId:         data.roleId,
      roleName,
      initials,
      department:     data.department || "Clinical Care",
      specialty:      data.specialty || "General Practice",
      approvalStatus: "approved",
      approvedBy:     "Clinic Administrator",
      approvedAt:     new Date(),
      isActive:       true,
    };
    if (data.phone?.trim())         createPayload["phone"]         = data.phone.trim();
    if (data.licenseNumber?.trim()) createPayload["licenseNumber"] = data.licenseNumber.trim();
    if (data.qualification?.trim()) createPayload["qualification"] = data.qualification.trim();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doc = await User.create(createPayload as any);

    return {
      success: true,
      message: `Staff member ${data.fullName} added successfully with ${roleName} access!`,
      user: toProfile(doc.toObject ? doc.toObject() : doc),
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
      if (!user || !user["isActive"] || user["approvalStatus"] === "pending" || user["approvalStatus"] === "rejected") {
        return null;
      }

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
      { fullName: "Dr. Rohit Sharma", email: "rohit.sharma@vetos.cloud", password: "demo123", phone: "+91 98222 33445", clinicName: "Harmony Pet Super-Specialty Hospital", branch: "Central Hospital · Koramangala", roleId: "doctor", roleName: "Doctor / Senior Vet", initials: "RS", licenseNumber: "VCI-KAR-2016-5120", qualification: "BVSc & AH, MVSc (Surgery)", department: "Clinical OPD & Surgery", specialty: "Canine", approvalStatus: "approved" },
      { fullName: "Dr. Aisha Nair",   email: "aisha.nair@vetos.cloud",   password: "demo123", phone: "+91 98111 44556", clinicName: "Harmony Pet Super-Specialty Hospital", branch: "Central Hospital · Koramangala", roleId: "admin",  roleName: "Clinic Administrator / Medical Director", initials: "AN", licenseNumber: "VCI-KAR-2018-8842", qualification: "BVSc & AH, MBA (Healthcare)", department: "Veterinary Administration", specialty: "Surgery", approvalStatus: "approved" },
      { fullName: "Rohan Sen",        email: "rohan.sen@vetos.cloud",    password: "demo123", phone: "+91 98333 77889", clinicName: "Harmony Pet Super-Specialty Hospital", branch: "Central Hospital · Front Desk",   roleId: "reception", roleName: "Receptionist & Triage Lead", initials: "RS", licenseNumber: "STF-REC-204", qualification: "B.Sc (Hospitality)", department: "Patient Admittance & Triage", specialty: "General Practice", approvalStatus: "approved" },
      { fullName: "Maya Iyer",        email: "maya.iyer@vetos.cloud",    password: "demo123", phone: "+91 98444 66778", clinicName: "Harmony Pet Super-Specialty Hospital", branch: "Central Hospital · Accounts Office", roleId: "accounts", roleName: "Accounts & Billing Manager", initials: "MI", licenseNumber: "FIN-ACC-552", qualification: "B.Com, M.Com (Finance)", department: "Finance & Taxation", specialty: "Administration", approvalStatus: "approved" },
      { fullName: "Ishaan Verma",     email: "ishaan.verma@vetos.cloud", password: "demo123", phone: "+91 98200 11223", clinicName: "VetOS Cloud Infrastructure", branch: "Production · ap-south-1", roleId: "platform", roleName: "Platform Administrator", initials: "IV", licenseNumber: "VET-SYS-9901", qualification: "B.Tech (Cloud Systems)", department: "Cloud Operations", specialty: "Administration", approvalStatus: "approved" },
    ];

    let seeded = 0;
    for (const u of demoUsers) {
      const exists = await User.findOne({ email: u.email }).lean();
      if (exists) continue;
      const { password, ...rest } = u;
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await User.create({ ...rest, passwordHash, isActive: true } as any);
      seeded++;
    }

    return {
      seeded,
      message: seeded > 0
        ? `✅ Seeded ${seeded} hospital staff profiles into MongoDB.`
        : "ℹ️ All staff users already exist.",
    };
  });
