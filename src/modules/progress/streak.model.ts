import { HydratedDocument, Model, Schema, Types, model, models } from 'mongoose';

export interface IUserStreak {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  currentStreak: number;
  longestStreak: number;
  lastActiveDate?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type UserStreakDocument = HydratedDocument<IUserStreak>;

const userStreakSchema = new Schema<IUserStreak>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    currentStreak: { type: Number, default: 0, min: 0 },
    longestStreak: { type: Number, default: 0, min: 0 },
    lastActiveDate: { type: String },
  },
  { timestamps: true },
);

export const UserStreakModel: Model<IUserStreak> =
  models.UserStreak || model<IUserStreak>('UserStreak', userStreakSchema);
