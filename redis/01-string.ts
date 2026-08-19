/**
 * 01 - Redis 字符串(String)操作演示
 *
 * String 是 Redis 最基础的数据类型,一个 key 对应一个 value
 * value 可以是字符串、整数、浮点数,最大 512MB
 *
 * 常用场景:
 *   - 缓存对象(JSON 序列化后存储)
 *   - 计数器(阅读量、点赞数)
 *   - 分布式锁(SET NX EX)
 *   - 限流器(INCR + EXPIRE)
 */
import Redis from "ioredis";
import { clearKeys } from "./utils";

const redis = new Redis({ host: "127.0.0.1", port: 6379 });

async function main() {
  console.log("========== 1. 基础读写: SET / GET / DEL ==========");
  // SET key value:设置键值对
  await redis.set("demo:name", "张三");
  // GET key:获取值
  const name = await redis.get("demo:name");
  console.log("GET demo:name =>", name);

  // SET 带过期时间(EX 秒 / PX 毫秒),常用于验证码、临时令牌
  await redis.set("demo:captcha", "8352", "EX", 60);
  // TTL:查看剩余过期时间(秒),-1 表示永不过期,-2 表示不存在
  console.log("TTL demo:captcha =>", await redis.ttl("demo:captcha"), "秒");

  // MSET / MGET:批量读写,一次网络往返,性能远好于循环 SET
  await redis.mset("demo:a", "1", "demo:b", "2", "demo:c", "3");
  console.log(
    "MGET demo:a demo:b demo:c =>",
    await redis.mget("demo:a", "demo:b", "demo:c"),
  );

  // SETNX(SET if Not eXists):key 不存在才设置,返回 1 成功 / 0 失败
  // 这是实现分布式锁的原子基础
  const r1 = await redis.setnx("demo:unique", "only-once");
  const r2 = await redis.setnx("demo:unique", "try-again");
  console.log(
    "第一次 SETNX =>",
    r1,
    ", 第二次 SETNX =>",
    r2,
    "(0 表示 key 已存在)",
  );

  console.log("\n========== 2. 数字操作: INCR / DECR / INCRBY ==========");
  // Redis 会把数字字符串当作整数处理,操作是原子的(无需加锁)
  await redis.set("demo:counter", "0");
  await redis.incr("demo:counter"); // +1
  await redis.incrby("demo:counter", 10); // +10
  await redis.decr("demo:counter"); // -1
  console.log("计数器最终值 =>", await redis.get("demo:counter")); // 10

  // INCRBYFLOAT:浮点数自增
  await redis.set("demo:price", "9.9");
  await redis.incrbyfloat("demo:price", 0.1);
  console.log("浮点自增 =>", await redis.get("demo:price"));

  console.log("\n========== 3. 实战:接口限流器(每分钟最多 5 次) ==========");
  const limitKey = "demo:ratelimit:user1001";
  for (let i = 1; i <= 7; i++) {
    // 原子自增;首次访问时顺便设置 60 秒过期
    const count = await redis.incr(limitKey);
    if (count === 1) await redis.expire(limitKey, 60);
    const allowed = count <= 5;
    console.log(
      `第 ${i} 次请求,count=${count} => ${allowed ? "放行" : "拒绝(超过限流)"}`,
    );
  }

  console.log(
    "\n========== 4. 字符串追加与截取: APPEND / GETRANGE / STRLEN ==========",
  );
  await redis.set("demo:log", "hello");
  await redis.append("demo:log", " world"); // 拼接
  console.log("APPEND 后 =>", await redis.get("demo:log"));
  console.log("GETRANGE 0..4 =>", await redis.getrange("demo:log", 0, 4)); // 截取前 5 个字符
  console.log("STRLEN =>", await redis.strlen("demo:log"));

  console.log("\n========== 5. 实战:缓存 JSON 对象 ==========");
  const user = { id: 1, name: "李四", roles: ["admin", "editor"] };
  // 对象需 JSON.stringify 后存入;读取时再 parse
  await redis.set("demo:user:1", JSON.stringify(user), "EX", 300);
  const cached = JSON.parse((await redis.get("demo:user:1"))!);
  console.log("缓存的用户对象 =>", cached);

  // GETSET:设置新值并返回旧值(演示旧值替换场景)
  const old = await redis.getset("demo:name", "王五");
  console.log("GETSET 旧值 =>", old, ", 新值 =>", await redis.get("demo:name"));

  // 清理本次演示产生的 key
  await clearKeys(redis, "demo:*");
  console.log("\n演示 key 已清理完毕");
  await redis.quit();
}

main().catch((err) => {
  console.error("运行出错:", err);
  redis.quit();
  process.exit(1);
});
