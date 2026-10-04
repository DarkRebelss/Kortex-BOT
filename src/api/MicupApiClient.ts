// SPDX-License-Identifier: AGPL-3.0-or-later

import {config} from '../config/env.js';
import type {
  FluxerBan,
  FluxerChannel,
  FluxerGuild,
  FluxerMember,
  FluxerMessage,
  FluxerRole,
  FluxerUser,
  Snowflake,
  DiscordPollCreate,
} from '../types/fluxer.js';

export interface GatewayBotInfo {
  url: string;
  shards: number;
  session_start_limit: {
    total: number;
    remaining: number;
    reset_after: number;
    max_concurrency: number;
  };
}

export class MicupApiClient {
  private baseUrl: string;
  private token: string;

  constructor(customBaseUrl?: string, customToken?: string) {
    this.baseUrl = (customBaseUrl || config.apiBaseUrl).replace(/\/+$/, '');
    this.token = customToken || config.botToken;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    auditReason?: string,
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
    const headers: Record<string, string> = {
      Authorization: `Bot ${this.token}`,
      Accept: 'application/json',
      ...((options.headers as Record<string, string>) || {}),
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
        return null as T;
      }

      if (!response.ok) {
        let errorBody: unknown;
        try {
          errorBody = await response.json();
        } catch {
          errorBody = await response.text();
        }
        const errorMsg = typeof errorBody === 'object' && errorBody !== null && 'message' in errorBody
          ? String((errorBody as {message: unknown}).message)
          : JSON.stringify(errorBody);
        throw new Error(`API Error [${response.status}] ${response.statusText}: ${errorMsg}`);
      }

      return (await response.json()) as T;
    }

