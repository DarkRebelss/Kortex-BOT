// SPDX-License-Identifier: AGPL-3.0-or-later

import {describe, it, expect, beforeEach, vi} from 'vitest';
import {MusicService, RADIO_STATIONS} from '../src/services/MusicService.js';
import type {FluxerMember} from '../src/types/fluxer.js';

describe('MusicService (Jockie Music System)', () => {
  let musicService: MusicService;
  let mockApi: any;

  const mockMember: FluxerMember = {
    user: {
      id: 'user_123',
      username: 'TestUser',
      discriminator: '0001',
    },
    roles: [],
    joined_at: new Date().toISOString(),
  };

  beforeEach(() => {
    mockApi = {
      sendMessage: vi.fn(async () => ({id: 'msg_1'})),
      editMessage: vi.fn(async () => ({id: 'msg_1'})),
    };
    musicService = new MusicService(mockApi);
  });

  it('resolves various music links and queries correctly', async () => {
    // 1. YouTube Video Link
    const ytTrack = await musicService.resolveInput(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      mockMember.user,
    );
    expect(ytTrack.source).toBe('youtube');
    expect(ytTrack.url).toContain('youtube.com');
    expect(ytTrack.requester.id).toBe('user_123');

    // 2. Spotify Link
    const spTrack = await musicService.resolveInput(
      'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT',
      mockMember.user,
    );
    expect(spTrack.source).toBe('spotify');
    expect(spTrack.url).toContain('spotify.com');

    // 3. SoundCloud Link
    const scTrack = await musicService.resolveInput(
      'https://soundcloud.com/artist/great-song',
      mockMember.user,
    );
    expect(scTrack.source).toBe('soundcloud');

    // 4. Direct Audio Link (.mp3)
    const directTrack = await musicService.resolveInput(
      'https://example.com/audio/epic_tune.mp3',
      mockMember.user,
    );
    expect(directTrack.source).toBe('direct');
    expect(directTrack.title).toBe('epic_tune.mp3');

    // 5. Search Query (non-URL)
    const searchTrack = await musicService.resolveInput('duman kirmis kalbini', mockMember.user);
    expect(searchTrack.source).toBe('youtube');
    expect(searchTrack.title).toMatch(/Duman/i);
  }, 30000);

  it('manages queue, playback states, and controls (play, pause, resume, skip, stop)', async () => {
    // 1. Play first song (starts immediately)
    const playRes1 = await musicService.play(
      'guild_1',
      'ch_1',
      'https://www.youtube.com/watch?v=track1',
      mockMember,
    );
    expect(playRes1.isPlayingNow).toBe(true);
    expect(playRes1.position).toBe(1);

    const player = musicService.getPlayer('guild_1')!;
    expect(player.state).toBe('playing');
    expect(player.currentTrack).toBeDefined();

    // 2. Play second song (adds to queue)
    const playRes2 = await musicService.play(
      'guild_1',
      'ch_1',
      'https://www.youtube.com/watch?v=track2',
      mockMember,
    );
    expect(playRes2.isPlayingNow).toBe(false);
    expect(playRes2.position).toBe(1);
    expect(player.queue.length).toBe(1);

    // 3. Pause
    const pauseRes = musicService.pause('guild_1');
    expect(pauseRes.success).toBe(true);
    expect(player.state).toBe('paused');

    // 4. Resume
    const resumeRes = musicService.resume('guild_1');
    expect(resumeRes.success).toBe(true);
    expect(player.state).toBe('playing');

    // 5. Skip
    const skipRes = await musicService.skip('guild_1');
    expect(skipRes.success).toBe(true);
    expect(player.currentTrack?.url).toContain('track2');
    expect(player.queue.length).toBe(0);

    // 6. Stop
    const stopRes = musicService.stop('guild_1');
    expect(stopRes.success).toBe(true);
    expect(player.state).toBe('stopped');
    expect(player.currentTrack).toBeNull();
  });

  it('handles volume, loop mode, shuffle, remove, clearQueue, and seek', async () => {
    await musicService.play('guild_1', 'ch_1', 'https://example.com/s1.mp3', mockMember);
    await musicService.play('guild_1', 'ch_1', 'https://example.com/s2.mp3', mockMember);
    await musicService.play('guild_1', 'ch_1', 'https://example.com/s3.mp3', mockMember);

    const player = musicService.getPlayer('guild_1')!;

    // Volume
    const volRes = musicService.setVolume('guild_1', 120);
    expect(volRes.success).toBe(true);
    expect(player.volume).toBe(120);

    // Loop
    const loopRes = musicService.setLoop('guild_1', 'track');
    expect(loopRes.success).toBe(true);
    expect(player.loopMode).toBe('track');

    // Seek
    const seekRes = musicService.seek('guild_1', 60);
    expect(seekRes.success).toBe(true);
    expect(musicService.getElapsedSeconds(player)).toBeGreaterThanOrEqual(59);

    // Remove
    const removeRes = musicService.remove('guild_1', 1);
    expect(removeRes.success).toBe(true);
    expect(player.queue.length).toBe(1);

    // ClearQueue
    const clearRes = musicService.clearQueue('guild_1');
    expect(clearRes.success).toBe(true);
    expect(player.queue.length).toBe(0);
  });

  it('plays radio presets properly', async () => {
    const radioRes = await musicService.playRadio('guild_1', 'ch_1', 'lofi', mockMember);
    expect(radioRes.success).toBe(true);
    expect(radioRes.message).toContain('Lofi Hip Hop');

    const player = musicService.getPlayer('guild_1')!;
    expect(player.currentTrack?.source).toBe('radio');
    expect(player.currentTrack?.durationSeconds).toBe(0); // Live stream
  });

  it('tracks voice states and sends Gateway Opcode 4 voice updates', async () => {
    const mockGateway = {
      sendVoiceStateUpdate: vi.fn(),
    };
    musicService.setGateway(mockGateway);

    // 1. Initial state: user not in voice
    expect(musicService.getUserVoiceChannel('guild_1', 'user_123')).toBeUndefined();

    // 2. User joins voice channel
    musicService.updateVoiceState('guild_1', 'user_123', 'ch_voice_42');
    expect(musicService.getUserVoiceChannel('guild_1', 'user_123')).toBe('ch_voice_42');

    // 3. Bot joins voice channel via join()
    const joinRes = musicService.join('guild_1', 'ch_text', 'ch_voice_42', 'Sohbet Odası');
    expect(joinRes.success).toBe(true);
    expect(mockGateway.sendVoiceStateUpdate).toHaveBeenCalledWith('guild_1', 'ch_voice_42', false, false);

    const player = musicService.getPlayer('guild_1')!;
    expect(player.voiceChannelId).toBe('ch_voice_42');
    expect(player.voiceChannelName).toBe('Sohbet Odası');

    // 4. Bot leaves voice channel via leave()
    const leaveRes = musicService.leave('guild_1');
    expect(leaveRes.success).toBe(true);
    expect(mockGateway.sendVoiceStateUpdate).toHaveBeenCalledWith('guild_1', null);
    expect(player.voiceChannelId).toBeNull();

    // 5. User leaves voice channel
    musicService.updateVoiceState('guild_1', 'user_123', null);
    expect(musicService.getUserVoiceChannel('guild_1', 'user_123')).toBeUndefined();
  });

  it('handles playNow, playNext, and skipTo cleanly', async () => {
    // 1. Initial play
    await musicService.play('guild_1', 'ch_1', 'https://example.com/song1.mp3', mockMember);
    await musicService.play('guild_1', 'ch_1', 'https://example.com/song2.mp3', mockMember);
    await musicService.play('guild_1', 'ch_1', 'https://example.com/song3.mp3', mockMember);

    const player = musicService.getPlayer('guild_1')!;
    expect(player.currentTrack?.title).toBe('song1.mp3');
    expect(player.queue.length).toBe(2);
    expect(player.queue[0].title).toBe('song2.mp3');

    // 2. playNext inserts at position 1 (front of queue)
    const nextRes = await musicService.playNext('guild_1', 'ch_1', 'https://example.com/urgent.mp3', mockMember);
    expect(nextRes.position).toBe(1);
    expect(player.queue[0].title).toBe('urgent.mp3');
    expect(player.queue.length).toBe(3);

    // 3. playNow replaces currentTrack immediately
    const nowRes = await musicService.playNow('guild_1', 'ch_1', 'https://example.com/immediate.mp3', mockMember);
    expect(nowRes.isPlayingNow).toBe(true);
    expect(player.currentTrack?.title).toBe('immediate.mp3');

    // 4. skipTo jumps forward in queue
    const skipRes = await musicService.skipTo('guild_1', 2);
    expect(skipRes.success).toBe(true);
    expect(player.currentTrack?.title).toBe('song2.mp3');
  });
});

