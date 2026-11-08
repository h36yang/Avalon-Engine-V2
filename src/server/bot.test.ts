import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DEFAULT_MODELS, BASE_URLS, callOpenAICompatible, handleBotActions } from './bot';

vi.mock('openai', () => {
  return {
    default: class MockOpenAI {
      config: { baseURL: string; apiKey: string };
      chat: {
        completions: {
          create: (payload: { model: string; messages: unknown[] }) => Promise<{
            choices: { message: { content: string } }[];
          }>;
        };
      };
      constructor(config: { baseURL: string; apiKey: string }) {
        this.config = config;
        this.chat = {
          completions: {
            create: vi.fn().mockImplementation(async (payload: { model: string; messages: unknown[] }) => ({
              choices: [
                {
                  message: {
                    content: `Echo [${payload.model}]: ${(payload.messages[1] as { content: string }).content}`,
                  },
                },
              ],
            })),
          },
        };
      }
    },
  };
});

describe('Bot LLM Configuration & OpenRouter/OpenAI-compatible helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('hard-mode evil team voting', () => {

    function fakeTeamVotingRoom(currentQuestIndex: number, voteTrack = 0) {
      const botId = 'evil-bot';
      const quests = Array.from({ length: 3 }, () => ({
        status: 'pending',
        team: [],
        teamSize: 1,
        votes: {},
        requiresTwoFails: false,
      }));

      return {
        status: 'team_voting',
        players: [{ sessionId: botId, name: 'Evil Bot', role: 'Assassin', isBot: true, difficulty: 'hard' }],
        gameState: {
          leaderIndex: 0,
          currentQuestIndex,
          voteTrack,
          proposedTeam: [botId],
          teamVotes: {},
          quests,
          voteHistory: [],
          botMemories: {
            [botId]: {
              trustScores: { [botId]: 100 },
              knownRoles: { [botId]: 'Assassin' },
              merlinSuspicion: { [botId]: 0 },
              failAssociation: { [botId]: 0 },
              votePatterns: { [botId]: { approvedEvil: 0, rejectedEvil: 0, totalVotes: 0 } },
            },
          },
        },
      } as unknown as Parameters<typeof handleBotActions>[0];
    }

    it.each([
      { currentQuestIndex: 0, voteTrack: 0, expectedApproval: false },
      { currentQuestIndex: 1, voteTrack: 0, expectedApproval: false },
      { currentQuestIndex: 2, voteTrack: 0, expectedApproval: true },
      { currentQuestIndex: 0, voteTrack: 4, expectedApproval: true },
    ])('uses the strategic vote for quest $currentQuestIndex on track $voteTrack', ({ currentQuestIndex, voteTrack, expectedApproval }) => {
      vi.useFakeTimers();
      vi.spyOn(Math, 'random').mockReturnValue(0);

      const room = fakeTeamVotingRoom(currentQuestIndex, voteTrack);
      handleBotActions(room, {} as never, () => { }, () => { });
      vi.advanceTimersByTime(2000);

      expect(room.gameState.teamVotes['evil-bot']).toBe(expectedApproval);
    });
  });

  describe('DEFAULT_MODELS', () => {
    it('contains the updated default models for all providers', () => {
      expect(DEFAULT_MODELS.gemini).toBe('gemini-3.5-flash-lite');
      expect(DEFAULT_MODELS.nvidia).toBe('nvidia/nemotron-3-ultra-550b-a55b');
      expect(DEFAULT_MODELS.openrouter).toBe('meta-llama/llama-3.3-70b-instruct:free');
      expect(DEFAULT_MODELS.groq).toBe('llama-3.3-70b-versatile');
    });
  });

  describe('BASE_URLS', () => {
    it('defines OpenAI-compatible base URLs for all providers including Gemini', () => {
      expect(BASE_URLS.gemini).toBe('https://generativelanguage.googleapis.com/v1beta/openai/');
      expect(BASE_URLS.openrouter).toBe('https://openrouter.ai/api/v1');
      expect(BASE_URLS.groq).toBe('https://api.groq.com/openai/v1');
      expect(BASE_URLS.nvidia).toBe('https://integrate.api.nvidia.com/v1');
    });
  });

  describe('callOpenAICompatible', () => {
    it('calls completions with the provided baseUrl, model, and system/user messages', async () => {
      const baseUrl = BASE_URLS.gemini;
      const apiKey = 'test-gemini-key';
      const model = 'gemini-3.8-flash';
      const systemPrompt = 'You are a test assistant.';
      const userPrompt = 'Say "ok" in one word.';

      const reply = await callOpenAICompatible(baseUrl, apiKey, model, systemPrompt, userPrompt);

      expect(reply).toBe('Echo [gemini-3.8-flash]: Say "ok" in one word.');
    });
  });
});
