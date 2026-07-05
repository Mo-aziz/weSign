import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useCallService, notifyContactRequest } from '../services/useCallService';
import { clearTokens, getAccessToken } from '../services/apiClient';
import { getUserByUsername, getUserProfile } from '../services/userService';
import {
  getApiBaseUrl,
  getAiServiceUrl,
  getWebSocketUrl,
} from '../config/appConfig';
import {
  AppContext,
  THEME_STORAGE_KEY,
  type AppContextValue,
  type AppUser,
  type Contact,
  type ContactRequest,
} from './appContextValue';

import {
  fetchContacts,
  fetchIncomingRequests,
  fetchOutgoingRequests,
  sendContactRequest as sendContactRequestApi,
  acceptContactRequest as acceptContactRequestApi,
  rejectContactRequest as rejectContactRequestApi,
  cancelContactRequest as cancelContactRequestApi,
  removeContactFromApi,
} from '../services/contactService';

const USER_STORAGE_KEY = 'app_user';
const CONTACT_REQUEST_POLL_MS = 30_000;

export const AppContextProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<ContactRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<ContactRequest[]>([]);
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light') return false;
    if (stored === 'dark') return true;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true;
  });

  const {
    callState,
    currentCall,
    incomingCall,
    initiateCall,
    acceptCall,
    rejectCall,
    endCall,
    localStream,
    remoteStream,
    translationMessages,
    transcriptMessages,
    sendTranslation,
    sendTranscript,
    isCameraEnabled,
    isMicEnabled,
    toggleCamera,
    toggleMic,
  } = useCallService(user?.id ?? '', user?.username ?? '', user?.isDeaf ?? false);

  const refreshContactRequests = useCallback(async () => {
    if (!user?.id) return;

    const [incoming, outgoing, fetchedContacts] = await Promise.all([
      fetchIncomingRequests(),
      fetchOutgoingRequests(),
      fetchContacts(),
    ]);

    setIncomingRequests(incoming);
    setOutgoingRequests(outgoing);
    setContacts(fetchedContacts);
  }, [user?.id]);

  useEffect(() => {
    console.log('[WeSign] Service endpoints', {
      api: getApiBaseUrl(),
      signaling: getWebSocketUrl(),
      signAi: getAiServiceUrl(),
    });
  }, []);

  useEffect(() => {
    if (user?.id) {
      void refreshContactRequests();
    } else {
      setContacts([]);
      setIncomingRequests([]);
      setOutgoingRequests([]);
    }
  }, [user?.id, refreshContactRequests]);

  // Poll for contact request updates while logged in
  useEffect(() => {
    if (!user?.id) return;

    const intervalId = setInterval(() => {
      void refreshContactRequests();
    }, CONTACT_REQUEST_POLL_MS);

    return () => clearInterval(intervalId);
  }, [user?.id, refreshContactRequests]);

  // Real-time contact request updates via signaling WebSocket
  useEffect(() => {
    const handleContactRequestUpdate = () => {
      void refreshContactRequests();
    };

    window.addEventListener('contactRequestUpdate', handleContactRequestUpdate);
    return () => window.removeEventListener('contactRequestUpdate', handleContactRequestUpdate);
  }, [refreshContactRequests]);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;

    const restore = async () => {
      const storedUser = localStorage.getItem(USER_STORAGE_KEY);
      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser) as AppUser);
        } catch {
          clearTokens();
          localStorage.removeItem(USER_STORAGE_KEY);
        }
      }

      try {
        const profile = await getUserProfile();
        if (profile?.id && profile.username) {
          setUser({
            id: profile.id,
            username: profile.username,
            isDeaf: profile.isDeafMute,
          });
          localStorage.setItem(
            USER_STORAGE_KEY,
            JSON.stringify({
              id: profile.id,
              username: profile.username,
              isDeaf: profile.isDeafMute,
            }),
          );
        }
      } catch (error) {
        console.warn('Could not refresh profile from API:', error);
      }
    };

    void restore();
  }, []);

  useEffect(() => {
    const root = document.documentElement.classList;
    if (darkMode) {
      root.add('dark');
      window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    } else {
      root.remove('dark');
      window.localStorage.setItem(THEME_STORAGE_KEY, 'light');
    }
  }, [darkMode]);

  const login: AppContextValue['login'] = ({ id, username, isDeaf }) => {
    const userData = { id, username, isDeaf };
    setUser(userData);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData));
  };

  const logout = () => {
    clearTokens();
    localStorage.removeItem(USER_STORAGE_KEY);
    setUser(null);
    setContacts([]);
    setIncomingRequests([]);
    setOutgoingRequests([]);
  };

  const sendContactRequest: AppContextValue['sendContactRequest'] = useCallback(async (username) => {
    const trimmed = username.trim();
    if (!trimmed) {
      return { success: false, message: 'Enter a username before sending a request.' };
    }

    const exists = contacts.some(
      (contact) => contact.username.toLowerCase() === trimmed.toLowerCase(),
    );
    if (exists) {
      return { success: false, message: 'That contact is already saved.' };
    }

    const pendingOutgoing = outgoingRequests.some(
      (request) => request.toUser.username.toLowerCase() === trimmed.toLowerCase(),
    );
    if (pendingOutgoing) {
      return { success: false, message: 'You already sent a request to this user.' };
    }

    try {
      const remoteUser = await getUserByUsername(trimmed);
      if (!remoteUser?.id) {
        return { success: false, message: 'User not found on the server.' };
      }

      if (remoteUser.id === user?.id) {
        return { success: false, message: 'You cannot add yourself as a contact.' };
      }

      const result = await sendContactRequestApi(remoteUser.id);
      if (!result.success) {
        return { success: false, message: result.message ?? 'Failed to send contact request.' };
      }

      if (result.autoAccepted && result.contact) {
        setContacts((prev) => [...prev, result.contact!]);
        setOutgoingRequests((prev) =>
          prev.filter((request) => request.toUser.id !== remoteUser.id),
        );
        notifyContactRequest(remoteUser.id, user!.id, 'accepted');
        return {
          success: true,
          autoAccepted: true,
          message: `${result.contact.username} is now your contact.`,
        };
      }

      await refreshContactRequests();
      notifyContactRequest(remoteUser.id, user!.id, 'sent');
      return {
        success: true,
        message: `Request sent to ${remoteUser.username}. Waiting for them to accept.`,
      };
    } catch {
      return {
        success: false,
        message: `User "${trimmed}" not found. They must sign up first (same backend).`,
      };
    }
  }, [contacts, outgoingRequests, user?.id, refreshContactRequests]);

  const acceptContactRequest: AppContextValue['acceptContactRequest'] = useCallback(async (requestId) => {
    const result = await acceptContactRequestApi(requestId);
    if (!result.success) {
      return { success: false, message: result.message ?? 'Failed to accept request.' };
    }

    if (result.contact) {
      setContacts((prev) => {
        if (prev.some((contact) => contact.id === result.contact!.id)) {
          return prev;
        }
        return [...prev, result.contact!];
      });
      notifyContactRequest(result.contact.id, user!.id, 'accepted');
    }

    setIncomingRequests((prev) => prev.filter((request) => request.id !== requestId));
    return { success: true, message: result.message };
  }, [user?.id]);

  const rejectContactRequest: AppContextValue['rejectContactRequest'] = useCallback(async (requestId) => {
    const request = incomingRequests.find((item) => item.id === requestId);
    const rejected = await rejectContactRequestApi(requestId);
    if (rejected) {
      setIncomingRequests((prev) => prev.filter((item) => item.id !== requestId));
      if (request && user?.id) {
        notifyContactRequest(request.fromUser.id, user.id, 'rejected');
      }
    }
  }, [incomingRequests, user?.id]);

  const cancelContactRequest: AppContextValue['cancelContactRequest'] = useCallback(async (requestId) => {
    const request = outgoingRequests.find((item) => item.id === requestId);
    const cancelled = await cancelContactRequestApi(requestId);
    if (cancelled) {
      setOutgoingRequests((prev) => prev.filter((item) => item.id !== requestId));
      if (request && user?.id) {
        notifyContactRequest(request.toUser.id, user.id, 'cancelled');
      }
    }
  }, [outgoingRequests, user?.id]);

  const removeContact: AppContextValue['removeContact'] = async (contactId) => {
    const removedFromApi = await removeContactFromApi(contactId);
    if (removedFromApi) {
      setContacts((prev) => prev.filter((contact) => contact.id !== contactId));
    }
  };

  const toggleDarkMode = () => {
    setDarkMode((prev) => !prev);
  };

  const updateUser: AppContextValue['updateUser'] = (updates) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...updates };
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const value = useMemo<AppContextValue>(
    () => ({
      user,
      contacts,
      incomingRequests,
      outgoingRequests,
      darkMode,
      login,
      logout,
      sendContactRequest,
      acceptContactRequest,
      rejectContactRequest,
      cancelContactRequest,
      refreshContactRequests,
      removeContact,
      toggleDarkMode,
      updateUser,
      callState,
      currentCall,
      incomingCall,
      initiateCall,
      acceptCall,
      rejectCall,
      endCall,
      localStream,
      remoteStream,
      translationMessages,
      transcriptMessages,
      sendTranslation,
      sendTranscript,
      isCameraEnabled,
      isMicEnabled,
      toggleCamera,
      toggleMic,
    }),
    [
      user,
      contacts,
      incomingRequests,
      outgoingRequests,
      darkMode,
      sendContactRequest,
      acceptContactRequest,
      rejectContactRequest,
      cancelContactRequest,
      refreshContactRequests,
      callState,
      currentCall,
      incomingCall,
      localStream,
      remoteStream,
      translationMessages,
      transcriptMessages,
      isCameraEnabled,
      isMicEnabled,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
