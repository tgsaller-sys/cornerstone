import {
  assertValidTransition,
  createInitialGameState,
  reduceGameAction,
  type DeckId,
  type GameAction,
  type GameState,
  type Player
} from "@cornerstone3/game";

export function createPlayer(playerId: string, name: string, deckId?: DeckId): Player {
  const now = new Date().toISOString();

  return {
    id: playerId,
    name,
    ...(deckId === undefined ? {} : { deckId }),
    connected: true,
    joinedAt: now
  };
}

export function createLobbyGame(localPlayerId: string, playerName: string, gameId: string, deckId?: DeckId): GameState {
  const game = createInitialGameState(gameId);
  return assertValidTransition(
    reduceGameAction(game, { type: "join", player: createPlayer(localPlayerId, playerName, deckId) })
  );
}

export function createDemoGame(localPlayerId: string, playerName: string, lobbyCode: string, deckId?: DeckId): GameState {
  const localPlayer = createPlayer(localPlayerId, playerName, deckId);

  const game = createInitialGameState(lobbyCode);
  return assertValidTransition(reduceGameAction(game, { type: "join", player: localPlayer }));
}

export function dispatchLocalAction(state: GameState, action: GameAction): GameState {
  return assertValidTransition(reduceGameAction(state, action));
}
