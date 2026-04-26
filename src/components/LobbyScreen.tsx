import { useGameStore } from "../store";
import { Role } from "../utils/gameLogic";
import { Users, Play, LogOut, Bot, Brain, Sparkles, ChevronDown } from "lucide-react";
import { useTranslation } from "../utils/i18n";
import { useState } from "react";
import { cn } from "../utils/cn";

const GOLD = '#D4AF37';
const GOLD_DIM = 'rgba(212,175,55,0.22)';

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

const selectClass = "w-full bg-black/40 border border-[rgba(212,175,55,0.15)] rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-[rgba(212,175,55,0.4)] transition-colors";

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
    <div className="min-h-screen text-zinc-50 flex flex-col max-w-md mx-auto relative overflow-hidden" style={{ background: '#080604' }}>

      {/* ── Background ── */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat scale-105"
        style={{
          backgroundImage: 'url(/lobby-bg.png)',
          backgroundPosition: 'center top',
          filter: 'brightness(0.78) contrast(1.04)',
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-[#080604]/58 to-[#080604]/92" />
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 70% 45% at 50% 18%, rgba(212,175,55,0.1) 0%, transparent 100%)' }} />

      {/* ── Header ── */}
      <header className="px-5 pt-12 pb-5 relative z-10" style={{ borderBottom: `1px solid rgba(212,175,55,0.1)` }}>
        <div className="flex items-start justify-between">
          <div>
            <p style={{ fontSize: 9, fontWeight: 600, color: 'rgba(212,175,55,0.45)', textTransform: 'uppercase', letterSpacing: '0.22em', marginBottom: 4 }}>
              {t("Room")}
            </p>
            <h1
              className="font-mono font-bold tracking-widest"
              style={{ fontSize: 30, color: GOLD, textShadow: `0 0 20px rgba(212,175,55,0.3)`, lineHeight: 1 }}
            >
              {room.id}
            </h1>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 6 }}>{t("Waiting for players...")}</p>
          </div>

          <div className="flex items-center gap-2 mt-1">
            {/* Player count */}
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full avalon-glass-pill"
            >
              <Users size={12} style={{ color: 'rgba(212,175,55,0.5)' }} />
              <span className="font-mono text-sm font-semibold" style={{ color: 'rgba(212,175,55,0.8)' }}>
                {room.players.length}/10
              </span>
            </div>
            {/* Leave / End */}
            <button
              onClick={isHost ? endGame : leaveRoom}
              className="p-2 rounded-full transition-colors avalon-glass-pill"
              style={{ color: 'rgba(255,255,255,0.45)' }}
              title={isHost ? t("End Game") : t("Leave Room")}
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* ── Scrollable Content ── */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6 pb-32 relative z-10">

        {/* ── Players Section ── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <p style={{ fontSize: 9, fontWeight: 600, color: 'rgba(212,175,55,0.45)', textTransform: 'uppercase', letterSpacing: '0.22em' }}>
              {t("Players")}
            </p>
            {canAddBot && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => addBot('normal')}
                  className="text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors avalon-glass-control avalon-glass-control--normal"
                >
                  + Normal
                </button>
                <button
                  onClick={() => addBot('hard')}
                  className="text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors avalon-glass-control avalon-glass-control--hard"
                >
                  + Hard
                </button>
                <button
                  onClick={() => addBot('ai')}
                  className="text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors avalon-glass-control avalon-glass-control--ai"
                >
                  + AI
                </button>
              </div>
            )}
          </div>

          <ul className="space-y-2">
            {room.players.map((p) => (
              <li
                key={p.sessionId}
                className="rounded-xl overflow-hidden avalon-glass"
              >
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Avatar */}
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center border shrink-0 text-xs font-bold",
                    )} style={
                      p.isBot && p.botClass === 'ai'
                        ? { background: 'rgba(129,140,248,0.12)', border: '1px solid rgba(129,140,248,0.35)', color: '#818cf8' }
                        : p.isBot && p.botClass === 'hard'
                          ? { background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.35)', color: '#f59e0b' }
                          : p.isBot
                            ? { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.4)' }
                            : { background: 'rgba(212,175,55,0.08)', border: `1px solid rgba(212,175,55,0.3)`, color: GOLD }
                    }>
                      {p.isBot && p.botClass === 'ai'
                        ? <Brain size={14} />
                        : p.isBot
                          ? <Bot size={14} />
                          : p.name.charAt(0).toUpperCase()}
                    </div>

                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate" style={{ color: 'rgba(255,255,255,0.88)' }}>
                        {p.name}
                        {p.sessionId === sessionId && (
                          <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 400, marginLeft: 4 }}>(You)</span>
                        )}
                      </p>
                      {p.isBot && (
                        <p className="text-xs font-medium" style={
                          p.botClass === 'ai'
                            ? { color: '#6366f1' }
                            : p.botClass === 'hard'
                              ? { color: '#d97706' }
                              : { color: 'rgba(255,255,255,0.3)' }
                        }>
                          {p.botClass === 'ai' ? 'AI Bot' : p.botClass === 'hard' ? 'Hard Bot' : 'Normal Bot'}
                          {p.hasApiKey && <Sparkles size={10} className="inline ml-1" />}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {p.isHost && (
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider"
                        style={{ background: 'rgba(212,175,55,0.1)', border: `1px solid rgba(212,175,55,0.3)`, color: GOLD }}
                      >
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
                        className="p-1.5 transition-colors"
                        style={{ color: 'rgba(212,175,55,0.4)', background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        <ChevronDown size={14} className={cn("transition-transform", expandedBot === p.sessionId && "rotate-180")} />
                      </button>
                    )}
                    {isHost && !p.isHost && (
                      <button
                        onClick={() => kickPlayer(p.sessionId)}
                        className="w-6 h-6 flex items-center justify-center rounded-md transition-colors text-base font-bold leading-none"
                        style={{ color: 'rgba(255,255,255,0.2)', background: 'none', border: 'none', cursor: 'pointer' }}
                        title={t("Kick")}
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>

                {/* AI Bot Config Panel */}
                {p.isBot && p.botClass === 'ai' && isHost && expandedBot === p.sessionId && (
                  <div
                    className="px-4 pb-4 pt-3 space-y-2.5"
                    style={{ borderTop: `1px solid rgba(212,175,55,0.08)`, background: 'rgba(0,0,0,0.25)' }}
                  >
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
                        className="px-3 py-2 rounded-lg transition-colors text-xs font-medium disabled:opacity-40 whitespace-nowrap"
                        style={{ border: `1px solid rgba(212,175,55,0.2)`, color: 'rgba(212,175,55,0.6)', background: 'none', cursor: 'pointer' }}
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

        {/* ── Roles Section ── */}
        <section>
          <p style={{ fontSize: 9, fontWeight: 600, color: 'rgba(212,175,55,0.45)', textTransform: 'uppercase', letterSpacing: '0.22em', marginBottom: 12 }}>
            {t("Roles in Play")}
          </p>
          <div
            className="p-4 rounded-xl avalon-glass"
          >
            {room.players.length < 5 ? (
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>{t("Need at least 5 players to start")}</p>
            ) : (
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6 }}>
                {ROLE_COMPOSITIONS[room.players.length] || ''}
              </p>
            )}
          </div>
        </section>
      </div>

      {/* ── Sticky Bottom Action ── */}
      <div
        className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md px-5 pb-6 pt-3 z-20"
        style={{ background: 'linear-gradient(to top, rgba(8,6,4,0.96) 0%, rgba(8,6,4,0.82) 72%, transparent 100%)' }}
      >
        {isHost ? (
          <button
            onClick={() => startGame(devRequestedRole ? { [sessionId]: devRequestedRole } : undefined)}
            disabled={!canStart}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm transition-all"
            style={canStart ? {
              background: `linear-gradient(135deg, #b8922d 0%, ${GOLD} 45%, #c9a030 100%)`,
              boxShadow: `0 4px 20px rgba(212,175,55,0.28)`,
              color: '#1c1000',
              border: 'none',
              cursor: 'pointer',
              letterSpacing: '0.1em',
            } : {
              background: 'rgba(255,255,255,0.04)',
              border: `1px solid rgba(255,255,255,0.08)`,
              color: 'rgba(255,255,255,0.2)',
              cursor: 'not-allowed',
            }}
          >
            <Play size={15} />
            {canStart ? t("Start Game") : t("Need 5–10 players")}
          </button>
        ) : (
          <div className="text-center py-3.5 text-sm font-medium" style={{ color: 'rgba(212,175,55,0.45)', letterSpacing: '0.05em' }}>
            {t("Waiting for host to start")}
          </div>
        )}
      </div>
    </div>
  );
}
