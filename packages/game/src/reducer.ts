import { createShuffledDeck, shuffleDeck } from "./deck";
import { createDeckForPlayerIndex } from "./cards";
import { allOtherPlayersSkipped, nextEligiblePlayerId, nextPlayerId } from "./turns";
import { setPlayerConnection, upsertPlayer } from "./state";
import { validatePlay, validateSkip } from "./rules";
import type { Card, CardId, GameAction, GameState, PlayerId, RuleValidator, ValidationResult } from "./types";

export interface TransitionResult {
  readonly state: GameState;
  readonly validation: ValidationResult;
}

export interface ReducerOptions {
  readonly playValidators?: readonly RuleValidator[];
}

function bumpVersion(state: GameState): GameState {
  return { ...state, version: state.version + 1 };
}

function removeCardsFromHand(hand: readonly Card[], playedCards: readonly Card[]): readonly Card[] {
  const playedIds = new Set(playedCards.map((card) => card.id));
  return hand.filter((card) => !playedIds.has(card.id));
}

function removeCardById(cards: readonly Card[], cardId: CardId): readonly Card[] {
  return cards.filter((card) => card.id !== cardId);
}

function validateStartingHandSize(startingHandSize: number | undefined): ValidationResult {
  if (startingHandSize === undefined) {
    return { ok: true };
  }

  if (!Number.isInteger(startingHandSize) || startingHandSize < 1 || startingHandSize > 52) {
    return { ok: false, reason: "Starting cards must be a whole number from 1 to 52." };
  }

  return { ok: true };
}

function requirePlayingTurn(state: GameState, actorId: PlayerId): ValidationResult {
  if (state.phase !== "playing") {
    return { ok: false, reason: "The game is not in progress." };
  }

  if (state.currentTurn !== actorId) {
    return { ok: false, reason: "It is not this player's turn." };
  }

  return { ok: true };
}

function dealPlayerDecks(
  players: readonly PlayerId[],
  seed: number,
  startingHandSize: number
): {
  readonly hands: Readonly<Record<PlayerId, readonly Card[]>>;
  readonly decks: Readonly<Record<PlayerId, readonly Card[]>>;
  readonly discardPiles: Readonly<Record<PlayerId, readonly Card[]>>;
} {
  const hands: Record<PlayerId, readonly Card[]> = {};
  const decks: Record<PlayerId, readonly Card[]> = {};
  const discardPiles: Record<PlayerId, readonly Card[]> = {};

  players.forEach((playerId, playerIndex) => {
    const playerDeck = createShuffledDeck(seed + playerIndex, createDeckForPlayerIndex(playerIndex));
    hands[playerId] = playerDeck.slice(0, startingHandSize);
    decks[playerId] = playerDeck.slice(startingHandSize);
    discardPiles[playerId] = [];
  });

  return { hands, decks, discardPiles };
}

/**
 * Applies one player action to immutable game state after validating it.
 * This is the authoritative transition function used by UI and server sync code.
 */
