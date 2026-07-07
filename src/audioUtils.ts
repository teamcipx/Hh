/**
 * Synthesizes a premium, authentic antique brass post office desk bell tone.
 * Uses Web Audio API sine wave synthesis with exponential decay envelopes.
 */
export const playPostalChime = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    // Helper to play a chime tone with exponential volume envelope
    const playTone = (freq: number, startTime: number, duration: number, volume: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, startTime);
      
      // Beautiful sound envelope: rapid rise, slow exponential tail
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.linearRampToValueAtTime(volume, startTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    const now = ctx.currentTime;
    
    // Primary colonial brass chime chords (sweet double strike resonance)
    // Strike 1 (High bell chime resonance: B5 987.77 Hz and E6 1318.51 Hz)
    playTone(987.77, now, 1.2, 0.08);
    playTone(1318.51, now + 0.01, 1.2, 0.05);
    
    // Strike 2 (Trailing sweet strike resonance after 110ms: E6 1318.51 Hz and G5 783.99 Hz)
    playTone(1318.51, now + 0.11, 0.9, 0.04);
    playTone(1567.98, now + 0.12, 0.9, 0.03);
    
  } catch (e) {
    console.warn("Audio context playback not permitted or failed:", e);
  }
};

/**
 * Synthesizes a bright, modern digital SMS double-beep notification sound.
 * Uses Web Audio API sine wave synthesis.
 */
export const playSmsSound = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    const playTone = (freq: number, startTime: number, duration: number, volume: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, startTime);
      
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.linearRampToValueAtTime(volume, startTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    // Nice bright digital SMS tone (beep-beep)
    playTone(1046.50, now, 0.08, 0.04); // High C6 beep
    playTone(1318.51, now + 0.11, 0.11, 0.04); // High E6 beep
  } catch (e) {
    console.warn("Audio context playback not permitted or failed:", e);
  }
};
