/**
 * Contacts Service - Handles contact management
 * Keeps contacts local but can search for users in the backend
 */

import { apiGet } from './apiClient';

export interface Contact {
  id: string;
  username: string;
}

/**
 * Search for users to add as contacts
 */
export const searchContacts = async (query: string): Promise<Contact[]> => {
  try {
    if (!query || query.trim().length === 0) {
      return [];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response: any[] = await apiGet(`/users/search?q=${encodeURIComponent(query)}`);
    return response.map((user: any) => ({
      id: user.id,
      username: user.username,
    }));
  } catch (error) {
    console.error('Failed to search contacts:', error);
    return [];
  }
};

/**
 * Get user info by username
 */
export const getUserInfo = async (username: string) => {
  try {
    const response = await apiGet(`/users/username/${username}`);
    return response;
  } catch (error) {
    console.error(`Failed to fetch user info for ${username}:`, error);
    return null;
  }
};

/**
 * Validate that a contact exists before adding
 */
export const validateContact = async (username: string): Promise<boolean> => {
  try {
    const user = await getUserInfo(username);
    return !!user;
  } catch {
    return false;
  }
};

export default {
  searchContacts,
  getUserInfo,
  validateContact,
};
