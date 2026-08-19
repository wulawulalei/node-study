/**
 * 02 - Redis 哈希(Hash)操作演示
 *
 * Hash 是一个 key 对应多个 field-value 对,类似 JS 里的对象/Map
 * 适合存储"一个实体的多个属性",比把整个对象序列化成 JSON 字符串更省内存,
 * 且可以单独读写某个字段
 *
 * 常用场景:
 *   - 用户信息缓存(user:1001 => {name, age, email})
 *   - 商品信息、配置项
 *   - 计数器组(一篇文章的阅读量、点赞数、收藏数放在一起)
 */
import Redis from "ioredis";
import { clearKeys } from "./utils";

const redis = new Redis({ host: "127.0.0.1", port: 6379 });

async function main() {
  console.log("========== 1. 基础读写: HSET / HGET / HGETALL ==========");
  // HSET key field value [field value ...]:设置字段(可一次多个)
  await redis.hset(
    "demo:user:1001",
    "name",
    "张三",
    "age",
    "28",
    "city",
    "北京",
  );

  // HGET:读单个字段
  console.log("HGET name =>", await redis.hget("demo:user:1001", "name"));

  // HMGET:一次读多个字段(比多次 HGET 省网络往返)
  console.log(
    "HMGET name age =>",
    await redis.hmget("demo:user:1001", "name", "age"),
  );

  // HGETALL:读整个 hash,返回对象形式
  console.log("HGETALL =>", await redis.hgetall("demo:user:1001"));

  console.log(
    "\n========== 2. 字段操作: HEXISTS / HDEL / HKEYS / HVALS / HLEN ==========",
  );
  // HEXISTS:字段是否存在
  console.log("HEXISTS city =>", await redis.hexists("demo:user:1001", "city"));
  // HKEYS / HVALS / HLEN:所有字段名 / 所有值 / 字段数量
  console.log("HKEYS =>", await redis.hkeys("demo:user:1001"));
  console.log("HVALS =>", await redis.hvals("demo:user:1001"));
  console.log("HLEN =>", await redis.hlen("demo:user:1001"));
  // HDEL:删除字段
  await redis.hdel("demo:user:1001", "city");
  console.log("HDEL city 后 HGETALL =>", await redis.hgetall("demo:user:1001"));

  console.log("\n========== 3. 数字字段: HINCRBY / HINCRBYFLOAT ==========");
  // 实战:一篇文章的多个计数器放在一个 hash 里,原子自增
  const articleKey = "demo:article:42:stats";
  await redis.hincrby(articleKey, "views", 1); // 阅读 +1
  await redis.hincrby(articleKey, "views", 1); // 阅读 +1
  await redis.hincrby(articleKey, "likes", 1); // 点赞 +1
  await redis.hincrby(articleKey, "favorites", 1); // 收藏 +1
  console.log("文章统计 =>", await redis.hgetall(articleKey));

  console.log("\n========== 4. HSETNX:字段不存在才写入 ==========");
  // 适合"只在首次初始化字段"的场景
  const set1 = await redis.hsetnx("demo:user:1001", "name", "会被忽略");
  const set2 = await redis.hsetnx("demo:user:1001", "gender", "男");
  console.log("覆盖已有字段 name =>", set1, ", 新增字段 gender =>", set2);
  console.log("最终 =>", await redis.hgetall("demo:user:1001"));

  console.log("\n========== 5. 实战:Hash vs JSON 字符串怎么选 ==========");
  console.log(`
  用 Hash:需要频繁读写单个字段、字段值是数字需要原子自增
  用 JSON 字符串:整体读写、结构嵌套深、不需要单字段操作
  `);

  // 过期时间设在 key 上(整个 hash),不能给单个 field 设过期
  await redis.expire("demo:user:1001", 3600);
  console.log("demo:user:1001 TTL =>", await redis.ttl("demo:user:1001"), "秒");

  // await clearKeys(redis, 'demo:*');
  // console.log('\n演示 key 已清理完毕');
  await redis.quit();
}

main().catch((err) => {
  console.error("运行出错:", err);
  redis.quit();
  process.exit(1);
});
