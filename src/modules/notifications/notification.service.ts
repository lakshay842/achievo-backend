import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import { Types } from 'mongoose';
import { env } from '../../config/env';
import { ApiError } from '../../utils/ApiError';
import { addDays, localParts } from '../../utils/dates';
import { getPagination, pageMeta } from '../../utils/pagination';
import { logger } from '../../utils/logger';
import { motivationForUser } from '../ai/services/motivation.service';
import { GoalModel } from '../goals/goal.model';
import { reconcileMissedTasks } from '../progress/progress.service';
import { TaskModel } from '../tasks/task.model';
import { UserModel } from '../users/user.model';
import { UserPreferenceModel } from '../users/user-preference.model';
import { DeviceTokenModel } from './device-token.model';
import { INotification, NotificationModel, NotificationType } from './notification.model';

const expo = new Expo();

export async function registerDeviceToken(
  userId: string,
  token: string,
  platform: 'ios' | 'android' | 'unknown',
) {
  if (!Expo.isExpoPushToken(token)) {
    throw new ApiError(400, 'Invalid Expo push token');
  }
  const existing = await DeviceTokenModel.findOne({ token });
  if (existing) {
    existing.userId = new Types.ObjectId(userId);
    existing.platform = platform;
    existing.invalid = false;
    existing.invalidReason = undefined;
    await existing.save();
    return toTokenDto(existing.token, existing.platform, existing.invalid);
  }
  const created = await DeviceTokenModel.create({ userId, token, platform, invalid: false });
  return toTokenDto(created.token, created.platform, created.invalid);
}

export async function listNotifications(userId: string, query: { page?: number; limit?: number }) {
  const { page, limit, skip } = getPagination(query);
  const [items, total] = await Promise.all([
    NotificationModel.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit),
    NotificationModel.countDocuments({ userId }),
  ]);
  return { items: items.map(toNotificationDto), meta: pageMeta(total, page, limit) };
}

export async function updatePreferences(
  userId: string,
  input: Partial<{
    notificationsEnabled: boolean;
    dailyReminder: boolean;
    dailyReminderTime: string;
    taskReminder: boolean;
    motivation: boolean;
    milestoneCelebration: boolean;
    missedTask: boolean;
    deadlineReminder: boolean;
  }>,
) {
  const preferences = await UserPreferenceModel.findOneAndUpdate(
    { userId },
    { $set: input, $setOnInsert: { userId } },
    { upsert: true, new: true },
  );
  return {
    notificationsEnabled: preferences.notificationsEnabled,
    dailyReminder: preferences.dailyReminder,
    dailyReminderTime: preferences.dailyReminderTime,
    taskReminder: preferences.taskReminder,
    motivation: preferences.motivation,
    milestoneCelebration: preferences.milestoneCelebration,
    missedTask: preferences.missedTask,
    deadlineReminder: preferences.deadlineReminder,
  };
}

export async function sendTestNotification(userId: string) {
  const notification = await enqueueNotification({
    userId,
    type: 'test',
    title: 'ACHIEVO test',
    body: 'Notifications are connected for this device.',
    dedupeKey: `test:${userId}:${Date.now()}`,
  });
  await dispatchPendingNotifications();
  const fresh = notification ? await NotificationModel.findById(notification._id) : null;
  return fresh ? toNotificationDto(fresh) : null;
}

export async function sendMotivationPush(userId: string) {
  const preferences = await UserPreferenceModel.findOne({ userId });
  if (preferences && preferences.notificationsEnabled === false) {
    throw new ApiError(400, 'Notifications are disabled for this account');
  }

  const motivation = await motivationForUser(userId);
  const notification = await enqueueNotification({
    userId,
    type: 'motivation',
    title: motivationTitle(motivation.tone),
    body: motivation.message.slice(0, 500),
    dedupeKey: `motivation:manual:${userId}:${Date.now()}`,
    data: { screen: 'coach', tone: motivation.tone },
  });
  await dispatchPendingNotifications();
  const fresh = notification ? await NotificationModel.findById(notification._id) : null;
  return fresh ? toNotificationDto(fresh) : null;
}

