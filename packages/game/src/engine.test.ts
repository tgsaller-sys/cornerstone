import { describe, expect, it } from "vitest";
import {
  assertValidTransition,
  createDeck,
  createInitialGameState,
  reduceGameAction,
  shuffleDeck,
  sortCardsForPlay
} from ".";
import type { CardId, GameState, Player } from ".";

const players: readonly Player[] = [
  { id: "player-a", name: "Ada", connected: true, joinedAt: "2026-01-01T00:00:00.000Z" },
  { id: "player-b", name: "Ben", connected: true, joinedAt: "2026-01-01T00:01:00.000Z" },
  { id: "player-c", name: "Cyd", connected: true, joinedAt: "2026-01-01T00:02:00.000Z" }
];

function lobbyWithPlayers(count = 2): GameState {
  return players.slice(0, count).reduce((state, player) => {
    return assertValidTransition(reduceGameAction(state, { type: "join", player }));
  }, createInitialGameState("test-game"));
}

function startedGame(count = 2, startingHandSize = 5): GameState {
  return assertValidTransition(
    reduceGameAction(lobbyWithPlayers(count), {
      type: "start",
      actorId: "player-a",
      seed: 42,
      startingHandSize
    })
  );
}

describe("custom card catalog", () => {
  it("creates the letter deck from JSON", () => {
    const deck = createDeck("letters");

    expect(deck).toHaveLength(10);
    expect(deck[0]).toMatchObject({
      id: "letters-a",
      title: "Card A",
      shortDescription: "Card Letter A",
      longDescription: "Card A does this",
      art: "sword"
    });
    expect(deck[4]?.art).toBe("sword");
    expect(deck[5]?.art).toBe("shield");
  });

  it("creates the number deck from JSON", () => {
    const deck = createDeck("numbers");

    expect(deck).toHaveLength(10);
    expect(deck[0]).toMatchObject({
      id: "numbers-1",
      title: "Card 1",
      shortDescription: "Card Letter 1",
      longDescription: "Card 1 does this",
      art: "bow"
    });
    expect(deck[4]?.art).toBe("bow");
    expect(deck[5]?.art).toBe("winged-shoe");
  });
});

describe("shuffling", () => {
  it("is deterministic for the same seed", () => {
    const deck = createDeck("letters");

    expect(shuffleDeck(deck, 7)).toEqual(shuffleDeck(deck, 7));
    expect(shuffleDeck(deck, 7)).not.toEqual(deck);
  });
});

describe("starting a game", () => {
  it("allows a solo player to start", () => {
    const state = startedGame(1, 5);

    expect(state.players).toHaveLength(1);
    expect(state.currentTurn).toBe("player-a");
    expect(state.hands["player-a"]).toHaveLength(5);
    expect(state.decks["player-a"]).toHaveLength(5);
  });

  it("gives each player their own custom deck and requested hand size", () => {
    const state = startedGame(2, 5);

    expect(state.hands["player-a"]).toHaveLength(5);
    expect(state.hands["player-b"]).toHaveLength(5);
    expect(state.decks["player-a"]).toHaveLength(5);
    expect(state.decks["player-b"]).toHaveLength(5);
    expect(state.hands["player-a"]?.every((card) => card.deckId === "letters")).toBe(true);
    expect(state.hands["player-b"]?.every((card) => card.deckId === "numbers")).toBe(true);
    expect(state.currentTurn).toBe("player-a");
  });

  it("alternates custom deck templates for extra players", () => {
    const state = startedGame(3, 3);

    expect(state.hands["player-a"]?.every((card) => card.deckId === "letters")).toBe(true);
    expect(state.hands["player-b"]?.every((card) => card.deckId === "numbers")).toBe(true);
    expect(state.hands["player-c"]?.every((card) => card.deckId === "letters")).toBe(true);
  });
});

