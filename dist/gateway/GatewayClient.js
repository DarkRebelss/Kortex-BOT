// SPDX-License-Identifier: AGPL-3.0-or-later
import WebSocket from 'ws';
import { GatewayOpcodes } from '../config/constants.js';
import { config, maskToken } from '../config/env.js';
export class GatewayClient {
    ws = null;
    token;
    gatewayUrl;
    heartbeatInterval = null;
    lastHeartbeatAck = true;
    lastSequence = null;
    sessionId = null;
    botUser = null;
    isConnecting = false;
    reconnectAttempts = 0;
    listeners = [];
    constructor(gatewayUrl, customToken) {
        this.gatewayUrl = gatewayUrl.includes('?') ? gatewayUrl : `${gatewayUrl}?v=1&encoding=json`;
        this.token = customToken || config.botToken;
    }
    get currentUser() {
        return this.botUser;
    }
    get currentSessionId() {
        return this.sessionId;
    }
    onDispatch(listener) {
        this.listeners.push(listener);
    }
    async connect() {
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
            this.ws.on('message', (raw) => {
                try {
                    const payload = JSON.parse(raw.toString());
                    this.handlePayload(payload);
                }
                catch (err) {
                    console.error('[GatewayClient] Failed to parse Gateway payload:', err);
                }
            });
            this.ws.on('close', (code, reason) => {
                this.isConnecting = false;
                this.stopHeartbeat();
                const reasonStr = reason.toString('utf8');
                console.warn(`[GatewayClient] Connection closed [${code}]: ${reasonStr}`);
                this.handleDisconnect(code);
            });
            this.ws.on('error', (err) => {
                console.error('[GatewayClient] WebSocket error:', err.message);
            });
        }
        catch (err) {
            this.isConnecting = false;
            console.error('[GatewayClient] Error initializing WebSocket:', err);
            this.scheduleReconnect();
        }
    }
    handlePayload(payload) {
        const { op, d, s, t } = payload;
        if (s != null) {
            this.lastSequence = s;
        }
        switch (op) {
            case GatewayOpcodes.HELLO: {
                const hello = d;
                console.log(`[GatewayClient] Received HELLO. Heartbeat interval: ${hello.heartbeat_interval}ms`);
                this.startHeartbeat(hello.heartbeat_interval);
                if (this.sessionId && this.lastSequence != null) {
                    this.sendResume();
                }
                else {
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
                    const ready = d;
                    this.sessionId = ready.session_id;
                    this.botUser = ready.user;
                    console.log(`[GatewayClient] READY! Logged in as: ${this.botUser.username}#${this.botUser.discriminator} (ID: ${this.botUser.id})`);
                }
                else if (t === 'RESUMED') {
                    console.log('[GatewayClient] Gateway session successfully RESUMED.');
                }
                if (t === 'VOICE_STATE_UPDATE' || t === 'VOICE_SERVER_UPDATE') {
                    console.log(`[GatewayClient] Ses olayı (${t}):`, JSON.stringify(d));
                }
                if (t) {
                    for (const listener of this.listeners) {
                        try {
                            void listener(t, d);
                        }
                        catch (err) {
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
    sendIdentify() {
        console.log('[GatewayClient] Sending IDENTIFY payload with full intents...');
        const identifyPayload = {
            op: GatewayOpcodes.IDENTIFY,
            d: {
                token: this.token,
                properties: {
                    os: process.platform,
                    browser: 'Kyron',
                    device: 'Kyron',
                },
                intents: 3276799,
            },
        };
        this.send(identifyPayload);
    }
    sendResume() {
        if (!this.sessionId || this.lastSequence == null) {
            this.sendIdentify();
            return;
        }
        console.log(`[GatewayClient] Sending RESUME payload for session ${this.sessionId} (seq: ${this.lastSequence})...`);
        const resumePayload = {
            op: GatewayOpcodes.RESUME,
            d: {
                token: this.token,
                session_id: this.sessionId,
                seq: this.lastSequence,
            },
        };
        this.send(resumePayload);
    }
    startHeartbeat(intervalMs) {
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
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }
    sendHeartbeat() {
        const payload = {
            op: GatewayOpcodes.HEARTBEAT,
            d: this.lastSequence,
        };
        this.send(payload);
    }
    send(data) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }
    disconnectAndResume() {
        if (this.ws) {
            try {
                this.ws.terminate();
            }
            catch {
                // ignore
            }
        }
        this.stopHeartbeat();
        this.scheduleReconnect();
    }
    handleDisconnect(code) {
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
    scheduleReconnect() {
        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, Math.min(this.reconnectAttempts, 5)), 30000);
        console.log(`[GatewayClient] Scheduling reconnect in ${delay}ms (attempt #${this.reconnectAttempts})...`);
        setTimeout(() => {
            void this.connect();
        }, delay);
    }
    sendVoiceStateUpdate(guildId, channelId, selfMute = false, selfDeaf = false) {
        console.log(`[GatewayClient] Ses durumu güncelleniyor (Opcode 4)... Sunucu: ${guildId}, Kanal: ${channelId}`);
        const payload = {
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
        }
        else {
            console.warn(`[GatewayClient] Opcode 4 gönderilemedi! WebSocket bağlı değil (readyState: ${this.ws?.readyState})`);
        }
    }
    disconnect() {
        this.stopHeartbeat();
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}
//# sourceMappingURL=GatewayClient.js.map