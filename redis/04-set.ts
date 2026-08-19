/**
 * 04 - Redis 集合(Set)操作演示
 *
 * Set 是无序、去重的字符串集合,增删查都是 O(1)
 * 最大亮点是集合运算:交集、并集、差集
 *
 * 常用场景:
 *   - 去重(已抽奖用户、已签到用户)
 *   - 标签系统(给用户/文章打标签)
 *   - 社交关系:共同好友(交集)、可能认识的人(差集)
 *   - 随机抽奖:SRANDMEMBER / SPOP
 */
import Redis from 'ioredis';
import { clearKeys } from './utils';

const redis = new Redis({ host: '127.0.0.1', port: 6379 });

async function main() {
  console.log('========== 1. 基础操作: SADD / SMEMBERS / SISMEMBER / SREM ==========');
  // SADD:添加成员,自动去重,返回实际新增数量
  const added = await redis.sadd('demo:tags:article1', 'redis', 'nodejs', '后端', 'redis');
  console.log('SADD 4 个(含1个重复)实际新增 =>', added);

  // SMEMBERS:取全部成员(无序)
  console.log('SMEMBERS =>', await redis.smembers('demo:tags:article1'));

  // SISMEMBER:判断成员是否存在,O(1)
  console.log('SISMEMBER redis =>', await redis.sismember('demo:tags:article1', 'redis'));
  console.log('SISMEMBER java =>', await redis.sismember('demo:tags:article1', 'java'));

  // SCARD:成员数量;SREM:删除成员
  console.log('SCARD =>', await redis.scard('demo:tags:article1'));
  await redis.srem('demo:tags:article1', '后端');
  console.log('SREM 后端后 =>', await redis.smembers('demo:tags:article1'));

  console.log('\n========== 2. 集合运算: SINTER / SUNION / SDIFF ==========');
  // 两个用户的好友列表
  await redis.sadd('demo:friends:alice', 'bob', 'carol', 'dave', 'eric');
  await redis.sadd('demo:friends:jack', 'carol', 'dave', 'frank');

  // SINTER 交集:共同好友
  console.log('共同好友(交集) =>', await redis.sinter('demo:friends:alice', 'demo:friends:jack'));
  // SUNION 并集:两人好友合并去重
  console.log('好友并集 =>', await redis.sunion('demo:friends:alice', 'demo:friends:jack'));
  // SDIFF 差集:alice 有而 jack 没有 => 可推荐给 jack 的人
  console.log('推荐给 jack(差集) =>', await redis.sdiff('demo:friends:alice', 'demo:friends:jack'));

  // SINTERSTORE:把运算结果存到新 key,避免大结果传输
  await redis.sinterstore('demo:common:alice_jack', 'demo:friends:alice', 'demo:friends:jack');
  console.log('交集已存储 =>', await redis.smembers('demo:common:alice_jack'));

  console.log('\n========== 3. 随机取: SRANDMEMBER / SPOP(抽奖场景) ==========');
  await redis.sadd('demo:lottery', '用户1', '用户2', '用户3', '用户4', '用户5');
  // SRANDMEMBER:随机取但不移除(可重复中奖,也可传负数允许重复)
  console.log('抽 2 人不移除 =>', await redis.srandmember('demo:lottery', 2));
  // SPOP:随机取并移除(中奖后从奖池剔除)
  const winner = await redis.spop('demo:lottery');
  console.log('中奖并移除 =>', winner, ', 剩余 =>', await redis.smembers('demo:lottery'));

  console.log('\n========== 4. 实战:每日签到去重 ==========');
  const today = 'demo:signin:2026-08-14';
  // 同一用户重复签到,SADD 返回 0,天然幂等
  console.log('user1001 首次签到 =>', await redis.sadd(today, 'user1001'));
  console.log('user1001 重复签到 =>', await redis.sadd(today, 'user1001'));
  console.log('今日签到人数 =>', await redis.scard(today));

  await clearKeys(redis, 'demo:*');
  console.log('\n演示 key 已清理完毕');
  await redis.quit();
}

main().catch((err) => {
  console.error('运行出错:', err);
  redis.quit();
  process.exit(1);
});
