// ─── Knight Orc Assault — Programmatic Audio System ───
// All sounds generated with Web Audio API oscillators and noise buffers.
// AudioContext created on first user interaction to comply with autoplay policies.

let audioCtx = null;
let masterGain = null;
let musicGain = null;
let sfxGain = null;
let muted = false;
let musicPlaying = false;
let musicInterval = null;
let musicOscillators = [];
let bossModeActive = false;

// ─── Throttling ──────────────────────────────────────────────────

const throttles = {};
function throttled(key, fn, minInterval = 0.1) {
  const now = audioCtx ? audioCtx.currentTime : 0;
  if (!throttles[key] || now - throttles[key] >= minInterval) {
    throttles[key] = now;
    fn();
  }
}

// ─── Core Setup ──────────────────────────────────────────────────

export function initAudio() {
  // Context created lazily on first user gesture
}

export function ensureContext() {
  if (audioCtx) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return true;
  }
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.connect(audioCtx.destination);
    sfxGain = audioCtx.createGain();
    sfxGain.gain.value = 0.5;
    sfxGain.connect(masterGain);
    musicGain = audioCtx.createGain();
    musicGain.gain.value = 0.3;
    musicGain.connect(masterGain);
    return true;
  } catch (e) {
    return false;
  }
}

// ─── Noise Helper ────────────────────────────────────────────────

function createNoiseBuffer(duration) {
  const sampleRate = audioCtx.sampleRate;
  const length = Math.floor(sampleRate * duration);
  const buffer = audioCtx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function playNoise(duration, volume = 0.15, filterFreq = 0, filterType = 'bandpass') {
  const source = audioCtx.createBufferSource();
  source.buffer = createNoiseBuffer(duration);
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(volume, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

  if (filterFreq > 0) {
    const filter = audioCtx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = filterFreq;
    source.connect(filter);
    filter.connect(gain);
  } else {
    source.connect(gain);
  }
  gain.connect(sfxGain);
  source.start();
  source.stop(audioCtx.currentTime + duration);
}

// ─── Oscillator Helper ──────────────────────────────────────────

function playTone(type, freqStart, freqEnd, duration, volume = 0.2, delay = 0, target = null) {
  const t = audioCtx.currentTime + delay;
  const osc = audioCtx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freqStart, t);
  if (freqEnd !== freqStart) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), t + duration);
  }
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
  osc.connect(gain);
  gain.connect(target || sfxGain);
  osc.start(t);
  osc.stop(t + duration);
  return osc;
}

// ─── Sound Effects ───────────────────────────────────────────────

export function playSwordSwing() {
  if (!ensureContext()) return;
  playTone('sine', 400, 200, 0.1, 0.12);
  playNoise(0.08, 0.06, 3000, 'highpass');
}

export function playHeavyHit() {
  if (!ensureContext()) return;
  throttled('heavyHit', () => {
    playTone('triangle', 80, 40, 0.15, 0.25);
    playNoise(0.08, 0.12, 800, 'lowpass');
  }, 0.05);
}

export function playCrossbowFire() {
  if (!ensureContext()) return;
  playTone('sine', 600, 300, 0.05, 0.15);
  playNoise(0.03, 0.05, 4000, 'highpass');
}

export function playEnemyDeath() {
  if (!ensureContext()) return;
  throttled('enemyDeath', () => {
    playTone('sine', 60, 30, 0.2, 0.2);
    playNoise(0.06, 0.08, 500, 'lowpass');
  }, 0.05);
}

export function playBarricadeHit() {
  if (!ensureContext()) return;
  throttled('barricadeHit', () => {
    playTone('triangle', 120, 80, 0.1, 0.18);
    playNoise(0.06, 0.08, 1200, 'bandpass');
  }, 0.1);
}

export function playBarricadeBreak() {
  if (!ensureContext()) return;
  playNoise(0.3, 0.2, 2000, 'bandpass');
  playTone('sine', 200, 50, 0.3, 0.2);
}

