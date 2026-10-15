// Call helpers with no browser state: microphone constraints for voice and
// music, the audio send bitrate, local recording formats and file names, and a
// small rate limit for the live reactions that fly over a call.

/** Opus bitrate cap in music mode. Voice mode leaves the browser default (about 32 kbps). */
export const MUSIC_BITRATE = 128000;

/**
 * getUserMedia audio constraints. Voice: echo cancellation and automatic gain
 * always on, noise suppression and voice isolation unless the mode is 'off'.
 * Music: every voice filter off and stereo when the device has it, so
 * instruments and singing keep their dynamics.
 */
export function micConstraints({ noiseMode = 'strong', music = false, supported = {}, inputId = '' } = {}) {
  const clean = !music && noiseMode !== 'off';
  const audio = music
    ? { echoCancellation: false, autoGainControl: false, noiseSuppression: false, channelCount: { ideal: 2 }, sampleRate: { ideal: 48000 } }
    : { echoCancellation: true, autoGainControl: true, noiseSuppression: clean };
  if (supported.voiceIsolation) audio.voiceIsolation = clean;
  if (inputId) audio.deviceId = { exact: inputId };
  return audio;
}

/** Whether our own noise suppression worklet should run. */
export function usesDenoise({ noiseMode = 'strong', music = false } = {}) {
  return !music && noiseMode === 'strong';
}

/**
 * RTCRtpSender parameters with the bitrate cap set (a number) or removed
 * (null). Returns null when nothing would change or the encodings are not
 * negotiated yet, so the caller can try again later.
 */
export function tunedParameters(params, bitrate) {
  const enc = params?.encodings;
  if (!Array.isArray(enc) || !enc.length) return null;
  const want = bitrate || null;
  if ((enc[0].maxBitrate || null) === want) return null;
  const first = { ...enc[0] };
  if (want) first.maxBitrate = want;
  else delete first.maxBitrate;
  return { ...params, encodings: [first, ...enc.slice(1)] };
}

/** Recording containers in order of preference. */
export const RECORDING_TYPES = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/webm'];

/** The first type MediaRecorder supports here, or '' to let the browser pick. */
export function pickRecordingType(isSupported) {
  for (const type of RECORDING_TYPES) {
    try {
      if (isSupported(type)) return type;
    } catch {
      // a browser without isTypeSupported
    }
  }
  return '';
}

const pad = (n) => String(n).padStart(2, '0');

/** A file name like howlden-night-owls-2026-10-15-2130.webm. */
export function recordingFileName(label, date, type = '') {
  const slug =
    String(label || '')
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40)
      .replace(/-+$/, '') || 'call';
  const stamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
  const ext = /mp4/.test(type) ? 'm4a' : /ogg/.test(type) ? 'ogg' : 'webm';
  return `howlden-${slug}-${stamp}.${ext}`;
}

/** 75000 ms reads 1:15; an hour or more reads 1:02:03. */
export function formatDuration(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** At most `max` events per key in any `windowMs`. */
export class RateLimit {
  constructor({ max = 6, windowMs = 2000 } = {}) {
    this.max = max;
    this.windowMs = windowMs;
    this.hits = new Map();
  }

  allow(key, now = Date.now()) {
    const recent = (this.hits.get(key) || []).filter((t) => now - t < this.windowMs);
    const ok = recent.length < this.max;
    if (ok) recent.push(now);
    this.hits.set(key, recent);
    return ok;
  }
}
