import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';
import GameTimer, { formatElapsed } from './GameTimer';

// ---------------------------------------------------------------------------
// formatElapsed unit tests (pure function — no DOM needed)
// ---------------------------------------------------------------------------
describe('formatElapsed', () => {
  it('formats zero milliseconds as 00:00', () => {
    expect(formatElapsed(0)).toBe('00:00');
  });

  it('formats sub-minute durations correctly', () => {
    expect(formatElapsed(30_000)).toBe('00:30');
    expect(formatElapsed(59_000)).toBe('00:59');
  });

  it('formats exactly one minute', () => {
    expect(formatElapsed(60_000)).toBe('01:00');
  });

  it('formats multi-minute durations without hours', () => {
    expect(formatElapsed(5 * 60_000 + 7_000)).toBe('05:07');
    expect(formatElapsed(59 * 60_000 + 59_000)).toBe('59:59');
  });

  it('includes hours column when duration >= 1 hour', () => {
    expect(formatElapsed(3_600_000)).toBe('1:00:00');
    expect(formatElapsed(3_600_000 + 2 * 60_000 + 5_000)).toBe('1:02:05');
  });

  it('zero-pads minutes and seconds in hour format', () => {
    expect(formatElapsed(2 * 3_600_000 + 3_000)).toBe('2:00:03');
  });

  it('truncates to whole seconds (does not round up)', () => {
    // 1999 ms → 1 second
    expect(formatElapsed(1_999)).toBe('00:01');
  });
});

// ---------------------------------------------------------------------------
// GameTimer component tests (uses fake timers)
// ---------------------------------------------------------------------------
describe('GameTimer component', () => {
  const BASE = 1_000_000; // arbitrary epoch-ms anchor

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Helper: set Date.now() to a fixed value, render, then return helpers
  const setup = (props: React.ComponentProps<typeof GameTimer>) =>
    render(<GameTimer {...props} />);

  // --- game-phase timer (no assassination) ---

  it('renders the game elapsed time on mount', () => {
    vi.setSystemTime(BASE + 90_000); // 90 s after game start
    setup({ gameStartedAt: BASE });
    expect(screen.getByText('01:30')).toBeTruthy();
  });

  it('live-ticks the game timer every second', () => {
    vi.setSystemTime(BASE);
    setup({ gameStartedAt: BASE });
    expect(screen.getByText('00:00')).toBeTruthy();

    act(() => { vi.advanceTimersByTime(5_000); });
    expect(screen.getByText('00:05')).toBeTruthy();

    act(() => { vi.advanceTimersByTime(55_000); });
    expect(screen.getByText('01:00')).toBeTruthy();
  });

  it('freezes the game timer when gameEndedAt is provided', () => {
    vi.setSystemTime(BASE + 120_000);
    setup({ gameStartedAt: BASE, gameEndedAt: BASE + 120_000 });
    expect(screen.getByText('02:00')).toBeTruthy();

    // Time passes but display should not change
    act(() => { vi.advanceTimersByTime(30_000); });
    expect(screen.getByText('02:00')).toBeTruthy();
  });

  // --- assassination timer ---

  it('does not render the assassination badge without assassinationStartedAt', () => {
    vi.setSystemTime(BASE + 60_000);
    setup({ gameStartedAt: BASE });
    // Only one time badge visible
    const badges = screen.queryAllByText(/^\d{2}:\d{2}$/);
    expect(badges).toHaveLength(1);
  });

  it('renders a second (assassination) badge when assassinationStartedAt is given', () => {
    vi.setSystemTime(BASE + 70_000); // 10 s into assassination
    setup({
      gameStartedAt: BASE,
      assassinationStartedAt: BASE + 60_000,
    });
    // Game timer should show 01:00 (frozen at assassination start)
    expect(screen.getByText('01:00')).toBeTruthy();
    // Assassination timer should show 00:10
    expect(screen.getByText('00:10')).toBeTruthy();
  });

  it('live-ticks the assassination timer while game is ongoing', () => {
    vi.setSystemTime(BASE + 60_000);
    setup({
      gameStartedAt: BASE,
      assassinationStartedAt: BASE + 60_000,
    });
    // Initially 00:00 for assassination
    expect(screen.getByText('00:00')).toBeTruthy();

    act(() => { vi.advanceTimersByTime(15_000); });
    expect(screen.getByText('00:15')).toBeTruthy();
  });

  it('freezes both timers when gameEndedAt is provided alongside assassination', () => {
    vi.setSystemTime(BASE + 200_000);
    setup({
      gameStartedAt: BASE,
      assassinationStartedAt: BASE + 60_000,
      gameEndedAt: BASE + 90_000,
    });
    // Game phase: 60 s, assassination phase: 30 s
    expect(screen.getByText('01:00')).toBeTruthy();
    expect(screen.getByText('00:30')).toBeTruthy();

    // No further ticking
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(screen.getByText('01:00')).toBeTruthy();
    expect(screen.getByText('00:30')).toBeTruthy();
  });

  it('shows 00:00 assassination timer when assassination just started', () => {
    const now = BASE + 60_000;
    vi.setSystemTime(now);
    setup({
      gameStartedAt: BASE,
      assassinationStartedAt: now,
    });
    // Two badges: game=01:00, assassination=00:00
    const allBadges = screen.getAllByText('01:00');
    expect(allBadges).toHaveLength(1);
    expect(screen.getByText('00:00')).toBeTruthy();
  });
});
