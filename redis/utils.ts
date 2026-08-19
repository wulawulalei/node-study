/**
 * demo 公共工具函数
 */
import type Redis from 'ioredis';

/**
 * 用 SCAN 安全地查找并删除匹配 pattern 的所有 key
 * 生产环境禁止 KEYS *(会阻塞主线程),SCAN 是增量迭代不阻塞
 */
export async function clearKeys(redis: Redis, pattern: string): Promise<number> {
  let cursor = '0';
  let total = 0;
  do {
    const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    cursor = nextCursor;
    if (keys.length > 0) {
      total += await redis.del(...keys);
    }
  } while (cursor !== '0');
  return total;
}

/** 休眠 ms 毫秒 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
