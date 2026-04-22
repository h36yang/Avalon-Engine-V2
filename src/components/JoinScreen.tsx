import { useState, useEffect } from "react";
import { useGameStore } from "../store";
import { KeyRound, User, Users, LogOut, Trophy, Swords, RefreshCw, Crown, Loader2 } from "lucide-react";
import { useTranslation } from "../utils/i18n";
import { supabase } from "../utils/supabase";
import { cn } from "../utils/cn";

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

  const handleJoin = (e: React.SubmitEvent) => {
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

  const inputClass = "w-full bg-black/30 border border-white/8 rounded-xl px-4 py-3 text-zinc-100 placeholder:text-zinc-700 focus:outline-none focus:border-zinc-600 focus:bg-black/50 transition-all text-sm";
  const labelClass = "block text-[11px] font-semibold text-zinc-500 uppercase tracking-widest mb-2";

  return (
    <div className="min-h-screen text-zinc-50 flex items-center justify-center p-4 relative overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: 'url(/join-bg.jpg)' }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/80 via-zinc-950/88 to-zinc-950" />

      {/* Sign Out */}
      <button
        onClick={handleLogout}
        className="absolute top-4 left-4 z-50 flex items-center gap-2 px-3 py-2 bg-zinc-900/70 hover:bg-zinc-900 border border-zinc-800/60 hover:border-zinc-700 text-zinc-500 hover:text-zinc-300 rounded-xl backdrop-blur-md transition-all text-sm font-medium"
      >
        <LogOut size={15} />
        <span className="hidden sm:block">{t("Sign Out")}</span>
      </button>

      <div className="w-full max-w-sm relative z-10 space-y-3">

        {/* Profile Card */}
        {profile && (
          <div className="bg-zinc-900/70 backdrop-blur-xl border border-zinc-800/60 rounded-2xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-zinc-800 border border-zinc-700 rounded-full flex items-center justify-center text-zinc-300 font-bold text-sm shrink-0">
                {profile.username.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-zinc-100 text-sm">{profile.username}</p>
                <p className="text-zinc-600 text-xs">Player Profile</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 border-t border-zinc-800/60 pt-3">
              <div className="text-center">
                <p className="text-lg font-bold text-zinc-100">{profile.total_games}</p>
                <p className="text-[11px] font-semibold text-zinc-600 uppercase tracking-wider flex items-center justify-center gap-1 mt-0.5">
                  <Swords size={10} /> Games
                </p>
              </div>
              <div className="text-center border-l border-zinc-800/60">
                <p className={cn("text-lg font-bold", winRate >= 50 ? "text-emerald-400" : "text-zinc-400")}>
                  {winRate}%
                </p>
                <p className="text-[11px] font-semibold text-zinc-600 uppercase tracking-wider flex items-center justify-center gap-1 mt-0.5">
                  <Trophy size={10} /> Win Rate
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Main Card */}
        <div className="bg-zinc-900/70 backdrop-blur-xl border border-zinc-800/60 rounded-2xl p-5 shadow-2xl">
          {/* Header */}
          <div className="text-center mb-5">
            <h1 className="text-3xl font-serif font-bold tracking-tight text-zinc-50">
              Avalon
            </h1>
            <p className="text-zinc-500 text-xs uppercase tracking-[0.25em] font-semibold mt-1">
              {t("A Game of Hidden Loyalty")}
            </p>
          </div>

          {error && (
            <div className="bg-red-950/40 border border-red-800/50 text-red-400 p-3 rounded-xl mb-4 text-xs text-center">
              {error}
            </div>
          )}

          {/* Tabs */}
          <div className="flex border-b border-zinc-800 mb-5">
            <button
              onClick={() => setActiveTab('join')}
              className={cn(
                "flex-1 pb-3 text-sm font-semibold transition-colors",
                activeTab === 'join'
                  ? "text-zinc-50 border-b-2 border-zinc-50 -mb-px"
                  : "text-zinc-500 hover:text-zinc-400"
              )}
            >
              {t("Join Room")}
            </button>
            <button
              onClick={() => setActiveTab('browse')}
              className={cn(
                "flex-1 pb-3 text-sm font-semibold transition-colors",
                activeTab === 'browse'
                  ? "text-zinc-50 border-b-2 border-zinc-50 -mb-px"
                  : "text-zinc-500 hover:text-zinc-400"
              )}
            >
              {t("Browse Rooms")}
            </button>
          </div>

          {activeTab === 'join' ? (
            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className={labelClass}>{t("Room Code")}</label>
                <div className="relative">
                  <Users size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600" />
                  <input
                    type="text"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    className={cn(inputClass, "pl-10 font-mono uppercase tracking-widest text-base")}
                    placeholder="ABCD"
                    maxLength={6}
                    required
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>{t("Your Identity")}</label>
                <div className="relative">
                  <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={cn(inputClass, "pl-10")}
                    placeholder={t("Enter your name")}
                    maxLength={15}
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-zinc-50 hover:bg-white text-zinc-950 rounded-xl py-3 text-sm font-bold transition-all flex items-center justify-center gap-2 mt-1 shadow-lg"
              >
                <KeyRound size={16} />
                {t("Join Room")}
              </button>
            </form>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">{t("Available Rooms")}</p>
                <button
                  onClick={handleRefresh}
                  disabled={loadingRooms}
                  className="p-1.5 text-zinc-500 hover:text-zinc-300 transition-colors rounded-lg hover:bg-zinc-800"
                >
                  <RefreshCw size={13} className={loadingRooms ? 'animate-spin' : ''} />
                </button>
              </div>

              {loadingRooms ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 size={22} className="animate-spin text-zinc-600" />
                </div>
              ) : availableRooms.length === 0 ? (
                <div className="text-center py-10 space-y-2">
                  <Users size={28} className="mx-auto text-zinc-700" />
                  <p className="text-sm text-zinc-500">{t("No rooms available")}</p>
                  <p className="text-xs text-zinc-700">{t("Create one from the Join tab")}</p>
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
                        className={cn(
                          "w-full flex items-center justify-between p-3.5 rounded-xl border transition-all text-left",
                          isWaiting
                            ? "bg-zinc-900/80 border-zinc-800 hover:border-zinc-600 hover:bg-zinc-800/60 cursor-pointer"
                            : "bg-zinc-900/40 border-zinc-800/40 opacity-40 cursor-not-allowed"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-zinc-800 border border-zinc-700 rounded-lg flex items-center justify-center shrink-0">
                            <Crown size={14} className="text-zinc-400" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-zinc-100 font-mono tracking-wider">{room.id}</p>
                            <p className="text-xs text-zinc-500 mt-0.5">{room.hostName}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2.5 shrink-0">
                          <span className="text-xs text-zinc-500 font-mono">
                            {room.playerCount}/{room.maxPlayers}
                          </span>
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider",
                            isWaiting
                              ? "bg-emerald-950/60 text-emerald-400 border border-emerald-800/40"
                              : "bg-zinc-800 text-zinc-500"
                          )}>
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

        <p className="text-center text-zinc-700 text-xs font-serif italic">
          "The truth is hidden in the mist."
        </p>
      </div>
    </div>
  );
}
