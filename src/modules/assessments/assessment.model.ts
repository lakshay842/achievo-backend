import { HydratedDocument, Model, Schema, Types, model, models } from 'mongoose';

export interface IClarificationQuestion {
  id: string;
  question: string;
  answer?: string;
}

export interface IAssessment {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  goalId: Types.ObjectId;
  category: string;
  currentLevel: string;
  desiredOutcome: string;
  availableTimeMinutes: number;
  missingInformation: string[];
  clarificationQuestions: IClarificationQuestion[];
  summary: string;
  status: 'needs_clarification' | 'ready';
  createdAt: Date;
  updatedAt: Date;
}

export type AssessmentDocument = HydratedDocument<IAssessment>;

const questionSchema = new Schema<IClarificationQuestion>(
  {
    id: { type: String, required: true },
    question: { type: String, required: true, maxlength: 300 },
    answer: { type: String, maxlength: 2000 },
  },
  { _id: false },
);

const assessmentSchema = new Schema<IAssessment>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    goalId: { type: Schema.Types.ObjectId, ref: 'Goal', required: true, unique: true, index: true },
    category: { type: String, required: true, maxlength: 50 },
    currentLevel: { type: String, default: '', maxlength: 200 },
    desiredOutcome: { type: String, default: '', maxlength: 2000 },
    availableTimeMinutes: { type: Number, required: true, min: 15, max: 480 },
    missingInformation: { type: [String], default: [] },
    clarificationQuestions: { type: [questionSchema], default: [] },
    summary: { type: String, default: '', maxlength: 2000 },
    status: { type: String, enum: ['needs_clarification', 'ready'], default: 'needs_clarification' },
  },
  { timestamps: true },
);

export const AssessmentModel: Model<IAssessment> =
  models.Assessment || model<IAssessment>('Assessment', assessmentSchema);
