import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useGameStore, GameState } from '../store';
import StartingCountdownScreen from './StartingCountdownScreen';

// Mock the game store
vi.mock('../store', () => ({
  useGameStore: vi.fn(),
}));

// Mock internationalization
vi.mock('../utils/i18n', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('StartingCountdownScreen', () => {
  const mockChooseEvilRole = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1000000);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  const setupStoreMock = (overrides = {}) => {
    vi.mocked(useGameStore).mockImplementation((selector) =>
      selector({
        room: null,
        sessionId: 'user_1',
        chooseEvilRole: mockChooseEvilRole,
        ...overrides,
      } as unknown as GameState)
    );
  };

  it('renders nothing when room is null', () => {
    setupStoreMock({ room: null });
    const { container } = render(<StartingCountdownScreen />);
    expect(container.firstChild).toBeNull();
  });

  it('renders standard countdown view for non-chooser players', () => {
    setupStoreMock({
      sessionId: 'user_good',
      room: {
        id: 'test_room',
        status: 'starting_countdown',
        startingCountdownRemainingMs: 10000,
        evilChooserSessionId: undefined, // Not a lone evil game or sanitized out
        players: [
          { sessionId: 'user_good', name: 'Merlin Player', isConnected: true, isHost: true, isBot: false, role: 'Merlin' },
        ],
      },
    });

    render(<StartingCountdownScreen />);

    expect(screen.getByText('The game is starting in')).toBeTruthy();
    expect(screen.getByText('Preparing the battlefield...')).toBeTruthy();
    expect(screen.getByText('10')).toBeTruthy();
    expect(screen.queryByText('Lone Evil Operative')).toBeNull();
  });

  it('renders standard countdown when evilChooserSessionId belongs to another player', () => {
    setupStoreMock({
      sessionId: 'user_good',
      room: {
        id: 'test_room',
        status: 'starting_countdown',
        startingCountdownRemainingMs: 8000,
        evilChooserSessionId: 'other_user',
        players: [
          { sessionId: 'user_good', name: 'Percival Player', isConnected: true, isHost: false, isBot: false, role: 'Percival' },
        ],
      },
    });

    render(<StartingCountdownScreen />);

    expect(screen.getByText('The game is starting in')).toBeTruthy();
    expect(screen.getByText('8')).toBeTruthy();
    expect(screen.queryByText('Lone Evil Operative')).toBeNull();
  });

  it('renders role selection view for the lone evil human chooser', () => {
    setupStoreMock({
      sessionId: 'user_evil',
      room: {
        id: 'test_room',
        status: 'starting_countdown',
        startingCountdownRemainingMs: 10000,
        evilChooserSessionId: 'user_evil',
        availableEvilRoles: ['Morgana', 'Assassin'],
        players: [
          { sessionId: 'user_evil', name: 'Evil Player', isConnected: true, isHost: false, isBot: false, role: 'Morgana' },
        ],
      },
    });

    render(<StartingCountdownScreen />);

    expect(screen.getByText('Lone Evil Operative')).toBeTruthy();
    expect(screen.getByText('All other evil players are bots. You can choose a different evil role:')).toBeTruthy();
    expect(screen.getByText('Morgana')).toBeTruthy();
    expect(screen.getByText('Assassin')).toBeTruthy();
    expect(screen.getByText('Current Role')).toBeTruthy();
    expect(screen.getByText('Switch Role')).toBeTruthy();
  });

  it('calls chooseEvilRole when clicking an alternative evil role or clicking current role', () => {
    setupStoreMock({
      sessionId: 'user_evil',
      room: {
        id: 'test_room',
        status: 'starting_countdown',
        startingCountdownRemainingMs: 10000,
        evilChooserSessionId: 'user_evil',
        availableEvilRoles: ['Morgana', 'Assassin'],
        players: [
          { sessionId: 'user_evil', name: 'Evil Player', isConnected: true, isHost: false, isBot: false, role: 'Morgana' },
        ],
      },
    });

    render(<StartingCountdownScreen />);

    // Click on Assassin to swap
    const assassinButton = screen.getByText('Assassin').closest('button');
    expect(assassinButton).toBeTruthy();
    fireEvent.click(assassinButton!);
    expect(mockChooseEvilRole).toHaveBeenCalledWith('Assassin');

    // Click on Morgana to stay with / re-select Morgana
    const morganaButton = screen.getByText('Morgana').closest('button');
    expect(morganaButton).toBeTruthy();
    fireEvent.click(morganaButton!);
    expect(mockChooseEvilRole).toHaveBeenCalledWith('Morgana');
  });
});
