import { HydratedDocument, Model, Schema, Types, model, models } from 'mongoose';

export const GOAL_STATUSES = ['draft', 'active', 'paused', 'completed', 'archived'] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];

export interface IGoal {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  title: string;
  description: string;
  category: string;
  status: GoalStatus;
  currentLevel: string;
  desiredOutcome: string;
  availableMinutesPerDay: number;
  durationDays: number;
  startDate?: string;
  targetDate?: string;
  progressPercent: number;
  activeRoadmapId?: Types.ObjectId | null;
  pausedAt?: Date | null;
  archivedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type GoalDocument = HydratedDocument<IGoal>;

const goalSchema = new Schema<IGoal>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: '', maxlength: 4000 },
    category: { type: String, default: 'personal', maxlength: 50 },
    status: { type: String, enum: GOAL_STATUSES, default: 'draft', index: true },
    currentLevel: { type: String, default: '', maxlength: 200 },
    desiredOutcome: { type: String, default: '', maxlength: 2000 },
    availableMinutesPerDay: { type: Number, required: true, min: 15, max: 480 },
    durationDays: { type: Number, required: true, min: 1, max: 180 },
    startDate: { type: String },
    targetDate: { type: String },
    progressPercent: { type: Number, default: 0, min: 0, max: 100 },
    activeRoadmapId: { type: Schema.Types.ObjectId, ref: 'Roadmap', default: null },
    pausedAt: { type: Date, default: null },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

goalSchema.index({ userId: 1, status: 1, createdAt: -1 });

export const GoalModel: Model<IGoal> = models.Goal || model<IGoal>('Goal', goalSchema);
