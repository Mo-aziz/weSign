import { useCallback, useEffect, useRef, useState } from 'react';

export type CallState = 'idle' | 'calling' | 'incoming' | 'connected' | 'ending';

export type CallPeer = {
  id: string;
  username: string;
  isDeaf: boolean;
};

export type CallData = {
  id: string;
  caller: CallPeer;
  callee: CallPeer;
  state: CallState;
  startTime?: number;
};

type MessageType = 
  | 'call-invite' 
  | 'call-accept' 
  | 'call-reject' 
  | 'call-end' 
  | 'offer' 
  | 'answer' 
  | 'ice-candidate'
  | 'sign-translation'
  | 'speech-transcript'
  | 'user-status'
  | 'user-update';

interface SignalingMessage {
  type: MessageType;
  callId?: string;
  from?: string;
  to?: string;
  userId?: string;
  isDeaf?: boolean;
  isOnline?: boolean;
  payload?: unknown;
}


interface TranslationMessage {
  text: string;
  timestamp: number;
  shouldSpeak: boolean;
  isLocal?: boolean; // Optional flag: true if sender, false/undefined if received
}

export type CallHookReturn = {
  // Call state
  callState: CallState;
  currentCall: CallData | null;
  incomingCall: CallData | null;
  
  // Media streams
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  
  // Actions
  initiateCall: (contactId: string, contactUsername: string, isDeaf: boolean) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  endCall: () => void;
  
  // Translation messages
  sendTranslation: (text: string, shouldSpeak: boolean) => void;
  sendTranscript: (text: string) => void;
  translationMessages: TranslationMessage[];
  transcriptMessages: TranslationMessage[];
  
  // Media controls
  isCameraEnabled: boolean;
  isMicEnabled: boolean;
  toggleCamera: () => void;
  toggleMic: () => void;
};

// WebSocket signaling configuration
// Use environment variable or construct URL dynamically
const getWebSocketURL = (): string => {
  // Try environment variable first
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }
  
  // Fallback: construct from current location
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.hostname;
  const port = 3001;
  
  const url = `${protocol}//${host}:${port}`;
  console.log(' Constructed WebSocket URL from current location:', url);
  return url;
};

let ws: WebSocket | null = null;
const messageCallbacks: Map<string, ((msg: SignalingMessage) => void)[]> = new Map();
let lastConnectParams: { userId: string; username: string; isDeaf: boolean } | null = null;
let wsConnectionFailedCount = 0; // Track connection failures

const connectWebSocket = (userId: string, username: string, isDeaf: boolean) => {
  if (ws?.readyState === WebSocket.OPEN) return;
  
  // Store params for retry on disconnect
  lastConnectParams = { userId, username, isDeaf };
  
  const WS_URL = getWebSocketURL();
  console.log(`📡 Attempting to connect WebSocket to ${WS_URL} for user ${username}...`);
  
  ws = new WebSocket(WS_URL);
  
  ws.onopen = () => {
    console.log('✓ WebSocket connected successfully');
    wsConnectionFailedCount = 0; // Reset failure count on successful connection
    // Register with the server
    ws?.send(JSON.stringify({
      type: 'register',
      userId,
      username,
      isDeaf
    }));
    console.log(`✓ Registration message sent to signaling server for user: ${username} (${userId})`);
  };
  
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      
      // Route messages by 'to' field OR by current user ID if no 'to' (server responses)
      const targetUserId = data.to || lastConnectParams?.userId;
      
      if (data.type && targetUserId) {
        const callbacks = messageCallbacks.get(targetUserId);
        if (callbacks) {
          callbacks.forEach(cb => cb(data));
        }
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  };
  
  ws.onerror = (error) => {
    wsConnectionFailedCount++;
    console.error(`❌ WebSocket error (attempt ${wsConnectionFailedCount}):`, error);
    console.error('   Signaling server may be unavailable or wrong URL configured');
    console.error(`   Expected URL: ${getWebSocketURL()}`);
  };
  
  ws.onclose = () => {
    console.log('⚠️ WebSocket disconnected, retrying in 3 seconds...');
    ws = null;
    if (lastConnectParams) {
      const { userId, username, isDeaf } = lastConnectParams;
      setTimeout(() => connectWebSocket(userId, username, isDeaf), 3000);
    }
  };
};

