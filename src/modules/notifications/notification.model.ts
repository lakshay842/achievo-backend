import { HydratedDocument, Model, Schema, Types, model, models } from 'mongoose';

export const NOTIFICATION_TYPES = [
  'daily_reminder',
  'task_reminder',
  'motivation',
  'milestone_celebration',
  'missed_task',
  'deadline_reminder',
  'test',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_STATUSES = ['pending', 'sent', 'failed', 'skipped'] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

export interface IDeliveryAttempt {
  at: Date;
  status: NotificationStatus;
  error?: string;
}

export interface INotification {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  type: NotificationType;
  title: string;
  body: string;
  status: NotificationStatus;
  dedupeKey: string;
  scheduledFor: Date;
  sentAt?: Date | null;
  attempts: IDeliveryAttempt[];
  data?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export type NotificationDocument = HydratedDocument<INotification>;

const attemptSchema = new Schema<IDeliveryAttempt>(
  {
    at: { type: Date, required: true },
    status: { type: String, enum: NOTIFICATION_STATUSES, required: true },
    error: { type: String },
  },
  { _id: false },
);

const notificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true, maxlength: 120 },
    body: { type: String, required: true, maxlength: 500 },
    status: { type: String, enum: NOTIFICATION_STATUSES, default: 'pending', index: true },
    dedupeKey: { type: String, required: true },
    scheduledFor: { type: Date, required: true, index: true },
    sentAt: { type: Date, default: null },
    attempts: { type: [attemptSchema], default: [] },
    data: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

notificationSchema.index({ userId: 1, dedupeKey: 1 }, { unique: true });
notificationSchema.index({ status: 1, scheduledFor: 1 });
notificationSchema.index({ userId: 1, createdAt: -1 });

export const NotificationModel: Model<INotification> =
  models.Notification || model<INotification>('Notification', notificationSchema);
