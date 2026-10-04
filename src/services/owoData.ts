// SPDX-License-Identifier: AGPL-3.0-or-later

export type AnimalTier = 'common' | 'uncommon' | 'rare' | 'epic' | 'mythical' | 'legendary';

export interface AnimalDef {
  id: string;
  name: string;
  emoji: string;
  tier: AnimalTier;
  sellPrice: number;
}

export const ANIMALS: AnimalDef[] = [
  // -------------------------------------------------------------
  // Common (50% Chance, 15 Cowoncy)
  // -------------------------------------------------------------
  { id: 'dog', name: 'Köpek', emoji: '🐶', tier: 'common', sellPrice: 15 },
  { id: 'cat', name: 'Kedi', emoji: '🐱', tier: 'common', sellPrice: 15 },
  { id: 'mouse', name: 'Fare', emoji: '🐭', tier: 'common', sellPrice: 15 },
  { id: 'hamster', name: 'Hamster', emoji: '🐹', tier: 'common', sellPrice: 15 },
  { id: 'rabbit', name: 'Tavşan', emoji: '🐰', tier: 'common', sellPrice: 15 },
  { id: 'fox', name: 'Tilki', emoji: '🦊', tier: 'common', sellPrice: 15 },
  { id: 'bear', name: 'Ayı', emoji: '🐻', tier: 'common', sellPrice: 15 },
  { id: 'panda', name: 'Panda', emoji: '🐼', tier: 'common', sellPrice: 15 },

  // -------------------------------------------------------------
  // Uncommon (26% Chance, 40 Cowoncy)
  // -------------------------------------------------------------
  { id: 'koala', name: 'Koala', emoji: '🐨', tier: 'uncommon', sellPrice: 40 },
  { id: 'tiger', name: 'Kaplan', emoji: '🐯', tier: 'uncommon', sellPrice: 40 },
  { id: 'lion', name: 'Aslan', emoji: '🦁', tier: 'uncommon', sellPrice: 40 },
  { id: 'cow', name: 'İnek', emoji: '🐮', tier: 'uncommon', sellPrice: 40 },
  { id: 'pig', name: 'Domuz', emoji: '🐷', tier: 'uncommon', sellPrice: 40 },
  { id: 'frog', name: 'Kurbağa', emoji: '🐸', tier: 'uncommon', sellPrice: 40 },
  { id: 'monkey', name: 'Maymun', emoji: '🐵', tier: 'uncommon', sellPrice: 40 },
  { id: 'chicken', name: 'Tavuk', emoji: '🐔', tier: 'uncommon', sellPrice: 40 },

  // -------------------------------------------------------------
  // Rare (13% Chance, 100 Cowoncy)
  // -------------------------------------------------------------
  { id: 'penguin', name: 'Penguen', emoji: '🐧', tier: 'rare', sellPrice: 100 },
  { id: 'bird', name: 'Kuş', emoji: '🐦', tier: 'rare', sellPrice: 100 },
  { id: 'duck', name: 'Ördek', emoji: '🦆', tier: 'rare', sellPrice: 100 },
  { id: 'eagle', name: 'Kartal', emoji: '🦅', tier: 'rare', sellPrice: 100 },
  { id: 'owl', name: 'Baykuş', emoji: '🦉', tier: 'rare', sellPrice: 100 },
  { id: 'bat', name: 'Yarasa', emoji: '🦇', tier: 'rare', sellPrice: 100 },
  { id: 'wolf', name: 'Kurt', emoji: '🐺', tier: 'rare', sellPrice: 100 },
  { id: 'boar', name: 'Yaban Domuzu', emoji: '🐗', tier: 'rare', sellPrice: 100 },

  // -------------------------------------------------------------
  // Epic (7% Chance, 350 Cowoncy)
  // -------------------------------------------------------------
  { id: 'unicorn', name: 'Tekboynuz', emoji: '🦄', tier: 'epic', sellPrice: 350 },
  { id: 'horse', name: 'At', emoji: '🐴', tier: 'epic', sellPrice: 350 },
  { id: 'zebra', name: 'Zebra', emoji: '🦓', tier: 'epic', sellPrice: 350 },
  { id: 'deer', name: 'Geyik', emoji: '🦌', tier: 'epic', sellPrice: 350 },
  { id: 'rhino', name: 'Gergedan', emoji: '🦏', tier: 'epic', sellPrice: 350 },
  { id: 'hippo', name: 'Su Aygırı', emoji: '🦛', tier: 'epic', sellPrice: 350 },
  { id: 'leopard', name: 'Leopar', emoji: '🐆', tier: 'epic', sellPrice: 350 },
  { id: 'crocodile', name: 'Timsah', emoji: '🐊', tier: 'epic', sellPrice: 350 },

  // -------------------------------------------------------------
  // Mythical (3.2% Chance, 1,500 Cowoncy)
  // -------------------------------------------------------------
  { id: 'dragon', name: 'Ejderha', emoji: '🐉', tier: 'mythical', sellPrice: 1500 },
  { id: 'sauropod', name: 'Dinozor', emoji: '🦕', tier: 'mythical', sellPrice: 1500 },
  { id: 'trex', name: 'T-Rex', emoji: '🦖', tier: 'mythical', sellPrice: 1500 },
  { id: 'shark', name: 'Köpekbalığı', emoji: '🦈', tier: 'mythical', sellPrice: 1500 },
  { id: 'octopus', name: 'Ahtapot', emoji: '🐙', tier: 'mythical', sellPrice: 1500 },
  { id: 'peacock', name: 'Tavuskuşu', emoji: '🦚', tier: 'mythical', sellPrice: 1500 },

  // -------------------------------------------------------------
  // Legendary (0.8% Chance, 7,500 Cowoncy)
  // -------------------------------------------------------------
  { id: 'phoenix', name: 'Anka Kuşu', emoji: '✨', tier: 'legendary', sellPrice: 7500 },
  { id: 'galaxy_dragon', name: 'Galaksi Ejderhası', emoji: '🌌', tier: 'legendary', sellPrice: 7500 },
  { id: 'lightning_beast', name: 'Yıldırım Canavarı', emoji: '⚡', tier: 'legendary', sellPrice: 7500 },
  { id: 'golden_lion', name: 'Altın Aslan Kral', emoji: '👑', tier: 'legendary', sellPrice: 7500 },
];

