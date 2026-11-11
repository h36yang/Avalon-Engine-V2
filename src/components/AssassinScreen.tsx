import { useState } from "react";
import { useGameStore } from "../store";
import { EVIL_ROLES } from "../utils/sharedTypes";
import { Skull, Target, ShieldAlert, Brain } from "lucide-react";
import { cn } from "../utils/cn";
import { useTranslation } from "../utils/i18n";
import VoteHistoryHeader from "./VoteHistoryHeader";
import VoteHistoryDetails from "./VoteHistoryDetails";
import GameTimer from "./GameTimer";

export default function AssassinScreen() {
  const room = useGameStore((state) => state.room);
  const sessionId = useGameStore((state) => state.sessionId);
  const assassinate = useGameStore((state) => state.assassinate);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [viewingHistoryIndex, setViewingHistoryIndex] = useState<number | null>(null);
  const { t } = useTranslation();

  if (!room) return null;

  const me = room.players.find((p) => p.sessionId === sessionId);
  const assassinPlayer = room.players.find((p) => p.role === "Assassin");
  const isEvil = me?.role ? EVIL_ROLES.has(me.role) : false;

  const canAssassinate = me?.role === "Assassin" || (isEvil && assassinPlayer?.isBot);

  const evilPlayers = room.players.filter((p) => p.role && EVIL_ROLES.has(p.role));
  const evilSessionIds = new Set(evilPlayers.map((p) => p.sessionId));
  const evilBots = evilPlayers.filter((p) => p.isBot);
  const botSuspicion = room.gameState.botMerlinSuspicion ?? {};
  const hasBotSuspicion = isEvil && Object.keys(botSuspicion).length > 0;

  const playerNumbers = Object.fromEntries(room.players.map((p, i) => [p.sessionId, i + 1])) as Record<string, number>;

  const handleAssassinate = () => {
    if (targetId && canAssassinate) {
      assassinate(targetId);
    }
  };

  const isViewingHistory = viewingHistoryIndex !== null;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col max-w-md mx-auto">
      <VoteHistoryHeader
        title={t("Assassin Phase")}
        viewingHistoryIndex={viewingHistoryIndex}
        setViewingHistoryIndex={setViewingHistoryIndex}
      />

      {/* Timer row — shows game time and live assassination countdown */}
      {room.gameStartedAt && (
        <div className="flex justify-end px-4 py-2 border-b border-zinc-900">
          <GameTimer
            gameStartedAt={room.gameStartedAt}
            assassinationStartedAt={room.assassinationStartedAt}
          />
        </div>
      )}

      {isViewingHistory ? (
        <VoteHistoryDetails
          viewingHistoryIndex={viewingHistoryIndex}
          onBack={() => setViewingHistoryIndex(null)}
          backText={t("Back to Assassination")}
        />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center space-y-8 text-center p-6">
          <div className="space-y-4">
            <div className="w-24 h-24 bg-red-950/30 border border-red-500/50 rounded-full flex items-center justify-center mx-auto">
              <Skull size={48} className="text-red-500" />
            </div>
            <h1 className="text-3xl font-serif font-bold tracking-tight text-red-400">
              {t("Assassin")}
            </h1>
            <p className="text-zinc-400 text-sm max-w-xs mx-auto">
              {t("Good completed 3 quests")}
            </p>
          </div>

          {/* Revealed Evil Players Panel */}
          <div className="w-full bg-red-950/10 border border-red-900/30 rounded-2xl p-4 text-left max-w-sm mx-auto">
            <p className="text-[11px] font-semibold text-red-400 uppercase tracking-widest mb-3 flex items-center gap-1.5 justify-center">
              <ShieldAlert size={12} className="text-red-500 animate-pulse" /> {t("Revealed Evil Roles")}
            </p>
            <div className="space-y-2">
              {room.players
                .filter((p) => p.role && EVIL_ROLES.has(p.role))
                .map((p) => (
                  <div key={p.sessionId} className="flex items-center justify-between bg-zinc-900/60 border border-zinc-800/80 px-3.5 py-2.5 rounded-xl">
                    <span className="font-semibold text-sm text-zinc-200">{p.name}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-red-400 bg-red-950/50 border border-red-900/40 px-2.5 py-1 rounded-full">
                      {t(p.role as string)}
                    </span>
                  </div>
                ))}
            </div>
          </div>

          {/* Evil bot Merlin suspicion — shown to all evil players during the assassin phase */}
          {hasBotSuspicion && (
            <div className="w-full bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 text-left max-w-sm mx-auto">
              <p className="text-[11px] font-semibold text-orange-400 uppercase tracking-widest mb-1 flex items-center gap-1.5 justify-center">
                <Brain size={12} className="text-orange-400" /> {t("Bot Merlin Suspicion")}
              </p>
              <p className="text-[10px] text-zinc-500 text-center mb-3">
                {t("Higher scores mean the bot suspects that player is Merlin")}
              </p>
              <div className="space-y-4">
                {evilBots.map((bot) => {
                  const scores = botSuspicion[bot.sessionId];
                  if (!scores) return null;

                  const entries = Object.entries(scores)
                    .filter(([sid]) => !evilSessionIds.has(sid))
                    .sort(([, a], [, b]) => b - a);
                  if (entries.length === 0) return null;

                  return (
                    <div key={bot.sessionId}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-zinc-200">{bot.name}</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-red-400 bg-red-950/50 border border-red-900/40 px-2 py-0.5 rounded-full">
                          {t(bot.role as string)}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {entries.map(([sid, score]) => {
                          const player = room.players.find((p) => p.sessionId === sid);
                          if (!player) return null;
                          return (
                            <div key={sid} className="flex items-center gap-2">
                              <span className="text-xs text-zinc-400 truncate w-24 shrink-0">{player.name}</span>
                              <div className="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                                <div
                                  className={cn(
                                    "h-full rounded-full",
                                    score >= 60 ? "bg-red-500" : score >= 35 ? "bg-orange-500" : "bg-zinc-600",
                                  )}
                                  style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-zinc-500 tabular-nums w-6 text-right shrink-0">
                                {Math.round(score)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {canAssassinate ? (
            <div className="w-full space-y-4">
              {me?.role !== "Assassin" && (
                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 p-3 rounded-lg text-sm mb-4">
                  {t("Bot assassin hint")}
                </div>
              )}
              <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">
                {t("Select Merlin")}
              </h3>
              <div className="space-y-2">
                {room.players
                  .filter((p) => !evilSessionIds.has(p.sessionId))
                  .map((p) => (
                    <button
                      key={p.sessionId}
                      onClick={() => setTargetId(p.sessionId)}
                      className={cn(
                        "w-full flex items-center justify-between p-4 rounded-xl border transition-all text-left",
                        targetId === p.sessionId
                          ? "bg-red-950/30 border-red-500/50 text-red-100"
                          : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700",
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center border",
                            targetId === p.sessionId
                              ? "bg-red-600 border-red-500 text-white"
                              : "bg-zinc-800 border-zinc-700 text-zinc-500",
                          )}
                        >
                          {targetId === p.sessionId ? (
                            <Target size={16} />
                          ) : (
                            <span className="text-xs">{playerNumbers[p.sessionId]}</span>
                          )}
                        </div>
                        <span className="font-medium">{p.name}</span>
                      </div>
                    </button>
                  ))}
              </div>
              <button
                onClick={handleAssassinate}
                disabled={!targetId}
                className={cn(
                  "w-full py-4 rounded-xl font-medium transition-colors mt-8",
                  targetId
                    ? "bg-red-600 hover:bg-red-500 text-white"
                    : "bg-zinc-800 text-zinc-500 cursor-not-allowed",
                )}
              >
                {t("Confirm Assassination")}
              </button>
            </div>
          ) : (
            <div className="w-full p-6 bg-zinc-900 border border-zinc-800 rounded-2xl">
              <p className="text-zinc-300 font-medium">
                {t("Waiting for Assassin...")}
              </p>
              <p className="text-zinc-500 text-sm mt-2">
                {t("If Merlin is killed")}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
