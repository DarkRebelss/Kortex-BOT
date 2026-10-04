// SPDX-License-Identifier: AGPL-3.0-or-later
import { config } from '../config/env.js';
export class MicupApiClient {
    baseUrl;
    token;
    constructor(customBaseUrl, customToken) {
        this.baseUrl = (customBaseUrl || config.apiBaseUrl).replace(/\/+$/, '');
        this.token = customToken || config.botToken;
    }
    async request(endpoint, options = {}, auditReason) {
        const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
        const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
        const headers = {
            Authorization: `Bot ${this.token}`,
            Accept: 'application/json',
            ...(options.headers || {}),
        };
        if (options.body !== undefined && options.body !== null && !isFormData && !headers['Content-Type']) {
            headers['Content-Type'] = 'application/json';
        }
        if (auditReason) {
            headers['X-Audit-Log-Reason'] = encodeURIComponent(auditReason);
        }
        let retries = 0;
        const maxRetries = 3;
        while (retries <= maxRetries) {
            const response = await fetch(url, {
                ...options,
                headers,
            });
            // Handle Rate Limiting
            if (response.status === 429) {
                retries++;
                const retryAfterHeader = response.headers.get('Retry-After');
                const retryAfterMs = retryAfterHeader ? Math.max(Number(retryAfterHeader) * 1000, 1000) : 1500;
                console.warn(`[MicupApiClient] Rate limited on ${endpoint}. Retrying after ${retryAfterMs}ms (attempt ${retries}/${maxRetries})`);
                await new Promise((resolve) => setTimeout(resolve, retryAfterMs));
                continue;
            }
            if (response.status === 204) {
                return null;
            }
            if (!response.ok) {
                let errorBody;
                try {
                    errorBody = await response.json();
                }
                catch {
                    errorBody = await response.text();
                }
                const errorMsg = typeof errorBody === 'object' && errorBody !== null && 'message' in errorBody
                    ? String(errorBody.message)
                    : JSON.stringify(errorBody);
                throw new Error(`API Error [${response.status}] ${response.statusText}: ${errorMsg}`);
            }
            return (await response.json());
        }
        throw new Error(`Max retries exceeded for ${endpoint}`);
    }
    // -------------------------------------------------------------
    // Gateway & Bot
    // -------------------------------------------------------------
    async getGatewayBot() {
        return this.request('/gateway/bot');
    }
    async getCurrentUser() {
        return this.request('/users/@me');
    }
    async getUser(userId) {
        return this.request(`/users/${userId}`);
    }
    // -------------------------------------------------------------
    // Guilds & Members
    // -------------------------------------------------------------
    async getGuild(guildId) {
        return this.request(`/guilds/${guildId}`);
    }
    async getGuildRoles(guildId) {
        return this.request(`/guilds/${guildId}/roles`);
    }
    async getGuildMembers(guildId, limit = 1000) {
        return this.request(`/guilds/${guildId}/members?limit=${limit}`);
    }
    async getGuildMember(guildId, userId) {
        return this.request(`/guilds/${guildId}/members/${userId}`);
    }
    async updateGuildMember(guildId, userId, data, auditReason) {
        return this.request(`/guilds/${guildId}/members/${userId}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        }, auditReason);
    }
    async addMemberRole(guildId, userId, roleId, auditReason) {
        await this.request(`/guilds/${guildId}/members/${userId}/roles/${roleId}`, { method: 'PUT' }, auditReason);
    }
    async removeMemberRole(guildId, userId, roleId, auditReason) {
        await this.request(`/guilds/${guildId}/members/${userId}/roles/${roleId}`, { method: 'DELETE' }, auditReason);
    }
    // -------------------------------------------------------------
    // Moderation: Ban, Kick, Timeout
    // -------------------------------------------------------------
    async banMember(guildId, userId, reason, deleteMessageSeconds = 0) {
        await this.request(`/guilds/${guildId}/bans/${userId}`, {
            method: 'PUT',
            body: JSON.stringify({
                reason: reason || undefined,
                delete_message_seconds: deleteMessageSeconds,
            }),
        }, reason);
    }
    async getGuildBans(guildId) {
        return this.request(`/guilds/${guildId}/bans`);
    }
    async getGuildBan(guildId, userId) {
        return this.request(`/guilds/${guildId}/bans/${userId}`);
    }
    async unbanMember(guildId, userId, reason) {
        await this.request(`/guilds/${guildId}/bans/${userId}`, { method: 'DELETE' }, reason);
    }
    async kickMember(guildId, userId, reason) {
        await this.request(`/guilds/${guildId}/members/${userId}`, { method: 'DELETE' }, reason);
    }
    async timeoutMember(guildId, userId, durationSeconds, reason) {
        const expiresAt = new Date(Date.now() + durationSeconds * 1000).toISOString();
        return this.updateGuildMember(guildId, userId, {
            communication_disabled_until: expiresAt,
        }, reason);
    }
    async untimeoutMember(guildId, userId, reason) {
        return this.updateGuildMember(guildId, userId, {
            communication_disabled_until: null,
        }, reason);
    }
    // -------------------------------------------------------------
    // Channels & Messages
    // -------------------------------------------------------------
    async getGuildChannels(guildId) {
        return this.request(`/guilds/${guildId}/channels`);
    }
    async getChannel(channelId) {
        return this.request(`/channels/${channelId}`);
    }
    async modifyChannel(channelId, data, auditReason) {
        return this.request(`/channels/${channelId}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        }, auditReason);
    }
    async editChannelPermissions(channelId, overwriteId, data, auditReason) {
        await this.request(`/channels/${channelId}/permissions/${overwriteId}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }, auditReason);
    }
    async deleteChannelPermission(channelId, overwriteId, auditReason) {
        await this.request(`/channels/${channelId}/permissions/${overwriteId}`, {
            method: 'DELETE',
        }, auditReason);
    }
    async createDM(recipientId) {
        return this.request('/users/@me/channels', {
            method: 'POST',
            body: JSON.stringify({ recipient_id: recipientId }),
        });
    }
    async sendDirectMessage(recipientId, content, extra = {}) {
        const dmChannel = await this.createDM(recipientId);
        return this.sendMessage(dmChannel.id, content, extra);
    }
    async sendMessage(channelId, content, extra = {}) {
        if (extra.files && extra.files.length > 0) {
            const formData = new FormData();
            const payload = {
                content,
                tts: extra.tts || false,
            };
            if (extra.embeds) {
                payload.embeds = extra.embeds;
            }
            if (extra.components) {
                payload.components = extra.components;
            }
            if (extra.poll) {
                payload.poll = extra.poll;
            }
            formData.append('payload_json', JSON.stringify(payload));
            for (let i = 0; i < extra.files.length; i++) {
                const file = extra.files[i];
                const fieldName = i === 0 ? 'file' : `file${i}`;
                const blob = new Blob([file.buffer], { type: file.contentType || 'application/octet-stream' });
                formData.append(fieldName, blob, file.name);
            }
            return this.request(`/channels/${channelId}/messages`, {
                method: 'POST',
                body: formData,
            });
        }
        const body = {
            content,
            tts: extra.tts || false,
        };
        if (extra.embeds) {
            body.embeds = extra.embeds;
        }
        if (extra.components) {
            body.components = extra.components;
        }
        if (extra.poll) {
            body.poll = extra.poll;
        }
        return this.request(`/channels/${channelId}/messages`, {
            method: 'POST',
            body: JSON.stringify(body),
        });
    }
    async expirePoll(channelId, messageId) {
        return this.request(`/channels/${channelId}/polls/${messageId}/expire`, {
            method: 'POST',
        });
    }
    async getMessages(channelId, limit = 50, before) {
        const query = new URLSearchParams({ limit: String(limit) });
        if (before)
            query.append('before', before);
        return this.request(`/channels/${channelId}/messages?${query.toString()}`);
    }
    async deleteMessage(channelId, messageId, reason) {
        await this.request(`/channels/${channelId}/messages/${messageId}`, { method: 'DELETE' }, reason);
    }
    async editMessage(channelId, messageId, content, extra = {}) {
        if (extra.files && extra.files.length > 0) {
            const formData = new FormData();
            const payload = { content };
            if (extra.embeds) {
                payload.embeds = extra.embeds;
            }
            if (extra.components !== undefined) {
                payload.components = extra.components;
            }
            formData.append('payload_json', JSON.stringify(payload));
            for (let i = 0; i < extra.files.length; i++) {
                const file = extra.files[i];
                const fieldName = i === 0 ? 'file' : `file${i}`;
                const blob = new Blob([file.buffer], { type: file.contentType || 'application/octet-stream' });
                formData.append(fieldName, blob, file.name);
            }
            return this.request(`/channels/${channelId}/messages/${messageId}`, {
                method: 'PATCH',
                body: formData,
            });
        }
        const body = { content };
        if (extra.embeds) {
            body.embeds = extra.embeds;
        }
        if (extra.components !== undefined) {
            body.components = extra.components;
        }
        return this.request(`/channels/${channelId}/messages/${messageId}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
        });
    }
    async bulkDeleteMessages(channelId, messageIds, reason) {
        await this.request(`/channels/${channelId}/messages/bulk-delete`, {
            method: 'POST',
            body: JSON.stringify({ message_ids: messageIds }),
        }, reason);
    }
    // -------------------------------------------------------------
    // Reactions
    // -------------------------------------------------------------
    async addReaction(channelId, messageId, emoji) {
        const encoded = encodeURIComponent(emoji);
        await this.request(`/channels/${channelId}/messages/${messageId}/reactions/${encoded}/@me`, { method: 'PUT' });
    }
    async deleteUserReaction(channelId, messageId, emoji, userId) {
        const encoded = encodeURIComponent(emoji);
        await this.request(`/channels/${channelId}/messages/${messageId}/reactions/${encoded}/${userId}`, { method: 'DELETE' });
    }
    // -------------------------------------------------------------
    // Interactions
    // -------------------------------------------------------------
    async createInteractionResponse(interactionId, interactionToken, response) {
        await this.request(`/interactions/${interactionId}/${interactionToken}/callback`, {
            method: 'POST',
            body: JSON.stringify(response),
        });
    }
    // -------------------------------------------------------------
    // Voice State REST API
    // -------------------------------------------------------------
    async updateCurrentVoiceState(guildId, channelId, suppress = false) {
        try {
            await this.request(`/guilds/${guildId}/voice-states/@me`, {
                method: 'PATCH',
                body: JSON.stringify({
                    channel_id: channelId,
                    suppress,
                }),
            });
            console.log(`[MicupApiClient] REST ses durumu güncellendi: ${guildId} -> ${channelId}`);
        }
        catch (err) {
            // Gateway Opcode 4 is usually the primary transport; REST PATCH is a fallback
            console.log(`[MicupApiClient] REST voice state bildirimi (${err.message})`);
        }
    }
}
//# sourceMappingURL=MicupApiClient.js.map