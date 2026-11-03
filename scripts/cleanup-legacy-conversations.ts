import mongoose from 'mongoose';
import { env } from '../src/config/env';

async function main() {
  await mongoose.connect(env.mongodbUri, { serverSelectionTimeoutMS: 10_000 });
  const db = mongoose.connection.db;
  if (!db) throw new Error('No database connection');

  const collection = db.collection('aiconversations');
  const exists = await db.listCollections({ name: 'aiconversations' }).hasNext();
  if (!exists) {
    console.log('aiconversations collection not found');
    await mongoose.disconnect();
    return;
  }

  const legacyFilter = {
    $or: [{ role: { $exists: true } }, { content: { $exists: true } }, { messages: { $exists: false } }],
  };
  const before = await collection.countDocuments(legacyFilter);
  const result = await collection.deleteMany(legacyFilter);
  console.log(`Deleted ${result.deletedCount} legacy conversation docs (matched ${before})`);
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
