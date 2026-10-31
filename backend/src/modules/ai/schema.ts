import { z } from 'zod';

// Số lượt lịch sử giữ lại và tổng ký tự phía server (chặt hơn giới hạn nhận vào).
export const AI_MAX_HISTORY_TURNS = 10;
export const AI_MAX_HISTORY_CHARS = 20000;
export const AI_MAX_MESSAGE_CHARS = 4000;

/**
 * Lượt lịch sử CHỈ là văn bản thuần (UC21 stateless, đã chốt G3):
 * strict chặn mọi phần gọi hàm, kết quả hàm, vai trò system do client gửi lên.
 */
export const historyEntrySchema = z
  .object({
    role: z.enum(['user', 'assistant'], {
      errorMap: () => ({ message: 'Vai trò chỉ được là user hoặc assistant' }),
    }),
    text: z.string().min(1, 'Lịch sử không được chứa tin rỗng').max(AI_MAX_MESSAGE_CHARS),
  })
  .strict('Lượt lịch sử chỉ được có role và text');

export const chatSchema = z
  .object({
    message: z
      .string()
      .trim()
      .min(1, 'Tin nhắn không được để trống')
      .max(AI_MAX_MESSAGE_CHARS, `Tin nhắn tối đa ${AI_MAX_MESSAGE_CHARS} ký tự`),
    history: z.array(historyEntrySchema).max(100).optional().default([]),
  })
  .strict('Body chỉ được có message và history');

export const proposalIdParamSchema = z.object({
  id: z.string().uuid('ID đề xuất không hợp lệ'),
});

export const proposalListQuerySchema = z.object({
  status: z.enum(['PROPOSED', 'CONFIRMED', 'REJECTED', 'EXECUTED', 'FAILED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type ChatInput = z.infer<typeof chatSchema>;
export type HistoryEntry = z.infer<typeof historyEntrySchema>;
export type ProposalListQuery = z.infer<typeof proposalListQuerySchema>;
