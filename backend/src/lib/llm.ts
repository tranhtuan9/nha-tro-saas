import { GoogleGenAI, type Content, type FunctionCall, type FunctionDeclaration } from '@google/genai';

/**
 * Interface bọc LLM (UC21-23):
 * - Vòng lặp function calling do module AI điều khiển THỦ CÔNG; LlmClient KHÔNG tự thực thi hàm.
 * - Test thay bằng bản giả qua setLlmClient().
 */

export interface LlmMessage {
  role: 'user' | 'model';
  parts: Array<{ text: string } | { functionCall: FunctionCall } | { functionResponse: unknown }>;
}

export interface LlmTool {
  functionDeclarations: FunctionDeclaration[];
}

export interface LlmGenerateRequest {
  systemInstruction: string;
  contents: LlmMessage[];
  tools?: LlmTool[];
}

export interface LlmGenerateResult {
  /** Text trả lời của model (null nếu vòng này chỉ chứa lời gọi hàm). */
  reply: string | null;
  /** Các lời gọi hàm model yêu cầu — CHỈ trả về, không thực thi. */
  functionCalls: FunctionCall[];
}

export interface LlmClient {
  generate(
    request: LlmGenerateRequest,
    options: { timeoutMs: number }
  ): Promise<LlmGenerateResult>;
}

/** Lỗi không dùng được LLM (thiếu key/model, lỗi SDK, hết thời gian) → API trả 502. */
export class LlmUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlmUnavailableError';
  }
}

/**
 * Triển khai chính thức bằng SDK @google/genai (ghim phiên bản trong package.json).
 * Dùng plain functionDeclarations + tắt automatic function calling: SDK chỉ trả
 * functionCalls về cho caller tự xử lý.
 */
export class GeminiLlmClient implements LlmClient {
  private readonly ai: GoogleGenAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async generate(
    request: LlmGenerateRequest,
    options: { timeoutMs: number }
  ): Promise<LlmGenerateResult> {
    const model = process.env.GEMINI_MODEL;
    if (!model) {
      throw new LlmUnavailableError('GEMINI_MODEL chưa được cấu hình');
    }

    let timer: NodeJS.Timeout | undefined;
    try {
      const call = this.ai.models.generateContent({
        model,
        contents: request.contents as Content[],
        config: {
          systemInstruction: request.systemInstruction,
          ...(request.tools ? { tools: request.tools } : {}),
          automaticFunctionCalling: { disable: true },
        },
      });
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new LlmUnavailableError('Hết thời gian chờ phản hồi từ Gemini')),
          options.timeoutMs
        );
      });
      const response = await Promise.race([call, timeout]);

      return {
        reply: response.text ?? null,
        functionCalls: response.functionCalls ?? [],
      };
    } catch (err) {
      if (err instanceof LlmUnavailableError) throw err;
      throw new LlmUnavailableError(
        `Lỗi gọi Gemini API: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

let client: LlmClient | null = null;

/** Lấy client hiện tại; khởi tạo lazily từ GEMINI_API_KEY. */
export function getLlmClient(): LlmClient {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new LlmUnavailableError('GEMINI_API_KEY chưa được cấu hình');
    }
    client = new GeminiLlmClient(apiKey);
  }
  return client;
}

/** Seam cho test: truyền fake client; truyền null để reset về client thật. */
export function setLlmClient(next: LlmClient | null): void {
  client = next;
}
