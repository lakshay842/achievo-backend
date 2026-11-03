import { HydratedDocument, Model, Schema, Types, model, models } from 'mongoose';

export interface IGoalEvent {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  goalId: Types.ObjectId;
  type: string;
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export type GoalEventDocument = HydratedDocument<IGoalEvent>;

const goalEventSchema = new Schema<IGoalEvent>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    goalId: { type: Schema.Types.ObjectId, ref: 'Goal', required: true, index: true },
    type: { type: String, required: true, maxlength: 80 },
    message: { type: String, required: true, maxlength: 500 },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

goalEventSchema.index({ goalId: 1, createdAt: -1 });

export const GoalEventModel: Model<IGoalEvent> =
  models.GoalEvent || model<IGoalEvent>('GoalEvent', goalEventSchema);
