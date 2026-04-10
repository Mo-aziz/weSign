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
};

type AppContextValue = {
  user: AppUser | null;
  contacts: Contact[];
  darkMode: boolean;
  login: (payload: { username: string; isDeaf: boolean }) => void;
  logout: () => void;
  addContact: (username: string) => { success: boolean; message?: string };
  removeContact: (contactId: string) => void;
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
  translationMessages: Array<{ text: string; timestamp: number; shouldSpeak: boolean }>;
  transcriptMessages: Array<{ text: string; timestamp: number; shouldSpeak: boolean }>;
  sendTranslation: (text: string, shouldSpeak: boolean) => void;
  sendTranscript: (text: string) => void;
  isCameraEnabled: boolean;
  isMicEnabled: boolean;
  toggleCamera: () => void;
  toggleMic: () => void;
};

const AppContext = createContext<AppContextValue | undefined>(undefined);

const THEME_STORAGE_KEY = 'signlang.theme';

const getInitialDarkMode = () => {
  if (typeof window === 'undefined') return true;
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light') return false;
  if (stored === 'dark') return true;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true;
};

const defaultContacts: Contact[] = [
  { id: 'mentor-7p39f1', username: 'Mentor' },
  { id: 'interpreter-h42km0', username: 'Interpreter' },
  { id: 'friend-lm229v', username: 'Amelia' },
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

  const login: AppContextValue['login'] = ({ username, isDeaf }) => {
    const id = generateUserId(username);
    setUser({ id, username, isDeaf });
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

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppContextProvider');
  }
  return context;
};
