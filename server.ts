import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createServer, ServerResponse } from 'http';
import { Server } from 'socket.io';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getQuestConfig, assignRoles, generateSecureRandomNumber } from './src/server/gameLogic';
import { EVIL_ROLES, Role, Player } from './src/utils/sharedTypes';
import { LadeOfTheLakeCheck } from './src/store';
import {
  Room,
  DEFAULT_MODELS,
  callOpenAICompatible,
  initializeBotMemories,
  getNextBotName,
  triggerBotOpinions,
  updateBotMemoriesAfterTeamVote,
  updateBotMemoriesAfterQuest,
  handleBotActions,
} from './src/server/bot';

const PORT = Number(process.env.PORT) || 3000;

// Initialize Supabase Admin Client
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseSecretKey = process.env.VITE_SUPABASE_SECRET_KEY || '';

let supabase: SupabaseClient | undefined;
try {
  if (supabaseUrl && supabaseSecretKey) {
    supabase = createClient(supabaseUrl, supabaseSecretKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }
} catch (err) {
  console.warn('Failed to initialize Supabase admin client:', err);
}

async function updatePlayerStats(userId: string, isWinner: boolean) {
  if (!userId || !supabase) {
    console.warn('Invalid user ID or Supabase client not initialized');
    return;
  }

  try {
    // We use an RPC call if we had one, but for simplicity we'll do a select then update
    // In a production app with high concurrency, an RPC function in Postgres is safer
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('wins, losses, total_games')
      .eq('id', userId)
      .single();

    if (fetchError) {
      console.error('Error fetching profile for stats update:', fetchError);
      return;
    }

    if (profile) {
      const updates = {
        total_games: (profile.total_games || 0) + 1,
        wins: isWinner ? (profile.wins || 0) + 1 : profile.wins,
        losses: !isWinner ? (profile.losses || 0) + 1 : profile.losses,
      };

      const { error: updateError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId);

      if (updateError) {
        console.error('Error updating profile stats:', updateError);
      }
    }
  } catch (err) {
    console.error('Failed to update player stats:', err);
  }
}

// Build the sanitized room snapshot for a specific player's game history record.
// Re-uses the game_over sanitization path from sanitizeRoomForPlayer: all roles
// revealed, botMindLogs included, botMemories stripped. We also strip apiKeys.
function buildGameOverSnapshot(room: Room, viewerSessionId: string): object {
  const { botMemories: _stripped, ...safeGameState } = room.gameState;
  const sanitizedPlayers = room.players.map(p => {
    const { apiKey: _stripped, ...safeP } = p;
    return safeP;
  });
  return {
    ...room,
    players: sanitizedPlayers,
    gameState: { ...safeGameState, botMindLogs: room.gameState.botMindLogs },
    // Embed the viewer's sessionId so the client can highlight "You" in the replay
    viewerSessionId,
  };
}

async function saveGameHistory(room: Room) {
  if (!supabase || !room.gameState.winner) return;

  const humanPlayers = room.players.filter(p => !p.isBot && p.userId);
  if (humanPlayers.length === 0) return;

  const durationMs = (room.gameStartedAt && room.gameEndedAt)
    ? room.gameEndedAt - room.gameStartedAt
    : undefined;

  const rows = humanPlayers.map(p => {
    const isEvil = EVIL_ROLES.has(p.role!);
    const didWin =
      (room.gameState.winner === 'evil' && isEvil) ||
      (room.gameState.winner === 'good' && !isEvil);
    return {
      user_id: p.userId,
      my_role: p.role as string,
      did_win: didWin,
      player_count: room.players.length,
      duration_ms: durationMs,
      room_snapshot: buildGameOverSnapshot(room, p.sessionId),
    };
  });

  try {
    const { error } = await supabase.from('game_history').insert(rows);
    if (error) {
      console.error('Error saving game history:', error);
    } else {
      console.log(`Saved game history for ${rows.length} player(s).`);
    }
  } catch (err) {
    console.error('Failed to save game history:', err);
  }
}

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
    },
  });

  // API routes FIRST
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/rooms', (req, res) => {
    const userSessionId = req.query.sessionId as string;
    const roomList = Object.values(rooms).map(room => ({
      id: room.id,
      hostName: room.players.find(p => p.isHost)?.name || 'Unknown',
      playerCount: room.players.length,
      maxPlayers: 10,
      status: room.status === 'lobby' ? 'waiting' : 'in_game',
      isRejoinable: userSessionId ? room.players.some(p => p.sessionId === userSessionId) : false,
    }));
    res.json(roomList);
  });

  // Socket.io logic
  setupSocket(io);

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const staticOptions = {
      setHeaders: (res: ServerResponse, path: string) => {
        if (path.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        }
      }
    };
    app.use(express.static('dist', staticOptions));
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

