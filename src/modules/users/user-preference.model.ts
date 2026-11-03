import { HydratedDocument, Model, Schema, Types, model, models } from 'mongoose';

export interface IUserPreference {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  notificationsEnabled: boolean;
  dailyReminder: boolean;
  dailyReminderTime: string;
  taskReminder: boolean;
  motivation: boolean;
  milestoneCelebration: boolean;
  missedTask: boolean;
  deadlineReminder: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type UserPreferenceDocument = HydratedDocument<IUserPreference>;

const userPreferenceSchema = new Schema<IUserPreference>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    notificationsEnabled: { type: Boolean, default: true },
    dailyReminder: { type: Boolean, default: true },
    dailyReminderTime: { type: String, default: '08:00' },
    taskReminder: { type: Boolean, default: true },
    motivation: { type: Boolean, default: true },
    milestoneCelebration: { type: Boolean, default: true },
    missedTask: { type: Boolean, default: true },
    deadlineReminder: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const UserPreferenceModel: Model<IUserPreference> =
  models.UserPreference || model<IUserPreference>('UserPreference', userPreferenceSchema);
