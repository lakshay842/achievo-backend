import { HydratedDocument, Model, Schema, Types, model, models } from 'mongoose';

export const PROGRESS_TYPES = ['start', 'complete', 'skip', 'reschedule', 'feedback'] as const;
export type ProgressType = (typeof PROGRESS_TYPES)[number];

export interface ITaskProgress {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  taskId: Types.ObjectId;
  goalId: Types.ObjectId;
  type: ProgressType;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export type TaskProgressDocument = HydratedDocument<ITaskProgress>;

const taskProgressSchema = new Schema<ITaskProgress>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    taskId: { type: Schema.Types.ObjectId, ref: 'Task', required: true, index: true },
    goalId: { type: Schema.Types.ObjectId, ref: 'Goal', required: true, index: true },
    type: { type: String, enum: PROGRESS_TYPES, required: true },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

taskProgressSchema.index(
  { taskId: 1, type: 1 },
  { unique: true, partialFilterExpression: { type: 'complete' } },
);

export const TaskProgressModel: Model<ITaskProgress> =
  models.TaskProgress || model<ITaskProgress>('TaskProgress', taskProgressSchema);
