import { HydratedDocument, Model, Schema, Types, model, models } from 'mongoose';

export interface IDeviceToken {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  token: string;
  platform: 'ios' | 'android' | 'unknown';
  invalid: boolean;
  invalidReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type DeviceTokenDocument = HydratedDocument<IDeviceToken>;

const deviceTokenSchema = new Schema<IDeviceToken>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    token: { type: String, required: true, unique: true },
    platform: { type: String, enum: ['ios', 'android', 'unknown'], default: 'unknown' },
    invalid: { type: Boolean, default: false, index: true },
    invalidReason: { type: String },
  },
  { timestamps: true },
);

export const DeviceTokenModel: Model<IDeviceToken> =
  models.DeviceToken || model<IDeviceToken>('DeviceToken', deviceTokenSchema);
