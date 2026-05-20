import {
  assertValidTransition,
  createInitialGameState,
  reduceGameAction,
  type GameAction,
  type GameState,
  type Player
} from "@cornerstone3/game";

export function createPlayer(playerId: string, name: string): Player {
  const now = new Date().toISOString();

  return {
    id: playerId,
    name,
    connected: true,
    joinedAt: now
  };
}

export function createLobbyGame(localPlayerId: string, playerName: string, gameId: string): GameState {
  const game = createInitialGameState(gameId);
  return assertValidTransition(
    reduceGameAction(game, { type: "join", player: createPlayer(localPlayerId, playerName) })
  );
}

export function createDemoGame(localPlayerId: string, playerName: string, lobbyCode: string): GameState {
  const localPlayer = createPlayer(localPlayerId, playerName);

  const game = createInitialGameState(lobbyCode);
  return assertValidTransition(reduceGameAction(game, { type: "join", player: localPlayer }));
}

export function dispatchLocalAction(state: GameState, action: GameAction): GameState {
  return assertValidTransition(reduceGameAction(state, action));
}
