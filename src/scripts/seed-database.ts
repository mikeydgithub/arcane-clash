
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, writeBatch } from 'firebase/firestore';
import 'dotenv/config';

const monsterCards = [
    {
      "id": "Flame Serpent", "title": "Flame Serpent", "cardType": "Monster", "melee": 7, "magic": 2, "hp": 20, "maxHp": 20, "description": "A swift serpent wreathed in roaring flames."
    },
    {
      "id": "Iron Golem", "title": "Iron Golem", "cardType": "Monster", "melee": 5, "magic": 0, "hp": 30, "maxHp": 30, "description": "A lumbering construct of solid iron, nearly impervious to physical harm."
    },
    {
      "id": "Shadow Stalker", "title": "Shadow Stalker", "cardType": "Monster", "melee": 8, "magic": 4, "hp": 18, "maxHp": 18, "description": "A creature of darkness that strikes from unseen angles."
    },
    {
      "id": "Celestial Guardian", "title": "Celestial Guardian", "cardType": "Monster", "melee": 4, "magic": 6, "hp": 25, "maxHp": 25, "description": "A divine protector whose armor shimmers with starlight."
    },
    {
      "id": "Mystic Owl", "title": "Mystic Owl", "cardType": "Monster", "melee": 1, "magic": 8, "hp": 15, "maxHp": 15, "description": "A wise avian that commands potent, ancient magic."
    },
    {
      "id": "Stone Titan", "title": "Stone Titan", "cardType": "Monster", "melee": 9, "magic": 0, "hp": 40, "maxHp": 40, "description": "A colossal being of living rock and earth."
    },
    {
      "id": "Storm Drake", "title": "Storm Drake", "cardType": "Monster", "melee": 6, "magic": 7, "hp": 28, "maxHp": 28, "description": "A winged beast that rides the winds and commands lightning."
    },
    {
      "id": "Forest Sprite", "title": "Forest Sprite", "cardType": "Monster", "melee": 2, "magic": 5, "hp": 12, "maxHp": 12, "description": "A small, nimble fairy with a mischievous and magical nature."
    },
    {
      "id": "Abyssal Fiend", "title": "Abyssal Fiend", "cardType": "Monster", "melee": 8, "magic": 8, "hp": 22, "maxHp": 22, "description": "A demon from the depths, wielding both shadow and flame."
    },
    {
      "id": "Sunstone Paladin", "title": "Sunstone Paladin", "cardType": "Monster", "melee": 6, "magic": 3, "hp": 30, "maxHp": 30, "description": "A holy warrior whose faith is as strong as her armor."
    },
    {
      "id": "Glacier Elemental", "title": "Glacier Elemental", "cardType": "Monster", "melee": 5, "magic": 6, "hp": 35, "maxHp": 35, "description": "A slow but powerful being of pure ice."
    },
    {
      "id": "Volcanic Imp", "title": "Volcanic Imp", "cardType": "Monster", "melee": 4, "magic": 3, "hp": 10, "maxHp": 10, "description": "A small, fiery pest that swarms its enemies."
    },
    {
      "id": "Ancient Treant", "title": "Ancient Treant", "cardType": "Monster", "melee": 7, "magic": 5, "hp": 38, "maxHp": 38, "description": "A walking, ancient tree, protector of the forest."
    },
    {
      "id": "Whispering Banshee", "title": "Whispering Banshee", "cardType": "Monster", "melee": 2, "magic": 9, "hp": 20, "maxHp": 20, "description": "A sorrowful spirit whose wail can shatter resolve."
    },
    {
      "id": "Knight of the Rose", "title": "Knight of the Rose", "cardType": "Monster", "melee": 6, "magic": 2, "hp": 26, "maxHp": 26, "description": "A valiant knight sworn to an ancient, noble order."
    },
    {
      "id": "Desert Djinn", "title": "Desert Djinn", "cardType": "Monster", "melee": 4, "magic": 8, "hp": 24, "maxHp": 24, "description": "A powerful genie born from sand and mirage."
    },
    {
      "id": "Swamp Hydra", "title": "Swamp Hydra", "cardType": "Monster", "melee": 8, "magic": 3, "hp": 33, "maxHp": 33, "description": "A multi-headed reptile that lurks in murky waters."
    },
    {
      "id": "Sky Griffin", "title": "Sky Griffin", "cardType": "Monster", "melee": 7, "magic": 1, "hp": 27, "maxHp": 27, "description": "A majestic creature, half-eagle, half-lion, ruler of the skies."
    },
    {
      "id": "Underworld Lich", "title": "Underworld Lich", "cardType": "Monster", "melee": 3, "magic": 10, "hp": 25, "maxHp": 25, "description": "An undead sorcerer of immense power and cruelty."
    },
    {
      "id": "Psionic Master", "title": "Psionic Master", "cardType": "Monster", "melee": 2, "magic": 9, "hp": 19, "maxHp": 19, "description": "A being who attacks with the power of their mind."
    },
    {
      "id": "Rockslide Goliath", "title": "Rockslide Goliath", "cardType": "Monster", "melee": 8, "magic": 0, "hp": 36, "maxHp": 36, "description": "An earth giant whose steps cause avalanches."
    },
    {
      "id": "Phoenix Hatchling", "title": "Phoenix Hatchling", "cardType": "Monster", "melee": 3, "magic": 4, "hp": 15, "maxHp": 15, "description": "A young phoenix, full of fiery potential and rebirth."
    },
    {
      "id": "Spectral Assassin", "title": "Spectral Assassin", "cardType": "Monster", "melee": 9, "magic": 2, "hp": 16, "maxHp": 16, "description": "A ghostly killer who ignores armor and strikes true."
    },
    {
      "id": "Vanguard Sentinel", "title": "Vanguard Sentinel", "cardType": "Monster", "melee": 5, "magic": 0, "hp": 32, "maxHp": 32, "description": "The unbreachable first line of defense."
    },
    {
      "id": "Arcane Familiar", "title": "Arcane Familiar", "cardType": "Monster", "melee": 1, "magic": 3, "hp": 8, "maxHp": 8, "description": "A small magical companion that aids its master."
    },
    {
      "id": "Earthshaker Behemoth", "title": "Earthshaker Behemoth", "cardType": "Monster", "melee": 10, "magic": 0, "hp": 45, "maxHp": 45, "description": "Its roar is an earthquake, its charge a landslide."
    },
    {
      "id": "Thunderbird Sovereign", "title": "Thunderbird Sovereign", "cardType": "Monster", "melee": 6, "magic": 8, "hp": 30, "maxHp": 30, "description": "The king of storm birds, its cry is thunder itself."
    },
    {
      "id": "Grove Protector", "title": "Grove Protector", "cardType": "Monster", "melee": 5, "magic": 6, "hp": 34, "maxHp": 34, "description": "A centaur-like guardian of sacred groves."
    },
    {
      "id": "Netherworld Impaler", "title": "Netherworld Impaler", "cardType": "Monster", "melee": 9, "magic": 4, "hp": 26, "maxHp": 26, "description": "A demonic knight from a fiery dimension."
    },
    {
      "id": "Solar Templar", "title": "Solar Templar", "cardType": "Monster", "melee": 7, "magic": 5, "hp": 33, "maxHp": 33, "description": "A warrior infused with the power of the sun."
    }
  ];

