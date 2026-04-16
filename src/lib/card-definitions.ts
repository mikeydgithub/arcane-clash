import type { MonsterCard, SpellCard } from './types';


// A more structured way to define cards, making it easier to manage and scale.

export const MONSTER_CARD_TITLES: string[] = [
  "Flame Serpent",
  "Iron Golem",
  "Shadow Stalker",
  "Celestial Guardian",
  "Mystic Owl",
  "Stone Titan",
  "Storm Drake",
  "Forest Sprite",
  "Abyssal Fiend",
  "Sunstone Paladin",
  "Glacier Elemental",
  "Volcanic Imp",
  "Ancient Treant",
  "Whispering Banshee",
  "Knight of the Rose",
  "Desert Djinn",
  "Swamp Hydra",
  "Sky Griffin",
  "Underworld Lich",
  "Psionic Master",
  "Rockslide Goliath",
  "Phoenix Hatchling",
  "Spectral Assassin",
  "Vanguard Sentinel",
  "Arcane Familiar", // Summons a token
  "Earthshaker Behemoth",
  "Thunderbird Sovereign",
  "Grove Protector",
  "Netherworld Impaler",
  "Solar Templar"
];

export const SPELL_CARD_TITLES: string[] = [
  "Healing Light",
  "Fireball",
  "Arcane Shield",
  "Weakening Curse",
  "Swiftness Aura",
  "Stone Skin",
  "Chain Lightning",
  "Growth Spurt",
  "Drain Life",
  "Blinding Flash",
  "Might Infusion",
  "Frost Nova",
  "Regenerate",
  "Silence",
  "Teleport Strike",
  "Quicksand Trap",
  "Ethereal Form",
  "Counterspell",
  "Summon Minor Spirit",
  "Dark Pact",
  // Add more to ensure enough unique spells for two players (at least 24 for 12 each)
  "Empower Weapon",
  "Mage Armor",
  "Terrify",
  "Focused Mind"
];
