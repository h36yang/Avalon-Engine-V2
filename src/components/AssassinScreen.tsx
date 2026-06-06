import { useState } from "react";
import { useGameStore } from "../store";
import { Skull, Target, ShieldAlert } from "lucide-react";
import { cn } from "../utils/cn";
import { useTranslation } from "../utils/i18n";
import VoteHistoryHeader from "./VoteHistoryHeader";
import VoteHistoryDetails from "./VoteHistoryDetails";
import { EVIL_ROLES, Role } from "../utils/gameLogic";
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
  const isEvil = me ? EVIL_ROLES.has(me.role as Role) : false;

  const canAssassinate = me?.role === "Assassin" || (isEvil && assassinPlayer?.isBot);

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
                  .filter(
                    (p) =>
                      !["Assassin", "Morgana", "Mordred", "Minion"].includes(
                        p.role as string,
                      ),
                  )
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
                            <span className="text-xs">{p.name.charAt(0)}</span>
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
