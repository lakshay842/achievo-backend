import { HydratedDocument, Model, Schema, Types, model, models } from 'mongoose';

export const TASK_STATUSES = [
  'pending',
  'in_progress',
  'completed',
  'skipped',
  'missed',
  'superseded',
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ['low', 'medium', 'high'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export interface ITask {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  goalId: Types.ObjectId;
  roadmapId: Types.ObjectId;
  milestoneId: Types.ObjectId;
  day: number;
  taskDate?: string;
  scheduledDate?: Date | null;
  title: string;
  durationMinutes: number;
  priority: TaskPriority;
  instructions: string[];
  completionCriteria: string[];
  status: TaskStatus;
  isActive: boolean;
  startedAt?: Date | null;
  completedAt?: Date | null;
  difficultyFeedback?: 'easy' | 'moderate' | 'hard';
  feedbackNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type TaskDocument = HydratedDocument<ITask>;

const taskSchema = new Schema<ITask>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    goalId: { type: Schema.Types.ObjectId, ref: 'Goal', required: true, index: true },
    roadmapId: { type: Schema.Types.ObjectId, ref: 'Roadmap', required: true, index: true },
    milestoneId: { type: Schema.Types.ObjectId, ref: 'Milestone', required: true, index: true },
    day: { type: Number, required: true, min: 1 },
    taskDate: { type: String, index: true },
    scheduledDate: { type: Date, default: null },
    title: { type: String, required: true, maxlength: 200 },
    durationMinutes: { type: Number, required: true, min: 10, max: 480 },
    priority: { type: String, enum: TASK_PRIORITIES, default: 'medium' },
    instructions: { type: [String], default: [] },
    completionCriteria: { type: [String], default: [] },
    status: { type: String, enum: TASK_STATUSES, default: 'pending', index: true },
    isActive: { type: Boolean, default: false, index: true },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    difficultyFeedback: { type: String, enum: ['easy', 'moderate', 'hard'] },
    feedbackNote: { type: String, maxlength: 1000 },
  },
  { timestamps: true },
);

taskSchema.index({ userId: 1, taskDate: 1, status: 1 });
taskSchema.index({ userId: 1, isActive: 1, taskDate: 1, status: 1 });
taskSchema.index({ goalId: 1, status: 1 });

export const TaskModel: Model<ITask> = models.Task || model<ITask>('Task', taskSchema);
