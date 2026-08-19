/**
 * 卖家B:配合 10-concurrent-write.ts 第 3 节使用
 * 在 2 秒内不断把商品快照改为 {price:222, stock:22}
 * 与卖家A 交错执行时,读者可能看到 price=111/stock=22 这种混搭(撕裂)
 */
import Redis from "ioredis";
import { sleep } from "./utils";

const redis = new Redis({ host: "127.0.0.1", port: 6379 });

async function main() {
  const end = Date.now() + 2000;
  while (Date.now() < end) {
    await redis.hset("race:sku", "price", "222");
    await redis.hset("race:sku", "stock", "22");
    await sleep(1);
  }
  console.log("卖家B 写入结束");
  await redis.quit();
}

main().catch((err) => {
  console.error(err);
  redis.quit();
  process.exit(1);
});
