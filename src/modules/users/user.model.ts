import { HydratedDocument, Model, Schema, Types, model, models } from 'mongoose';

export interface IRefreshSession {
  jti: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt?: Date | null;
  replacedByJti?: string | null;
  createdAt: Date;
}

export interface IUser {
  _id: Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  timezone: string;
  status: 'active' | 'disabled';
  passwordResetTokenHash?: string;
  passwordResetExpiresAt?: Date | null;
  refreshSessions: IRefreshSession[];
  createdAt: Date;
  updatedAt: Date;
}

export type UserDocument = HydratedDocument<IUser>;

const refreshSessionSchema = new Schema<IRefreshSession>(
  {
    jti: { type: String, required: true },
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    replacedByJti: { type: String, default: null },
    createdAt: { type: Date, default: () => new Date() },
  },
  { _id: false },
);

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    passwordHash: { type: String, required: true, select: false },
    timezone: { type: String, required: true, default: 'UTC' },
    status: { type: String, enum: ['active', 'disabled'], default: 'active' },
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpiresAt: { type: Date, select: false },
    refreshSessions: { type: [refreshSessionSchema], select: false, default: [] },
  },
  { timestamps: true },
);

export const UserModel: Model<IUser> = models.User || model<IUser>('User', userSchema);
