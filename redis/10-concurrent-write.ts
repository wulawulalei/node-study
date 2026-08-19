/**
 * 10 - 并发写同一字段:会发生什么?如何解决?
 *
 * 先给结论:
 *   Redis 服务端是单线程执行命令的,单条命令天然原子,绝不会出现"写一半"的数据损坏。
 *   真正的问题出在「多条命令组合的业务操作」上:并发下命令会交错执行,产生两类经典问题——
 *     1. 丢失更新(lost update):读-改-写(GET→计算→SET)模式下,后写覆盖先写,一方的修改凭空消失
 *     2. 状态撕裂(torn state):一个业务对象拆成多个 key/字段,并发写被交错后各字段不属于同一版本
 *        (本例用 Hash 的 HSET 演示;若把 JSON 拆开成多个 String key 并发 SET,后果一样)
 *
 * 解决方案:
 *   A. 能用单条原子命令就用原子命令:INCR / HINCRBY / SET NX
 *   B. 复合操作用 Lua 脚本:整个脚本在服务端原子执行,不会被交错
 *   C. 乐观锁:WATCH + MULTI,版本变化则重试(库存扣减等场景常用)
 *   D. 分布式锁:SET NX EX + Lua 安全释放,串行化临界区
 *   E. 尽量不用锁:好的数据模型设计(原子计数器、CQRS 拆分)能绕开大部分竞争
 *
 * 运行: pnpm 10  或  npx tsx 10-concurrent-write.ts
 * 前置: 需要两个终端同时跑 11-seller-a.ts 和 11-seller-b.ts 来演示"撕裂"场景
 */
import Redis from "ioredis";
import { clearKeys, sleep } from "./utils";

const redis = new Redis({ host: "127.0.0.1", port: 6379 });

/** 并发启动 N 个任务,模拟"线程同时写"(Node 单线程,但 Redis 视角下就是并发客户端) */
function concurrent(tasks: Array<() => Promise<unknown>>) {
  return Promise.all(tasks.map((t) => t()));
}