    throw new Error(`Max retries exceeded for ${endpoint}`);
  }

  // -------------------------------------------------------------
  // Gateway & Bot
  // -------------------------------------------------------------

  async getGatewayBot(): Promise<GatewayBotInfo> {
    return this.request<GatewayBotInfo>('/gateway/bot');
  }

  async getCurrentUser(): Promise<FluxerUser> {
    return this.request<FluxerUser>('/users/@me');
  }

  async getUser(userId: Snowflake): Promise<FluxerUser> {
    return this.request<FluxerUser>(`/users/${userId}`);
  }

  // -------------------------------------------------------------
  // Guilds & Members
  // -------------------------------------------------------------

  async getGuild(guildId: Snowflake): Promise<FluxerGuild> {
    return this.request<FluxerGuild>(`/guilds/${guildId}`);
  }

  async getGuildRoles(guildId: Snowflake): Promise<FluxerRole[]> {
    return this.request<FluxerRole[]>(`/guilds/${guildId}/roles`);
  }

  async getGuildMembers(guildId: Snowflake, limit = 1000): Promise<FluxerMember[]> {
    return this.request<FluxerMember[]>(`/guilds/${guildId}/members?limit=${limit}`);
  }

  async getGuildMember(guildId: Snowflake, userId: Snowflake): Promise<FluxerMember> {
    return this.request<FluxerMember>(`/guilds/${guildId}/members/${userId}`);
  }

  async updateGuildMember(
    guildId: Snowflake,
    userId: Snowflake,
    data: {
      nick?: string | null;
      roles?: Snowflake[];
      communication_disabled_until?: string | null;
      timeout_reason?: string | null;
    },
    auditReason?: string,
  ): Promise<FluxerMember> {
    return this.request<FluxerMember>(
      `/guilds/${guildId}/members/${userId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(data),
      },
      auditReason,
    );
  }

  async addMemberRole(
    guildId: Snowflake,
    userId: Snowflake,
    roleId: Snowflake,
    auditReason?: string,
  ): Promise<void> {
    await this.request<void>(
      `/guilds/${guildId}/members/${userId}/roles/${roleId}`,
      {method: 'PUT'},
      auditReason,
    );
  }

  async removeMemberRole(
    guildId: Snowflake,
    userId: Snowflake,
    roleId: Snowflake,
    auditReason?: string,
  ): Promise<void> {
    await this.request<void>(
      `/guilds/${guildId}/members/${userId}/roles/${roleId}`,
      {method: 'DELETE'},
      auditReason,
    );
  }

  // -------------------------------------------------------------
  // Moderation: Ban, Kick, Timeout
  // -------------------------------------------------------------

  async banMember(
    guildId: Snowflake,
    userId: Snowflake,
    reason?: string,
    deleteMessageSeconds = 0,
  ): Promise<void> {
    await this.request<void>(
      `/guilds/${guildId}/bans/${userId}`,
      {
        method: 'PUT',
        body: JSON.stringify({
          reason: reason || undefined,
          delete_message_seconds: deleteMessageSeconds,
        }),
      },
      reason,
    );
  }

  async getGuildBans(guildId: Snowflake): Promise<FluxerBan[]> {
    return this.request<FluxerBan[]>(`/guilds/${guildId}/bans`);
  }

  async getGuildBan(guildId: Snowflake, userId: Snowflake): Promise<FluxerBan> {
    return this.request<FluxerBan>(`/guilds/${guildId}/bans/${userId}`);
  }

  async unbanMember(guildId: Snowflake, userId: Snowflake, reason?: string): Promise<void> {
    await this.request<void>(
      `/guilds/${guildId}/bans/${userId}`,
      {method: 'DELETE'},
      reason,
    );
  }

  async kickMember(guildId: Snowflake, userId: Snowflake, reason?: string): Promise<void> {
    await this.request<void>(
      `/guilds/${guildId}/members/${userId}`,
      {method: 'DELETE'},
      reason,
    );
  }

  async timeoutMember(
    guildId: Snowflake,
    userId: Snowflake,
    durationSeconds: number,
    reason?: string,
  ): Promise<FluxerMember> {
    const expiresAt = new Date(Date.now() + durationSeconds * 1000).toISOString();
    return this.updateGuildMember(
      guildId,
      userId,
      {
        communication_disabled_until: expiresAt,
      },
      reason,
    );
  }

  async untimeoutMember(guildId: Snowflake, userId: Snowflake, reason?: string): Promise<FluxerMember> {
    return this.updateGuildMember(
      guildId,
      userId,
      {
        communication_disabled_until: null,
      },
      reason,
    );
  }

  // -------------------------------------------------------------
  // Channels & Messages
  // -------------------------------------------------------------

  async getGuildChannels(guildId: Snowflake): Promise<FluxerChannel[]> {
    return this.request<FluxerChannel[]>(`/guilds/${guildId}/channels`);
  }

  async getChannel(channelId: Snowflake): Promise<FluxerChannel> {
    return this.request<FluxerChannel>(`/channels/${channelId}`);
  }

  async modifyChannel(
    channelId: Snowflake,
    data: {
      name?: string;
      topic?: string | null;
      position?: number;
      rate_limit_per_user?: number | null;
      parent_id?: Snowflake | null;
      permission_overwrites?: any[];
      [key: string]: unknown;
    },
    auditReason?: string,
  ): Promise<FluxerChannel> {
    return this.request<FluxerChannel>(
      `/channels/${channelId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(data),
      },
      auditReason,
    );
  }

  async editChannelPermissions(
    channelId: Snowflake,
    overwriteId: Snowflake,
    data: {
      type: number;
      allow?: string;
      deny?: string;
    },
    auditReason?: string,
  ): Promise<void> {
    await this.request<void>(
      `/channels/${channelId}/permissions/${overwriteId}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      },
      auditReason,
    );
  }

  async deleteChannelPermission(
    channelId: Snowflake,
    overwriteId: Snowflake,
    auditReason?: string,
  ): Promise<void> {
    await this.request<void>(
      `/channels/${channelId}/permissions/${overwriteId}`,
      {
        method: 'DELETE',
      },
      auditReason,
    );
  }

  async createDM(recipientId: Snowflake): Promise<FluxerChannel> {
    return this.request<FluxerChannel>('/users/@me/channels', {
      method: 'POST',
      body: JSON.stringify({recipient_id: recipientId}),
    });
  }

  async sendDirectMessage(
    recipientId: Snowflake,
    content: string,
    extra: {
      tts?: boolean;
      embeds?: Array<any>;
      components?: any[];
    } = {},
  ): Promise<FluxerMessage> {
    const dmChannel = await this.createDM(recipientId);
    return this.sendMessage(dmChannel.id, content, extra);
  }

  async sendMessage(
    channelId: Snowflake,
    content: string,
    extra: {
      tts?: boolean;
      embeds?: Array<{
        title?: string;
        description?: string;
        color?: number;
        url?: string;
        timestamp?: string;
        author?: {name: string; icon_url?: string; url?: string};
        thumbnail?: {url: string};
        image?: {url: string};
        footer?: {text: string; icon_url?: string};
        fields?: Array<{name: string; value: string; inline?: boolean}>;
      }>;
      files?: Array<{name: string; buffer: Buffer | Uint8Array; contentType?: string}>;
      components?: any[];
      poll?: DiscordPollCreate;
    } = {},
  ): Promise<FluxerMessage> {
    if (extra.files && extra.files.length > 0) {
      const formData = new FormData();
      const payload: Record<string, unknown> = {
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
        const blob = new Blob([file.buffer as any], {type: file.contentType || 'application/octet-stream'});
        formData.append(fieldName, blob, file.name);
      }
      return this.request<FluxerMessage>(`/channels/${channelId}/messages`, {
        method: 'POST',
        body: formData,
      });
    }

    const body: Record<string, unknown> = {
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

    return this.request<FluxerMessage>(`/channels/${channelId}/messages`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async expirePoll(channelId: Snowflake, messageId: Snowflake): Promise<FluxerMessage> {
    return this.request<FluxerMessage>(`/channels/${channelId}/polls/${messageId}/expire`, {
      method: 'POST',
    });
  }

  async getMessages(
    channelId: Snowflake,
    limit = 50,
    before?: Snowflake,
  ): Promise<FluxerMessage[]> {
    const query = new URLSearchParams({limit: String(limit)});
    if (before) query.append('before', before);
    return this.request<FluxerMessage[]>(`/channels/${channelId}/messages?${query.toString()}`);
  }

  async deleteMessage(channelId: Snowflake, messageId: Snowflake, reason?: string): Promise<void> {
    await this.request<void>(
      `/channels/${channelId}/messages/${messageId}`,
      {method: 'DELETE'},
      reason,
    );
  }

  async editMessage(
    channelId: Snowflake,
    messageId: Snowflake,
    content: string,
    extra: {
      embeds?: Array<any>;
      components?: any[];
      files?: Array<{name: string; buffer: Buffer | Uint8Array; contentType?: string}>;
    } = {},
  ): Promise<FluxerMessage> {
    if (extra.files && extra.files.length > 0) {
      const formData = new FormData();
      const payload: Record<string, unknown> = {content};
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
        const blob = new Blob([file.buffer as any], {type: file.contentType || 'application/octet-stream'});
        formData.append(fieldName, blob, file.name);
      }
      return this.request<FluxerMessage>(`/channels/${channelId}/messages/${messageId}`, {
        method: 'PATCH',
        body: formData,
      });
    }

    const body: Record<string, unknown> = {content};
    if (extra.embeds) {
      body.embeds = extra.embeds;
    }
    if (extra.components !== undefined) {
      body.components = extra.components;
    }

    return this.request<FluxerMessage>(
      `/channels/${channelId}/messages/${messageId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(body),
      },
    );
  }

  async bulkDeleteMessages(
    channelId: Snowflake,
    messageIds: Snowflake[],
    reason?: string,
  ): Promise<void> {
    await this.request<void>(
      `/channels/${channelId}/messages/bulk-delete`,
      {
        method: 'POST',
        body: JSON.stringify({message_ids: messageIds}),
      },
      reason,
    );
  }

  // -------------------------------------------------------------
  // Reactions
  // -------------------------------------------------------------

  async addReaction(
    channelId: Snowflake,
    messageId: Snowflake,
    emoji: string,
  ): Promise<void> {
    const encoded = encodeURIComponent(emoji);
    await this.request<void>(
      `/channels/${channelId}/messages/${messageId}/reactions/${encoded}/@me`,
      {method: 'PUT'},
    );
  }

  async deleteUserReaction(
    channelId: Snowflake,
    messageId: Snowflake,
    emoji: string,
    userId: Snowflake,
  ): Promise<void> {
    const encoded = encodeURIComponent(emoji);
    await this.request<void>(
      `/channels/${channelId}/messages/${messageId}/reactions/${encoded}/${userId}`,
      {method: 'DELETE'},
    );
  }

  // -------------------------------------------------------------
  // Interactions
  // -------------------------------------------------------------

  async createInteractionResponse(
    interactionId: Snowflake,
    interactionToken: string,
    response: {
      type: number;
      data?: {
        content?: string;
        embeds?: any[];
        components?: any[];
        flags?: number;
      };
    },
  ): Promise<void> {
    await this.request<void>(
      `/interactions/${interactionId}/${interactionToken}/callback`,
      {
        method: 'POST',
        body: JSON.stringify(response),
      },
    );
  }

  // -------------------------------------------------------------
  // Voice State REST API
  // -------------------------------------------------------------

  async updateCurrentVoiceState(
    guildId: Snowflake,
    channelId: Snowflake | null,
    suppress = false,
  ): Promise<void> {
    try {
      await this.request<void>(`/guilds/${guildId}/voice-states/@me`, {
        method: 'PATCH',
        body: JSON.stringify({
          channel_id: channelId,
          suppress,
        }),
      });
      console.log(`[MicupApiClient] REST ses durumu güncellendi: ${guildId} -> ${channelId}`);
    } catch (err: any) {
      // Gateway Opcode 4 is usually the primary transport; REST PATCH is a fallback
      console.log(`[MicupApiClient] REST voice state bildirimi (${err.message})`);
    }
  }
}


