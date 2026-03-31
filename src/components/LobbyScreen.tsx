import { useGameStore, Role } from "../store";
import { Users, Settings, Play, LogOut, Bot, UserMinus, Plus, ChevronDown } from "lucide-react";
import { useTranslation } from "../utils/i18n";
import { useState } from "react";

export default function LobbyScreen() {
  const room = useGameStore((state) => state.room);
  const sessionId = useGameStore((state) => state.sessionId);
  const updateSettings = useGameStore((state) => state.updateSettings);
  const startGame = useGameStore((state) => state.startGame);
  const leaveRoom = useGameStore((state) => state.leaveRoom);
  const addBot = useGameStore((state) => state.addBot);
  const kickPlayer = useGameStore((state) => state.kickPlayer);
  const endGame = useGameStore((state) => state.endGame);
  const devRequestedRole = useGameStore((state) => state.devRequestedRole);
  const updateBotApiKey = useGameStore((state) => state.updateBotApiKey);
  const { t } = useTranslation();

  if (!room) return null;

  const isHost = room.players.find(p => p.isHost)?.sessionId === sessionId;
  const canStart = room.players.length >= 5 && room.players.length <= 10;
  const canAddBot = isHost && room.players.length < 10;
  const botCount = room.players.filter(p => p.isBot).length;

  const toggleRole = (role: Role) => {
    if (!isHost) return;
    const current = room.settings.optionalRoles;
    const updated = current.includes(role)
      ? current.filter((r) => r !== role)
      : [...current, role];
    updateSettings({ optionalRoles: updated });
  };

  return (
    <div className="min-h-screen text-zinc-50 relative overflow-hidden">
      {/* Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: 'url(/lobby-bg.png)' }}
      />
      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/60 via-zinc-950/75 to-zinc-950/95" />

      <div className="relative z-10 p-6 flex flex-col max-w-md mx-auto min-h-screen">
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-serif font-bold tracking-tight">
              {t("Room")} {room.id}
            </h1>
            <p className="text-zinc-400 text-sm">{t("Waiting for players...")}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-zinc-900/70 backdrop-blur-sm px-3 py-1 rounded-full border border-zinc-700/50 flex items-center gap-2">
              <Users size={16} className="text-zinc-400" />
              <span className="font-mono text-sm">{room.players.length}/10</span>
            </div>
            {isHost ? (
              <button
                onClick={endGame}
                className="p-2 bg-zinc-900/70 backdrop-blur-sm hover:bg-red-900/40 border border-zinc-700/50 hover:border-red-500/50 rounded-full text-zinc-400 hover:text-red-400 transition-colors"
                title={t("End Game")}
              >
                <LogOut size={16} />
              </button>
            ) : (
              <button
                onClick={leaveRoom}
                className="p-2 bg-zinc-900/70 backdrop-blur-sm hover:bg-zinc-800 border border-zinc-700/50 rounded-full text-zinc-400 transition-colors"
                title={t("Leave Room")}
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 space-y-8">
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                {t("Players")}
              </h2>
              {canAddBot && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => addBot('normal')}
                    className="text-xs flex items-center gap-1 text-white font-medium transition-all duration-200 bg-gradient-to-r from-zinc-700 to-zinc-600 px-1.5 py-0.5 rounded-lg border border-zinc-500/30 hover:from-zinc-600 hover:to-zinc-500 hover:shadow-lg hover:shadow-zinc-500/25 active:scale-95"
                    title={t("Add Normal Bot")}
                  >
                    <span>{t('Add Normal Bot')}</span>
                  </button>
                  <button
                    onClick={() => addBot('hard')}
                    className="text-xs flex items-center gap-1 text-white font-medium transition-all duration-200 bg-gradient-to-r from-amber-600 to-amber-500 px-1.5 py-0.5 rounded-lg border border-amber-400/30 hover:from-amber-500 hover:to-amber-400 hover:shadow-lg hover:shadow-amber-500/25 active:scale-95"
                    title={t("Add Hard Bot")}
                  >
                    <span>{t('Add Hard Bot')}</span>
                  </button>
                </div>
              )}
            </div>
            <ul className="space-y-2">
              {room.players.map((p, i) => (
                <li
                  key={p.sessionId}
                  className="bg-zinc-900/60 backdrop-blur-sm border border-zinc-700/40 rounded-xl flex flex-col"
                >
                  <div className="p-4 flex items-center justify-between">
                    <span className="font-medium flex items-center gap-2">
                      {p.name} {p.sessionId === sessionId && "(You)"}
                      {p.isBot && <Bot size={18} className={p.difficulty === "hard" ? "text-amber-400" : "text-zinc-400"} />}
                    </span>
                    <div className="flex items-center gap-2">
                      {p.isHost && (
                        <span className="text-xs bg-indigo-500/20 text-indigo-400 px-2 py-1 rounded-md">
                          {t("Host")}
                        </span>
                      )}
                      {!p.isConnected && !p.isBot && (
                        <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded-md">
                          {t("Offline")}
                        </span>
                      )}
                      {isHost && !p.isHost && (
                        <button
                          onClick={() => kickPlayer(p.sessionId)}
                          className="p-0.5 text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors flex items-center justify-center"
                          title={t("Kick")}
                        >
                          <span className="text-sm leading-none font-bold">×</span>
                        </button>
                      )}
                    </div>
                  </div>
                  {p.isBot && isHost && (
                    <div className="px-4 pb-4 pt-3 border-t border-zinc-800/50">
                      <input
                        type="password"
                        placeholder="Gemini API Key (optional)"
                        value={p.apiKey || ""}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateBotApiKey(p.sessionId, e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-sm text-zinc-300 focus:outline-none focus:border-indigo-500/50"
                      />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3">
              <Settings size={16} className="text-zinc-400" />
              <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                {t("Roles in play")} ({room.players.length} {t("Players")})
              </h2>
            </div>
            <div className="bg-zinc-900/60 backdrop-blur-sm border border-zinc-700/40 rounded-xl p-4 text-sm text-zinc-300">
              {room.players.length < 5 && t("Need at least 5 players")}
              {room.players.length === 5 && `${t("Merlin")}, ${t("Percival")}, ${t("Loyal Servant")}, ${t("Morgana")}, ${t("Assassin")}`}
              {room.players.length === 6 && `${t("Merlin")}, ${t("Percival")}, ${t("Loyal Servant")} x2, ${t("Morgana")}, ${t("Assassin")}`}
              {room.players.length === 7 && `${t("Merlin")}, ${t("Percival")}, ${t("Loyal Servant")} x2, ${t("Morgana")}, ${t("Assassin")}, ${t("Oberon")}`}
              {room.players.length === 8 && `${t("Merlin")}, ${t("Percival")}, ${t("Loyal Servant")} x3, ${t("Morgana")}, ${t("Assassin")}, ${t("Minion")}`}
              {room.players.length === 9 && `${t("Merlin")}, ${t("Percival")}, ${t("Loyal Servant")} x4, ${t("Morgana")}, ${t("Assassin")}, ${t("Mordred")}`}
              {room.players.length === 10 && `${t("Merlin")}, ${t("Percival")}, ${t("Loyal Servant")} x4, ${t("Morgana")}, ${t("Assassin")}, ${t("Oberon")}, ${t("Mordred")}`}
            </div>
          </section>
        </div>

        {isHost && (
          <div className="mt-8 pt-4 border-t border-zinc-700/30">
            <button
              onClick={() => startGame(devRequestedRole ? { [sessionId]: devRequestedRole } : undefined)}
              disabled={!canStart}
              className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl font-medium transition-colors ${canStart
                ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                : "bg-zinc-800/70 text-zinc-500 cursor-not-allowed"
                }`}
            >
              <Play size={20} />
              {canStart ? t("Start Game") : t("Need 5-10 players")}
            </button>
          </div>
        )}
        {!isHost && (
          <div className="mt-8 pt-4 border-t border-zinc-700/30 text-center text-zinc-400 text-sm">
            {t("Waiting for host to start")}
          </div>
        )}
      </div>
    </div>
  );
}
