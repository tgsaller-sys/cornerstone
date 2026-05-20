import { findCardsById } from "./cards";
import type {
  Card,
  CardId,
  GameState,
  PlayedSet,
  PlayerId,
  PlayShape,
  PlayValidationResult,
  RuleValidator,
  ValidationResult
} from "./types";

export const allowAnyOwnedCards: RuleValidator = (_state, _actorId, cards) => {
  if (cards.length === 0) {
    return { ok: false, reason: "Play at least one card." };
  }

  return { ok: true };
};

export function identifyPlayShape(cards: readonly Card[]): PlayShape | null {
  const highCard = cards.at(-1);

  if (highCard === undefined) {
    return null;
  }

  return {
    kind: "custom",
    length: cards.length,
    highCard
  };
}

function playShapeForPlayedSet(playedSet: PlayedSet): PlayShape | null {
  return identifyPlayShape(playedSet.cards);
}

export function isBombShape(_shape: PlayShape): boolean {
  return false;
}

export function isBombPlay(_cards: readonly Card[]): boolean {
  return false;
}

export const validateCornerstone3Play: RuleValidator = allowAnyOwnedCards;

export function validatePlay(
  state: GameState,
  actorId: PlayerId,
  cardIds: readonly CardId[],
  validators: readonly RuleValidator[] = [allowAnyOwnedCards]
): PlayValidationResult {
  void playShapeForPlayedSet;

  if (state.phase !== "playing") {
    return { ok: false, reason: "The game is not in progress." };
  }

  if (state.currentTurn !== actorId) {
    return { ok: false, reason: "It is not this player's turn." };
  }

  if (state.skippedPlayers.includes(actorId)) {
    return { ok: false, reason: "This player skipped and cannot play again until the hand resets." };
  }

  if (new Set(cardIds).size !== cardIds.length) {
    return { ok: false, reason: "A card cannot be played twice." };
  }

  const hand = state.hands[actorId] ?? [];
  const cards = findCardsById(hand, cardIds);

  if (cards.length !== cardIds.length) {
    return { ok: false, reason: "One or more cards are not in this player's hand." };
  }

  for (const validator of validators) {
    const result = validator(state, actorId, cards);

    if (!result.ok) {
      return result;
    }
  }

  return { ok: true, cards };
}

export function validateSkip(state: GameState, actorId: PlayerId): ValidationResult {
  if (state.phase !== "playing") {
    return { ok: false, reason: "The game is not in progress." };
  }

  if (state.currentTurn !== actorId) {
    return { ok: false, reason: "It is not this player's turn." };
  }

  return { ok: true };
}
