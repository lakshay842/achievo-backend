import mongoose from 'mongoose';
import { env } from './env';
import { logger } from '../utils/logger';
import '../database/register-models';

let eventsBound = false;

function bindConnectionEvents(): void {
  if (eventsBound) return;
  eventsBound = true;

  mongoose.connection.on('connected', () => {
    logger.info('MongoDB connected');
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });

  mongoose.connection.on('reconnected', () => {
    logger.info('MongoDB reconnected');
  });

  mongoose.connection.on('error', (err: Error) => {
    logger.error({ message: err.message }, 'MongoDB connection error');
  });
}

export async function connectDatabase(): Promise<typeof mongoose> {
  bindConnectionEvents();

  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  try {
    await mongoose.connect(env.mongodbUri, {
      serverSelectionTimeoutMS: 10_000,
      maxPoolSize: 10,
    });
    await cleanupLegacyAiConversations();
    await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).init()));
    return mongoose;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown database error';
    logger.error({ message: redactConnectionString(message) }, 'MongoDB connection failed');
    throw new Error('Failed to connect to MongoDB');
  }
}

/** Old chat storage wrote one document per message; the new schema keeps one doc per conversation. */
async function cleanupLegacyAiConversations(): Promise<void> {
  const db = mongoose.connection.db;
  if (!db) return;

  const collection = db.collection('aiconversations');
  const exists = await db.listCollections({ name: 'aiconversations' }).hasNext();
  if (!exists) return;

  const legacyFilter = {
    $or: [{ role: { $exists: true } }, { content: { $exists: true } }, { messages: { $exists: false } }],
  };
  const legacyCount = await collection.countDocuments(legacyFilter);
  if (legacyCount === 0) return;

  const result = await collection.deleteMany(legacyFilter);
  logger.warn(
    { deletedCount: result.deletedCount },
    'Removed legacy AI conversation message documents before unique index sync',
  );
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState === 0) return;
  await mongoose.connection.close();
  logger.info('MongoDB connection closed');
}

export function redactConnectionString(value: string): string {
  return value.replace(/mongodb(?:\+srv)?:\/\/[^\s]+/gi, 'mongodb://[redacted]');
}
