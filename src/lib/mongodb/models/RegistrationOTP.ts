import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface IRegistrationOTP extends Document {
    email: string;
    otpHash: string;
    registrationData: Record<string, unknown>;
    expiresAt: Date;
    attempts: number;
    lastSentAt: Date;
    verified: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const RegistrationOTPSchema = new Schema<IRegistrationOTP>(
    {
        email: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
            index: true,
        },

        otpHash: {
            type: String,
            required: true,
        },

        registrationData: {
            type: Schema.Types.Mixed,
            required: true,
        },

        expiresAt: {
            type: Date,
            required: true,
            index: true,
        },

        attempts: {
            type: Number,
            default: 0,
        },

        lastSentAt: {
            type: Date,
            required: true,
        },

        verified: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
    }
);

// Automatically remove expired OTP documents from MongoDB
RegistrationOTPSchema.index(
    { expiresAt: 1 },
    { expireAfterSeconds: 0 }
);

// Reuse existing model during Vite/TanStack development
export const RegistrationOTP: Model<IRegistrationOTP> =
    mongoose.models["RegistrationOTP"] ||
    mongoose.model<IRegistrationOTP>(
        "RegistrationOTP",
        RegistrationOTPSchema
    );