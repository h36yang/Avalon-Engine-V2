import React, { useState } from 'react';
import { useGameStore } from '../store';
import { supabase, recreateSupabaseClient } from '../utils/supabase';
import { Loader2, WifiOff, Mail, Lock, User, KeyRound } from 'lucide-react';
import { cn } from '../utils/cn';

const GOLD = '#D4AF37';
const GOLD_DIM = 'rgba(212,175,55,0.25)';
const GOLD_GLOW = 'rgba(212,175,55,0.15)';

const GoldDivider = () => (
  <div className="flex items-center gap-2 my-3">
    <div className="flex-1 h-px" style={{ background: `linear-gradient(to right, transparent, ${GOLD_DIM})` }} />
    <div className="w-1 h-1 rotate-45 flex-shrink-0" style={{ background: GOLD, opacity: 0.6 }} />
    <div className="flex-1 h-px" style={{ background: `linear-gradient(to left, transparent, ${GOLD_DIM})` }} />
  </div>
);

export default function AuthScreenMockup() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [betaCode, setBetaCode] = useState('');
  const [devClickCount, setDevClickCount] = useState(0);
  const setAuth = useGameStore((state) => state.setAuth);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const timeout = (ms: number) => new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Network timeout: Supabase might be blocked by your network. Please check your connection or use a VPN.')), ms)
      );

      if (isLogin) {
        const loginPromise = supabase.auth.signInWithPassword({ email, password });
        const { data, error } = await Promise.race([loginPromise, timeout(15000)]) as any;
        if (error) throw error;

        const { data: profile } = await supabase
          .from('profiles').select('*').eq('id', data.user.id).single();

        setAuth(data.user, profile);
      } else {
        if (!username.trim()) throw new Error('Username is required');
        if (betaCode.trim().toLowerCase() !== 'dagong') throw new Error('内测码不正确 / Invalid beta code');

        const signUpPromise = supabase.auth.signUp({ email, password });
        const { data, error } = await Promise.race([signUpPromise, timeout(15000)]) as any;
        if (error) throw error;

        if (data?.user) {
          if (!data.session) {
            setError('Account created! Please check your email to verify your account.');
            setLoading(false);
            return;
          }

          const { error: profileError } = await supabase
            .from('profiles').insert([{ id: data.user.id, username: username.trim() }]);
          if (profileError) console.error('Profile creation error:', profileError);

          setAuth(data.user, { id: data.user.id, username: username.trim(), wins: 0, losses: 0, total_games: 0 });
        }
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      const errMessage = err?.message || '';
      if (errMessage.includes('Network timeout') || errMessage.includes('Failed to fetch')) {
        recreateSupabaseClient();
      }
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">

      {/* ── Background layers ── */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat scale-105"
        style={{ backgroundImage: 'url(/avalon-bg-mobile.png)', filter: 'brightness(0.83)' }}
      />
      {/* Vignette */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at 50% 35%, transparent 20%, rgba(0,0,0,0.65) 70%, rgba(0,0,0,0.92) 100%)' }}
      />
      {/* Bottom fade */}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.7) 80%, rgba(0,0,0,0.97) 100%)' }}
      />
      {/* Ambient gold center glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(ellipse 60% 40% at 50% 38%, ${GOLD_GLOW} 0%, transparent 100%)` }}
      />

      {/* ── Content ── */}
      <div className="w-full max-w-[340px] relative z-10">

        {/* Logo block */}
        <div className="text-center mb-7">
          <button
            type="button"
            className="mx-auto mb-5 block relative"
            style={{ width: 88, height: 88 }}
            onClick={() => setDevClickCount(c => c + 1)}
          >
            {/* Pulse ring */}
            <span
              className="absolute inset-0 rounded-[18px] animate-pulse"
              style={{ boxShadow: `0 0 0 1px ${GOLD_DIM}, 0 0 24px ${GOLD_GLOW}` }}
            />
            <img
              src="/avalon-logo.png"
              alt="Avalon"
              className="w-full h-full object-cover rounded-[18px]"
              style={{ border: `1px solid ${GOLD_DIM}`, boxShadow: `0 8px 32px rgba(0,0,0,0.7)` }}
            />
          </button>

          <h1
            className="font-serif font-bold tracking-[0.18em]"
            style={{ fontSize: 28, color: GOLD, textShadow: `0 0 28px rgba(212,175,55,0.45), 0 2px 4px rgba(0,0,0,0.8)` }}
          >
            AVALON
          </h1>
          <p
            className="tracking-[0.45em] font-light"
            style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 4, letterSpacing: '0.42em' }}
          >
            阿  瓦  隆
          </p>

          <GoldDivider />

          <p
            className="uppercase tracking-widest"
            style={{ fontSize: 9, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.22em' }}
          >
            The Truth Is Hidden In The Mist
          </p>
        </div>

        {/* ── Card ── */}
        <div
          className="avalon-glass-strong"
          style={{
            borderRadius: 16,
            padding: '22px 24px 26px',
          }}
        >
          {/* Tabs */}
          <div className="flex mb-5" style={{ borderBottom: `1px solid rgba(212,175,55,0.12)` }}>
            {(['Sign In', 'Sign Up'] as const).map((tab, i) => {
              const active = isLogin === (i === 0);
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => { setIsLogin(i === 0); setError(null); }}
                  className="flex-1 pb-3 transition-all duration-200"
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    color: active ? GOLD : 'rgba(255,255,255,0.3)',
                    borderTop: 'none',
                    borderLeft: 'none',
                    borderRight: 'none',
                    borderBottom: active ? `1px solid ${GOLD}` : '1px solid transparent',
                    marginBottom: -1,
                    textShadow: active ? `0 0 12px rgba(212,175,55,0.5)` : 'none',
                    background: 'none',
                    cursor: 'pointer',
                  } as React.CSSProperties}
                >
                  {tab}
                </button>
              );
            })}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Error */}
            {error && (
              <div
                className="text-center text-xs leading-relaxed"
                style={{
                  padding: '10px 14px',
                  background: 'rgba(120,20,20,0.4)',
                  border: '1px solid rgba(200,50,50,0.4)',
                  borderRadius: 8,
                  color: '#f87171',
                }}
              >
                {error}
              </div>
            )}

            {!isLogin && (
              <>
                <PremiumField label="玩家名称 · Username" icon={<User size={14} />}>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Merlin123"
                    required={!isLogin}
                    style={inputStyle}
                  />
                </PremiumField>
                <PremiumField label="内测码 · Beta Code" icon={<KeyRound size={14} />}>
                  <input
                    type="text"
                    value={betaCode}
                    onChange={(e) => setBetaCode(e.target.value)}
                    placeholder="Enter beta code"
                    required={!isLogin}
                    style={inputStyle}
                  />
                </PremiumField>
              </>
            )}

            <PremiumField label="邮箱 · Email" icon={<Mail size={14} />}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="player@example.com"
                required
                style={inputStyle}
              />
            </PremiumField>

            <PremiumField label="密码 · Password" icon={<Lock size={14} />}>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                style={inputStyle}
              />
            </PremiumField>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                marginTop: 6,
                padding: '13px',
                borderRadius: 10,
                background: loading
                  ? `rgba(212,175,55,0.5)`
                  : `linear-gradient(135deg, #b8922d 0%, ${GOLD} 45%, #c9a030 100%)`,
                boxShadow: loading ? 'none' : `0 4px 20px rgba(212,175,55,0.28), 0 2px 4px rgba(0,0,0,0.4)`,
                color: '#1c1000',
                fontWeight: 700,
                fontSize: 12,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading
                ? <><Loader2 className="animate-spin" size={15} /> <span>进入中…</span></>
                : isLogin ? '⚔ Enter the Realm' : '⚜ Join the Order'}
            </button>
          </form>
        </div>

        {/* Developer Mode (same as original) */}
        {import.meta.env.DEV && devClickCount >= 5 && (
          <div
            className="mt-4 space-y-3 animate-in fade-in slide-in-from-top-4 duration-300 avalon-glass-strong"
            style={{
              borderRadius: 16,
              padding: '16px',
            }}
          >
            <p className="text-center uppercase tracking-widest" style={{ fontSize: 10, color: 'rgba(212,175,55,0.5)' }}>
              Developer Mode
            </p>
            <div>
              <label className="block mb-1.5 uppercase tracking-widest" style={{ fontSize: 9, color: 'rgba(212,175,55,0.4)' }}>
                Force Role (Host Only)
              </label>
              <select
                onChange={(e) => useGameStore.getState().setDevRequestedRole(e.target.value as any || undefined)}
                style={{ ...inputStyle, paddingLeft: 12 }}
                className="w-full"
              >
                <option value="">Random (Default)</option>
                <option value="Merlin">Merlin</option>
                <option value="Assassin">Assassin</option>
                <option value="Percival">Percival</option>
                <option value="Morgana">Morgana</option>
                <option value="Oberon">Oberon</option>
                <option value="Mordred">Mordred</option>
                <option value="Loyal Servant">Loyal Servant</option>
                <option value="Minion">Minion</option>
              </select>
            </div>
            <button
              type="button"
              onClick={() => {
                const mockUserId = `offline_${Math.random().toString(36).substring(2, 9)}`;
                const mockUsername = username.trim() || `Player_${Math.floor(Math.random() * 1000)}`;
                setAuth(
                  { id: mockUserId } as any,
                  { id: mockUserId, username: mockUsername, wins: 0, losses: 0, total_games: 0 }
                );
              }}
              className="w-full flex items-center justify-center gap-2 transition-colors"
              style={{
                padding: '10px',
                borderRadius: 8,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.5)',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <WifiOff size={14} />
              Play Offline
            </button>
          </div>
        )}

        {/* Footer */}
        <p
          className="text-center mt-6 tracking-widest"
          style={{ fontSize: 9, color: 'rgba(255,255,255,0.18)', letterSpacing: '0.15em' }}
        >
          全球百万玩家的选择 · 经典 · 策略 · 社交
        </p>
        <p className="text-center mt-1.5" style={{ fontSize: 9, color: 'rgba(255,255,255,0.12)' }}>
          v{__APP_VERSION__}
        </p>
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'linear-gradient(135deg, rgba(255,255,255,0.07), rgba(0,0,0,0.46)), rgba(0,0,0,0.46)',
  backdropFilter: 'blur(14px) saturate(1.2)',
  WebkitBackdropFilter: 'blur(14px) saturate(1.2)',
  border: '1px solid rgba(212,175,55,0.24)',
  borderRadius: 9,
  padding: '11px 12px 11px 36px',
  color: 'rgba(255,255,255,0.88)',
  fontSize: 16,
  outline: 'none',
  transition: 'border-color 0.15s, box-shadow 0.15s',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 18px rgba(0,0,0,0.18)',
};

function PremiumField({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <div>
      <label
        className="block mb-1.5 uppercase tracking-widest"
        style={{ fontSize: 9, color: focused ? 'rgba(212,175,55,0.7)' : 'rgba(255,255,255,0.3)', transition: 'color 0.15s' }}
      >
        {label}
      </label>
      <div
        className="relative"
        onFocusCapture={() => setFocused(true)}
        onBlurCapture={() => setFocused(false)}
      >
        <span
          className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: focused ? 'rgba(212,175,55,0.65)' : 'rgba(255,255,255,0.22)', transition: 'color 0.15s' }}
        >
          {icon}
        </span>
        {React.cloneElement(children as React.ReactElement<any>, {
          style: {
            ...inputStyle,
            borderColor: focused ? 'rgba(212,175,55,0.55)' : 'rgba(212,175,55,0.18)',
            boxShadow: focused ? '0 0 0 3px rgba(212,175,55,0.07), inset 0 1px 2px rgba(0,0,0,0.3)' : 'inset 0 1px 2px rgba(0,0,0,0.3)',
          } as React.CSSProperties,
        })}
      </div>
    </div>
  );
}