async function main() {
  console.log("========== 1. 错误示范: GET → +1 → SET(读-改-写丢失更新) ==========");
  await redis.set("race:bad:stock", "0");
  // 20 个并发客户端,每个都想给计数器 +1,期望结果 20
  await concurrent(
    Array.from({ length: 20 }, () => async () => {
      const cur = await redis.get("race:bad:stock"); // 1. 读
      const next = String(Number(cur) + 1); // 2. 改
      await sleep(Math.random() * 5); // 放大交错窗口(等价于真实业务里的计算耗时)
      await redis.set("race:bad:stock", next); // 3. 写:可能覆盖掉别人刚写入的值
    }),
  );
  const badResult = Number(await redis.get("race:bad:stock"));
  console.log(`期望 20,实际 ${badResult} => 丢失更新 ${20 - badResult} 次!`);

  console.log("\n========== 2. 方案A:单条原子命令 INCR ==========");
  await redis.set("race:good:stock", "0");
  await concurrent(
    // INCR 在服务端单线程原子执行,20 次自增一次不落
    Array.from({ length: 20 }, () => () => redis.incr("race:good:stock")),
  );
  console.log(`期望 20,实际 ${await redis.get("race:good:stock")} => 正确`);

  console.log("\n========== 3. 状态撕裂:多个字段必须同时可读 ==========");
  console.log("商品快照 {price, stock} 需要原子地整体更新。");
  console.log("👉 请现在打开另外两个终端,分别运行: npx tsx 11-seller-a.ts / npx tsx 11-seller-b.ts");
  console.log("   本进程循环读快照,一旦出现 价格=A库存=B 的混搭,即为'撕裂'。");
  await redis.hset("race:sku", { price: "100", stock: "50" });
  let torn = 0;
  for (let i = 0; i < 200; i++) {
    const [price, stock] = await redis.hmget("race:sku", "price", "stock");
    // 约定:卖家A写入 price=111/stock=11,卖家B写入 price=222/stock=22
    const fromA = price === "111" && stock === "11";
    const fromB = price === "222" && stock === "22";
    const initial = price === "100" && stock === "50";
    if (!fromA && !fromB && !initial) {
      torn++;
      if (torn <= 3) console.log(`  ⚠️ 撕裂样本: price=${price}, stock=${stock}`);
    }
  }
  console.log(torn > 0 ? `共捕获 ${torn} 次撕裂读取` : "本轮未捕获到撕裂(两个卖家脚本没跑或已结束)");

  console.log("\n========== 4. 方案B: Lua 脚本原子执行复合操作(库存扣减) ==========");
  // 判断库存足够才扣减:读+判断+写三步,用 Lua 保证原子
  const deductLua = `
    local stock = tonumber(redis.call('GET', KEYS[1]) or '-1')
    if stock < tonumber(ARGV[1]) then return -1 end
    return redis.call('DECRBY', KEYS[1], ARGV[1])
  `;
  await redis.set("race:lua:stock", "10");
  // 15 个并发各扣 1,只有 10 个能成功,且库存绝不为负
  const results = await concurrent(
    Array.from({ length: 15 }, () => () =>
      redis.eval(deductLua, 1, "race:lua:stock", 1) as Promise<number>,
    ),
  );
  const success = results.filter((r) => (r as number) >= 0).length;
  console.log(`15 人抢 10 件:成功 ${success} 人,剩余库存 ${await redis.get("race:lua:stock")} => 正确`);

  console.log("\n========== 5. 方案C: WATCH + MULTI 乐观锁 ==========");
  await redis.set("race:watch:balance", "100");
  // 10 个并发各自提现 10 元:先 WATCH 余额,版本变了就重试
  const withdraw = async (): Promise<boolean> => {
    for (let retry = 0; retry < 5; retry++) {
      await redis.watch("race:watch:balance");
      const balance = Number(await redis.get("race:watch:balance"));
      if (balance < 10) {
        await redis.unwatch();
        return false;
      }
      const tx = await redis
        .multi()
        .set("race:watch:balance", String(balance - 10))
        .exec();
      if (tx !== null) return true; // exec 返回 null = 期间被别人改过,重试
    }
    return false;
  };
  const ok = await concurrent(Array.from({ length: 10 }, () => withdraw));
  console.log(
    `10 人各提现 10 元:成功 ${ok.filter(Boolean).length} 人,最终余额 ${await redis.get("race:watch:balance")} => 正确`,
  );

  console.log("\n========== 6. 方案D: 分布式锁 SET NX EX + Lua 释放 ==========");
  const LOCK_KEY = "race:lock";
  const lockToken = crypto.randomUUID(); // 锁标识:防止误删别人的锁
  const gotLock = await redis.set(LOCK_KEY, lockToken, "EX", 10, "NX");
  console.log("加锁结果:", gotLock === "OK" ? "成功" : "失败(锁被占用)");
  // 只有持锁者才能进入临界区做"读-改-写",天然串行化
  if (gotLock === "OK") {
    const cur = Number((await redis.get("race:lock:count")) ?? "0");
    await redis.set("race:lock:count", String(cur + 1));
    // 释放锁必须用 Lua 校验 token,原子地"比对+删除"
    const releaseLua = `
      if redis.call('GET', KEYS[1]) == ARGV[1] then
        return redis.call('DEL', KEYS[1])
      else
        return 0
      end
    `;
    await redis.eval(releaseLua, 1, LOCK_KEY, lockToken);
    console.log("临界区执行完毕,锁已安全释放,计数 =>", await redis.get("race:lock:count"));
  }

  console.log("\n========== 7. 方案E: 重新设计模型,绕开竞争 ==========");
  // 把"一个对象整体改"拆成"各改各的原子计数器",并发下互不干扰
  await redis.del("race:sku2");
  await concurrent([
    () => redis.hincrby("race:sku2", "sold", 1), // 销量 +1
    () => redis.hincrby("race:sku2", "view", 1), // 浏览 +1
    () => redis.hset("race:sku2", "updated", "v1"), // 版本标记
  ]);
  console.log("拆分后的原子字段 =>", await redis.hgetall("race:sku2"));

  await clearKeys(redis, "race:*");
  console.log("\n演示 key 已清理完毕");
  await redis.quit();
}

main().catch((err) => {
  console.error("运行出错:", err);
  redis.quit();
  process.exit(1);
});
