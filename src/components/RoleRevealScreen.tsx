import { useState } from "react";
import { useGameStore } from "../store";
import { EyeOff, Play } from "lucide-react";
import { ROLE_IMAGES } from "../assets/roleImages";
import { useTranslation } from "../utils/i18n";
import { EVIL_ROLES, Role } from "../utils/gameLogic";

export default function RoleRevealScreen() {
  const room = useGameStore((state) => state.room);
  const sessionId = useGameStore((state) => state.sessionId);
  const readyTeamBuilding = useGameStore((state) => state.readyTeamBuilding);
  const [revealed, setRevealed] = useState(false);
  const { t } = useTranslation();

  if (!room) return null;

  const me = room.players.find((p) => p.sessionId === sessionId);
  if (!me) return null;

  const isEvil = EVIL_ROLES.has(me.role as Role);

  let info: string[] = [];
  if (me.role === "Merlin") {
    info = room.players.filter(p => ["Assassin", "Morgana", "Minion", "Oberon"].includes(p.role as string)).map(p => p.name);
  } else if (me.role === "Percival") {
    info = room.players.filter(p => ["Merlin", "Morgana"].includes(p.role as string)).map(p => p.name);
  } else if (isEvil && me.role !== "Oberon") {
    info = room.players.filter(p => ["Assassin", "Morgana", "Mordred", "Minion"].includes(p.role as string) && p.sessionId !== sessionId).map(p => p.name);
  }

  const handleReady = () => {
    if (room.players.find(p => p.isHost)?.sessionId === sessionId) readyTeamBuilding();
  };

  const imageUrl = ROLE_IMAGES[me.role as string];
  const cardBackUrl = ROLE_IMAGES["CardBack"];
  const isHost = room.players.find(p => p.isHost)?.sessionId === sessionId;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm space-y-6 text-center">

        {/* Header */}
        <div>
          <p className="text-[11px] font-semibold text-zinc-600 uppercase tracking-widest mb-1">{t("Keep this secret")}</p>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-50">{t("Your Role")}</h1>
        </div>

        {/* Card */}
        <div
          className={`relative overflow-hidden rounded-2xl border transition-all duration-500 cursor-pointer shadow-2xl aspect-[3/4] w-full max-w-[280px] mx-auto ${
            revealed
              ? isEvil
                ? "border-red-800/50 shadow-red-950/30"
                : "border-blue-800/50 shadow-blue-950/30"
              : "border-zinc-800 hover:border-zinc-600"
          }`}
          onClick={() => setRevealed(!revealed)}
        >
          <div
            className="absolute inset-0 bg-cover bg-center transition-all duration-700"
            style={{
              backgroundImage: `url(${revealed ? imageUrl : cardBackUrl})`,
              transform: revealed ? 'scale(1.04)' : 'scale(1)',
            }}
          />

          {!revealed ? (
            <div className="absolute inset-0 bg-black/55 flex flex-col items-center justify-center gap-5">
              <div className="w-16 h-16 rounded-full border border-zinc-600 flex items-center justify-center bg-zinc-900/60 backdrop-blur-sm">
                <EyeOff size={26} className="text-zinc-400" />
              </div>
              <span className="text-sm font-bold uppercase tracking-[0.25em] text-zinc-300">
                {t("Tap to Reveal")}
              </span>
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col justify-end animate-in fade-in duration-500">
              <div className="absolute bottom-0 left-0 right-0 h-2/3 bg-gradient-to-t from-black via-black/70 to-transparent" />
              <div className="relative z-10 p-5 text-center">
                <h2 className={`text-3xl font-serif font-bold drop-shadow-lg mb-0.5 ${isEvil ? "text-red-300" : "text-blue-300"}`}>
                  {t(me.role as string)}
                </h2>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
                  {isEvil ? t("Minion of Mordred") : t("Loyal Servant of Arthur")}
                </p>

                {info.length > 0 && (
                  <div className="mt-4 p-3.5 bg-black/50 backdrop-blur-sm rounded-xl border border-white/10">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">
                      {me.role === "Merlin" ? t("You see evil:") : me.role === "Percival" ? t("Merlin or Morgana:") : t("Your fellow evil:")}
                    </p>
                    <div className="space-y-1">
                      {info.map(name => (
                        <p key={name} className="font-bold text-zinc-100 text-sm">{name}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Action */}
        {isHost ? (
          <button
            onClick={handleReady}
            className="w-full max-w-[280px] mx-auto py-3.5 rounded-xl font-bold text-sm bg-zinc-50 hover:bg-white text-zinc-950 transition-all flex items-center justify-center gap-2 shadow-lg"
          >
            <Play size={15} />
            {t("Everyone is Ready")}
          </button>
        ) : (
          <p className="text-zinc-600 text-xs font-semibold uppercase tracking-widest">
            {t("Waiting for host to continue...")}
          </p>
        )}
      </div>
    </div>
  );
}
