export type CardArt = "bow" | "shield" | "sword" | "winged-shoe";

export type CardId = string;

export type DeckId = string;

export interface Card {
  readonly id: CardId;
  readonly deckId: DeckId;
  readonly title: string;
  readonly shortDescription: string;
  readonly longDescription: string;
  readonly art: CardArt;
}

export interface DeckDefinition {
  readonly id: DeckId;
  readonly title: string;
}

export type PlayerId = string;

export interface Player {
  readonly id: PlayerId;
  readonly name: string;
  readonly deckId?: DeckId;
  readonly connected: boolean;
  readonly joinedAt: string;
}

export interface PlayedSet {
  readonly playerId: PlayerId;
  readonly cards: readonly Card[];
}

export type PlayKind = "custom";

export interface PlayShape {
  readonly kind: PlayKind;
  readonly length: number;
  readonly highCard: Card;
}

export type GamePhase = "lobby" | "playing" | "finished";

export type GameEvent =
  | {
      readonly type: "skip";
      readonly playerId: PlayerId;
    }
  | {
      readonly type: "play";
      readonly playerId: PlayerId;
      readonly cardTitles: readonly string[];
    }
  | {
      readonly type: "draw";
      readonly playerId: PlayerId;
    }
  | {
      readonly type: "shuffle-deck";
      readonly playerId: PlayerId;
    }
  | {
      readonly type: "recycle-discard";
      readonly playerId: PlayerId;
    }
  | {
      readonly type: "search-deck";
      readonly playerId: PlayerId;
      readonly cardId: CardId;
    }
  | {
      readonly type: "search-discard";
      readonly playerId: PlayerId;
      readonly cardId: CardId;
    };

export interface GameState {
  readonly id: string;
  readonly phase: GamePhase;
  readonly players: readonly Player[];
  readonly hands: Readonly<Record<PlayerId, readonly Card[]>>;
  readonly decks: Readonly<Record<PlayerId, readonly Card[]>>;
  readonly discardPiles: Readonly<Record<PlayerId, readonly Card[]>>;
  readonly deck: readonly Card[];
  readonly discardPile: readonly PlayedSet[];
  readonly currentTurn: PlayerId | null;
  readonly currentLeadingPlay: PlayedSet | null;
  readonly skippedPlayers: readonly PlayerId[];
  readonly winnerId: PlayerId | null;
  readonly lastEvent: GameEvent | null;
  readonly turnOrder: readonly PlayerId[];
  readonly version: number;
}

export type GameAction =
  | {
      readonly type: "join";
      readonly player: Player;
    }
  | {
      readonly type: "set-connection";
      readonly playerId: PlayerId;
      readonly connected: boolean;
    }
  | {
      readonly type: "start";
      readonly actorId: PlayerId;
      readonly seed: number;
      readonly startingHandSize?: number;
      readonly maxCardsPerPlayer?: number;
    }
  | {
      readonly type: "play-cards";
      readonly actorId: PlayerId;
      readonly cardIds: readonly CardId[];
    }
  | {
      readonly type: "draw-card";
      readonly actorId: PlayerId;
    }
  | {
      readonly type: "shuffle-deck";
      readonly actorId: PlayerId;
      readonly seed: number;
    }
  | {
      readonly type: "shuffle-discard-into-deck";
      readonly actorId: PlayerId;
      readonly seed: number;
    }
  | {
      readonly type: "search-deck";
      readonly actorId: PlayerId;
      readonly cardId: CardId;
    }
  | {
      readonly type: "search-discard";
      readonly actorId: PlayerId;
      readonly cardId: CardId;
    }
  | {
      readonly type: "skip";
      readonly actorId: PlayerId;
    };

export type ValidationResult =
  | {
      readonly ok: true;
    }
  | {
      readonly ok: false;
      readonly reason: string;
    };

export type PlayValidationResult =
  | {
      readonly ok: true;
      readonly cards: readonly Card[];
    }
  | {
      readonly ok: false;
      readonly reason: string;
    };

export type RuleValidator = (state: GameState, actorId: PlayerId, cards: readonly Card[]) => ValidationResult;
