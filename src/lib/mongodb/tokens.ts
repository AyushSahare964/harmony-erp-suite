/**
 * JWT utility — sign and verify access / refresh tokens.
 * Server-only module. Never import in client-side code.
 */

import jwt from "jsonwebtoken";
import crypto from "crypto";

const ACCESS_SECRET  = process.env["JWT_ACCESS_SECRET"]  ?? "dev-access-secret-change-me";
const REFRESH_SECRET = process.env["JWT_REFRESH_SECRET"] ?? "dev-refresh-secret-change-me";
// Use concrete string literals for expiresIn to satisfy exactOptionalPropertyTypes
const ACCESS_TTL  = (process.env["ACCESS_TOKEN_TTL"]  ?? "15m") as string;
const REFRESH_TTL = (process.env["REFRESH_TOKEN_TTL"] ?? "7d")  as string;

export interface AccessTokenPayload {
  sub: string;
  email: string;
  roleId: string;
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
}

export function signAccessToken(userId: string, email: string, roleId: string): string {
  // @ts-expect-error: jwt.sign expiresIn string overload conflicts with exactOptionalPropertyTypes
  return jwt.sign({ sub: userId, email, roleId }, ACCESS_SECRET, { expiresIn: ACCESS_TTL });
}

export function signRefreshToken(userId: string): { token: string; jti: string } {
  const jti = crypto.randomUUID();
  // @ts-expect-error: same as above
  const token = jwt.sign({ sub: userId, jti }, REFRESH_SECRET, { expiresIn: REFRESH_TTL });
  return { token, jti };
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, ACCESS_SECRET) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, REFRESH_SECRET) as RefreshTokenPayload;
}

/** Hash a raw refresh token for safe storage */
export function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}
