import { describe, expect, it } from 'vitest';
import { api, authHeader, registerUser } from './helpers';

describe('authentication', () => {
  it('registers, logs in, refreshes, and rejects reused refresh tokens', async () => {
    const email = 'learner@achievo.test';
    const registered = await registerUser(email);
    expect(registered.status).toBe(201);
    expect(registered.body.data.user.email).toBe(email);
    expect(registered.body.data.user.passwordHash).toBeUndefined();
    expect(registered.body.data.accessToken).toBeTruthy();
    expect(JSON.stringify(registered.body)).not.toContain('passwordHash');

    const me = await api().get('/api/v1/auth/me').set(authHeader(registered.body.data.accessToken));
    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe(email);

    const login = await api().post('/api/v1/auth/login').send({ email, password: 'Password123!' });
    expect(login.status).toBe(200);
    const firstRefresh = login.body.data.refreshToken as string;

    const rotated = await api().post('/api/v1/auth/refresh').send({ refreshToken: firstRefresh });
    expect(rotated.status).toBe(200);
    const secondRefresh = rotated.body.data.refreshToken as string;

    const rotatedAgain = await api().post('/api/v1/auth/refresh').send({ refreshToken: secondRefresh });
    expect(rotatedAgain.status).toBe(200);

    const reused = await api().post('/api/v1/auth/refresh').send({ refreshToken: secondRefresh });
    expect(reused.status).toBe(401);

    const familyRevoked = await api()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: rotatedAgain.body.data.refreshToken });
    expect(familyRevoked.status).toBe(401);
  });

  it('logs out a refresh session', async () => {
    const registered = await registerUser('logout@achievo.test');
    const accessToken = registered.body.data.accessToken as string;
    const refreshToken = registered.body.data.refreshToken as string;

    const logout = await api().post('/api/v1/auth/logout').set(authHeader(accessToken)).send({ refreshToken });
    expect(logout.status).toBe(200);

    const refresh = await api().post('/api/v1/auth/refresh').send({ refreshToken });
    expect(refresh.status).toBe(401);
  });

  it('rejects a bad login and resets a password outside production', async () => {
    await registerUser('reset@achievo.test');
    const badLogin = await api().post('/api/v1/auth/login').send({
      email: 'reset@achievo.test',
      password: 'wrong-password',
    });
    expect(badLogin.status).toBe(401);

    const forgot = await api().post('/api/v1/auth/forgot-password').send({ email: 'reset@achievo.test' });
    expect(forgot.status).toBe(200);
    expect(forgot.body.data.resetToken).toBeTruthy();

    const reset = await api().post('/api/v1/auth/reset-password').send({
      token: forgot.body.data.resetToken,
      password: 'NewPassword123!',
    });
    expect(reset.status).toBe(200);

    const login = await api().post('/api/v1/auth/login').send({
      email: 'reset@achievo.test',
      password: 'NewPassword123!',
    });
    expect(login.status).toBe(200);
  });
});
