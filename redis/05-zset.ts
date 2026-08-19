/**
 * 05 - Redis 有序集合(Sorted Set / ZSet)操作演示
 *
 * ZSet = Set(去重) + 每个成员带一个 score 分数,按 score 排序
 * 增删改查 O(log n),范围查询非常高效
 *
 * 常用场景:
 *   - 排行榜(积分榜、热搜榜)
 *   - 延迟队列(score 存执行时间戳)
 *   - 带权重的标签、优先级任务
 */
import Redis from "ioredis";
import { clearKeys } from "./utils";

const redis = new Redis({ host: "127.0.0.1", port: 6379 });

async function main() {
  console.log("========== 1. 基础操作: ZADD / ZSCORE / ZCARD ==========");
  // ZADD key score member:添加成员及分数
  await redis.zadd("demo:rank", 85, "小明", 92, "小红", 78, "小刚", 92, "小华");
  console.log("ZSCORE 小红 =>", await redis.zscore("demo:rank", "小红"));
  console.log("ZCARD =>", await redis.zcard("demo:rank"));

  console.log(
    "\n========== 2. 排名查询: ZRANGE / ZREVRANGE / ZRANK ==========",
  );
  // ZRANGE 按分数升序(0 -1 全部),WITHSCORES 连分数一起返回
  // 注意:ioredis 类型定义中 zrange 的 stop 参数只接受 string/Buffer,传字符串 '-1'
  console.log(
    "升序(低到高) =>",
    await redis.zrange("demo:rank", "0", "-1", "WITHSCORES"),
  );
  // ZREVRANGE 降序:排行榜 TopN 最常用
  console.log(
    "降序 Top3 =>",
    await redis.zrevrange("demo:rank", 0, 2, "WITHSCORES"),
  );
  // ZRANK / ZREVRANK:成员的排名(从 0 开始)
  console.log("小红升序名次 =>", await redis.zrank("demo:rank", "小红"));
  console.log("小红降序名次 =>", await redis.zrevrank("demo:rank", "小红"));

  console.log(
    "\n========== 3. 按分数区间查询: ZRANGEBYSCORE / ZCOUNT ==========",
  );
  // 查 80~95 分的成员,( 表示开区间,-inf +inf 表示无穷
  console.log(
    "80~95 分 =>",
    await redis.zrangebyscore("demo:rank", 80, 95, "WITHSCORES"),
  );
  console.log("90 分以上人数 =>", await redis.zcount("demo:rank", 90, "+inf"));

  console.log("\n========== 4. ZINCRBY:分数自增(实时积分榜) ==========");
  // 实战:游戏中玩家得分变化,排名实时更新
  await redis.zincrby("demo:rank", 10, "小刚"); // 小刚 +10 => 88
  console.log("小刚 +10 分后 =>", await redis.zscore("demo:rank", "小刚"));
  console.log(
    "最新排行榜 =>",
    await redis.zrevrange("demo:rank", 0, -1, "WITHSCORES"),
  );

  console.log("\n========== 5. 实战:延迟队列(score 存执行时间戳) ==========");
  const delayQueue = "demo:delay-queue";
  const now = Date.now();
  // 把"未来要执行的任务"按执行时间戳入队
  await redis.zadd(delayQueue, now + 1000, "任务:1秒后执行");
  await redis.zadd(delayQueue, now + 3000, "任务:3秒后执行");
  await redis.zadd(delayQueue, now - 500, "任务:已到期");

  // 消费者轮询:取出 score <= 当前时间 的到期任务
  const due = await redis.zrangebyscore(delayQueue, "-inf", now);
  console.log("到期任务 =>", due);
  if (due.length > 0) {
    await redis.zrem(delayQueue, ...due); // 取出后删除,防止重复消费
    console.log(
      "已消费并移除,剩余任务 =>",
      await redis.zrange(delayQueue, "0", "-1"),
    );
  }

  console.log("\n========== 6. 集合运算: ZUNIONSTORE(跨榜汇总) ==========");
  // 实战:日榜合并成总榜,分数相加
  await redis.zadd("demo:rank:day1", 10, "A", 20, "B");
  await redis.zadd("demo:rank:day2", 5, "A", 30, "C");
  await redis.zunionstore(
    "demo:rank:total",
    2,
    "demo:rank:day1",
    "demo:rank:day2",
  );
  console.log(
    "两日汇总榜 =>",
    await redis.zrevrange("demo:rank:total", 0, -1, "WITHSCORES"),
  );

  await clearKeys(redis, "demo:*");
  console.log("\n演示 key 已清理完毕");
  await redis.quit();
}

main().catch((err) => {
  console.error("运行出错:", err);
  redis.quit();
  process.exit(1);
});
