import axios, { AxiosError } from 'axios';
import { MiniMaxConfig } from './types';
import { logger } from './logger';

interface MiniMaxMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface MiniMaxResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface MiniMaxErrorResponse {
  error: {
    message: string;
    type: string;
    code: string;
  };
}

class MiniMaxClient {
  private config: MiniMaxConfig;
  private maxRetries = 3;
  private retryDelay = 1000; // ms

  constructor(config: MiniMaxConfig) {
    this.config = config;
  }

  /**
   * Generate a chat completion using MiniMax m4 model with retry logic
   */
  async chatCompletion(
    systemPrompt: string,
    userMessage: string,
    context = '',
    temperature = 0.7
  ): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.attemptChatCompletion(
          systemPrompt,
          userMessage,
          context,
          temperature
        );

        logger.logMiniMaxCall(userMessage, response.length, { attempt });

        return response;
      } catch (error) {
        lastError = error as Error;
        logger.warn(`MiniMax attempt ${attempt} failed`, { error: (error as Error).message });

        // Don't retry on certain errors
        if (this.isNonRetryableError(error as AxiosError)) {
          throw error;
        }

        // Wait before retrying (exponential backoff)
        if (attempt < this.maxRetries) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1);
          await this.sleep(delay);
        }
      }
    }

    logger.logMiniMaxError(lastError!, { attempts: this.maxRetries });
    throw new Error(`MiniMax API failed after ${this.maxRetries} attempts: ${lastError!.message}`);
  }

  private async attemptChatCompletion(
    systemPrompt: string,
    userMessage: string,
    context: string,
    temperature: number
  ): Promise<string> {
    const messages: MiniMaxMessage[] = [
      { role: 'system', content: systemPrompt },
    ];

    if (context) {
      messages.push({
        role: 'system',
        content: `Here is the relevant program information to help answer questions:\n\n${context}`,
      });
    }

    messages.push({ role: 'user', content: userMessage });

    const response = await axios.post<MiniMaxResponse>(
      `${this.config.apiUrl}/chat/completions`,
      {
        model: 'm4',
        messages,
        temperature,
        max_tokens: 1000,
      },
      {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000, // 30 second timeout
      }
    );

    if (response.data && response.data.choices && response.data.choices.length > 0) {
      return response.data.choices[0].message.content;
    }

    throw new Error('Unexpected response structure from MiniMax API');
  }

  private isNonRetryableError(error: AxiosError): boolean {
    if (!error.response) return false;

    const status = error.response.status;
    // Don't retry on authentication errors, not found, or client errors
    return status === 401 || status === 403 || status === 404 || status >= 400 && status < 500;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Health check for MiniMax API
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.chatCompletion('You are a test.', 'Say "OK"', '', 0);
      return true;
    } catch (error) {
      logger.logMiniMaxError(error as Error);
      return false;
    }
  }
}

export default MiniMaxClient;
