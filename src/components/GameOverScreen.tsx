import { useGameStore } from "../store";
import { Crown, Skull, Shield, RefreshCw } from "lucide-react";
import { cn } from "../utils/cn";
import { useTranslation } from "../utils/i18n";

export default function GameOverScreen() {
  const room = useGameStore((state) => state.room);
  const sessionId = useGameStore((state) => state.sessionId);
  const restartGame = useGameStore((state) => state.restartGame);
  const { t } = useTranslation();

  if (!room) return null;

  const { gameState, players } = room;
  const isEvilWin = gameState.winner === "evil";
  const isHost = players[0]?.sessionId === sessionId;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col max-w-md mx-auto p-6">
      <div className="flex-1 flex flex-col items-center justify-center space-y-8 text-center">
        <div className="space-y-4">
          <div
            className={cn(
              "w-24 h-24 rounded-full flex items-center justify-center mx-auto border-2",
              isEvilWin
                ? "bg-red-950/30 border-red-500/50"
                : "bg-blue-950/30 border-blue-500/50",
            )}
          >
            {isEvilWin ? (
              <Skull size={48} className="text-red-500" />
            ) : (
              <Shield size={48} className="text-blue-500" />
            )}
          </div>
          <h1
            className={cn(
              "text-4xl font-serif font-bold tracking-tight",
              isEvilWin ? "text-red-400" : "text-blue-400",
            )}
          >
            {isEvilWin ? t("Evil Wins!") : t("Good Wins!")}
          </h1>
          <p className="text-zinc-400 text-sm max-w-xs mx-auto">
            {isEvilWin
              ? gameState.assassinationTarget
                ? t("Merlin was assassinated!")
                : "Evil successfully sabotaged 3 quests or 5 teams were rejected."
              : t("Merlin survived!")}
          </p>
        </div>

        <div className="w-full space-y-6">
          <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">
            {t("Roles in play")}
          </h3>
          <div className="space-y-2">
            {players.map((p) => {
              const isEvil = [
                "Assassin",
                "Morgana",
                "Mordred",
                "Minion",
                "Oberon",
              ].includes(p.role as string);
              const isTarget = gameState.assassinationTarget === p.sessionId;

              return (
                <div
                  key={p.sessionId}
                  className={cn(
                    "w-full flex items-center justify-between p-4 rounded-xl border text-left",
                    isEvil
                      ? "bg-red-950/10 border-red-900/30"
                      : "bg-blue-950/10 border-blue-900/30",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center border",
                        isEvil
                          ? "bg-red-900/20 border-red-800 text-red-500"
                          : "bg-blue-900/20 border-blue-800 text-blue-500",
                      )}
                    >
                      <span className="text-xs font-bold">
                        {p.name.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <span
                        className={cn(
                          "font-medium block",
                          p.sessionId === sessionId && "text-white",
                        )}
                      >
                        {p.name} {p.sessionId === sessionId && "(You)"}
                      </span>
                      <span
                        className={cn(
                          "text-xs uppercase tracking-wider font-medium",
                          isEvil ? "text-red-400" : "text-blue-400",
                        )}
                      >
                        {t(p.role as string)}
                      </span>
                    </div>
                  </div>

                  {isTarget && (
                    <div className="flex items-center gap-1 text-red-500 text-xs font-medium bg-red-950/50 px-2 py-1 rounded-md border border-red-900/50">
                      <Skull size={12} /> Assassinated
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {isHost ? (
          <button
            onClick={restartGame}
            className="w-full py-4 rounded-xl font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors flex items-center justify-center gap-2 mt-8"
          >
            <RefreshCw size={20} /> {t("Play Again")}
          </button>
        ) : (
          <p className="text-zinc-500 text-sm mt-8 text-center">
            {t("Waiting for host to continue...")}
          </p>
        )}
      </div>
    </div>
  );
}
