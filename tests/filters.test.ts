// SPDX-License-Identifier: AGPL-3.0-or-later

import {describe, it, expect, beforeEach, vi} from 'vitest';
import {MusicService} from '../src/services/MusicService.js';
import {MicupVoiceClient} from '../src/voice/MicupVoiceClient.js';
import type {FluxerMember} from '../src/types/fluxer.js';

describe('FFmpeg Audio Filters & Sound Effects', () => {
  let mockApi: any;
  let musicService: MusicService;
  let voiceClient: MicupVoiceClient;
  const guildId = 'guild_filter_test';
  let member: FluxerMember;

  beforeEach(() => {
    mockApi = {
      sendMessage: vi.fn(async () => ({id: 'msg_1'})),
    };

    voiceClient = new MicupVoiceClient();
    vi.spyOn(voiceClient, 'playAudio').mockImplementation(async () => {});
    vi.spyOn(voiceClient, 'stopAudio').mockImplementation(() => {});

    musicService = new MusicService(mockApi as any);
    musicService.setVoiceClient(voiceClient);

    member = {
      user: {id: 'user_listener', username: 'Listener', discriminator: '0001', bot: false},
      roles: [],
      joined_at: new Date().toISOString(),
    };
  });

  it('sets and gets bassboost filter with custom gain', () => {
    const res = musicService.setFilter(guildId, 'bassboost', 'high');
    expect(res.success).toBe(true);
    expect(res.filterName).toContain('BassBoost (16dB)');

    const active = musicService.getFilter(guildId);
    expect(active.filterName).toBe('BassBoost (16dB)');
    expect(active.rawFilter).toContain('bass=g=16:f=100');
    expect(active.rawFilter).toContain('alimiter');

    // Voice client filter was also updated
    expect(voiceClient.getAudioFilter(guildId)).toContain('bass=g=16:f=100');
  });

  it('sets nightcore and vaporwave filters properly', () => {
    const ncRes = musicService.setFilter(guildId, 'nightcore');
    expect(ncRes.success).toBe(true);
    expect(ncRes.filterName).toContain('Nightcore');
    expect(musicService.getFilter(guildId).rawFilter).toContain('asetrate=48000*1.25');

    const vwRes = musicService.setFilter(guildId, 'vaporwave');
    expect(vwRes.success).toBe(true);
    expect(vwRes.filterName).toContain('Vaporwave');
    expect(musicService.getFilter(guildId).rawFilter).toContain('asetrate=48000*0.82');
  });

  it('sets 8d, tremolo, and playback speed filters', () => {
    const eightDRes = musicService.setFilter(guildId, '8d');
    expect(eightDRes.success).toBe(true);
    expect(eightDRes.filterName).toContain('8D Audio');
    expect(musicService.getFilter(guildId).rawFilter).toContain('apulsator=hz=0.125');

    const speedRes = musicService.setFilter(guildId, 'speed', '1.5');
    expect(speedRes.success).toBe(true);
    expect(speedRes.filterName).toContain('Hız (1.5x)');
    expect(musicService.getFilter(guildId).rawFilter).toContain('atempo=1.5');
  });

  it('clears filter and resets voiceClient audio filter', () => {
    musicService.setFilter(guildId, 'bassboost', 'extreme');
    expect(musicService.getFilter(guildId).filterName).not.toBeNull();

    const clearRes = musicService.clearFilter(guildId);
    expect(clearRes.success).toBe(true);
    expect(musicService.getFilter(guildId).filterName).toBeNull();
    expect(musicService.getFilter(guildId).rawFilter).toBeNull();
    expect(voiceClient.getAudioFilter(guildId)).toBeUndefined();
  });

  it('seamlessly restarts track at current elapsed position when filter is changed mid-playback', async () => {
    // Start playing a track
    await musicService.play(guildId, 'ch_test', 'https://example.com/audio.mp3', member);
    const player = musicService.getPlayer(guildId)!;
    expect(player.state).toBe('playing');

    // Simulate 30 seconds have elapsed
    player.playbackStartTime = Date.now() - 30000;

    // Apply nightcore filter
    musicService.setFilter(guildId, 'nightcore');

    // Verified playAudio was invoked with seekSeconds >= 30 and isHotSwap = true
    const calls = vi.mocked(voiceClient.playAudio).mock.calls;
    expect(calls.length).toBeGreaterThanOrEqual(2);
    const lastCall = calls[calls.length - 1];
    expect(lastCall[0]).toBe(guildId);
    expect(lastCall[1]).toBe('https://example.com/audio.mp3');
    expect(lastCall[3]).toBeGreaterThanOrEqual(29);
    expect(lastCall[4]).toBe(true); // Seamless hot-swap: zero freeze!
  });

  it('displays active filter in nowplaying embed', async () => {
    await musicService.play(guildId, 'ch_test', 'https://example.com/audio.mp3', member);
    musicService.setFilter(guildId, 'bassboost', 'high');

    const np = musicService.getNowPlaying(guildId);
    expect(np.message).toContain('Filtre:');
    expect(np.message).toContain('BassBoost (16dB)');
  });

  it('caches direct stream URLs in MicupVoiceClient to eliminate waiting and freezing', () => {
    const rawVc = new MicupVoiceClient();
    rawVc.setCachedStreamUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://rr1---sn-direct.googlevideo.com/videoplayback?id=123');
    const cached = rawVc.getCachedStreamUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(cached).toBe('https://rr1---sn-direct.googlevideo.com/videoplayback?id=123');

    // Unknown or expired returns undefined
    expect(rawVc.getCachedStreamUrl('https://unknown.com/song')).toBeUndefined();
  });
});