export async function enqueueNotification(input: {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  dedupeKey: string;
  scheduledFor?: Date;
  data?: Record<string, unknown>;
}) {
  try {
    return await NotificationModel.create({
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      dedupeKey: input.dedupeKey,
      scheduledFor: input.scheduledFor ?? new Date(),
      status: 'pending',
      attempts: [],
      data: input.data,
    });
  } catch (error) {
    if (isDuplicate(error)) return null;
    throw error;
  }
}

export async function processDueNotifications(now = new Date()) {
  const users = await UserModel.find({ status: 'active' });
  let created = 0;

  for (const user of users) {
    const preferences = await UserPreferenceModel.findOne({ userId: user._id });
    if (!preferences?.notificationsEnabled) continue;
    await reconcileMissedTasks(user.id, user.timezone, now);
    const local = localParts(user.timezone, now);
    if (local.time < preferences.dailyReminderTime) continue;

    const tasks = await TaskModel.find({
      userId: user._id,
      taskDate: local.date,
      isActive: true,
      status: { $in: ['pending', 'in_progress'] },
    })
      .limit(3)
      .sort({ priority: -1 });

    if (preferences.dailyReminder || preferences.taskReminder) {
      const taskLine = tasks.length
        ? `Today: ${tasks.map((task) => task.title).join(', ')}.`
        : 'No open tasks are scheduled today.';
      const createdDaily = await enqueueNotification({
        userId: user.id,
        type: 'daily_reminder',
        title: 'Your plan for today',
        body: taskLine.slice(0, 500),
        dedupeKey: `daily:${user.id}:${local.date}`,
        scheduledFor: now,
        data: { screen: 'home' },
      });
      if (createdDaily) created += 1;
    }

    if (preferences.motivation) {
      const motivation = await motivationForUser(user.id, now);
      const createdMotivation = await enqueueNotification({
        userId: user.id,
        type: 'motivation',
        title: motivationTitle(motivation.tone),
        body: motivation.message.slice(0, 500),
        dedupeKey: `motivation:${user.id}:${local.date}`,
        scheduledFor: now,
        data: { screen: 'coach', tone: motivation.tone },
      });
      if (createdMotivation) created += 1;
    }

    if (preferences.missedTask) {
      const yesterday = addDays(local.date, -1, user.timezone);
      const missed = await TaskModel.countDocuments({ userId: user._id, taskDate: yesterday, status: 'missed' });
      if (missed > 0) {
        const createdMissed = await enqueueNotification({
          userId: user.id,
          type: 'missed_task',
          title: 'A fresh start is ready',
          body: "Yesterday didn't go as planned. Let's restart with one small task.",
          dedupeKey: `missed:${user.id}:${local.date}`,
          scheduledFor: now,
        });
        if (createdMissed) created += 1;
      }
    }

    if (preferences.deadlineReminder) {
      const tomorrow = addDays(local.date, 1, user.timezone);
      const goals = await GoalModel.find({
        userId: user._id,
        status: 'active',
        targetDate: { $in: [local.date, tomorrow] },
      });
      for (const goal of goals) {
        const createdDeadline = await enqueueNotification({
          userId: user.id,
          type: 'deadline_reminder',
          title: 'Deadline coming up',
          body: `${goal.title} reaches its deadline on ${goal.targetDate}.`,
          dedupeKey: `deadline:${goal.id}:${local.date}`,
          data: { goalId: goal.id },
          scheduledFor: now,
        });
        if (createdDeadline) created += 1;
      }
    }
  }

  const dispatched = await dispatchPendingNotifications(now);
  return { created, sent: dispatched.sent };
}

export async function dispatchPendingNotifications(now = new Date()) {
  const pending = await NotificationModel.find({ status: 'pending', scheduledFor: { $lte: now } }).limit(100);
  let sent = 0;

  for (const notification of pending) {
    const delivered = await deliver(notification);
    if (delivered) sent += 1;
  }

  return { sent };
}

