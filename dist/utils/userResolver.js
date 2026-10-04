// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Resolves a user's display name or username reliably across cache, DB, and API.
 * Even if the user is offline or not cached in memory, attempts API fetches and persistent DB fallbacks.
 */
export async function resolveUserDisplayName(api, db, guild, userId, preferredFallback) {
    if (!userId)
        return preferredFallback || 'Kullanıcı';
    // 1. Check in-memory guild.members
    if (guild?.members) {
        const found = guild.members.find((m) => m.user?.id === userId || m.id === userId);
        if (found) {
            const name = found.nick || found.user?.username || found.user?.global_name;
            if (name && !name.startsWith('Kullanıcı_') && name !== 'Kullanıcı') {
                if (db) {
                    db.saveUserName(userId, found.user?.username || name, found.nick);
                }
                return name;
            }
        }
    }
    // 2. Check preferred fallback if provided and not generic
    if (preferredFallback && !preferredFallback.startsWith('Kullanıcı_') && preferredFallback !== 'Kullanıcı') {
        if (db) {
            db.saveUserName(userId, preferredFallback);
        }
        return preferredFallback;
    }
    // 3. Check persistent database cache
    if (db) {
        const cached = db.getUserName(userId);
        if (cached?.username && !cached.username.startsWith('Kullanıcı_') && cached.username !== 'Kullanıcı') {
            return cached.display_name || cached.username;
        }
    }
    // 4. Try fetching member from guild REST API
    if (guild?.id && typeof api.getGuildMember === 'function') {
        try {
            const fetched = await api.getGuildMember(guild.id, userId);
            if (fetched) {
                if (!guild.members)
                    guild.members = [];
                guild.members.push(fetched);
                const name = fetched.nick || fetched.user?.username || fetched.user?.global_name;
                if (name && !name.startsWith('Kullanıcı_') && name !== 'Kullanıcı') {
                    if (db) {
                        db.saveUserName(userId, fetched.user?.username || name, fetched.nick);
                    }
                    return name;
                }
            }
        }
        catch { }
    }
    // 5. Try fetching user from REST API
    if (typeof api.getUser === 'function') {
        try {
            const fetchedUser = await api.getUser(userId);
            if (fetchedUser) {
                const uName = fetchedUser.global_name || fetchedUser.username;
                if (uName && !uName.startsWith('Kullanıcı_') && uName !== 'Kullanıcı') {
                    if (db) {
                        db.saveUserName(userId, fetchedUser.username, fetchedUser.global_name);
                    }
                    return uName;
                }
            }
        }
        catch { }
    }
    // 6. Fallback to DB cached username even if generic, or short ID tag
    if (db) {
        const cached = db.getUserName(userId);
        if (cached?.username)
            return cached.display_name || cached.username;
    }
    return preferredFallback || `Kullanıcı (${userId.slice(-4)})`;
}
/**
 * Synchronous resolution using in-memory members, DB cache, and fallbacks.
 */
export function resolveUserDisplayNameSync(db, guild, userId, preferredFallback) {
    if (!userId)
        return preferredFallback || 'Kullanıcı';
    // 1. Check in-memory guild.members
    if (guild?.members) {
        const found = guild.members.find((m) => m.user?.id === userId || m.id === userId);
        if (found) {
            const name = found.nick || found.user?.username || found.user?.global_name;
            if (name && !name.startsWith('Kullanıcı_') && name !== 'Kullanıcı') {
                if (db) {
                    db.saveUserName(userId, found.user?.username || name, found.nick);
                }
                return name;
            }
        }
    }
    // 2. Check preferred fallback if not generic
    if (preferredFallback && !preferredFallback.startsWith('Kullanıcı_') && preferredFallback !== 'Kullanıcı') {
        if (db) {
            db.saveUserName(userId, preferredFallback);
        }
        return preferredFallback;
    }
    // 3. Check persistent database cache
    if (db) {
        const cached = db.getUserName(userId);
        if (cached?.username && !cached.username.startsWith('Kullanıcı_') && cached.username !== 'Kullanıcı') {
            return cached.display_name || cached.username;
        }
    }
    return preferredFallback || `Kullanıcı (${userId.slice(-4)})`;
}
/**
 * Creates a Thenable object that provides synchronous fields immediately
 * while also behaving as a standard Promise when awaited.
 */
export function makeThenableResult(syncResult, asyncPromise) {
    const thenable = {
        ...syncResult,
        then: (onfulfilled, onrejected) => asyncPromise.then(onfulfilled, onrejected),
        catch: (onrejected) => asyncPromise.catch(onrejected),
        finally: (onfinally) => asyncPromise.finally(onfinally),
        [Symbol.toStringTag]: 'Promise',
    };
    return thenable;
}
//# sourceMappingURL=userResolver.js.map