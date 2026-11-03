import { HydratedDocument, Model, Schema, Types, model, models } from 'mongoose';

export const ROADMAP_STATUSES = ['draft', 'approved', 'superseded'] as const;
export type RoadmapStatus = (typeof ROADMAP_STATUSES)[number];

export interface IRoadmap {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  goalId: Types.ObjectId;
  version: number;
  status: RoadmapStatus;
  title: string;
  category: string;
  durationDays: number;
  dailyMinutes: number;
  source: 'gemini' | 'mock';
  startDate?: string;
  endDate?: string;
  approvedAt?: Date | null;
  supersededAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type RoadmapDocument = HydratedDocument<IRoadmap>;

const roadmapSchema = new Schema<IRoadmap>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    goalId: { type: Schema.Types.ObjectId, ref: 'Goal', required: true, index: true },
    version: { type: Number, required: true, min: 1 },
    status: { type: String, enum: ROADMAP_STATUSES, default: 'draft', index: true },
    title: { type: String, required: true, maxlength: 200 },
    category: { type: String, required: true, maxlength: 50 },
    durationDays: { type: Number, required: true, min: 1, max: 180 },
    dailyMinutes: { type: Number, required: true, min: 15, max: 480 },
    source: { type: String, enum: ['gemini', 'mock'], required: true },
    startDate: { type: String },
    endDate: { type: String },
    approvedAt: { type: Date, default: null },
    supersededAt: { type: Date, default: null },
  },
  { timestamps: true },
);

roadmapSchema.index({ goalId: 1, version: -1 });
roadmapSchema.index({ userId: 1, goalId: 1, status: 1 });

export const RoadmapModel: Model<IRoadmap> = models.Roadmap || model<IRoadmap>('Roadmap', roadmapSchema);
