/**
 * AuditLog — who did what to which financial document, and when.
 *
 * Financial documents are never hard-deleted and never silently edited, so this
 * log plus the ledgers is the complete history. Written from inside the posting
 * transaction so an audit row can't go missing when a post succeeds.
 */

import mongoose, { Schema, type Document } from "mongoose";

export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "POST"
  | "CANCEL"
  | "PRINT"
  | "EXPORT"
  | "OVERRIDE" // manager override of a credit-limit block
  | "CLEAR" // cheque / DD cleared
  | "BOUNCE"; // cheque / DD bounced

export const AUDIT_ACTIONS: AuditAction[] = [
  "CREATE",
  "UPDATE",
  "POST",
  "CANCEL",
  "PRINT",
  "EXPORT",
  "OVERRIDE",
  "CLEAR",
  "BOUNCE",
];

export interface IAuditLog extends Document {
  /** Collection or logical entity, e.g. "SalesDoc", "PaymentDoc", "Party". */
  entity: string;
  entityId: string;
  /** Human-facing reference, e.g. "INV/2026-27/0042". */
  entityRef?: string;
  action: AuditAction;
  actorId?: string;
  actorName?: string;
  /** ISO timestamp. */
  at: Date;
  reason?: string;
  beforeJson?: Record<string, unknown> | null;
  afterJson?: Record<string, unknown> | null;
  ip?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    entity: { type: String, required: true, index: true },
    entityId: { type: String, required: true, index: true },
    entityRef: { type: String, default: "" },
    action: { type: String, required: true, enum: AUDIT_ACTIONS, index: true },
    actorId: { type: String, default: "" },
    actorName: { type: String, default: "" },
    at: { type: Date, default: () => new Date(), index: true },
    reason: { type: String, default: "" },
    beforeJson: { type: Schema.Types.Mixed, default: null },
    afterJson: { type: Schema.Types.Mixed, default: null },
    ip: { type: String, default: "" },
  },
  { timestamps: true, collection: "audit_logs" },
);

AuditLogSchema.index({ entity: 1, entityId: 1, at: -1 });
AuditLogSchema.index({ at: -1 });

export const AuditLogModel =
  (mongoose.models["AuditLog"] as mongoose.Model<IAuditLog>) ??
  mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);
