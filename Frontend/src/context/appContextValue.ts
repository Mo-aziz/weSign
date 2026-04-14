import { createContext } from 'react';
import type { CallData, CallState } from '../services/useCallService';

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

export type AppContextValue = {
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
  translationMessages: Array<{ text: string; timestamp: number; shouldSpeak: boolean; isLocal?: boolean }>;
  transcriptMessages: Array<{ text: string; timestamp: number; shouldSpeak: boolean; isLocal?: boolean }>;
  sendTranslation: (text: string, shouldSpeak: boolean) => void;
  sendTranscript: (text: string) => void;
  isCameraEnabled: boolean;
  isMicEnabled: boolean;
  toggleCamera: () => void;
  toggleMic: () => void;
};

export const AppContext = createContext<AppContextValue | undefined>(undefined);
export const THEME_STORAGE_KEY = 'signlang.theme';
export const DEFAULT_CONTACTS: Contact[] = [
  { id: 'mentor-7p39f1', username: 'Mentor' },
  { id: 'interpreter-h42km0', username: 'Interpreter' },
  { id: 'friend-lm229v', username: 'Amelia' },
];

export const getInitialDarkMode = () => {
  if (typeof window === 'undefined') return true;
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light') return false;
  if (stored === 'dark') return true;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true;
};

export const generateUserId = (username: string) => {
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
