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
  | 'speech-transcript';

interface SignalingMessage {
  type: MessageType;
  callId: string;
  from: string;
  to: string;
  payload?: unknown;
}


interface TranslationMessage {
  text: string;
  timestamp: number;
  shouldSpeak: boolean;
  isLocal?: boolean;
  voiceSettings?: {
    voiceName?: string;
    rate?: number;
    pitch?: number;
  };
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
// Dynamically determine WebSocket URL based on current host (works on localhost and network)
const getSignalingURL = (): string => {
  // If explicitly set via environment variable, use that
  if (import.meta.env.VITE_SIGNALING_URL) {
    console.log('[getSignalingURL] Using VITE_SIGNALING_URL:', import.meta.env.VITE_SIGNALING_URL);
    return import.meta.env.VITE_SIGNALING_URL;
  }
  
  const host = window.location.hostname;
  const port = 3001; // Signaling server port
  const pageProtocol = window.location.protocol;
  
  // CRITICAL: HTTPS pages MUST use WSS, not WS (browser security)
  // Do NOT use WS on HTTPS pages - it will be blocked!
  const protocol = pageProtocol === 'https:' ? 'wss:' : 'ws:';
  
  const wsUrl = `${protocol}//${host}:${port}`;
  console.log('[getSignalingURL] Page protocol:', pageProtocol, 'Host:', host, 'Port:', port);
  console.log('[getSignalingURL] Using protocol:', protocol, 'Final URL:', wsUrl);
  
  // Safety check: if page is HTTPS but protocol is still WS, force WSS
  if (pageProtocol === 'https:' && !wsUrl.startsWith('wss://')) {
    console.warn('[getSignalingURL] WARNING: HTTPS page with WS protocol! Forcing WSS.');
    return wsUrl.replace('ws://', 'wss://');
  }
  
  return wsUrl;
};

let WS_URL = '';
let ws: WebSocket | null = null;
let messageCallbacks: Map<string, ((msg: SignalingMessage) => void)[]> = new Map();
// Track addEventListener listeners separately to avoid infinite recursion
let messageEventListeners: Array<(event: MessageEvent) => void> = [];
// Track current user info to allow updates
let currentUserInfo: { userId: string; username: string; isDeaf: boolean } | null = null;

const connectWebSocket = (userId: string, username: string, isDeaf: boolean) => {
  if (WS_URL === '') {
    WS_URL = getSignalingURL();
    console.log('WebSocket URL:', WS_URL);
  }
  
  // Store current user info for later updates
  currentUserInfo = { userId, username, isDeaf };
  console.log('[connectWebSocket] Storing user info:', currentUserInfo);
  
  if (ws?.readyState === WebSocket.OPEN) return;
  
  ws = new WebSocket(WS_URL);
  
  ws.onopen = () => {
    console.log('WebSocket connected');
    // Register with the server
    ws?.send(JSON.stringify({
      type: 'register',
      userId,
      username,
      isDeaf
    }));
  };
  
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      
      // Call addEventListener listeners directly (not via dispatchEvent to avoid infinite recursion)
      messageEventListeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          console.error('Error in message event listener:', error);
        }
      });
      
      // Then handle regular signaling messages (have both type and to)
      if (data.type && data.to) {
        const callbacks = messageCallbacks.get(data.to);
        if (callbacks) {
          callbacks.forEach(cb => cb(data));
        }
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  };
  
  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
  
  ws.onclose = () => {
    console.log('WebSocket disconnected, retrying in 3 seconds...');
    ws = null;
    messageEventListeners = []; // Clear listeners on disconnect
    setTimeout(() => connectWebSocket(userId, username, isDeaf), 3000);
  };
  
  // Override addEventListener to track message listeners
  const originalAddEventListener = ws.addEventListener.bind(ws);
  ws.addEventListener = function(type: string, listener: EventListener, ...args: any[]) {
    if (type === 'message') {
      messageEventListeners.push(listener as (event: MessageEvent) => void);
    }
    return originalAddEventListener(type, listener, ...args);
  } as any;
  
  // Override removeEventListener to untrack message listeners
  const originalRemoveEventListener = ws.removeEventListener.bind(ws);
  ws.removeEventListener = function(type: string, listener: EventListener, ...args: any[]) {
    if (type === 'message') {
      messageEventListeners = messageEventListeners.filter(l => l !== listener);
    }
    return originalRemoveEventListener(type, listener, ...args);
  } as any;
};

