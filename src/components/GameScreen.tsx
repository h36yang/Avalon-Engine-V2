import { useState, useEffect } from "react";
import { useGameStore } from "../store";
import { Check, X, Crown, Users, Target, ShieldAlert, Eye, Shield, Skull, MessageSquare, Bot, Sparkles, Loader2 } from "lucide-react";
import { cn } from "../utils/cn";
import { useTranslation } from "../utils/i18n";
import VoteHistoryHeader from "./VoteHistoryHeader";
import VoteHistoryDetails from "./VoteHistoryDetails";
import { EVIL_ROLES, Role } from "../utils/gameLogic";

const BOT_LOADING_WORDS = [
  "Scheming", "Pondering", "Conspiring", "Buffering",
  "Philosophizing", "Overthinking", "Plotting", "Computing",
  "Calculating", "Strategizing", "Deliberating", "Hesitating",
];

export default function GameScreen() {
  const room = useGameStore((state) => state.room);
  const sessionId = useGameStore((state) => state.sessionId);
  const proposeTeam = useGameStore((state) => state.proposeTeam);
  const voteTeam = useGameStore((state) => state.voteTeam);
  const voteQuest = useGameStore((state) => state.voteQuest);
  const continueVoteReveal = useGameStore((state) => state.continueVoteReveal);
  const continueQuestResult = useGameStore((state) => state.continueQuestResult);
  const { t } = useTranslation();

  const [selectedTeam, setSelectedTeam] = useState<string[]>([]);
  const [viewingHistoryIndex, setViewingHistoryIndex] = useState<number | null>(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [loadingWordIndex, setLoadingWordIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setLoadingWordIndex(i => (i + 1) % BOT_LOADING_WORDS.length);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  if (!room) return null;

  const { gameState, status, players } = room;
  const currentQuest = gameState.quests[gameState.currentQuestIndex];
  const isLeader = players[gameState.leaderIndex].sessionId === sessionId;
  const me = players.find((p) => p.sessionId === sessionId);
  const isEvil = me ? EVIL_ROLES.has(me.role as Role) : false;

  let info: string[] = [];
  if (me?.role === "Merlin") {
    info = room.players.filter(p => ["Assassin", "Morgana", "Minion", "Oberon"].includes(p.role as string)).map(p => p.name);
  } else if (me?.role === "Percival") {
    info = room.players.filter(p => ["Merlin", "Morgana"].includes(p.role as string)).map(p => p.name);
  } else if (isEvil && me?.role !== "Oberon") {
    info = room.players.filter(p => ["Assassin", "Morgana", "Mordred", "Minion"].includes(p.role as string) && p.sessionId !== sessionId).map(p => p.name);
  }

  const togglePlayer = (id: string) => {
    if (status !== "team_building" || !isLeader) return;
    if (selectedTeam.includes(id)) {
      setSelectedTeam(selectedTeam.filter(p => p !== id));
    } else if (selectedTeam.length < currentQuest.teamSize) {
      setSelectedTeam([...selectedTeam, id]);
    }
  };

  const handlePropose = () => {
    if (selectedTeam.length === currentQuest.teamSize) {
      proposeTeam(selectedTeam);
      setSelectedTeam([]);
    }
  };

  const hasVotedTeam = sessionId in gameState.teamVotes;
  const hasVotedQuest = sessionId in currentQuest.votes;
  const isOnTeam = gameState.proposedTeam.includes(sessionId);
  const viewingVote = status === 'team_vote_reveal' ? gameState.voteHistory[gameState.voteHistory.length - 1] : null;
  const isViewingHistory = viewingHistoryIndex !== null;

  const getStatusConfig = () => {
    if (status === "team_building") {
      return {
        icon: <Crown size={20} className="text-amber-400" />,
        label: isLeader ? t("You are the Leader") : `${players[gameState.leaderIndex].name} ${t("is choosing the team")}`,
        sub: isLeader ? `${t("Select")} ${currentQuest.teamSize} ${t("team members")}` : t("Waiting for leader"),
        accent: "border-l-amber-500/60",
      };
    }
    if (status === "team_voting") {
      return {
        icon: <Users size={20} className="text-indigo-400" />,
        label: t("Vote on Team"),
        sub: t("Do you approve of this team?"),
        accent: "border-l-indigo-500/60",
      };
    }
    if (status === "team_vote_reveal") {
      return {
        icon: <Users size={20} className="text-indigo-400" />,
        label: t("Vote Results"),
        sub: viewingVote?.approved
          ? <span className="text-emerald-400">{t("Team Approved")}</span>
          : <span className="text-red-400">{t("Team Rejected")}</span>,
        accent: "border-l-indigo-500/60",
      };
    }
    if (status === "quest_voting") {
      return {
        icon: <Target size={20} className="text-emerald-400" />,
        label: t("Quest Phase"),
        sub: isOnTeam ? t("You are on the quest. Cast your vote.") : t("Waiting for team to complete quest..."),
        accent: "border-l-emerald-500/60",
      };
    }
    if (status === "quest_result") {
      const quest = gameState.quests[gameState.currentQuestIndex];
      const failed = quest.status === 'fail';
      const failCount = Object.values(quest.votes).filter(v => !v).length;
      return {
        icon: failed
          ? <ShieldAlert size={20} className="text-red-400" />
          : <Shield size={20} className="text-blue-400" />,
        label: <span className={failed ? "text-red-400" : "text-blue-400"}>
          {failed ? t("Quest Failed!") : t("Quest Success!")}
        </span>,
        sub: failCount > 0 ? `${failCount} ${t("fail votes cast")}` : t("All votes were for success"),
        accent: failed ? "border-l-red-500/60" : "border-l-blue-500/60",
      };
    }
    return null;
  };

  const statusConfig = getStatusConfig();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col max-w-md mx-auto">
      <VoteHistoryHeader
        title={`${t("Mission")} ${gameState.currentQuestIndex + 1}`}
        viewingHistoryIndex={viewingHistoryIndex}
        setViewingHistoryIndex={setViewingHistoryIndex}
        onViewRole={() => setShowRoleModal(true)}
      />

      {isViewingHistory ? (
        <VoteHistoryDetails
          viewingHistoryIndex={viewingHistoryIndex}
          onBack={() => setViewingHistoryIndex(null)}
        />
      ) : (
        <>
          <main className="flex-1 overflow-y-auto px-5 py-5 space-y-5 pb-32">

            {/* Status Card */}
            {statusConfig && (
              <div className={cn(
                "bg-zinc-900 border border-zinc-800/80 rounded-2xl p-4 border-l-4",
                statusConfig.accent
              )}>
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0 mt-0.5">
                    {statusConfig.icon}
                  </div>
                  <div>
                    <p className="font-semibold text-zinc-100 text-sm leading-tight">{statusConfig.label}</p>
                    <p className="text-zinc-500 text-xs mt-1">{statusConfig.sub}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Player List */}
            <section>
              <p className="text-[11px] font-semibold text-zinc-600 uppercase tracking-widest mb-3">{t("Players")}</p>
              <div className="space-y-1.5">
                {players.map((p, i) => {
                  const isSelected = status === "team_building"
                    ? selectedTeam.includes(p.sessionId)
                    : gameState.proposedTeam.includes(p.sessionId);
                  const isCurrentLeader = i === gameState.leaderIndex;
                  const canToggle = status === "team_building" && isLeader;

                  return (
                    <button
                      key={p.sessionId}
                      onClick={() => togglePlayer(p.sessionId)}
                      disabled={!canToggle}
                      className={cn(
                        "w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all text-left",
                        isSelected
                          ? "bg-indigo-950/30 border-indigo-700/50"
                          : "bg-zinc-900 border-zinc-800/80",
                        canToggle && !isSelected && "hover:border-zinc-700 hover:bg-zinc-900/80",
                        canToggle ? "cursor-pointer" : "cursor-default",
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center border text-xs font-bold shrink-0",
                          isSelected
                            ? "bg-indigo-600 border-indigo-500 text-white"
                            : "bg-zinc-800 border-zinc-700 text-zinc-500"
                        )}>
                          {isSelected ? <Check size={14} /> : p.name.charAt(0)}
                        </div>
                        <div>
                          <span className={cn("font-semibold text-sm", isSelected ? "text-indigo-100" : "text-zinc-200")}>
                            {p.name}
                            {p.sessionId === sessionId && <span className="font-normal text-zinc-500 ml-1">(You)</span>}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {p.isBot && p.hasApiKey && <Sparkles size={12} className="text-indigo-400" />}
                        {isCurrentLeader && <Crown size={14} className="text-amber-400" />}

                        {/* Voting states */}
                        {status === "team_voting" && p.isBot && p.hasApiKey && !(p.sessionId in gameState.teamVotes) && (
                          <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full flex items-center gap-1 border border-zinc-700">
                            <Loader2 size={9} className="animate-spin" />{BOT_LOADING_WORDS[loadingWordIndex]}
                          </span>
                        )}
                        {status === "team_voting" && p.sessionId in gameState.teamVotes && (
                          <span className="text-[10px] font-semibold text-zinc-500 bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded-full uppercase tracking-wide">
                            {t("Voted")}
                          </span>
                        )}
                        {status === "team_vote_reveal" && viewingVote && p.sessionId in viewingVote.votes && (
                          <div className={cn(
                            "flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide border",
                            viewingVote.votes[p.sessionId]
                              ? "bg-emerald-950/40 text-emerald-400 border-emerald-800/40"
                              : "bg-red-950/40 text-red-400 border-red-800/40"
                          )}>
                            {viewingVote.votes[p.sessionId] ? <Check size={10} /> : <X size={10} />}
                            {viewingVote.votes[p.sessionId] ? t("Approve") : t("Reject")}
                          </div>
                        )}
                        {status === "quest_voting" && p.isBot && p.hasApiKey && gameState.proposedTeam.includes(p.sessionId) && !(p.sessionId in currentQuest.votes) && (
                          <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full flex items-center gap-1 border border-zinc-700">
                            <Loader2 size={9} className="animate-spin" />{BOT_LOADING_WORDS[loadingWordIndex]}
                          </span>
                        )}
                        {status === "quest_voting" && gameState.proposedTeam.includes(p.sessionId) && p.sessionId in currentQuest.votes && (
                          <span className="text-[10px] font-semibold text-zinc-500 bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded-full uppercase tracking-wide">
                            {t("Voted")}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Bot Opinions */}
            {gameState.botOpinions && gameState.botOpinions.length > 0 && (
              <section>
                <p className="text-[11px] font-semibold text-zinc-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <MessageSquare size={11} /> {t("Bot Opinions")}
                </p>
                <div className="space-y-3">
                  {gameState.botOpinions.map((opinion, idx) => {
                    const botPlayer = players.find(p => p.sessionId === opinion.botId);
                    return (
                      <div key={idx} className="flex gap-3">
                        <div className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0 mt-0.5">
                          <Bot size={13} className="text-zinc-500" />
                        </div>
                        <div className="flex-1 bg-zinc-900 rounded-xl px-3.5 py-3 border border-zinc-800/80">
                          <p className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider mb-1.5">{botPlayer?.name || "Bot"}</p>
                          <p className={cn("text-sm leading-relaxed", opinion.isError ? "text-red-400" : "text-zinc-300")}>
                            {opinion.text}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </main>

          {/* Action Bar */}
          <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md px-5 pb-6 pt-3 bg-zinc-950/95 backdrop-blur-xl border-t border-zinc-900 z-10">

            {/* Continue buttons */}
            {(status === "team_vote_reveal" || status === "quest_result") && isLeader && (
              <button
                onClick={status === "team_vote_reveal" ? continueVoteReveal : continueQuestResult}
                className="w-full py-3.5 rounded-xl font-bold text-sm transition-all bg-zinc-50 hover:bg-white text-zinc-950 shadow-lg flex items-center justify-center gap-2"
              >
                {t("Continue")}
              </button>
            )}
            {(status === "team_vote_reveal" || status === "quest_result") && !isLeader && (
              <p className="text-center text-zinc-600 text-sm py-3.5">{t("Waiting for leader to continue...")}</p>
            )}

            {/* Team building */}
            {status === "team_building" && isLeader && (
              <button
                onClick={handlePropose}
                disabled={selectedTeam.length !== currentQuest.teamSize}
                className={cn(
                  "w-full py-3.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2",
                  selectedTeam.length === currentQuest.teamSize
                    ? "bg-zinc-50 hover:bg-white text-zinc-950 shadow-lg"
                    : "bg-zinc-900 border border-zinc-800 text-zinc-600 cursor-not-allowed"
                )}
              >
                {t("Propose Team")}
                <span className={cn(
                  "text-xs font-semibold px-2 py-0.5 rounded-full",
                  selectedTeam.length === currentQuest.teamSize ? "bg-zinc-900 text-zinc-700" : "bg-zinc-800 text-zinc-600"
                )}>
                  {selectedTeam.length}/{currentQuest.teamSize}
                </span>
              </button>
            )}
            {status === "team_building" && !isLeader && (
              <p className="text-center text-zinc-600 text-sm py-3.5">
                {`${t("Leader is selecting")} ${gameState.proposedTeam.length}/${currentQuest.teamSize}`}
              </p>
            )}

            {/* Team voting */}
            {status === "team_voting" && !hasVotedTeam && (
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => voteTeam(false)}
                  className="py-3.5 rounded-xl font-bold text-sm bg-zinc-900 border border-red-800/50 text-red-400 hover:bg-red-950/20 transition-all flex items-center justify-center gap-2"
                >
                  <X size={16} /> {t("Reject")}
                </button>
                <button
                  onClick={() => voteTeam(true)}
                  className="py-3.5 rounded-xl font-bold text-sm bg-zinc-50 hover:bg-white text-zinc-950 transition-all flex items-center justify-center gap-2 shadow-lg"
                >
                  <Check size={16} /> {t("Approve")}
                </button>
              </div>
            )}
            {status === "team_voting" && hasVotedTeam && (
              <p className="text-center text-zinc-600 text-sm py-3.5">{t("Waiting for others to vote...")}</p>
            )}

            {/* Quest voting */}
            {status === "quest_voting" && isOnTeam && !hasVotedQuest && (
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => voteQuest(false)}
                  disabled={!EVIL_ROLES.has(me?.role as Role)}
                  className={cn(
                    "py-3.5 rounded-xl font-bold text-sm border transition-all flex items-center justify-center gap-2",
                    EVIL_ROLES.has(me?.role as Role)
                      ? "bg-zinc-900 border-red-800/50 text-red-400 hover:bg-red-950/20"
                      : "bg-zinc-900 border-zinc-800 text-zinc-700 cursor-not-allowed"
                  )}
                >
                  <ShieldAlert size={16} /> {t("Fail")}
                </button>
                <button
                  onClick={() => voteQuest(true)}
                  className="py-3.5 rounded-xl font-bold text-sm bg-zinc-50 hover:bg-white text-zinc-950 transition-all flex items-center justify-center gap-2 shadow-lg"
                >
                  <Target size={16} /> {t("Success")}
                </button>
              </div>
            )}
            {status === "quest_voting" && (!isOnTeam || hasVotedQuest) && (
              <p className="text-center text-zinc-600 text-sm py-3.5">{t("Waiting for team to complete quest...")}</p>
            )}
          </div>
        </>
      )}

      {/* Role Info Modal */}
      {showRoleModal && me && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-5 bg-black/70 backdrop-blur-sm" onClick={() => setShowRoleModal(false)}>
          <div
            className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-sm relative"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setShowRoleModal(false)}
              className="absolute top-4 right-4 p-1.5 text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-4 mb-5">
              <div className={cn(
                "w-12 h-12 rounded-xl border flex items-center justify-center",
                isEvil ? "bg-red-950/30 border-red-800/50" : "bg-blue-950/30 border-blue-800/50"
              )}>
                {isEvil ? <Skull size={24} className="text-red-400" /> : <Shield size={24} className="text-blue-400" />}
              </div>
              <div>
                <h2 className={cn("text-xl font-serif font-bold", isEvil ? "text-red-300" : "text-blue-300")}>
                  {t(me.role as string)}
                </h2>
                <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest mt-0.5">
                  {isEvil ? t("Minion of Mordred") : t("Loyal Servant of Arthur")}
                </p>
              </div>
            </div>

            {info.length > 0 && (
              <div className="bg-zinc-950/60 rounded-xl p-4 border border-zinc-800/60">
                <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest mb-3">
                  {me.role === "Merlin" ? t("You see evil:") : me.role === "Percival" ? t("Merlin or Morgana:") : t("Your fellow evil:")}
                </p>
                <div className="space-y-2">
                  {info.map(name => (
                    <div key={name} className="flex items-center gap-2.5">
                      <div className="w-2 h-2 rounded-full bg-zinc-600" />
                      <span className="font-semibold text-zinc-200 text-sm">{name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => setShowRoleModal(false)}
              className="w-full mt-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-semibold transition-colors border border-zinc-700"
            >
              <Eye size={14} className="inline mr-2" />
              {t("Got it")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
