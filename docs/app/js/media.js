// Voice and video: the local microphone, camera and screen, remote playback,
// per member volume, output device, push to talk, music mode, local call
// recording and the speaking ring.

import { Emitter } from '../core/mesh.js';
import { MUSIC_BITRATE, micConstraints, pickRecordingType, tunedParameters, usesDenoise } from '../core/call.js';

const SLOTS = ['mic', 'camera', 'screen'];
const SPEAK_LEVEL = 0.018;
const SPEAK_HOLD = 280;

export class MediaManager extends Emitter {
  constructor(app) {
    super();
    this.app = app;
    this.current = null;
    this.mic = null;
    this.camera = null;
    this.screen = null;
    this.muted = false;
    this.deafened = false;
    this.pttHeld = false;
    this.music = false;
    this.recorder = null;
    this.remote = new Map();
    this.ctx = null;
    this.meters = new Map();
    this.speaking = new Set();
    this.lastLoud = new Map();
    this.sink = document.createElement('div');
    this.sink.hidden = true;
    document.body.append(this.sink);
    this.timer = setInterval(() => this._measure(), 90);
    this._keys();
  }

  get settings() {
    return this.app.settings;
  }

  inVoice(session, channelId) {
    return !!this.current && this.current.session === session && (!channelId || this.current.channel === channelId);
  }

  stateFor(session) {
    if (!this.inVoice(session)) return null;
    return { channel: this.current.channel, muted: this.muted || !this.mic, deafened: this.deafened, camera: !!this.camera, screen: !!this.screen, music: this.music, rec: !!this.recorder };
  }

  /** Noise suppression mode: 'off', 'standard' (browser only) or 'strong' (browser plus our own DSP). */
  get noiseMode() {
    return this.settings.noiseMode || 'strong';
  }

  get sensitivity() {
    return (this.settings.gateSensitivity ?? 50) / 100;
  }

  /** Voice: echo cancellation and automatic gain always on, noise suppression by mode. Music: all of them off. */
  _constraints() {
    const supported = navigator.mediaDevices?.getSupportedConstraints?.() || {};
    return micConstraints({ noiseMode: this.noiseMode, music: this.music, supported, inputId: this.settings.inputId });
  }

  /**
   * Open the microphone and, in Strong mode, run it through the noise
   * suppression worklet. Returns { raw, out, chain }: out is what peers get.
   */
  async _openPipe() {
    const raw = await this._openMic();
    for (const track of raw.getAudioTracks()) if ('contentHint' in track) track.contentHint = this.music ? 'music' : 'speech';
    if (!usesDenoise({ noiseMode: this.noiseMode, music: this.music }) || !this.ctx?.audioWorklet || typeof AudioWorkletNode === 'undefined') return { raw, out: raw, chain: null };
    try {
      this.workletReady ??= this.ctx.audioWorklet.addModule(new URL('./denoise-worklet.js', import.meta.url));
      await this.workletReady;
      const src = this.ctx.createMediaStreamSource(raw);
      const node = new AudioWorkletNode(this.ctx, 'howlden-denoise', { processorOptions: { sensitivity: this.sensitivity } });
      const dest = this.ctx.createMediaStreamDestination();
      src.connect(node);
      node.connect(dest);
      const pipe = { raw, out: dest.stream, chain: { src, node, dest } };
      node.port.onmessage = (e) => {
        pipe.level = e.data;
        this.emit('mic-level', e.data);
      };
      return pipe;
    } catch (err) {
      console.warn('howlden: noise suppression is not available here', err);
      this.workletReady = null;
      return { raw, out: raw, chain: null };
    }
  }

  _closePipe(pipe) {
    if (!pipe) return;
    try {
      pipe.chain?.src.disconnect();
      pipe.chain?.node.disconnect();
    } catch {
      // already disconnected
    }
    this._stop(pipe.raw);
    if (pipe.out !== pipe.raw) this._stop(pipe.out);
  }

  /** Whether the outgoing microphone runs through our own noise suppression right now. */
  get processing() {
    return this.pipe?.chain ? 'strong' : this.pipe ? (this.music ? 'music' : this.noiseMode) : null;
  }

  setSensitivity(value) {
    this.settings.gateSensitivity = value;
    this.app.saveSettings();
    for (const pipe of [this.pipe, this.testPipe]) pipe?.chain?.node.port.postMessage({ sensitivity: this.sensitivity });
  }

