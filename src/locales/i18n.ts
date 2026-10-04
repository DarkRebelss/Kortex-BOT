// SPDX-License-Identifier: AGPL-3.0-or-later

import {config} from '../config/env.js';
import trLocale from './tr.json' with {type: 'json'};
import enLocale from './en.json' with {type: 'json'};

export type SupportedLanguage = 'tr' | 'en';

const locales: Record<SupportedLanguage, Record<string, Record<string, string>>> = {
  tr: trLocale,
  en: enLocale,
};

/**
 * Translate a dot-separated key (e.g., 'errors.no_permission') with dynamic parameter substitution.
 */
export function t(
  key: string,
  params: Record<string, string | number> = {},
  language: SupportedLanguage = config.defaultLanguage,
): string {
  const [section, subkey] = key.split('.');
  const dict = locales[language] || locales.tr;
  const rawMessage = dict[section]?.[subkey] || locales.tr[section]?.[subkey] || key;

  return Object.entries(params).reduce<string>((msg, [paramKey, value]) => {
    return msg.replaceAll(`{${paramKey}}`, String(value));
  }, rawMessage);
}
