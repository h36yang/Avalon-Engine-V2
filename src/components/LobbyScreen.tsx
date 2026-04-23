import { useGameStore, Role } from "../store";
import { Users, Play, LogOut, Bot, Brain, Sparkles, ChevronDown } from "lucide-react";
import { useTranslation } from "../utils/i18n";
import { useState } from "react";
import { cn } from "../utils/cn";

type Provider = 'gemini' | 'openrouter' | 'groq' | 'nvidia';

const PROVIDER_MODELS: Record<Provider, { label: string; value: string }[]> = {
  gemini: [
    { label: 'Gemini 2.0 Flash Lite (free)', value: 'gemini-2.0-flash-lite' },
    { label: 'Gemini 2.0 Flash (free)', value: 'gemini-2.0-flash' },
    { label: 'Gemini 1.5 Flash (free)', value: 'gemini-1.5-flash' },
    { label: 'Gemini 1.5 Flash 8B (free)', value: 'gemini-1.5-flash-8b' },
    { label: 'Gemini 2.5 Flash Preview', value: 'gemini-2.5-flash-preview-04-17' },
  ],
  openrouter: [
    { label: 'Gemini 2.0 Flash Exp (free)', value: 'google/gemini-2.0-flash-exp:free' },
    { label: 'Llama 3.3 70B (free)', value: 'meta-llama/llama-3.3-70b-instruct:free' },
    { label: 'DeepSeek Chat V3 (free)', value: 'deepseek/deepseek-chat-v3-0324:free' },
    { label: 'DeepSeek R1 (free)', value: 'deepseek/deepseek-r1:free' },
    { label: 'Mistral Small 3.1 (free)', value: 'mistralai/mistral-small-3.1-24b-instruct:free' },
  ],
  groq: [
    { label: 'Llama 3.3 70B Versatile', value: 'llama-3.3-70b-versatile' },
    { label: 'Llama 3.1 70B Versatile', value: 'llama-3.1-70b-versatile' },
    { label: 'Llama 3.1 8B Instant', value: 'llama-3.1-8b-instant' },
    { label: 'Gemma 2 9B', value: 'gemma2-9b-it' },
    { label: 'Mixtral 8x7B', value: 'mixtral-8x7b-32768' },
  ],
  nvidia: [
    { label: 'Llama 3.3 70B Instruct', value: 'meta/llama-3.3-70b-instruct' },
    { label: 'Nemotron Super 49B', value: 'nvidia/llama-3.3-nemotron-super-49b-v1.5' },
    { label: 'DeepSeek R1 (0528)', value: 'deepseek-ai/deepseek-r1-0528' },
    { label: 'MiniMax M2.5', value: 'minimaxai/minimax-m2.5' },
    { label: 'Mixtral 8x7B Instruct', value: 'mistralai/mixtral-8x7b-instruct-v0.1' },
  ],
};