export function playGoldPickup() {
  if (!ensureContext()) return;
  playTone('sine', 1200, 1200, 0.08, 0.12);
  playTone('sine', 1500, 1500, 0.08, 0.12, 0.08);
}

export function playPlayerDamage() {
  if (!ensureContext()) return;
  const t = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(300, t);
  osc.frequency.exponentialRampToValueAtTime(200, t + 0.15);
  // Vibrato via LFO
  const lfo = audioCtx.createOscillator();
  lfo.frequency.value = 20;
  const lfoGain = audioCtx.createGain();
  lfoGain.gain.value = 15;
  lfo.connect(lfoGain);
  lfoGain.connect(osc.frequency);
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.15, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
  osc.connect(gain);
  gain.connect(sfxGain);
  osc.start(t);
  osc.stop(t + 0.15);
  lfo.start(t);
  lfo.stop(t + 0.15);
}

export function playLevelUp() {
  if (!ensureContext()) return;
  // C5=523, E5=659, G5=784, C6=1047 — ascending chime
  const notes = [523, 659, 784, 1047];
  for (let i = 0; i < notes.length; i++) {
    playTone('sine', notes[i], notes[i], 0.12, 0.15, i * 0.1);
  }
}

export function playWaveStart() {
  if (!ensureContext()) return;
  const t = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(220, t);
  // Slight vibrato
  const lfo = audioCtx.createOscillator();
  lfo.frequency.value = 6;
  const lfoGain = audioCtx.createGain();
  lfoGain.gain.value = 8;
  lfo.connect(lfoGain);
  lfoGain.connect(osc.frequency);
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.001, t);
  gain.gain.linearRampToValueAtTime(0.2, t + 0.2);
  gain.gain.linearRampToValueAtTime(0.001, t + 0.5);
  osc.connect(gain);
  gain.connect(sfxGain);
  osc.start(t);
  osc.stop(t + 0.5);
  lfo.start(t);
  lfo.stop(t + 0.5);
}

export function playBossSpawn() {
  if (!ensureContext()) return;
  const t = audioCtx.currentTime;
  const duration = 1.0;
  // Deep sine rumble: two close frequencies create beating
  const osc1 = audioCtx.createOscillator();
  osc1.type = 'sine';
  osc1.frequency.value = 40;
  const osc2 = audioCtx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.value = 50;
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.001, t);
  gain.gain.linearRampToValueAtTime(0.3, t + 0.6);
  gain.gain.linearRampToValueAtTime(0.001, t + duration);
  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(sfxGain);
  osc1.start(t);
  osc1.stop(t + duration);
  osc2.start(t);
  osc2.stop(t + duration);
  playNoise(duration, 0.08, 200, 'lowpass');
}

export function playCritHit() {
  if (!ensureContext()) return;
  // Sharper, brighter impact than regular hit
  // High metallic ring + impact
  playTone('sine', 1500, 800, 0.08, 0.2);   // metallic ring
  playTone('triangle', 100, 40, 0.12, 0.25); // bass impact
  playNoise(0.06, 0.1, 3000, 'highpass');     // sharp crack
}

export function playRepair() {
  if (!ensureContext()) return;
  // 3 quick hammering taps
  for (let i = 0; i < 3; i++) {
    playTone('triangle', 800, 600, 0.05, 0.12, i * 0.1);
  }
}

export function playShopClick() {
  if (!ensureContext()) return;
  playTone('sine', 1000, 1000, 0.03, 0.1);
}

export function playPurchase() {
  if (!ensureContext()) return;
  playTone('sine', 800, 800, 0.06, 0.12);
  playTone('sine', 1200, 1200, 0.06, 0.12, 0.06);
}

export function playHordeDrum() {
  if (!ensureContext()) return;
  for (let i = 0; i < 4; i++) {
    playTone('triangle', 80, 40, 0.10, 0.3, i * 0.125);
  }
  playNoise(0.5, 0.12, 200, 'lowpass');
}

