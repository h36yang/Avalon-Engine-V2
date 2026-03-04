import { useState } from "react";
import { useGameStore } from "../store";
import { EyeOff } from "lucide-react";
import { ROLE_IMAGES } from "../assets/roleImages";
import { useTranslation } from "../utils/i18n";

export default function RoleRevealScreen() {
  const room = useGameStore((state) => state.room);
  const sessionId = useGameStore((state) => state.sessionId);
  const readyTeamBuilding = useGameStore((state) => state.readyTeamBuilding);
  const [revealed, setRevealed] = useState(false);
  const { t } = useTranslation();

  if (!room) return null;

  const me = room.players.find((p) => p.sessionId === sessionId);
  if (!me) return null;

  const isEvil = [
    "Assassin",
    "Morgana",
    "Mordred",
    "Minion",
    "Oberon",
  ].includes(me.role as string);

  // Determine what information this player sees
  let info: string[] = [];
  if (me.role === "Merlin") {
    info = room.players
      .filter((p) =>
        ["Assassin", "Morgana", "Minion", "Oberon"].includes(p.role as string),
      )
      .map((p) => p.name);
  } else if (me.role === "Percival") {
    info = room.players
      .filter((p) => ["Merlin", "Morgana"].includes(p.role as string))
      .map((p) => p.name);
  } else if (isEvil && me.role !== "Oberon") {
    info = room.players
      .filter(
        (p) =>
          ["Assassin", "Morgana", "Mordred", "Minion"].includes(
            p.role as string,
          ) && p.sessionId !== sessionId,
      )
      .map((p) => p.name);
  }

  const handleReady = () => {
    // Only host can advance
    if (room.players[0].sessionId === sessionId) {
      readyTeamBuilding();
    }
  };

  const roleImageKey = me.role as string;

  const imageUrl = ROLE_IMAGES[roleImageKey];
  const cardBackUrl = ROLE_IMAGES["CardBack"];

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="space-y-2">
          <h1 className="text-3xl font-serif font-bold tracking-tight text-amber-100">
            {t("Your Role")}
          </h1>
          <p className="text-amber-500/60 text-sm uppercase tracking-widest font-medium">
            {t("Keep this secret from others")}
          </p>
        </div>

        <div
          className={`relative overflow-hidden rounded-3xl border transition-all duration-700 cursor-pointer shadow-2xl aspect-[3/4] w-full max-w-[320px] mx-auto ${revealed
            ? isEvil
              ? "border-red-900/50 shadow-red-900/20"
              : "border-blue-900/50 shadow-blue-900/20"
            : "border-amber-900/30 hover:border-amber-500/50 shadow-amber-900/10"
            }`}
          onClick={() => setRevealed(!revealed)}
        >
          {/* Background Image */}
          <div
            className="absolute inset-0 bg-cover bg-center transition-transform duration-1000"
            style={{
              backgroundImage: `url(${revealed ? imageUrl : cardBackUrl})`,
              transform: revealed ? 'scale(1.05)' : 'scale(1)'
            }}
          />

          {!revealed ? (
            // Card Back Overlay
            <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center p-8 transition-opacity duration-300">
              <div className="flex flex-col items-center gap-6 text-amber-500/80">
                <div className="w-20 h-20 rounded-full border border-amber-500/30 flex items-center justify-center bg-black/40 backdrop-blur-md">
                  <EyeOff size={32} />
                </div>
                <span className="font-serif font-bold uppercase tracking-[0.3em] text-sm text-amber-100 drop-shadow-md">
                  {t("Tap to Reveal")}
                </span>
              </div>
            </div>
          ) : (
            // Revealed Card Content
            <div className="absolute inset-0 flex flex-col justify-end animate-in fade-in duration-500">
              {/* Gradient Overlay for Text Readability */}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent h-3/5 mt-auto" />

              <div className="relative z-10 p-6 flex flex-col items-center text-center">
                <div>
                  <h2
                    className={`text-4xl font-serif font-bold mb-1 drop-shadow-lg ${isEvil ? "text-red-400" : "text-blue-400"}`}
                  >
                    {t(me.role as string)}
                  </h2>
                  <p className="text-zinc-300 font-medium uppercase tracking-widest text-[10px] opacity-80">
                    {isEvil ? t("Minion of Mordred") : t("Loyal Servant of Arthur")}
                  </p>
                </div>

                {info.length > 0 && (
                  <div className="mt-6 p-4 bg-black/40 backdrop-blur-md rounded-xl border border-white/10 w-full">
                    <h3 className="text-[10px] font-medium text-amber-500/70 uppercase tracking-widest mb-2">
                      {me.role === "Merlin"
                        ? t("You see evil:")
                        : me.role === "Percival"
                          ? t("Merlin or Morgana:")
                          : t("Your fellow evil:")}
                    </h3>
                    <ul className="space-y-1">
                      {info.map((name) => (
                        <li key={name} className="font-serif text-lg text-amber-50 drop-shadow-md">
                          {name}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {room.players[0].sessionId === sessionId ? (
          <button
            onClick={handleReady}
            className="w-full max-w-[320px] mx-auto relative group overflow-hidden rounded-xl mt-8"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-amber-600 to-yellow-600 transition-transform duration-300 group-hover:scale-105" />
            <div className="relative px-4 py-4 flex items-center justify-center gap-2 text-black font-bold tracking-wide uppercase text-sm">
              {t("Everyone is Ready")}
            </div>
          </button>
        ) : (
          <p className="text-amber-500/50 text-xs uppercase tracking-widest font-medium mt-8">
            {t("Waiting for host to continue...")}
          </p>
        )}
      </div>
    </div>
  );
}