  /** Hear yourself, processed, for the mic test in settings. Returns a stop function. */
  async startMicTest() {
    this._ensureContext();
    this.stopMicTest();
    const pipe = await this._openPipe();
    this.testPipe = pipe;
    const el = document.createElement('audio');
    el.autoplay = true;
    el.srcObject = pipe.out;
    if (this.settings.outputId && el.setSinkId) el.setSinkId(this.settings.outputId).catch(() => {});
    this.sink.append(el);
    el.play().catch(() => {});
    pipe.el = el;
    this._meter('test', pipe.out);
    return () => this.stopMicTest();
  }

  stopMicTest() {
    const pipe = this.testPipe;
    if (!pipe) return;
    this.testPipe = null;
    pipe.el?.remove();
    this._unmeter('test');
    this._closePipe(pipe);
  }

  /** The latest level report from the noise suppressor (dBFS, gate state), if it runs. */
  get micLevel() {
    return this.testPipe?.level || this.pipe?.level || null;
  }

  async _openMic() {
    try {
      return await navigator.mediaDevices.getUserMedia({ audio: this._constraints() });
    } catch (err) {
      if (err.name === 'OverconstrainedError' && this.settings.inputId) {
        this.settings.inputId = '';
        return navigator.mediaDevices.getUserMedia({ audio: this._constraints() });
      }
      throw err;
    }
  }

  async join(session, channelId) {
    if (this.inVoice(session, channelId)) return;
    if (this.current) this.leave();
    this._ensureContext();
    this.current = { session, channel: channelId };
    try {
      this.pipe = await this._openPipe();
      this.mic = this.pipe.out;
      this._meter('self', this.mic);
    } catch (err) {
      this.pipe = null;
      this.mic = null;
      this.emit('error', err.name === 'NotAllowedError' ? 'mic-denied' : err.name === 'NotFoundError' ? 'mic-missing' : 'mic-failed');
    }
    if (!this.current || this.current.session !== session) {
      this._closePipe(this.pipe);
      this.pipe = null;
      this.mic = null;
      return;
    }
    this._gate();
    this._announce();
    for (const peerId of session.mesh?.links.keys() || []) this.sync(session, peerId);
    this.emit('sound', 'join');
    this.emit('change');
  }

  leave() {
    if (!this.current) return;
    if (this.recorder) this.stopRecording();
    const { session } = this.current;
    this.current = null;
    this.music = false;
    this.hiddenVideo?.clear();
    this._closePipe(this.pipe);
    for (const s of [this.camera, this.screen]) this._stop(s);
    this.pipe = null;
    this.mic = this.camera = this.screen = null;
    this._unmeter('self');
    session.send({ type: 'voice', channel: null });
    for (const [peerId, link] of session.mesh?.links || []) {
      for (const slot of SLOTS) if (link.senders?.[slot]) link.setTrack(slot, null);
      this._dropAudio(`${session.id}:${peerId}`);
    }
    this.emit('sound', 'leave');
    this.emit('change');
  }

  leaveIfIn(session) {
    if (this.inVoice(session)) this.leave();
  }

  _announce() {
    const state = this.stateFor(this.current?.session);
    if (state) this.current.session.send({ type: 'voice', ...state });
  }

  /** Make the tracks I send to one peer match whether we share a voice channel. */
  sync(session, peerId) {
    const link = session.mesh?.links.get(peerId);
    if (!link?.setTrack) return;
    const together = this.inVoice(session) && session.voice.get(peerId)?.channel === this.current.channel;
    const streams = { mic: this.mic, camera: this.camera, screen: this.screen };
    for (const slot of SLOTS) {
      const stream = together ? streams[slot] : null;
      const track = stream && (slot === 'mic' ? stream.getAudioTracks()[0] : stream.getVideoTracks()[0]);
      const sender = link.senders[slot];
      if (track && sender?.track === track) continue;
      if (track || sender) link.setTrack(slot, track || null, stream);
      if (slot === 'mic' && track) this._tune(link);
    }
    if (!together) this._dropAudio(`${session.id}:${peerId}`);
  }

  attach(session, peerId, link) {
    const key = `${session.id}:${peerId}`;
    link.ontrack = ({ track, stream }) => {
      const entry = this.remote.get(key) || { streams: new Map(), audio: new Map(), peerId, session };
      this.remote.set(key, entry);
      entry.streams.set(stream.id, stream);
      const refresh = () => this.emit('video');
      track.addEventListener('ended', refresh);
      track.addEventListener('mute', refresh);
      track.addEventListener('unmute', refresh);
      stream.addEventListener('removetrack', refresh);
      if (track.kind === 'audio' && this.inVoice(session)) this._playAudio(key, entry, stream);
      refresh();
    };
    link.onmedia = () => this.emit('video');
  }

