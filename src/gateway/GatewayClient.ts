// SPDX-License-Identifier: AGPL-3.0-or-later

import WebSocket from 'ws';
import {GatewayOpcodes} from '../config/constants.js';
import {config, maskToken} from '../config/env.js';
import type {
  FluxerUser,
  GatewayHelloData,
  GatewayIdentifyData,
  GatewayPayload,
  GatewayReadyData,
  GatewayResumeData,
} from '../types/fluxer.js';

export type DispatchListener = (eventName: string, data: any) => Promise<void> | void;

export class GatewayClient {
  private ws: WebSocket | null = null;
  private token: string;
  private gatewayUrl: string;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private lastHeartbeatAck = true;
  private lastSequence: number | null = null;
  private sessionId: string | null = null;
  private botUser: FluxerUser | null = null;
  private isConnecting = false;
  private reconnectAttempts = 0;
  private readonly listeners: DispatchListener[] = [];

  constructor(gatewayUrl: string, customToken?: string) {
    this.gatewayUrl = gatewayUrl.includes('?') ? gatewayUrl : `${gatewayUrl}?v=1&encoding=json`;
    this.token = customToken || config.botToken;
  }

  get currentUser(): FluxerUser | null {
    return this.botUser;
  }

  get currentSessionId(): string | null {
    return this.sessionId;
  }

  onDispatch(listener: DispatchListener): void {
    this.listeners.push(listener);
  }

