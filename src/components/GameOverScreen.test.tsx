import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useGameStore } from "../store";
import GameOverScreen from "./GameOverScreen";

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

describe("GameOverScreen", () => {
  const mockRestartGame = vi.fn();
  const mockCloseHistoryView = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-20T19:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  const setupStoreMock = (overrides = {}) => {
    vi.mocked(useGameStore).mockImplementation((selector) =>
      selector({
        room: null,
        sessionId: "sid-1",
        restartGame: mockRestartGame,
        viewingHistoryRecord: null,
        closeHistoryView: mockCloseHistoryView,
        ...overrides,
      } as any)
    );
  };

  const getMockRoom = (overrides = {}) => ({
    gameStartedAt: 1700000000000,
    gameEndedAt: 1700000600000,
    assassinationStartedAt: undefined,
    players: [
      { sessionId: "sid-1", name: "Alice", role: "Merlin", isHost: true },
      { sessionId: "sid-2", name: "Bob", role: "Minion", isHost: false },
    ],
    gameState: {
      winner: "good",
      assassinationTarget: null,
      quests: [
        { teamSize: 2, status: "success", votes: { "sid-1": true, "sid-2": true }, requiresTwoFails: false },
      ],
      voteHistory: [],
      botMemories: {},
      botMindLogs: {},
    },
    ...overrides,
  });

  it("should render null when no room is in store", () => {
    setupStoreMock({ room: null });
    const { container } = render(<GameOverScreen />);
    expect(container.firstChild).toBeNull();
  });

  it("should render good victory status and player list correctly", () => {
    const room = getMockRoom({
      gameState: {
        winner: "good",
        assassinationTarget: null,
        quests: [{ teamSize: 2, status: "success", votes: { "sid-1": true, "sid-2": true }, requiresTwoFails: false }],
        voteHistory: [],
        botMemories: {},
        botMindLogs: {},
      },
    });
    setupStoreMock({ room, sessionId: "sid-1" });

    render(<GameOverScreen />);

    expect(screen.getByText("Good Wins!")).toBeTruthy();
    expect(screen.getByText("Merlin survived!")).toBeTruthy();
    expect(screen.getByText("Alice")).toBeTruthy();
    expect(screen.getByText("Bob")).toBeTruthy();
  });

  it("should render evil victory status and Merlin assassination info correctly", () => {
    const room = getMockRoom({
      gameState: {
        winner: "evil",
        assassinationTarget: "sid-1",
        quests: [{ teamSize: 2, status: "fail", votes: { "sid-1": true, "sid-2": false }, requiresTwoFails: false }],
        voteHistory: [],
        botMemories: {},
        botMindLogs: {},
      },
    });
    setupStoreMock({ room, sessionId: "sid-1" });

    render(<GameOverScreen />);

    expect(screen.getByText("Evil Wins!")).toBeTruthy();
    expect(screen.getByText("Merlin was assassinated!")).toBeTruthy();
    expect(screen.getByText("Assassinated")).toBeTruthy();
  });

  it("should call restartGame when Play Again is clicked by host", () => {
    const room = getMockRoom();
    setupStoreMock({ room, sessionId: "sid-1" }); // sid-1 is host in getMockRoom

    render(<GameOverScreen />);

    const button = screen.getByText("Play Again");
    fireEvent.click(button);

    expect(mockRestartGame).toHaveBeenCalledTimes(1);
  });

  it("should display waiting message when viewer is not host", () => {
    const room = getMockRoom();
    setupStoreMock({ room, sessionId: "sid-2" }); // sid-2 is not host

    render(<GameOverScreen />);

    expect(screen.getByText("Waiting for host to continue...")).toBeTruthy();
    expect(screen.queryByText("Play Again")).toBeNull();
  });

  it("should allow expanding quest timeline details", () => {
    const room = getMockRoom({
      gameState: {
        winner: "good",
        quests: [
          { teamSize: 2, status: "success", votes: { "sid-1": true, "sid-2": true }, requiresTwoFails: false },
        ],
        voteHistory: [
          {
            questIndex: 0,
            leaderIndex: 0,
            approved: true,
            proposedTeam: ["sid-1", "sid-2"],
            votes: { "sid-1": true, "sid-2": true },
          },
        ],
        botMemories: {},
        botMindLogs: {},
      },
    });
    setupStoreMock({ room });

    render(<GameOverScreen />);

    // Initially quest details/team details are not shown (they are inside isExpanded block)
    expect(screen.queryByText("Quest Votes")).toBeNull();

    // Click the Quest header to expand
    const questHeader = screen.getByText("Quest 1");
    fireEvent.click(questHeader);

    expect(screen.getByText("Quest Votes")).toBeTruthy();
    expect(screen.getByText("Team Votes")).toBeTruthy();
  });

  it("should render bot memories and allow expanding them", () => {
    const room = getMockRoom({
      players: [
        { sessionId: "sid-1", name: "Alice", role: "Merlin", isHost: true },
        { sessionId: "sid-2", name: "Bot 1", role: "Minion", isHost: false, isBot: true },
      ],
      gameState: {
        winner: "good",
        quests: [],
        voteHistory: [],
        botMemories: {
          "sid-2": {
            trustScores: { "sid-1": 80 },
            knownRoles: { "sid-1": "Good" },
            merlinSuspicion: { "sid-1": 15 },
          },
        },
        botMindLogs: {},
      },
    });
    setupStoreMock({ room });

    render(<GameOverScreen />);

    expect(screen.getByText("Bot Memories")).toBeTruthy();
    expect(screen.getAllByText("Bot 1").length).toBeGreaterThan(0);
    expect(screen.queryByText("Trust")).toBeNull();

    // Click Bot memory header to expand
    const botButton = screen.getAllByRole("button").find(btn => btn.textContent?.includes("Bot 1"));
    expect(botButton).toBeTruthy();
    fireEvent.click(botButton!);

    expect(screen.getByText("Trust")).toBeTruthy();
    expect(screen.getByText("Known Alignments")).toBeTruthy();
    expect(screen.getByText("Merlin Suspicion")).toBeTruthy();
  });

  it("should render bot mind logs and allow expanding them", () => {
    const room = getMockRoom({
      players: [
        { sessionId: "sid-1", name: "Alice", role: "Merlin", isHost: true },
        { sessionId: "sid-2", name: "Bot 1", role: "Minion", isHost: false, isBot: true },
      ],
      gameState: {
        winner: "good",
        quests: [],
        voteHistory: [],
        botMemories: {},
        botMindLogs: {
          "sid-2": [
            { phase: "Propose Team", prompt: "Prompt here", response: "Log response here", timestamp: 1700000100000 },
          ],
        },
      },
    });
    setupStoreMock({ room });

    render(<GameOverScreen />);

    expect(screen.getByText("AI Mind Log")).toBeTruthy();
    expect(screen.queryByText("Log response here")).toBeNull();

    const botButton = screen.getAllByRole("button").find(btn => btn.textContent?.includes("Bot 1"));
    expect(botButton).toBeTruthy();
    fireEvent.click(botButton!);

    expect(screen.getByText("Log response here")).toBeTruthy();
    expect(screen.getByText("Copy Log")).toBeTruthy();
  });

  it("should display history replay layout and call closeHistoryView on close click", () => {
    const room = getMockRoom();
    const mockHistoryRecord = {
      room_snapshot: {
        ...room,
        viewerSessionId: "sid-1",
      },
    };
    setupStoreMock({
      room: null,
      viewingHistoryRecord: mockHistoryRecord,
    });

    render(<GameOverScreen />);

    expect(screen.getByText("Back to History")).toBeTruthy();
    const backButton = screen.getByText("Back to History");
    fireEvent.click(backButton);

    expect(mockCloseHistoryView).toHaveBeenCalledTimes(1);
  });
});
