import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { useGameStore, GameState } from "../store";
import AssassinScreen from "./AssassinScreen";

// Mock the game store
vi.mock("../store", () => ({
  useGameStore: vi.fn(),
}));

// Mock internationalization
vi.mock("../utils/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("AssassinScreen", () => {
  const mockAssassinate = vi.fn();
  const mockEndGame = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const setupStoreMock = (overrides = {}) => {
    vi.mocked(useGameStore).mockImplementation((selector) =>
      selector({
        room: undefined,
        sessionId: "sid-1",
        assassinate: mockAssassinate,
        endGame: mockEndGame,
        ...overrides,
      } as unknown as GameState)
    );
  };

  const getMockRoom = (overrides: {
    players?: unknown[];
    gameState?: Record<string, unknown>;
  } = {}) => ({
    gameStartedAt: undefined,
    gameEndedAt: undefined,
    assassinationStartedAt: undefined,
    players: overrides.players ?? [
      { sessionId: "sid-1", name: "Alice", role: "Assassin", isHost: true, isBot: false },
      { sessionId: "sid-2", name: "Bot 1", role: "Morgana", isHost: false, isBot: true },
      { sessionId: "sid-3", name: "Bob", isHost: false, isBot: false },
      { sessionId: "sid-4", name: "Carol", isHost: false, isBot: false },
    ],
    gameState: {
      voteTrack: 0,
      currentQuestIndex: 2,
      quests: [],
      voteHistory: [],
      ...(overrides.gameState ?? {}),
    },
  });

  it("shows evil bot Merlin suspicion scores to the human assassin", () => {
    const room = getMockRoom({
      players: [
        { sessionId: "sid-1", name: "Alice", role: "Assassin", isHost: true, isBot: false },
        { sessionId: "sid-2", name: "Bot 1", role: "Morgana", isHost: false, isBot: true },
        { sessionId: "sid-3", name: "Bob", isHost: false, isBot: false },
        { sessionId: "sid-4", name: "Carol", isHost: false, isBot: false },
        { sessionId: "sid-5", name: "Dave", role: "Oberon", isHost: false, isBot: false },
      ],
      gameState: {
        botMerlinSuspicion: {
          "sid-2": {
            "sid-1": 0,
            "sid-2": 0,
            "sid-3": 72.5,
            "sid-4": 20,
            "sid-5": 100,
          },
        },
      },
    });
    setupStoreMock({ room });

    render(<AssassinScreen />);

    expect(screen.getByText("Bot Merlin Suspicion")).toBeTruthy();
    expect(screen.getByText("73")).toBeTruthy();
    expect(screen.getByText("20")).toBeTruthy();
    // Suspicion is shown for good players only — Bob appears in both the panel and the target list.
    expect(screen.getAllByText("Bob").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Carol").length).toBeGreaterThan(0);

    // Oberon is evil and must be excluded from the Merlin candidates.
    const targetButtons = screen
      .getAllByRole("button")
      .filter((button) => button.textContent?.includes("Bob") || button.textContent?.includes("Dave"));
    expect(targetButtons.some((button) => button.textContent?.includes("Bob"))).toBe(true);
    expect(targetButtons.some((button) => button.textContent?.includes("Dave"))).toBe(false);
  });

  it("does not show bot suspicion to a good player", () => {
    const room = getMockRoom({
      gameState: {
        botMerlinSuspicion: {
          "sid-2": { "sid-3": 80 },
        },
      },
    });
    setupStoreMock({ room, sessionId: "sid-3" });

    render(<AssassinScreen />);

    expect(screen.queryByText("Bot Merlin Suspicion")).toBeNull();
  });

  it("shows the panel to any evil player, including Oberon", () => {
    const room = getMockRoom({
      players: [
        { sessionId: "sid-1", name: "Alice", role: "Assassin", isHost: true, isBot: false },
        { sessionId: "sid-2", name: "Bot 1", role: "Morgana", isHost: false, isBot: true },
        { sessionId: "sid-3", name: "Bob", role: "Oberon", isHost: false, isBot: false },
        { sessionId: "sid-4", name: "Carol", isHost: false, isBot: false },
      ],
      gameState: {
        botMerlinSuspicion: {
          "sid-2": { "sid-4": 60 },
        },
      },
    });
    setupStoreMock({ room, sessionId: "sid-3" });

    render(<AssassinScreen />);

    expect(screen.getByText("Bot Merlin Suspicion")).toBeTruthy();
    expect(screen.getByText("60")).toBeTruthy();
  });

  it("does not show the panel when no evil bot has suspicion data", () => {
    const room = getMockRoom();
    setupStoreMock({ room });

    render(<AssassinScreen />);

    expect(screen.queryByText("Bot Merlin Suspicion")).toBeNull();
  });
});