const sendSignalingMessage = (_toUserId: string, message: SignalingMessage) => {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  } else {
    const errorMsg = ws?.readyState === WebSocket.CONNECTING 
      ? 'WebSocket is connecting, try again in a moment' 
      : 'WebSocket not connected';
    console.error(errorMsg);
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

// NEW: Export function to update user type on server (called from Settings when user changes type)
export const updateUserTypeOnServer = async (newIsDeaf: boolean): Promise<void> => {
  if (!currentUserInfo) {
    console.error('[updateUserTypeOnServer] No current user info available');
    throw new Error('User not logged in');
  }

  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.error('[updateUserTypeOnServer] WebSocket not connected');
    throw new Error('WebSocket not connected');
  }

  console.log('[updateUserTypeOnServer] ✓ Updating user type on server');
  console.log('[updateUserTypeOnServer] Old isDeaf:', currentUserInfo.isDeaf);
  console.log('[updateUserTypeOnServer] New isDeaf:', newIsDeaf);

  // Update local cache
  currentUserInfo.isDeaf = newIsDeaf;

  // Send update to server
  ws.send(JSON.stringify({
    type: 'register',
    userId: currentUserInfo.userId,
    username: currentUserInfo.username,
    isDeaf: newIsDeaf
  }));

  console.log('[updateUserTypeOnServer] ✓ Type update sent to server');
};
export const queryUserStatus = async (userId: string): Promise<{ isDeaf: boolean; isOnline: boolean; username?: string }> => {
  return new Promise((resolve, reject) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      reject(new Error('WebSocket not connected'));
      return;
    }

    // Send query request
    ws.send(JSON.stringify({
      type: 'query-user',
      userId
    }));

    // Set up one-time listener for response
    let timeout: ReturnType<typeof setTimeout> | null = null;
    
    const handleResponse = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'user-status' && data.userId === userId) {
          if (timeout) clearTimeout(timeout);
          ws?.removeEventListener('message', handleResponse);
          resolve({
            isDeaf: data.isDeaf ?? false,
            isOnline: data.isOnline ?? false,
            username: data.username
          });
        }
      } catch (error) {
        console.error('Error parsing user status response:', error);
      }
    };

    // Add timeout
    timeout = setTimeout(() => {
      ws?.removeEventListener('message', handleResponse);
      reject(new Error('User status query timeout'));
    }, 5000);

    ws?.addEventListener('message', handleResponse);
  });
};

