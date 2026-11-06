import { describe, expect, it, vi } from 'vitest';
import { checkAppDbRole } from '../src/startup/checkDbRole';

describe('checkAppDbRole', () => {
  it('trả về lỗi nếu APP_DATABASE_URL chưa được cấu hình', async () => {
    const original = process.env.APP_DATABASE_URL;
    delete process.env.APP_DATABASE_URL;
    const result = await checkAppDbRole();
    expect(result.ok).toBe(false);
    expect(result.message).toContain('APP_DATABASE_URL');
    process.env.APP_DATABASE_URL = original;
  });
});
