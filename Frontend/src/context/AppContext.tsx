import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useCallService } from '../services/useCallService';
import { clearTokens, getAccessToken } from '../services/apiClient';
import { getUserByUsername, getUserProfile } from '../services/userService';
import {
  getApiBaseUrl,
  getAiServiceUrl,
  getWebSocketUrl,
} from '../config/appConfig';
import {
  AppContext,
  CONTACTS_STORAGE_KEY,
  DEFAULT_CONTACTS,
  THEME_STORAGE_KEY,
  type AppContextValue,
  type AppUser,
  type Contact,
} from './appContextValue';

import { fetchContacts, addContactToApi, removeContactFromApi } from '../services/contactService';

const USER_STORAGE_KEY = 'app_user';

export const AppContextProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
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

  useEffect(() => {
    console.log('[WeSign] Service endpoints', {
      api: getApiBaseUrl(),
      signaling: getWebSocketUrl(),
      signAi: getAiServiceUrl(),
    });
  }, []);

  useEffect(() => {
    if (user?.id) {
      fetchContacts().then(fetchedContacts => {
        setContacts(fetchedContacts);
      });
    } else {
      setContacts([]);
    }
  }, [user?.id]);

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
  };

  const addContact: AppContextValue['addContact'] = useCallback(async (username) => {
    const trimmed = username.trim();
    if (!trimmed) {
      return { success: false, message: 'Enter a username before adding a contact.' };
    }

    const exists = contacts.some(
      (contact) => contact.username.toLowerCase() === trimmed.toLowerCase(),
    );
    if (exists) {
      return { success: false, message: 'That contact is already saved.' };
    }

    try {
      const remoteUser = await getUserByUsername(trimmed);
      if (!remoteUser?.id) {
        return { success: false, message: 'User not found on the server.' };
      }

      if (remoteUser.id === user?.id) {
        return { success: false, message: 'You cannot add yourself as a contact.' };
      }

      const addedToApi = await addContactToApi(remoteUser.id);
      if (!addedToApi) {
        return { success: false, message: 'Failed to add contact to server.' };
      }

      setContacts((prev) => [
        ...prev,
        { id: remoteUser.id, username: remoteUser.username || trimmed },
      ]);
      return { success: true };
    } catch {
      return {
        success: false,
        message: `User "${trimmed}" not found. They must sign up first (same backend).`,
      };
    }
  }, [contacts, user?.id]);

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
      darkMode,
      login,
      logout,
      addContact,
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
      darkMode,
      addContact,
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
