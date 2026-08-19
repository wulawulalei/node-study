/**
 * 卖家A:配合 10-concurrent-write.ts 第 3 节使用
 * 在 2 秒内不断把商品快照改为 {price:111, stock:11}
 * 注意:这里故意用两条独立 HSET(模拟多条命令),才会被并发交错出"撕裂"
 */
import Redis from "ioredis";
import { sleep } from "./utils";

const redis = new Redis({ host: "127.0.0.1", port: 6379 });

async function main() {
  const end = Date.now() + 2000;
  while (Date.now() < end) {
    await redis.hset("race:sku", "price", "111"); // 第 1 条命令
    await redis.hset("race:sku", "stock", "11"); // 第 2 条命令 —— 两条之间可能被卖家B插入
    await sleep(1);
  }
  console.log("卖家A 写入结束");
  await redis.quit();
}

main().catch((err) => {
  console.error(err);
  redis.quit();
  process.exit(1);
});
