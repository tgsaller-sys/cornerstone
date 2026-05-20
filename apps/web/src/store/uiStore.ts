import { create } from "zustand";
import type { CardId, DeckId, PlayerId } from "@cornerstone3/game";

const defaultMaxCardsPerPlayer = 5;
const minMaxCardsPerPlayer = 1;
const maxMaxCardsPerPlayer = 52;

interface UiState {
  readonly localPlayerId: PlayerId;
  readonly playerName: string;
  readonly selectedDeckId: DeckId;
  readonly maxCardsPerPlayer: number;
  readonly selectedCardIds: readonly CardId[];
  readonly lobbyCode: string;
  readonly error: string | null;
  readonly setPlayerName: (playerName: string) => void;
  readonly setSelectedDeckId: (deckId: DeckId) => void;
  readonly setMaxCardsPerPlayer: (maxCardsPerPlayer: number) => void;
  readonly setLobbyCode: (lobbyCode: string) => void;
  readonly toggleCard: (cardId: CardId) => void;
  readonly clearSelection: () => void;
  readonly setError: (error: string | null) => void;
}

function createLocalPlayerId(): PlayerId {
  const existing =
    window.localStorage.getItem("cornerstone3.localPlayerId") ??
    window.localStorage.getItem("vc.localPlayerId") ??
    window.sessionStorage.getItem("vc.localPlayerId");

  if (existing !== null) {
    window.localStorage.setItem("cornerstone3.localPlayerId", existing);
    return existing;
  }

  const next = window.crypto.randomUUID();
  window.localStorage.setItem("cornerstone3.localPlayerId", next);
  return next;
}

function createInitialPlayerName(): string {
  return window.localStorage.getItem("cornerstone3.playerName") ?? window.localStorage.getItem("vc.playerName") ?? "";
}

function createInitialSelectedDeckId(): DeckId {
  return window.localStorage.getItem("cornerstone3.selectedDeckId") ?? "letters";
}

function createInitialMaxCardsPerPlayer(): number {
  const storedValue = Number(
    window.localStorage.getItem("cornerstone3.startingCards") ?? window.localStorage.getItem("vc.maxCardsPerPlayer")
  );
  return Number.isInteger(storedValue) && storedValue >= minMaxCardsPerPlayer && storedValue <= maxMaxCardsPerPlayer
    ? storedValue
    : defaultMaxCardsPerPlayer;
}

function normalizeMaxCardsPerPlayer(maxCardsPerPlayer: number): number {
  if (!Number.isFinite(maxCardsPerPlayer)) {
    return defaultMaxCardsPerPlayer;
  }

  return Math.min(maxMaxCardsPerPlayer, Math.max(minMaxCardsPerPlayer, Math.floor(maxCardsPerPlayer)));
}

export const useUiStore = create<UiState>((set) => ({
  localPlayerId: createLocalPlayerId(),
  playerName: createInitialPlayerName(),
  selectedDeckId: createInitialSelectedDeckId(),
  maxCardsPerPlayer: createInitialMaxCardsPerPlayer(),
  selectedCardIds: [],
  lobbyCode: "",
  error: null,
  setPlayerName: (playerName) => {
    window.localStorage.setItem("cornerstone3.playerName", playerName);
    set({ playerName });
  },
  setSelectedDeckId: (selectedDeckId) => {
    window.localStorage.setItem("cornerstone3.selectedDeckId", selectedDeckId);
    set({ selectedDeckId });
  },
  setMaxCardsPerPlayer: (maxCardsPerPlayer) => {
    const nextMaxCardsPerPlayer = normalizeMaxCardsPerPlayer(maxCardsPerPlayer);
    window.localStorage.setItem("cornerstone3.startingCards", String(nextMaxCardsPerPlayer));
    set({ maxCardsPerPlayer: nextMaxCardsPerPlayer });
  },
  setLobbyCode: (lobbyCode) => set({ lobbyCode: lobbyCode.toUpperCase() }),
  toggleCard: (cardId) =>
    set((state) => ({
      selectedCardIds: state.selectedCardIds.includes(cardId)
        ? state.selectedCardIds.filter((id) => id !== cardId)
        : [...state.selectedCardIds, cardId]
    })),
  clearSelection: () => set({ selectedCardIds: [] }),
  setError: (error) => set({ error })
}));
