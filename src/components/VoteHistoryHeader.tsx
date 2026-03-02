import React, { useState } from 'react';
import { Eye, LogOut, AlertTriangle } from "lucide-react";
import { cn } from "../utils/cn";
import { useTranslation } from "../utils/i18n";
import { useGameStore } from "../store";

interface Props {
  title: React.ReactNode;
  viewingHistoryIndex: number | null;
  setViewingHistoryIndex: (index: number | null) => void;
  onViewRole?: () => void;
}

export default function VoteHistoryHeader({ title, viewingHistoryIndex, setViewingHistoryIndex, onViewRole }: Props) {
  const room = useGameStore((state) => state.room);
  const sessionId = useGameStore((state) => state.sessionId);
  const endGame = useGameStore((state) => state.endGame);
  const { t } = useTranslation();
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  if (!room) return null;
  const { gameState, players } = room;
  const isHost = players[0]?.sessionId === sessionId;

  return (
    <>
      <header className="p-6 pb-4 border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-xl sticky top-0 z-10">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-serif font-bold tracking-tight">
            {title}
          </h1>
          <div className="flex items-center gap-4">
            {onViewRole && (
              <button
                onClick={onViewRole}
                className="p-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-full text-zinc-400 transition-colors"
                title="View Role"
              >
                <Eye size={14} />
              </button>
            )}
            {isHost && (
              <button
                onClick={() => setShowEndConfirm(true)}
                className="p-1.5 bg-zinc-900 hover:bg-red-900/40 border border-zinc-800 hover:border-red-500/50 rounded-full text-zinc-400 hover:text-red-400 transition-colors"
                title={t("End Game")}
              >
                <LogOut size={14} />
              </button>
            )}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                {t("Vote Track")}
              </span>
              <div className="flex gap-1">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className={cn(
                      "w-2 h-2 rounded-full transition-colors",
                      i < gameState.voteTrack ? "bg-red-500" : "bg-zinc-800",
                    )}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-between gap-2">
          {gameState.quests.map((q, i) => {
            const historyForQuest = gameState.voteHistory.filter(h => h.questIndex === i);
            return (
              <div key={i} className="flex-1 flex flex-col gap-1">
                <div
                  className={cn(
                    "flex flex-col items-center justify-center py-3 rounded-xl border transition-all",
                    q.status === "success"
                      ? "bg-blue-950/30 border-blue-500/50 text-blue-400"
                      : q.status === "fail"
                        ? "bg-red-950/30 border-red-500/50 text-red-400"
                        : i === gameState.currentQuestIndex
                          ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20"
                          : "bg-zinc-900 border-zinc-800 text-zinc-500",
                  )}
                >
                  <span className="text-lg font-bold font-serif">{q.teamSize}</span>
                  {q.status === "fail" ? (
                    <span className="text-[10px] uppercase tracking-widest opacity-80 mt-1">
                      {Object.values(q.votes).filter((v) => !v).length} {t("Fails")}
                    </span>
                  ) : (
                    q.requiresTwoFails && (
                      <span className="text-[10px] uppercase tracking-widest opacity-80 mt-1">
                        2 {t("Fails")}
                      </span>
                    )
                  )}
                </div>
                {historyForQuest.length > 0 && (
                  <div className="flex gap-1 justify-center flex-wrap mt-1">
                    {historyForQuest.map((h, hIdx) => {
                      const globalIndex = gameState.voteHistory.indexOf(h);
                      return (
                        <button
                          key={hIdx}
                          onClick={() => setViewingHistoryIndex(viewingHistoryIndex === globalIndex ? null : globalIndex)}
                          className={cn(
                            "w-4 h-4 rounded-full border text-[8px] flex items-center justify-center transition-colors",
                            h.approved ? "bg-emerald-950/50 border-emerald-500/50 text-emerald-400" : "bg-red-950/50 border-red-500/50 text-red-400",
                            viewingHistoryIndex === globalIndex && "ring-2 ring-white"
                          )}
                        >
                          {hIdx + 1}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </header>

      {/* End Game Confirmation Modal */}
      {
        showEndConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
            <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-8 max-w-sm w-full">
              <div className="flex flex-col items-center gap-4">
                <div className="w-14 h-14 bg-red-950/50 border border-red-500/30 rounded-2xl flex items-center justify-center">
                  <AlertTriangle size={28} className="text-red-400" />
                </div>
                <div className="text-center">
                  <h2 className="text-xl font-serif font-bold mb-2">{t("End Game")}?</h2>
                  <p className="text-zinc-400 text-sm">This will end the game for all players.</p>
                </div>
                <div className="grid grid-cols-2 gap-3 w-full mt-2">
                  <button
                    onClick={() => setShowEndConfirm(false)}
                    className="py-3 rounded-xl font-medium bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800 transition-colors"
                  >
                    {t("Cancel")}
                  </button>
                  <button
                    onClick={() => { setShowEndConfirm(false); endGame(); }}
                    className="py-3 rounded-xl font-medium bg-red-600 hover:bg-red-500 text-white transition-colors"
                  >
                    {t("End Game")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }
    </>
  );
}