  detach(session, peerId) {
    const key = `${session.id}:${peerId}`;
    this._dropAudio(key);
    this.remote.delete(key);
    this.emit('video');
  }

  _playAudio(key, entry, stream) {
    if (entry.audio.has(stream.id)) return;
    const el = document.createElement('audio');
    el.autoplay = true;
    el.srcObject = stream;
    el.muted = this.deafened || this.isLocalMuted(entry.peerId);
    el.volume = this.volumeOf(entry.peerId) / 100;
    if (this.settings.outputId && el.setSinkId) el.setSinkId(this.settings.outputId).catch(() => {});
    this.sink.append(el);
    el.play().catch(() => this.emit('error', 'autoplay'));
    entry.audio.set(stream.id, el);
    this._meter(key, stream);
    this._recordSources();
  }

  _dropAudio(key) {
    const entry = this.remote.get(key);
    if (!entry) return;
    for (const el of entry.audio.values()) {
      el.srcObject = null;
      el.remove();
    }
    entry.audio.clear();
    this._unmeter(key);
    this._recordSources();
  }

  /** The remote stream of one member in a slot, if it carries a live video track. */
  remoteVideo(session, peerId, slot) {
    const link = session.mesh?.links.get(peerId);
    const entry = this.remote.get(`${session.id}:${peerId}`);
    const id = link?.remoteMedia?.[slot];
    const stream = id && entry?.streams.get(id);
    const track = stream?.getVideoTracks()[0];
    return track && track.readyState === 'live' && !track.muted ? stream : null;
  }

  volumeOf(peerId) {
    const v = this.settings.volumes?.[peerId];
    return Number.isFinite(v) ? v : 100;
  }

  setVolume(peerId, value) {
    this.settings.volumes = { ...this.settings.volumes, [peerId]: value };
    this.app.saveSettings();
    for (const entry of this.remote.values()) {
      if (entry.peerId !== peerId) continue;
      for (const el of entry.audio.values()) el.volume = value / 100;
    }
  }

  /** Muted on this device only: the others still hear this person. */
  isLocalMuted(peerId) {
    return !!this.settings.localMuted?.[peerId];
  }

  setLocalMute(peerId, on) {
    const map = { ...this.settings.localMuted };
    if (on) map[peerId] = true;
    else delete map[peerId];
    this.settings.localMuted = map;
    this.app.saveSettings();
    this._applyDeafen();
    this.emit('change');
  }

  /** Video hidden on this device only, until the call ends. */
  isVideoHidden(peerId) {
    return !!this.hiddenVideo?.has(peerId);
  }

  setVideoHidden(peerId, on) {
    this.hiddenVideo = this.hiddenVideo || new Set();
    if (on) this.hiddenVideo.add(peerId);
    else this.hiddenVideo.delete(peerId);
    this.emit('video');
  }

  async setOutput(deviceId) {
    this.settings.outputId = deviceId;
    this.app.saveSettings();
    for (const entry of this.remote.values()) for (const el of entry.audio.values()) if (el.setSinkId) await el.setSinkId(deviceId).catch(() => {});
  }

  /** Reopen the microphone after a device or processing change. */
  async restartMic() {
    if (this.testPipe) await this.startMicTest();
    if (!this.current) return;
    const old = this.pipe;
    try {
      this.pipe = await this._openPipe();
      this.mic = this.pipe.out;
    } catch {
      this.emit('error', 'mic-failed');
      return;
    }
    this._unmeter('self');
    this._meter('self', this.mic);
    const session = this.current.session;
    for (const [peerId, link] of session.mesh?.links || []) {
      if (link.senders?.mic) {
        link.setTrack('mic', this.mic.getAudioTracks()[0], this.mic);
        this._tune(link);
      } else this.sync(session, peerId);
    }
    this._closePipe(old);
    this._gate();
    this._recordSources();
  }

  /** Cap (music) or free (voice) the Opus bitrate on one link, once its encodings exist. */
  _tune(link, tries = 0) {
    const sender = link.senders?.mic;
    if (!sender?.getParameters || !sender.setParameters) return;
    const retry = () => tries < 8 && setTimeout(() => link.senders?.mic === sender && this._tune(link, tries + 1), 600);
    const params = sender.getParameters();
    const next = tunedParameters(params, this.music ? MUSIC_BITRATE : null);
    if (next) sender.setParameters(next).catch(retry);
    else if (!params.encodings?.length) retry();
  }

