// Interface sounds, synthesized with WebAudio on the fly: no sound files.
// Nothing plays before the first click or key press (browser autoplay rules),
// and "Do not disturb" silences everything except feedback for your own
// actions (mute, deafen, joining and leaving a call).

export const SOUND_NAMES = ['join', 'leave', 'peerJoin', 'peerLeave', 'mute', 'unmute', 'deafen', 'message', 'mention', 'ring', 'screen', 'connected', 'lost'];
const OWN_ACTIONS = new Set(['join', 'leave', 'mute', 'unmute', 'deafen', 'undeafen']);

/** One enveloped oscillator note. */
function note(ctx, out, at, { freq, to, type = 'sine', dur = 0.12, gain = 0.6, attack = 0.006 }) {
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, at + dur);
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(gain, at + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(env).connect(out);
  osc.start(at);
  osc.stop(at + dur + 0.02);
}

const seq = (ctx, out, t, notes, opts = {}) => notes.forEach(([freq, delay, extra], i) => note(ctx, out, t + (delay ?? i * 0.09), { freq, ...opts, ...extra }));

/** Each recipe draws a short, distinct gesture. */
export const RECIPES = {
  join: (ctx, out, t) => seq(ctx, out, t, [[523.25], [783.99]], { type: 'triangle', dur: 0.16 }),
  leave: (ctx, out, t) => seq(ctx, out, t, [[783.99], [523.25]], { type: 'triangle', dur: 0.16 }),
  peerJoin: (ctx, out, t) => note(ctx, out, t, { freq: 659.25, to: 880, dur: 0.14, gain: 0.4 }),
  peerLeave: (ctx, out, t) => note(ctx, out, t, { freq: 880, to: 587.33, dur: 0.16, gain: 0.35 }),
  mute: (ctx, out, t) => seq(ctx, out, t, [[392], [293.66, 0.07]], { type: 'square', dur: 0.06, gain: 0.18 }),
  unmute: (ctx, out, t) => seq(ctx, out, t, [[293.66], [392, 0.07]], { type: 'square', dur: 0.06, gain: 0.18 }),
  deafen: (ctx, out, t) => seq(ctx, out, t, [[311.13], [233.08, 0.08]], { type: 'triangle', dur: 0.1, gain: 0.45 }),
  undeafen: (ctx, out, t) => seq(ctx, out, t, [[233.08], [311.13, 0.08]], { type: 'triangle', dur: 0.1, gain: 0.45 }),
  message: (ctx, out, t) => {
    note(ctx, out, t, { freq: 1046.5, dur: 0.2, gain: 0.3, attack: 0.002 });
    note(ctx, out, t, { freq: 2093, dur: 0.08, gain: 0.08, attack: 0.002 });
  },
  mention: (ctx, out, t) => seq(ctx, out, t, [[1174.66], [1567.98, 0.1]], { dur: 0.22, gain: 0.45, attack: 0.003 }),
  ring: (ctx, out, t) => seq(ctx, out, t, [[659.25], [783.99, 0.14], [987.77, 0.28], [783.99, 0.6], [987.77, 0.74]], { type: 'triangle', dur: 0.22, gain: 0.45 }),
  screen: (ctx, out, t) => note(ctx, out, t, { freq: 392, to: 987.77, dur: 0.28, gain: 0.35 }),
  connected: (ctx, out, t) => seq(ctx, out, t, [[523.25], [659.25], [783.99]], { dur: 0.14, gain: 0.35 }),
  lost: (ctx, out, t) => seq(ctx, out, t, [[523.25], [415.3], [329.63]], { dur: 0.16, gain: 0.3 }),
};

export class Sounds {
  constructor(app) {
    this.app = app;
    this.ctx = null;
    this.unlocked = false;
    this.ringTimer = null;
    this.last = new Map();
    const unlock = () => {
      this.unlocked = true;
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
    };
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
  }

  get volume() {
    const v = this.app.settings.soundVolume;
    return Number.isFinite(v) ? v : 50;
  }

  enabled(name) {
    const s = this.app.settings;
    if (!this.unlocked || this.volume <= 0) return false;
    if (s.sounds?.[name === 'undeafen' ? 'deafen' : name] === false) return false;
    if (s.dnd && !OWN_ACTIONS.has(name)) return false;
    return true;
  }

  _context() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    if (!this.ctx) {
      this.ctx = new Ctx();
      if (this.app.settings.outputId && this.ctx.setSinkId) this.ctx.setSinkId(this.app.settings.outputId).catch(() => {});
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  /** Play a sound by name. Repeats of the same sound within 250 ms are dropped. */
  play(name, { force = false } = {}) {
    if (!RECIPES[name] || (!force && !this.enabled(name))) return false;
    const now = performance.now();
    if (now - (this.last.get(name) || 0) < 250) return false;
    this.last.set(name, now);
    const ctx = this._context();
    if (!ctx) return false;
    const out = ctx.createGain();
    out.gain.value = (this.volume / 100) * 0.35;
    out.connect(ctx.destination);
    RECIPES[name](ctx, out, ctx.currentTime + 0.01);
    this.played = (this.played || 0) + 1;
    return true;
  }

  /** Loop the ring until stopRing(). */
  startRing() {
    if (this.ringTimer) return;
    this.play('ring');
    this.ringTimer = setInterval(() => {
      this.last.delete('ring');
      this.play('ring');
    }, 2400);
  }

  stopRing() {
    clearInterval(this.ringTimer);
    this.ringTimer = null;
  }
}
