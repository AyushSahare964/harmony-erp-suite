/**
 * auth.ts — Client-facing auth API.
 *
 * The AuthService class API is preserved exactly so that all existing
 * imports (store.tsx, login.tsx, etc.) continue to work unchanged.
 *
 * All persistence is now handled by MongoDB Atlas via TanStack Start
 * server functions. localStorage is no longer used.
 */

import { ROLES, type RoleId } from "./config";
import {
  loginFn,
  registerFn,
  logoutFn,
  getMeFn,
  seedDemoUsersFn,
} from "@/lib/mongodb/serverFns/auth";

// ─── Shared interfaces (unchanged — keeps all consumers working) ─────────────

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
  department?: string;
  specialty?: "Canine" | "Feline" | "Avian" | "Exotic" | "Surgery" | "General Practice" | "Administration";
  avatarUrl?: string;
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
}

// ─── In-memory session cache (replaces localStorage) ─────────────────────────
// The source of truth is the httpOnly refresh cookie + MongoDB.
// This cache is reset on page reload — getMeFn re-hydrates it from the cookie.
let _sessionCache: UserProfile | null = null;

// ─── AuthService ─────────────────────────────────────────────────────────────

export class AuthService {
  /**
   * Log in an ERP operator with email and password.
   * Issues httpOnly refresh cookie + returns access token in response.
   */
  public static async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const res = await loginFn({ data: credentials });
    if (res.success && res.user) {
      _sessionCache = res.user;
      // Store access token in sessionStorage for use in API calls
      try {
        if (typeof sessionStorage !== "undefined" && res.accessToken) {
          sessionStorage.setItem("vetos.access_token", res.accessToken);
        }
      } catch { /* ignore */ }
    }
    const result: AuthResponse = { success: res.success };
    if (res.user)    result.user    = res.user;
    if (res.message) result.message = res.message;
    if (res.accessToken) result.token = res.accessToken;
    return result;
  }

  /**
   * Register a new ERP operator profile.
   */
  public static async register(data: RegisterPayload): Promise<AuthResponse> {
    const res = await registerFn({ data });
    if (res.success && res.user) {
      _sessionCache = res.user;
      try {
        if (typeof sessionStorage !== "undefined" && res.accessToken) {
          sessionStorage.setItem("vetos.access_token", res.accessToken);
        }
      } catch { /* ignore */ }
    }
    const result: AuthResponse = { success: res.success };
    if (res.user)    result.user    = res.user;
    if (res.message) result.message = res.message;
    if (res.accessToken) result.token = res.accessToken;
    return result;
  }

  /**
   * Get the current session user.
   * Returns from in-memory cache first; falls back to a server round-trip
   * to validate the refresh cookie (handles page reloads).
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
   * Synchronous getter — returns cached value only (no network).
   * Used for initial render; follow up with getCurrentUserAsync() for accuracy.
   */
  public static getCurrentUser(): UserProfile | null {
    return _sessionCache;
  }

  /**
   * Log out — revokes the refresh token on the server and clears the cookie.
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
   * Seed the 4 demo staff users into MongoDB Atlas (idempotent).
   * Call from a dev-only button or admin panel.
   */
  public static async seedDemoUsers(): Promise<{ seeded: number; message: string }> {
    return seedDemoUsersFn();
  }

  /**
   * Returns a typed list of demo credentials for the login page quick-fill.
   * (No longer carries passwordHash — safe to use on the client.)
   */
  public static getDemoStaffList(): UserProfile[] {
    return [
      { id: "demo-1", fullName: "Ishaan Verma",   email: "ishaan.verma@vetos.cloud", roleId: "platform", roleName: "Platform Administrator",              initials: "IV", clinicName: "VetOS Cloud Infrastructure",                 branch: "Production · ap-south-1",           department: "Cloud Operations",                     specialty: "Administration",  createdAt: "2026-01-15T00:00:00.000Z" },
      { id: "demo-2", fullName: "Dr. Aisha Nair", email: "aisha.nair@vetos.cloud",   roleId: "admin",    roleName: "Clinic Administrator / Medical Director", initials: "AN", clinicName: "Harmony Pet Super-Specialty Hospital",  branch: "Central Hospital · Koramangala",     department: "Veterinary Surgery & Internal Medicine", specialty: "Surgery",         createdAt: "2026-02-01T00:00:00.000Z" },
      { id: "demo-3", fullName: "Rohan Sen",       email: "rohan.sen@vetos.cloud",    roleId: "reception",roleName: "Receptionist & Triage Lead",             initials: "RS", clinicName: "Harmony Pet Super-Specialty Hospital",  branch: "Central Hospital · Front Desk",      department: "Patient Admittance & Triage",          specialty: "General Practice", createdAt: "2026-03-10T00:00:00.000Z" },
      { id: "demo-4", fullName: "Maya Iyer",       email: "maya.iyer@vetos.cloud",    roleId: "accounts", roleName: "Accounts & Billing Manager",            initials: "MI", clinicName: "Harmony Pet Super-Specialty Hospital",  branch: "Central Hospital · Accounts Office", department: "Finance & Taxation",                   specialty: "Administration",  createdAt: "2026-03-20T00:00:00.000Z" },
    ];
  }
}

// Keep INITIAL_SEED_USERS exported for backward compat (used in login.tsx quick-fill)
export const INITIAL_SEED_USERS = AuthService.getDemoStaffList();
