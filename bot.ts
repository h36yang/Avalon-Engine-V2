import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { encode } from '@toon-format/toon';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Role, Player, EVIL_ROLES, generateSecureRandomNumber } from './src/utils/gameLogic';
import { MindLogEntry, Room as ClientRoom } from './src/store';
import { Server } from 'socket.io';

// Resolve project root directory (works with both ESM and CJS)
const projectRootUrl = fileURLToPath(import.meta.url);
// @ts-ignore - __dirname exists at runtime in tsx/CJS
const __projectDir = typeof __dirname !== 'undefined' ? __dirname : dirname(projectRootUrl);

// ─── Re-export the Room / BotMemory types ────────────────────────────────────
// (Room is defined here because it extends ClientRoom with bot-specific fields)

export interface BotMemory {
  trustScores: Record<string, number>; // sessionId -> score (0-100)
  knownRoles: Record<string, Role | 'Good' | 'Evil'>; // sessionId -> known role/alignment
  merlinSuspicion: Record<string, number>; // sessionId -> score (0-100), used by evil
  failAssociation: Record<string, number>; // sessionId -> number of failed quests they were on
  votePatterns: Record<string, { approvedEvil: number; rejectedEvil: number; totalVotes: number }>;
  percivalCandidates?: { a: string; b: string; merlinLikelihood: Record<string, number> };
}

export interface Room extends Omit<ClientRoom, 'gameState'> {
  gameState: ClientRoom['gameState'] & {
    botMemories: Record<string, BotMemory>; // bot sessionId -> memory
    botMindLogs: Record<string, MindLogEntry[]>; // override to make required
  };
  lastActivityTime: number;
  idleWarningEmitted: boolean;
}

// ─── Prompt Loading ───────────────────────────────────────────────────────────

// Load role prompt files for AI bots
const ROLE_PROMPTS: Record<string, string> = {};
let COMMON_STRATEGY_PROMPT = '';
const ROLE_PROMPT_FILES: Record<string, string> = {
  'Merlin': 'merlin.md',
  'Percival': 'percival.md',
  'Loyal Servant': 'loyal_servant.md',
  'Morgana': 'morgana.md',
  'Assassin': 'assassin.md',
  'Mordred': 'mordred.md',
  'Oberon': 'oberon.md',
  'Minion': 'minion.md',
};
try {
  COMMON_STRATEGY_PROMPT = readFileSync(join(__projectDir, 'server', 'prompts', 'common_strategy.md'), 'utf-8');
} catch {
  console.warn('Warning: Could not load shared strategy prompt from server/prompts/common_strategy.md');
  COMMON_STRATEGY_PROMPT = '';
}
for (const [role, file] of Object.entries(ROLE_PROMPT_FILES)) {
  try {
    ROLE_PROMPTS[role] = readFileSync(join(__projectDir, 'server', 'prompts', file), 'utf-8');
  } catch {
    console.warn(`Warning: Could not load prompt for ${role} from server/prompts/${file}`);
    ROLE_PROMPTS[role] = `You are playing Avalon as ${role}. Play strategically.`;
  }
}

export function getBotSystemPrompt(role: string): string {
  const rolePrompt = ROLE_PROMPTS[role] || '';
  if (COMMON_STRATEGY_PROMPT && rolePrompt) {
    return `${COMMON_STRATEGY_PROMPT}\n\n${rolePrompt}`;
  }
  return COMMON_STRATEGY_PROMPT || rolePrompt;
}

// ─── Model Defaults ───────────────────────────────────────────────────────────

export const DEFAULT_MODELS: Record<string, string> = {
  gemini: 'gemini-2.0-flash-lite',
  openrouter: 'google/gemini-2.0-flash-exp:free',
  groq: 'llama-3.3-70b-versatile',
  nvidia: 'meta/llama-3.3-70b-instruct',
};

// ─── Low-level LLM Helpers ────────────────────────────────────────────────────

export async function callOpenAICompatible(
  baseUrl: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  const data = await response.json() as any;
  return data.choices?.[0]?.message?.content ?? '';
}

async function callAIForDecision(bot: Player, systemPrompt: string, userPrompt: string): Promise<string> {
  const provider = bot.provider ?? 'gemini';
  const model = bot.model || DEFAULT_MODELS[provider] || DEFAULT_MODELS.gemini;
  const AI_TIMEOUT_MS = 60000;

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`AI decision timeout after ${AI_TIMEOUT_MS}ms`)), AI_TIMEOUT_MS)
  );

  let apiPromise: Promise<string>;
  if (provider === 'gemini') {
    const genAI = new GoogleGenAI({ apiKey: bot.apiKey! });
    apiPromise = genAI.models.generateContent({
      model,
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
      },
    }).then(response => response.text || '');
  } else {
    const BASE_URLS: Record<string, string> = {
      openrouter: 'https://openrouter.ai/api/v1',
      groq: 'https://api.groq.com/openai/v1',
      nvidia: 'https://integrate.api.nvidia.com/v1',
    };
    apiPromise = callOpenAICompatible(BASE_URLS[provider], bot.apiKey!, model, systemPrompt, userPrompt);
  }

  return Promise.race([apiPromise, timeoutPromise]);
}

// ─── Mind Log ─────────────────────────────────────────────────────────────────

export function addMindLog(room: Room, botId: string, phase: string, prompt: string, response: string, decision: string) {
  if (!room.gameState.botMindLogs[botId]) room.gameState.botMindLogs[botId] = [];
  room.gameState.botMindLogs[botId].push({ phase, prompt, response, decision, timestamp: Date.now() });
}

// ─── Context Mapping Helpers ──────────────────────────────────────────────────

function mapTrustScoresToNames(room: Room, trustScores: Record<string, number>): {
  name: string,
  score: number,
}[] {
  return Object.entries(trustScores).map(([sessionId, score]) => ({
    name: room.players.find(p => p.sessionId === sessionId)!.name,
    score
  }));
}

function mapKnownRolesToNames(room: Room, knownRoles: Record<string, Role | "Evil" | "Good">): {
  name: string,
  role: Role | "Evil" | "Good",
}[] {
  return Object.entries(knownRoles).map(([sessionId, role]) => ({
    name: room.players.find(p => p.sessionId === sessionId)!.name,
    role
  }));
}

function getQuestResults(room: Room): {
  status: 'pending' | 'success' | 'fail',
  team: string[],
  failVotesCount: number,
}[] {
  return room.gameState.quests.map((q) => ({
    status: q.status,
    team: q.team.map(sessionId => room.players.find(p => p.sessionId === sessionId)!.name),
    failVotesCount: Object.values(q.votes).filter(v => !v).length
  }));
}

function getVoteHistory(room: Room): {
  questIndex: number;
  voteTrack: number;
  leader: string;
  proposedTeam: string[];
  votes: { name: string, approved: boolean }[];
  approved: boolean;
}[] {
  return room.gameState.voteHistory.map(v => ({
    questIndex: v.questIndex,
    voteTrack: v.voteTrack,
    leader: room.players[v.leaderIndex].name,
    proposedTeam: v.proposedTeam.map(sessionId => room.players.find(p => p.sessionId === sessionId)!.name),
    votes: Object.entries(v.votes).map(([sessionId, approved]) => ({
      name: room.players.find(p => p.sessionId === sessionId)!.name,
      approved
    })),
    approved: v.approved
  }));
}

function mapPercivalCandidatesToNames(room: Room, merlinLikelihood: Record<string, number>): {
  name: string,
  likelihood: number,
}[] {
  return Object.entries(merlinLikelihood).map(([sessionId, likelihood]) => ({
    name: room.players.find(p => p.sessionId === sessionId)!.name,
    likelihood
  }));
}

