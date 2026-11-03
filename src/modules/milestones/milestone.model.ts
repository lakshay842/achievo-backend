import { HydratedDocument, Model, Schema, Types, model, models } from 'mongoose';

export const MILESTONE_STATUSES = ['pending', 'active', 'completed'] as const;
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];

export interface IMilestone {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  goalId: Types.ObjectId;
  roadmapId: Types.ObjectId;
  title: string;
  description: string;
  sequence: number;
  status: MilestoneStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type MilestoneDocument = HydratedDocument<IMilestone>;

const milestoneSchema = new Schema<IMilestone>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    goalId: { type: Schema.Types.ObjectId, ref: 'Goal', required: true, index: true },
    roadmapId: { type: Schema.Types.ObjectId, ref: 'Roadmap', required: true, index: true },
    title: { type: String, required: true, maxlength: 200 },
    description: { type: String, default: '', maxlength: 1000 },
    sequence: { type: Number, required: true, min: 1 },
    status: { type: String, enum: MILESTONE_STATUSES, default: 'pending' },
  },
  { timestamps: true },
);

milestoneSchema.index({ roadmapId: 1, sequence: 1 });

export const MilestoneModel: Model<IMilestone> =
  models.Milestone || model<IMilestone>('Milestone', milestoneSchema);
