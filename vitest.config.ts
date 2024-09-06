import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {

    include: [
      'tests/**/*.test.ts',
    ],

    /** 使用 verbose reporter 可以打印用例名称，使测试更清楚 */
    reporters: ['verbose'],

    /** 由于需要等待多个交易完成，测试时间会较长，所以设置为24小时 */
    testTimeout: 1*1000*60*60*24, // 24 hour
  }
});

