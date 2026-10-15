import { describe, expect, it } from 'vitest';
import { MUSIC_BITRATE, RateLimit, formatDuration, micConstraints, pickRecordingType, recordingFileName, tunedParameters, usesDenoise } from '../src/call.js';

describe('microphone constraints', () => {
  it('keeps voice filters on for voice and turns them all off for music', () => {
    expect(micConstraints({ noiseMode: 'strong' })).toEqual({ echoCancellation: true, autoGainControl: true, noiseSuppression: true });
    expect(micConstraints({ noiseMode: 'off' }).noiseSuppression).toBe(false);
    expect(micConstraints({ noiseMode: 'off' }).echoCancellation).toBe(true);
    const music = micConstraints({ noiseMode: 'strong', music: true, supported: { voiceIsolation: true }, inputId: 'mic2' });
    expect(music).toMatchObject({ echoCancellation: false, autoGainControl: false, noiseSuppression: false, voiceIsolation: false, deviceId: { exact: 'mic2' } });
    expect(music.channelCount).toEqual({ ideal: 2 });
    expect(micConstraints({ noiseMode: 'standard', supported: { voiceIsolation: true } }).voiceIsolation).toBe(true);
    expect('voiceIsolation' in micConstraints({ noiseMode: 'standard' })).toBe(false);
  });

  it('runs our noise suppression only in Strong voice mode', () => {
    expect(usesDenoise({ noiseMode: 'strong' })).toBe(true);
    expect(usesDenoise({ noiseMode: 'standard' })).toBe(false);
    expect(usesDenoise({ noiseMode: 'strong', music: true })).toBe(false);
    expect(usesDenoise()).toBe(true);
  });
});

describe('send bitrate', () => {
  const params = { transactionId: 't1', encodings: [{ active: true }], codecs: [] };

  it('sets the cap for music and removes it for voice', () => {
    const music = tunedParameters(params, MUSIC_BITRATE);
    expect(music).toEqual({ transactionId: 't1', encodings: [{ active: true, maxBitrate: 128000 }], codecs: [] });
    expect(params.encodings[0].maxBitrate).toBeUndefined();
    const voice = tunedParameters(music, null);
    expect(voice.encodings[0]).toEqual({ active: true });
  });

  it('returns null when nothing changes or nothing is negotiated yet', () => {
    expect(tunedParameters(params, null)).toBeNull();
    expect(tunedParameters({ encodings: [{ maxBitrate: MUSIC_BITRATE }] }, MUSIC_BITRATE)).toBeNull();
    expect(tunedParameters({ encodings: [] }, MUSIC_BITRATE)).toBeNull();
    expect(tunedParameters(undefined, MUSIC_BITRATE)).toBeNull();
  });
});

describe('recording', () => {
  it('picks the first supported container', () => {
    expect(pickRecordingType((t) => t === 'audio/mp4')).toBe('audio/mp4');
    expect(pickRecordingType(() => true)).toBe('audio/webm;codecs=opus');
    expect(pickRecordingType(() => false)).toBe('');
    expect(
      pickRecordingType(() => {
        throw new Error('no');
      }),
    ).toBe('');
  });

  it('names files after the den and the local time', () => {
    const at = new Date(2026, 9, 15, 21, 5);
    expect(recordingFileName('Night owls', at, 'audio/webm;codecs=opus')).toBe('howlden-night-owls-2026-10-15-2105.webm');
    expect(recordingFileName('Café da Ana!', at, 'audio/mp4')).toBe('howlden-cafe-da-ana-2026-10-15-2105.m4a');
    expect(recordingFileName('', at, 'audio/ogg;codecs=opus')).toBe('howlden-call-2026-10-15-2105.ogg');
    expect(recordingFileName('a'.repeat(39) + ' b', at)).toBe(`howlden-${'a'.repeat(39)}-2026-10-15-2105.webm`);
  });

  it('formats the running time', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(75000)).toBe('1:15');
    expect(formatDuration(3723000)).toBe('1:02:03');
    expect(formatDuration(-5)).toBe('0:00');
  });
});

describe('rate limit', () => {
  it('allows a burst, then refuses until the window moves on', () => {
    const rl = new RateLimit({ max: 3, windowMs: 1000 });
    expect([0, 10, 20, 30].map((t) => rl.allow('ana', t))).toEqual([true, true, true, false]);
    expect(rl.allow('bia', 30)).toBe(true);
    expect(rl.allow('ana', 1001)).toBe(true);
    expect(rl.allow('ana', 1005)).toBe(false);
    expect(rl.allow('ana', 1031)).toBe(true);
  });
});
