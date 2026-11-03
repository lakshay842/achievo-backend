import { HydratedDocument, Model, Schema, Types, model, models } from 'mongoose';

export interface IAIConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
}

export interface IAIConversation {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  conversationId: string;
  goalId?: Types.ObjectId | null;
  taskId?: Types.ObjectId | null;
  purpose: string;
  messages: IAIConversationMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export type AIConversationDocument = HydratedDocument<IAIConversation>;

const aiConversationMessageSchema = new Schema<IAIConversationMessage>(
  {
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true, maxlength: 8000 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const aiConversationSchema = new Schema<IAIConversation>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    conversationId: { type: String, required: true, index: true },
    goalId: { type: Schema.Types.ObjectId, ref: 'Goal', default: null },
    taskId: { type: Schema.Types.ObjectId, ref: 'Task', default: null },
    purpose: { type: String, default: 'chat', maxlength: 40 },
    messages: { type: [aiConversationMessageSchema], default: [] },
  },
  { timestamps: true },
);

aiConversationSchema.index({ userId: 1, conversationId: 1 }, { unique: true });

export const AIConversationModel: Model<IAIConversation> =
  models.AIConversation || model<IAIConversation>('AIConversation', aiConversationSchema);
