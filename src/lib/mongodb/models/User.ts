/**
 * User model — ERP operator and staff profiles with registration approval workflow.
 */

import mongoose from "mongoose";
import type { RoleId } from "@/lib/erp/config";

const { Schema, model } = mongoose;

export type ApprovalStatus = "approved" | "pending" | "rejected";

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
  qualification?: string;
  department?: string;
  specialty?: "Canine" | "Feline" | "Avian" | "Exotic" | "Surgery" | "General Practice" | "Administration";
  avatarUrl?: string;
  approvalStatus: ApprovalStatus;
  approvedBy?: string;
  approvedAt?: Date;
  rejectionReason?: string;
  isActive: boolean;
  lastLoginAt?: Date;
  loginCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export type UserDocument = IUser & mongoose.Document;

const userSchema = new Schema<UserDocument>(
  {
    fullName:        { type: String, required: true, trim: true },
    email:           { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash:    { type: String, required: true },
    phone:           { type: String },
    clinicName:      { type: String, required: true, trim: true },
    branch:          { type: String, required: true, trim: true },
    roleId:          { type: String, required: true, enum: ["doctor", "admin", "reception", "accounts", "platform"] },
    roleName:        { type: String, required: true },
    initials:        { type: String, required: true },
    licenseNumber:   { type: String },
    qualification:   { type: String },
    department:      { type: String },
    specialty:       { type: String, enum: ["Canine", "Feline", "Avian", "Exotic", "Surgery", "General Practice", "Administration"] },
    avatarUrl:       { type: String },
    approvalStatus:  { type: String, required: true, enum: ["approved", "pending", "rejected"], default: "approved", index: true },
    approvedBy:      { type: String },
    approvedAt:      { type: Date },
    rejectionReason: { type: String },
    isActive:        { type: Boolean, default: true },
    lastLoginAt:     { type: Date },
    loginCount:      { type: Number, default: 0 },
  },
  { timestamps: true, collection: "users" }
);

userSchema.index({ clinicName: 1, branch: 1 });
userSchema.index({ roleId: 1 });
userSchema.index({ approvalStatus: 1 });

export const User: mongoose.Model<UserDocument> =
  (mongoose.models["User"] as mongoose.Model<UserDocument>) ??
  model<UserDocument>("User", userSchema);
