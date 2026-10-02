import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface IRegistrationOTP extends Document {
    email: string;
    otpHash: string;
    registrationData: Record<string, unknown>;
    expiresAt: Date;
    attempts: number;
    lastSentAt: Date;
    verified: boolean;
    sendCount: number;
    windowStartedAt: Date;
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

        // Send-rate limiting: sendCount codes issued since windowStartedAt
        sendCount: {
            type: Number,
            default: 0,
        },

        windowStartedAt: {
            type: Date,
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