// ─── Memory Initialisation ────────────────────────────────────────────────────

export function initializeBotMemories(room: Room) {
  const gameHasMordred = room.players.some(p => p.role === 'Mordred');

  for (const bot of room.players) {
    if (!bot.isBot) continue;

    const difficulty = bot.difficulty || 'normal';
    const memory: BotMemory = {
      trustScores: {},
      knownRoles: {},
      merlinSuspicion: {},
      failAssociation: {},
      votePatterns: {}
    };

    const isBotEvil = EVIL_ROLES.has(bot.role!);
    let merlinCandidateA: string | undefined;
    let merlinCandidateB: string | undefined;

    for (const p of room.players) {
      // Default trust is 50. In hard mode, good bots start a bit more neutral, evil bots distrust good more.
      memory.trustScores[p.sessionId] = difficulty === 'hard' ? 40 : 50;
      memory.failAssociation[p.sessionId] = 0;
      memory.votePatterns[p.sessionId] = { approvedEvil: 0, rejectedEvil: 0, totalVotes: 0 };

      if (isBotEvil) {
        memory.merlinSuspicion[p.sessionId] = 0;
      }

      if (p.sessionId === bot.sessionId) {
        memory.trustScores[p.sessionId] = 100; // Trust self completely
        memory.knownRoles[p.sessionId] = bot.role!;
        continue;
      }

      const botRole = bot.role!;
      const targetRole = p.role!;
      const isTargetEvil = EVIL_ROLES.has(targetRole);

      if (botRole === 'Merlin') {
        // Merlin knows all evil except Mordred
        if (isTargetEvil && targetRole !== 'Mordred') {
          memory.trustScores[p.sessionId] = 0;
          memory.knownRoles[p.sessionId] = 'Evil';
        } else {
          if (gameHasMordred) {
            memory.trustScores[p.sessionId] = difficulty === 'hard' ? 60 : 70;
          } else {
            memory.trustScores[p.sessionId] = 100;
            memory.knownRoles[p.sessionId] = 'Good';
          }
        }
      } else if (botRole === 'Percival') {
        // Percival knows Merlin and Morgana but not which is which
        if (targetRole === 'Merlin' || targetRole === 'Morgana') {
          memory.trustScores[p.sessionId] = difficulty === 'hard' ? 50 : 60;

          if (!merlinCandidateA) {
            merlinCandidateA = p.sessionId;
          } else if (!merlinCandidateB) {
            merlinCandidateB = p.sessionId;
          }
        }
      } else if (isBotEvil && botRole !== 'Oberon') {
        // Evil knows other evil (except Oberon)
        if (isTargetEvil && targetRole !== 'Oberon') {
          memory.trustScores[p.sessionId] = 100;
          memory.knownRoles[p.sessionId] = 'Evil';
        } else {
          memory.trustScores[p.sessionId] = 0; // Distrust all good players
          memory.knownRoles[p.sessionId] = 'Good';
        }
      }
    }

    if (bot.role === 'Percival' && merlinCandidateA && merlinCandidateB) {
      memory.percivalCandidates = {
        a: merlinCandidateA,
        b: merlinCandidateB,
        merlinLikelihood: {
          [merlinCandidateA]: 50,
          [merlinCandidateB]: 50,
        }
      };
    }

    room.gameState.botMemories[bot.sessionId] = memory;
  }
}

// ─── Bot Name Generation ──────────────────────────────────────────────────────

export function getNextBotName(room: Room, isAI: boolean): string {
  const prefix = isAI ? 'AI' : 'Bot';
  const existing = new Set(
    room.players
      .filter(p => p.isBot && p.name.startsWith(prefix + ' '))
      .map(p => parseInt(p.name.slice(prefix.length + 1), 10))
      .filter(n => !isNaN(n))
  );
  let next = 1;
  while (existing.has(next)) next++;
  return `${prefix} ${next}`;
}

// ─── AI Game Context Builder ──────────────────────────────────────────────────

// === AI Bot LLM Decision Functions ===

function buildAIGameContext(room: Room, bot: Player): string {
  const memory = room.gameState.botMemories[bot.sessionId];
  const isEvil = EVIL_ROLES.has(bot.role as Role);

  let context = `你是 "${bot.name}"，你的秘密角色是 ${bot.role}（${isEvil ? '邪恶阵营' : '好人阵营'}）。\n\n`;

  // Role-specific knowledge
  if (bot.role === 'Merlin') {
    const evilPlayers = room.players.filter(p => {
      const r = p.role as string;
      return ['Assassin', 'Morgana', 'Minion', 'Oberon'].includes(r); // Merlin can't see Mordred
    });
    context += `你能看到的坏人: ${evilPlayers.map(p => p.name).join(', ') || '无'}\n`;
  } else if (bot.role === 'Percival' && memory.percivalCandidates) {
    const nameA = room.players.find(p => p.sessionId === memory.percivalCandidates!.a)?.name;
    const nameB = room.players.find(p => p.sessionId === memory.percivalCandidates!.b)?.name;
    context += `你的拇指牌（梅林或莫甘娜）: ${nameA}, ${nameB}\n`;
  } else if (isEvil && bot.role !== 'Oberon') {
    const evilTeammates = room.players.filter(p =>
      p.sessionId !== bot.sessionId &&
      ['Assassin', 'Morgana', 'Mordred', 'Minion'].includes(p.role as string)
    );
    context += `你的邪恶队友: ${evilTeammates.map(p => p.name).join(', ') || '无'}\n`;
  }

  // Player list
  context += `\n所有玩家: ${room.players.map(p => p.name).join(', ')}\n`;

  // Quest results
  const questResults = room.gameState.quests.map((q, i) => {
    if (q.status === 'pending') return `任务${i + 1}: 未开始`;
    const teamNames = q.team.map(id => room.players.find(p => p.sessionId === id)?.name).join(', ');
    const fails = Object.values(q.votes).filter(v => !v).length;
    return `任务${i + 1}: ${q.status === 'success' ? '成功' : `失败(${fails}张失败票)`} 队伍:[${teamNames}]`;
  }).join('\n');
  context += `\n任务结果:\n${questResults}\n`;

  // Vote history
  if (room.gameState.voteHistory.length > 0) {
    const recentVotes = room.gameState.voteHistory.slice(-5).map(h => {
      const leaderName = room.players[h.leaderIndex]?.name;
      const teamNames = h.proposedTeam.map(id => room.players.find(p => p.sessionId === id)?.name).join(', ');
      const voteDetails = Object.entries(h.votes).map(([sid, approved]) => {
        const name = room.players.find(p => p.sessionId === sid)?.name;
        return `${name}:${approved ? '赞成' : '反对'}`;
      }).join(', ');
      return `任务${h.questIndex + 1} 第${h.voteTrack + 1}次投票 队长:${leaderName} 队伍:[${teamNames}] ${h.approved ? '通过' : '否决'} 投票:${voteDetails}`;
    }).join('\n');
    context += `\n最近投票历史:\n${recentVotes}\n`;
  }

  context += `\n当前任务: 第${room.gameState.currentQuestIndex + 1}个任务\n`;
  context += `投票失败次数: ${room.gameState.voteTrack}/5\n`;

  return context;
}

// ─── AI Decision Functions ────────────────────────────────────────────────────

