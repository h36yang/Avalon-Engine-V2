import { useState, useEffect } from "react";
import { useGameStore } from "../store";
import { ROLE_IMAGES } from "../assets/roleImages";
import { useTranslation } from "../utils/i18n";
import { Role } from "../utils/sharedTypes";
import { Swords, ShieldAlert, Check } from "lucide-react";

export default function StartingCountdownScreen() {
  const room = useGameStore((state) => state.room);
  const sessionId = useGameStore((state) => state.sessionId);
  const chooseEvilRole = useGameStore((state) => state.chooseEvilRole);
  const { t } = useTranslation();

  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 100);
    return () => clearInterval(timer);
  }, []);

  if (!room) return null;

  const remainingSeconds = room.startingCountdownEnd
    ? Math.max(0, Math.ceil((room.startingCountdownEnd - now) / 1000))
    : 10;

  const isChooser = Boolean(room.evilChooserSessionId && room.evilChooserSessionId === sessionId);
  const me = room.players.find((p) => p.sessionId === sessionId);
  const myRole = me?.role;

  // View A: Non-chooser standard countdown
  if (!isChooser) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col items-center justify-center px-5 py-12 relative overflow-hidden select-none">
        {/* Background ambient lighting */}
        <div className="absolute inset-0 bg-radial from-amber-500/5 via-transparent to-transparent pointer-events-none" />

        <div className="w-full max-w-sm space-y-8 text-center relative z-10 animate-in fade-in duration-500">
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full border border-amber-600/30 bg-amber-950/20 flex items-center justify-center shadow-lg shadow-amber-950/20 backdrop-blur-sm">
              <Swords className="w-10 h-10 text-amber-500 animate-pulse" />
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-[12px] font-semibold text-zinc-500 uppercase tracking-widest">
              {t("Preparing the battlefield...")}
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
              {t("The game is starting in")}
            </h1>
          </div>

          {/* Large Countdown Badge */}
          <div className="flex items-center justify-center">
            <div className="relative flex items-center justify-center w-28 h-28 rounded-full border-2 border-amber-500/40 bg-zinc-900/80 shadow-2xl shadow-amber-950/40">
              <span className="text-5xl font-black font-mono tracking-tighter text-amber-400">
                {remainingSeconds}
              </span>
              <span className="absolute bottom-3 text-xs font-bold text-amber-500/70 uppercase">
                {t("s")}
              </span>
            </div>
          </div>

          <p className="text-xs text-zinc-500">
            {t("Keep this secret from others")}
          </p>
        </div>
      </div>
    );
  }

  // View B: Lone Evil Operative Role Selection
  const availableRoles = room.availableEvilRoles || (myRole ? [myRole] : []);
  let selectedRole = myRole;

  function selectRole(role: Role) {
    selectedRole = role;
    chooseEvilRole(role);
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col items-center justify-center px-4 py-8 relative overflow-hidden select-none">
      {/* Background ambient red glow */}
      <div className="absolute inset-0 bg-radial from-red-950/30 via-zinc-950 to-zinc-950 pointer-events-none" />

      <div className="w-full max-w-md space-y-6 text-center relative z-10 animate-in fade-in duration-500">
        {/* Header with timer badge */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-red-500/30 bg-red-950/40 text-red-400 text-xs font-bold tracking-wide">
            <ShieldAlert size={14} className="text-red-400" />
            <span>{t("Locks in:")} {remainingSeconds}{t("s")}</span>
          </div>

          <h1 className="text-2xl font-serif font-bold tracking-tight text-red-200">
            {t("Lone Evil Operative")}
          </h1>
          <p className="text-xs text-zinc-400 max-w-xs mx-auto leading-relaxed">
            {t("All other evil players are bots. You can choose a different evil role:")}
          </p>
        </div>

        {/* Roles Grid */}
        <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto">
          {availableRoles.map((role) => {
            const imageUrl = ROLE_IMAGES[role] || ROLE_IMAGES["CardBack"];

            return (
              <button
                key={role}
                type="button"
                onClick={() => selectRole(role)}
                className={`relative group rounded-xl overflow-hidden border transition-all duration-200 text-left flex flex-col aspect-[3/4] p-2.5 justify-between ${
                  selectedRole === role
                    ? "border-red-500 ring-2 ring-red-500/50 shadow-lg shadow-red-950/60 scale-102"
                    : "border-zinc-800 hover:border-zinc-700 bg-zinc-900/50 hover:bg-zinc-900 opacity-75 hover:opacity-100"
                }`}
              >
                {/* Background Role Art */}
                <div
                  className="absolute inset-0 bg-cover bg-center transition-transform duration-300 group-hover:scale-105"
                  style={{ backgroundImage: `url(${imageUrl})` }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />

                {/* Badge top */}
                <div className="relative z-10 flex justify-end">
                  {selectedRole === role && (
                    <span className="flex items-center gap-1 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow">
                      <Check size={11} strokeWidth={3} />
                      {t("Selected")}
                    </span>
                  )}
                </div>

                {/* Role Name bottom */}
                <div className="relative z-10">
                  <h3 className="font-serif font-bold text-base text-zinc-100 drop-shadow">
                    {t(role)}
                  </h3>
                  <p className="text-[10px] text-zinc-400 uppercase tracking-wider">
                    {selectedRole === role ? t("Current Role") : t("Switch Role")}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <p className="text-[11px] text-zinc-500">
          {t("The game is starting in")} {remainingSeconds}{t("s")}
        </p>
      </div>
    </div>
  );
}