// --- Game Logic ---

const IDLE_TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes
const IDLE_WARNING_COUNTDOWN_S = 30; // 30 seconds after warning

function touchRoom(room: Room) {
  room.lastActivityTime = Date.now();
  room.idleWarningEmitted = false;
}

const rooms: Record<string, Room> = {};

// === SECURITY: Socket identity mapping ===
// Maps socket.id → sessionId so we never trust client-sent sessionId
const socketToSession: Record<string, string> = {};

// === SECURITY: Sanitize room data before broadcasting ===
// Strips other players' roles and botMemories, but respects Avalon's role visibility rules:
// - Merlin sees evil (except Mordred)
// - Percival sees Merlin and Morgana
// - Evil (except Oberon) sees fellow evil (except Oberon)
function sanitizeRoomForPlayer(room: Room, viewerSessionId: string): Room {
  // During game_over, reveal all roles and include AI mind logs
  if (room.status === 'game_over') {
    const { botMemories: _stripped, ...safeGameState } = room.gameState;
    return {
      ...room,
      gameState: {
        ...safeGameState,
        botMindLogs: room.gameState.botMindLogs,
      } as typeof room.gameState,
    };
  }

  const viewer = room.players.find(p => p.sessionId === viewerSessionId);
  const viewerRole = viewer?.role;
  const isViewerEvil = viewerRole ? ['Assassin', 'Morgana', 'Mordred', 'Minion'].includes(viewerRole) : false;

  const sanitizedPlayers = room.players.map(p => {
    // Always strip apiKey before sending to any client
    const { apiKey: _stripped, ...safeP } = p;

    if (safeP.sessionId === viewerSessionId) {
      return safeP; // Player always sees their own role
    }

    const targetRole = safeP.role;
    if (!targetRole) return { ...safeP, role: undefined };

    const isTargetEvil = EVIL_ROLES.has(targetRole);

    // In assassin phase, all players (including good players) can see the evil players' roles
    if (room.status === 'assassin' && isTargetEvil) {
      return safeP;
    }

    // Merlin sees all evil EXCEPT Mordred
    if (viewerRole === 'Merlin' && isTargetEvil && targetRole !== 'Mordred') {
      return safeP;
    }

    // Percival sees Merlin and Morgana (doesn't know which is which — UI only shows names)
    if (viewerRole === 'Percival' && (targetRole === 'Merlin' || targetRole === 'Morgana')) {
      return safeP;
    }

    // Evil (except Oberon) sees fellow evil (except Oberon)
    if (isViewerEvil && ['Assassin', 'Morgana', 'Mordred', 'Minion'].includes(targetRole)) {
      return safeP;
    }

    return { ...safeP, role: undefined }; // Hide role from this viewer
  });

  const { botMemories: _strippedBotMemories, botMindLogs: _strippedBotMindLogs, ...safeGameState } = room.gameState;
  if (room.gameState.ladyOfTheLakeChecks) {
    safeGameState.ladyOfTheLakeChecks = room.gameState.ladyOfTheLakeChecks.map((check: LadeOfTheLakeCheck) => {
      if (check.checker === viewerSessionId) {
        return check;
      }
      return {
        ...check,
        result: undefined, // Sanitize the result
      };
    });
  }
  return {
    ...room,
    players: sanitizedPlayers,
    gameState: safeGameState as typeof room.gameState,
  };
}

// Broadcast a personalized, sanitized room update to each connected player
function broadcastRoom(room: Room, io: Server) {
  room.players.forEach(player => {
    if (player.id && !player.isBot) {
      const sanitized = sanitizeRoomForPlayer(room, player.sessionId);
      io.to(player.id).emit('room_update', sanitized);
    }
  });
}

