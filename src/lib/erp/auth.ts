/**
 * auth.ts — Client-facing auth API.
 *
 * All persistence is handled by MongoDB Atlas via TanStack Start
 * server functions.
 */

import { ROLES, type RoleId } from "./config";
import {
  loginFn,
  registerFn,
  logoutFn,
  getMeFn,
  seedDemoUsersFn,
  checkStaffStatusFn,
  listStaffMembersFn,
  approveStaffMemberFn,
  rejectStaffMemberFn,
  createStaffMemberByAdminFn,
} from "@/lib/mongodb/serverFns/auth";

// ─── Shared interfaces ───────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  clinicName: string;
  branch: string;
  roleId: RoleId;
  roleName: string;
  initials: string;
  licenseNumber?: string;
  qualification?: string;
  department?: string;
  specialty?: "Canine" | "Feline" | "Avian" | "Exotic" | "Surgery" | "General Practice" | "Administration";
  avatarUrl?: string;
  approvalStatus?: "approved" | "pending" | "rejected";
  createdAt: string;
}

export interface RegisterPayload {
  fullName: string;
  email: string;
  password: string;
  phone?: string;
  clinicName: string;
  branch: string;
  roleId: RoleId;
  licenseNumber?: string;
  qualification?: string;
  department?: string;
  specialty?: "Canine" | "Feline" | "Avian" | "Exotic" | "Surgery" | "General Practice" | "Administration";
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface AuthResponse {
  success: boolean;
  user?: UserProfile;
  message?: string;
  token?: string;
  pendingApproval?: boolean;
}

// ─── In-memory session cache ────────────────────────────────────────────────
let _sessionCache: UserProfile | null = null;

// ─── AuthService ─────────────────────────────────────────────────────────────

export class AuthService {
  /**
   * Log in an ERP operator with email and password.
   */
  public static async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const res = await loginFn({ data: credentials });
    if (res.success && res.user) {
      _sessionCache = res.user;
      try {
        if (typeof sessionStorage !== "undefined" && res.accessToken) {
          sessionStorage.setItem("vetos.access_token", res.accessToken);
        }
      } catch { /* ignore */ }
    }
    const result: AuthResponse = {
      success: res.success,
    };
    if (res.pendingApproval !== undefined) result.pendingApproval = res.pendingApproval;
    if (res.user)    result.user    = res.user;
    if (res.message) result.message = res.message;
    if (res.accessToken) result.token = res.accessToken;
    return result;

  }

  /**
   * Register a new ERP operator profile (Submits for admin approval).
   */
  public static async register(data: RegisterPayload): Promise<AuthResponse> {
    const res = await registerFn({ data });
    return res;
  }

  /**
   * Check live approval status by email.
   */
  public static async checkApprovalStatus(email: string) {
    return checkStaffStatusFn({ data: { email } });
  }

  /**
   * Get the current session user.
   */
  public static async getCurrentUserAsync(): Promise<UserProfile | null> {
    if (_sessionCache) return _sessionCache;
    try {
      const user = await getMeFn();
      _sessionCache = user;
      return user;
    } catch {
      return null;
    }
  }

  /**
   * Synchronous getter.
   */
  public static getCurrentUser(): UserProfile | null {
    return _sessionCache;
  }

  /**
   * Log out.
   */
  public static async logout(): Promise<void> {
    _sessionCache = null;
    try {
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.removeItem("vetos.access_token");
      }
    } catch { /* ignore */ }
    await logoutFn();
  }

  /**
   * Seed demo staff into MongoDB.
   */
  public static async seedDemoUsers(): Promise<{ seeded: number; message: string }> {
    return seedDemoUsersFn();
  }

  /**
   * List all registered staff for Identity & Access Hub.
   */
  public static async listStaff(): Promise<any[]> {
    return listStaffMembersFn();
  }

  /**
   * Approve a pending staff member.
   */
  public static async approveStaff(data: { userId: string; roleId: RoleId; department?: string }) {
    return approveStaffMemberFn({ data });
  }

  /**
   * Reject a staff member's request.
   */
  public static async rejectStaff(data: { userId: string; reason?: string }) {
    return rejectStaffMemberFn({ data });
  }

  /**
   * Admin directly creates an approved employee.
   */
  public static async createStaffMember(data: any) {
    return createStaffMemberByAdminFn({ data });
  }

  /**
   * Returns a typed list of demo credentials for the login page quick-fill.
   */
  public static getDemoStaffList(): UserProfile[] {
    return [
      { id: "demo-dr", fullName: "Dr. Rohit Sharma", email: "rohit.sharma@vetos.cloud", roleId: "doctor", roleName: "Doctor / Senior Vet", initials: "RS", clinicName: "Harmony Pet Super-Specialty Hospital", branch: "Central Hospital · Koramangala", department: "Clinical OPD & Surgery", specialty: "Canine", qualification: "BVSc & AH, MVSc", licenseNumber: "VCI-KAR-2016-5120", createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "demo-admin", fullName: "Dr. Aisha Nair", email: "aisha.nair@vetos.cloud", roleId: "admin", roleName: "Clinic Administrator / Medical Director", initials: "AN", clinicName: "Harmony Pet Super-Specialty Hospital", branch: "Central Hospital · Koramangala", department: "Veterinary Administration", specialty: "Surgery", qualification: "BVSc & AH, MBA", licenseNumber: "VCI-KAR-2018-8842", createdAt: "2026-02-01T00:00:00.000Z" },
      { id: "demo-rec", fullName: "Rohan Sen", email: "rohan.sen@vetos.cloud", roleId: "reception", roleName: "Receptionist & Triage Lead", initials: "RS", clinicName: "Harmony Pet Super-Specialty Hospital", branch: "Central Hospital · Front Desk", department: "Patient Admittance & Triage", specialty: "General Practice", qualification: "B.Sc (Hospitality)", licenseNumber: "STF-REC-204", createdAt: "2026-03-10T00:00:00.000Z" },
      { id: "demo-acc", fullName: "Maya Iyer", email: "maya.iyer@vetos.cloud", roleId: "accounts", roleName: "Accounts & Billing Manager", initials: "MI", clinicName: "Harmony Pet Super-Specialty Hospital", branch: "Central Hospital · Accounts Office", department: "Finance & Taxation", specialty: "Administration", qualification: "B.Com, M.Com", licenseNumber: "FIN-ACC-552", createdAt: "2026-03-20T00:00:00.000Z" },
      { id: "demo-plat", fullName: "Ishaan Verma", email: "ishaan.verma@vetos.cloud", roleId: "platform", roleName: "Platform Administrator", initials: "IV", clinicName: "VetOS Cloud Infrastructure", branch: "Production · ap-south-1", department: "Cloud Operations", specialty: "Administration", qualification: "B.Tech Cloud Systems", licenseNumber: "VET-SYS-9901", createdAt: "2026-01-15T00:00:00.000Z" },
    ];
  }
}

export const INITIAL_SEED_USERS = AuthService.getDemoStaffList();
