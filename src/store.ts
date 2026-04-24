import { create } from "zustand";
import { persist } from "zustand/middleware";
import { io, Socket } from "socket.io-client";
import { User } from '@supabase/supabase-js';
import { Role, Player } from './utils/gameLogic';
import { supabase, recreateSupabaseClient } from './utils/supabase';

export interface Quest {
  teamSize: number;
  requiresTwoFails: boolean;
  status: "pending" | "success" | "fail";
  team: string[];
  votes: Record<string, boolean>;
}

export interface TeamVoteHistory {
  questIndex: number;
  voteTrack: number;
  leaderIndex: number;
  proposedTeam: string[];
  votes: Record<string, boolean>;
  approved: boolean;
}

export interface BotOpinion {
  botId: string;
  text: string;
  isError?: boolean;
}

export interface MindLogEntry {
  phase: string;
  prompt: string;
  response: string;
  decision: string;
  timestamp: number;
}

export interface Room {
  id: string;
  players: Player[];
  status:
  | "lobby"
  | "role_reveal"
  | "team_building"
  | "team_voting"
  | "team_vote_reveal"
  | "quest_voting"
  | "quest_result"
  | "assassin"
  | "game_over";
  settings: {
    optionalRoles: Role[];
  };
  gameState: {
    quests: Quest[];
    currentQuestIndex: number;
    voteTrack: number;
    leaderIndex: number;
    proposedTeam: string[];
    teamVotes: Record<string, boolean>;
    winner: "good" | "evil" | null;
    assassinationTarget: string | null;
    voteHistory: TeamVoteHistory[];
    botOpinions?: BotOpinion[];
    botMindLogs?: Record<string, MindLogEntry[]>;
  };
}

export interface UserProfile {
  id: string;
  username: string;
  wins: number;
  losses: number;
  total_games: number;
}

export interface AvailableRoom {
  id: string;
  hostName: string;
  playerCount: number;
  maxPlayers: number;
  status: 'waiting' | 'in_game';
}

interface GameState {
  user: User | null;
  profile: UserProfile | null;
  setAuth: (user: User | null, profile: UserProfile | null) => void;
  logout: () => void;
  socket: Socket | null;
  room: Room | null;
  sessionId: string;
  name: string;
  roomId: string;
  error: string | null;
  language: 'en' | 'zh';
  devRequestedRole?: Role;
  idleWarning: boolean;
  idleCountdown: number;
  _idleTimer?: ReturnType<typeof setInterval>;
  connecting: boolean;
  setLanguage: (lang: 'en' | 'zh') => void;
  setDevRequestedRole: (role?: Role) => void;
  connect: (roomId: string, name: string) => void;
  updateSettings: (settings: Partial<Room["settings"]>) => void;
  updateBotApiKey: (botSessionId: string, apiKey: string, provider?: 'gemini' | 'openrouter' | 'groq' | 'nvidia', model?: string) => void;
  testBotApiKey: (provider: 'gemini' | 'openrouter' | 'groq' | 'nvidia', apiKey: string, model?: string) => Promise<{ success: boolean; message: string }>;
  addBot: (botClass?: 'normal' | 'hard' | 'ai') => void;
  startGame: (requestedRoles?: Record<string, Role>) => void;
  leaveRoom: () => void;
  kickPlayer: (targetSessionId: string) => void;
  endGame: () => void;
  restartGame: () => void;
  readyTeamBuilding: () => void;
  proposeTeam: (team: string[]) => void;
  voteTeam: (approve: boolean) => void;
  voteQuest: (success: boolean) => void;
  assassinate: (targetSessionId: string) => void;
  continueVoteReveal: () => void;
  continueQuestResult: () => void;
  pingActivity: () => void;
  availableRooms: AvailableRoom[];
  fetchRooms: () => Promise<void>;
}

