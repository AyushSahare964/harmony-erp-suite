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
  clearAndReseedFn,
  checkStaffStatusFn,
  listStaffMembersFn,
  approveStaffMemberFn,
  rejectStaffMemberFn,
  createStaffMemberByAdminFn,
  updateStaffMemberFn,
  deleteStaffMemberFn,
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
   * Seed system credentials (upsert only, does not wipe existing data).
   */
  public static async seedDemoUsers(): Promise<{ seeded: number; message: string }> {
    return seedDemoUsersFn();
  }

  /**
   * Clear ALL users from MongoDB, then re-seed the two default system credentials.
   * Call this from the Identity Hub to reset the staff directory.
   */
  public static async clearAndReseed(): Promise<{ deleted: number; seeded: number; message: string }> {
    return clearAndReseedFn();
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
   * Update staff member profile and save to MongoDB.
   */
  public static async updateStaff(data: any) {
    return updateStaffMemberFn({ data });
  }

  /**
   * Delete staff member and their credentials from MongoDB.
   */
  public static async deleteStaff(data: { userId: string }) {
    return deleteStaffMemberFn({ data });
  }

  /**
   * Returns the two built-in system credentials for the login page quick-fill.
   * Ayush Sahare = hidden developer account. Makarand Dixit = visible admin.
   */
  public static getDemoStaffList(): UserProfile[] {
    return [
      {
        id:          "sys-ayush",
        fullName:    "Ayush Sahare",
        email:       "ayush.sahare@vit.edu",
        roleId:      "admin",
        roleName:    "Clinic Administrator / Medical Director",
        initials:    "AS",
        clinicName:  "Real Care Small Animal Clinic",
        branch:      "Nagpur",
        department:  "System Administration",
        specialty:   "Administration",
        qualification: "B.Tech Computer Science",
        licenseNumber: "SYS-DEV-0001",
        createdAt:   "2026-01-01T00:00:00.000Z",
        approvalStatus: "approved",
      },
      {
        id:          "sys-makarand",
        fullName:    "Dr. Makarand Dixit",
        email:       "makarand.dixit@gmail.com",
        roleId:      "admin",
        roleName:    "Clinic Administrator / Medical Director",
        initials:    "MD",
        clinicName:  "Real Care Small Animal Clinic",
        branch:      "Nagpur",
        department:  "Veterinary Administration",
        specialty:   "Administration",
        qualification: "",
        licenseNumber: "",
        createdAt:   "2026-01-01T00:00:00.000Z",
        approvalStatus: "approved",
      },
    ];
  }
}

export const INITIAL_SEED_USERS = AuthService.getDemoStaffList();
