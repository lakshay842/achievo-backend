import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach } from 'vitest';
import { connectDatabase, disconnectDatabase } from '../src/config/database';

beforeAll(async () => {
  await connectDatabase();
});

beforeEach(async () => {
  const db = mongoose.connection.db;
  if (!db) return;
  const collections = await db.collections();
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
});

afterAll(async () => {
  await disconnectDatabase();
});
