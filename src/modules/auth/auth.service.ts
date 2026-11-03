import argon2 from 'argon2';
import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../../config/env';
import { ApiError } from '../../utils/ApiError';
import { randomToken, sha256 } from '../../utils/tokens';
import { UserModel, UserDocument } from '../users/user.model';
import { UserPreferenceModel } from '../users/user-preference.model';
import { UserStreakModel } from '../progress/streak.model';
import { toPublicUser } from '../users/user.service';
import { LoginInput, RegisterInput } from './auth.validation';

const RESET_WINDOW_MS = 30 * 60 * 1000;

interface RefreshPayload extends jwt.JwtPayload {
  sub: string;
  type: 'refresh';
  jti: string;
}

export async function register(input: RegisterInput) {
  const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
  try {
    const user = await UserModel.create({
      name: input.name,
      email: input.email,
      passwordHash,
      timezone: input.timezone ?? 'UTC',
    });
    await UserPreferenceModel.create({ userId: user._id });
    await UserStreakModel.create({ userId: user._id, currentStreak: 0, longestStreak: 0 });
    const tokens = await issueTokenPair(user.id);
    return { user: toPublicUser(user), ...tokens };
  } catch (error) {
    if (isDuplicateKey(error)) {
      throw new ApiError(409, 'Email is already registered');
    }
    throw error;
  }
}

export async function login(input: LoginInput) {
  const user = await UserModel.findOne({ email: input.email }).select('+passwordHash');
  if (!user || user.status !== 'active') {
    throw new ApiError(401, 'Invalid email or password');
  }
  const matches = await argon2.verify(user.passwordHash, input.password);
  if (!matches) {
    throw new ApiError(401, 'Invalid email or password');
  }
  const tokens = await issueTokenPair(user.id);
  return { user: toPublicUser(user), ...tokens };
}

export async function logout(userId: string, refreshToken: string) {
  const payload = verifyRefresh(refreshToken);
  if (payload.sub !== userId) {
    throw new ApiError(401, 'Invalid refresh token');
  }
  const user = await UserModel.findById(userId).select('+refreshSessions');
  if (!user) throw new ApiError(401, 'Invalid refresh token');
  const session = user.refreshSessions.find((item) => item.jti === payload.jti);
  if (!session || session.tokenHash !== sha256(refreshToken)) {
    throw new ApiError(401, 'Invalid refresh token');
  }
  session.revokedAt = new Date();
  await user.save();
}

export async function refresh(refreshToken: string) {
  const payload = verifyRefresh(refreshToken);
  const user = await UserModel.findById(payload.sub).select('+refreshSessions');
  if (!user || user.status !== 'active') {
    throw new ApiError(401, 'Invalid refresh token');
  }

  const session = user.refreshSessions.find((item) => item.jti === payload.jti);
  if (!session || session.tokenHash !== sha256(refreshToken)) {
    await revokeAllSessions(user);
    throw new ApiError(401, 'Refresh token is no longer valid');
  }

  if (session.revokedAt || session.replacedByJti) {
    await revokeAllSessions(user);
    throw new ApiError(401, 'Refresh token reuse detected');
  }

  if (session.expiresAt.getTime() <= Date.now()) {
    throw new ApiError(401, 'Refresh token expired');
  }

  session.revokedAt = new Date();
  const next = appendSession(user);
  session.replacedByJti = next.jti;
  await user.save();

  return {
    accessToken: signAccess(user.id),
    refreshToken: next.refreshToken,
  };
}

export async function me(userId: string) {
  const user = await UserModel.findById(userId);
  if (!user) throw new ApiError(401, 'User not found');
  return toPublicUser(user);
}

export async function forgotPassword(email: string) {
  const user = await UserModel.findOne({ email }).select('+passwordResetTokenHash +passwordResetExpiresAt');
  if (!user) {
    return { delivered: true as const };
  }
  const resetToken = randomToken(32);
  user.passwordResetTokenHash = sha256(resetToken);
  user.passwordResetExpiresAt = new Date(Date.now() + RESET_WINDOW_MS);
  await user.save();
  return {
    delivered: true as const,
    ...(env.isProduction ? {} : { resetToken }),
  };
}

export async function resetPassword(token: string, password: string) {
  const user = await UserModel.findOne({
    passwordResetTokenHash: sha256(token),
    passwordResetExpiresAt: { $gt: new Date() },
  }).select('+passwordHash +passwordResetTokenHash +passwordResetExpiresAt +refreshSessions');

  if (!user) {
    throw new ApiError(400, 'Reset token is invalid or expired');
  }

  user.passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpiresAt = null;
  const now = new Date();
  for (const session of user.refreshSessions) {
    session.revokedAt = session.revokedAt ?? now;
  }
  await user.save();
}

async function issueTokenPair(userId: string) {
  const user = await UserModel.findById(userId).select('+refreshSessions');
  if (!user) throw new ApiError(401, 'User not found');
  const session = appendSession(user);
  await user.save();
  return {
    accessToken: signAccess(userId),
    refreshToken: session.refreshToken,
  };
}

function appendSession(user: UserDocument) {
  const jti = randomToken(16);
  const refreshToken = jwt.sign({ sub: user.id, type: 'refresh', jti }, env.jwtRefreshSecret, {
    expiresIn: env.jwtRefreshTtl as SignOptions['expiresIn'],
  });
  const decoded = jwt.decode(refreshToken) as { exp?: number } | null;
  const expiresAt = new Date((decoded?.exp ?? Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60) * 1000);
  const now = Date.now();
  const active = user.refreshSessions.filter((session) => session.expiresAt.getTime() > now);
  const trimmed = active.length >= 20 ? active.slice(active.length - 19) : active;
  trimmed.push({
    jti,
    tokenHash: sha256(refreshToken),
    expiresAt,
    revokedAt: null,
    replacedByJti: null,
    createdAt: new Date(),
  });
  user.refreshSessions = trimmed;
  user.markModified('refreshSessions');
  return { jti, refreshToken };
}

function signAccess(userId: string) {
  return jwt.sign({ sub: userId, type: 'access' }, env.jwtAccessSecret, {
    expiresIn: env.jwtAccessTtl as SignOptions['expiresIn'],
  });
}

function verifyRefresh(refreshToken: string): RefreshPayload {
  try {
    const payload = jwt.verify(refreshToken, env.jwtRefreshSecret) as RefreshPayload;
    if (payload.type !== 'refresh' || typeof payload.sub !== 'string' || typeof payload.jti !== 'string') {
      throw new ApiError(401, 'Invalid refresh token');
    }
    return payload;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(401, 'Invalid or expired refresh token');
  }
}

async function revokeAllSessions(user: UserDocument) {
  const now = new Date();
  for (const session of user.refreshSessions) {
    session.revokedAt = session.revokedAt ?? now;
  }
  user.markModified('refreshSessions');
  await user.save();
}

function isDuplicateKey(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: number }).code === 11000;
}
