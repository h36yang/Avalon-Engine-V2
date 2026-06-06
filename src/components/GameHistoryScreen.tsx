import { useEffect } from "react";
import { useGameStore, GameHistoryRecord } from "../store";
import { Crown, Skull, Users, Clock, Loader2, ScrollText, ChevronRight } from "lucide-react";
import { useTranslation } from "../utils/i18n";
import { EVIL_ROLES, Role } from "../utils/gameLogic";
import { formatElapsed } from "./GameTimer";

const GOLD = '#D4AF37';

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function GameHistoryScreen() {
  const gameHistory = useGameStore((s) => s.gameHistory);
  const loading = useGameStore((s) => s.gameHistoryLoading);
  const fetchGameHistory = useGameStore((s) => s.fetchGameHistory);
  const viewHistoryRecord = useGameStore((s) => s.viewHistoryRecord);
  const { t } = useTranslation();

  useEffect(() => {
    fetchGameHistory();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={22} className="animate-spin" style={{ color: 'rgba(212,175,55,0.4)' }} />
      </div>
    );
  }

  if (gameHistory.length === 0) {
    return (
      <div className="text-center py-12 space-y-2">
        <ScrollText size={28} className="mx-auto" style={{ color: 'rgba(212,175,55,0.2)' }} />
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>{t("No games yet")}</p>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>{t("Play some games to see your history here")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[340px] overflow-y-auto pr-0.5">
      {gameHistory.map((record) => (
        <HistoryRow key={record.id} record={record} onSelect={viewHistoryRecord} t={t} />
      ))}
    </div>
  );
}

function HistoryRow({ record, onSelect, t }: {
  record: GameHistoryRecord;
  onSelect: (r: GameHistoryRecord) => void;
  t: (key: string) => string;
}) {
  const isEvil = EVIL_ROLES.has(record.my_role as Role);
  const won = record.did_win;

  return (
    <button
      onClick={() => onSelect(record)}
      className="w-full flex items-center justify-between text-left transition-all duration-150 avalon-glass"
      style={{
        padding: '12px 14px',
        borderRadius: 10,
        border: `1px solid ${won ? 'rgba(212,175,55,0.24)' : 'rgba(255,255,255,0.08)'}`,
      }}
    >
      <div className="flex items-center gap-3 min-w-0">
        {/* Win/Loss icon */}
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          style={{
            background: won ? 'rgba(212,175,55,0.1)' : 'rgba(239,68,68,0.08)',
            border: `1px solid ${won ? 'rgba(212,175,55,0.3)' : 'rgba(239,68,68,0.2)'}`,
          }}
        >
          {won
            ? <Crown size={15} style={{ color: GOLD }} />
            : <Skull size={15} style={{ color: '#ef4444' }} />}
        </div>

        <div className="min-w-0">
          {/* Role */}
          <p className="font-semibold truncate" style={{
            fontSize: 13,
            color: isEvil ? '#f87171' : '#60a5fa',
          }}>
            {t(record.my_role)}
          </p>

          {/* Meta row */}
          <div className="flex items-center gap-2 mt-0.5">
            <span className="flex items-center gap-1" style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
              <Users size={9} />
              {record.player_count} {t("players")}
            </span>
            {record.duration_ms != null && (
              <span className="flex items-center gap-1" style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
                <Clock size={9} />
                {formatElapsed(record.duration_ms)}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <div className="text-right">
          <span style={{
            padding: '2px 8px',
            borderRadius: 999,
            fontSize: 9,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            background: won ? 'rgba(212,175,55,0.1)' : 'rgba(239,68,68,0.08)',
            border: `1px solid ${won ? 'rgba(212,175,55,0.3)' : 'rgba(239,68,68,0.2)'}`,
            color: won ? GOLD : '#ef4444',
          }}>
            {won ? t("Win") : t("Loss")}
          </span>
          <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', marginTop: 3, textAlign: 'right' }}>
            {formatRelativeTime(record.played_at)}
          </p>
        </div>
        <ChevronRight size={12} style={{ color: 'rgba(255,255,255,0.15)' }} />
      </div>
    </button>
  );
}
