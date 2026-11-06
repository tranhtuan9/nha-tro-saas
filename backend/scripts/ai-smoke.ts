import '../src/config/env';
import { getLlmClient } from '../src/lib/llm';

/**
 * Kiểm tra nhanh kết nối Gemini (không đụng CSDL, không nằm trong npm test).
 * Chạy: npm run ai:smoke
 */
async function main(): Promise<void> {
  const client = getLlmClient();
  const result = await client.generate(
    {
      systemInstruction: 'Bạn là trợ lý kiểm tra kết nối. Trả lời thật ngắn gọn.',
      contents: [{ role: 'user', parts: [{ text: 'Chào bạn, hãy trả lời "OK".' }] }],
    },
    { timeoutMs: 15000 }
  );

  console.log('Kết nối Gemini OK:', result.reply ?? '(không có nội dung văn bản)');
}

main().catch((err) => {
  console.error('Smoke test thất bại:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
