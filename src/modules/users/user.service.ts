import { ApiError } from '../../utils/ApiError';
import { IUser, UserModel } from './user.model';
import { UserPreferenceModel } from './user-preference.model';

export function toPublicUser(user: Pick<IUser, '_id' | 'name' | 'email' | 'timezone' | 'status' | 'createdAt' | 'updatedAt'>) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    timezone: user.timezone,
    status: user.status,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function getProfile(userId: string) {
  const user = await UserModel.findById(userId);
  if (!user) throw new ApiError(401, 'User not found');
  const preferences = await UserPreferenceModel.findOne({ userId });
  return {
    ...toPublicUser(user),
    preferences: preferences
      ? {
          notificationsEnabled: preferences.notificationsEnabled,
          dailyReminder: preferences.dailyReminder,
          dailyReminderTime: preferences.dailyReminderTime,
          taskReminder: preferences.taskReminder,
          motivation: preferences.motivation,
          milestoneCelebration: preferences.milestoneCelebration,
          missedTask: preferences.missedTask,
          deadlineReminder: preferences.deadlineReminder,
        }
      : null,
  };
}

export async function updateProfile(userId: string, input: { name?: string; timezone?: string }) {
  const user = await UserModel.findById(userId);
  if (!user) throw new ApiError(401, 'User not found');
  if (input.name) user.name = input.name;
  if (input.timezone) user.timezone = input.timezone;
  await user.save();
  return toPublicUser(user);
}
