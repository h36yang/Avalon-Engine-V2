import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useGameStore } from '../store';
import GameHistoryScreen from './GameHistoryScreen';

// Mock the game store
vi.mock('../store', () => ({
  useGameStore: vi.fn(),
  EVIL_ROLES: {
    has: vi.fn(),
  },
}));

// Mock internationalization
vi.mock('../utils/i18n', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('GameHistoryScreen', () => {
  const mockFetchGameHistory = vi.fn();
  const mockViewHistoryRecord = vi.fn();

  beforeEach(() => {
    // Set a fixed system time to make relative time calculations deterministic
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  const setupStoreMock = (overrides = {}) => {
    vi.mocked(useGameStore).mockImplementation((selector: any) =>
      selector({
        gameHistory: [],
        gameHistoryLoading: false,
        fetchGameHistory: mockFetchGameHistory,
        viewHistoryRecord: mockViewHistoryRecord,
        ...overrides,
      })
    );
  };

  it('should call fetchGameHistory on mount', () => {
    setupStoreMock();
    render(<GameHistoryScreen />);
    expect(mockFetchGameHistory).toHaveBeenCalledTimes(1);
  });

  it('should render the loading spinner when history is being fetched', () => {
    setupStoreMock({ gameHistoryLoading: true });
    const { container } = render(<GameHistoryScreen />);
    
    // Look for the spinner icon by its expected class
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeTruthy();
  });

  it('should render an empty state message when no history records exist', () => {
    setupStoreMock({ gameHistory: [] });
    render(<GameHistoryScreen />);
    
    expect(screen.getByText('No games yet')).toBeTruthy();
    expect(screen.getByText('Play some games to see your history here')).toBeTruthy();
  });

  it('should render a list of history records with correct metadata', () => {
    const mockHistory = [
      {
        id: '1',
        my_role: 'Merlin',
        did_win: true,
        player_count: 5,
        duration_ms: 300000, // 5 minutes
        played_at: '2024-01-01T11:55:00Z', // 5 minutes ago relative to mock system time
      },
      {
        id: '2',
        my_role: 'Assassin',
        did_win: false,
        player_count: 7,
        duration_ms: 600000, // 10 minutes
        played_at: '2024-01-01T11:00:00Z', // 1 hour ago
      },
    ];

    setupStoreMock({ gameHistory: mockHistory });
    render(<GameHistoryScreen />);

    // Verify details for the first record (Win)
    expect(screen.getByText('Merlin')).toBeTruthy();
    expect(screen.getByText('5 players')).toBeTruthy();
    expect(screen.getAllByText('Win')).toBeTruthy();
    expect(screen.getByText('5m ago')).toBeTruthy();

    // Verify details for the second record (Loss)
    expect(screen.getByText('Assassin')).toBeTruthy();
    expect(screen.getByText('7 players')).toBeTruthy();
    expect(screen.getAllByText('Loss')).toBeTruthy();
    expect(screen.getByText('1h ago')).toBeTruthy();
  });

  it('should call viewHistoryRecord when a specific game row is clicked', () => {
    const mockRecord = { id: '1', my_role: 'Merlin', did_win: true, player_count: 5, played_at: '2024-01-01T11:55:00Z' };
    setupStoreMock({ gameHistory: [mockRecord] });
    render(<GameHistoryScreen />);

    const historyItem = screen.getByRole('button');
    fireEvent.click(historyItem);

    expect(mockViewHistoryRecord).toHaveBeenCalledWith(mockRecord);
  });
});
