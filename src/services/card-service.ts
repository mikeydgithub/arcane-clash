
import { db } from '@/lib/firebase';
import type { CardData, MonsterCardData, SpellCardData } from '@/types';
import { collection, query, where, getDocs } from 'firebase/firestore';

const cardsCollection = collection(db, 'cards');

const fetchCardsByType = async <T extends CardData>(cardType: 'Monster' | 'Spell'): Promise<T[]> => {
    const q = query(cardsCollection, where('cardType', '==', cardType));
    const querySnapshot = await getDocs(q);
    const cards: T[] = [];
    querySnapshot.forEach((doc) => {
        // We can cast here because the query ensures the cardType matches.
        cards.push({ id: doc.id, ...doc.data() } as T);
    });
    return cards;
};

export const fetchAllMonsterCards = async (): Promise<MonsterCardData[]> => {
    return fetchCardsByType<MonsterCardData>('Monster');
};

export const fetchAllSpellCards = async (): Promise<SpellCardData[]> => {
    return fetchCardsByType<SpellCardData>('Spell');
};