export function playWarCryHorn() {
  if (!ensureContext()) return;
  playTone('sawtooth', 220, 330, 0.4, 0.25);
  playTone('sawtooth', 440, 550, 0.3, 0.2, 0.15);
}

// ─── Background Music — Chiptune Medieval Loop ──────────────────

// Simple chord progression in Am: A2, F2, C3, G2
const BASS_NOTES_NORMAL = [110, 87.3, 130.8, 98];
const MELODY_NORMAL = [
  // Pentatonic melody notes (A minor pentatonic: A C D E G)
  440, 523, 587, 659, 784, 659, 523, 440,
];
const BASS_NOTES_BOSS = [73.4, 58.3, 87.3, 65.4]; // lower octave
const MELODY_BOSS = [
  330, 392, 440, 392, 330, 294, 261, 294,
];

let musicNoteIndex = 0;
let musicBassIndex = 0;

// Shared music scheduling function — reads bossModeActive at call time
function scheduleBar() {
  if (!musicPlaying || !audioCtx) return;

  const bassNotes = bossModeActive ? BASS_NOTES_BOSS : BASS_NOTES_NORMAL;
  const melodyNotes = bossModeActive ? MELODY_BOSS : MELODY_NORMAL;
  const noteDuration = bossModeActive ? 0.12 : 0.18;

  // Bass note (one per bar = 2 melody notes)
  if (musicNoteIndex % 2 === 0) {
    const bassFreq = bassNotes[musicBassIndex % bassNotes.length];
    playTone('square', bassFreq, bassFreq, noteDuration * 1.8, 0.08, 0, musicGain);
    musicBassIndex++;
  }

  // Melody note
  const melFreq = melodyNotes[musicNoteIndex % melodyNotes.length];
  playTone('triangle', melFreq, melFreq, noteDuration, 0.06, 0, musicGain);

  // Boss mode: extra tension oscillator
  if (bossModeActive && musicNoteIndex % 4 === 0) {
    playTone('sawtooth', melFreq * 0.5, melFreq * 0.5, noteDuration * 2, 0.03, 0, musicGain);
  }

  musicNoteIndex++;
}

function startMusicInterval() {
  if (musicInterval) clearInterval(musicInterval);
  const tempo = bossModeActive ? 180 : 250;
  scheduleBar(); // first note immediately
  musicInterval = setInterval(scheduleBar, tempo);
}

export function startMusic(isBossWave = false) {
  if (!ensureContext()) return;
  if (musicPlaying) {
    setBossIntensity(isBossWave);
    return;
  }
  musicPlaying = true;
  bossModeActive = isBossWave;
  musicNoteIndex = 0;
  musicBassIndex = 0;
  musicGain.gain.setValueAtTime(0.3, audioCtx.currentTime); // restore gain for new music
  startMusicInterval();
}

export function stopMusic() {
  musicPlaying = false;
  if (musicInterval) {
    clearInterval(musicInterval);
    musicInterval = null;
  }
  // Fade out music gain gracefully — don't restore gain afterward (startMusic will do it)
  if (audioCtx && musicGain) {
    musicGain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
  }
}

export function setBossIntensity(isBoss) {
  if (bossModeActive === isBoss) return; // no change
  bossModeActive = isBoss;
  if (!musicPlaying) return;
  // Restart interval with new tempo, shared scheduleBar reads bossModeActive
  startMusicInterval();
}

// ─── Volume / Mute Controls ─────────────────────────────────────

export function toggleMute() {
  if (!ensureContext()) return muted;
  muted = !muted;
  masterGain.gain.setValueAtTime(muted ? 0 : 1, audioCtx.currentTime);
  return muted;
}

export function setVolume(vol) {
  if (!audioCtx || !masterGain) return;
  masterGain.gain.setValueAtTime(muted ? 0 : vol, audioCtx.currentTime);
}

export function isMuted() {
  return muted;
}
