/**
 * RefreshToken model — hashed JWT refresh tokens with TTL auto-expiry.
 */

import mongoose from "mongoose";

const { Schema, model } = mongoose;

export interface IRefreshToken {
  userId: mongoose.Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  userAgent?: string;
  ipAddress?: string;
  createdAt: Date;
}

export type RefreshTokenDocument = IRefreshToken & mongoose.Document;

const refreshTokenSchema = new Schema<RefreshTokenDocument>(
  {
    userId:    { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    userAgent: { type: String },
    ipAddress: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "refresh_tokens" }
);

// TTL index — MongoDB deletes documents automatically after expiresAt
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken: mongoose.Model<RefreshTokenDocument> =
  (mongoose.models["RefreshToken"] as mongoose.Model<RefreshTokenDocument>) ??
  model<RefreshTokenDocument>("RefreshToken", refreshTokenSchema);