const sendSignalingMessage = (_toUserId: string, message: SignalingMessage) => {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  } else {
    const errorMsg = ws?.readyState === WebSocket.CONNECTING 
      ? 'WebSocket is connecting, try again in a moment' 
      : `WebSocket not connected (state: ${ws?.readyState || 'undefined'}). Make sure signaling server is running and accessible at: ${getWebSocketURL()}`;
    console.error(`❌ ${errorMsg}`);
    throw new Error(errorMsg);
  }
};

// Wait for WebSocket to be ready with timeout
const waitForWebSocketReady = async (timeoutMs: number = 5000): Promise<void> => {
  const startTime = Date.now();
  while (ws?.readyState !== WebSocket.OPEN) {
    if (Date.now() - startTime > timeoutMs) {
      throw new Error('WebSocket connection timeout - signaling server may be unavailable');
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
};

const subscribeToSignaling = (userId: string, callback: (msg: SignalingMessage) => void) => {
  if (!messageCallbacks.has(userId)) {
    messageCallbacks.set(userId, []);
  }
  messageCallbacks.get(userId)!.push(callback);
  
  return () => {
    const callbacks = messageCallbacks.get(userId);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) callbacks.splice(index, 1);
    }
  };
};

/**
 * Query server for a user's current type
 * Returns the actual isDeaf status from the server (not an assumption)
 */
export const queryUserType = async (userId: string): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    try {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        throw new Error('WebSocket not connected - cannot query user type');
      }

      // Send query to server
      const queryMessage = {
        type: 'query-user',
        userId: userId
      };
      
      console.log('📡 Sending user type query to server for:', userId);
      ws.send(JSON.stringify(queryMessage));
      
      // Set up timeout
      const timeoutId = setTimeout(() => {
        reject(new Error(`User type query timeout for ${userId}`));
      }, 5000);
      
      // Create a one-time listener for this specific user's response
      const handleResponse = (message: SignalingMessage) => {
        if (message.type === 'user-status' && message.userId === userId) {
          clearTimeout(timeoutId);
          
          // Remove this listener
          const callbacks = messageCallbacks.get(lastConnectParams?.userId || '');
          if (callbacks) {
            const idx = callbacks.indexOf(handleResponse);
            if (idx > -1) callbacks.splice(idx, 1);
          }
          
          console.log(`✓ User ${userId} status: ${message.isDeaf ? 'Deaf' : 'Hearing'} (online: ${message.isOnline})`);
          resolve(message.isDeaf || false);
        }
      };
      
      // Register callback for this response
      if (lastConnectParams?.userId) {
        const callbacks = messageCallbacks.get(lastConnectParams.userId) || [];
        callbacks.push(handleResponse);
        messageCallbacks.set(lastConnectParams.userId, callbacks);
      }
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Update user type on the server (called when user changes their type in Settings)
 * This ensures the server has the latest user type for call validation
 */
export const updateUserTypeOnServer = async (newIsDeaf: boolean): Promise<void> => {
  if (!lastConnectParams) {
    throw new Error('User not registered yet - WebSocket connection not initialized');
  }

  try {
    await waitForWebSocketReady();
    
    const updateMessage = {
      type: 'user-update',
      userId: lastConnectParams.userId,
      username: lastConnectParams.username,
      isDeaf: newIsDeaf
    };

    console.log('📤 Sending user type update to server:', updateMessage);
    ws?.send(JSON.stringify(updateMessage));
    
    // Update local tracking
    lastConnectParams.isDeaf = newIsDeaf;
    
    console.log(' User type update sent to server');
  } catch (error) {
    console.error('Failed to update user type on server:', error);
    throw error;
  }
};

