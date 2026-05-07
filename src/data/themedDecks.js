// ── 5 Themed Deck Archetypes ──────────────────────────────
// Each deck: 20 cards (10 creatures, 4-6 spells, 2-3 traps, 1-2 equip, 1-2 field)
// Players choose a theme before each game

export const THEMED_DECKS = {
  "dragons-fury": {
    id: "dragons-fury",
    name: "Dragon's Fury",
    color: "#cc4422",
    description: "Aggressive mountain assault. High-ATK dragons crush enemies with overwhelming force.",
    playstyle: "Aggro — rush forward, deal heavy ATK diff damage, end games fast.",
    creatures: [
      "blue-eyes", "red-eyes", "luster-dragon", "harpie-lady",
      "flame-swordsman", "summoned-skull", "dark-magician",
      "kuriboh", "giant-soldier", "beaver-warrior",
    ],
    spells: [
      "dark-hole", "rush-recklessly", "fissure",
      "mystical-space-typhoon", "reinforcements",
    ],
    traps: ["bottomless-trap-hole", "widespread-ruin"],
    equipment: ["legendary-sword"],
    fields: ["mountain"],
  },

  "spellcasters-arcana": {
    id: "spellcasters-arcana",
    name: "Spellcaster's Arcana",
    color: "#4466cc",
    description: "Arcane control. Manipulate the field with powerful spells and outlast your opponent.",
    playstyle: "Control — deny enemy moves, revive creatures, draw extra cards.",
    creatures: [
      "dark-magician", "aqua-madoor", "summoned-skull",
      "blue-eyes", "kuriboh", "celtic-guardian",
      "giant-soldier", "luster-dragon", "flame-swordsman",
      "beaver-warrior",
    ],
    spells: [
      "pot-of-greed", "monster-reborn", "dark-hole",
      "swords-of-revealing-light", "rush-recklessly",
      "mystical-space-typhoon",
    ],
    traps: ["magic-cylinder", "mirror-force"],
    equipment: ["book-of-secret-arts"],
    fields: ["umi"],
  },

  "zombie-horde": {
    id: "zombie-horde",
    name: "Zombie Horde",
    color: "#7744aa",
    description: "Swamp-dwelling undead. Recursion, debuffs, and relentless pressure from the marsh.",
    playstyle: "Midrange — revive fallen creatures, grind enemy forces down in swamps.",
    creatures: [
      "zombie-dragon", "summoned-skull", "kuriboh",
      "giant-soldier", "beaver-warrior", "dark-magician",
      "aqua-madoor", "celtic-guardian", "harpie-lady",
      "red-eyes",
    ],
    spells: [
      "monster-reborn", "dark-hole", "reinforcements",
      "rush-recklessly", "pot-of-greed",
    ],
    traps: ["bottomless-trap-hole", "dust-tornado", "trap-hole"],
    equipment: ["metalmorph"],
    fields: ["wasteland"],
  },

  "warriors-vanguard": {
    id: "warriors-vanguard",
    name: "Warrior's Vanguard",
    color: "#44aa22",
    description: "Disciplined forest legion. Equipment synergy makes every soldier a threat.",
    playstyle: "Tempo — equip creatures to win trades, hold forest terrain for bonuses.",
    creatures: [
      "celtic-guardian", "flame-swordsman", "beaver-warrior",
      "giant-soldier", "harpie-lady", "luster-dragon",
      "dark-magician", "aqua-madoor", "kuriboh",
      "blue-eyes",
    ],
    spells: [
      "reinforcements", "rush-recklessly", "mystical-space-typhoon",
      "pot-of-greed",
    ],
    traps: ["trap-hole", "widespread-ruin", "dust-tornado"],
    equipment: ["sword-of-deep-seated", "legendary-sword"],
    fields: ["forest"],
  },

  "shadow-dominion": {
    id: "shadow-dominion",
    name: "Shadow Dominion",
    color: "#222244",
    description: "Dark fiends and cunning traps. Bleed your enemy dry and strike from the shadows.",
    playstyle: "Tempo/Control — trap-heavy defense, high-ATK fiends for counter-push.",
    creatures: [
      "summoned-skull", "kuriboh", "dark-magician",
      "zombie-dragon", "red-eyes", "giant-soldier",
      "blue-eyes", "celtic-guardian", "aqua-madoor",
      "beaver-warrior",
    ],
    spells: [
      "dark-hole", "fissure", "swords-of-revealing-light",
      "monster-reborn",
    ],
    traps: ["mirror-force", "magic-cylinder", "bottomless-trap-hole"],
    equipment: ["metalmorph"],
    fields: ["wasteland", "mountain"],
  },

  "fracture-protocol": {
    id: "fracture-protocol",
    name: "Fracture Protocol",
    color: "#8866ff",
    description: "Quantum-entropic void constructs and volcanic fracture beasts. Entropy control meets overwhelming firepower.",
    playstyle: "Tempo/Burst — deny enemy traps with void constructs, then crush with high-ATK Vermilion beasts.",
    creatures: [
      "echo-warden", "null-specter", "entropic-colossus",
      "fracture-born-ravager", "magma-reaver", "abyssal-drake",
      "dark-magician", "kuriboh", "summoned-skull",
      "giant-soldier",
    ],
    spells: [
      "dark-hole", "rush-recklessly", "fissure",
      "mystical-space-typhoon", "monster-reborn",
    ],
    traps: ["bottomless-trap-hole", "mirror-force", "widespread-ruin"],
    equipment: ["metalmorph"],
    fields: ["wasteland", "mountain"],
  },
};

// Get a deck's full card ID list (20 cards)
export function getDeckCardIds(deckId) {
  const deck = THEMED_DECKS[deckId];
  if (!deck) return [];
  return [
    ...deck.creatures,
    ...deck.spells,
    ...deck.traps,
    ...deck.equipment,
    ...deck.fields,
  ];
}

// All deck IDs
export const DECK_IDS = Object.keys(THEMED_DECKS);

// Default deck if none selected
export const DEFAULT_DECK = "warriors-vanguard";
