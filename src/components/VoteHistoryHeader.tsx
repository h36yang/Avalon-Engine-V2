import React, { useState } from 'react';
import { Eye, LogOut, AlertTriangle, X } from "lucide-react";
import { cn } from "../utils/cn";
import { useTranslation } from "../utils/i18n";
import { useGameStore } from "../store";
import GameTimer from "./GameTimer";

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
  const isHost = players.find(p => p.isHost)?.sessionId === sessionId;

  return (
    <>
      <header className="sticky top-0 z-10 bg-zinc-950/95 backdrop-blur-xl border-b border-zinc-900">
        {/* Top bar */}
        <div className="flex items-center justify-between px-5 pt-12 pb-3">
          <h1 className="text-lg font-bold tracking-tight text-zinc-100">{title}</h1>
          <div className="flex items-center gap-2">
            {room.gameStartedAt && <GameTimer gameStartedAt={room.gameStartedAt} gameEndedAt={room.gameEndedAt} />}
            {onViewRole && (
              <button
                onClick={onViewRole}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-full text-zinc-500 hover:text-zinc-300 transition-colors text-xs font-semibold"
              >
                <Eye size={12} /> Role
              </button>
            )}
            {isHost && (
              <button
                onClick={() => setShowEndConfirm(true)}
                className="p-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-full text-zinc-500 hover:text-zinc-400 transition-colors"
                title={t("End Game")}
              >
                <LogOut size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Quest Tracker */}
        <div className="px-5 pb-4">
          {/* Vote Track */}
          <div className="flex items-center gap-2 mb-3">
            <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest shrink-0">
              {t("Vote Track")}
            </p>
            <div className="flex gap-1.5">
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className={cn(
                    "w-2 h-2 rounded-full transition-all",
                    i < gameState.voteTrack ? "bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.5)]" : "bg-zinc-800"
                  )}
                />
              ))}
            </div>
          </div>

          {/* Quest Circles */}
          <div className="flex gap-2">
            {gameState.quests.map((q, i) => {
              const historyForQuest = gameState.voteHistory.filter(h => h.questIndex === i);
              const isActive = i === gameState.currentQuestIndex;
              const isSuccess = q.status === "success";
              const isFail = q.status === "fail";

              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                  <div
                    className={cn(
                      "w-full flex flex-col items-center justify-center py-2.5 rounded-xl border transition-all relative overflow-hidden",
                      isSuccess
                        ? "bg-blue-950/20 border-blue-700/50"
                        : isFail
                          ? "bg-red-950/20 border-red-700/50"
                          : isActive
                            ? "bg-indigo-600 border-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.3)]"
                            : "bg-zinc-900 border-zinc-800"
                    )}
                  >
                    <span className={cn(
                      "text-base font-bold font-mono",
                      isSuccess ? "text-blue-400" : isFail ? "text-red-400" : isActive ? "text-white" : "text-zinc-500"
                    )}>
                      {q.teamSize}
                    </span>
                    {isFail && (
                      <span className="text-[9px] font-bold uppercase tracking-wider text-red-400/80 mt-0.5">
                        {Object.values(q.votes).filter(v => !v).length}F
                      </span>
                    )}
                    {!isFail && q.requiresTwoFails && (
                      <span className="text-[9px] font-bold uppercase tracking-wider mt-0.5 text-zinc-500">
                        2F
                      </span>
                    )}
                  </div>

                  {/* Vote history dots */}
                  {historyForQuest.length > 0 && (
                    <div className="flex gap-1 justify-center flex-wrap">
                      {historyForQuest.map((h, hIdx) => {
                        const globalIndex = gameState.voteHistory.indexOf(h);
                        return (
                          <button
                            key={hIdx}
                            onClick={() => setViewingHistoryIndex(viewingHistoryIndex === globalIndex ? null : globalIndex)}
                            className={cn(
                              "w-3.5 h-3.5 rounded-full border text-[8px] flex items-center justify-center transition-all font-bold",
                              h.approved
                                ? "bg-emerald-950/50 border-emerald-700/60 text-emerald-400"
                                : "bg-red-950/50 border-red-700/60 text-red-400",
                              viewingHistoryIndex === globalIndex && "ring-1 ring-white ring-offset-1 ring-offset-zinc-950"
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
        </div>
      </header>

      {/* End Game Confirmation Modal */}
      {showEndConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-5 bg-black/70 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-sm">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-11 h-11 bg-red-950/40 border border-red-800/40 rounded-xl flex items-center justify-center shrink-0">
                <AlertTriangle size={22} className="text-red-400" />
              </div>
              <div>
                <h2 className="font-bold text-zinc-100">{t("End Game")}?</h2>
                <p className="text-zinc-500 text-sm mt-0.5">This will end the game for all players.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowEndConfirm(false)}
                className="py-3 rounded-xl font-semibold text-sm bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 transition-colors"
              >
                {t("Cancel")}
              </button>
              <button
                onClick={() => { setShowEndConfirm(false); endGame(); }}
                className="py-3 rounded-xl font-semibold text-sm bg-red-600 hover:bg-red-500 text-white transition-colors"
              >
                {t("End Game")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
