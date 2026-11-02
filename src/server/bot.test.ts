import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DEFAULT_MODELS, BASE_URLS, callOpenAICompatible } from './bot';

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
