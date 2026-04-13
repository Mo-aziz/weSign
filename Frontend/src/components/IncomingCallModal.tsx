import React from 'react';
import { useAppContext } from '../context/useAppContext';
import type { CallData } from '../services/useCallService';

interface IncomingCallModalProps {
  incomingCall: CallData | null;
  onAccept: () => void;
  onReject: () => void;
}

const IncomingCallModal: React.FC<IncomingCallModalProps> = ({ 
  incomingCall, 
  onAccept, 
  onReject 
}) => {
  const { user } = useAppContext();
  
  if (!incomingCall) return null;
  
  // Validate: block hearing-to-hearing calls at UI level
  const isHeartingToHearing = !incomingCall.caller.isDeaf && user && !user.isDeaf;
  const canAcceptCall = !isHeartingToHearing;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-slate-700 bg-slate-900 p-8 shadow-2xl">
        <div className="text-center">
          {/* Animated ringing icon */}
          <div className="mb-6 flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 animate-ping rounded-full bg-brand-500/30" />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-brand-600">
                <svg 
                  className="h-10 w-10 text-white" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" 
                  />
                </svg>
              </div>
            </div>
          </div>

          <h2 className="mb-2 text-2xl font-bold text-white">
            Incoming Call
          </h2>
          
          <p className="mb-6 text-lg text-slate-300">
            <span className="font-semibold text-brand-400">@{incomingCall.caller.username}</span>
            {' '}is calling you
          </p>

          <div className="mb-6 rounded-2xl bg-slate-800/50 p-4">
            <p className="text-sm text-slate-400">
              {incomingCall.caller.isDeaf 
                ? 'Sign language communicator is requesting a video call'
                : 'Voice communicator is requesting an audio call'
              }
            </p>
          </div>

          {isHeartingToHearing && (
            <div className="mb-6 rounded-2xl bg-rose-900/40 border border-rose-700 p-4">
              <p className="text-sm text-rose-300 font-semibold">
                ⚠️ This call cannot be accepted - hearing-to-hearing calls are not allowed.
              </p>
              <p className="text-xs text-rose-400 mt-2">
                Please call or accept calls from Deaf or Hard of Hearing users.
              </p>
            </div>
          )}

          <div className="flex gap-4">
            <button
              onClick={onReject}
              className="flex-1 rounded-2xl border-2 border-rose-500 bg-rose-500/10 px-6 py-4 font-semibold text-rose-400 transition hover:bg-rose-500 hover:text-white"
            >
              <div className="flex items-center justify-center gap-2">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Decline
              </div>
            </button>

            <button
              onClick={onAccept}
              disabled={!canAcceptCall}
              className={`flex-1 rounded-2xl px-6 py-4 font-semibold transition ${
                canAcceptCall 
                  ? 'bg-brand-600 text-white hover:bg-brand-500' 
                  : 'bg-slate-600 text-slate-400 cursor-not-allowed opacity-50'
              }`}
              title={!canAcceptCall ? 'Hearing-to-hearing calls are not allowed' : 'Accept call'}
            >
              <div className="flex items-center justify-center gap-2">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                Accept
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IncomingCallModal;
