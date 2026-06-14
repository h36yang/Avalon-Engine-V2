export type Role = 'Merlin' | 'Assassin' | 'Percival' | 'Morgana' | 'Mordred' | 'Oberon' | 'Loyal Servant' | 'Minion';

export const EVIL_ROLES: ReadonlySet<Role> = new Set(['Assassin', 'Morgana', 'Mordred', 'Minion', 'Oberon']);

export interface Player {
  id: string; // socket id
  sessionId: string; // persistent id
  userId?: string; // Supabase auth user id
  name: string;
  role?: Role;
  isConnected: boolean;
  isHost: boolean;
  isBot?: boolean;
  apiKey?: string;
  hasApiKey?: boolean;
  provider?: 'gemini' | 'openrouter' | 'groq' | 'nvidia';
  model?: string;
  difficulty?: 'normal' | 'hard'; // Bot difficulty level
}
