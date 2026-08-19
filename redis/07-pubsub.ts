/**
 * 07 - Redis 发布订阅(Pub/Sub)演示
 *
 * Pub/Sub 是轻量的消息广播机制:发布者向频道发消息,所有订阅者实时收到
 * 特点:消息即发即弃,不持久化;订阅者不在线就收不到(要可靠队列请用 Stream)
 *
 * 常用场景:
 *   - 实时通知/聊天室
 *   - 缓存失效广播(多实例间同步"某缓存已更新")
 *   - 配置变更推送
 *
 * 注意:发布和订阅必须用两个独立的连接
 */
import Redis from 'ioredis';
import { clearKeys, sleep } from './utils';

const publisher = new Redis({ host: '127.0.0.1', port: 6379 });
const subscriber = new Redis({ host: '127.0.0.1', port: 6379 });

async function main() {
  console.log('========== 1. 基础发布订阅: SUBSCRIBE / PUBLISH ==========');

  // 订阅者:注册消息回调,然后订阅频道
  const received: string[] = [];
  subscriber.on('message', (channel: string, message: string) => {
    console.log(`  [订阅者] 收到频道 [${channel}] 的消息 => ${message}`);
    received.push(message);
  });
  await subscriber.subscribe('news', 'chat');
  console.log('订阅者已订阅频道: news, chat');

  // 稍等确保订阅生效后,发布者开始发消息
  await sleep(100);
  // PUBLISH 返回值 = 收到消息的订阅者数量
  const n1 = await publisher.publish('news', 'Redis 8.10 发布了!');
  await publisher.publish('chat', '大家好,这是聊天频道');
  console.log('news 频道消息送达订阅者数量 =>', n1);

  await sleep(200);
  console.log('订阅者共收到 =>', received.length, '条消息');

  console.log('\n========== 2. 模式订阅: PSUBSCRIBE(通配符匹配多个频道) ==========');
  subscriber.on('pmessage', (pattern: string, channel: string, message: string) => {
    console.log(`  [模式订阅] 模式 [${pattern}] 匹配到频道 [${channel}] => ${message}`);
  });
  // 用 * 通配符一次订阅一类频道
  await subscriber.psubscribe('log.*');

  await sleep(100);
  await publisher.publish('log.info', '一条普通日志');
  await publisher.publish('log.error', '一条错误日志');

  await sleep(200);

  console.log('\n========== 3. 实战:缓存失效广播(多实例缓存同步思路) ==========');
  console.log(`
  场景:应用部署了多个实例,每个实例本地都缓存了用户信息。
  某个实例更新了用户数据后,通过 Pub/Sub 广播 "user:1001 已失效",
  其他实例收到后删除自己本地的缓存,下次读取时重新加载最新数据。
  `);
  // 演示:订阅者收到失效通知后删除对应 key
  subscriber.on('message', async (channel: string, message: string) => {
    if (channel === 'cache.invalidate') {
      await publisher.del(message); // message 就是要删除的 key
      console.log(`  [实例] 本地缓存 ${message} 已删除`);
    }
  });
  await subscriber.subscribe('cache.invalidate');
  await publisher.set('demo:user:1001', '{"name":"张三"}');
  await sleep(100);
  console.log('失效广播前 EXISTS =>', await publisher.exists('demo:user:1001'));
  await publisher.publish('cache.invalidate', 'demo:user:1001');
  await sleep(200);
  console.log('失效广播后 EXISTS =>', await publisher.exists('demo:user:1001'));

  console.log('\n========== 4. 退订并收尾 ==========');
  // UNSUBSCRIBE:退订;订阅状态的连接只能收发订阅相关命令
  await subscriber.unsubscribe('news', 'chat');
  console.log('已退订 news、chat');
  console.log(`
  Pub/Sub 的局限:消息不持久化、消费者离线即丢消息、无 ACK 确认。
  需要可靠消息请学习 08-stream.ts 里的 Stream。
  `);

  await clearKeys(publisher, 'demo:*');
  console.log('演示 key 已清理完毕');
  await subscriber.quit();
  await publisher.quit();
}

main().catch((err) => {
  console.error('运行出错:', err);
  subscriber.quit();
  publisher.quit();
  process.exit(1);
});
