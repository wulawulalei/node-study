/**
 * 06 - Redis 通用 key 操作与过期策略演示
 *
 * 这些命令对所有数据类型通用,管理的是 key 本身而不是 value
 *
 * 核心内容:
 *   - EXISTS / DEL / TYPE / RENAME
 *   - EXPIRE / TTL / PERSIST:过期时间管理
 *   - SCAN:安全的遍历(生产环境禁用 KEYS *)
 *   - 过期删除策略与内存淘汰策略(面试高频)
 */
import Redis from 'ioredis';
import { clearKeys, sleep } from './utils';

const redis = new Redis({ host: '127.0.0.1', port: 6379 });

async function main() {
  console.log('========== 1. key 基础操作: EXISTS / TYPE / RENAME / DEL ==========');
  await redis.set('demo:k1', 'v1');
  await redis.hset('demo:h1', 'f', 'v');
  console.log('EXISTS demo:k1 =>', await redis.exists('demo:k1')); // 1 存在
  console.log('TYPE demo:k1 =>', await redis.type('demo:k1'));     // string
  console.log('TYPE demo:h1 =>', await redis.type('demo:h1'));     // hash

  // RENAME:重命名 key;RENAMENX:目标不存在才改名
  await redis.rename('demo:k1', 'demo:k1-renamed');
  console.log('RENAME 后 EXISTS 旧名 =>', await redis.exists('demo:k1'),
    ', 新名 =>', await redis.exists('demo:k1-renamed'));

  console.log('\n========== 2. 过期时间: EXPIRE / TTL / PERSIST / EXPIREAT ==========');
  await redis.set('demo:temp', '临时数据');
  // EXPIRE key 秒:设置过期时间
  await redis.expire('demo:temp', 100);
  console.log('EXPIRE 后 TTL =>', await redis.ttl('demo:temp')); // ~100
  // PTTL:毫秒级剩余时间
  console.log('PTTL =>', await redis.pttl('demo:temp'), '毫秒');
  // PERSIST:移除过期时间,变为永久
  await redis.persist('demo:temp');
  console.log('PERSIST 后 TTL =>', await redis.ttl('demo:temp')); // -1 永不过期

  // SET 时直接带 EX 是更推荐的做法(一次命令完成,原子)
  await redis.set('demo:short-lived', '2秒过期', 'EX', 2);
  console.log('\n设置 2 秒过期,等待 2.2 秒后再 GET...');
  await sleep(2200);
  console.log('过期后 GET =>', await redis.get('demo:short-lived')); // null

  console.log('\n========== 3. SCAN:安全遍历 key(替代危险的 KEYS *) ==========');
  // 先造一批测试 key
  const pipe = redis.pipeline();
  for (let i = 0; i < 30; i++) pipe.set(`demo:scan:item${i}`, `v${i}`);
  await pipe.exec();

  // SCAN cursor MATCH 模式 COUNT 数量
  // 增量式迭代,每次只扫一小部分,不会阻塞 Redis(KEYS * 会全量扫描阻塞主线程!)
  let cursor = '0';
  const found: string[] = [];
  do {
    const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', 'demo:scan:*', 'COUNT', 10);
    cursor = nextCursor;
    found.push(...keys);
  } while (cursor !== '0'); // cursor 回到 0 表示一轮遍历结束
  console.log(`SCAN 共找到 ${found.length} 个 key,示例:`, found.slice(0, 3));

  console.log('\n========== 4. 过期与淘汰策略(理论知识) ==========');
  console.log(`
  Redis 删除过期 key 的两种内置策略:
  1) 惰性删除:访问 key 时才检查是否过期,过期则删除(省 CPU,但可能滞留)
  2) 定期删除:每隔一段时间随机抽查一批设了过期的 key,删除其中过期的
  两者结合仍可能有漏网之鱼,所以还有第三道防线:内存淘汰策略(maxmemory-policy)
  - noeviction(默认):内存满后写命令报错
  - allkeys-lru:所有 key 中淘汰最久未使用的(缓存场景推荐)
  - volatile-lru:只在设了过期时间的 key 中淘汰 LRU
  - allkeys-random / volatile-random:随机淘汰
  - volatile-ttl:淘汰剩余时间最短的
  生产缓存常用:maxmemory 2gb + allkeys-lru
  `);

  // 查看服务端当前配置
  const maxmemory = (await redis.config('GET', 'maxmemory')) as string[];
  const policy = (await redis.config('GET', 'maxmemory-policy')) as string[];
  console.log('当前服务 maxmemory =>', maxmemory[1], ', 淘汰策略 =>', policy[1]);

  await clearKeys(redis, 'demo:*');
  console.log('\n演示 key 已清理完毕');
  await redis.quit();
}

main().catch((err) => {
  console.error('运行出错:', err);
  redis.quit();
  process.exit(1);
});
