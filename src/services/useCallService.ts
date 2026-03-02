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
// For local testing: ws://localhost:3001
// For production: Replace with your server IP address (e.g., ws://192.168.1.100:3001)
const WS_URL = 'ws://192.168.56.1:3001';

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
    console.warn('WebSocket not connected, message not sent');
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

  // Initialize peer connection
  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && currentCall) {
        const otherUserId = currentCall.caller.id === currentUserId 
          ? currentCall.callee.id 
          : currentCall.caller.id;
          
        sendSignalingMessage(otherUserId, {
          type: 'ice-candidate',
          callId: currentCall.id,
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
  }, [currentCall, currentUserId]);

  // Get media stream
  const getMediaStream = useCallback(async (isDeaf: boolean) => {
    try {
      if (isDeaf) {
        // Sign language user needs camera
        return await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 },
          audio: false
        });
      } else {
        // Normal user needs microphone
        return await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: true
        });
      }
    } catch (error) {
      console.error('Error accessing media devices:', error);
      throw error;
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
          setCallState('connected');
          setCurrentCall(prev => prev ? { ...prev, state: 'connected', startTime: Date.now() } : null);
          
          // Create offer as the caller
          const pc = createPeerConnection();
          peerConnectionRef.current = pc;
          
          if (localStream) {
            localStream.getTracks().forEach(track => {
              pc.addTrack(track, localStream);
            });
          }
          
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          
          sendSignalingMessage(message.from, {
            type: 'offer',
            callId: message.callId,
            from: currentUserId,
            to: message.from,
            payload: offer
          });
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
          const pc = createPeerConnection();
          peerConnectionRef.current = pc;
          
          if (localStream) {
            localStream.getTracks().forEach(track => {
              pc.addTrack(track, localStream);
            });
          }
          
          await pc.setRemoteDescription(new RTCSessionDescription(message.payload as RTCSessionDescriptionInit));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          
          sendSignalingMessage(message.from, {
            type: 'answer',
            callId: message.callId,
            from: currentUserId,
            to: message.from,
            payload: answer
          });
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
      }
    };

    unsubscribeRef.current = subscribeToSignaling(currentUserId, handleMessage);

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [currentUserId, currentUsername, isCurrentUserDeaf, createPeerConnection, localStream]);

  const initiateCall = useCallback(async (contactId: string, contactUsername: string, isContactDeaf: boolean) => {
    const callId = `call-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const newCall: CallData = {
      id: callId,
      caller: { id: currentUserId, username: currentUsername, isDeaf: isCurrentUserDeaf },
      callee: { id: contactId, username: contactUsername, isDeaf: isContactDeaf },
      state: 'calling'
    };
    
    setCurrentCall(newCall);
    setCallState('calling');
    
    // Get appropriate media stream
    const stream = await getMediaStream(isCurrentUserDeaf);
    setLocalStream(stream);
    
    // Send call invite
    sendSignalingMessage(contactId, {
      type: 'call-invite',
      callId,
      from: currentUserId,
      to: contactId,
      payload: { caller: newCall.caller, callId }
    });
  }, [currentUserId, currentUsername, isCurrentUserDeaf, getMediaStream]);

  const acceptCall = useCallback(async () => {
    if (!incomingCall) return;
    
    setCurrentCall(incomingCall);
    setIncomingCall(null);
    setCallState('connected');
    
    // Get appropriate media stream
    const stream = await getMediaStream(isCurrentUserDeaf);
    setLocalStream(stream);
    
    // Notify caller
    sendSignalingMessage(incomingCall.caller.id, {
      type: 'call-accept',
      callId: incomingCall.id,
      from: currentUserId,
      to: incomingCall.caller.id
    });
  }, [incomingCall, currentUserId, isCurrentUserDeaf, getMediaStream]);

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
    if (dataChannelRef.current?.readyState === 'open') {
      const message: TranslationMessage = {
        text,
        timestamp: Date.now(),
        shouldSpeak
      };
      
      dataChannelRef.current.send(JSON.stringify({
        type: 'sign-translation',
        message
      }));
      
      // Also add to local state
      setTranslationMessages(prev => [...prev, message]);
    }
  }, []);

  const sendTranscript = useCallback((text: string) => {
    if (dataChannelRef.current?.readyState === 'open') {
      const message: TranslationMessage = {
        text,
        timestamp: Date.now(),
        shouldSpeak: false
      };
      
      dataChannelRef.current.send(JSON.stringify({
        type: 'speech-transcript',
        message
      }));
      
      // Also add to local state
      setTranscriptMessages(prev => [...prev, message]);
    }
  }, []);

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
