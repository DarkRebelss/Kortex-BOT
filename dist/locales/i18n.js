// SPDX-License-Identifier: AGPL-3.0-or-later
import { config } from '../config/env.js';
import trLocale from './tr.json' with { type: 'json' };
import enLocale from './en.json' with { type: 'json' };
const locales = {
    tr: trLocale,
    en: enLocale,
};
/**
 * Translate a dot-separated key (e.g., 'errors.no_permission') with dynamic parameter substitution.
 */
export function t(key, params = {}, language = config.defaultLanguage) {
    const [section, subkey] = key.split('.');
    const dict = locales[language] || locales.tr;
    const rawMessage = dict[section]?.[subkey] || locales.tr[section]?.[subkey] || key;
    return Object.entries(params).reduce((msg, [paramKey, value]) => {
        return msg.replaceAll(`{${paramKey}}`, String(value));
    }, rawMessage);
}
//# sourceMappingURL=i18n.js.map