const spellCards = [
    { "id": "Healing Light", "title": "Healing Light", "cardType": "Spell", "description": "Heals your active monster for 20 HP." },
    { "id": "Fireball", "title": "Fireball", "cardType": "Spell", "description": "Deals 15 damage to opponent's monster, or 10 damage to opponent if no monster." },
    { "id": "Arcane Shield", "title": "Arcane Shield", "cardType": "Spell", "description": "Grants your active monster a shield that absorbs 15 damage. Lasts until broken." },
    { "id": "Weakening Curse", "title": "Weakening Curse", "cardType": "Spell", "description": "Reduces opponent's monster's Melee and Magic by 3." },
    { "id": "Swiftness Aura", "title": "Swiftness Aura", "cardType": "Spell", "description": "Increases your active monster's Melee by 3." },
    { "id": "Stone Skin", "title": "Stone Skin", "cardType": "Spell", "description": "Increases your active monster's Defense by 5." },
    { "id": "Chain Lightning", "title": "Chain Lightning", "cardType": "Spell", "description": "Deals 10 damage to opponent's monster. If it's defeated, deal 5 damage to the opponent." },
    { "id": "Growth Spurt", "title": "Growth Spurt", "cardType": "Spell", "description": "Increases your active monster's Max HP and current HP by 10." },
    { "id": "Drain Life", "title": "Drain Life", "cardType": "Spell", "description": "Deals 8 damage to opponent's monster and heals your active monster for the same amount." },
    { "id": "Blinding Flash", "title": "Blinding Flash", "cardType": "Spell", "description": "A brilliant flash of light. (Effect not yet implemented)." },
    { "id": "Might Infusion", "title": "Might Infusion", "cardType": "Spell", "description": "Fills a creature with power. (Effect not yet implemented)." },
    { "id": "Frost Nova", "title": "Frost Nova", "cardType": "Spell", "description": "An explosion of ice. (Effect not yet implemented)." },
    { "id": "Regenerate", "title": "Regenerate", "cardType": "Spell", "description": "Your active monster heals 5 HP at the start of your next 3 turns." },
    { "id": "Silence", "title": "Silence", "cardType": "Spell", "description": "Prevents spell casting. (Effect not yet implemented)." },
    { "id": "Teleport Strike", "title": "Teleport Strike", "cardType": "Spell", "description": "A sudden attack from nowhere. (Effect not yet implemented)." },
    { "id": "Quicksand Trap", "title": "Quicksand Trap", "cardType": "Spell", "description": "Hinders enemy movement. (Effect not yet implemented)." },
    { "id": "Ethereal Form", "title": "Ethereal Form", "cardType": "Spell", "description": "Become ghostly and hard to hit. (Effect not yet implemented)." },
    { "id": "Counterspell", "title": "Counterspell", "cardType": "Spell", "description": "Negate an opponent's spell. (Effect not yet implemented)." },
    { "id": "Summon Minor Spirit", "title": "Summon Minor Spirit", "cardType": "Spell", "description": "Summons a weak spirit to aid you. (Effect not yet implemented)." },
    { "id": "Dark Pact", "title": "Dark Pact", "cardType": "Spell", "description": "A deal with dark forces for power. (Effect not yet implemented)." },
    { "id": "Empower Weapon", "title": "Empower Weapon", "cardType": "Spell", "description": "Enchants a weapon with magic. (Effect not yet implemented)." },
    { "id": "Mage Armor", "title": "Mage Armor", "cardType": "Spell", "description": "A shield of pure arcane energy. (Effect not yet implemented)." },
    { "id": "Terrify", "title": "Terrify", "cardType": "Spell", "description": "Returns opponent's active monster to their hand. If hand is full, it's discarded." },
    { "id": "Focused Mind", "title": "Focused Mind", "cardType": "Spell", "description": "Increases focus and magical power. (Effect not yet implemented)." }
];

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const cardsCollectionRef = collection(db, 'cards');

async function seedDatabase() {
  if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
    console.error('Firebase project ID is not set. Make sure your .env file is configured correctly.');
    process.exit(1);
  }

  console.log('Starting to seed database with updated card stats and paths...');
  const batch = writeBatch(db);

  const allCards = [...monsterCards, ...spellCards];

  allCards.forEach(card => {
    // Use card.title as the document ID
    const docRef = doc(cardsCollectionRef, card.title);
    
    // Create the object to be seeded
    const cardData = {
        ...card,
        artUrl: `/card-art/${card.title.toLowerCase().replace(/ /g, '-')}.png`,
        isLoadingArt: false,
        isLoadingDescription: false
    };

    // The 'id' field from the local array is redundant, so we omit it.
    const { id, ...dataToSet } = cardData;
    batch.set(docRef, dataToSet);
  });

  try {
    await batch.commit();
    console.log(`Successfully seeded ${allCards.length} cards.`);
    console.log('Database seeding complete.');
  } catch (error) {
    console.error('Error writing batch to Firestore:', error);
    process.exit(1);
  }
}

seedDatabase();