export const useCallService = (currentUserId: string, currentUsername: string, isCurrentUserDeaf: boolean): CallHookReturn => {
  const [callState, setCallState] = useState<CallState>('idle');
  const [currentCall, setCurrentCall] = useState<CallData | null>(null);
  const [incomingCall, setIncomingCall] = useState<CallData | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [translationMessages, setTranslationMessages] = useState<TranslationMessage[]>([]);
  const [transcriptMessages, setTranscriptMessages] = useState<TranslationMessage[]>([]);
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const pendingDataMessagesRef = useRef<string[]>([]);
  const localStreamRef = useRef<MediaStream | null>(null); // Keep ref in sync with state
  const remoteStreamRef = useRef<MediaStream | null>(null); // Keep ref in sync with state
  const currentCallRef = useRef<CallData | null>(null); // Keep ref in sync with state

  // Keep refs in sync with state
  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  useEffect(() => {
    remoteStreamRef.current = remoteStream;
  }, [remoteStream]);

  useEffect(() => {
    currentCallRef.current = currentCall;
  }, [currentCall]);

  const flushPendingDataMessages = useCallback(() => {
    const channel = dataChannelRef.current;
    if (!channel || channel.readyState !== 'open' || pendingDataMessagesRef.current.length === 0) {
      return;
    }

    pendingDataMessagesRef.current.forEach((payload) => {
      channel.send(payload);
    });
    pendingDataMessagesRef.current = [];
  }, []);

  // Initialize peer connection WITH TRACKS ALREADY ADDED
  const createPeerConnection = useCallback((stream: MediaStream) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    // Add local tracks IMMEDIATELY to make offer ready
    console.log('Adding local tracks:', { video: stream.getVideoTracks().length, audio: stream.getAudioTracks().length });
    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream);
    });

    pc.ontrack = (event) => {
      console.log('✓ Received remote track:', event.track.kind);
      setRemoteStream(event.streams[0]);
    };

    pc.onicecandidate = (event) => {
      // Use ref to get current call (not stale closure value)
      if (event.candidate && currentCallRef.current) {
        const call = currentCallRef.current;
        const otherUserId = call.caller.id === currentUserId 
          ? call.callee.id 
          : call.caller.id;
          
        console.log('Sending ICE candidate to:', otherUserId);
        sendSignalingMessage(otherUserId, {
          type: 'ice-candidate',
          callId: call.id,
          from: currentUserId,
          to: otherUserId,
          payload: event.candidate.toJSON()
        });
      }
    };

    // Create data channel for text messages
    const dataChannel = pc.createDataChannel('messages', {
      ordered: true
    });
    
    dataChannel.onopen = () => {
      console.log('📤 Send data channel opened');
      flushPendingDataMessages();
    };
    dataChannel.onclose = () => {
      console.log('📤 Send data channel CLOSED');
    };
    dataChannel.onerror = (error) => {
      console.error('📤 Send data channel ERROR:', error);
    };
    dataChannel.onmessage = (event) => {
      console.log('📤 Send channel received message (echo?):', event.data.substring(0, 100));
      const data = JSON.parse(event.data);
      if (data.type === 'sign-translation') {
        console.log('📤 Adding to translation messages (marked as isLocal: false):', data.message);
        setTranslationMessages(prev => [...prev, { ...data.message, isLocal: false }]);
      } else if (data.type === 'speech-transcript') {
        console.log('📤 Adding to transcript messages (marked as isLocal: false):', data.message);
        setTranscriptMessages(prev => [...prev, { ...data.message, isLocal: false }]);
      }
    };

    dataChannelRef.current = dataChannel;

    pc.ondatachannel = (event) => {
      console.log(' ONDATACHANNEL EVENT FIRED - receiving data channel');
      const receiveChannel = event.channel;
      console.log(' Data channel name:', receiveChannel.label, 'ready state:', receiveChannel.readyState);
      // NOTE: DO NOT overwrite dataChannelRef.current - keep our created channel for sending!
      // Only attach handlers to receive messages on this channel
      receiveChannel.onopen = () => {
        console.log(' Receive data channel opened');
        flushPendingDataMessages();
      };
      receiveChannel.onclose = () => {
        console.log(' Receive data channel CLOSED');
      };
      receiveChannel.onerror = (error) => {
        console.error(' Receive data channel ERROR:', error);
      };
      receiveChannel.onmessage = (msgEvent) => {
        console.log(' RECEIVED MESSAGE on data channel:', msgEvent.data.substring(0, 100));
        try {
          const data = JSON.parse(msgEvent.data);
          console.log(' Message type:', data.type, 'payload:', data.message);
          if (data.type === 'sign-translation') {
            console.log(' Adding to translation messages (marked as isLocal: false):', data.message);
            setTranslationMessages(prev => [...prev, { ...data.message, isLocal: false }]);
          } else if (data.type === 'speech-transcript') {
            console.log(' Adding to transcript messages (marked as isLocal: false):', data.message);
            setTranscriptMessages(prev => [...prev, { ...data.message, isLocal: false }]);
          } else {
            console.warn(' Unknown message type:', data.type);
          }
        } catch (err) {
          console.error(' Failed to parse message:', err);
        }
      };
    };

    return pc;
  }, [currentUserId]);

  // Get media stream
  const getMediaStream = useCallback(async (isDeaf: boolean) => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('MediaDevices API is not available in this environment');
      }

      if (isDeaf) {
        // For deaf users: request camera first with basic constraints (most reliable)
        try {
          console.log('Requesting camera (DEAF user)...');
          const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
          });
          console.log('Camera obtained successfully:', stream);
          return stream;
        } catch (error) {
          console.error('Camera request failed:', error);
          throw error;
        }
      }

      // Hearing user: microphone - try basic audio first (most compatible), then try with enhancements
      try {
        console.log('Requesting microphone (HEARING user) - basic audio...');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: true
        });
        console.log('Microphone obtained successfully with basic audio:', stream);
        return stream;
      } catch (basicError) {
        console.warn('Basic audio failed, trying with enhancements:', basicError);
        try {
          console.log('Requesting microphone with audio enhancements...');
          const stream = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: {
              echoCancellation: { ideal: true },
              noiseSuppression: { ideal: true },
              autoGainControl: { ideal: true }
            }
          });
          console.log('Microphone obtained with enhancements:', stream);
          return stream;
        } catch (enhancedError) {
          console.error('Enhanced audio also failed:', enhancedError);
          throw basicError; // Throw the original error
        }
      }
    } catch (error) {
      const err = error as DOMException & Error;
      const errorName = err?.name || '';
      const errorMessage = err?.message || String(error);
      
      console.error('Error accessing media devices:', {
        name: errorName,
        message: errorMessage,
        fullError: error
      });
      
      // Enhance error message with specific handling
      if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError' || errorMessage.includes('permission') || errorMessage.includes('denied')) {
        throw new Error('MediaPermissionDenied: Permission denied - please check browser settings and allow camera/microphone access');
      } else if (errorName === 'NotFoundError' || errorMessage.includes('no media')) {
        throw new Error('NoMediaDeviceFound: No camera or microphone found attached to your computer');
      } else if (errorName === 'NotReadableError' || errorMessage.includes('being used')) {
        throw new Error('MediaDeviceInUse: Camera or microphone is being used by another application - please close it and retry');
      } else if (errorName === 'SecurityError') {
        throw new Error('SecurityError: Cannot access media - this may require HTTPS. If developing locally, try using http://localhost or 127.0.0.1');
      }
      
      throw new Error(`getUserMedia error: ${errorName} - ${errorMessage}`);
    }
  }, []);

  // Handle incoming signaling messages and connect WebSocket
  useEffect(() => {
    if (!currentUserId) return;

    // Connect WebSocket with user's deaf status
    connectWebSocket(currentUserId, currentUsername, isCurrentUserDeaf);

    const handleMessage = async (message: SignalingMessage) => {
      switch (message.type) {
        case 'call-invite': {
          const { caller, callId } = message.payload as { caller: CallPeer; callId: string };
          setIncomingCall({
            id: callId,
            caller,
            callee: { id: currentUserId, username: currentUsername, isDeaf: isCurrentUserDeaf },
            state: 'incoming'
          });
          setCallState('incoming');
          break;
        }

        case 'call-accept': {
          console.log('Received call-accept');
          // Peer connection should already be created with tracks by initiateCall
          if (!peerConnectionRef.current) {
            console.warn('No peer connection on call-accept');
            break;
          }
          
          try {
            console.log('Creating offer');
            const offer = await peerConnectionRef.current.createOffer();
            await peerConnectionRef.current.setLocalDescription(offer);
            console.log('Sending offer');
            sendSignalingMessage(message.from!, {
              type: 'offer',
              callId: message.callId,
              from: currentUserId,
              to: message.from,
              payload: offer
            });
          } catch (error) {
            console.error('Failed to create offer:', error);
          }
          break;
        }

        case 'call-reject': {
          setCallState('idle');
          setCurrentCall(null);
          if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            setLocalStream(null);
          }
          break;
        }

        case 'call-end': {
          console.log('📞 Received call-end signal, cleaning up...');
          endCallInternal();
          break;
        }

        case 'offer': {
          console.log('Received offer');
          // Peer connection should already be created with tracks by acceptCall
          if (!peerConnectionRef.current) {
            console.warn('No peer connection when receiving offer');
            break;
          }
          
          try {
            await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(message.payload as RTCSessionDescriptionInit));
            console.log('Creating answer');
            const answer = await peerConnectionRef.current.createAnswer();
            await peerConnectionRef.current.setLocalDescription(answer);
            console.log('Sending answer');
            sendSignalingMessage(message.from!, {
              type: 'answer',
              callId: message.callId,
              from: currentUserId,
              to: message.from,
              payload: answer
            });
          } catch (error) {
            console.error('Failed to create answer:', error);
          }
          break;
        }

        case 'answer': {
          const pc = peerConnectionRef.current;
          if (pc) {
            await pc.setRemoteDescription(new RTCSessionDescription(message.payload as RTCSessionDescriptionInit));
          }
          break;
        }

        case 'ice-candidate': {
          const pc = peerConnectionRef.current;
          if (pc) {
            await pc.addIceCandidate(new RTCIceCandidate(message.payload as RTCIceCandidateInit));
          }
          break;
        }

        case 'sign-translation': {
          if (message.payload) {
            console.log('📡 Adding signaling sign-translation (marked as isLocal: false):', message.payload);
            setTranslationMessages(prev => [...prev, { ...message.payload as TranslationMessage, isLocal: false }]);
          }
          break;
        }

        case 'speech-transcript': {
          if (message.payload) {
            console.log('📡 Adding signaling speech-transcript (marked as isLocal: false):', message.payload);
            setTranscriptMessages(prev => [...prev, { ...message.payload as TranslationMessage, isLocal: false }]);
          }
          break;
        }
      }
    };

    unsubscribeRef.current = subscribeToSignaling(currentUserId, handleMessage);

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [currentUserId, currentUsername, isCurrentUserDeaf]);

  const initiateCall = useCallback(async (contactId: string, contactUsername: string, isContactDeaf: boolean) => {
    try {
      await waitForWebSocketReady();
      
      // IMPORTANT: Query server for contact's CURRENT type (don't use stale local data)
      console.log('📡 Querying server for contact\'s current user type...');
      let actualContactIsDeaf = isContactDeaf;
      try {
        actualContactIsDeaf = await queryUserType(contactId);
        console.log(`✓ Server reports contact "${contactUsername}" isDeaf: ${actualContactIsDeaf}`);
      } catch (queryError) {
        console.warn('Could not query server for contact type, using provided value:', queryError);
        // Fall back to provided value if query fails
      }
      
      // CLIENT-SIDE VALIDATION: Block hearing-to-hearing calls
      if (!isCurrentUserDeaf && !actualContactIsDeaf) {
        console.error(' BLOCKED: Attempting to initiate hearing-to-hearing call');
        console.error(`   Caller: ${isCurrentUserDeaf ? 'Deaf' : 'Hearing'} | Callee: ${actualContactIsDeaf ? 'Deaf' : 'Hearing'}`);
        
        const errorMessage = 'Unable to establish connection. This platform supports calls between Deaf users and Hearing interpreters only.';
        
        // Dispatch error event for UI to show error message
        window.dispatchEvent(new CustomEvent('callMessage', {
          detail: {
            type: 'call-blocked',
            reason: errorMessage
          }
        }));
        
        // Throw error to prevent "Call initiated successfully" from showing
        throw new Error(`call-blocked: ${errorMessage}`);
      }

      const callId = `call-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const newCall: CallData = {
        id: callId,
        caller: { id: currentUserId, username: currentUsername, isDeaf: isCurrentUserDeaf },
        callee: { id: contactId, username: contactUsername, isDeaf: actualContactIsDeaf },
        state: 'calling'
      };
      
      console.log('=== INITIATE CALL ===', { caller: newCall.caller.username, isDeaf: isCurrentUserDeaf });
      setCurrentCall(newCall);
      setCallState('calling');
      
      // GET MEDIA AND CREATE PEER CONNECTION WITH TRACKS BEFORE SENDING ANY MESSAGE
      console.log('Requesting media...');
      const stream = await getMediaStream(isCurrentUserDeaf);
      setLocalStream(stream);
      
      console.log('Creating peer connection with tracks...');
      const pc = createPeerConnection(stream);
      peerConnectionRef.current = pc;
      
      // Now mark as connected (peer connection ready with tracks)
      setCurrentCall(prev => prev ? { ...prev, state: 'connected' } : null);
      setCallState('connected');
      
      // THEN send call invite
      console.log('Sending call-invite');
      sendSignalingMessage(contactId, {
        type: 'call-invite',
        callId,
        from: currentUserId,
        to: contactId,
        payload: { caller: newCall.caller, callId }
      });
    } catch (error) {
      console.error('Call initiation error:', error);
      if (localStream) localStream.getTracks().forEach(t => t.stop());
      setCallState('idle');
      setCurrentCall(null);
      setLocalStream(null);
      throw error;
    }
  }, [currentUserId, currentUsername, isCurrentUserDeaf, getMediaStream, createPeerConnection]);

  const acceptCall = useCallback(async () => {
    if (!incomingCall) return;

    try {
      await waitForWebSocketReady();
      
      // Query server for caller's CURRENT type to be certain
      console.log('📡 Querying server for caller\'s current user type...');
      let actualCallerIsDeaf = incomingCall.caller.isDeaf;
      try {
        actualCallerIsDeaf = await queryUserType(incomingCall.caller.id);
        console.log(`✓ Server reports caller "${incomingCall.caller.username}" isDeaf: ${actualCallerIsDeaf}`);
      } catch (queryError) {
        console.warn(' Could not verify caller type from server, using provided value:', queryError);
      }

      // CLIENT-SIDE VALIDATION: Block hearing-to-hearing calls
      if (!actualCallerIsDeaf && !isCurrentUserDeaf) {
        console.error(' BLOCKED: Attempting to accept hearing-to-hearing call');
        console.error(`   Caller: ${actualCallerIsDeaf ? 'Deaf' : 'Hearing'} | Callee (me): ${isCurrentUserDeaf ? 'Deaf' : 'Hearing'}`);
        setIncomingCall(null);
        setCallState('idle');
        
        const errorMessage = 'Unable to establish connection. This platform supports calls between Deaf users and Hearing interpreters only.';
        
        // Dispatch event for UI to show error
        window.dispatchEvent(new CustomEvent('callMessage', {
          detail: {
            type: 'call-blocked',
            reason: errorMessage
          }
        }));
        
        // Throw error to handle properly
        throw new Error(`call-blocked: ${errorMessage}`);
      }

      console.log('=== ACCEPT CALL ===', { caller: incomingCall.caller.username });
      const newCall: CallData = {
        id: incomingCall.id,
        caller: incomingCall.caller,
        callee: { id: currentUserId, username: currentUsername, isDeaf: isCurrentUserDeaf },
        state: 'connected'
      };
      
      setCurrentCall(newCall);
      setIncomingCall(null);
      setCallState('connected');
      
      // GET MEDIA AND CREATE PEER CONNECTION WITH TRACKS BEFORE SENDING ACCEPT
      console.log('Requesting media...');
      const stream = await getMediaStream(isCurrentUserDeaf);
      setLocalStream(stream);
      
      console.log('Creating peer connection with tracks...');
      const pc = createPeerConnection(stream);
      peerConnectionRef.current = pc;
      
      // Notify caller
      console.log('Sending call-accept');
      sendSignalingMessage(incomingCall.caller.id, {
        type: 'call-accept',
        callId: incomingCall.id,
        from: currentUserId,
        to: incomingCall.caller.id
      });
    } catch (error) {
      console.error('Accept call failed:', error);
      if (localStream) localStream.getTracks().forEach(t => t.stop());
      setCallState('incoming');
      setLocalStream(null);
      setCurrentCall(null);
    }
  }, [incomingCall, currentUserId, currentUsername, isCurrentUserDeaf, getMediaStream, createPeerConnection]);

  const rejectCall = useCallback(() => {
    if (!incomingCall) return;
    
    sendSignalingMessage(incomingCall.caller.id, {
      type: 'call-reject',
      callId: incomingCall.id,
      from: currentUserId,
      to: incomingCall.caller.id
    });
    
    setIncomingCall(null);
    setCallState('idle');
  }, [incomingCall, currentUserId]);

  const endCallInternal = useCallback(() => {
    console.log('🎬 endCallInternal - Starting cleanup...');
    
    // CRITICAL: Use refs instead of closures to get CURRENT stream values
    // Closures can be stale if this function was defined when streams were null
    const localStreamToClean = localStreamRef.current;
    const remoteStreamToClean = remoteStreamRef.current;
    
    console.log(' Stream references:', {
      localStream: localStreamToClean ? `${localStreamToClean.getTracks().length} tracks` : 'null',
      remoteStream: remoteStreamToClean ? `${remoteStreamToClean.getTracks().length} tracks` : 'null'
    });
    
    // Close peer connection first - this will also close data channels
    if (peerConnectionRef.current) {
      console.log(' Closing peer connection...');
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
      console.log(' Peer connection closed');
    }
    
    // Stop all tracks in local stream - DISABLE BEFORE STOP for proper cleanup
    if (localStreamToClean) {
      console.log(' Stopping local stream tracks:', localStreamToClean.getTracks().length);
      localStreamToClean.getTracks().forEach(track => {
        try {
          console.log(' Stopping local track:', track.kind, '(state:', track.readyState + ')');
          
          // CRITICAL: Disable track BEFORE stopping to ensure hardware releases properly
          track.enabled = false;
          console.log('  Track disabled');
          
          // Now stop the track
          track.stop();
          console.log('   Track stopped');
          
          // Force stop again if needed
          if (track.readyState !== 'ended') {
            track.stop();
            console.log('  Track force-stopped');
          }
        } catch (err) {
          console.error(' Error stopping local track:', err);
        }
      });
    } else {
      console.log('  No local stream to clean');
    }
    
    // Stop all tracks in remote stream - DISABLE BEFORE STOP for proper cleanup
    if (remoteStreamToClean) {
      console.log(' Stopping remote stream tracks:', remoteStreamToClean.getTracks().length);
      remoteStreamToClean.getTracks().forEach(track => {
        try {
          console.log(' Stopping remote track:', track.kind, '(state:', track.readyState + ')');
          
          // CRITICAL: Disable track BEFORE stopping to ensure hardware releases properly
          track.enabled = false;
          console.log('   Track disabled');
          
          // Now stop the track
          track.stop();
          console.log('   Track stopped');
          
          // Force stop again if needed
          if (track.readyState !== 'ended') {
            track.stop();
            console.log('   Track force-stopped');
          }
        } catch (err) {
          console.error(' Error stopping remote track:', err);
        }
      });
    } else {
      console.log('  No remote stream to clean');
    }
    
    // Clear all state
    console.log(' Clearing all state...');
    setCallState('idle');
    setCurrentCall(null);
    setIncomingCall(null);
    setLocalStream(null);
    setRemoteStream(null);
    setTranslationMessages([]);
    setTranscriptMessages([]);
    
    console.log(' endCallInternal cleanup complete - Camera & Mic should be OFF');
  }, []);

  const endCall = useCallback(() => {
    if (currentCall) {
      const otherUserId = currentCall.caller.id === currentUserId 
        ? currentCall.callee.id 
        : currentCall.caller.id;
      
      sendSignalingMessage(otherUserId, {
        type: 'call-end',
        callId: currentCall.id,
        from: currentUserId,
        to: otherUserId
      });
    }
    
    endCallInternal();
  }, [currentCall, currentUserId, endCallInternal]);

  const sendTranslation = useCallback((text: string, shouldSpeak: boolean) => {
    console.log(' sendTranslation called:', { text, shouldSpeak, dataChannelReady: dataChannelRef.current?.readyState === 'open' });
    const message: TranslationMessage = {
      text,
      timestamp: Date.now(),
      shouldSpeak
    };
    const payload = JSON.stringify({
      type: 'sign-translation',
      message
    });

    if (dataChannelRef.current?.readyState === 'open') {
      console.log(' Sending via DATA CHANNEL');
      dataChannelRef.current.send(payload);
      console.log(' Data channel send complete');
    } else {
      console.log(' Data channel NOT open, falling back to signaling. State:', dataChannelRef.current?.readyState);
      pendingDataMessagesRef.current.push(payload);
      console.log(' Message queued:', pendingDataMessagesRef.current.length, 'total pending');

      if (currentCall) {
        const otherUserId = currentCall.caller.id === currentUserId
          ? currentCall.callee.id
          : currentCall.caller.id;
        try {
          console.log(' Sending via SIGNALING to:', otherUserId);
          sendSignalingMessage(otherUserId, {
            type: 'sign-translation',
            callId: currentCall.id,
            from: currentUserId,
            to: otherUserId,
            payload: message
          });
          console.log(' Signaling send complete');
        } catch (error) {
          console.error(' Failed to send translation via signaling:', error);
        }
      } else {
        console.warn(' No currentCall available for signaling fallback');
      }
    }

    // Also add to local state with isLocal: true flag
    console.log(' Adding message to local translation state (marked as isLocal: true)');
    setTranslationMessages(prev => [...prev, { ...message, isLocal: true }]);
  }, [currentCall, currentUserId]);

  const sendTranscript = useCallback((text: string) => {
    const message: TranslationMessage = {
      text,
      timestamp: Date.now(),
      shouldSpeak: false
    };
    const payload = JSON.stringify({
      type: 'speech-transcript',
      message
    });

    if (dataChannelRef.current?.readyState === 'open') {
      dataChannelRef.current.send(payload);
    } else {
      pendingDataMessagesRef.current.push(payload);

      if (currentCall) {
        const otherUserId = currentCall.caller.id === currentUserId
          ? currentCall.callee.id
          : currentCall.caller.id;
        try {
          sendSignalingMessage(otherUserId, {
            type: 'speech-transcript',
            callId: currentCall.id,
            from: currentUserId,
            to: otherUserId,
            payload: message
          });
        } catch (error) {
          console.error('Failed to send transcript via signaling:', error);
        }
      }
    }

    // Also add to local state
    setTranscriptMessages(prev => [...prev, message]);
  }, [currentCall, currentUserId]);

  const toggleCamera = useCallback(() => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraEnabled(videoTrack.enabled);
      }
    }
  }, [localStream]);

  const toggleMic = useCallback(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicEnabled(audioTrack.enabled);
      }
    }
  }, [localStream]);

  return {
    callState,
    currentCall,
    incomingCall,
    localStream,
    remoteStream,
    initiateCall,
    acceptCall,
    rejectCall,
    endCall,
    sendTranslation,
    sendTranscript,
    translationMessages,
    transcriptMessages,
    isCameraEnabled,
    isMicEnabled,
    toggleCamera,
    toggleMic
  };
};

export default useCallService;