const generateSessionId = () => {
  return Math.random().toString(36).substring(2, 15);
};

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      user: null,
      profile: null,
      connecting: false,
      setAuth: (user, profile) => set({ user, profile, name: profile?.username || get().name }),
      logout: () => set({ user: null, profile: null }),
      socket: null,
      room: null,
      sessionId: generateSessionId(),
      name: "",
      roomId: "",
      error: null,
      language: 'en',
      devRequestedRole: undefined,
      idleWarning: false,
      idleCountdown: 0,
      availableRooms: [],

      setLanguage: (lang) => set({ language: lang }),
      setDevRequestedRole: (role) => set({ devRequestedRole: role }),

      connect: async (roomId: string, name: string) => {
        const { socket: existingSocket, sessionId } = get();
        if (existingSocket) {
          existingSocket.disconnect();
        }
        set({ error: null, connecting: true });

        // Get current Supabase session token (wrapped in try-catch for retry)
        let token = undefined;
        const getSessionTimeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timed out getting auth token')), 5000)
        );
        try {
          const { data: { session } } = await Promise.race([
            supabase.auth.getSession(),
            getSessionTimeout
          ]);
          token = session?.access_token;
        } catch (err) {
          set({
            connecting: false,
            error: `${err}. Please refresh the page and try again.`
          });
          return;
        }

        const socketUrl =
          (import.meta as any).env.VITE_APP_URL || window.location.origin;
        const socket = io(socketUrl, { autoConnect: false });

        // Timeout safeguard: if socket doesn't connect in X ms, show error
        let connectTimeout: ReturnType<typeof setTimeout> | undefined;
        connectTimeout = setTimeout(() => {
          if (!socket.connected) {
            set({ connecting: false, error: 'Connection timed out. Please try again.' });
            try { socket.disconnect(); } catch { };
          }
        }, 8000);

        socket.on("connect", () => {
          if (connectTimeout) clearTimeout(connectTimeout);
          set({ connecting: false });
          socket.emit("join_room", { roomId, sessionId, name, token });
        });

        socket.on("connect_error", (err: any) => {
          if (connectTimeout) clearTimeout(connectTimeout);
          set({ connecting: false, error: err?.message || 'Connection error' });
          try { socket.disconnect(); } catch { };
        });

        socket.on("connect_timeout", () => {
          if (connectTimeout) clearTimeout(connectTimeout);
          set({ connecting: false, error: 'Connection attempt timed out' });
          try { socket.disconnect(); } catch { };
        });

        socket.on("room_update", (room: Room) => {
          set({ room, error: null });
        });

        socket.on("error", (err: { message: string }) => {
          set({ error: err.message });
        });

        socket.on("kicked", () => {
          set({ error: "You have been kicked from the room." });
          get().leaveRoom();
        });

        socket.on("game_ended", (data?: { reason?: string }) => {
          const timer = get()._idleTimer;
          if (timer) clearInterval(timer);
          set({ error: data?.reason === 'idle_timeout' ? 'Room closed due to inactivity.' : 'The host has ended the game.', idleWarning: false, idleCountdown: 0, _idleTimer: undefined });
          get().leaveRoom();
        });

        socket.on("room_idle_warning", ({ countdown }: { countdown: number }) => {
          // Start local countdown
          set({ idleWarning: true, idleCountdown: countdown });
          const timer = setInterval(() => {
            const current = get().idleCountdown;
            if (current <= 1) {
              clearInterval(timer);
              set({ idleCountdown: 0, _idleTimer: undefined });
            } else {
              set({ idleCountdown: current - 1 });
            }
          }, 1000);
          set({ _idleTimer: timer });
        });

        socket.on("room_idle_cancelled", () => {
          const timer = get()._idleTimer;
          if (timer) clearInterval(timer);
          set({ idleWarning: false, idleCountdown: 0, _idleTimer: undefined });
        });

        // Start the connection after handlers + auth are set
        try {
          socket.connect();
          set({ socket, roomId, name });
        } catch (err) {
          set({
            connecting: false,
            error: err instanceof Error ? err.message : 'Connection error'
          });
        }
      },

      updateSettings: (settings) => {
        const { socket, roomId } = get();
        socket?.emit("update_settings", { roomId, settings });
      },

      updateBotApiKey: (botSessionId, apiKey, provider, model) => {
        const { socket, roomId } = get();
        socket?.emit("update_bot_api_key", { roomId, targetSessionId: botSessionId, apiKey, provider, model });
      },

      testBotApiKey: (provider, apiKey, model) => {
        const { socket } = get();
        return new Promise((resolve) => {
          if (!socket) { resolve({ success: false, message: 'Not connected' }); return; }
          const timer = setTimeout(() => resolve({ success: false, message: 'Timeout' }), 20000);
          socket.emit('test_api_key', { provider, apiKey, model }, (result: { success: boolean; message: string }) => {
            clearTimeout(timer);
            resolve(result);
          });
        });
      },

      addBot: (botClass?: 'normal' | 'hard' | 'ai') => {
        const { socket, room } = get();
        if (!socket || !room) return;

        const roomId = room.id;
        socket?.emit("add_bot", { roomId, botClass: botClass || 'normal' });
      },

      startGame: (requestedRoles) => {
        const { socket, roomId } = get();
        socket?.emit("start_game", { roomId, requestedRoles });
      },

      leaveRoom: () => {
        const { socket, roomId, sessionId } = get();
        if (socket) {
          socket.emit("leave_room", { roomId, sessionId });
          socket.disconnect();
        }
        set({ socket: null, room: null, roomId: "", error: null, connecting: false });
      },

      kickPlayer: (targetSessionId: string) => {
        const { socket, roomId } = get();
        socket?.emit("kick_player", { roomId, targetSessionId });
      },

      endGame: () => {
        const { socket, roomId } = get();
        socket?.emit("end_game", { roomId });
      },

      readyTeamBuilding: () => {
        const { socket, roomId } = get();
        socket?.emit("ready_team_building", { roomId });
      },

      proposeTeam: (team) => {
        const { socket, roomId } = get();
        socket?.emit("propose_team", { roomId, team });
      },

      voteTeam: (approve) => {
        const { socket, roomId, sessionId } = get();
        socket?.emit("vote_team", { roomId, sessionId, approve });
      },

      voteQuest: (success) => {
        const { socket, roomId, sessionId } = get();
        socket?.emit("vote_quest", { roomId, sessionId, success });
      },

      assassinate: (targetSessionId) => {
        const { socket, roomId, sessionId } = get();
        socket?.emit("assassinate", { roomId, sessionId, targetSessionId });
      },

      continueVoteReveal: () => {
        const { socket, roomId } = get();
        socket?.emit("continue_vote_reveal", { roomId });
      },

      continueQuestResult: () => {
        const { socket, roomId } = get();
        socket?.emit("continue_quest_result", { roomId });
      },

      restartGame: () => {
        const { socket, roomId } = get();
        socket?.emit("restart_game", { roomId });
      },

      pingActivity: () => {
        const { socket, roomId, _idleTimer } = get();
        socket?.emit("room_activity_ping", { roomId });
        if (_idleTimer) clearInterval(_idleTimer);
        set({ idleWarning: false, idleCountdown: 0, _idleTimer: undefined });
      },

      fetchRooms: async () => {
        try {
          const baseUrl = (import.meta as any).env.VITE_APP_URL || window.location.origin;
          const res = await fetch(`${baseUrl}/api/rooms`);
          const data = await res.json();
          set({ availableRooms: data });
        } catch (err) {
          console.error('Failed to fetch rooms:', err);
        }
      },
    }),
    {
      name: 'avalon-storage',
      // Only persist these specific fields to localStorage
      partialize: (state) => ({
        sessionId: state.sessionId,
        name: state.name,
        roomId: state.roomId,
        language: state.language
      }),
    }
  )
);
