/**
 * 09 - Pipeline 与 Lua 脚本演示
 *
 * Pipeline(管道):
 *   把多条命令一次性发给 Redis,一次网络往返拿全部结果
 *   注意:Pipeline 不是事务,中间某条失败不影响其他命令
 *
 * Lua 脚本(EVAL / EVALSHA):
 *   把多条命令合成一段脚本在服务端原子执行,天然具备"原子性"
 *   经典场景:库存扣减、分布式锁的安全释放、限流令牌桶
 */
import Redis from 'ioredis';
import { clearKeys } from './utils';

const redis = new Redis({ host: '127.0.0.1', port: 6379 });

async function main() {
  console.log('========== 1. 性能对比:逐条命令 vs Pipeline ==========');
  const ROUNDS = 1000;

  // 逐条执行:1000 次网络往返
  let start = Date.now();
  for (let i = 0; i < ROUNDS; i++) {
    await redis.set(`demo:perf:slow:${i}`, 'x');
  }
  const slowMs = Date.now() - start;

  // Pipeline:所有命令打包,一次往返
  start = Date.now();
  const pipe = redis.pipeline();
  for (let i = 0; i < ROUNDS; i++) {
    pipe.set(`demo:perf:fast:${i}`, 'x');
  }
  await pipe.exec();
  const fastMs = Date.now() - start;

  console.log(`逐条 ${ROUNDS} 次 SET => ${slowMs}ms`);
  console.log(`Pipeline ${ROUNDS} 次 SET => ${fastMs}ms(提速约 ${(slowMs / Math.max(fastMs, 1)).toFixed(1)} 倍)`);

  console.log('\n========== 2. MULTI 事务简介 ==========');
  // MULTI/EXEC:命令入队后原子执行(执行期间不插入其他客户端命令)
  // 但没有回滚:某条命令语法错会在 EXEC 时报错,运行时错误不影响其他命令
  const tx = await redis
    .multi()
    .set('demo:tx:a', '1')
    .incr('demo:tx:a')
    .get('demo:tx:a')
    .exec();
  console.log('MULTI 执行结果 =>', tx); // [[null,'OK'],[null,2],[null,'2']]

  console.log('\n========== 3. Lua 脚本:原子扣减库存 ==========');
  // 如果"读库存 -> 判断 -> 扣减"分三条命令,高并发下会超卖
  // 用 Lua 脚本把三步合成一次原子操作
  const deductScript = `
    local stock = tonumber(redis.call('GET', KEYS[1]) or '-1')
    local need = tonumber(ARGV[1])
    if stock < 0 then
      return -1  -- 商品不存在
    end
    if stock < need then
      return -2  -- 库存不足
    end
    return redis.call('DECRBY', KEYS[1], need)
  `;
  await redis.set('demo:stock:iphone', '5');
  // eval(script, key数量, ...keys, ...args)
  const r1 = await redis.eval(deductScript, 1, 'demo:stock:iphone', '2');
  const r2 = await redis.eval(deductScript, 1, 'demo:stock:iphone', '10');
  const r3 = await redis.eval(deductScript, 1, 'demo:stock:unknown', '1');
  console.log('扣 2 件 =>', r1, '(剩余 3)');
  console.log('扣 10 件 =>', r2, '(-2 库存不足)');
  console.log('扣不存在的商品 =>', r3, '(-1 商品不存在)');

  console.log('\n========== 4. defineCommand:把 Lua 脚本封装成 JS 方法 ==========');
  // ioredis 的 defineCommand:注册后像普通方法一样调用,内部自动用 EVALSHA(缓存脚本,更省带宽)
  const safeRedis = new Redis({ host: '127.0.0.1', port: 6379 });
  (safeRedis as any).defineCommand('deductStock', {
    numberOfKeys: 1,
    lua: deductScript,
  });
  const r4 = await (safeRedis as any).deductStock('demo:stock:iphone', '1');
  console.log('defineCommand 扣 1 件 =>', r4, '(剩余 2)');

  console.log('\n========== 5. 经典 Lua:分布式锁的加锁与安全释放 ==========');
  // 加锁:SET key 随机值 NX EX 秒(原子:不存在才设置 + 带过期防死锁)
  const lockKey = 'demo:lock:order1001';
  const lockValue = 'unique-token-' + Math.floor(Math.random() * 1e9);
  const locked = await redis.set(lockKey, lockValue, 'EX', 10, 'NX');
  console.log('尝试加锁 =>', locked === 'OK' ? '成功' : '失败(锁被别人持有)');
  const lockedAgain = await redis.set(lockKey, 'other-token', 'EX', 10, 'NX');
  console.log('别人再加锁 =>', lockedAgain === null ? '失败(符合预期)' : '成功(异常!)');

  // 释放锁:必须先确认"锁还是自己那把"再删,否则会误删别人的锁
  // "GET 判断 + DEL"是两步操作,必须用 Lua 保证原子性
  const unlockScript = `
    if redis.call('GET', KEYS[1]) == ARGV[1] then
      return redis.call('DEL', KEYS[1])
    else
      return 0
    end
  `;
  const unlockWrong = await redis.eval(unlockScript, 1, lockKey, 'other-token');
  const unlockRight = await redis.eval(unlockScript, 1, lockKey, lockValue);
  console.log('用错误 token 解锁 =>', unlockWrong, '(0 拒绝,锁还在)');
  console.log('用正确 token 解锁 =>', unlockRight, '(1 成功释放)');

  await clearKeys(redis, 'demo:*');
  await clearKeys(safeRedis, 'demo:*');
  console.log('\n演示 key 已清理完毕');
  await safeRedis.quit();
  await redis.quit();
}

main().catch((err) => {
  console.error('运行出错:', err);
  redis.quit();
  process.exit(1);
});
