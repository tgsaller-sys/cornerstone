import cardCatalog from "./cardCatalog.json";
import type { Card, CardArt, CardId, DeckDefinition, DeckId } from "./types";

interface CatalogCard {
  readonly id: CardId;
  readonly title: string;
  readonly shortDescription: string;
  readonly longDescription: string;
  readonly art: CardArt;
}

interface CatalogDeck {
  readonly id: DeckId;
  readonly title: string;
  readonly cards: readonly CatalogCard[];
}

const catalogDecks = cardCatalog.decks as readonly CatalogDeck[];
const cardOrder = new Map(
  catalogDecks.flatMap((deck, deckIndex) =>
    deck.cards.map((card, cardIndex) => [card.id, deckIndex * 100 + cardIndex] as const)
  )
);

export function createDeck(deckId: DeckId = catalogDecks[0]?.id ?? "letters"): readonly Card[] {
  const deck = catalogDecks.find((nextDeck) => nextDeck.id === deckId);

  if (deck === undefined) {
    throw new Error(`Unknown deck ${deckId}.`);
  }

  return deck.cards.map((card) => ({
    ...card,
    deckId: deck.id
  }));
}

export function getAvailableDecks(): readonly DeckDefinition[] {
  return catalogDecks.map((deck) => ({
    id: deck.id,
    title: deck.title
  }));
}

export function getDefaultDeckId(): DeckId {
  const deck = catalogDecks[0];

  if (deck === undefined) {
    throw new Error("Card catalog must include at least one deck.");
  }

  return deck.id;
}

export function createDeckForPlayerIndex(playerIndex: number): readonly Card[] {
  const deck = catalogDecks[playerIndex % catalogDecks.length];

  if (deck === undefined) {
    throw new Error("Card catalog must include at least one deck.");
  }

  return createDeck(deck.id);
}

export function createAllCards(): readonly Card[] {
  return catalogDecks.flatMap((deck) => createDeck(deck.id));
}

export function findCardsById(cards: readonly Card[], ids: readonly CardId[]): readonly Card[] {
  const byId = new Map(cards.map((card) => [card.id, card]));
  return ids.map((id) => byId.get(id)).filter((card): card is Card => card !== undefined);
}

export function compareCardsForPlay(left: Card, right: Card): number {
  return (cardOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (cardOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER);
}

export function sortCardsForPlay(cards: readonly Card[]): readonly Card[] {
  return [...cards].sort(compareCardsForPlay);
}

export function highestCardForPlay(cards: readonly Card[]): Card | null {
  return sortCardsForPlay(cards).at(-1) ?? null;
}