describe("turn actions", () => {
  it("lets a solo player end their turn and keep the turn", () => {
    const state = startedGame(1);
    const result = reduceGameAction(state, { type: "skip", actorId: "player-a" });

    expect(result.validation.ok).toBe(true);
    expect(result.state.currentTurn).toBe("player-a");
    expect(result.state.lastEvent).toEqual({ type: "skip", playerId: "player-a" });
  });

  it("lets a solo player play cards and keep the turn", () => {
    const state = startedGame(1);
    const playedCard = state.hands["player-a"]?.[0];

    expect(playedCard).toBeDefined();

    const result = reduceGameAction(state, {
      type: "play-cards",
      actorId: "player-a",
      cardIds: playedCard === undefined ? [] : [playedCard.id]
    });

    expect(result.validation.ok).toBe(true);
    expect(result.state.currentTurn).toBe("player-a");
    expect(result.state.discardPiles["player-a"]).toContainEqual(playedCard);
  });

  it("allows the current player to end their turn before any cards are played", () => {
    const state = startedGame();
    const result = reduceGameAction(state, { type: "skip", actorId: "player-a" });

    expect(result.validation.ok).toBe(true);
    expect(result.state.currentTurn).toBe("player-b");
    expect(result.state.currentLeadingPlay).toBeNull();
    expect(result.state.skippedPlayers).toEqual([]);
    expect(result.state.lastEvent).toEqual({ type: "skip", playerId: "player-a" });
  });

  it("plays one or more cards into the player's discard pile and writes a play event", () => {
    const state = startedGame();
    const actorId = state.currentTurn ?? "";
    const playedCards = state.hands[actorId]?.slice(0, 2) ?? [];

    const result = reduceGameAction(state, {
      type: "play-cards",
      actorId,
      cardIds: playedCards.map((card) => card.id)
    });

    expect(result.validation.ok).toBe(true);
    expect(result.state.hands[actorId]).toHaveLength(3);
    expect(result.state.discardPiles[actorId]).toEqual(playedCards);
    expect(result.state.lastEvent).toEqual({
      type: "play",
      playerId: actorId,
      cardTitles: playedCards.map((card) => card.title)
    });
    expect(result.state.currentTurn).toBe("player-b");
  });

  it("draws one card from the current player's deck into their hand", () => {
    const state = startedGame();
    const actorId = state.currentTurn ?? "";
    const deckTop = state.decks[actorId]?.[0];

    expect(deckTop).toBeDefined();

    const result = reduceGameAction(state, { type: "draw-card", actorId });

    expect(result.validation.ok).toBe(true);
    expect(result.state.hands[actorId]).toContainEqual(deckTop);
    expect(result.state.hands[actorId]).toHaveLength(6);
    expect(result.state.decks[actorId]).toHaveLength(4);
  });

  it("searches the current player's deck for a card and moves it into their hand", () => {
    const state = startedGame();
    const actorId = state.currentTurn ?? "";
    const cardInDeck = state.decks[actorId]?.[2];

    expect(cardInDeck).toBeDefined();

    const result = reduceGameAction(state, {
      type: "search-deck",
      actorId,
      cardId: cardInDeck?.id ?? "letters-a"
    });

    expect(result.validation.ok).toBe(true);
    expect(result.state.hands[actorId]).toContainEqual(cardInDeck);
    expect(result.state.decks[actorId]?.some((nextCard) => nextCard.id === cardInDeck?.id)).toBe(false);
  });

  it("searches the current player's discard pile for a card and moves it into their hand", () => {
    const state = startedGame();
    const actorId = state.currentTurn ?? "";
    const playedCard = state.hands[actorId]?.[0];

    expect(playedCard).toBeDefined();

    const afterPlay = assertValidTransition(
      reduceGameAction(state, {
        type: "play-cards",
        actorId,
        cardIds: playedCard === undefined ? [] : [playedCard.id]
      })
    );
    const result = reduceGameAction(
      { ...afterPlay, currentTurn: actorId },
      { type: "search-discard", actorId, cardId: playedCard?.id ?? "letters-a" }
    );

    expect(result.validation.ok).toBe(true);
    expect(result.state.hands[actorId]).toContainEqual(playedCard);
    expect(result.state.discardPiles[actorId]?.some((nextCard) => nextCard.id === playedCard?.id)).toBe(false);
  });

  it("shuffles the current player's discard pile into their deck", () => {
    const state = startedGame();
    const actorId = state.currentTurn ?? "";
    const playedCard = state.hands[actorId]?.[0];

    expect(playedCard).toBeDefined();

    const afterPlay = assertValidTransition(
      reduceGameAction(state, {
        type: "play-cards",
        actorId,
        cardIds: playedCard === undefined ? [] : [playedCard.id]
      })
    );
    const result = reduceGameAction(
      { ...afterPlay, currentTurn: actorId },
      { type: "shuffle-discard-into-deck", actorId, seed: 12 }
    );

    expect(result.validation.ok).toBe(true);
    expect(result.state.discardPiles[actorId]).toHaveLength(0);
    expect(result.state.decks[actorId]).toHaveLength(6);
    expect(result.state.decks[actorId]?.some((nextCard) => nextCard.id === playedCard?.id)).toBe(true);
  });

  it("rejects plays from the wrong player", () => {
    const state = startedGame();
    const card = state.hands["player-b"]?.[0];

    const result = reduceGameAction(state, {
      type: "play-cards",
      actorId: "player-b",
      cardIds: card === undefined ? [] : [card.id]
    });

    expect(result.validation.ok).toBe(false);
    expect(result.state).toBe(state);
  });

  it("rejects cards not owned by the current player", () => {
    const state = startedGame();
    const actorId = state.currentTurn ?? "";
    const otherCard = state.hands["player-b"]?.[0];

    const result = reduceGameAction(state, {
      type: "play-cards",
      actorId,
      cardIds: otherCard === undefined ? [] : [otherCard.id]
    });

    expect(result.validation.ok).toBe(false);
  });
});

describe("sorting", () => {
  it("sorts cards by catalog order", () => {
    const cards = createDeck("letters");
    const shuffled = [cards[4], cards[1], cards[0]].filter((card): card is (typeof cards)[number] => card !== undefined);

    expect(sortCardsForPlay(shuffled).map((card) => card.id)).toEqual(["letters-a", "letters-b", "letters-e"]);
  });
});
