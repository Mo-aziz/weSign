let audioCtx: AudioContext | null = null;
let oscillator: OscillatorNode | null = null;
let gainNode: GainNode | null = null;
let ringInterval: ReturnType<typeof setInterval> | null = null;
let isRinging = false;

const initAudio = () => {
  if (!audioCtx) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
};

const playRingBeep = () => {
  if (!audioCtx) return;
  
  if (audioCtx.state === 'suspended') {
    void audioCtx.resume();
  }

  oscillator = audioCtx.createOscillator();
  gainNode = audioCtx.createGain();

  // Create a pleasant, dual-tone ring similar to standard phones
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(440, audioCtx.currentTime); 
  
  const osc2 = audioCtx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(480, audioCtx.currentTime);

  // Volume envelope for the ring (2 seconds ringing)
  gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
  gainNode.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.1);
  gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime + 1.9);
  gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 2.0);

  oscillator.connect(gainNode);
  osc2.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  oscillator.start(audioCtx.currentTime);
  osc2.start(audioCtx.currentTime);
  
  oscillator.stop(audioCtx.currentTime + 2.0);
  osc2.stop(audioCtx.currentTime + 2.0);
};

export const startRinging = () => {
  if (isRinging) return;
  isRinging = true;
  
  initAudio();
  
  // Play first beep immediately
  playRingBeep();
  
  // Then repeat every 4 seconds (2s beep, 2s silence)
  ringInterval = setInterval(() => {
    playRingBeep();
  }, 4000);
};

export const stopRinging = () => {
  if (!isRinging) return;
  isRinging = false;
  
  if (ringInterval) {
    clearInterval(ringInterval);
    ringInterval = null;
  }
  
  if (gainNode && audioCtx) {
    // Fade out quickly instead of abrupt cut
    gainNode.gain.cancelScheduledValues(audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.1);
  }
};