const selectClass = "w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-zinc-600 transition-colors";

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
  const testBotApiKey = useGameStore((state) => state.testBotApiKey);
  const { t } = useTranslation();

  const [botConfigs, setBotConfigs] = useState<Record<string, {
    provider: Provider;
    apiKey: string;
    model: string;
    customModel: string;
  }>>({});
  const [testStatus, setTestStatus] = useState<Record<string, string>>({});
  const [expandedBot, setExpandedBot] = useState<string | null>(null);

  if (!room) return null;

  const getBotConfig = (sid: string) =>
    botConfigs[sid] ?? { provider: 'gemini' as Provider, apiKey: '', model: PROVIDER_MODELS.gemini[0].value, customModel: '' };

  const resolveModel = (cfg: ReturnType<typeof getBotConfig>) =>
    cfg.model === 'custom' ? cfg.customModel : cfg.model;

  const updateLocalBotConfig = (
    sid: string,
    patch: Partial<{ provider: Provider; apiKey: string; model: string; customModel: string }>
  ) => {
    const current = getBotConfig(sid);
    let next = { ...current, ...patch };
    if (patch.provider && patch.provider !== current.provider) {
      next.model = PROVIDER_MODELS[patch.provider][0].value;
      next.customModel = '';
    }
    setBotConfigs(prev => ({ ...prev, [sid]: next }));
    updateBotApiKey(sid, next.apiKey, next.provider, resolveModel(next) || undefined);
    setTestStatus(prev => ({ ...prev, [sid]: '' }));
  };

  const handleTestApiKey = async (sid: string) => {
    const cfg = getBotConfig(sid);
    if (!cfg.apiKey) return;
    setTestStatus(prev => ({ ...prev, [sid]: 'testing' }));
    const result = await testBotApiKey(cfg.provider, cfg.apiKey, resolveModel(cfg) || undefined);
    setTestStatus(prev => ({ ...prev, [sid]: result.message }));
  };

  const isHost = room.players.find(p => p.isHost)?.sessionId === sessionId;
  const canStart = room.players.length >= 5 && room.players.length <= 10;
  const canAddBot = isHost && room.players.length < 10;

  const toggleRole = (role: Role) => {
    if (!isHost) return;
    const current = room.settings.optionalRoles;
    const updated = current.includes(role)
      ? current.filter((r) => r !== role)
      : [...current, role];
    updateSettings({ optionalRoles: updated });
  };

  const ROLE_COMPOSITIONS: Record<number, string> = {
    5: "Merlin · Percival · Loyal Servant · Morgana · Assassin",
    6: "Merlin · Percival · Loyal Servant ×2 · Morgana · Assassin",
    7: "Merlin · Percival · Loyal Servant ×2 · Morgana · Assassin · Oberon",
    8: "Merlin · Percival · Loyal Servant ×3 · Morgana · Assassin · Minion",
    9: "Merlin · Percival · Loyal Servant ×4 · Morgana · Assassin · Mordred",
    10: "Merlin · Percival · Loyal Servant ×4 · Morgana · Assassin · Oberon · Mordred",
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col max-w-md mx-auto">

      {/* Header */}
      <header className="px-5 pt-12 pb-5 border-b border-zinc-900">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-semibold text-zinc-600 uppercase tracking-widest mb-1">{t("Room")}</p>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-50 font-mono">{room.id}</h1>
            <p className="text-zinc-500 text-sm mt-1">{t("Waiting for players...")}</p>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-full">
              <Users size={13} className="text-zinc-500" />
              <span className="font-mono text-sm font-semibold text-zinc-300">{room.players.length}/10</span>
            </div>
            <button
              onClick={isHost ? endGame : leaveRoom}
              className="p-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-full text-zinc-500 hover:text-zinc-300 transition-colors"
              title={isHost ? t("End Game") : t("Leave Room")}
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6 pb-32">

        {/* Players Section */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">{t("Players")}</p>
            {canAddBot && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => addBot('normal')}
                  className="text-xs font-semibold text-zinc-300 bg-zinc-800 hover:bg-zinc-700 px-2.5 py-1 rounded-lg border border-zinc-700 transition-colors"
                >
                  + Normal
                </button>
                <button
                  onClick={() => addBot('hard')}
                  className="text-xs font-semibold text-amber-400 bg-amber-950/30 hover:bg-amber-950/50 px-2.5 py-1 rounded-lg border border-amber-800/40 transition-colors"
                >
                  + Hard
                </button>
                <button
                  onClick={() => addBot('ai')}
                  className="text-xs font-semibold text-indigo-400 bg-indigo-950/30 hover:bg-indigo-950/50 px-2.5 py-1 rounded-lg border border-indigo-800/40 transition-colors"
                >
                  + AI
                </button>
              </div>
            )}
          </div>

          <ul className="space-y-2">
            {room.players.map((p) => (
              <li key={p.sessionId} className="bg-zinc-900 border border-zinc-800/80 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center border shrink-0 text-xs font-bold",
                      p.isBot && p.botClass === 'ai'
                        ? "bg-indigo-950/50 border-indigo-800/50 text-indigo-400"
                        : p.isBot && p.botClass === 'hard'
                          ? "bg-amber-950/50 border-amber-800/50 text-amber-400"
                          : "bg-zinc-800 border-zinc-700 text-zinc-400"
                    )}>
                      {p.isBot && p.botClass === 'ai'
                        ? <Brain size={14} />
                        : p.isBot
                          ? <Bot size={14} />
                          : p.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-zinc-100 truncate">
                        {p.name}
                        {p.sessionId === sessionId && <span className="text-zinc-500 font-normal ml-1">(You)</span>}
                      </p>
                      {p.isBot && (
                        <p className={cn(
                          "text-xs font-medium",
                          p.botClass === 'ai' ? "text-indigo-500" : p.botClass === 'hard' ? "text-amber-500" : "text-zinc-500"
                        )}>
                          {p.botClass === 'ai' ? 'AI Bot' : p.botClass === 'hard' ? 'Hard Bot' : 'Normal Bot'}
                          {p.hasApiKey && <Sparkles size={10} className="inline ml-1" />}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {p.isHost && (
                      <span className="text-[10px] font-semibold text-zinc-400 bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded-full uppercase tracking-wider">
                        Host
                      </span>
                    )}
                    {!p.isConnected && !p.isBot && (
                      <span className="text-[10px] font-semibold text-red-400 bg-red-950/30 border border-red-800/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
                        Offline
                      </span>
                    )}
                    {p.isBot && p.botClass === 'ai' && isHost && (
                      <button
                        onClick={() => setExpandedBot(expandedBot === p.sessionId ? null : p.sessionId)}
                        className="p-1.5 text-zinc-500 hover:text-zinc-300 transition-colors"
                      >
                        <ChevronDown size={14} className={cn("transition-transform", expandedBot === p.sessionId && "rotate-180")} />
                      </button>
                    )}
                    {isHost && !p.isHost && (
                      <button
                        onClick={() => kickPlayer(p.sessionId)}
                        className="w-6 h-6 flex items-center justify-center text-zinc-600 hover:text-red-400 hover:bg-red-950/30 rounded-md transition-colors text-base font-bold leading-none"
                        title={t("Kick")}
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>

                {/* AI Bot Config Panel */}
                {p.isBot && p.botClass === 'ai' && isHost && expandedBot === p.sessionId && (
                  <div className="px-4 pb-4 pt-3 border-t border-zinc-800/50 space-y-2.5">
                    <select
                      value={getBotConfig(p.sessionId).provider}
                      onChange={(e) => updateLocalBotConfig(p.sessionId, { provider: e.target.value as Provider })}
                      className={selectClass}
                    >
                      <option value="gemini">Google Gemini</option>
                      <option value="openrouter">OpenRouter</option>
                      <option value="groq">Groq</option>
                      <option value="nvidia">NVIDIA NIM</option>
                    </select>
                    <input
                      type="password"
                      placeholder="API Key"
                      value={getBotConfig(p.sessionId).apiKey}
                      onChange={(e) => updateLocalBotConfig(p.sessionId, { apiKey: e.target.value })}
                      className={cn(selectClass, "placeholder:text-zinc-700")}
                    />
                    <div className="flex gap-2">
                      <select
                        value={getBotConfig(p.sessionId).model}
                        onChange={(e) => updateLocalBotConfig(p.sessionId, { model: e.target.value })}
                        className={cn(selectClass, "flex-1")}
                      >
                        {PROVIDER_MODELS[getBotConfig(p.sessionId).provider].map(m => (
                          <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                        <option value="custom">Custom model...</option>
                      </select>
                      <button
                        onClick={() => handleTestApiKey(p.sessionId)}
                        disabled={!getBotConfig(p.sessionId).apiKey || testStatus[p.sessionId] === 'testing'}
                        className="px-3 py-2 rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors text-xs font-medium disabled:opacity-40 whitespace-nowrap"
                      >
                        {testStatus[p.sessionId] === 'testing' ? '...' : 'Test'}
                      </button>
                    </div>
                    {getBotConfig(p.sessionId).model === 'custom' && (
                      <input
                        type="text"
                        placeholder="Custom model name"
                        value={getBotConfig(p.sessionId).customModel}
                        onChange={(e) => updateLocalBotConfig(p.sessionId, { customModel: e.target.value })}
                        className={cn(selectClass, "placeholder:text-zinc-700")}
                      />
                    )}
                    {testStatus[p.sessionId] && testStatus[p.sessionId] !== 'testing' && (
                      <div className={cn(
                        "text-xs px-3 py-2 rounded-lg",
                        String(testStatus[p.sessionId]).startsWith('✅')
                          ? 'text-emerald-400 bg-emerald-950/30 border border-emerald-800/30'
                          : 'text-red-400 bg-red-950/30 border border-red-800/30'
                      )}>
                        {testStatus[p.sessionId]}
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>

        {/* Roles Section */}
        <section>
          <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest mb-3">{t("Roles in Play")}</p>
          <div className="bg-zinc-900 border border-zinc-800/80 rounded-xl p-4">
            {room.players.length < 5 ? (
              <p className="text-sm text-zinc-500">{t("Need at least 5 players to start")}</p>
            ) : (
              <p className="text-sm text-zinc-300 leading-relaxed">
                {ROLE_COMPOSITIONS[room.players.length] || ''}
              </p>
            )}
          </div>
        </section>
      </div>

      {/* Sticky Bottom Action */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md px-5 pb-6 pt-3 bg-zinc-950/95 backdrop-blur-xl border-t border-zinc-900">
        {isHost ? (
          <button
            onClick={() => startGame(devRequestedRole ? { [sessionId]: devRequestedRole } : undefined)}
            disabled={!canStart}
            className={cn(
              "w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm transition-all",
              canStart
                ? "bg-zinc-50 hover:bg-white text-zinc-950 shadow-lg"
                : "bg-zinc-900 border border-zinc-800 text-zinc-600 cursor-not-allowed"
            )}
          >
            <Play size={16} />
            {canStart ? t("Start Game") : t("Need 5–10 players")}
          </button>
        ) : (
          <div className="text-center text-zinc-500 text-sm py-3.5 font-medium">
            {t("Waiting for host to start")}
          </div>
        )}
      </div>
    </div>
  );
}
