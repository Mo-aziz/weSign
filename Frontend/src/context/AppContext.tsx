import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useCallService } from '../services/useCallService';
import { clearTokens, getAccessToken } from '../services/apiClient';
import {
  AppContext,
  DEFAULT_CONTACTS,
  THEME_STORAGE_KEY,
  generateUserId,
  getInitialDarkMode,
  type AppContextValue,
  type AppUser,
  type Contact,
  type VoiceSettings,
} from './appContextValue';

const USER_STORAGE_KEY = 'app_user';

export const AppContextProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  // Force reset contacts to defaults by clearing any cached state
  const [contacts, setContacts] = useState<Contact[]>(() => {
    // Clear any potential cached contacts
    return DEFAULT_CONTACTS;
  });
  const [darkMode, setDarkMode] = useState<boolean>(getInitialDarkMode);

  // Initialize call service
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
    toggleMic
  } = useCallService(user?.id ?? '', user?.username ?? '', user?.isDeaf ?? false);

  // Auto-restore user from localStorage on mount
  useEffect(() => {
    const token = getAccessToken();
    if (token) {
      const storedUser = localStorage.getItem(USER_STORAGE_KEY);
      if (storedUser) {
        try {
          const userData = JSON.parse(storedUser);
          setUser(userData);
        } catch (error) {
          console.error('Failed to restore user from localStorage:', error);
          clearTokens();
        }
      }
    }
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

  const login: AppContextValue['login'] = ({ username, isDeaf }) => {
    const id = generateUserId(username);
    const userData = { id, username, isDeaf };
    setUser(userData);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData));
  };

  const logout = () => {
    clearTokens();
    localStorage.removeItem(USER_STORAGE_KEY);
    setUser(null);
    setContacts(DEFAULT_CONTACTS);
  };

  const addContact: AppContextValue['addContact'] = (username) => {
    const trimmed = username.trim();
    if (!trimmed) {
      return { success: false, message: 'Enter a username before adding a contact.' };
    }
    const exists = contacts.some((contact) => contact.username.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      return { success: false, message: 'That contact is already saved.' };
    }

    const id = generateUserId(trimmed);
    setContacts((prev) => [...prev, { id, username: trimmed }]);
    return { success: true };
  };

  const removeContact: AppContextValue['removeContact'] = (contactId) => {
    setContacts((prev) => prev.filter((contact) => contact.id !== contactId));
  };

  const toggleDarkMode = () => {
    setDarkMode((prev) => !prev);
  };

  const updateUser: AppContextValue['updateUser'] = (updates) => {
    setUser((prev) => {
      if (!prev) return prev;
      return { ...prev, ...updates };
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
      toggleMic
    }),
    [user, contacts, darkMode, callState, currentCall, incomingCall, localStream, remoteStream, translationMessages, transcriptMessages, isCameraEnabled, isMicEnabled]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

// Re-export types for backward compatibility
export type { AppContextValue, AppUser, Contact, VoiceSettings };
export { AppContext };
