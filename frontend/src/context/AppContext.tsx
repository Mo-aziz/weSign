import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useCallService, type CallData, type CallState } from '../services/useCallService';

export type VoiceSettings = {
  voiceName?: string;
  rate?: number;
  pitch?: number;
};

export type AppUser = {
  id: string;
  username: string;
  isDeaf: boolean;
  avatar?: string;
  status?: 'online' | 'offline' | 'away';
  lastSeen?: string;
  voiceSettings?: VoiceSettings;
};

export type Contact = {
  id: string;
  username: string;
  isDeaf?: boolean; // True if contact is deaf/non-hearing, false if hearing
};

type AppContextValue = {
  user: AppUser | null;
  contacts: Contact[];
  darkMode: boolean;
  login: (payload: { username: string; isDeaf: boolean }) => void;
  logout: () => void;
  addContact: (username: string) => { success: boolean; message?: string };
  removeContact: (contactId: string) => void;
  updateContact: (contactId: string, isDeaf: boolean) => void;
  toggleDarkMode: () => void;
  updateUser: (updates: Partial<Omit<AppUser, 'id'>>) => void;
  // Call-related properties
  callState: CallState;
  currentCall: CallData | null;
  incomingCall: CallData | null;
  initiateCall: (contactId: string, contactUsername: string, isDeaf: boolean) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  endCall: () => void;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  translationMessages: Array<{ text: string; timestamp: number; shouldSpeak: boolean; isLocal?: boolean; voiceSettings?: VoiceSettings }>;
  transcriptMessages: Array<{ text: string; timestamp: number; shouldSpeak: boolean }>;
  sendTranslation: (text: string, shouldSpeak: boolean, voiceSettings?: VoiceSettings) => void;
  sendTranscript: (text: string) => void;
  isCameraEnabled: boolean;
  isMicEnabled: boolean;
  toggleCamera: () => void;
  toggleMic: () => void;
};

const AppContext = createContext<AppContextValue | undefined>(undefined);

const THEME_STORAGE_KEY = 'signlang.theme';
const VOICE_SETTINGS_STORAGE_KEY = 'signlang.voiceSettings';

const getInitialDarkMode = () => {
  if (typeof window === 'undefined') return true;
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light') return false;
  if (stored === 'dark') return true;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true;
};

const getStoredVoiceSettings = (): VoiceSettings | null => {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(VOICE_SETTINGS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.error('Error loading voice settings from localStorage:', error);
    return null;
  }
};

const saveVoiceSettingsToStorage = (settings: VoiceSettings | undefined) => {
  if (typeof window === 'undefined') return;
  try {
    if (settings) {
      window.localStorage.setItem(VOICE_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } else {
      window.localStorage.removeItem(VOICE_SETTINGS_STORAGE_KEY);
    }
  } catch (error) {
    console.error('Error saving voice settings to localStorage:', error);
  }
};

const defaultContacts: Contact[] = [
  { id: 'mentor-7p39f1', username: 'Mentor', isDeaf: false },
  { id: 'interpreter-h42km0', username: 'Interpreter', isDeaf: false },
  { id: 'friend-lm229v', username: 'Amelia', isDeaf: true },
];

const generateUserId = (username: string) => {
  // Create a consistent ID based on username for cross-tab communication
  const sanitized = username.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
  // Use a simple hash of the username for consistency
  let hash = 0;
  for (let i = 0; i < sanitized.length; i++) {
    const char = sanitized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  const hashPart = Math.abs(hash).toString(36).padStart(6, '0');
  return `${sanitized}-${hashPart}`;
};

export const AppContextProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  // Force reset contacts to defaults by clearing any cached state
  const [contacts, setContacts] = useState<Contact[]>(() => {
    // Clear any potential cached contacts
    return defaultContacts;
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

  // Persist voice settings to localStorage whenever they change
  useEffect(() => {
    if (user?.voiceSettings) {
      saveVoiceSettingsToStorage(user.voiceSettings);
    }
  }, [user?.voiceSettings?.voiceName, user?.voiceSettings?.rate, user?.voiceSettings?.pitch]);

  const login: AppContextValue['login'] = ({ username, isDeaf }) => {
    const id = generateUserId(username);
    const storedVoiceSettings = getStoredVoiceSettings();
    const newUser = { id, username, isDeaf, voiceSettings: storedVoiceSettings || undefined };
    console.log('[AppContext] Login:', { username, isDeaf, userId: id });
    setUser(newUser);
  };

  const logout = () => {
    setUser(null);
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
    // Default new contacts to the SAME type as current user
    // This ensures the system properly enforces calling rules
    setContacts((prev) => [...prev, { id, username: trimmed, isDeaf: user?.isDeaf ?? false }]);
    return { success: true };
  };

  const removeContact: AppContextValue['removeContact'] = (contactId) => {
    setContacts((prev) => prev.filter((contact) => contact.id !== contactId));
  };

  const updateContact: AppContextValue['updateContact'] = (contactId, isDeaf) => {
    setContacts((prev) => 
      prev.map((contact) => 
        contact.id === contactId ? { ...contact, isDeaf } : contact
      )
    );
  };

  const toggleDarkMode = () => {
    setDarkMode((prev) => !prev);
  };

  const updateUser: AppContextValue['updateUser'] = (updates) => {
    console.log('[AppContext] updateUser called with:', updates);
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates };
      console.log('[AppContext] User updated:', { username: updated.username, isDeaf: updated.isDeaf });
      return updated;
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
      updateContact,
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
    [user, contacts, darkMode, login, logout, addContact, removeContact, updateContact, toggleDarkMode, updateUser, callState, currentCall, incomingCall, initiateCall, acceptCall, rejectCall, endCall, localStream, remoteStream, translationMessages, transcriptMessages, sendTranslation, sendTranscript, isCameraEnabled, isMicEnabled, toggleCamera, toggleMic]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppContextProvider');
  }
  return context;
};
