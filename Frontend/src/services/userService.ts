/**
 * User Service - Handles all user-related API interactions
 */

import { apiGet, apiPost, apiPut } from './apiClient';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  phoneNumber: string;
  isDeafMute: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Get current user profile
 */
export const getUserProfile = async (): Promise<User> => {
  try {
    return await apiGet('/users/me');
  } catch (error) {
    console.error('Failed to fetch user profile:', error);
    throw error;
  }
};

/**
 * Get user by ID
 */
export const getUserById = async (userId: string): Promise<User> => {
  try {
    return await apiGet(`/users/${userId}`);
  } catch (error) {
    console.error(`Failed to fetch user ${userId}:`, error);
    throw error;
  }
};

/**
 * Update user profile
 */
export const updateUserProfile = async (
  userId: string,
  updates: Partial<User>
): Promise<User> => {
  try {
    return await apiPut(`/users/${userId}`, updates);
  } catch (error) {
    console.error(`Failed to update user ${userId}:`, error);
    throw error;
  }
};

/**
 * Check if username exists
 */
export const checkUsernameExists = async (username: string): Promise<boolean> => {
  try {
    await apiGet(`/users/check/username/${username}`);
    return true;
  } catch {
    return false;
  }
};

/**
 * Search for users by username
 */
export const searchUsers = async (query: string): Promise<User[]> => {
  try {
    return await apiGet(`/users/search?q=${encodeURIComponent(query)}`);
  } catch (error) {
    console.error('Failed to search users:', error);
    throw error;
  }
};

/**
 * Get user status (online/offline/away)
 */
export const getUserStatus = async (userId: string): Promise<'online' | 'offline' | 'away'> => {
  try {
    const response = await apiGet(`/users/${userId}/status`);
    return response.status;
  } catch (error) {
    console.error(`Failed to fetch user status ${userId}:`, error);
    return 'offline';
  }
};

/**
 * Register a device token for push notifications
 */
export const registerDeviceToken = async (deviceToken: string): Promise<void> => {
  try {
    await apiPost('/users/me/device-token', { deviceToken });
  } catch (error) {
    console.error('Failed to register device token:', error);
    throw error;
  }
};

export default {
  getUserProfile,
  getUserById,
  updateUserProfile,
  checkUsernameExists,
  searchUsers,
  getUserStatus,
  registerDeviceToken,
};
