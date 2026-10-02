import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface IPasswordReset extends Document {
  email: string;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  lastSentAt: Date;
}

const PasswordResetSchema = new Schema<IPasswordReset>(
  {
    email: { type: String, required: true, lowercase: true, trim: true, unique: true },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } }, // Mongo TTL cleans expired codes
    attempts: { type: Number, default: 0 },
    lastSentAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true }
);

export const PasswordReset: Model<IPasswordReset> =
  (mongoose.models["PasswordReset"] as Model<IPasswordReset>) ??
  mongoose.model<IPasswordReset>("PasswordReset", PasswordResetSchema);
