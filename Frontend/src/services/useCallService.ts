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
// Uses VITE_NETWORK_IP for network access, falls back to localhost for single device
const signalingHost = import.meta.env.VITE_NETWORK_IP || 'localhost';
const WS_URL = import.meta.env.VITE_SIGNALING_URL ?? `wss://${signalingHost}:3001`;

let ws: WebSocket | null = null;
let messageCallbacks: Map<string, ((msg: SignalingMessage) => void)[]> = new Map();

const connectWebSocket = (userId: string, username: string) => {
  if (ws?.readyState === WebSocket.OPEN) return;
  
  ws = new WebSocket(WS_URL);
  
  ws.onopen = () => {
    console.log('WebSocket connected');
    // Register with the server
    ws?.send(JSON.stringify({
      type: 'register',
      userId,
      username
    }));
  };
  
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
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
    setTimeout(() => connectWebSocket(userId, username), 3000);
  };
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
      if (data.type === 'sign-translation') {
        setTranslationMessages(prev => [...prev, data.message]);
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
        if (data.type === 'sign-translation') {
          setTranslationMessages(prev => [...prev, data.message]);
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
    connectWebSocket(currentUserId, currentUsername);

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
          setCallState('idle');
          setCurrentCall(null);
          if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            setLocalStream(null);
          }
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
          if (message.payload) {
            setTranslationMessages(prev => [...prev, message.payload as TranslationMessage]);
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

    try {
      await waitForWebSocketReady();
      
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

    try {
      await waitForWebSocketReady();
      
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
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    
    setCallState('idle');
    setCurrentCall(null);
    setIncomingCall(null);
    setLocalStream(null);
    setRemoteStream(null);
    setTranslationMessages([]);
    setTranscriptMessages([]);
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

  const sendTranslation = useCallback((text: string, shouldSpeak: boolean) => {
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
      dataChannelRef.current.send(payload);
    } else {
      pendingDataMessagesRef.current.push(payload);

      if (currentCall) {
        const otherUserId = currentCall.caller.id === currentUserId
          ? currentCall.callee.id
          : currentCall.caller.id;
        sendSignalingMessage(otherUserId, {
          type: 'sign-translation',
          callId: currentCall.id,
          from: currentUserId,
          to: otherUserId,
          payload: message
        });
      }
    }

    // Also add to local state
    setTranslationMessages(prev => [...prev, message]);
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
