import { useState } from "react";
import { useGameStore } from "../store";
import { Crown, Skull, Shield, RefreshCw, Check, X, ChevronDown, ChevronUp, ShieldAlert, Users, Target, Brain, Copy, CheckCheck } from "lucide-react";
import { cn } from "../utils/cn";
import { useTranslation } from "../utils/i18n";
import { EVIL_ROLES, Role } from "../utils/gameLogic";
import GameTimer from "./GameTimer";

export default function GameOverScreen() {
  const room = useGameStore((state) => state.room);
  const sessionId = useGameStore((state) => state.sessionId);
  const restartGame = useGameStore((state) => state.restartGame);
  const { t } = useTranslation();
  const [expandedQuest, setExpandedQuest] = useState<number | null>(null);
  const [expandedMindLog, setExpandedMindLog] = useState<string | null>(null);
  const [copiedLog, setCopiedLog] = useState<string | null>(null);

  if (!room) return null;

  const { gameState, players } = room;
  const isEvilWin = gameState.winner === "evil";
  const isHost = players.find(p => p.isHost)?.sessionId === sessionId;

  const getPlayerName = (sid: string) => players.find(p => p.sessionId === sid)?.name || sid;
  const getPlayerRole = (sid: string) => players.find(p => p.sessionId === sid)?.role as string | null;
  const isPlayerEvil = (sid: string) => {
    const role = getPlayerRole(sid);
    return role ? EVIL_ROLES.has(role as Role) : false;
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col max-w-md mx-auto">

      {/* Victory Banner */}
      <div className={cn(
        "relative overflow-hidden px-5 pt-14 pb-8",
        isEvilWin ? "bg-gradient-to-b from-red-950/20 to-zinc-950" : "bg-gradient-to-b from-blue-950/20 to-zinc-950"
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={cn(
              "w-14 h-14 rounded-2xl flex items-center justify-center border shrink-0",
              isEvilWin ? "bg-red-950/40 border-red-700/50" : "bg-blue-950/40 border-blue-700/50"
            )}>
              {isEvilWin
                ? <Skull size={28} className="text-red-400" />
                : <Shield size={28} className="text-blue-400" />}
            </div>
            <div>
              <h1 className={cn(
                "text-3xl font-bold tracking-tight",
                isEvilWin ? "text-red-300" : "text-blue-300"
              )}>
                {isEvilWin ? t("Evil Wins!") : t("Good Wins!")}
              </h1>
              <p className="text-zinc-500 text-sm mt-0.5">
                {isEvilWin
                  ? gameState.assassinationTarget ? t("Merlin was assassinated!") : t("Evil sabotaged quests")
                  : t("Merlin survived!")}
              </p>
            </div>
          </div>
          {room.gameStartedAt && <GameTimer gameStartedAt={room.gameStartedAt} gameEndedAt={room.gameEndedAt} />}
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-5 pb-28 space-y-6">

        {/* Roles Section */}
        <section>
          <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest mb-3">{t("Roles in Play")}</p>
          <div className="space-y-1.5">
            {players.map((p) => {
              const isEvil = EVIL_ROLES.has(p.role as Role);
              const isTarget = gameState.assassinationTarget === p.sessionId;
              return (
                <div
                  key={p.sessionId}
                  className={cn(
                    "flex items-center justify-between px-4 py-3 rounded-xl border",
                    isEvil ? "bg-red-950/10 border-red-900/30" : "bg-blue-950/10 border-blue-900/30"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center border text-xs font-bold shrink-0",
                      isEvil ? "bg-red-950/30 border-red-800/40 text-red-400" : "bg-blue-950/30 border-blue-800/40 text-blue-400"
                    )}>
                      {p.name.charAt(0)}
                    </div>
                    <div>
                      <p className={cn("font-semibold text-sm", p.sessionId === sessionId ? "text-zinc-50" : "text-zinc-200")}>
                        {p.name}{p.sessionId === sessionId && <span className="text-zinc-500 font-normal ml-1">(You)</span>}
                      </p>
                      <p className={cn("text-xs font-semibold uppercase tracking-wide mt-0.5", isEvil ? "text-red-400" : "text-blue-400")}>
                        {t(p.role as string)}
                      </p>
                    </div>
                  </div>
                  {isTarget && (
                    <div className="flex items-center gap-1 text-red-400 text-[10px] font-bold bg-red-950/40 border border-red-800/40 px-2 py-1 rounded-full uppercase tracking-wider">
                      <Skull size={10} /> {t("Assassinated")}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Quest Timeline */}
        <section>
          <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest mb-3">{t("Quest Timeline")}</p>
          <div className="space-y-2">
            {gameState.quests.map((quest, qi) => {
              const isExpanded = expandedQuest === qi;
              const failed = quest.status === "fail";
              const success = quest.status === "success";
              const pending = quest.status === "pending";
              const failCount = Object.values(quest.votes).filter(v => !v).length;
              const historyForQuest = gameState.voteHistory.filter(h => h.questIndex === qi);
              const failedBy = Object.entries(quest.votes).filter(([, v]) => !v).map(([sid]) => sid);

              return (
                <div key={qi} className="rounded-xl border border-zinc-800/80 overflow-hidden">
                  <button
                    onClick={() => !pending && setExpandedQuest(isExpanded ? null : qi)}
                    className={cn(
                      "w-full flex items-center justify-between px-4 py-3.5 text-left transition-colors",
                      failed ? "bg-red-950/10" : success ? "bg-blue-950/10" : "bg-zinc-900",
                      !pending && "hover:brightness-110"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center border font-bold text-sm shrink-0",
                        failed ? "bg-red-950/30 border-red-800/50 text-red-400"
                          : success ? "bg-blue-950/30 border-blue-800/50 text-blue-400"
                            : "bg-zinc-800 border-zinc-700 text-zinc-500"
                      )}>
                        {quest.teamSize}
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-zinc-100">
                          {t("Quest")} {qi + 1}
                          {quest.requiresTwoFails && <span className="text-zinc-600 text-xs font-normal ml-1">(2 {t("Fails")})</span>}
                        </p>
                        <p className={cn(
                          "text-[11px] font-semibold uppercase tracking-wide mt-0.5",
                          failed ? "text-red-400" : success ? "text-blue-400" : "text-zinc-600"
                        )}>
                          {failed ? `${t("Failed")} · ${failCount} ${t("Fails")}` : success ? t("Success") : t("Pending")}
                        </p>
                      </div>
                    </div>
                    {!pending && (
                      <div className="flex items-center gap-2 shrink-0">
                        {historyForQuest.length > 0 && (
                          <span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">
                            {historyForQuest.length} {t("attempt")}
                          </span>
                        )}
                        {isExpanded ? <ChevronUp size={14} className="text-zinc-500" /> : <ChevronDown size={14} className="text-zinc-500" />}
                      </div>
                    )}
                  </button>

                  {isExpanded && !pending && (
                    <div className="border-t border-zinc-800/60 p-4 space-y-3 bg-zinc-950/50">
                      {/* Quest votes */}
                      {(failed || success) && (
                        <div className={cn(
                          "rounded-xl p-3 border",
                          failed ? "bg-red-950/15 border-red-900/30" : "bg-blue-950/15 border-blue-900/30"
                        )}>
                          <div className="flex items-center gap-2 mb-2.5">
                            {failed ? <ShieldAlert size={12} className="text-red-400" /> : <Target size={12} className="text-blue-400" />}
                            <span className={cn("text-[11px] font-bold uppercase tracking-widest", failed ? "text-red-400" : "text-blue-400")}>
                              {t("Quest Votes")}
                            </span>
                          </div>
                          <div className="space-y-2">
                            {Object.entries(quest.votes).map(([sid, vote]) => (
                              <div key={sid} className="flex items-center justify-between">
                                <span className={cn("text-sm font-medium", isPlayerEvil(sid) ? "text-red-300" : "text-blue-300")}>
                                  {getPlayerName(sid)}
                                  <span className="text-zinc-600 text-xs font-normal ml-1">({t(getPlayerRole(sid) || "")})</span>
                                </span>
                                <span className={cn(
                                  "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full",
                                  vote ? "bg-blue-950/40 text-blue-400 border border-blue-800/40" : "bg-red-950/40 text-red-400 border border-red-800/40"
                                )}>
                                  {vote ? t("Success") : t("Fail")}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Team vote history */}
                      {historyForQuest.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-2.5">
                            <Users size={12} className="text-zinc-500" />
                            <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">{t("Team Votes")}</span>
                          </div>
                          <div className="space-y-2">
                            {historyForQuest.map((h, hi) => {
                              const approves = Object.values(h.votes).filter(v => v).length;
                              const rejects = Object.values(h.votes).filter(v => !v).length;
                              const leaderName = players[h.leaderIndex]?.name || "?";
                              return (
                                <div key={hi} className="bg-zinc-900 border border-zinc-800/60 rounded-xl p-3">
                                  <div className="flex items-center justify-between mb-2.5">
                                    <span className="text-xs text-zinc-500">
                                      <Crown size={10} className="inline text-amber-400 mr-1" />
                                      {leaderName} · #{hi + 1}
                                    </span>
                                    <span className={cn(
                                      "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full",
                                      h.approved
                                        ? "bg-emerald-950/40 text-emerald-400 border border-emerald-800/40"
                                        : "bg-red-950/40 text-red-400 border border-red-800/40"
                                    )}>
                                      {h.approved ? t("Approved") : t("Rejected")} {approves}/{rejects}
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {players.map(p => {
                                      if (!(p.sessionId in h.votes)) return null;
                                      const approved = h.votes[p.sessionId];
                                      const onTeam = h.proposedTeam.includes(p.sessionId);
                                      return (
                                        <div key={p.sessionId} className="flex items-center gap-1 text-xs">
                                          {approved
                                            ? <Check size={10} className="text-emerald-400" />
                                            : <X size={10} className="text-red-400" />}
                                          <span className={onTeam ? "font-semibold text-zinc-200" : "text-zinc-500"}>
                                            {p.name}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                  {/* Proposed team */}
                                  <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[10px] text-zinc-700 uppercase tracking-wider font-semibold">{t("Team")}:</span>
                                    {h.proposedTeam.map(sid => (
                                      <span key={sid} className={cn(
                                        "text-[10px] font-semibold px-1.5 py-0.5 rounded bg-zinc-800",
                                        isPlayerEvil(sid) ? "text-red-400" : "text-blue-400"
                                      )}>
                                        {getPlayerName(sid)}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* AI Mind Logs */}
        {gameState.botMindLogs && Object.keys(gameState.botMindLogs).length > 0 && (
          <section>
            <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Brain size={11} className="text-indigo-400" />
              {t("AI Mind Log")}
            </p>
            <div className="space-y-2">
              {Object.entries(gameState.botMindLogs).map(([botId, rawLogs]) => {
                const logs = rawLogs as { phase: string; prompt: string; response: string; decision: string; timestamp: number }[];
                const botPlayer = players.find(p => p.sessionId === botId);
                if (!botPlayer || !logs || logs.length === 0) return null;
                const isExpanded = expandedMindLog === botId;
                const isCopied = copiedLog === botId;

                const formatLogForCopy = () =>
                  `=== ${botPlayer.name} (${t(botPlayer.role as string)}) Mind Log ===\n\n` +
                  logs.map(log =>
                    `--- ${log.phase} [${new Date(log.timestamp).toLocaleTimeString()}] ---\nPrompt: ${log.prompt}\nResponse: ${log.response}\nDecision: ${log.decision}\n`
                  ).join('\n');

                const handleCopy = async () => {
                  try {
                    await navigator.clipboard.writeText(formatLogForCopy());
                  } catch {
                    const ta = document.createElement('textarea');
                    ta.value = formatLogForCopy();
                    document.body.appendChild(ta);
                    ta.select();
                    document.execCommand('copy');
                    document.body.removeChild(ta);
                  }
                  setCopiedLog(botId);
                  setTimeout(() => setCopiedLog(null), 2000);
                };

                return (
                  <div key={botId} className="rounded-xl border border-indigo-900/30 overflow-hidden">
                    <button
                      onClick={() => setExpandedMindLog(isExpanded ? null : botId)}
                      className="w-full flex items-center justify-between px-4 py-3.5 text-left bg-indigo-950/10 hover:bg-indigo-950/20 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Brain size={16} className="text-indigo-400 shrink-0" />
                        <div>
                          <p className="font-semibold text-sm text-zinc-100">{botPlayer.name}</p>
                          <p className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider mt-0.5">
                            {t(botPlayer.role as string)} · {logs.length} entries
                          </p>
                        </div>
                      </div>
                      {isExpanded ? <ChevronUp size={14} className="text-zinc-500" /> : <ChevronDown size={14} className="text-zinc-500" />}
                    </button>

                    {isExpanded && (
                      <div className="border-t border-indigo-900/30 p-4 space-y-3 bg-zinc-950/60">
                        <button
                          onClick={handleCopy}
                          className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border border-indigo-800/40 text-indigo-400 hover:bg-indigo-950/30 transition-colors font-semibold"
                        >
                          {isCopied ? <CheckCheck size={12} /> : <Copy size={12} />}
                          {isCopied ? t("Copied!") : t("Copy Log")}
                        </button>
                        {logs.map((log, i) => (
                          <div key={i} className="bg-zinc-900 border border-zinc-800/60 rounded-xl p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-widest">{log.phase}</span>
                              <span className="text-[10px] text-zinc-600">{new Date(log.timestamp).toLocaleTimeString()}</span>
                            </div>
                            <div className="text-xs text-zinc-400 bg-zinc-950/50 rounded-lg p-2.5 max-h-28 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                              {log.response}
                            </div>
                            <p className="text-xs text-zinc-400">
                              <span className="text-zinc-600 font-medium">Decision: </span>{log.decision}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {/* Sticky Bottom Action */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md px-5 pb-6 pt-3 bg-zinc-950/95 backdrop-blur-xl border-t border-zinc-900">
        {isHost ? (
          <button
            onClick={restartGame}
            className="w-full py-3.5 rounded-xl font-bold text-sm bg-zinc-50 hover:bg-white text-zinc-950 transition-all flex items-center justify-center gap-2 shadow-lg"
          >
            <RefreshCw size={16} /> {t("Play Again")}
          </button>
        ) : (
          <p className="text-zinc-600 text-sm text-center py-3.5">{t("Waiting for host to continue...")}</p>
        )}
      </div>
    </div>
  );
}
