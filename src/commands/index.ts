// SPDX-License-Identifier: AGPL-3.0-or-later

export { CommandHandler } from './CommandHandler.js';
export type { CommandContext, CommandHelpers } from './types.js';
export { handleModerationCommands } from './modules/moderationCommands.js';
export { handleMusicCommands } from './modules/musicCommands.js';
export { handleCardCommands } from './modules/cardCommands.js';
export { handleSystemCommands } from './modules/systemCommands.js';
export { handleLevelingCommands } from './modules/levelingCommands.js';
export { handleOwoCommands } from './modules/owoCommands.js';
export { handleCommunityCommands } from './modules/communityCommands.js';
export { handleSecurityCommands } from './modules/securityCommands.js';
export {
  handleHelpCommand,
  buildHelpPage,
  buildHelpComponents,
  buildNavLine,
  HELP_TOTAL_PAGES,
  HELP_USER_TOTAL_PAGES,
  HELP_ADMIN_TOTAL_PAGES,
  type HelpSession,
} from './modules/helpCommands.js';