export async function aiTeamBuilding(room: Room, bot: Player, teamSize: number, io: Server): Promise<string[]> {
  const rolePrompt = getBotSystemPrompt(bot.role as string);
  const gameContext = buildAIGameContext(room, bot);
  const playerNames = room.players.map(p => p.name);

  const userPrompt = `${gameContext}

你现在是队长，需要选择 ${teamSize} 名队员组队执行任务。

可选队员: ${playerNames.join(', ')}

请根据你的角色策略和当前局势选择队伍。

请严格按以下格式回答（不要加任何其他内容）:
思考: [你的分析，1-3句话]
队伍: [用逗号分隔的玩家名字]`;

  try {
    const response = await callAIForDecision(bot, rolePrompt, userPrompt);
    addMindLog(room, bot.sessionId, 'team_building', userPrompt, response, '');

    // Parse team from response
    const teamMatch = response.match(/队伍[:：]\s*(.+)/);
    if (teamMatch) {
      const names = teamMatch[1].split(/[,，、]/).map(n => n.trim()).filter(Boolean);
      const team: string[] = [];
      for (const name of names) {
        const player = room.players.find(p => p.name === name);
        if (player && !team.includes(player.sessionId)) {
          team.push(player.sessionId);
        }
        if (team.length >= teamSize) break;
      }

      // Fill remaining slots if AI didn't pick enough
      if (team.length < teamSize) {
        // Always include self
        if (!team.includes(bot.sessionId)) team.push(bot.sessionId);
        const remaining = room.players.filter(p => !team.includes(p.sessionId));
        while (team.length < teamSize && remaining.length > 0) {
          team.push(remaining.shift()!.sessionId);
        }
      }

      // Update mind log with final decision
      const lastLog = room.gameState.botMindLogs[bot.sessionId];
      if (lastLog.length > 0) lastLog[lastLog.length - 1].decision = `Team: ${team.map(id => room.players.find(p => p.sessionId === id)?.name).join(', ')}`;

      return team.slice(0, teamSize);
    }
  } catch (err: any) {
    console.error(`AI team building error for ${bot.name}:`, err?.message || err);
    addMindLog(room, bot.sessionId, 'team_building', userPrompt, `Error: ${err?.message || err}`, 'fallback');
  }

  // Fallback: include self + random others
  const team = [bot.sessionId];
  const others = room.players.filter(p => p.sessionId !== bot.sessionId).sort(() => generateSecureRandomNumber() - 0.5);
  while (team.length < teamSize && others.length > 0) {
    team.push(others.shift()!.sessionId);
  }
  return team;
}

export async function aiTeamVote(room: Room, bot: Player): Promise<boolean> {
  const rolePrompt = getBotSystemPrompt(bot.role as string);
  const gameContext = buildAIGameContext(room, bot);
  const leaderName = room.players[room.gameState.leaderIndex]?.name;
  const teamNames = room.gameState.proposedTeam.map(id => room.players.find(p => p.sessionId === id)?.name).join(', ');

  const userPrompt = `${gameContext}

队长 ${leaderName} 提议了以下队伍: [${teamNames}]
这是第 ${room.gameState.voteTrack + 1}/5 次投票。${room.gameState.voteTrack === 4 ? '（注意：如果这次否决，邪恶阵营将直接获胜！）' : ''}

请根据你的角色策略决定是否赞成这个队伍。

请严格按以下格式回答:
思考: [你的分析，1-3句话]
投票: 赞成 或 反对`;

  try {
    const response = await callAIForDecision(bot, rolePrompt, userPrompt);
    const approve = response.includes('赞成') && !response.match(/投票[:：]\s*反对/);
    const voteDecision = response.match(/投票[:：]\s*(赞成|反对)/);
    const finalApprove = voteDecision ? voteDecision[1] === '赞成' : approve;

    addMindLog(room, bot.sessionId, 'team_vote', userPrompt, response, finalApprove ? '赞成' : '反对');
    return finalApprove;
  } catch (err: any) {
    console.error(`AI team vote error for ${bot.name}:`, err?.message || err);
    addMindLog(room, bot.sessionId, 'team_vote', userPrompt, `Error: ${err?.message || err}`, 'fallback: approve');

    // Fallback: approve on last vote, otherwise 50/50
    return room.gameState.voteTrack === 4 || generateSecureRandomNumber() > 0.5;
  }
}

export async function aiQuestVote(room: Room, bot: Player): Promise<boolean> {
  const rolePrompt = getBotSystemPrompt(bot.role as string);
  const gameContext = buildAIGameContext(room, bot);
  const isEvil = EVIL_ROLES.has(bot.role as Role);
  const currentQuest = room.gameState.quests[room.gameState.currentQuestIndex];
  const teamNames = room.gameState.proposedTeam.map(id => room.players.find(p => p.sessionId === id)?.name).join(', ');

  const userPrompt = `${gameContext}

你在任务队伍中: [${teamNames}]
${currentQuest.requiresTwoFails ? '（这个任务需要2张失败票才会失败）' : ''}

你必须选择: 成功 或 失败
${isEvil ? '作为邪恶阵营，你可以选择投失败来破坏任务，也可以投成功来隐藏身份。' : '作为好人阵营，你应该投成功。'}

请严格按以下格式回答:
思考: [你的分析，1-3句话]
任务投票: 成功 或 失败`;

  try {
    const response = await callAIForDecision(bot, rolePrompt, userPrompt);
    const voteMatch = response.match(/任务投票[:：]\s*(成功|失败)/);
    let success: boolean;

    if (voteMatch) {
      success = voteMatch[1] === '成功';
    } else {
      // Good players always succeed, evil defaults to fail
      success = !isEvil;
    }

    addMindLog(room, bot.sessionId, 'quest_vote', userPrompt, response, success ? '成功' : '失败');
    return success;
  } catch (err: any) {
    console.error(`AI quest vote error for ${bot.name}:`, err?.message || err);
    addMindLog(room, bot.sessionId, 'quest_vote', userPrompt, `Error: ${err?.message || err}`, `fallback: ${isEvil ? '失败' : '成功'}`);

    // Fallback: good always success, evil always fail
    return !isEvil;
  }
}

export async function aiAssassinate(room: Room, bot: Player): Promise<string> {
  const rolePrompt = getBotSystemPrompt(bot.role as string);
  const gameContext = buildAIGameContext(room, bot);
  const goodPlayers = room.players.filter(p => !EVIL_ROLES.has(p.role as Role));

  const userPrompt = `${gameContext}

好人完成了3个任务！作为刺客，你现在必须选择一名玩家刺杀。如果你选中梅林，邪恶阵营获胜！

可刺杀的好人玩家: ${goodPlayers.map(p => p.name).join(', ')}

综合分析整场游戏的投票记录、组队历史和发言，找出最可能是梅林的玩家。

请严格按以下格式回答:
分析: [你对每个好人的分析，2-4句话]
刺杀目标: [一个玩家名字]`;

  try {
    const response = await callAIForDecision(bot, rolePrompt, userPrompt);
    const targetMatch = response.match(/刺杀目标[:：]\s*(.+)/);

    if (targetMatch) {
      const targetName = targetMatch[1].trim();
      const target = goodPlayers.find(p => p.name === targetName);
      if (target) {
        addMindLog(room, bot.sessionId, 'assassination', userPrompt, response, `Target: ${target.name}`);
        return target.sessionId;
      }
    }

    // Try fuzzy match
    for (const p of goodPlayers) {
      if (response.includes(p.name)) {
        addMindLog(room, bot.sessionId, 'assassination', userPrompt, response, `Target (fuzzy): ${p.name}`);
        return p.sessionId;
      }
    }
  } catch (err: any) {
    console.error(`AI assassination error for ${bot.name}:`, err?.message || err);
    addMindLog(room, bot.sessionId, 'assassination', userPrompt, `Error: ${err?.message || err}`, 'fallback: random');
  }

  // Fallback: random good player
  return goodPlayers[Math.floor(generateSecureRandomNumber() * goodPlayers.length)].sessionId;
}

