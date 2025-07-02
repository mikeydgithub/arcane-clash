
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, writeBatch } from 'firebase/firestore';
import 'dotenv/config';

const monsterCards = [
    {
      "id": "Flame Serpent", "title": "Flame Serpent", "cardType": "Monster", "melee": 7, "magic": 2, "defense": 3, "hp": 20, "maxHp": 20, "shield": 0, "maxShield": 0, "magicShield": 0, "maxMagicShield": 0, "artUrl": "/card-art/flame-serpent.png", "description": "A swift serpent wreathed in roaring flames.", "isLoadingArt": false, "isLoadingDescription": false
    },
    {
      "id": "Iron Golem", "title": "Iron Golem", "cardType": "Monster", "melee": 5, "magic": 0, "defense": 8, "hp": 30, "maxHp": 30, "shield": 10, "maxShield": 10, "magicShield": 0, "maxMagicShield": 0, "artUrl": "/card-art/iron-golem.png", "description": "A lumbering construct of solid iron, nearly impervious to physical harm.", "isLoadingArt": false, "isLoadingDescription": false
    },
    {
      "id": "Shadow Stalker", "title": "Shadow Stalker", "cardType": "Monster", "melee": 8, "magic": 4, "defense": 2, "hp": 18, "maxHp": 18, "shield": 0, "maxShield": 0, "magicShield": 5, "maxMagicShield": 5, "artUrl": "/card-art/shadow-stalker.png", "description": "A creature of darkness that strikes from unseen angles.", "isLoadingArt": false, "isLoadingDescription": false
    },
    {
      "id": "Celestial Guardian", "title": "Celestial Guardian", "cardType": "Monster", "melee": 4, "magic": 6, "defense": 5, "hp": 25, "maxHp": 25, "shield": 5, "maxShield": 5, "magicShield": 10, "maxMagicShield": 10, "artUrl": "/card-art/celestial-guardian.png", "description": "A divine protector whose armor shimmers with starlight.", "isLoadingArt": false, "isLoadingDescription": false
    },
    {
      "id": "Mystic Owl", "title": "Mystic Owl", "cardType": "Monster", "melee": 1, "magic": 8, "defense": 2, "hp": 15, "maxHp": 15, "shield": 0, "maxShield": 0, "magicShield": 5, "maxMagicShield": 5, "artUrl": "/card-art/mystic-owl.png", "description": "A wise avian that commands potent, ancient magic.", "isLoadingArt": false, "isLoadingDescription": false
    },
    {
      "id": "Stone Titan", "title": "Stone Titan", "cardType": "Monster", "melee": 9, "magic": 0, "defense": 10, "hp": 40, "maxHp": 40, "shield": 15, "maxShield": 15, "magicShield": 0, "maxMagicShield": 0, "artUrl": "/card-art/stone-titan.png", "description": "A colossal being of living rock and earth.", "isLoadingArt": false, "isLoadingDescription": false
    },
    {
      "id": "Storm Drake", "title": "Storm Drake", "cardType": "Monster", "melee": 6, "magic": 7, "defense": 4, "hp": 28, "maxHp": 28, "shield": 0, "maxShield": 0, "magicShield": 0, "maxMagicShield": 0, "artUrl": "/card-art/storm-drake.png", "description": "A winged beast that rides the winds and commands lightning.", "isLoadingArt": false, "isLoadingDescription": false
    },
    {
      "id": "Forest Sprite", "title": "Forest Sprite", "cardType": "Monster", "melee": 2, "magic": 5, "defense": 1, "hp": 12, "maxHp": 12, "shield": 0, "maxShield": 0, "magicShield": 0, "maxMagicShield": 0, "artUrl": "/card-art/forest-sprite.png", "description": "A small, nimble fairy with a mischievous and magical nature.", "isLoadingArt": false, "isLoadingDescription": false
    },
    {
      "id": "Abyssal Fiend", "title": "Abyssal Fiend", "cardType": "Monster", "melee": 8, "magic": 8, "defense": 3, "hp": 22, "maxHp": 22, "shield": 0, "maxShield": 0, "magicShield": 0, "maxMagicShield": 0, "artUrl": "/card-art/abyssal-fiend.png", "description": "A demon from the depths, wielding both shadow and flame.", "isLoadingArt": false, "isLoadingDescription": false
    },
    {
      "id": "Sunstone Paladin", "title": "Sunstone Paladin", "cardType": "Monster", "melee": 6, "magic": 3, "defense": 6, "hp": 30, "maxHp": 30, "shield": 10, "maxShield": 10, "magicShield": 5, "maxMagicShield": 5, "artUrl": "/card-art/sunstone-paladin.png", "description": "A holy warrior whose faith is as strong as her armor.", "isLoadingArt": false, "isLoadingDescription": false
    },
    {
      "id": "Glacier Elemental", "title": "Glacier Elemental", "cardType": "Monster", "melee": 5, "magic": 6, "defense": 7, "hp": 35, "maxHp": 35, "shield": 5, "maxShield": 5, "magicShield": 5, "maxMagicShield": 5, "artUrl": "/card-art/glacier-elemental.png", "description": "A slow but powerful being of pure ice.", "isLoadingArt": false, "isLoadingDescription": false
    },
    {
      "id": "Volcanic Imp", "title": "Volcanic Imp", "cardType": "Monster", "melee": 4, "magic": 3, "defense": 1, "hp": 10, "maxHp": 10, "shield": 0, "maxShield": 0, "magicShield": 0, "maxMagicShield": 0, "artUrl": "/card-art/volcanic-imp.png", "description": "A small, fiery pest that swarms its enemies.", "isLoadingArt": false, "isLoadingDescription": false
    },
    {
      "id": "Ancient Treant", "title": "Ancient Treant", "cardType": "Monster", "melee": 7, "magic": 5, "defense": 6, "hp": 38, "maxHp": 38, "shield": 0, "maxShield": 0, "magicShield": 0, "maxMagicShield": 0, "artUrl": "/card-art/ancient-treant.png", "description": "A walking, ancient tree, protector of the forest.", "isLoadingArt": false, "isLoadingDescription": false
    },
    {
      "id": "Whispering Banshee", "title": "Whispering Banshee", "cardType": "Monster", "melee": 2, "magic": 9, "defense": 3, "hp": 20, "maxHp": 20, "shield": 0, "maxShield": 0, "magicShield": 10, "maxMagicShield": 10, "artUrl": "/card-art/whispering-banshee.png", "description": "A sorrowful spirit whose wail can shatter resolve.", "isLoadingArt": false, "isLoadingDescription": false
    },
    {
      "id": "Knight of the Rose", "title": "Knight of the Rose", "cardType": "Monster", "melee": 6, "magic": 2, "defense": 5, "hp": 26, "maxHp": 26, "shield": 5, "maxShield": 5, "magicShield": 0, "maxMagicShield": 0, "artUrl": "/card-art/knight-of-the-rose.png", "description": "A valiant knight sworn to an ancient, noble order.", "isLoadingArt": false, "isLoadingDescription": false
    },
    {
      "id": "Desert Djinn", "title": "Desert Djinn", "cardType": "Monster", "melee": 4, "magic": 8, "defense": 4, "hp": 24, "maxHp": 24, "shield": 0, "maxShield": 0, "magicShield": 0, "maxMagicShield": 0, "artUrl": "/card-art/desert-djinn.png", "description": "A powerful genie born from sand and mirage.", "isLoadingArt": false, "isLoadingDescription": false
    },
    {
      "id": "Swamp Hydra", "title": "Swamp Hydra", "cardType": "Monster", "melee": 8, "magic": 3, "defense": 4, "hp": 33, "maxHp": 33, "shield": 0, "maxShield": 0, "magicShield": 0, "maxMagicShield": 0, "artUrl": "/card-art/swamp-hydra.png", "description": "A multi-headed reptile that lurks in murky waters.", "isLoadingArt": false, "isLoadingDescription": false
    },
    {
      "id": "Sky Griffin", "title": "Sky Griffin", "cardType": "Monster", "melee": 7, "magic": 1, "defense": 4, "hp": 27, "maxHp": 27, "shield": 0, "maxShield": 0, "magicShield": 0, "maxMagicShield": 0, "artUrl": "/card-art/sky-griffin.png", "description": "A majestic creature, half-eagle, half-lion, ruler of the skies.", "isLoadingArt": false, "isLoadingDescription": false
    },
    {
      "id": "Underworld Lich", "title": "Underworld Lich", "cardType": "Monster", "melee": 3, "magic": 10, "defense": 3, "hp": 25, "maxHp": 25, "shield": 0, "maxShield": 0, "magicShield": 15, "maxMagicShield": 15, "artUrl": "/card-art/underworld-lich.png", "description": "An undead sorcerer of immense power and cruelty.", "isLoadingArt": false, "isLoadingDescription": false
    },
    {
      "id": "Psionic Master", "title": "Psionic Master", "cardType": "Monster", "melee": 2, "magic": 9, "defense": 2, "hp": 19, "maxHp": 19, "shield": 0, "maxShield": 0, "magicShield": 10, "maxMagicShield": 10, "artUrl": "/card-art/psionic-master.png", "description": "A being who attacks with the power of their mind.", "isLoadingArt": false, "isLoadingDescription": false
    },
    {
      "id": "Rockslide Goliath", "title": "Rockslide Goliath", "cardType": "Monster", "melee": 8, "magic": 0, "defense": 9, "hp": 36, "maxHp": 36, "shield": 10, "maxShield": 10, "magicShield": 0, "maxMagicShield": 0, "artUrl": "/card-art/rockslide-goliath.png", "description": "An earth giant whose steps cause avalanches.", "isLoadingArt": false, "isLoadingDescription": false
    },
    {
      "id": "Phoenix Hatchling", "title": "Phoenix Hatchling", "cardType": "Monster", "melee": 3, "magic": 4, "defense": 2, "hp": 15, "maxHp": 15, "shield": 0, "maxShield": 0, "magicShield": 0, "maxMagicShield": 0, "artUrl": "/card-art/phoenix-hatchling.png", "description": "A young phoenix, full of fiery potential and rebirth.", "isLoadingArt": false, "isLoadingDescription": false
    },
    {
      "id": "Spectral Assassin", "title": "Spectral Assassin", "cardType": "Monster", "melee": 9, "magic": 2, "defense": 1, "hp": 16, "maxHp": 16, "shield": 0, "maxShield": 0, "magicShield": 0, "maxMagicShield": 0, "artUrl": "/card-art/spectral-assassin.png", "description": "A ghostly killer who ignores armor and strikes true.", "isLoadingArt": false, "isLoadingDescription": false
    },
    {
      "id": "Vanguard Sentinel", "title": "Vanguard Sentinel", "cardType": "Monster", "melee": 5, "magic": 0, "defense": 7, "hp": 32, "maxHp": 32, "shield": 12, "maxShield": 12, "magicShield": 0, "maxMagicShield": 0, "artUrl": "/card-art/vanguard-sentinel.png", "description": "The unbreachable first line of defense.", "isLoadingArt": false, "isLoadingDescription": false
    },
    {
      "id": "Arcane Familiar", "title": "Arcane Familiar", "cardType": "Monster", "melee": 1, "magic": 3, "defense": 1, "hp": 8, "maxHp": 8, "shield": 0, "maxShield": 0, "magicShield": 3, "maxMagicShield": 3, "artUrl": "/card-art/arcane-familiar.png", "description": "A small magical companion that aids its master.", "isLoadingArt": false, "isLoadingDescription": false
    },
    {
      "id": "Earthshaker Behemoth", "title": "Earthshaker Behemoth", "cardType": "Monster", "melee": 10, "magic": 0, "defense": 8, "hp": 45, "maxHp": 45, "shield": 5, "maxShield": 5, "magicShield": 0, "maxMagicShield": 0, "artUrl": "/card-art/earthshaker-behemoth.png", "description": "Its roar is an earthquake, its charge a landslide.", "isLoadingArt": false, "isLoadingDescription": false
    },
    {
      "id": "Thunderbird Sovereign", "title": "Thunderbird Sovereign", "cardType": "Monster", "melee": 6, "magic": 8, "defense": 5, "hp": 30, "maxHp": 30, "shield": 0, "maxShield": 0, "magicShield": 0, "maxMagicShield": 0, "artUrl": "/card-art/thunderbird-sovereign.png", "description": "The king of storm birds, its cry is thunder itself.", "isLoadingArt": false, "isLoadingDescription": false
    },
    {
      "id": "Grove Protector", "title": "Grove Protector", "cardType": "Monster", "melee": 5, "magic": 6, "defense": 7, "hp": 34, "maxHp": 34, "shield": 0, "maxShield": 0, "magicShield": 0, "maxMagicShield": 0, "artUrl": "/card-art/grove-protector.png", "description": "A centaur-like guardian of sacred groves.", "isLoadingArt": false, "isLoadingDescription": false
    },
    {
      "id": "Netherworld Impaler", "title": "Netherworld Impaler", "cardType": "Monster", "melee": 9, "magic": 4, "defense": 3, "hp": 26, "maxHp": 26, "shield": 0, "maxShield": 0, "magicShield": 0, "maxMagicShield": 0, "artUrl": "/card-art/netherworld-impaler.png", "description": "A demonic knight from a fiery dimension.", "isLoadingArt": false, "isLoadingDescription": false
    },
    {
      "id": "Solar Templar", "title": "Solar Templar", "cardType": "Monster", "melee": 7, "magic": 5, "defense": 6, "hp": 33, "maxHp": 33, "shield": 5, "maxShield": 5, "magicShield": 5, "maxMagicShield": 5, "artUrl": "/card-art/solar-templar.png", "description": "A warrior infused with the power of the sun.", "isLoadingArt": false, "isLoadingDescription": false
    }
  ];

