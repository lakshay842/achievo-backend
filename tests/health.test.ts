import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';
import { api } from './helpers';

describe('health and database', () => {
  it('connects to MongoDB and reports health', async () => {
    expect(mongoose.connection.readyState).toBe(1);
    const ping = await mongoose.connection.db?.command({ ping: 1 });
    expect(ping?.ok).toBe(1);

    const response = await api().get('/health');
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.database).toBe('connected');
    expect(response.body.data.status).toBe('ok');
  });
});
