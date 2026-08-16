/**
 * User model — ERP operator profiles.
 */

import mongoose from "mongoose";
import type { RoleId } from "@/lib/erp/config";

const { Schema, model } = mongoose;

export interface IUser {
  fullName: string;
  email: string;
  passwordHash: string;
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
  isActive: boolean;
  lastLoginAt?: Date;
  loginCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export type UserDocument = IUser & mongoose.Document;

const userSchema = new Schema<UserDocument>(
  {
    fullName:      { type: String, required: true, trim: true },
    email:         { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash:  { type: String, required: true },
    phone:         { type: String },
    clinicName:    { type: String, required: true, trim: true },
    branch:        { type: String, required: true, trim: true },
    roleId:        { type: String, required: true, enum: ["platform", "admin", "reception", "accounts"] },
    roleName:      { type: String, required: true },
    initials:      { type: String, required: true },
    licenseNumber: { type: String },
    department:    { type: String },
    specialty:     { type: String, enum: ["Canine", "Feline", "Avian", "Exotic", "Surgery", "General Practice", "Administration"] },
    avatarUrl:     { type: String },
    isActive:      { type: Boolean, default: true },
    lastLoginAt:   { type: Date },
    loginCount:    { type: Number, default: 0 },
  },
  { timestamps: true, collection: "users" }
);

userSchema.index({ clinicName: 1, branch: 1 });
userSchema.index({ roleId: 1 });

export const User: mongoose.Model<UserDocument> =
  (mongoose.models["User"] as mongoose.Model<UserDocument>) ??
  model<UserDocument>("User", userSchema);