function checkTeamVotes(room: Room, io: Server) {
  if (Object.keys(room.gameState.teamVotes).length === room.players.length) {
    const approves = Object.values(room.gameState.teamVotes).filter(v => v).length;
    const rejects = room.players.length - approves;
    const approved = approves > rejects;

    room.gameState.voteHistory.push({
      questIndex: room.gameState.currentQuestIndex,
      voteTrack: room.gameState.voteTrack,
      leaderIndex: room.gameState.leaderIndex,
      proposedTeam: [...room.gameState.proposedTeam],
      votes: { ...room.gameState.teamVotes },
      approved
    });

    updateBotMemoriesAfterTeamVote(room);

    room.status = 'team_vote_reveal';
    broadcastRoom(room, io);
    handleBotActions(room, io, broadcastRoom, recordGameStats);
  } else {
    // Just update that someone voted
    broadcastRoom(room, io);
  }
}

function applyTeamVoteResult(room: Room, io: Server) {
  const lastVote = room.gameState.voteHistory[room.gameState.voteHistory.length - 1];
  if (lastVote.approved) {
    // Team approved
    room.status = 'quest_voting';
    room.gameState.quests[room.gameState.currentQuestIndex].team = room.gameState.proposedTeam;
    room.gameState.voteTrack = 0;
  } else {
    // Team rejected
    room.gameState.voteTrack++;
    if (room.gameState.voteTrack >= 5) {
      room.status = 'game_over'; room.gameEndedAt = Date.now();
      room.gameState.winner = 'evil';
      recordGameStats(room);
    } else {
      room.status = 'team_building';
      room.gameState.leaderIndex = (room.gameState.leaderIndex + 1) % room.players.length;
      room.gameState.proposedTeam = [];
      triggerBotOpinions(room, io, broadcastRoom);
    }
  }
  broadcastRoom(room, io);
  handleBotActions(room, io, broadcastRoom, recordGameStats);
}

function recordGameStats(room: Room) {
  if (!room.gameState.winner) return;

  room.players.forEach(player => {
    if (player.isBot || !player.userId) return;

    const isEvil = EVIL_ROLES.has(player.role as Role);
    const isWinner = (room.gameState.winner === 'evil' && isEvil) || (room.gameState.winner === 'good' && !isEvil);

    updatePlayerStats(player.userId, isWinner);
  });

  // Fire-and-forget: save the full game record for history replay
  saveGameHistory(room);
}

function checkQuestVotes(room: Room, io: Server) {
  const quest = room.gameState.quests[room.gameState.currentQuestIndex];
  if (Object.keys(quest.votes).length === quest.teamSize) {
    const fails = Object.values(quest.votes).filter(v => !v).length;
    const failed = quest.requiresTwoFails ? fails >= 2 : fails >= 1;

    quest.status = failed ? 'fail' : 'success';

    updateBotMemoriesAfterQuest(room);

    // Enter quest_result phase to show result before advancing
    room.status = 'quest_result';
    broadcastRoom(room, io);
    handleBotActions(room, io, broadcastRoom, recordGameStats);
  } else {
    broadcastRoom(room, io);
  }
}

// Advance from quest_result to the next phase
function applyQuestResult(room: Room, io: Server) {
  const successes = room.gameState.quests.filter(q => q.status === 'success').length;
  const totalFails = room.gameState.quests.filter(q => q.status === 'fail').length;

  if (successes >= 3) {
    room.status = 'assassin';
    room.assassinationStartedAt = Date.now();
  } else if (totalFails >= 3) {
    room.status = 'game_over'; room.gameEndedAt = Date.now();
    room.gameState.winner = 'evil';
    recordGameStats(room);
  } else {
    const prevQuestIndex = room.gameState.currentQuestIndex;
    room.gameState.currentQuestIndex++;
    room.gameState.proposedTeam = [];
    room.gameState.teamVotes = {};

    if (room.settings.ladyOfTheLake && prevQuestIndex >= 1 && prevQuestIndex <= 3) {
      room.status = 'lady_of_the_lake';
    } else {
      room.status = 'team_building';
      room.gameState.leaderIndex = (room.gameState.leaderIndex + 1) % room.players.length;
      triggerBotOpinions(room, io, broadcastRoom);
    }
  }
  broadcastRoom(room, io);
  handleBotActions(room, io, broadcastRoom, recordGameStats);
}

