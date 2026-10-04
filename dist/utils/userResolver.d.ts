import type { MicupApiClient } from '../api/MicupApiClient.js';
import type { DatabaseClient } from '../database/DatabaseClient.js';
import type { FluxerGuild, Snowflake } from '../types/fluxer.js';
/**
 * Resolves a user's display name or username reliably across cache, DB, and API.
 * Even if the user is offline or not cached in memory, attempts API fetches and persistent DB fallbacks.
 */
export declare function resolveUserDisplayName(api: MicupApiClient, db: DatabaseClient | undefined, guild: FluxerGuild | undefined, userId: Snowflake, preferredFallback?: string): Promise<string>;
/**
 * Synchronous resolution using in-memory members, DB cache, and fallbacks.
 */
export declare function resolveUserDisplayNameSync(db: DatabaseClient | undefined, guild: FluxerGuild | undefined, userId: Snowflake, preferredFallback?: string): string;
/**
 * Creates a Thenable object that provides synchronous fields immediately
 * while also behaving as a standard Promise when awaited.
 */
export declare function makeThenableResult<T extends {
    success: boolean;
    message: string;
}>(syncResult: T, asyncPromise: Promise<T>): Promise<T> & T;
