import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      // Cho phép khai báo namespace để mở rộng type Express.Request (declaration merging)
      '@typescript-eslint/no-namespace': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // Test dùng nhiều fixture tạo dữ liệu qua side-effect (không cần giá trị trả về),
    // nên tắt cảnh báo biến không dùng riêng cho thư mục tests.
    files: ['tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
    },
  }
);