export function reduceGameAction(
  state: GameState,
  action: GameAction,
  options: ReducerOptions = {}
): TransitionResult {
  switch (action.type) {
    case "join": {
      if (state.phase !== "lobby") {
        return { state, validation: { ok: false, reason: "Players can only join during the lobby." } };
      }

      return {
        state: bumpVersion({
          ...state,
          players: upsertPlayer(state.players, action.player)
        }),
        validation: { ok: true }
      };
    }

    case "set-connection": {
      return {
        state: bumpVersion({
          ...state,
          players: setPlayerConnection(state.players, action.playerId, action.connected)
        }),
        validation: { ok: true }
      };
    }

    case "start": {
      if (state.phase !== "lobby") {
        return { state, validation: { ok: false, reason: "Game has already started." } };
      }

      if (state.players.length < 2) {
        return { state, validation: { ok: false, reason: "At least two players are required." } };
      }

      if (!state.players.some((player) => player.id === action.actorId)) {
        return { state, validation: { ok: false, reason: "Only a joined player can start the game." } };
      }

      const startingHandSize = action.startingHandSize ?? action.maxCardsPerPlayer ?? 5;
      const startingHandValidation = validateStartingHandSize(startingHandSize);

      if (!startingHandValidation.ok) {
        return { state, validation: startingHandValidation };
      }

      const turnOrder = state.players.map((player) => player.id);
      const { hands, decks, discardPiles } = dealPlayerDecks(turnOrder, action.seed, startingHandSize);
      const startingPlayerId = turnOrder[0] ?? null;

      return {
        state: bumpVersion({
          ...state,
          phase: "playing",
          hands,
          decks,
          discardPiles,
          deck: [],
          discardPile: [],
          currentTurn: startingPlayerId,
          currentLeadingPlay: null,
          skippedPlayers: [],
          lastEvent: null,
          turnOrder
        }),
        validation: { ok: true }
      };
    }

    case "play-cards": {
      const validation = validatePlay(state, action.actorId, action.cardIds, options.playValidators);

      if (!validation.ok || validation.cards === undefined) {
        return { state, validation };
      }

      const nextHands = {
        ...state.hands,
        [action.actorId]: removeCardsFromHand(state.hands[action.actorId] ?? [], validation.cards)
      };
      const nextDiscardPiles = {
        ...state.discardPiles,
        [action.actorId]: [...(state.discardPiles[action.actorId] ?? []), ...validation.cards]
      };
      const nextState: GameState = {
        ...state,
        hands: nextHands,
        discardPiles: nextDiscardPiles,
        discardPile: [...state.discardPile, { playerId: action.actorId, cards: validation.cards }],
        currentLeadingPlay: { playerId: action.actorId, cards: validation.cards },
        lastEvent: { type: "play", playerId: action.actorId, cardTitles: validation.cards.map((card) => card.title) },
        skippedPlayers: state.skippedPlayers,
        currentTurn: nextEligiblePlayerId(state.turnOrder, action.actorId, state.skippedPlayers),
        phase: state.phase,
        winnerId: state.winnerId
      };

      return { state: bumpVersion(nextState), validation: { ok: true } };
    }

    case "draw-card": {
      const turnValidation = requirePlayingTurn(state, action.actorId);

      if (!turnValidation.ok) {
        return { state, validation: turnValidation };
      }

      const deck = state.decks[action.actorId] ?? [];
      const drawnCard = deck[0];

      if (drawnCard === undefined) {
        return { state, validation: { ok: false, reason: "Your deck is empty." } };
      }

      return {
        state: bumpVersion({
          ...state,
          hands: {
            ...state.hands,
            [action.actorId]: [...(state.hands[action.actorId] ?? []), drawnCard]
          },
          decks: {
            ...state.decks,
            [action.actorId]: deck.slice(1)
          },
          lastEvent: { type: "draw", playerId: action.actorId }
        }),
        validation: { ok: true }
      };
    }

    case "shuffle-deck": {
      const turnValidation = requirePlayingTurn(state, action.actorId);

      if (!turnValidation.ok) {
        return { state, validation: turnValidation };
      }

      return {
        state: bumpVersion({
          ...state,
          decks: {
            ...state.decks,
            [action.actorId]: shuffleDeck(state.decks[action.actorId] ?? [], action.seed)
          },
          lastEvent: { type: "shuffle-deck", playerId: action.actorId }
        }),
        validation: { ok: true }
      };
    }

    case "shuffle-discard-into-deck": {
      const turnValidation = requirePlayingTurn(state, action.actorId);

      if (!turnValidation.ok) {
        return { state, validation: turnValidation };
      }

      const discardPile = state.discardPiles[action.actorId] ?? [];

      if (discardPile.length === 0) {
        return { state, validation: { ok: false, reason: "Your discard pile is empty." } };
      }

      return {
        state: bumpVersion({
          ...state,
          decks: {
            ...state.decks,
            [action.actorId]: shuffleDeck([...(state.decks[action.actorId] ?? []), ...discardPile], action.seed)
          },
          discardPiles: {
            ...state.discardPiles,
            [action.actorId]: []
          },
          lastEvent: { type: "recycle-discard", playerId: action.actorId }
        }),
        validation: { ok: true }
      };
    }

    case "search-deck": {
      const turnValidation = requirePlayingTurn(state, action.actorId);

      if (!turnValidation.ok) {
        return { state, validation: turnValidation };
      }

      const deck = state.decks[action.actorId] ?? [];
      const foundCard = deck.find((card) => card.id === action.cardId);

      if (foundCard === undefined) {
        return { state, validation: { ok: false, reason: "That card is not in your deck." } };
      }

      return {
        state: bumpVersion({
          ...state,
          hands: {
            ...state.hands,
            [action.actorId]: [...(state.hands[action.actorId] ?? []), foundCard]
          },
          decks: {
            ...state.decks,
            [action.actorId]: removeCardById(deck, foundCard.id)
          },
          lastEvent: { type: "search-deck", playerId: action.actorId, cardId: foundCard.id }
        }),
        validation: { ok: true }
      };
    }

    case "search-discard": {
      const turnValidation = requirePlayingTurn(state, action.actorId);

      if (!turnValidation.ok) {
        return { state, validation: turnValidation };
      }

      const discardPile = state.discardPiles[action.actorId] ?? [];
      const foundCard = discardPile.find((card) => card.id === action.cardId);

      if (foundCard === undefined) {
        return { state, validation: { ok: false, reason: "That card is not in your discard pile." } };
      }

      return {
        state: bumpVersion({
          ...state,
          hands: {
            ...state.hands,
            [action.actorId]: [...(state.hands[action.actorId] ?? []), foundCard]
          },
          discardPiles: {
            ...state.discardPiles,
            [action.actorId]: removeCardById(discardPile, foundCard.id)
          },
          lastEvent: { type: "search-discard", playerId: action.actorId, cardId: foundCard.id }
        }),
        validation: { ok: true }
      };
    }

    case "skip": {
      const validation = validateSkip(state, action.actorId);

      if (!validation.ok) {
        return { state, validation };
      }

      const currentLeadingPlayer = state.currentLeadingPlay?.playerId;
      const skippedPlayers = [...new Set([...state.skippedPlayers, action.actorId])];

      if (
        currentLeadingPlayer !== undefined &&
        allOtherPlayersSkipped(state.turnOrder, currentLeadingPlayer, skippedPlayers)
      ) {
        return {
          state: bumpVersion({
            ...state,
            currentTurn: currentLeadingPlayer,
            currentLeadingPlay: null,
            lastEvent: { type: "skip", playerId: action.actorId },
            skippedPlayers: []
          }),
          validation: { ok: true }
        };
      }

      return {
        state: bumpVersion({
          ...state,
          skippedPlayers,
          lastEvent: { type: "skip", playerId: action.actorId },
          currentTurn: nextPlayerId(state.turnOrder, action.actorId)
        }),
        validation: { ok: true }
      };
    }
  }
}

export function assertValidTransition(result: TransitionResult): GameState {
  if (!result.validation.ok) {
    throw new Error(result.validation.reason);
  }

  return result.state;
}
