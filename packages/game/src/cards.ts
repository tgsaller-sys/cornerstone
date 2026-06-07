import cardCatalog from "./cardCatalog.json";
import classCatalog from "./cards.json";
import type { Card, CardArt, CardId, ClassDefinition, ClassId, DeckDefinition, DeckId } from "./types";

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

interface ClassCatalogCard {
  readonly class: string;
  readonly level: string;
  readonly name: string;
  readonly action_type: string;
  readonly tags: readonly string[];
  readonly text: string;
}

const catalogDecks = cardCatalog.decks as readonly CatalogDeck[];
const classCards = classCatalog as readonly ClassCatalogCard[];

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getClassId(className: string): ClassId {
  return slugify(className);
}

function inferCardArt(card: ClassCatalogCard, classIndex: number, cardIndex: number): CardArt {
  const tags = new Set(card.tags.map((tag) => tag.toLowerCase()));
  const actionType = card.action_type.toLowerCase();

  if (tags.has("shielding")) {
    return "shield";
  }

  if (tags.has("ranged") || tags.has("ranger") || actionType.includes("ranged")) {
    return "bow";
  }

  if (tags.has("movement") || tags.has("quickdraw")) {
    return "winged-shoe";
  }

  if (tags.has("attack") || tags.has("melee")) {
    return "sword";
  }

  const artCycle: readonly CardArt[] = ["sword", "shield", "bow", "winged-shoe"];
  return artCycle[(classIndex + cardIndex) % artCycle.length] ?? "sword";
}

const availableClasses = Array.from(
  classCards.reduce((classes, card) => {
    const classId = getClassId(card.class);
    const existing = classes.get(classId);

    classes.set(classId, {
      id: classId,
      title: card.class,
      cardCount: (existing?.cardCount ?? 0) + 1
    });

    return classes;
  }, new Map<ClassId, ClassDefinition>())
).map(([_classId, definition]) => definition);

const classIndexById = new Map(availableClasses.map((definition, index) => [definition.id, index] as const));

const generatedClassCards = classCards.map((card, cardIndex): Card => {
  const classId = getClassId(card.class);
  const classIndex = classIndexById.get(classId) ?? 0;
  const cardId = `${classId}-${slugify(card.name)}-${cardIndex + 1}`;

  return {
    id: cardId,
    deckId: `class-${classId}`,
    classId,
    classTitle: card.class,
    tags: card.tags,
    title: card.name,
    shortDescription: `${card.level} - ${card.action_type}`,
    longDescription: card.text,
    art: inferCardArt(card, classIndex, cardIndex)
  };
});

const classCardsByClassId = generatedClassCards.reduce((cardsByClassId, card) => {
  if (card.classId === undefined) {
    return cardsByClassId;
  }

  cardsByClassId.set(card.classId, [...(cardsByClassId.get(card.classId) ?? []), card]);
  return cardsByClassId;
}, new Map<ClassId, readonly Card[]>());

const cardOrder = new Map(
  [
    ...catalogDecks.flatMap((deck, deckIndex) =>
      deck.cards.map((card, cardIndex) => [card.id, deckIndex * 1000 + cardIndex] as const)
    ),
    ...generatedClassCards.map((card, cardIndex) => [card.id, 100000 + cardIndex] as const)
  ]
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

export function getAvailableClasses(): readonly ClassDefinition[] {
  return availableClasses;
}

export function getDefaultClassIds(): readonly ClassId[] {
  const firstClass = availableClasses[0];

  if (firstClass === undefined) {
    throw new Error("Class card catalog must include at least one class.");
  }

  return [firstClass.id];
}

export function normalizeClassIds(classIds: readonly ClassId[]): readonly ClassId[] {
  const knownClassIds = new Set(availableClasses.map((definition) => definition.id));
  return [...new Set(classIds.filter((classId) => knownClassIds.has(classId)))];
}

export function createClassDeck(classIds: readonly ClassId[] = getDefaultClassIds()): readonly Card[] {
  const normalizedClassIds = normalizeClassIds(classIds);
  const effectiveClassIds = normalizedClassIds.length > 0 ? normalizedClassIds : getDefaultClassIds();
  const deckId = `classes-${effectiveClassIds.join("-")}`;

  return effectiveClassIds.flatMap((classId) =>
    (classCardsByClassId.get(classId) ?? []).map((card) => ({
      ...card,
      deckId
    }))
  );
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
  return [...catalogDecks.flatMap((deck) => createDeck(deck.id)), ...generatedClassCards];
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
