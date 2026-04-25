import { useState, useEffect } from "react";
import { Timer } from "lucide-react";

interface Props {
  gameStartedAt: number;
  gameEndedAt?: number;
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function GameTimer({ gameStartedAt, gameEndedAt }: Props) {
  const [elapsed, setElapsed] = useState(() =>
    (gameEndedAt ?? Date.now()) - gameStartedAt
  );

  useEffect(() => {
    if (gameEndedAt) return;
    const interval = setInterval(() => {
      setElapsed(Date.now() - gameStartedAt);
    }, 1000);
    return () => clearInterval(interval);
  }, [gameStartedAt, gameEndedAt]);

  // Freeze at final time when game ends
  useEffect(() => {
    if (gameEndedAt) {
      setElapsed(gameEndedAt - gameStartedAt);
    }
  }, [gameEndedAt, gameStartedAt]);

  return (
    <div className="flex items-center gap-1 px-2 py-1 bg-zinc-900 border border-zinc-800 rounded-full">
      <Timer size={10} className="text-zinc-500" />
      <span className="text-[11px] font-mono font-semibold text-zinc-400 tabular-nums">
        {formatElapsed(elapsed)}
      </span>
    </div>
  );
}