// ─── Bot Opinions (LLM) ───────────────────────────────────────────────────────

export async function triggerBotOpinions(room: Room, io: Server, broadcastRoom: (room: Room, io: Server) => void) {
  const botsWithKeys = room.players.filter(p => p.isBot && p.botClass === 'ai' && p.apiKey);
  if (botsWithKeys.length === 0) return;

  room.gameState.botOpinions ??= [];
  broadcastRoom(room, io);

  console.log('Triggering bot opinions...');
  for (const bot of botsWithKeys) {
    try {
      const isEvil = EVIL_ROLES.has(bot.role as Role);

      const memory = room.gameState.botMemories[bot.sessionId];
      const leaderName = room.players[room.gameState.leaderIndex].name;

      let conditionalRoleInstructionClause: string | undefined;
      if (bot.role === 'Merlin') {
        conditionalRoleInstructionClause = `You need to protect your secret identity. Only comment on other players when you have strong evidence based on the quests and team vote history. Otherwise, say you don't have much information.`;
      } else if (bot.role === 'Percival') {
        conditionalRoleInstructionClause = `You need to protect Merlin's identity. Only comment on your Merlin candidates when you have strong evidence based on the quests and team vote history. Otherwise, comment on other players.

Your Merlin candidates:
${encode(mapPercivalCandidatesToNames(room, memory.percivalCandidates?.merlinLikelihood ?? {}))}`;
      } else if (isEvil) {
        conditionalRoleInstructionClause = `Form your opinion as if you are a good player. Rat out your evil teammate if necessary.`;
      }

      const prompt = `Provide a very short opinion about the game state, addressing the other players, based on the following information.

Your current trust of others (0 is completely distrust, 100 is completely trust):
${encode(mapTrustScoresToNames(room, memory.trustScores))}

Your known roles:
${encode(mapKnownRolesToNames(room, memory.knownRoles))}

Quest results:
${encode(getQuestResults(room))}

Team vote history:
${encode(getVoteHistory(room))}

The current leader forming the team is "${leaderName}".`;

      const combinedRolePrompt = getBotSystemPrompt(bot.role as string);
      const systemInstruction = `${combinedRolePrompt}

你正在以 "${bot.name}" 的身份发言，你的秘密角色是 ${bot.role}（${isEvil ? '邪恶阵营' : '好人阵营'}）。

发言要求:
- 以人类玩家的口吻发言。
- 简短随意（2-3句话）。
- 不要暴露你的秘密角色。
- 基于任务和投票历史分析，不要直接透露你的已知信息。
- 对当前队长提出建议。如果你不信任队长，可以直接说。
- 用中文回答，不要使用markdown格式。` + (conditionalRoleInstructionClause ? `

额外角色指导:
${conditionalRoleInstructionClause}` : '');

      const provider = bot.provider ?? 'gemini';
      const model = bot.model || DEFAULT_MODELS[provider] || DEFAULT_MODELS.gemini;

      let text: string;
      if (provider === 'gemini') {
        const genAI = new GoogleGenAI({ apiKey: bot.apiKey! });
        const response = await genAI.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction,
            thinkingConfig: {
              // High thinking level for dynamic thinking and maximizing reasoning depth.
              // https://ai.google.dev/gemini-api/docs/gemini-3#thinking_level
              thinkingLevel: ThinkingLevel.HIGH,
            },
          },
        });
        text = response.text || '';
      } else {
        const BASE_URLS: Record<string, string> = {
          openrouter: 'https://openrouter.ai/api/v1',
          groq: 'https://api.groq.com/openai/v1',
          nvidia: 'https://integrate.api.nvidia.com/v1',
        };
        text = await callOpenAICompatible(BASE_URLS[provider], bot.apiKey!, model, systemInstruction, prompt);
      }

      console.log(`Opinion generated successfully for ${bot.name}.`);
      addMindLog(room, bot.sessionId, 'opinion', prompt, text, text.slice(0, 100));
      room.gameState.botOpinions.push({ botId: bot.sessionId, text });
      broadcastRoom(room, io);
    } catch (err: any) {
      const raw = err?.message || String(err);
      console.error(`Error generating opinion for ${bot.name}:`, raw);
      const httpMatch = raw.match(/HTTP (\d+)/);
      let userMsg: string;
      if (httpMatch) {
        const s = parseInt(httpMatch[1]);
        if (s === 401) userMsg = 'API error: Invalid API key (401)';
        else if (s === 403) userMsg = 'API error: Access denied (403)';
        else if (s === 404) userMsg = 'API error: Model not found (404)';
        else if (s === 429) userMsg = 'API error: Rate limited (429)';
        else userMsg = `API error: HTTP ${s}`;
      } else if (/timeout/i.test(raw)) {
        userMsg = 'API error: Connection timeout';
      } else {
        userMsg = 'API error: ' + raw.slice(0, 120);
      }
      room.gameState.botOpinions.push({ botId: bot.sessionId, text: userMsg, isError: true });
      broadcastRoom(room, io);
    }
  }
}

// ─── Vote Analysis (called after team votes are tallied) ──────────────────────

export function updateBotMemoriesAfterTeamVote(room: Room) {
  const goodPlayersCount = room.players.filter(p => !EVIL_ROLES.has(p.role!)).length;

  for (const bot of room.players) {
    if (!bot.isBot) continue;

    // --- Improvement A: Vote History Analysis ---
    // Good bots learn who approves/rejects teams with evil. Evil bots learn who acts like Merlin.
    const difficulty = bot.difficulty || 'normal';
    const trustDelta = difficulty === 'hard' ? 15 : 5;
    const suspicionDelta = difficulty === 'hard' ? 15 : 5;

    const memory = room.gameState.botMemories[bot.sessionId];
    const isBotEvil = EVIL_ROLES.has(bot.role!);

    let teamHadKnownEvil = room.gameState.proposedTeam.some(id =>
      memory.knownRoles[id] === 'Evil' || (isBotEvil && id === bot.sessionId),
    );
    // Special case 1: bot is Percival and proposed team includes both Merlin and Morgana candidates.
    if (bot.role === 'Percival' && memory.percivalCandidates) {
      const { a, b } = memory.percivalCandidates;
      if (room.gameState.proposedTeam.includes(a) && room.gameState.proposedTeam.includes(b)) {
        teamHadKnownEvil = true;
      }
    }
    // Special case 2: bot is Good, proposed team needs all Good players but does not include Good bot itself.
    if (!isBotEvil && room.gameState.proposedTeam.length === goodPlayersCount && !room.gameState.proposedTeam.includes(bot.sessionId)) {
      teamHadKnownEvil = true;
    }

    for (const p of room.players) {
      if (p.sessionId === bot.sessionId) continue;

      const votedApprove = room.gameState.teamVotes[p.sessionId];

      // Update general vote patterns
      if (teamHadKnownEvil) {
        if (votedApprove) {
          memory.votePatterns[p.sessionId].approvedEvil++;
        } else {
          memory.votePatterns[p.sessionId].rejectedEvil++;
        }
      }
      memory.votePatterns[p.sessionId].totalVotes++;

      if (!isBotEvil) {
        // Good Bot Logic: Adjust trust based on voting for evil-tainted teams
        if (teamHadKnownEvil) {
          if (votedApprove) {
            memory.trustScores[p.sessionId] = Math.max(0, memory.trustScores[p.sessionId] - trustDelta);
          } else {
            memory.trustScores[p.sessionId] = Math.min(100, memory.trustScores[p.sessionId] + trustDelta);
          }
        } else {
          // If team has no known evil, players rejecting while in the team tend to be more trustworthy.
          if (!votedApprove && room.gameState.proposedTeam.includes(p.sessionId)) {
            memory.trustScores[p.sessionId] = Math.min(100, memory.trustScores[p.sessionId] + trustDelta);
          }
        }
        // Note: We used to penalize players for rejecting teams with no known evil.
        // This was removed because blind Good bots were penalizing Merlin for dodging hidden evil.
      } else {
        // Evil Bot Logic: Track who is acting like Merlin (rejecting evil teams, approving good teams)
        if (memory.knownRoles[p.sessionId] !== 'Evil') {
          if (teamHadKnownEvil && !votedApprove) {
            // Good player rejected a team with evil -> acts like Merlin
            memory.merlinSuspicion[p.sessionId] = Math.min(100, (memory.merlinSuspicion[p.sessionId] || 0) + suspicionDelta);
          } else if (!teamHadKnownEvil && votedApprove) {
            // Good player approved an all-good team -> acts like Merlin
            memory.merlinSuspicion[p.sessionId] = Math.min(100, (memory.merlinSuspicion[p.sessionId] || 0) + (suspicionDelta / 2));
          } else if (teamHadKnownEvil && votedApprove) {
            // Good player approved team with evil -> less likely Merlin
            memory.merlinSuspicion[p.sessionId] = Math.max(0, (memory.merlinSuspicion[p.sessionId] || 0) - suspicionDelta);
          }
        }
      }

      // Percival Deduction Update
      if (bot.role === 'Percival' && memory.percivalCandidates) {
        const { a, b, merlinLikelihood } = memory.percivalCandidates;
        if (p.sessionId === a || p.sessionId === b) {
          // Percival expects Merlin to reject teams with evil
          if (teamHadKnownEvil && !votedApprove) {
            merlinLikelihood[p.sessionId] = Math.min(100, merlinLikelihood[p.sessionId] + suspicionDelta);
            memory.trustScores[p.sessionId] = Math.min(100, memory.trustScores[p.sessionId] + trustDelta);

            // The other candidate is less likely Merlin
            const other = p.sessionId === a ? b : a;
            merlinLikelihood[other] = Math.max(0, merlinLikelihood[other] - suspicionDelta);
            memory.trustScores[other] = Math.max(0, memory.trustScores[other] - trustDelta);
          }
        }
      }
    }
  }
}

