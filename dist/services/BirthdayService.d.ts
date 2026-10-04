import type { MicupApiClient } from '../api/MicupApiClient.js';
import type { DatabaseClient, BirthdayRecord } from '../database/DatabaseClient.js';
import type { FluxerGuild, FluxerMember, Snowflake } from '../types/fluxer.js';
export declare class BirthdayService {
    private readonly api;
    private readonly db;
    private checkInterval;
    constructor(api: MicupApiClient, db: DatabaseClient);
    /**
     * Periodically checks for members whose birthday is today and announces them.
     */
    startTicker(): void;
    stop(): void;
    checkAndAnnounceBirthdays(targetGuildId?: string, targetUserId?: string): Promise<number>;
    setBirthday(guildId: string, userId: string, day: number, month: number, year?: number | null, username?: string | null): {
        success: boolean;
        message: string;
    };
    getBirthday(guildId: string, userId: string): {
        success: boolean;
        message: string;
        record?: BirthdayRecord;
    };
    deleteBirthday(guildId: string, userId: string): {
        success: boolean;
        message: string;
    };
    listBirthdays(guild: FluxerGuild, invokerUserOrId?: string | FluxerMember): Promise<{
        success: boolean;
        message: string;
    }> & {
        success: boolean;
        message: string;
    };
    setBirthdayChannel(guild: FluxerGuild, invoker: FluxerMember, channelId: Snowflake, channelName: string): {
        success: boolean;
        message: string;
    };
    setBirthdayMessage(guild: FluxerGuild, invoker: FluxerMember, template: string): {
        success: boolean;
        message: string;
    };
    toggle(guild: FluxerGuild, invoker: FluxerMember, enabled: boolean): {
        success: boolean;
        message: string;
    };
}
