/**
 * Contacts Service - Handles contact management
 * Keeps contacts local but can search for users in the backend
 */

import { apiGet, apiPost, apiDelete } from './apiClient';

export interface Contact {
  id: string;
  username: string;
}

/**
 * Fetch user contacts from the backend
 */
export const fetchContacts = async (): Promise<Contact[]> => {
  try {
    const response = await apiGet('/users/me/contacts');
    return Array.isArray(response) ? response : [];
  } catch (error) {
    console.error('Failed to fetch contacts:', error);
    return [];
  }
};

/**
 * Add a contact to the backend
 */
export const addContactToApi = async (contactId: string): Promise<boolean> => {
  try {
    await apiPost(`/users/me/contacts/${contactId}`);
    return true;
  } catch (error) {
    console.error('Failed to add contact:', error);
    return false;
  }
};

/**
 * Remove a contact from the backend
 */
export const removeContactFromApi = async (contactId: string): Promise<boolean> => {
  try {
    await apiDelete(`/users/me/contacts/${contactId}`);
    return true;
  } catch (error) {
    console.error('Failed to remove contact:', error);
    return false;
  }
};

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
  fetchContacts,
  addContactToApi,
  removeContactFromApi,
  searchContacts,
  getUserInfo,
  validateContact,
};
