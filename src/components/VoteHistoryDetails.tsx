import { History, Crown, Check, X } from "lucide-react";
import { cn } from "../utils/cn";
import { useTranslation } from "../utils/i18n";
import { useGameStore } from "../store";

interface Props {
  viewingHistoryIndex: number;
  onBack: () => void;
  backText?: string;
}

export default function VoteHistoryDetails({ viewingHistoryIndex, onBack, backText }: Props) {
  const room = useGameStore((state) => state.room);
  const sessionId = useGameStore((state) => state.sessionId);
  const { t } = useTranslation();

  if (!room) return null;
  const { gameState, players } = room;
  const viewingVote = gameState.voteHistory[viewingHistoryIndex];

  if (!viewingVote) return null;

  return (
    <>
      <main className="flex-1 p-6 space-y-8">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center">
          <History className="w-8 h-8 mx-auto mb-3 text-indigo-400" />
          <h2 className="text-lg font-medium mb-1">
            {t("Vote History")}
          </h2>
          <p className="text-sm text-zinc-400">
            {t("Mission")} {viewingVote.questIndex + 1}, {t("Attempt")} {viewingVote.voteTrack + 1}
            <br />
            <span className={viewingVote.approved ? "text-emerald-400" : "text-red-400"}>
              {viewingVote.approved ? t("Team Approved") : t("Team Rejected")}
            </span>
          </p>
        </div>

        <section>
          <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">
            {t("Players")}
          </h3>
          <div className="space-y-2">
            {players.map((p, i) => {
              const isSelected = viewingVote.proposedTeam.includes(p.sessionId);
              const isCurrentLeader = i === viewingVote.leaderIndex;

              return (
                <div
                  key={p.sessionId}
                  className={cn(
                    "w-full flex items-center justify-between p-4 rounded-xl border transition-all text-left cursor-default",
                    isSelected
                      ? "bg-indigo-950/30 border-indigo-500/50 text-indigo-100"
                      : "bg-zinc-900 border-zinc-800 text-zinc-300"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center border",
                        isSelected
                          ? "bg-indigo-600 border-indigo-500 text-white"
                          : "bg-zinc-800 border-zinc-700 text-zinc-500"
                      )}
                    >
                      {isSelected ? (
                        <Check size={16} />
                      ) : (
                        <span className="text-xs">{p.name.charAt(0)}</span>
                      )}
                    </div>
                    <span className="font-medium">
                      {p.name} {p.sessionId === sessionId && "(You)"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {isCurrentLeader && (
                      <Crown size={16} className="text-amber-500" />
                    )}
                    {p.sessionId in viewingVote.votes && (
                      <div className={cn(
                        "flex items-center gap-1 px-2 py-1 rounded-md text-xs",
                        viewingVote.votes[p.sessionId] ? "bg-emerald-950/50 text-emerald-400" : "bg-red-950/50 text-red-400"
                      )}>
                        {viewingVote.votes[p.sessionId] ? <Check size={12} /> : <X size={12} />}
                        {viewingVote.votes[p.sessionId] ? t("Approve") : t("Reject")}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      <div className="p-6 border-t border-zinc-900 bg-zinc-950/80 backdrop-blur-xl sticky bottom-0 z-10">
        <button
          onClick={onBack}
          className="w-full py-4 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
        >
          {backText || t("Back to Current Game")}
        </button>
      </div>
    </>
  );
}