// ─── Quest Result Memory Update ───────────────────────────────────────────────

export function updateBotMemoriesAfterQuest(room: Room) {
  const quest = room.gameState.quests[room.gameState.currentQuestIndex];
  const failed = quest.status === 'fail';

  // Track fail association for everyone on the team
  if (failed) {
    for (const memberId of quest.team) {
      for (const bot of room.players) {
        if (!bot.isBot) continue;
        const memory = room.gameState.botMemories[bot.sessionId];
        memory.failAssociation[memberId]++;
      }
    }
  }

  // Update bot memories based on quest result
  for (const bot of room.players) {
    if (!bot.isBot) continue;

    const difficulty = bot.difficulty || 'normal';
    const memory = room.gameState.botMemories[bot.sessionId];
    const isBotEvil = EVIL_ROLES.has(bot.role!);

    if (!isBotEvil) {
      // Good bots learn from quest results
      for (const memberId of quest.team) {
        if (memberId === bot.sessionId) continue;

        if (failed) {
          // If quest failed, trust in team members drops significantly
          // If it's a 2-person team and I'm on it, the other person MUST be evil
          if (quest.teamSize === 2 && quest.team.includes(bot.sessionId)) {
            memory.trustScores[memberId] = 0;
            memory.knownRoles[memberId] = 'Evil';
          } else {
            const drop = difficulty === 'hard' ? 40 : 30;
            memory.trustScores[memberId] = Math.max(0, memory.trustScores[memberId] - drop);
          }
        } else {
          // If quest succeeded, trust in team members increases slightly
          const boost = difficulty === 'hard' ? 20 : 15;
          memory.trustScores[memberId] = Math.min(100, memory.trustScores[memberId] + boost);
        }
      }

      // Good bots ALSO learn from who approved a doomed team vs who rejected it
      const lastVote = room.gameState.voteHistory[room.gameState.voteHistory.length - 1];
      if (lastVote) {
        for (const p of room.players) {
          if (p.sessionId === bot.sessionId || quest.team.includes(p.sessionId)) continue;

          // Focus on people NOT on the team (we already handled team members above)
          const votedApprove = lastVote.votes[p.sessionId];
          if (failed) {
            // Quest failed. Approvers are suspicious, Rejecters look good (like Merlin).
            if (votedApprove) {
              memory.trustScores[p.sessionId] = Math.max(0, memory.trustScores[p.sessionId] - 15);
            } else {
              memory.trustScores[p.sessionId] = Math.min(100, memory.trustScores[p.sessionId] + 15);
            }
          } else {
            // Quest succeeded. Approvers look good.
            if (votedApprove) {
              memory.trustScores[p.sessionId] = Math.min(100, memory.trustScores[p.sessionId] + 10);
            }
          }
        }
      }

      // Percival deduction on quest ends
      if (bot.role === 'Percival' && memory.percivalCandidates) {
        const { a, b, merlinLikelihood } = memory.percivalCandidates;

        const shift = difficulty === 'hard' ? 40 : 20;

        // 1. Evaluate the Proposer of the Quest
        const leaderId = room.gameState.voteHistory[room.gameState.voteHistory.length - 1]?.leaderIndex;
        if (leaderId !== undefined) {
          const proposer = room.players[leaderId].sessionId;
          if (proposer === a || proposer === b) {
            const other = proposer === a ? b : a;
            if (failed) {
              // A candidate proposed a failing team. They are almost certainly Morgana.
              merlinLikelihood[proposer] = 0;
              merlinLikelihood[other] = 100;
              memory.trustScores[proposer] = 0;
              memory.trustScores[other] = 100;
            } else if (difficulty === 'hard') {
              // A candidate proposed a succeeding team. Slightly more likely to be Merlin.
              merlinLikelihood[proposer] = Math.min(100, merlinLikelihood[proposer] + 15);
              merlinLikelihood[other] = Math.max(0, merlinLikelihood[other] - 15);
            }
          }
        }

        // 2. Evaluate Candidate Votes on the Final Team
        const lastVote = room.gameState.voteHistory[room.gameState.voteHistory.length - 1];
        if (lastVote) {
          const aApproved = lastVote.votes[a];
          const bApproved = lastVote.votes[b];

          if (aApproved !== bApproved) {
            const approver = aApproved ? a : b;
            const rejecter = aApproved ? b : a;

            if (failed) {
              // Approver of a doomed team is likely Morgana. Rejecter is Merlin.
              merlinLikelihood[approver] = Math.max(0, merlinLikelihood[approver] - shift);
              merlinLikelihood[rejecter] = Math.min(100, merlinLikelihood[rejecter] + shift);
              memory.trustScores[approver] = Math.max(0, (memory.trustScores[approver] || 50) - shift);
              memory.trustScores[rejecter] = Math.min(100, (memory.trustScores[rejecter] || 50) + shift);
            } else if (difficulty === 'hard') {
              // If it succeeded, approver is slightly more likely Merlin
              merlinLikelihood[approver] = Math.min(100, merlinLikelihood[approver] + 10);
              merlinLikelihood[rejecter] = Math.max(0, merlinLikelihood[rejecter] - 10);
            }
          }
        }

        // 3. Evaluate Team Participation
        const aOnTeam = quest.team.includes(a);
        const bOnTeam = quest.team.includes(b);

        if (aOnTeam !== bOnTeam) {
          const candidate = aOnTeam ? a : b;
          const other = aOnTeam ? b : a;

          if (failed) {
            // Participant on failed team is likely Morgana
            merlinLikelihood[candidate] = Math.max(0, merlinLikelihood[candidate] - shift);
            merlinLikelihood[other] = Math.min(100, merlinLikelihood[other] + shift);

            memory.trustScores[candidate] = Math.max(0, (memory.trustScores[candidate] || 50) - shift);
            memory.trustScores[other] = Math.min(100, (memory.trustScores[other] || 50) + shift);
          } else if (difficulty === 'hard') {
            // Participant on succeeding team is somewhat more likely Merlin
            merlinLikelihood[candidate] = Math.min(100, merlinLikelihood[candidate] + 10);
            merlinLikelihood[other] = Math.max(0, merlinLikelihood[other] - 10);
          }
        }
      }
    } else {
      // Evil bots learn who acts like Merlin
      // If a good player rejected a team that had evil on it and the quest FAILED,
      // they were right, and thus more likely Merlin.
      if (failed) {
        const lastVote = room.gameState.voteHistory[room.gameState.voteHistory.length - 1];
        if (lastVote) {
          room.players.forEach(p => {
            if (memory.knownRoles[p.sessionId] !== 'Evil' && lastVote.votes[p.sessionId] === false) {
              const suspicionBoost = difficulty === 'hard' ? 20 : 10;
              memory.merlinSuspicion[p.sessionId] = Math.min(100, (memory.merlinSuspicion[p.sessionId] || 0) + suspicionBoost);
            }
          });
        }
      }
    }
  }
}