  /**
   * Music mode for this call: every voice filter off, stereo where the device
   * has it and up to 128 kbps. It ends with the call.
   */
  async setMusic(on) {
    if (!this.current || this.music === !!on) return;
    this.music = !!on;
    await this.restartMic();
    this._announce();
    this.emit('change');
  }

  // Local recording: everything this device hears in the call, mixed into one
  // audio file that never leaves the device. Everyone in the call is told.

  get recording() {
    return this.recorder ? { since: this.recorder.since } : null;
  }

  get canRecord() {
    return typeof MediaRecorder !== 'undefined' && !!(window.AudioContext || window.webkitAudioContext);
  }

  startRecording() {
    if (!this.current || this.recorder || !this.canRecord) return false;
    this._ensureContext();
    if (!this.ctx) return false;
    const dest = this.ctx.createMediaStreamDestination();
    const type = pickRecordingType((t) => MediaRecorder.isTypeSupported(t));
    let mr;
    try {
      mr = new MediaRecorder(dest.stream, type ? { mimeType: type, audioBitsPerSecond: 128000 } : {});
    } catch {
      this.emit('error', 'record-failed');
      return false;
    }
    const rec = { mr, dest, type, sources: new Map(), chunks: [], since: Date.now(), session: this.current.session, channel: this.current.channel };
    this.recorder = rec;
    this._recordSources();
    mr.ondataavailable = (e) => e.data.size && rec.chunks.push(e.data);
    mr.start(1000);
    this._announce();
    this.emit('sound', 'record');
    this.emit('change');
    return true;
  }

  /** Stop, then hand the file to whoever listens for 'recorded'. */
  stopRecording() {
    const rec = this.recorder;
    if (!rec) return;
    this.recorder = null;
    const ms = Date.now() - rec.since;
    rec.mr.onstop = () => {
      for (const node of rec.sources.values()) node.disconnect();
      const blob = new Blob(rec.chunks, { type: rec.mr.mimeType || rec.type || 'audio/webm' });
      this.emit('recorded', { blob, ms, since: rec.since, session: rec.session, channel: rec.channel });
    };
    try {
      rec.mr.stop();
    } catch {
      rec.mr.onstop();
    }
    this._announce();
    this.emit('sound', 'record');
    this.emit('change');
  }

  /** Keep the recording mix in line with who is in the call. */
  _recordSources() {
    const rec = this.recorder;
    if (!rec || !this.ctx) return;
    const want = new Map();
    if (this.mic) want.set('self', this.mic);
    for (const entry of this.remote.values()) {
      if (entry.session !== rec.session) continue;
      for (const [id, el] of entry.audio) if (el.srcObject) want.set(`${entry.peerId}:${id}`, el.srcObject);
    }
    for (const [key, node] of rec.sources) {
      if (want.get(key) === node.stream) continue;
      node.disconnect();
      rec.sources.delete(key);
    }
    for (const [key, stream] of want) {
      if (rec.sources.has(key) || !stream.getAudioTracks().length) continue;
      try {
        const node = this.ctx.createMediaStreamSource(stream);
        node.stream = stream;
        node.connect(rec.dest);
        rec.sources.set(key, node);
      } catch {
        // a stream this browser cannot mix; the rest still records
      }
    }
  }

  toggleMute() {
    if (this.deafened) {
      this.deafened = false;
      this.muted = false;
    } else {
      this.muted = !this.muted;
    }
    this._applyDeafen();
    this._gate();
    this._announce();
    this.emit('sound', this.muted ? 'mute' : 'unmute');
    this.emit('change');
  }

  toggleDeafen() {
    this.deafened = !this.deafened;
    this.emit('sound', this.deafened ? 'deafen' : 'undeafen');
    this._applyDeafen();
    this._gate();
    this._announce();
    this.emit('change');
  }

  _applyDeafen() {
    for (const entry of this.remote.values()) for (const el of entry.audio.values()) el.muted = this.deafened || this.isLocalMuted(entry.peerId);
  }

  /** Whether my microphone is sending right now. */
  get live() {
    if (!this.mic || this.muted || this.deafened) return false;
    return this.settings.inputMode !== 'ptt' || this.pttHeld;
  }

  _gate() {
    const on = this.live;
    for (const t of [...(this.mic?.getAudioTracks() || []), ...(this.pipe?.raw.getAudioTracks() || [])]) t.enabled = on;
  }