  async connect(): Promise<void> {
    if (this.isConnecting || this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.isConnecting = true;
    console.log(`[GatewayClient] Connecting to Gateway (${this.gatewayUrl})... Token: ${maskToken(this.token)}`);

    try {
      this.ws = new WebSocket(this.gatewayUrl);

      this.ws.on('open', () => {
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        console.log('[GatewayClient] WebSocket connection established.');
      });

      this.ws.on('message', (raw: WebSocket.Data) => {
        try {
          const payload = JSON.parse(raw.toString()) as GatewayPayload;
          this.handlePayload(payload);
        } catch (err) {
          console.error('[GatewayClient] Failed to parse Gateway payload:', err);
        }
      });

      this.ws.on('close', (code: number, reason: Buffer) => {
        this.isConnecting = false;
        this.stopHeartbeat();
        const reasonStr = reason.toString('utf8');
        console.warn(`[GatewayClient] Connection closed [${code}]: ${reasonStr}`);
        this.handleDisconnect(code);
      });

      this.ws.on('error', (err: Error) => {
        console.error('[GatewayClient] WebSocket error:', err.message);
      });
    } catch (err) {
      this.isConnecting = false;
      console.error('[GatewayClient] Error initializing WebSocket:', err);
      this.scheduleReconnect();
    }
  }

  private handlePayload(payload: GatewayPayload): void {
    const {op, d, s, t} = payload;

    if (s != null) {
      this.lastSequence = s;
    }

    switch (op) {
      case GatewayOpcodes.HELLO: {
        const hello = d as GatewayHelloData;
        console.log(`[GatewayClient] Received HELLO. Heartbeat interval: ${hello.heartbeat_interval}ms`);
        this.startHeartbeat(hello.heartbeat_interval);

        if (this.sessionId && this.lastSequence != null) {
          this.sendResume();
        } else {
          this.sendIdentify();
        }
        break;
      }

      case GatewayOpcodes.HEARTBEAT_ACK: {
        this.lastHeartbeatAck = true;
        break;
      }

      case GatewayOpcodes.HEARTBEAT: {
        this.sendHeartbeat();
        break;
      }

      case GatewayOpcodes.RECONNECT: {
        console.log('[GatewayClient] Server requested RECONNECT. Reconnecting...');
        this.disconnectAndResume();
        break;
      }

      case GatewayOpcodes.INVALID_SESSION: {
        console.warn('[GatewayClient] Invalid session. Resetting session state and re-identifying...');
        this.sessionId = null;
        this.lastSequence = null;
        setTimeout(() => this.sendIdentify(), 1000);
        break;
      }

      case GatewayOpcodes.DISPATCH: {
        if (t === 'READY') {
          const ready = d as GatewayReadyData;
          this.sessionId = ready.session_id;
          this.botUser = ready.user;
          console.log(`[GatewayClient] READY! Logged in as: ${this.botUser.username}#${this.botUser.discriminator} (ID: ${this.botUser.id})`);
        } else if (t === 'RESUMED') {
          console.log('[GatewayClient] Gateway session successfully RESUMED.');
        }

        if (t === 'VOICE_STATE_UPDATE' || t === 'VOICE_SERVER_UPDATE') {
          console.log(`[GatewayClient] Ses olayı (${t}):`, JSON.stringify(d));
        }

        if (t) {
          for (const listener of this.listeners) {
            try {
              void listener(t, d);
            } catch (err) {
              console.error(`[GatewayClient] Error in dispatch listener for ${t}:`, err);
            }
          }
        }
        break;
      }

      case GatewayOpcodes.GATEWAY_ERROR: {
        console.error('[GatewayClient] Gateway Hatası (Opcode 12):', JSON.stringify(d));
        break;
      }

      default:
        break;
    }
  }

  private sendIdentify(): void {
    console.log('[GatewayClient] Sending IDENTIFY payload with full intents...');
    const identifyPayload: GatewayPayload<GatewayIdentifyData> = {
      op: GatewayOpcodes.IDENTIFY,
      d: {
        token: this.token,
        properties: {
          os: process.platform,
          browser: 'Kortex',
          device: 'Kortex',
        },
        intents: 3276799,
      },
    };
    this.send(identifyPayload);
  }

  private sendResume(): void {
    if (!this.sessionId || this.lastSequence == null) {
      this.sendIdentify();
      return;
    }

    console.log(`[GatewayClient] Sending RESUME payload for session ${this.sessionId} (seq: ${this.lastSequence})...`);
    const resumePayload: GatewayPayload<GatewayResumeData> = {
      op: GatewayOpcodes.RESUME,
      d: {
        token: this.token,
        session_id: this.sessionId,
        seq: this.lastSequence,
      },
    };
    this.send(resumePayload);
  }

  private startHeartbeat(intervalMs: number): void {
    this.stopHeartbeat();
    this.lastHeartbeatAck = true;

    // Send immediate first heartbeat or jittered
    const jitter = Math.floor(Math.random() * intervalMs * 0.5);
    setTimeout(() => {
      this.sendHeartbeat();
      this.heartbeatInterval = setInterval(() => {
        if (!this.lastHeartbeatAck) {
          console.warn('[GatewayClient] Heartbeat ACK missing. Connection zombied. Reconnecting...');
          this.disconnectAndResume();
          return;
        }
        this.lastHeartbeatAck = false;
        this.sendHeartbeat();
      }, intervalMs);
    }, jitter);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private sendHeartbeat(): void {
    const payload: GatewayPayload<number | null> = {
      op: GatewayOpcodes.HEARTBEAT,
      d: this.lastSequence,
    };
    this.send(payload);
  }

  private send(data: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private disconnectAndResume(): void {
    if (this.ws) {
      try {
        this.ws.terminate();
      } catch {
        // ignore
      }
    }
    this.stopHeartbeat();
    this.scheduleReconnect();
  }

  private handleDisconnect(code: number): void {
    // Fatal close codes from Fluxer/Discord:
    // 4004: Authentication failed
    // 4010: Invalid shard
    // 4011: Sharding required
    // 4012: Invalid API version
    if (code === 4004) {
      console.error('[GatewayClient] FATAL: Authentication failed! Please verify your BOT_TOKEN.');
      return;
    }
    if (code === 4012) {
      console.error('[GatewayClient] FATAL: Invalid Gateway API version.');
      return;
    }

    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, Math.min(this.reconnectAttempts, 5)), 30000);
    console.log(`[GatewayClient] Scheduling reconnect in ${delay}ms (attempt #${this.reconnectAttempts})...`);
    setTimeout(() => {
      void this.connect();
    }, delay);
  }

  sendVoiceStateUpdate(
    guildId: string,
    channelId: string | null,
    selfMute = false,
    selfDeaf = false,
  ): void {
    console.log(`[GatewayClient] Ses durumu güncelleniyor (Opcode 4)... Sunucu: ${guildId}, Kanal: ${channelId}`);
    const payload: GatewayPayload<{
      guild_id: string;
      channel_id: string | null;
      self_mute: boolean;
      self_deaf: boolean;
    }> = {
      op: GatewayOpcodes.VOICE_STATE_UPDATE,
      d: {
        guild_id: guildId,
        channel_id: channelId,
        self_mute: selfMute,
        self_deaf: selfDeaf,
      },
    };
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send(payload);
      console.log(`[GatewayClient] Opcode 4 paketi başarıyla gönderildi:`, JSON.stringify(payload));
    } else {
      console.warn(`[GatewayClient] Opcode 4 gönderilemedi! WebSocket bağlı değil (readyState: ${this.ws?.readyState})`);
    }
  }

  disconnect(): void {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

