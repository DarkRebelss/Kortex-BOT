export type AnimalTier = 'common' | 'uncommon' | 'rare' | 'epic' | 'mythical' | 'legendary';
export interface AnimalDef {
    id: string;
    name: string;
    emoji: string;
    tier: AnimalTier;
    sellPrice: number;
}
export declare const ANIMALS: AnimalDef[];
export declare const TIER_COLORS: Record<AnimalTier, string>;
export interface WeaponDef {
    id: string;
    name: string;
    emoji: string;
    bonusStrength: number;
    price: number;
}
export declare const WEAPONS: Record<string, WeaponDef>;
export interface MonsterDef {
    name: string;
    emoji: string;
    hp: number;
    strength: number;
    xpReward: number;
    cowoncyReward: [number, number];
}
export declare const MONSTERS: MonsterDef[];
export declare const OWO_EXPRESSIONS: string[];
export declare const ANIMAL_TIER_POWER: Record<AnimalTier, {
    min: number;
    max: number;
    base: number;
}>;