// ─── Main Bot Action Dispatcher ───────────────────────────────────────────────

export function handleBotActions(
  room: Room,
  io: Server,
  broadcastRoom: (room: Room, io: Server) => void,
  recordGameStats: (room: Room) => void,
) {
  if (room.status === 'team_building') {
    const leader = room.players[room.gameState.leaderIndex];
    if (leader.isBot) {
      // AI bot: use LLM for team building
      if (leader.botClass === 'ai' && leader.apiKey) {
        setTimeout(async () => {
          if (room.status !== 'team_building') return;
          const currentQuest = room.gameState.quests[room.gameState.currentQuestIndex];
          const team = await aiTeamBuilding(room, leader, currentQuest.teamSize, io);
          if (room.status !== 'team_building') return;
          room.gameState.proposedTeam = team;
          room.status = 'team_proposed';
          room.gameState.teamVotes = {};
          broadcastRoom(room, io);
          handleBotActions(room, io, broadcastRoom, recordGameStats);
        }, 3000);
        return;
      }
      setTimeout(() => {
        if (room.status !== 'team_building') return;
        const currentQuest = room.gameState.quests[room.gameState.currentQuestIndex];
        const memory = room.gameState.botMemories[leader.sessionId];

        const difficulty = leader.difficulty || 'normal';

        // Sort players by trust score descending, but also penalize for failAssociation
        const penaltyFactor = difficulty === 'hard' ? 25 : 15;
        const sortedPlayers = [...room.players].sort((a, b) => {
          const penaltyA = (memory.failAssociation[a.sessionId] || 0) * penaltyFactor;
          const penaltyB = (memory.failAssociation[b.sessionId] || 0) * penaltyFactor;
          const trustA = memory.trustScores[a.sessionId] - penaltyA;
          const trustB = memory.trustScores[b.sessionId] - penaltyB;
          return trustB - trustA;
        });

        const isEvil = EVIL_ROLES.has(leader.role!);
        let team: string[] = [];

        if (isEvil) {
          // --- Improvement B: Strategic Evil Team Building (Hard Mode) ---
          if (difficulty === 'hard') {
            const failsNeeded = 3 - room.gameState.quests.filter(q => q.status === 'fail').length;
            const requiresTwo = currentQuest.requiresTwoFails;

            if (failsNeeded === 1 && requiresTwo) {
              // Must get TWO evil players on the team to win
              team.push(leader.sessionId);
              const otherEvil = room.players.filter(p => p.sessionId !== leader.sessionId && memory.knownRoles[p.sessionId] === 'Evil');
              if (otherEvil.length > 0) {
                team.push(otherEvil[0].sessionId);
              }
            } else if (room.gameState.currentQuestIndex === 0 && generateSecureRandomNumber() < 0.3) {
              // Occasional strategic bluff: Propose an all-good team on Quest 1 to build trust
              const goodPlayers = sortedPlayers.filter(p => memory.knownRoles[p.sessionId] === 'Good');
              team.push(...goodPlayers.slice(0, currentQuest.teamSize).map(p => p.sessionId));
            } else {
              // Standard evil: Include self, maybe one other evil if team size > 2
              team.push(leader.sessionId);
              const otherEvil = sortedPlayers.filter(p => p.sessionId !== leader.sessionId && memory.knownRoles[p.sessionId] === 'Evil');
              if (currentQuest.teamSize > 2 && otherEvil.length > 0 && generateSecureRandomNumber() > 0.4) {
                team.push(otherEvil[0].sessionId);
              }
            }
          } else {
            // Evil logic (Normal): Include self, maybe one other evil, rest good (to blend in)
            team.push(leader.sessionId);
            const otherEvil = sortedPlayers.filter(p => p.sessionId !== leader.sessionId && memory.knownRoles[p.sessionId] === 'Evil');

            // Randomly decide if we want to bring another evil (if team size > 2)
            if (currentQuest.teamSize > 2 && otherEvil.length > 0 && generateSecureRandomNumber() > 0.5) {
              team.push(otherEvil[0].sessionId);
            }
          }

          // Fill the rest with good players (lowest trust from evil perspective = most good)
          // Exclude self if already included
          const goodPlayers = sortedPlayers.filter(p => memory.knownRoles[p.sessionId] === 'Good');
          const remainingSlots = currentQuest.teamSize - team.length;
          const goodToBring = goodPlayers.slice(0, remainingSlots).map(p => p.sessionId);
          team.push(...goodToBring);

          // If we still need more (e.g., not enough known good), just pick random remaining
          if (team.length < currentQuest.teamSize) {
            const remaining = sortedPlayers.filter(p => !team.includes(p.sessionId)).map(p => p.sessionId);
            team.push(...remaining.slice(0, currentQuest.teamSize - team.length));
          }

        } else if (leader.role === 'Merlin') {
          // Merlin logic: Pick trusted players (which for Merlin is just the Good players)
          team = sortedPlayers.slice(0, currentQuest.teamSize).map(p => p.sessionId);

          // Always include self
          if (!team.includes(leader.sessionId)) {
            team[currentQuest.teamSize - 1] = leader.sessionId;
          }

          // Baiting: On quest 0 only, small chance to include exactly one known evil player to hide identity
          // Hard mode does this slightly more effectively, avoiding players with high failAssociation
          const baitChance = difficulty === 'hard' ? 0.2 : 0.15;
          if (room.gameState.currentQuestIndex === 0 && generateSecureRandomNumber() < baitChance) {
            const knownEvil = room.players.filter(p => memory.knownRoles[p.sessionId] === 'Evil' && memory.failAssociation[p.sessionId] === 0);
            if (knownEvil.length > 0) {
              // Replace the least trusted good player in the team (excluding self) with a random evil player
              const evilToBait = knownEvil[Math.floor(generateSecureRandomNumber() * knownEvil.length)].sessionId;
              const nonMerlinTeamMembers = team.filter(id => id !== leader.sessionId);
              if (nonMerlinTeamMembers.length > 0) {
                const playerToReplace = nonMerlinTeamMembers[nonMerlinTeamMembers.length - 1]; // Last one is least trusted
                team[team.indexOf(playerToReplace)] = evilToBait;
              }
            }
          }
        } else {
          // Good logic (non-Merlin): Pick the most trusted players
          team = sortedPlayers.slice(0, currentQuest.teamSize).map(p => p.sessionId);
          // Always include self if good
          if (!team.includes(leader.sessionId)) {
            team[currentQuest.teamSize - 1] = leader.sessionId;
          }
        }

        room.gameState.proposedTeam = team;
        room.status = 'team_proposed';
        room.gameState.teamVotes = {};
        broadcastRoom(room, io);
        handleBotActions(room, io, broadcastRoom, recordGameStats);
      }, 2000);
    }
  } else if (room.status === 'team_proposed') {
    const leader = room.players[room.gameState.leaderIndex];
    if (leader.isBot) {
      setTimeout(() => {
        if (room.status !== 'team_proposed') return;
        room.status = 'team_voting';
        room.gameState.teamVotes = {};
        broadcastRoom(room, io);
        handleBotActions(room, io, broadcastRoom, recordGameStats);
      }, 2000);
    }
  } else if (room.status === 'team_voting') {
    const unvotedBots = room.players.filter(p => p.isBot && !(p.sessionId in room.gameState.teamVotes));
    // Handle AI bots separately (async LLM calls)
    const aiBots = unvotedBots.filter(b => b.botClass === 'ai' && b.apiKey);
    const ruleBots = unvotedBots.filter(b => b.botClass !== 'ai' || !b.apiKey);

    if (aiBots.length > 0) {
      setTimeout(async () => {
        if (room.status !== 'team_voting') return;
        await Promise.all(aiBots.map(async (bot) => {
          const approve = await aiTeamVote(room, bot);
          room.gameState.teamVotes[bot.sessionId] = approve;
        }));
        // After AI bots vote, check if all votes are in
        checkTeamVotesBot(room, io, broadcastRoom, recordGameStats);
      }, 3000);
    }

    if (ruleBots.length > 0) {
      setTimeout(() => {
        if (room.status !== 'team_voting') return;

        const goodPlayersCount = room.players.filter(p => !EVIL_ROLES.has(p.role!)).length;
        const currentQuest = room.gameState.quests[room.gameState.currentQuestIndex];
        const proposedTeam = room.gameState.proposedTeam;

        ruleBots.forEach(bot => {
          const memory = room.gameState.botMemories[bot.sessionId];
          const difficulty = bot.difficulty || 'normal';
          const isEvil = EVIL_ROLES.has(bot.role!);
          const isBotInProposedTeam = proposedTeam.includes(bot.sessionId);

          if (room.gameState.voteTrack === 4) {
            // For all players, forced to approve on last track to avoid losing
            room.gameState.teamVotes[bot.sessionId] = true;
            return;
          }

          let approve = false;

          if (isEvil) {
            // Evil logic: Approve if team has evil, reject if all good
            const hasEvil = proposedTeam.some(id => memory.knownRoles[id] === 'Evil' || id === bot.sessionId);
            if (hasEvil) {
              approve = true;
            } else {
              // Sometimes randomly approve all-good teams to blend in
              approve = generateSecureRandomNumber() > 0.8;
            }
          } else if (bot.role === 'Merlin') {
            // Good logic (Merlin): Usually reject evil, but occasionally approve to hide identity
            const hasKnownEvil = proposedTeam.some(id => memory.knownRoles[id] === 'Evil');
            const merlinIsProposer = room.players[room.gameState.leaderIndex].sessionId === bot.sessionId;

            if (hasKnownEvil) {
              if (merlinIsProposer && room.gameState.currentQuestIndex === 0) {
                // Merlin deliberately baited this team — vote YES to stay consistent with the proposal
                approve = true;
              } else {
                // Reject, but with some noise on later quests to avoid a perfect rejection pattern
                const rejectChance = room.gameState.currentQuestIndex < 2 ? 0.85 : 0.70;
                approve = generateSecureRandomNumber() > rejectChance;
              }
            } else {
              // If no known evil, approve
              approve = true;
            }
          } else {
            // Good logic (non-Merlin): Approve if average trust is high enough, reject if any known evil
            let hasKnownEvil = proposedTeam.some(id => memory.knownRoles[id] === 'Evil');

            // --- Improvement: Percival uses their knowledge ---
            if (bot.role === 'Percival' && memory.percivalCandidates && difficulty === 'hard') {
              const { a, b, merlinLikelihood } = memory.percivalCandidates;
              if (merlinLikelihood[a] >= 65 && proposedTeam.includes(b)) hasKnownEvil = true; // b is Morgana
              if (merlinLikelihood[b] >= 65 && proposedTeam.includes(a)) hasKnownEvil = true; // a is Morgana
              if (proposedTeam.includes(a) && proposedTeam.includes(b)) hasKnownEvil = true; // both Merlin and Morgana are in the team
            }

            // If team requires all good players but does not have good bot itself, it must contain evil.
            if (proposedTeam.length === goodPlayersCount
              && !currentQuest.requiresTwoFails
              && !isBotInProposedTeam
              && difficulty === 'hard') {
              hasKnownEvil = true;
            }

            if (hasKnownEvil) {
              approve = false;
            } else {
              const avgTrust = proposedTeam.reduce((sum, id) => sum + (memory.trustScores[id] || 50), 0) / proposedTeam.length;

              let threshold = isBotInProposedTeam ? 45 : (room.gameState.currentQuestIndex < 2 ? 50 : 55);

              if (difficulty === 'hard') {
                // Hard Good bots are fiercely skeptical of people who fail quests
                const hasSuspicious = proposedTeam.some(id => (memory.failAssociation[id] || 0) > 0);
                if (hasSuspicious) {
                  threshold += 15; // Strictly reject teams containing failed quest members
                }
                // Hard Good bots don't blindly approve Round 1 teams they aren't on giving leader free pass
                if (!isBotInProposedTeam && room.gameState.currentQuestIndex === 0) {
                  threshold = 52; // Forces average trust to be > 50, requiring they've earned trust.
                }
              }

              approve = avgTrust >= threshold;
            }
          }
          room.gameState.teamVotes[bot.sessionId] = approve;
        });
        checkTeamVotesBot(room, io, broadcastRoom, recordGameStats);
      }, 2000);
    }
  } else if (room.status === 'team_vote_reveal') {
    const leader = room.players[room.gameState.leaderIndex];
    if (leader.isBot) {
      setTimeout(() => {
        if (room.status !== 'team_vote_reveal') return;
        applyTeamVoteResultBot(room, io, broadcastRoom, recordGameStats);
      }, 5000);
    }
  } else if (room.status === 'quest_voting') {
    const currentQuest = room.gameState.quests[room.gameState.currentQuestIndex];
    const unvotedBots = room.players.filter(p => p.isBot && room.gameState.proposedTeam.includes(p.sessionId) && !(p.sessionId in currentQuest.votes));

    // Handle AI bots separately (async LLM calls)
    const aiQuestBots = unvotedBots.filter(b => b.botClass === 'ai' && b.apiKey);
    const ruleQuestBots = unvotedBots.filter(b => b.botClass !== 'ai' || !b.apiKey);

    if (aiQuestBots.length > 0) {
      setTimeout(async () => {
        if (room.status !== 'quest_voting') return;
        await Promise.all(aiQuestBots.map(async (bot) => {
          const success = await aiQuestVote(room, bot);
          currentQuest.votes[bot.sessionId] = success;
        }));
        checkQuestVotesBot(room, io, broadcastRoom, recordGameStats);
      }, 3000);
    }

    if (ruleQuestBots.length > 0) {
      setTimeout(() => {
        if (room.status !== 'quest_voting') return;

        // Coordinate evil votes to avoid double fails if possible
        const evilBotsOnTeam = ruleQuestBots.filter(p => EVIL_ROLES.has(p.role as Role));

        ruleQuestBots.forEach(bot => {
          const difficulty = bot.difficulty || 'normal';
          const isEvil = EVIL_ROLES.has(bot.role as Role);
          if (isEvil) {
            // --- Improvement E: Strategic Evil Play (Hard mode) ---
            if (difficulty === 'hard') {
              const totalFailsSoFar = room.gameState.quests.filter(q => q.status === 'fail').length;

              // If we already have 2 fails, we MUST fail this to win
              if (totalFailsSoFar === 2) {
                currentQuest.votes[bot.sessionId] = false;
              }
              // If it's quest 1 and team size 2, maybe succeed to build trust
              else if (room.gameState.currentQuestIndex === 0 && currentQuest.teamSize === 2 && generateSecureRandomNumber() < 0.5) {
                currentQuest.votes[bot.sessionId] = true;
              }
              // If multiple evil on team and requiresTwoFails, BOTH must fail
              else if (evilBotsOnTeam.length >= 2 && currentQuest.requiresTwoFails) {
                // Make sure the first *two* evil bots fail it
                const evilIndex = evilBotsOnTeam.findIndex(p => p.sessionId === bot.sessionId);
                if (evilIndex < 2) {
                  currentQuest.votes[bot.sessionId] = false;
                } else {
                  currentQuest.votes[bot.sessionId] = true;
                }
              }
              // If multiple evil but only requires 1 fail, only the first evil bot fails
              else if (evilBotsOnTeam.length > 1 && !currentQuest.requiresTwoFails) {
                if (bot.sessionId === evilBotsOnTeam[0].sessionId) {
                  currentQuest.votes[bot.sessionId] = false;
                } else {
                  currentQuest.votes[bot.sessionId] = true;
                }
              }
              // Default fail
              else {
                currentQuest.votes[bot.sessionId] = false;
              }
            } else {
              // Normal Mode Play
              // If multiple evil bots, maybe only one fails to hide numbers
              if (evilBotsOnTeam.length > 1 && !currentQuest.requiresTwoFails) {
                // Simple coordination: first evil bot in list fails, others succeed
                if (bot.sessionId === evilBotsOnTeam[0].sessionId) {
                  currentQuest.votes[bot.sessionId] = false;
                } else {
                  currentQuest.votes[bot.sessionId] = true;
                }
              } else {
                // Single evil bot or requires two fails: usually fail, but sometimes succeed on quest 1 to build trust
                if (room.gameState.currentQuestIndex === 0 && generateSecureRandomNumber() > 0.5) {
                  currentQuest.votes[bot.sessionId] = true;
                } else {
                  currentQuest.votes[bot.sessionId] = false;
                }
              }
            }
          } else {
            currentQuest.votes[bot.sessionId] = true; // Good always succeeds
          }
        });
        checkQuestVotesBot(room, io, broadcastRoom, recordGameStats);
      }, 2000);
    }
  } else if (room.status === 'quest_result') {
    // Auto-continue for quest result after 5 seconds if leader is bot
    const leader = room.players[room.gameState.leaderIndex];
    if (leader.isBot) {
      setTimeout(() => {
        if (room.status !== 'quest_result') return;
        applyQuestResultBot(room, io, broadcastRoom, recordGameStats);
      }, 5000);
    }
  } else if (room.status === 'assassin') {
    const assassin = room.players.find(p => p.role === 'Assassin');
    const evilPlayers = room.players.filter(p => EVIL_ROLES.has(p.role as Role));
    const hasHumanEvil = evilPlayers.some(p => !p.isBot);

    if (assassin?.isBot && !hasHumanEvil && !room.gameState.assassinationTarget) {
      // AI assassin: use LLM for assassination
      if (assassin.botClass === 'ai' && assassin.apiKey) {
        setTimeout(async () => {
          if (room.status !== 'assassin') return;
          const targetId = await aiAssassinate(room, assassin);
          const targetPlayer = room.players.find(p => p.sessionId === targetId);
          room.gameState.assassinationTarget = targetId;
          room.gameState.winner = targetPlayer?.role === 'Merlin' ? 'evil' : 'good';
          room.status = 'game_over'; room.gameEndedAt = Date.now();
          recordGameStats(room);
          broadcastRoom(room, io);
        }, 4000);
        return;
      }
      setTimeout(() => {
        if (room.status !== 'assassin') return;

        const memory = room.gameState.botMemories[assassin.sessionId];
        const goodPlayers = room.players.filter(p => !EVIL_ROLES.has(p.role as Role));

        // --- Improvement C: Smarter Assassin ---
        const difficulty = assassin.difficulty || 'normal';
        let target = goodPlayers[0];

        if (difficulty === 'hard') {
          let highestMerlinScore = -1;

          goodPlayers.forEach(p => {
            // Base suspicion mapped to 0-40 (max 40)
            const baseSuspicion = Math.min(40, (memory.merlinSuspicion[p.sessionId] || 0) * 0.4);

            // Vote pattern checks: Merlin rejects teams with evil and approves clean teams
            const votes = memory.votePatterns[p.sessionId] || { rejectedEvil: 0, approvedEvil: 0, totalVotes: 1 };
            const voteScore = votes.totalVotes > 0 ? (votes.rejectedEvil / votes.totalVotes) * 30 : 0; // Max 30

            // Fail association: Merlin is rarely on failed quests (Max 15)
            const failDeduction = (memory.failAssociation[p.sessionId] || 0) * 10;
            const participationScore = Math.max(0, 15 - failDeduction);

            // Proposal checks: Merlin rarely proposes teams with evil (Max 15)
            const proposals = room.gameState.voteHistory.filter(h => room.players[h.leaderIndex].sessionId === p.sessionId);
            const cleanProposals = proposals.filter(h => !h.proposedTeam.some(id => memory.knownRoles[id] === 'Evil')).length;
            const proposalScore = proposals.length > 0 ? (cleanProposals / proposals.length) * 15 : 0;

            const totalScore = baseSuspicion + voteScore + participationScore + proposalScore;

            if (totalScore > highestMerlinScore) {
              highestMerlinScore = totalScore;
              target = p;
            }
          });
        } else {
          // Normal Assassin logic: Find the good player with the lowest trust score
          let lowestTrust = 100;
          goodPlayers.forEach(p => {
            const trust = memory.trustScores[p.sessionId] || 50;
            if (trust < lowestTrust) {
              lowestTrust = trust;
              target = p;
            }
          });
        }

        room.gameState.assassinationTarget = target.sessionId;
        room.gameState.winner = target.role === 'Merlin' ? 'evil' : 'good';
        room.status = 'game_over'; room.gameEndedAt = Date.now();
        recordGameStats(room);
        broadcastRoom(room, io);
      }, 3000);
    }
  }
}

// ─── Internal phase-transition helpers (bot-driven) ──────────────────────────
// These mirror the same-named functions in server.ts but are scoped to bot flows.
// They are not exported — only handleBotActions calls them.

function checkTeamVotesBot(
  room: Room,
  io: Server,
  broadcastRoom: (room: Room, io: Server) => void,
  recordGameStats: (room: Room) => void,
) {
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

function applyTeamVoteResultBot(
  room: Room,
  io: Server,
  broadcastRoom: (room: Room, io: Server) => void,
  recordGameStats: (room: Room) => void,
) {
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

function checkQuestVotesBot(
  room: Room,
  io: Server,
  broadcastRoom: (room: Room, io: Server) => void,
  recordGameStats: (room: Room) => void,
) {
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

function applyQuestResultBot(
  room: Room,
  io: Server,
  broadcastRoom: (room: Room, io: Server) => void,
  recordGameStats: (room: Room) => void,
) {
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
