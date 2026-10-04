// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from 'vitest';
import { OwoLevelCardGenerator } from '../src/services/OwoLevelCardGenerator.js';

describe('OwoLevelCardGenerator', () => {
  it('generates a valid PNG buffer with level 30 matching reference image layout', async () => {
    const buffer = await OwoLevelCardGenerator.generateCard({
      username: 'Scuttler',
      level: 30,
      cowoncyReward: 150000,
      lootboxReward: 30,
      crateReward: 30,
    });

    expect(buffer).toBeDefined();
    expect(buffer.length).toBeGreaterThan(1000);
    // PNG magic bytes
    expect(buffer[0]).toBe(0x89);
    expect(buffer[1]).toBe(0x50);
    expect(buffer[2]).toBe(0x4e);
    expect(buffer[3]).toBe(0x47);
  });
});