  async toggleCamera() {
    if (!this.current) return;
    if (this.camera) {
      this._stop(this.camera);
      this.camera = null;
    } else {
      try {
        const video = { width: { ideal: 1280 }, height: { ideal: 720 } };
        if (this.settings.cameraId) video.deviceId = { exact: this.settings.cameraId };
        this.camera = await navigator.mediaDevices.getUserMedia({ video });
      } catch (err) {
        this.emit('error', err.name === 'NotAllowedError' ? 'camera-denied' : 'camera-failed');
        return;
      }
    }
    this._refreshPeers();
  }

  async toggleScreen() {
    if (!this.current) return;
    if (this.screen) {
      this._stop(this.screen);
      this.screen = null;
    } else {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        this.emit('error', 'screen-unsupported');
        return;
      }
      try {
        this.screen = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 30 } }, audio: false });
        this.emit('sound', 'screen');
        this.screen.getVideoTracks()[0].addEventListener('ended', () => {
          if (this.screen) this.toggleScreen();
        });
      } catch (err) {
        if (err.name !== 'NotAllowedError') this.emit('error', 'screen-failed');
        return;
      }
    }
    this._refreshPeers();
  }

  _refreshPeers() {
    const session = this.current?.session;
    if (!session) return;
    for (const peerId of session.mesh?.links.keys() || []) this.sync(session, peerId);
    this._announce();
    this.emit('change');
    this.emit('video');
  }

  _stop(stream) {
    for (const t of stream?.getTracks() || []) t.stop();
  }

  // Speaking detection

  _ensureContext() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) this.ctx = new Ctx();
    }
    if (this.ctx?.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  _meter(key, stream) {
    if (!this.ctx || !stream.getAudioTracks().length) return;
    this._unmeter(key);
    try {
      const source = this.ctx.createMediaStreamSource(stream);
      const analyser = this.ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      this.meters.set(key, { source, analyser, buf: new Uint8Array(analyser.fftSize), level: 0 });
    } catch {
      // some browsers cannot analyse remote streams; the ring just stays off
    }
  }

  _unmeter(key) {
    const m = this.meters.get(key);
    if (!m) return;
    m.source.disconnect();
    this.meters.delete(key);
    this.lastLoud.delete(key);
  }

  /** Current input level of a meter key, 0 to 1. */
  level(key) {
    return this.meters.get(key)?.level || 0;
  }

  _measure() {
    if (!this.meters.size && !this.speaking.size) return;
    const now = performance.now();
    const next = new Set();
    for (const [key, m] of this.meters) {
      m.analyser.getByteTimeDomainData(m.buf);
      let sum = 0;
      for (const v of m.buf) sum += ((v - 128) / 128) ** 2;
      m.level = Math.sqrt(sum / m.buf.length);
      const loud = key === 'self' ? this.live && m.level > SPEAK_LEVEL : m.level > SPEAK_LEVEL;
      if (loud) this.lastLoud.set(key, now);
      if (now - (this.lastLoud.get(key) || -1e9) < SPEAK_HOLD) next.add(key === 'self' ? 'self' : key.split(':')[1]);
    }
    const changed = next.size !== this.speaking.size || [...next].some((k) => !this.speaking.has(k));
    this.speaking = next;
    if (changed) this.emit('speaking', next);
    this.emit('levels');
  }

  isSpeaking(peerId) {
    return this.speaking.has(peerId === this.app.profile.id ? 'self' : peerId);
  }

  // Push to talk

  _keys() {
    const typing = (el) => el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
    const set = (held) => this.setPtt(held);
    window.addEventListener('keydown', (e) => {
      if (this.settings.inputMode !== 'ptt' || e.code !== this.settings.pttKey || e.repeat) return;
      if (typing(e.target) && e.code.startsWith('Key')) return;
      set(true);
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === this.settings.pttKey) set(false);
    });
    window.addEventListener('blur', () => set(false));
  }

  /** Hold (true) or release (false) push to talk: a key, or the talk button on a touch screen. */
  setPtt(held) {
    if (this.pttHeld === held) return;
    this.pttHeld = held;
    this._gate();
    this.emit('change');
  }

  /** 'voice' (voice activity) or 'ptt' (push to talk). */
  setInputMode(mode) {
    this.settings.inputMode = mode === 'ptt' ? 'ptt' : 'voice';
    this.app.saveSettings();
    this.pttHeld = false;
    this._gate();
    this.emit('change');
  }

  async devices() {
    const out = { audioinput: [], audiooutput: [], videoinput: [] };
    try {
      for (const d of await navigator.mediaDevices.enumerateDevices()) if (out[d.kind]) out[d.kind].push(d);
    } catch {
      // no media devices API
    }
    return out;
  }
}
