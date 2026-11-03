import request from 'supertest';
import { app } from '../src/app';

export function api() {
  return request(app);
}

export async function registerUser(email = `user-${Date.now()}@achievo.test`) {
  const response = await api().post('/api/v1/auth/register').send({
    name: 'Test User',
    email,
    password: 'Password123!',
    timezone: 'UTC',
  });
  return response;
}

export function authHeader(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` };
}
