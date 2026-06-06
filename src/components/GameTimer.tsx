import { useState, useEffect } from "react";
import { Timer, Skull } from "lucide-react";

interface Props {
  gameStartedAt: number;
  gameEndedAt?: number;
  assassinationStartedAt?: number;
}

export function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function GameTimer({ gameStartedAt, gameEndedAt, assassinationStartedAt }: Props) {
  // Game time: from game start until assassination begins (or game ends if no assassination)
  const gamePhaseEnd = assassinationStartedAt ?? gameEndedAt;
  const [gameElapsed, setGameElapsed] = useState(() =>
    (gamePhaseEnd ?? Date.now()) - gameStartedAt
  );

  // Assassination time: from assassination start until game ends
  const [assassinElapsed, setAssassinElapsed] = useState(() => {
    if (!assassinationStartedAt) return 0;
    return (gameEndedAt ?? Date.now()) - assassinationStartedAt;
  });

  // Tick game phase timer (only while no assassination stage and game is ongoing)
  useEffect(() => {
    if (gamePhaseEnd) {
      setGameElapsed(gamePhaseEnd - gameStartedAt);
      return;
    }
    const interval = setInterval(() => {
      setGameElapsed(Date.now() - gameStartedAt);
    }, 1000);
    return () => clearInterval(interval);
  }, [gameStartedAt, gamePhaseEnd]);

  // Tick assassination phase timer
  useEffect(() => {
    if (!assassinationStartedAt) return;
    if (gameEndedAt) {
      setAssassinElapsed(gameEndedAt - assassinationStartedAt);
      return;
    }
    const interval = setInterval(() => {
      setAssassinElapsed(Date.now() - assassinationStartedAt);
    }, 1000);
    return () => clearInterval(interval);
  }, [assassinationStartedAt, gameEndedAt]);

  return (
    <div className="flex items-center gap-2">
      {/* Game phase time */}
      <div className="flex items-center gap-1 px-2 py-1 bg-zinc-900 border border-zinc-800 rounded-full">
        <Timer size={10} className="text-zinc-500" />
        <span className="text-[11px] font-mono font-semibold text-zinc-400 tabular-nums">
          {formatElapsed(gameElapsed)}
        </span>
      </div>

      {/* Assassination phase time — shown only once assassination stage begins */}
      {!!assassinationStartedAt && (
        <div className="flex items-center gap-1 px-2 py-1 bg-red-950/40 border border-red-800/50 rounded-full">
          <Skull size={10} className="text-red-500" />
          <span className="text-[11px] font-mono font-semibold text-red-400 tabular-nums">
            {formatElapsed(assassinElapsed)}
          </span>
        </div>
      )}
    </div>
  );
}