const spellCards = [
    { "id": "Healing Light", "title": "Healing Light", "cardType": "Spell", "artUrl": "/card-art/healing-light.png", "description": "Heals your active monster for 20 HP.", "isLoadingArt": false, "isLoadingDescription": false },
    { "id": "Fireball", "title": "Fireball", "cardType": "Spell", "artUrl": "/card-art/fireball.png", "description": "Deals 15 damage to opponent's monster, or 10 damage to opponent if no monster.", "isLoadingArt": false, "isLoadingDescription": false },
    { "id": "Arcane Shield", "title": "Arcane Shield", "cardType": "Spell", "artUrl": "/card-art/arcane-shield.png", "description": "Grants your active monster 10 magic shield.", "isLoadingArt": false, "isLoadingDescription": false },
    { "id": "Weakening Curse", "title": "Weakening Curse", "cardType": "Spell", "artUrl": "/card-art/weakening-curse.png", "description": "Reduces opponent's monster's Melee and Magic by 3.", "isLoadingArt": false, "isLoadingDescription": false },
    { "id": "Swiftness Aura", "title": "Swiftness Aura", "cardType": "Spell", "artUrl": "/card-art/swiftness-aura.png", "description": "Increases your active monster's Melee by 3.", "isLoadingArt": false, "isLoadingDescription": false },
    { "id": "Stone Skin", "title": "Stone Skin", "cardType": "Spell", "artUrl": "/card-art/stone-skin.png", "description": "Increases your active monster's Defense by 5.", "isLoadingArt": false, "isLoadingDescription": false },
    { "id": "Chain Lightning", "title": "Chain Lightning", "cardType": "Spell", "artUrl": "/card-art/chain-lightning.png", "description": "Deals 10 damage to opponent's monster. If it's defeated, deal 5 damage to the opponent.", "isLoadingArt": false, "isLoadingDescription": false },
    { "id": "Growth Spurt", "title": "Growth Spurt", "cardType": "Spell", "artUrl": "/card-art/growth-spurt.png", "description": "Increases your active monster's Max HP and current HP by 10.", "isLoadingArt": false, "isLoadingDescription": false },
    { "id": "Drain Life", "title": "Drain Life", "cardType": "Spell", "artUrl": "/card-art/drain-life.png", "description": "Deals 8 damage to opponent's monster and heals your active monster for the same amount.", "isLoadingArt": false, "isLoadingDescription": false },
    { "id": "Blinding Flash", "title": "Blinding Flash", "cardType": "Spell", "artUrl": "/card-art/blinding-flash.png", "description": "A brilliant flash of light. (Effect not yet implemented).", "isLoadingArt": false, "isLoadingDescription": false },
    { "id": "Might Infusion", "title": "Might Infusion", "cardType": "Spell", "artUrl": "/card-art/might-infusion.png", "description": "Fills a creature with power. (Effect not yet implemented).", "isLoadingArt": false, "isLoadingDescription": false },
    { "id": "Frost Nova", "title": "Frost Nova", "cardType": "Spell", "artUrl": "/card-art/frost-nova.png", "description": "An explosion of ice. (Effect not yet implemented).", "isLoadingArt": false, "isLoadingDescription": false },
    { "id": "Regenerate", "title": "Regenerate", "cardType": "Spell", "artUrl": "/card-art/regenerate.png", "description": "Your active monster heals 5 HP at the start of your next 3 turns.", "isLoadingArt": false, "isLoadingDescription": false },
    { "id": "Silence", "title": "Silence", "cardType": "Spell", "artUrl": "/card-art/silence.png", "description": "Prevents spell casting. (Effect not yet implemented).", "isLoadingArt": false, "isLoadingDescription": false },
    { "id": "Teleport Strike", "title": "Teleport Strike", "cardType": "Spell", "artUrl": "/card-art/teleport-strike.png", "description": "A sudden attack from nowhere. (Effect not yet implemented).", "isLoadingArt": false, "isLoadingDescription": false },
    { "id": "Quicksand Trap", "title": "Quicksand Trap", "cardType": "Spell", "artUrl": "/card-art/quicksand-trap.png", "description": "Hinders enemy movement. (Effect not yet implemented).", "isLoadingArt": false, "isLoadingDescription": false },
    { "id": "Ethereal Form", "title": "Ethereal Form", "cardType": "Spell", "artUrl": "/card-art/ethereal-form.png", "description": "Become ghostly and hard to hit. (Effect not yet implemented).", "isLoadingArt": false, "isLoadingDescription": false },
    { "id": "Counterspell", "title": "Counterspell", "cardType": "Spell", "artUrl": "/card-art/counterspell.png", "description": "Negate an opponent's spell. (Effect not yet implemented).", "isLoadingArt": false, "isLoadingDescription": false },
    { "id": "Summon Minor Spirit", "title": "Summon Minor Spirit", "cardType": "Spell", "artUrl": "/card-art/summon-minor-spirit.png", "description": "Summons a weak spirit to aid you. (Effect not yet implemented).", "isLoadingArt": false, "isLoadingDescription": false },
    { "id": "Dark Pact", "title": "Dark Pact", "cardType": "Spell", "artUrl": "/card-art/dark-pact.png", "description": "A deal with dark forces for power. (Effect not yet implemented).", "isLoadingArt": false, "isLoadingDescription": false },
    { "id": "Empower Weapon", "title": "Empower Weapon", "cardType": "Spell", "artUrl": "/card-art/empower-weapon.png", "description": "Enchants a weapon with magic. (Effect not yet implemented).", "isLoadingArt": false, "isLoadingDescription": false },
    { "id": "Mage Armor", "title": "Mage Armor", "cardType": "Spell", "artUrl": "/card-art/mage-armor.png", "description": "A shield of pure arcane energy. (Effect not yet implemented).", "isLoadingArt": false, "isLoadingDescription": false },
    { "id": "Terrify", "title": "Terrify", "cardType": "Spell", "artUrl": "/card-art/terrify.png", "description": "Returns opponent's active monster to their hand. If hand is full, it's discarded.", "isLoadingArt": false, "isLoadingDescription": false },
    { "id": "Focused Mind", "title": "Focused Mind", "cardType": "Spell", "artUrl": "/card-art/focused-mind.png", "description": "Increases focus and magical power. (Effect not yet implemented).", "isLoadingArt": false, "isLoadingDescription": false }
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

  console.log('Starting to seed database...');
  const batch = writeBatch(db);

  const allCards = [...monsterCards, ...spellCards];

  allCards.forEach(card => {
    // Use card.title as the document ID
    const docRef = doc(cardsCollectionRef, card.title);
    // The 'id' field is redundant if the document ID is the title, so we can omit it.
    const { id, ...cardData } = card; 
    batch.set(docRef, cardData);
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
