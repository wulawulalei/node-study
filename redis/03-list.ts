/**
 * 03 - Redis 列表(List)操作演示
 *
 * List 是有序的字符串链表,支持两端插入/弹出,按索引访问
 * 底层是 quicklist(压缩链表 + 双向链表),两端的增删是 O(1)
 *
 * 常用场景:
 *   - 最新消息列表(时间线):LPUSH + LRANGE 0 9 取最新 10 条
 *   - 简单消息队列:LPUSH 生产 + BRPOP 阻塞消费
 *   - 栈(LPUSH+LPOP)/ 队列(LPUSH+RPOP)
 */
import Redis from 'ioredis';
import { clearKeys, sleep } from './utils';

const redis = new Redis({ host: '127.0.0.1', port: 6379 });

async function main() {
  console.log('========== 1. 两端操作: LPUSH / RPUSH / LPOP / RPOP ==========');
  // LPUSH:从左侧(头部)插入,可一次多个
  await redis.rpush('demo:list', 'a', 'b', 'c');   // 从右侧(尾部)插入 => [a, b, c]
  await redis.lpush('demo:list', 'z');             // 左侧插入 => [z, a, b, c]
  // LRANGE key start stop:按区间读,-1 表示最后一个元素
  console.log('LRANGE 0 -1 =>', await redis.lrange('demo:list', 0, -1));

  const left = await redis.lpop('demo:list');   // 弹出最左 => z
  const right = await redis.rpop('demo:list');  // 弹出最右 => c
  console.log(`LPOP => ${left}, RPOP => ${right}, 剩余 =>`, await redis.lrange('demo:list', 0, -1));

  console.log('\n========== 2. 索引与长度: LINDEX / LLEN / LSET ==========');
  await redis.del('demo:list');
  await redis.rpush('demo:list', '语文', '数学', '英语');
  console.log('LLEN =>', await redis.llen('demo:list'));
  console.log('LINDEX 1 =>', await redis.lindex('demo:list', 1)); // 按索引读,O(n) 慎用
  await redis.lset('demo:list', 1, '物理');                        // 按索引改
  console.log('LSET 后 =>', await redis.lrange('demo:list', 0, -1));

  console.log('\n========== 3. LTRIM:只保留窗口内的元素(固定长度时间线) ==========');
  // 实战:用户动态只保留最新 5 条
  const feedKey = 'demo:feed:user1';
  for (let i = 1; i <= 8; i++) {
    await redis.lpush(feedKey, `动态${i}`); // 新的从左边进
    await redis.ltrim(feedKey, 0, 4);       // 只保留 0..4,即最新 5 条
  }
  console.log('最新 5 条动态 =>', await redis.lrange(feedKey, 0, -1));

  console.log('\n========== 4. 实战:简单消息队列(LPUSH + BRPOP) ==========');
  // 生产者:LPUSH 入队
  await redis.lpush('demo:queue', '任务A', '任务B', '任务C');
  console.log('已入队 3 个任务');

  // 消费者:BRPOP 阻塞等待(秒),有任务立即返回 [key, value],超时返回 null
  // 相比轮询 RPOP,阻塞式不浪费 CPU 和请求
  for (let i = 0; i < 3; i++) {
    const item = await redis.brpop('demo:queue', 5);
    console.log('消费到任务 =>', item?.[1]);
    await sleep(100); // 模拟处理耗时
  }
  const timeout = await redis.brpop('demo:queue', 1);
  console.log('队列空时再等 1 秒 =>', timeout, '(null 表示超时未等到)');

  console.log('\n========== 5. LREM:删除指定值 ==========');
  await redis.del('demo:list2');
  await redis.rpush('demo:list2', 'x', 'y', 'x', 'z', 'x');
  // count > 0:从头删 count 个;count < 0:从尾删;count = 0:全删
  await redis.lrem('demo:list2', 2, 'x');
  console.log('LREM 2 x 后 =>', await redis.lrange('demo:list2', 0, -1));

  await clearKeys(redis, 'demo:*');
  console.log('\n演示 key 已清理完毕');
  await redis.quit();
}

main().catch((err) => {
  console.error('运行出错:', err);
  redis.quit();
  process.exit(1);
});
