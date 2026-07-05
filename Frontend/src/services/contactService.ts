/**
 * Contacts Service - Handles contact management and contact requests
 */

import { apiGet, apiPost, apiDelete } from './apiClient';

export interface Contact {
  id: string;
  username: string;
}

export interface ContactRequest {
  id: string;
  fromUser: Contact;
  toUser: Contact;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  createdAt: string;
  updatedAt?: string;
}

export interface SendContactRequestResult {
  success: boolean;
  autoAccepted?: boolean;
  contact?: Contact;
  request?: ContactRequest;
  message?: string;
}

/**
 * Fetch user contacts from the backend (accepted mutual contacts only)
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
 * Fetch incoming pending contact requests
 */
export const fetchIncomingRequests = async (): Promise<ContactRequest[]> => {
  try {
    const response = await apiGet('/users/me/contact-requests/incoming');
    return Array.isArray(response) ? response : [];
  } catch (error) {
    console.error('Failed to fetch incoming contact requests:', error);
    return [];
  }
};

/**
 * Fetch outgoing pending contact requests
 */
export const fetchOutgoingRequests = async (): Promise<ContactRequest[]> => {
  try {
    const response = await apiGet('/users/me/contact-requests/outgoing');
    return Array.isArray(response) ? response : [];
  } catch (error) {
    console.error('Failed to fetch outgoing contact requests:', error);
    return [];
  }
};

/**
 * Send a contact request (requires acceptance from the other user)
 */
export const sendContactRequest = async (contactId: string): Promise<SendContactRequestResult> => {
  try {
    const response = await apiPost('/users/me/contact-requests', { contactId }) as {
      message?: string;
      autoAccepted?: boolean;
      contact?: Contact;
      request?: ContactRequest;
    };
    return {
      success: true,
      autoAccepted: response.autoAccepted,
      contact: response.contact,
      request: response.request,
      message: response.message,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send contact request';
    return { success: false, message };
  }
};

/**
 * Accept an incoming contact request
 */
export const acceptContactRequest = async (
  requestId: string,
): Promise<{ success: boolean; contact?: Contact; message?: string }> => {
  try {
    const response = await apiPost(`/users/me/contact-requests/${requestId}/accept`) as {
      contact?: Contact;
      message?: string;
    };
    return { success: true, contact: response.contact, message: response.message };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to accept contact request';
    return { success: false, message };
  }
};

/**
 * Reject an incoming contact request
 */
export const rejectContactRequest = async (requestId: string): Promise<boolean> => {
  try {
    await apiPost(`/users/me/contact-requests/${requestId}/reject`);
    return true;
  } catch (error) {
    console.error('Failed to reject contact request:', error);
    return false;
  }
};

/**
 * Cancel an outgoing contact request
 */
export const cancelContactRequest = async (requestId: string): Promise<boolean> => {
  try {
    await apiDelete(`/users/me/contact-requests/${requestId}`);
    return true;
  } catch (error) {
    console.error('Failed to cancel contact request:', error);
    return false;
  }
};

/**
 * Remove a contact from the backend (mutual removal)
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
  fetchIncomingRequests,
  fetchOutgoingRequests,
  sendContactRequest,
  acceptContactRequest,
  rejectContactRequest,
  cancelContactRequest,
  removeContactFromApi,
  searchContacts,
  getUserInfo,
  validateContact,
};
