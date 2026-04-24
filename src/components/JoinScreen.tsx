import { useState, useEffect } from "react";
import { useGameStore } from "../store";
import { KeyRound, User, Users, LogOut, Trophy, Swords, RefreshCw, Crown, Loader2 } from "lucide-react";
import { useTranslation } from "../utils/i18n";
import { supabase } from "../utils/supabase";
import { cn } from "../utils/cn";

const GOLD = '#D4AF37';
const GOLD_DIM = 'rgba(212,175,55,0.25)';
const GOLD_GLOW = 'rgba(212,175,55,0.12)';

export default function JoinScreen() {
  const [roomId, setRoomId] = useState("");
  const [name, setName] = useState(useGameStore(state => state.name) || "");
  const [activeTab, setActiveTab] = useState<'join' | 'browse'>('join');
  const [loadingRooms, setLoadingRooms] = useState(false);
  const connect = useGameStore((state) => state.connect);
  const error = useGameStore((state) => state.error);
  const profile = useGameStore((state) => state.profile);
  const logout = useGameStore((state) => state.logout);
  const availableRooms = useGameStore((state) => state.availableRooms);
  const fetchRooms = useGameStore((state) => state.fetchRooms);
  const { t } = useTranslation();

  useEffect(() => {
    if (activeTab === 'browse') handleRefresh();
  }, [activeTab]);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomId && name) connect(roomId.toUpperCase(), name);
  };

  const handleJoinRoom = (id: string) => {
    const playerName = name || profile?.username || `Player_${Math.floor(Math.random() * 1000)}`;
    connect(id, playerName);
  };

  const handleRefresh = async () => {
    setLoadingRooms(true);
    await fetchRooms();
    setLoadingRooms(false);
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      console.log('Sign out from Supabase failed, proceeding with local logout');
    }
    logout();
  };

  const winRate = profile?.total_games ? Math.round((profile.wins / profile.total_games) * 100) : 0;

  const cardStyle: React.CSSProperties = {
    background: 'rgba(6, 4, 2, 0.84)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    border: `1px solid ${GOLD_DIM}`,
    borderRadius: 16,
    boxShadow: `0 0 0 1px rgba(0,0,0,0.5), 0 24px 64px rgba(0,0,0,0.75), inset 0 1px 0 rgba(212,175,55,0.1)`,
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'rgba(0,0,0,0.55)',
    border: `1px solid rgba(212,175,55,0.18)`,
    borderRadius: 9,
    padding: '11px 12px 11px 36px',
    color: 'rgba(255,255,255,0.88)',
    fontSize: 13,
    outline: 'none',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: 6,
    fontSize: 9,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.2em',
    color: 'rgba(212,175,55,0.5)',
  };

  return (
    <div className="min-h-screen text-zinc-50 flex items-center justify-center p-4 relative overflow-hidden">

      {/* ── Background ── */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat scale-105"
        style={{ backgroundImage: 'url(/join-bg.jpg)', filter: 'brightness(0.5)' }}
      />
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 35%, transparent 20%, rgba(0,0,0,0.65) 70%, rgba(0,0,0,0.92) 100%)' }} />
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.7) 80%, rgba(0,0,0,0.97) 100%)' }} />
      <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse 60% 40% at 50% 38%, ${GOLD_GLOW} 0%, transparent 100%)` }} />

      {/* ── Sign Out ── */}
      <button
        onClick={handleLogout}
        className="absolute top-4 left-4 z-50 flex items-center gap-2 px-3 py-2 backdrop-blur-md transition-all text-sm font-medium"
        style={{
          background: 'rgba(0,0,0,0.5)',
          border: `1px solid rgba(212,175,55,0.18)`,
          borderRadius: 10,
          color: 'rgba(255,255,255,0.4)',
        }}
      >
        <LogOut size={14} />
        <span className="hidden sm:block">{t("Sign Out")}</span>
      </button>

      <div className="w-full max-w-sm relative z-10 space-y-3">

        {/* ── Profile Card ── */}
        {profile && (
          <div style={{ ...cardStyle, padding: '16px' }}>
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
                style={{ border: `1.5px solid rgba(212,175,55,0.45)`, background: 'rgba(212,175,55,0.08)', color: GOLD }}
              >
                {profile.username.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-sm" style={{ color: 'rgba(255,255,255,0.9)' }}>{profile.username}</p>
                <p style={{ fontSize: 10, color: 'rgba(212,175,55,0.4)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Player Profile</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-3" style={{ borderTop: `1px solid rgba(212,175,55,0.1)` }}>
              <div className="text-center">
                <p className="text-lg font-bold" style={{ color: 'rgba(255,255,255,0.9)' }}>{profile.total_games}</p>
                <p className="flex items-center justify-center gap-1 mt-0.5" style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  <Swords size={10} /> Games
                </p>
              </div>
              <div className="text-center" style={{ borderLeft: `1px solid rgba(212,175,55,0.1)` }}>
                <p className="text-lg font-bold" style={{ color: winRate >= 50 ? GOLD : 'rgba(255,255,255,0.4)' }}>
                  {winRate}%
                </p>
                <p className="flex items-center justify-center gap-1 mt-0.5" style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  <Trophy size={10} /> Win Rate
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Main Card ── */}
        <div style={{ ...cardStyle, padding: '22px 24px 26px' }}>

          {/* Title */}
          <div className="text-center mb-5">
            <h1
              className="font-serif font-bold tracking-[0.18em]"
              style={{ fontSize: 26, color: GOLD, textShadow: `0 0 28px rgba(212,175,55,0.4), 0 2px 4px rgba(0,0,0,0.8)` }}
            >
              AVALON
            </h1>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.28em', textTransform: 'uppercase', marginTop: 4 }}>
              {t("A Game of Hidden Loyalty")}
            </p>
          </div>

          {error && (
            <div className="text-center text-xs leading-relaxed mb-4" style={{
              padding: '10px 14px',
              background: 'rgba(120,20,20,0.4)',
              border: '1px solid rgba(200,50,50,0.4)',
              borderRadius: 8,
              color: '#f87171',
            }}>
              {error}
            </div>
          )}

          {/* Tabs */}
          <div className="flex mb-5" style={{ borderBottom: `1px solid rgba(212,175,55,0.12)` }}>
            {([['join', t("Join Room")], ['browse', t("Browse Rooms")]] as const).map(([tab, label]) => {
              const active = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="flex-1 pb-3 transition-all duration-200"
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                    color: active ? GOLD : 'rgba(255,255,255,0.3)',
                    borderTop: 'none', borderLeft: 'none', borderRight: 'none',
                    borderBottom: active ? `1px solid ${GOLD}` : '1px solid transparent',
                    marginBottom: -1,
                    textShadow: active ? `0 0 12px rgba(212,175,55,0.5)` : 'none',
                    background: 'none',
                    cursor: 'pointer',
                  } as React.CSSProperties}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {activeTab === 'join' ? (
            <form onSubmit={handleJoin} className="space-y-4">

              {/* Room Code */}
              <div>
                <label style={labelStyle}>{t("Room Code")}</label>
                <div className="relative">
                  <Users
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    style={{ color: 'rgba(212,175,55,0.45)' }}
                  />
                  <input
                    type="text"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    style={{
                      ...inputStyle,
                      fontFamily: 'monospace',
                      fontSize: 20,
                      letterSpacing: '0.45em',
                      textTransform: 'uppercase',
                      paddingLeft: 36,
                      paddingTop: 13,
                      paddingBottom: 13,
                    }}
                    placeholder="ABCD"
                    maxLength={6}
                    required
                  />
                </div>
              </div>

              {/* Player Name */}
              <div>
                <label style={labelStyle}>{t("Your Identity")}</label>
                <div className="relative">
                  <User
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    style={{ color: 'rgba(212,175,55,0.45)' }}
                  />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={inputStyle}
                    placeholder={t("Enter your name")}
                    maxLength={15}
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 transition-all duration-200"
                style={{
                  marginTop: 6,
                  padding: '13px',
                  borderRadius: 10,
                  background: `linear-gradient(135deg, #b8922d 0%, ${GOLD} 45%, #c9a030 100%)`,
                  boxShadow: `0 4px 20px rgba(212,175,55,0.28), 0 2px 4px rgba(0,0,0,0.4)`,
                  color: '#1c1000',
                  fontWeight: 700,
                  fontSize: 12,
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <KeyRound size={14} />
                {t("Join Room")}
              </button>
            </form>

          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p style={{ fontSize: 10, fontWeight: 600, color: 'rgba(212,175,55,0.5)', textTransform: 'uppercase', letterSpacing: '0.18em' }}>
                  {t("Available Rooms")}
                </p>
                <button
                  onClick={handleRefresh}
                  disabled={loadingRooms}
                  className="p-1.5 rounded-lg transition-colors"
                  style={{ color: 'rgba(212,175,55,0.4)', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  <RefreshCw size={13} className={loadingRooms ? 'animate-spin' : ''} />
                </button>
              </div>

              {loadingRooms ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 size={22} className="animate-spin" style={{ color: 'rgba(212,175,55,0.4)' }} />
                </div>
              ) : availableRooms.length === 0 ? (
                <div className="text-center py-10 space-y-2">
                  <Users size={26} className="mx-auto" style={{ color: 'rgba(212,175,55,0.2)' }} />
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>{t("No rooms available")}</p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>{t("Create one from the Join tab")}</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[280px] overflow-y-auto pr-0.5">
                  {availableRooms.map((room) => {
                    const isWaiting = room.status === 'waiting';
                    return (
                      <button
                        key={room.id}
                        onClick={() => isWaiting && handleJoinRoom(room.id)}
                        disabled={!isWaiting}
                        className="w-full flex items-center justify-between text-left transition-all duration-150"
                        style={{
                          padding: '12px 14px',
                          borderRadius: 10,
                          background: isWaiting ? 'rgba(212,175,55,0.04)' : 'rgba(0,0,0,0.2)',
                          border: isWaiting ? `1px solid rgba(212,175,55,0.2)` : `1px solid rgba(255,255,255,0.05)`,
                          opacity: isWaiting ? 1 : 0.4,
                          cursor: isWaiting ? 'pointer' : 'not-allowed',
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                            style={{ background: 'rgba(212,175,55,0.08)', border: `1px solid rgba(212,175,55,0.2)` }}
                          >
                            <Crown size={13} style={{ color: GOLD }} />
                          </div>
                          <div>
                            <p className="font-mono font-bold" style={{ fontSize: 14, color: isWaiting ? GOLD : 'rgba(255,255,255,0.5)', letterSpacing: '0.1em' }}>
                              {room.id}
                            </p>
                            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>{room.hostName}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2.5 shrink-0">
                          <span className="font-mono" style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                            {room.playerCount}/{room.maxPlayers}
                          </span>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: 999,
                            fontSize: 9,
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.1em',
                            background: isWaiting ? 'rgba(212,175,55,0.1)' : 'rgba(255,255,255,0.05)',
                            border: isWaiting ? `1px solid rgba(212,175,55,0.3)` : '1px solid rgba(255,255,255,0.08)',
                            color: isWaiting ? GOLD : 'rgba(255,255,255,0.3)',
                          }}>
                            {isWaiting ? t("Waiting") : t("In Game")}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer quote */}
        <p className="text-center font-serif italic" style={{ fontSize: 12, color: 'rgba(212,175,55,0.28)' }}>
          "The truth is hidden in the mist."
        </p>
      </div>
    </div>
  );
}
