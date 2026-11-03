import mongoose, { ClientSession } from 'mongoose';

let transactionsSupported: boolean | null = null;

export async function mongodbSupportsTransactions(): Promise<boolean> {
  if (transactionsSupported !== null) return transactionsSupported;
  try {
    const db = mongoose.connection.db;
    if (!db) {
      transactionsSupported = false;
      return false;
    }
    const hello = await db.admin().command({ hello: 1 });
    const doc = hello as { setName?: string; msg?: string };
    transactionsSupported = Boolean(doc.setName) || doc.msg === 'isdbgrid';
  } catch {
    transactionsSupported = false;
  }
  return transactionsSupported;
}

export async function withOptionalTransaction<T>(
  work: (session: ClientSession | null) => Promise<T>,
): Promise<T> {
  if (!(await mongodbSupportsTransactions())) {
    return work(null);
  }

  const session = await mongoose.startSession();
  try {
    let result!: T;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

export function withSession(session: ClientSession | null): { session?: ClientSession } {
  return session ? { session } : {};
}