export const TIER_COLORS: Record<AnimalTier, string> = {
  common: '⚪ Sıradan',
  uncommon: '🟢 Sıradışı',
  rare: '🔵 Nadir',
  epic: '🟣 Epik',
  mythical: '🔴 Mitolojik',
  legendary: '🟡 Efsanevi',
};

export interface WeaponDef {
  id: string;
  name: string;
  emoji: string;
  bonusStrength: number;
  price: number;
}

export const WEAPONS: Record<string, WeaponDef> = {
  punch: { id: 'punch', name: 'Çıplak Yumruk', emoji: '👊', bonusStrength: 0, price: 0 },
  wooden_stick: { id: 'wooden_stick', name: 'Tahta Sopa', emoji: '🪵', bonusStrength: 5, price: 400 },
  dagger: { id: 'dagger', name: 'Demir Hançer', emoji: '🗡️', bonusStrength: 15, price: 1000 },
  bow: { id: 'bow', name: 'Elf Yayı', emoji: '🏹', bonusStrength: 35, price: 2500 },
  battleaxe: { id: 'battleaxe', name: 'Savaş Baltası', emoji: '🪓', bonusStrength: 60, price: 6000 },
  magic_staff: { id: 'magic_staff', name: 'Büyülü Asa', emoji: '🪄', bonusStrength: 100, price: 12000 },
  dragon_sword: { id: 'dragon_sword', name: 'Ejderha Katili', emoji: '⚔️', bonusStrength: 180, price: 30000 },
};

export interface MonsterDef {
  name: string;
  emoji: string;
  hp: number;
  strength: number;
  xpReward: number;
  cowoncyReward: [number, number];
}

export const MONSTERS: MonsterDef[] = [
  { name: 'Köy Hırsızı', emoji: '🦹', hp: 50, strength: 8, xpReward: 20, cowoncyReward: [60, 150] },
  { name: 'Dağ Goblini', emoji: '👹', hp: 80, strength: 14, xpReward: 40, cowoncyReward: [120, 250] },
  { name: 'Vahşi Orman Kurdu', emoji: '🐺', hp: 120, strength: 22, xpReward: 65, cowoncyReward: [200, 400] },
  { name: 'Antik Mumya Kralı', emoji: '🧟', hp: 180, strength: 32, xpReward: 100, cowoncyReward: [350, 650] },
  { name: 'Kızıl Ateş Ejderhası', emoji: '🐲', hp: 260, strength: 45, xpReward: 160, cowoncyReward: [600, 1200] },
  { name: 'Karanlık İblis Lordu', emoji: '👿', hp: 380, strength: 65, xpReward: 260, cowoncyReward: [1200, 2500] },
];

export const OWO_EXPRESSIONS = [
  '(・`ω・) *notices you*',
  '( ｡•́‿•̀｡) owo ne var ne yok?',
  '(⁄ ⁄>⁄ ▽ ⁄<⁄ ⁄) o-owo!',
  '(ﾉ◕ヮ◕)ﾉ*:･ﾟ✧ uwu!',
  '(ง\'̀-\'́)ง *rawr!*',
  '(✿◕‿◕) OwO sana da merhaba tatlım!',
  '(・`ω・) *notices your bulge* owo ne bu böyle?!',
  '⊂((・▽・))⊃ kucaklaşma zamanı owo!',
  '( ≧Д≦) OWO ÇOK TATLISIN!',
  'UwU seni gördüğüme sevindim! (◕‿◕✿)',
];

export const ANIMAL_TIER_POWER: Record<AnimalTier, { min: number; max: number; base: number }> = {
  legendary: { min: 95, max: 115, base: 105 },
  mythical: { min: 75, max: 90, base: 82 },
  epic: { min: 55, max: 70, base: 62 },
  rare: { min: 38, max: 50, base: 44 },
  uncommon: { min: 24, max: 34, base: 29 },
  common: { min: 12, max: 20, base: 16 },
};
