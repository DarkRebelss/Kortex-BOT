import type { MicupApiClient } from '../api/MicupApiClient.js';
import type { DatabaseClient } from '../database/DatabaseClient.js';
import type { ModLogService } from './ModLogService.js';
import type { FluxerGuild, FluxerMember, FluxerMessage } from '../types/fluxer.js';
export declare const DEFAULT_TURKISH_BAD_WORDS: string[];
export declare class BadWordsService {
    private readonly api;
    private readonly db;
    private readonly modLogService?;
    constructor(api: MicupApiClient, db: DatabaseClient, modLogService?: ModLogService | undefined);
    /**
     * Normalizes Turkish text to catch leetspeak, disguised characters, and repetitions.
     */
    normalizeText(text: string): string;
    /**
     * Detects if the message contains prohibited words.
     * Returns the detected bad word if found, or null.
     */
    findBadWord(content: string, customWords: string[], checkDefault: boolean): string | null;
    /**
     * Process a message for bad words. Returns true if offending message was caught.
     */
    handleMessage(guild: FluxerGuild, member: FluxerMember, message: FluxerMessage): Promise<boolean>;
    private sendWarningNotice;
    toggle(guild: FluxerGuild, invoker: FluxerMember, enabled: boolean): {
        success: boolean;
        message: string;
    };
    toggleDefault(guild: FluxerGuild, invoker: FluxerMember, enabled: boolean): {
        success: boolean;
        message: string;
    };
    toggleExempt(guild: FluxerGuild, invoker: FluxerMember, exempt: boolean): {
        success: boolean;
        message: string;
    };
    setPunishment(guild: FluxerGuild, invoker: FluxerMember, punishment: string): {
        success: boolean;
        message: string;
    };
    addWord(guild: FluxerGuild, invoker: FluxerMember, word: string): {
        success: boolean;
        message: string;
    };
    removeWord(guild: FluxerGuild, invoker: FluxerMember, word: string): {
        success: boolean;
        message: string;
    };
    clearWords(guild: FluxerGuild, invoker: FluxerMember): {
        success: boolean;
        message: string;
    };
    listWords(guild: FluxerGuild, invoker: FluxerMember): {
        success: boolean;
        message: string;
    };
}