// NEW: Query BOTH users' status from server at call time (100% reliable)
export const validateCallEligibility = async (
  callerId: string,
  calleeId: string
): Promise<{ callerIsDeaf: boolean; calleeIsDeaf: boolean }> => {
  try {
    console.log('[validateCallEligibility] === STARTING VALIDATION ===');
    console.log('[validateCallEligibility] Querying caller (ID: ' + callerId + ') and callee (ID: ' + calleeId + ')');
    
    // Query BOTH statuses in parallel
    const [callerStatus, calleeStatus] = await Promise.all([
      queryUserStatus(callerId),
      queryUserStatus(calleeId)
    ]);

    console.log('[validateCallEligibility] Caller query result:', {
      type: typeof callerStatus.isDeaf,
      value: callerStatus.isDeaf,
      username: callerStatus.username,
      online: callerStatus.isOnline
    });
    console.log('[validateCallEligibility] Callee query result:', {
      type: typeof calleeStatus.isDeaf,
      value: calleeStatus.isDeaf,
      username: calleeStatus.username,
      online: calleeStatus.isOnline
    });

    // Ensure we have valid boolean values
    if (typeof callerStatus.isDeaf !== 'boolean') {
      throw new Error('Invalid caller isDeaf value from server: ' + callerStatus.isDeaf);
    }
    if (typeof calleeStatus.isDeaf !== 'boolean') {
      throw new Error('Invalid callee isDeaf value from server: ' + calleeStatus.isDeaf);
    }

    const result = {
      callerIsDeaf: callerStatus.isDeaf,
      calleeIsDeaf: calleeStatus.isDeaf
    };

    console.log('[validateCallEligibility] ✓ Validation complete - returning:', {
      callerIsDeaf: result.callerIsDeaf,
      calleeIsDeaf: result.calleeIsDeaf
    });

    return result;
  } catch (error) {
    console.error('[validateCallEligibility] ❌ Validation failed:', error);
    throw error;
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
  const currentCallRef = useRef<CallData | null>(null); // Keep ref in sync with state

  // Keep refs in sync with state
  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

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
      console.log('Data channel opened');
      flushPendingDataMessages();
    };
    
    dataChannel.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('[Data Channel 1] Received message:', data);
      if (data.type === 'sign-translation') {
        console.log('[Data Channel 1] Translation received - shouldSpeak:', data.message.shouldSpeak);
        setTranslationMessages(prev => [...prev, {...data.message, isLocal: false}]);
      } else if (data.type === 'speech-transcript') {
        setTranscriptMessages(prev => [...prev, data.message]);
      }
    };

    dataChannelRef.current = dataChannel;

    pc.ondatachannel = (event) => {
      const receiveChannel = event.channel;
      dataChannelRef.current = receiveChannel;
      receiveChannel.onopen = () => {
        console.log('Receive data channel opened');
        flushPendingDataMessages();
      };
      receiveChannel.onmessage = (msgEvent) => {
        const data = JSON.parse(msgEvent.data);
        console.log('[Data Channel 2] Received message:', data);
        if (data.type === 'sign-translation') {
          console.log('[Data Channel 2] Translation received - shouldSpeak:', data.message.shouldSpeak);
          setTranslationMessages(prev => [...prev, {...data.message, isLocal: false}]);
        } else if (data.type === 'speech-transcript') {
          setTranscriptMessages(prev => [...prev, data.message]);
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

    // Connect WebSocket
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
          // Update current call with actual callee info from callee's response
          const { callee } = message.payload as { callee?: CallPeer } || {};
          if (callee) {
            console.log('[call-accept] Updating callee info with actual isDeaf:', callee.isDeaf);
            setCurrentCall(prev => prev ? {
              ...prev,
              callee: callee // Use the actual callee info from the receiver
            } : null);
          }
          
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
            sendSignalingMessage(message.from, {
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
          console.log('Call rejected by other party');
          // Stop media tracks
          if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => {
              console.log('Stopping track on call-reject:', track.kind);
              track.stop();
            });
          }
          setCallState('idle');
          setCurrentCall(null);
          setLocalStream(null);
          break;
        }

        case 'call-end': {
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
            sendSignalingMessage(message.from, {
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
          console.log('[Signaling] Received sign-translation message:', message);
          if (message.payload) {
            // Messages from signaling should be marked as remote (isLocal: false)
            const remoteMessage = { ...message.payload as TranslationMessage, isLocal: false };
            console.log('[Signaling] Adding to translation messages with isLocal: false');
            setTranslationMessages(prev => [...prev, remoteMessage]);
          }
          break;
        }

        case 'speech-transcript': {
          if (message.payload) {
            setTranscriptMessages(prev => [...prev, message.payload as TranslationMessage]);
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
    const callId = `call-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newCall: CallData = {
      id: callId,
      caller: { id: currentUserId, username: currentUsername, isDeaf: isCurrentUserDeaf },
      callee: { id: contactId, username: contactUsername, isDeaf: isContactDeaf },
      state: 'calling'
    };
    
    console.log('=== INITIATE CALL ===', { caller: newCall.caller.username, isDeaf: isCurrentUserDeaf });
    setCurrentCall(newCall);
    setCallState('calling');

    let acquiredStream: MediaStream | null = null;
    try {
      await waitForWebSocketReady();
      
      // GET MEDIA AND CREATE PEER CONNECTION WITH TRACKS BEFORE SENDING ANY MESSAGE
      console.log('Requesting media...');
      acquiredStream = await getMediaStream(isCurrentUserDeaf);
      setLocalStream(acquiredStream);
      
      console.log('Creating peer connection with tracks...');
      const pc = createPeerConnection(acquiredStream);
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
      // Stop local stream tracks if we acquired the stream
      if (acquiredStream) {
        acquiredStream.getTracks().forEach(t => t.stop());
      }
      // Also try to stop from state in case partial stream was set
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
      }
      setCallState('idle');
      setCurrentCall(null);
      setLocalStream(null);
      throw error;
    }
  }, [currentUserId, currentUsername, isCurrentUserDeaf, getMediaStream, createPeerConnection]);

  const acceptCall = useCallback(async () => {
    if (!incomingCall) return;

    console.log('=== ACCEPT CALL ===', { caller: incomingCall.caller.username });
    const newCall: CallData = {
      id: incomingCall.id,
      caller: incomingCall.caller,
      callee: { id: currentUserId, username: currentUsername, isDeaf: isCurrentUserDeaf },
      state: 'connected'
    };
    
    // Store incomingCall reference before clearing it
    const acceptedCall = incomingCall;
    
    setCurrentCall(newCall);
    setCallState('connected');

    let acquiredStream: MediaStream | null = null;
    try {
      await waitForWebSocketReady();
      
      // GET MEDIA AND CREATE PEER CONNECTION WITH TRACKS BEFORE SENDING ACCEPT
      console.log('Requesting media...');
      acquiredStream = await getMediaStream(isCurrentUserDeaf);
      setLocalStream(acquiredStream);
      
      console.log('Creating peer connection with tracks...');
      const pc = createPeerConnection(acquiredStream);
      peerConnectionRef.current = pc;
      
      // Only clear incomingCall after successfully setting up the call
      setIncomingCall(null);
      
      // Notify caller with callee's actual peer info
      console.log('Sending call-accept with callee info');
      sendSignalingMessage(acceptedCall.caller.id, {
        type: 'call-accept',
        callId: acceptedCall.id,
        from: currentUserId,
        to: acceptedCall.caller.id,
        payload: { callee: newCall.callee }
      });
    } catch (error) {
      console.error('Accept call failed:', error);
      // Stop any acquired media tracks
      if (acquiredStream) {
        acquiredStream.getTracks().forEach(t => t.stop());
      }
      // Also try to stop from state in case partial stream was set
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
      }
      // On error, restore the incomingCall state so the modal can show again
      setIncomingCall(acceptedCall);
      setCallState('incoming');
      setCurrentCall(null);
      setLocalStream(null);
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
    
    // Clean up any media if partially acquired
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    
    setIncomingCall(null);
    setCallState('idle');
    setLocalStream(null);
  }, [incomingCall, currentUserId]);

  const endCallInternal = useCallback(() => {
    console.log('=== END CALL INTERNAL ===');
    
    if (peerConnectionRef.current) {
      console.log('Closing peer connection');
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    // CRITICAL: Stop all media tracks - use refs directly, don't rely on state
    // State changes may not reflect immediately due to React batching
    const allTracks: MediaStreamTrack[] = [];
    
    // Get tracks from both state and ref
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        console.log('[ENDCALL] Stopping local track from ref:', track.kind, 'enabled:', track.enabled);
        track.stop();
        allTracks.push(track);
      });
    }
    
    // Also check the current state value, in case there's a timing difference
    if (localStream && localStream !== localStreamRef.current) {
      localStream.getTracks().forEach(track => {
        if (!allTracks.includes(track)) {
          console.log('[ENDCALL] Stopping local track from state:', track.kind);
          track.stop();
          allTracks.push(track);
        }
      });
    }
    
    // Clean up remote stream
    if (remoteStream) {
      remoteStream.getTracks().forEach(track => {
        console.log('[ENDCALL] Stopping remote track:', track.kind);
        track.stop();
      });
    }
    
    // Close data channel
    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }
    
    // Update state
    setCallState('idle');
    setCurrentCall(null);
    setIncomingCall(null);
    setLocalStream(null);
    setRemoteStream(null);
    setTranslationMessages([]);
    setTranscriptMessages([]);
    
    console.log('=== END CALL INTERNAL COMPLETE - Stopped', allTracks.length, 'local tracks');
  }, [localStream]);

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

  const sendTranslation = useCallback((text: string, shouldSpeak: boolean, voiceSettings?: any) => {
    console.log('[sendTranslation] Called with text:', text, 'shouldSpeak:', shouldSpeak, 'voiceSettings:', voiceSettings);
    const message: TranslationMessage = {
      text,
      timestamp: Date.now(),
      shouldSpeak,
      voiceSettings
    };
    console.log('[sendTranslation] Message object:', message);
    
    const payload = JSON.stringify({
      type: 'sign-translation',
      message
    });

    if (dataChannelRef.current?.readyState === 'open') {
      console.log('[sendTranslation] Data channel OPEN - sending directly');
      dataChannelRef.current.send(payload);
    } else {
      console.log('[sendTranslation] Data channel NOT ready - using signaling, currentCall:', currentCall);
      pendingDataMessagesRef.current.push(payload);

      if (currentCall) {
        const otherUserId = currentCall.caller.id === currentUserId
          ? currentCall.callee.id
          : currentCall.caller.id;
        console.log('[sendTranslation] Sending via signaling to:', otherUserId);
        sendSignalingMessage(otherUserId, {
          type: 'sign-translation',
          callId: currentCall.id,
          from: currentUserId,
          to: otherUserId,
          payload: message
        });
      } else {
        console.log('[sendTranslation] WARNING - currentCall is null, message may not be sent!');
      }
    }

    // Also add to local state
    console.log('[sendTranslation] Adding to local state with isLocal: true');
    setTranslationMessages(prev => [...prev, {...message, isLocal: true}]);
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
        sendSignalingMessage(otherUserId, {
          type: 'speech-transcript',
          callId: currentCall.id,
          from: currentUserId,
          to: otherUserId,
          payload: message
        });
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
