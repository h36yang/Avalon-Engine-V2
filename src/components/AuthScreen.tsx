import React, { useState } from 'react';
import { useGameStore } from '../store';
import { supabase, recreateSupabaseClient } from '../utils/supabase';
import { Loader2, WifiOff, Mail, Lock, User, KeyRound } from 'lucide-react';
import { cn } from '../utils/cn';

export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [betaCode, setBetaCode] = useState('');
  const [devClickCount, setDevClickCount] = useState(0);
  const setAuth = useGameStore((state) => state.setAuth);

  const handleSubmit = async (e: React.SubmitEvent) => {
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
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();

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
            .from('profiles')
            .insert([{ id: data.user.id, username: username.trim() }]);

          if (profileError) console.error("Profile creation error:", profileError);

          setAuth(data.user, { id: data.user.id, username: username.trim(), wins: 0, losses: 0, total_games: 0 });
        }
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      const errMessage = err?.message || '';
      if (errMessage.includes('Network timeout') || errMessage.includes('Failed to fetch')) {
        recreateSupabaseClient();
      }
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full bg-zinc-900/80 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 focus:bg-zinc-900 transition-all text-sm";
  const labelClass = "block text-[11px] font-semibold text-zinc-500 uppercase tracking-widest mb-2";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-zinc-50 relative overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: 'url(/avalon-bg.jpg)' }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/75 via-zinc-950/85 to-zinc-950" />

      <div className="w-full max-w-sm relative z-10">
        {/* Logo */}
        <div className="text-center mb-10">
          <button
            type="button"
            className="w-24 h-24 rounded-2xl overflow-hidden mx-auto mb-5 block ring-1 ring-white/10 shadow-2xl"
            onClick={() => setDevClickCount(prev => prev + 1)}
          >
            <img src="/avalon-logo.png" alt="Avalon Online" className="w-full h-full object-cover" />
          </button>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-50">Avalon Online</h1>
          <p className="text-zinc-500 mt-1.5 text-sm">A Game of Hidden Loyalty</p>
        </div>

        {/* Form Card */}
        <div className="bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/60 rounded-2xl p-6 shadow-2xl">
          {/* Tab Toggle */}
          <div className="flex border-b border-zinc-800 mb-6">
            <button
              type="button"
              onClick={() => { setIsLogin(true); setError(null); }}
              className={cn(
                "flex-1 pb-3 text-sm font-semibold transition-colors",
                isLogin
                  ? "text-zinc-50 border-b-2 border-zinc-50 -mb-px"
                  : "text-zinc-500 hover:text-zinc-400"
              )}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setIsLogin(false); setError(null); }}
              className={cn(
                "flex-1 pb-3 text-sm font-semibold transition-colors",
                !isLogin
                  ? "text-zinc-50 border-b-2 border-zinc-50 -mb-px"
                  : "text-zinc-500 hover:text-zinc-400"
              )}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-950/50 border border-red-800/60 text-red-400 rounded-xl text-xs text-center leading-relaxed">
                {error}
              </div>
            )}

            {!isLogin && (
              <>
                <div>
                  <label className={labelClass}>Username</label>
                  <div className="relative">
                    <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className={cn(inputClass, "pl-10")}
                      placeholder="Merlin123"
                      required={!isLogin}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>内测码 / Beta Code</label>
                  <div className="relative">
                    <KeyRound size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600" />
                    <input
                      type="text"
                      value={betaCode}
                      onChange={(e) => setBetaCode(e.target.value)}
                      className={cn(inputClass, "pl-10")}
                      placeholder="Enter beta code"
                      required={!isLogin}
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className={labelClass}>Email</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={cn(inputClass, "pl-10")}
                  placeholder="player@example.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={cn(inputClass, "pl-10")}
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-zinc-50 hover:bg-white text-zinc-950 rounded-xl py-3 text-sm font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed mt-2 shadow-lg"
            >
              {loading
                ? <><Loader2 className="animate-spin" size={16} /> Processing...</>
                : isLogin ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>

        {/* Developer Mode */}
        {import.meta.env.DEV && devClickCount >= 5 && (
          <div className="mt-4 bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/60 rounded-2xl p-4 space-y-3 animate-in fade-in slide-in-from-top-4 duration-300">
            <p className="text-[11px] font-semibold text-zinc-600 uppercase tracking-widest text-center">Developer Mode</p>
            <div>
              <label className={labelClass}>Force Role (Host Only)</label>
              <select
                onChange={(e) => useGameStore.getState().setDevRequestedRole(e.target.value as any || undefined)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-300 focus:outline-none focus:border-zinc-600"
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
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 rounded-xl py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              <WifiOff size={15} />
              Play Offline
            </button>
          </div>
        )}

        <p className="text-center text-zinc-700 text-xs mt-6">v{__APP_VERSION__}</p>
      </div>
    </div>
  );
}