function executeLadyOfTheLakeCheck(room: Room, targetSessionId: string, io: Server) {
  const targetPlayer = room.players.find(p => p.sessionId === targetSessionId);
  if (!targetPlayer) return;

  const isEvil = EVIL_ROLES.has(targetPlayer.role as Role);
  const result = isEvil ? 'evil' : 'good';

  room.gameState.ladyOfTheLakeChecks.push({
    checker: room.gameState.ladyOfTheLakeHolder!,
    target: targetSessionId,
    result
  });

  room.gameState.ladyOfTheLakeHolder = targetSessionId;
  room.gameState.ladyOfTheLakeHistory.push(targetSessionId);
  room.status = 'lady_of_the_lake_reveal';

  touchRoom(room);
  broadcastRoom(room, io);
  handleBotActions(room, io, broadcastRoom, recordGameStats);
}

function applyLadyOfTheLakeContinuation(room: Room, io: Server) {
  room.status = 'team_building';
  room.gameState.leaderIndex = (room.gameState.leaderIndex + 1) % room.players.length;
  room.gameState.proposedTeam = [];
  triggerBotOpinions(room, io, broadcastRoom);
  broadcastRoom(room, io);
  handleBotActions(room, io, broadcastRoom, recordGameStats);
}

function setupSocket(io: Server) {
  // Periodic idle room checker (runs every 10 seconds)
  setInterval(() => {
    const now = Date.now();
    for (const roomId in rooms) {
      const room = rooms[roomId];
      const elapsed = now - room.lastActivityTime;

      if (elapsed >= IDLE_TIMEOUT_MS + IDLE_WARNING_COUNTDOWN_S * 1000) {
        // Time's up — auto-close
        console.log(`Room ${roomId} auto-closed due to inactivity.`);
        io.to(roomId).emit('game_ended', { reason: 'idle_timeout' });
        delete rooms[roomId];
      } else if (elapsed >= IDLE_TIMEOUT_MS && !room.idleWarningEmitted) {
        // Emit warning
        room.idleWarningEmitted = true;
        io.to(roomId).emit('room_idle_warning', { countdown: IDLE_WARNING_COUNTDOWN_S });
        console.log(`Room ${roomId}: idle warning emitted.`);
      }
    }
  }, 10_000);

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('join_room', async ({ roomId, sessionId, name, token }) => {
      try {
        socket.join(roomId);

        // SECURITY: Register socket → session mapping
        socketToSession[socket.id] = sessionId;

        let userId: string | undefined;

        // Verify Supabase token if provided
        if (token && supabase) {
          try {
            const { data: { user }, error } = await supabase.auth.getUser(token);
            if (!error && user) {
              userId = user.id;
            }
          } catch (err) {
            console.error('Token verification failed:', err);
          }
        }

        if (!rooms[roomId]) {
          rooms[roomId] = {
            id: roomId,
            players: [],
            status: 'lobby',
            settings: { optionalRoles: [], ladyOfTheLake: false },
            gameState: {
              quests: [],
              currentQuestIndex: 0,
              voteTrack: 0,
              leaderIndex: 0,
              proposedTeam: [],
              teamVotes: {},
              winner: null,
              assassinationTarget: null,
              voteHistory: [],
              botMemories: {},
              botMindLogs: {},
              ladyOfTheLakeHistory: [],
              ladyOfTheLakeChecks: []
            },
            lastActivityTime: Date.now(),
            idleWarningEmitted: false
          };
        }

        const room = rooms[roomId];
        const existingPlayer = room.players.find(p => p.sessionId === sessionId);

        if (existingPlayer) {
          existingPlayer.id = socket.id;
          existingPlayer.name = name;
          existingPlayer.isConnected = true;
          if (userId) existingPlayer.userId = userId;
        } else {
          if (room.status !== 'lobby') {
            socket.emit('error', { message: 'Game already started' });
            return;
          }
          room.players.push({
            id: socket.id,
            sessionId,
            userId,
            name,
            isConnected: true,
            isHost: room.players.length === 0 // First player is host
          });
        }

        touchRoom(room);
        broadcastRoom(room, io);
      } catch (err) {
        console.error('Error in join_room:', err);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    socket.on('update_settings', ({ roomId, settings }) => {
      try {
        const room = rooms[roomId];
        if (room && room.status === 'lobby') {
          room.settings = settings;
          touchRoom(room);
          broadcastRoom(room, io);
        }
      } catch (err) {
        console.error('Error in update_settings:', err);
      }
    });

    socket.on('add_bot', ({ roomId, difficulty }) => {
      try {
        const room = rooms[roomId];
        if (room && room.status === 'lobby' && room.players.length < 10) {
          const botId = 'bot_' + generateSecureRandomNumber().toString(36).substring(2, 9);
          const newBot: Player = {
            id: botId,
            sessionId: botId,
            name: getNextBotName(room, false),
            isConnected: true,
            isBot: true,
            isHost: false,
            difficulty: difficulty,
          };
          room.players.push(newBot);

          touchRoom(room);
          broadcastRoom(room, io);
        }
      } catch (err) {
        console.error('Error in add_bot:', err);
      }
    });

    socket.on('update_bot_api_key', ({ roomId, targetSessionId, apiKey, provider, model }) => {
      try {
        const room = rooms[roomId];
        if (room && room.status === 'lobby') {
          const sender = room.players.find(p => p.id === socket.id);
          if (sender && sender.isHost) {
            const bot = room.players.find(p => p.sessionId === targetSessionId && p.isBot);
            if (bot) {
              bot.apiKey = apiKey;
              bot.provider = provider ?? 'gemini';
              bot.model = model || undefined;
              touchRoom(room);
              broadcastRoom(room, io);
            }
          }
        }
      } catch (err) {
        console.error('Error in update_bot_api_key:', err);
      }
    });

    socket.on('test_api_key', async ({ provider, apiKey, model }, callback) => {
      try {
        const resolvedModel = model || DEFAULT_MODELS[provider] || DEFAULT_MODELS.gemini;
        let reply: string;
        if (provider === 'gemini') {
          const { GoogleGenAI } = await import('@google/genai');
          const genAI = new GoogleGenAI({ apiKey });
          const response = await genAI.models.generateContent({
            model: resolvedModel,
            contents: 'Say "ok" in one word.',
          });
          reply = response.text || '';
        } else {
          const BASE_URLS: Record<string, string> = {
            openrouter: 'https://openrouter.ai/api/v1',
            groq: 'https://api.groq.com/openai/v1',
            nvidia: 'https://integrate.api.nvidia.com/v1',
          };
          reply = await callOpenAICompatible(BASE_URLS[provider], apiKey, resolvedModel, 'You are a test assistant.', 'Say "ok" in one word.');
        }
        callback({ success: true, message: `✅ Connected! Reply: "${reply.slice(0, 40)}"` });
      } catch (err: unknown) {
        const raw = err instanceof Error ? err.message : String(err);
        const httpMatch = raw.match(/HTTP (\d+)/);
        let msg: string;
        if (httpMatch) {
          const s = parseInt(httpMatch[1]);
          if (s === 401) msg = 'Invalid API key (401)';
          else if (s === 403) msg = 'Access denied (403)';
          else if (s === 404) msg = 'Model not found (404)';
          else if (s === 429) msg = 'Rate limited (429)';
          else msg = `HTTP ${s}`;
        } else if (/timeout/i.test(raw)) {
          msg = 'Connection timeout';
        } else {
          msg = raw.slice(0, 100);
        }
        callback({ success: false, message: `❌ ${msg}` });
      }
    });

    socket.on('start_game', ({ roomId, requestedRoles }) => {
      try {
        const room = rooms[roomId];
        if (room && room.status === 'lobby' && room.players.length >= 5 && room.players.length <= 10) {
          touchRoom(room);
          assignRoles(room.players, requestedRoles);

          // Find the assassin player to initialize strikeHolderSessionId
          const assassin = room.players.find(p => p.role === 'Assassin');
          let strikeHolderSessionId: string | undefined = undefined;
          if (assassin) {
            if (!assassin.isBot) {
              strikeHolderSessionId = assassin.sessionId;
            } else {
              const humanEvils = room.players.filter(p => !p.isBot && EVIL_ROLES.has(p.role as Role));
              if (humanEvils.length > 0) {
                const randomEvil = humanEvils[Math.floor(generateSecureRandomNumber() * humanEvils.length)];
                strikeHolderSessionId = randomEvil.sessionId;
              }
            }
          }
          room.gameState.strikeHolderSessionId = strikeHolderSessionId;

          const config = getQuestConfig(room.players.length);
          room.gameState.quests = config.sizes.map((size, i) => ({
            teamSize: size,
            requiresTwoFails: config.twoFails[i],
            status: 'pending',
            team: [],
            votes: {}
          }));
          room.gameState.voteHistory = [];
          room.gameState.ladyOfTheLakeHolder = undefined;
          room.gameState.ladyOfTheLakeHistory = [];
          room.gameState.ladyOfTheLakeChecks = [];

          room.gameState.leaderIndex = Math.floor(generateSecureRandomNumber() * room.players.length);

          if (room.settings.ladyOfTheLake) {
            const firstLeaderIndex = room.gameState.leaderIndex;
            const initialHolderIndex = (firstLeaderIndex - 1 + room.players.length) % room.players.length;
            const initialHolder = room.players[initialHolderIndex];
            room.gameState.ladyOfTheLakeHolder = initialHolder.sessionId;
            room.gameState.ladyOfTheLakeHistory.push(initialHolder.sessionId);
          }

          room.gameState.botMindLogs = {};
          // Initialize mind logs for bots
          room.players.filter(p => p.isBot).forEach(bot => {
            room.gameState.botMindLogs[bot.sessionId] = [];
          });
          room.status = 'role_reveal';
          room.gameStartedAt = Date.now();
          room.gameEndedAt = undefined;
          room.assassinationStartedAt = undefined;
          initializeBotMemories(room);
          broadcastRoom(room, io);
          handleBotActions(room, io, broadcastRoom, recordGameStats);
        }
      } catch (err) {
        console.error('Error in start_game:', err);
      }
    });

    socket.on('ready_team_building', ({ roomId }) => {
      try {
        const room = rooms[roomId];
        if (room && room.status === 'role_reveal') {
          touchRoom(room);
          room.status = 'team_building';
          broadcastRoom(room, io);
          handleBotActions(room, io, broadcastRoom, recordGameStats);
        }
      } catch (err) {
        console.error('Error in ready_team_building:', err);
      }
    });

    socket.on('propose_team', ({ roomId, team }) => {
      try {
        const room = rooms[roomId];
        if (room && room.status === 'team_building') {
          touchRoom(room);
          room.gameState.proposedTeam = team;
          room.status = 'team_proposed';
          room.gameState.teamVotes = {};
          broadcastRoom(room, io);
          handleBotActions(room, io, broadcastRoom, recordGameStats);
        }
      } catch (err) {
        console.error('Error in propose_team:', err);
      }
    });

    socket.on('start_voting', ({ roomId }) => {
      try {
        const room = rooms[roomId];
        if (room && room.status === 'team_proposed') {
          touchRoom(room);
          room.status = 'team_voting';
          room.gameState.teamVotes = {};
          broadcastRoom(room, io);
          handleBotActions(room, io, broadcastRoom, recordGameStats);
        }
      } catch (err) {
        console.error('Error in start_voting:', err);
      }
    });

    socket.on('change_team', ({ roomId }) => {
      try {
        const room = rooms[roomId];
        if (room && room.status === 'team_proposed') {
          touchRoom(room);
          room.status = 'team_building';
          room.gameState.proposedTeam = [];
          broadcastRoom(room, io);
          handleBotActions(room, io, broadcastRoom, recordGameStats);
        }
      } catch (err) {
        console.error('Error in change_team:', err);
      }
    });

    socket.on('vote_team', ({ roomId, approve }) => {
      try {
        // SECURITY: Use server-side identity, ignore client-sent sessionId
        const sessionId = socketToSession[socket.id];
        if (!sessionId) return;
        const room = rooms[roomId];
        if (room && room.status === 'team_voting') {
          touchRoom(room);
          room.gameState.teamVotes[sessionId] = approve;
          checkTeamVotes(room, io);
        }
      } catch (err) {
        console.error('Error in vote_team:', err);
      }
    });

    socket.on('continue_vote_reveal', ({ roomId }) => {
      try {
        const room = rooms[roomId];
        if (room && room.status === 'team_vote_reveal') {
          touchRoom(room);
          applyTeamVoteResult(room, io);
        }
      } catch (err) {
        console.error('Error in continue_vote_reveal:', err);
      }
    });

    socket.on('continue_quest_result', ({ roomId }) => {
      try {
        const room = rooms[roomId];
        if (room && room.status === 'quest_result') {
          touchRoom(room);
          applyQuestResult(room, io);
        }
      } catch (err) {
        console.error('Error in continue_quest_result:', err);
      }
    });

    socket.on('use_lady_of_the_lake', ({ roomId, targetSessionId }) => {
      try {
        const sessionId = socketToSession[socket.id];
        if (!sessionId) return;
        const room = rooms[roomId];
        if (room && room.status === 'lady_of_the_lake') {
          // Verify that sender is the current holder
          if (room.gameState.ladyOfTheLakeHolder === sessionId) {
            // Verify target is valid and not already held/checked
            if (targetSessionId !== sessionId && !room.gameState.ladyOfTheLakeHistory?.includes(targetSessionId)) {
              executeLadyOfTheLakeCheck(room, targetSessionId, io);
            }
          }
        }
      } catch (err) {
        console.error('Error in use_lady_of_the_lake:', err);
      }
    });

    socket.on('continue_lady_of_the_lake', ({ roomId }) => {
      try {
        const room = rooms[roomId];
        if (room && room.status === 'lady_of_the_lake_reveal') {
          touchRoom(room);
          applyLadyOfTheLakeContinuation(room, io);
        }
      } catch (err) {
        console.error('Error in continue_lady_of_the_lake:', err);
      }
    });

    socket.on('vote_quest', ({ roomId, success }) => {
      try {
        // SECURITY: Use server-side identity, ignore client-sent sessionId
        const sessionId = socketToSession[socket.id];
        if (!sessionId) return;
        const room = rooms[roomId];
        if (room && room.status === 'quest_voting') {
          touchRoom(room);
          const quest = room.gameState.quests[room.gameState.currentQuestIndex];
          quest.votes[sessionId] = success;
          checkQuestVotes(room, io);
        }
      } catch (err) {
        console.error('Error in vote_quest:', err);
      }
    });

    socket.on('assassinate', ({ roomId, targetSessionId }) => {
      try {
        // SECURITY: Use server-side identity, ignore client-sent sessionId
        const sessionId = socketToSession[socket.id];
        if (!sessionId) return;
        const room = rooms[roomId];
        if (room && room.status === 'assassin') {
          touchRoom(room);
          const sender = room.players.find(p => p.sessionId === sessionId);
          const assassin = room.players.find(p => p.role === 'Assassin');
          const isEvil = sender && EVIL_ROLES.has(sender.role as Role);

          const canAssassinate = sender?.role === 'Assassin' || (isEvil && assassin?.isBot);

          if (canAssassinate) {
            room.gameState.assassinationTarget = targetSessionId;
            const target = room.players.find(p => p.sessionId === targetSessionId);

            if (target && target.role === 'Merlin') {
              room.gameState.winner = 'evil';
            } else {
              room.gameState.winner = 'good';
            }
            room.status = 'game_over'; room.gameEndedAt = Date.now();
            recordGameStats(room);
            broadcastRoom(room, io);
          }
        }
      } catch (err) {
        console.error('Error in assassinate:', err);
      }
    });

    socket.on('trigger_strike', ({ roomId }) => {
      try {
        const sessionId = socketToSession[socket.id];
        if (!sessionId) return;
        const room = rooms[roomId];
        if (
          room &&
          room.gameState.strikeHolderSessionId === sessionId &&
          room.gameState.currentQuestIndex >= 1 &&
          !['lobby', 'role_reveal', 'assassin', 'game_over'].includes(room.status)
        ) {
          touchRoom(room);
          room.status = 'assassin';
          room.assassinationStartedAt = Date.now();
          broadcastRoom(room, io);
          handleBotActions(room, io, broadcastRoom, recordGameStats);
        }
      } catch (err) {
        console.error('Error in trigger_strike:', err);
      }
    });

    socket.on('leave_room', ({ roomId }) => {
      try {
        // SECURITY: Use server-side identity
        const sessionId = socketToSession[socket.id];
        if (!sessionId) return;
        const room = rooms[roomId];
        if (room) {
          // Remove player from room
          const isLeavingHost = room.players.find(p => p.sessionId === sessionId)?.isHost;
          room.players = room.players.filter(p => p.sessionId !== sessionId);

          // Reassign host if there are human players left
          const humanPlayers = room.players.filter(p => !p.isBot);
          if (isLeavingHost && humanPlayers.length > 0) {
            room.players.find(p => p.sessionId === humanPlayers[0].sessionId)!.isHost = true;
          }

          if (humanPlayers.length === 0) {
            // Clean up room if no humans left
            delete rooms[roomId];
          } else {
            // Notify remaining players
            broadcastRoom(room, io);
          }
        }
        socket.leave(roomId);
      } catch (err) {
        console.error('Error in leave_room:', err);
      }
    });

    socket.on('kick_player', ({ roomId, targetSessionId }) => {
      try {
        const room = rooms[roomId];
        if (room) {
          const sender = room.players.find(p => p.id === socket.id);
          if (sender && sender.isHost) {
            const targetPlayer = room.players.find(p => p.sessionId === targetSessionId);
            if (targetPlayer) {
              room.players = room.players.filter(p => p.sessionId !== targetSessionId);
              if (targetPlayer.id) {
                io.to(targetPlayer.id).emit('kicked');
              }
              broadcastRoom(room, io);
            }
          }
        }
      } catch (err) {
        console.error('Error in kick_player:', err);
      }
    });

    socket.on('end_game', ({ roomId }) => {
      try {
        const room = rooms[roomId];
        if (room) {
          const sender = room.players.find(p => p.id === socket.id);
          if (sender && sender.isHost) {
            io.to(roomId).emit('game_ended');
            delete rooms[roomId];
          }
        }
      } catch (err) {
        console.error('Error in end_game:', err);
      }
    });

    socket.on('restart_game', ({ roomId }) => {
      try {
        const room = rooms[roomId];
        if (room && room.status === 'game_over') {
          // Only host can restart
          const sender = room.players.find(p => p.id === socket.id);
          if (sender && sender.isHost) {
            // Remove bots, keep human players
            room.players = room.players.filter(p => !p.isBot);
            // Reset all player roles
            room.players.forEach(p => { p.role = undefined; });
            // Reset room to lobby
            room.status = 'lobby';
            room.gameState = {
              quests: [],
              currentQuestIndex: 0,
              voteTrack: 0,
              leaderIndex: 0,
              proposedTeam: [],
              teamVotes: {},
              winner: null,
              assassinationTarget: null,
              voteHistory: [],
              botMemories: {},
              botMindLogs: {},
              ladyOfTheLakeHistory: [],
              ladyOfTheLakeChecks: []
            };
            room.gameStartedAt = Date.now();
            room.gameEndedAt = undefined;
            room.assassinationStartedAt = undefined;
            broadcastRoom(room, io);
          }
        }
      } catch (err) {
        console.error('Error in restart_game:', err);
      }
    });

    socket.on('room_activity_ping', ({ roomId }) => {
      try {
        const room = rooms[roomId];
        if (room) {
          touchRoom(room);
          // Notify all clients that idle warning is cancelled
          io.to(roomId).emit('room_idle_cancelled');
        }
      } catch (err) {
        console.error('Error in room_activity_ping:', err);
      }
    });

    socket.on('disconnect', () => {
      try {
        // SECURITY: Clean up socket → session mapping
        delete socketToSession[socket.id];
        // Find player and mark as disconnected
        for (const roomId in rooms) {
          const room = rooms[roomId];
          const player = room.players.find(p => p.id === socket.id);
          if (player) {
            player.isConnected = false;
            broadcastRoom(room, io);
          }
        }
      } catch (err) {
        console.error('Error in disconnect:', err);
      }
    });
  });
}

startServer();
