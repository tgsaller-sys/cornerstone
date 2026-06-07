import {
  assertValidTransition,
  createInitialGameState,
  normalizeClassIds,
  type ClassId,
  reduceGameAction,
  type DeckId,
  type GameAction,
  type GameState,
  type Player
} from "@cornerstone3/game";

interface PlayerChoices {
  readonly deckId?: DeckId;
  readonly classIds?: readonly ClassId[];
}

export function createPlayer(playerId: string, name: string, choices: PlayerChoices = {}): Player {
  const now = new Date().toISOString();
  const classIds = normalizeClassIds(choices.classIds ?? []);

  return {
    id: playerId,
    name,
    ...(choices.deckId === undefined ? {} : { deckId: choices.deckId }),
    ...(classIds.length === 0 ? {} : { classIds }),
    connected: true,
    joinedAt: now
  };
}

export function createLobbyGame(
  localPlayerId: string,
  playerName: string,
  gameId: string,
  choices: PlayerChoices = {}
): GameState {
  const game = createInitialGameState(gameId);
  return assertValidTransition(
    reduceGameAction(game, { type: "join", player: createPlayer(localPlayerId, playerName, choices) })
  );
}

export function createDemoGame(
  localPlayerId: string,
  playerName: string,
  lobbyCode: string,
  choices: PlayerChoices = {}
): GameState {
  const localPlayer = createPlayer(localPlayerId, playerName, choices);

  const game = createInitialGameState(lobbyCode);
  return assertValidTransition(reduceGameAction(game, { type: "join", player: localPlayer }));
}

export function dispatchLocalAction(state: GameState, action: GameAction): GameState {
  return assertValidTransition(reduceGameAction(state, action));
}