async function deliver(notification: INotification) {
  const doc = await NotificationModel.findById(notification._id);
  if (!doc || doc.status !== 'pending') return false;

  const tokens = await DeviceTokenModel.find({ userId: doc.userId, invalid: false });
  if (tokens.length === 0) {
    doc.status = 'skipped';
    doc.attempts.push({ at: new Date(), status: 'skipped', error: 'no_device' });
    await doc.save();
    return false;
  }

  for (const token of tokens) {
    if (!Expo.isExpoPushToken(token.token)) {
      token.invalid = true;
      token.invalidReason = 'invalid_format';
      await token.save();
    }
  }

  const valid = tokens.filter((token) => !token.invalid && Expo.isExpoPushToken(token.token));
  if (valid.length === 0) {
    doc.status = 'failed';
    doc.attempts.push({ at: new Date(), status: 'failed', error: 'invalid_device_token' });
    await doc.save();
    return false;
  }

  if (env.notificationsDryRun) {
    doc.status = 'sent';
    doc.sentAt = new Date();
    doc.attempts.push({ at: new Date(), status: 'sent', error: 'dry_run' });
    await doc.save();
    return true;
  }

  try {
    const channelId = channelForType(doc.type);
    const messages: ExpoPushMessage[] = valid.map((token) => ({
      to: token.token,
      title: doc.title,
      body: doc.body,
      sound: 'default',
      priority: doc.type === 'motivation' ? 'high' : 'default',
      channelId,
      data: {
        ...(doc.data ?? {}),
        type: doc.type,
        notificationId: doc.id,
      },
    }));
    const chunks = expo.chunkPushNotifications(messages);
    let offset = 0;
    for (const chunk of chunks) {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      tickets.forEach((ticket, index) => markTicket(valid[offset + index]?.token, ticket));
      offset += chunk.length;
    }
    doc.status = 'sent';
    doc.sentAt = new Date();
    doc.attempts.push({ at: new Date(), status: 'sent' });
    await doc.save();
    return true;
  } catch (error) {
    logger.warn({ notificationId: doc.id }, 'Push delivery failed');
    doc.status = 'failed';
    doc.attempts.push({
      at: new Date(),
      status: 'failed',
      error: error instanceof Error ? error.message.slice(0, 180) : 'delivery_failed',
    });
    await doc.save();
    return false;
  }
}

function markTicket(token: string | undefined, ticket: ExpoPushTicket) {
  if (!token || ticket.status !== 'error') return;
  if (ticket.details?.error === 'DeviceNotRegistered') {
    void DeviceTokenModel.updateOne({ token }, { $set: { invalid: true, invalidReason: 'DeviceNotRegistered' } });
  }
}

function toNotificationDto(notification: INotification) {
  return {
    id: notification._id.toString(),
    type: notification.type,
    title: notification.title,
    body: notification.body,
    status: notification.status,
    scheduledFor: notification.scheduledFor,
    sentAt: notification.sentAt ?? null,
    attempts: notification.attempts,
    createdAt: notification.createdAt,
  };
}

function toTokenDto(token: string, platform: string, invalid: boolean) {
  return { token, platform, invalid };
}

function motivationTitle(tone: string) {
  switch (tone) {
    case 'restart':
      return 'Fresh start';
    case 'milestone':
      return 'You are close';
    case 'consistent':
      return 'Keep the streak';
    default:
      return 'Motivation check-in';
  }
}

function channelForType(type: NotificationType) {
  switch (type) {
    case 'motivation':
      return 'motivation';
    case 'task_reminder':
      return 'task-reminders';
    case 'milestone_celebration':
      return 'milestones';
    case 'deadline_reminder':
      return 'deadlines';
    case 'daily_reminder':
    case 'missed_task':
    case 'test':
    default:
      return 'daily-reminders';
  }
}

function isDuplicate(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: number }).code === 11000;
}
