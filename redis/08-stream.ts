/**
 * 08 - Redis Stream 演示(Redis 5.0+ 的消息队列)
 *
 * Stream 是 Redis 专门设计的消息队列数据结构,弥补了 Pub/Sub 不持久化的缺陷:
 *   - 消息持久化,可重复消费
 *   - 每条消息有唯一 ID(时间戳-序号)
 *   - 支持消费组(Consumer Group):多消费者分摊消息 + ACK 确认 + 待确认重投
 *
 * 常用场景:
 *   - 异步任务队列(发邮件、生成报表)
 *   - 订单事件流、日志收集
 *   - 轻量版 Kafka/RabbitMQ 替代
 */
import Redis from 'ioredis';
import { clearKeys, sleep } from './utils';

const redis = new Redis({ host: '127.0.0.1', port: 6379 });

async function main() {
  console.log('========== 1. 基础读写: XADD / XRANGE / XLEN ==========');
  const stream = 'demo:stream:orders';

  // XADD key * field value [field value ...]:追加消息,* 表示自动生成 ID
  const id1 = await redis.xadd(stream, '*', 'orderId', '1001', 'amount', '99.5');
  const id2 = await redis.xadd(stream, '*', 'orderId', '1002', 'amount', '299');
  console.log('XADD 返回消息 ID =>', id1, '(格式: 毫秒时间戳-序号)');
  console.log('XLEN 消息总数 =>', await redis.xlen(stream));

  // XRANGE key - +:按 ID 范围读,- 最小 + 最大
  const all = await redis.xrange(stream, '-', '+');
  console.log('XRANGE 全部消息 =>');
  for (const [id, fields] of all!) {
    console.log(`  ID=${id} 字段=${JSON.stringify(fields)}`);
  }

  console.log('\n========== 2. 独立消费: XREAD(类似 Pub/Sub 但可回溯) ==========');
  // XREAD COUNT n BLOCK 毫秒 STREAMS key 起始ID
  // '$' 表示只读新消息;'0' 表示从头读;BLOCK 阻塞等待新消息
  const newMsg = await redis.xread('COUNT', 10, 'STREAMS', stream, '0');
  console.log('XREAD 从头读取 =>', JSON.stringify(newMsg));

  console.log('\n========== 3. 消费组: XGROUP / XREADGROUP / XACK(生产级用法) ==========');
  // XGROUP CREATE key 组名 起始ID:创建消费组($ 表示只消费之后的新消息,0 从头)
  // 组名可能已存在,先尝试删除再创建(演示环境)
  await redis.xgroup('DESTROY', stream, 'order-group').catch(() => {});
  await redis.xgroup('CREATE', stream, 'order-group', '0');
  console.log('消费组 order-group 已创建');

  // 再补一条新订单,让组内有消息可消费
  await redis.xadd(stream, '*', 'orderId', '1003', 'amount', '59.9');

  // XREADGROUP GROUP 组名 消费者名 ... STREAMS key >
  // '>' 表示:读取"还没派发给任何消费者"的新消息
  const groupRead = await redis.xreadgroup(
    'GROUP', 'order-group', 'consumer-1',
    'COUNT', 10, 'STREAMS', stream, '>'
  );
  console.log('consumer-1 从消费组读到 =>');
  const pendingIds: string[] = [];
  for (const [, messages] of (groupRead as any[])) {
    for (const [id, fields] of messages) {
      console.log(`  ID=${id} 字段=${JSON.stringify(fields)}`);
      pendingIds.push(id);
    }
  }

  // XACK:确认消息已处理完成,从"待确认列表(PEL)"移除
  // 如果消费者处理完不 ACK,消息会留在 PEL,可用来实现失败重投
  const acked = await redis.xack(stream, 'order-group', ...pendingIds);
  console.log(`XACK 确认了 ${acked} 条消息`);

  console.log('\n========== 4. 失败重投: XPENDING / XCLAIM ==========');
  // consumer-1 读一条但不 ACK,模拟"消费了却宕机没确认"
  const unacked = await redis.xreadgroup(
    'GROUP', 'order-group', 'consumer-1',
    'COUNT', 1, 'STREAMS', stream, '>'
  );
  if (unacked) {
    console.log('consumer-1 读到一条新消息但故意不 ACK(模拟宕机)');
  } else {
    // 没有新消息,补一条再让 consumer-1 读走不确认
    await redis.xadd(stream, '*', 'orderId', '1004', 'amount', '88');
    await redis.xreadgroup('GROUP', 'order-group', 'consumer-1', 'COUNT', 1, 'STREAMS', stream, '>');
    console.log('consumer-1 读到新消息但故意不 ACK(模拟宕机)');
  }

  // XPENDING:查看组内"已派发未确认"的消息
  const pending = await redis.xpending(stream, 'order-group');
  console.log('待确认消息概况(数量/最小ID/最大ID/消费者) =>', pending);

  // XCLAIM:把闲置超时的消息转移给另一个消费者(这里是 consumer-2 接手)
  // 参数: key 组名 新消费者 最小闲置毫秒 消息ID
  const detail = await redis.xpending(stream, 'order-group', 'IDLE', 0, '-', '+', 10);
  for (const [msgId, , idleMs] of detail as any[]) {
    const claimed = await redis.xclaim(stream, 'order-group', 'consumer-2', 0, msgId);
    console.log(`consumer-2 接管了闲置 ${idleMs}ms 的消息 =>`, JSON.stringify(claimed));
    await redis.xack(stream, 'order-group', msgId); // 处理完成后 ACK
  }
  console.log('重投处理后待确认 =>', await redis.xpending(stream, 'order-group'));

  console.log('\n========== 5. XTRIM:控制 Stream 长度 ==========');
  // MAXLEN n:精确修剪,只保留最近 n 条
  // MAXLEN ~ n:近似修剪(按内部节点整块删除,性能更好),但小数据量下可能不立即生效
  for (let i = 0; i < 20; i++) await redis.xadd('demo:stream:logs', '*', 'log', `日志${i}`);
  console.log('修剪前日志条数 =>', await redis.xlen('demo:stream:logs'));
  const removed = await redis.xtrim('demo:stream:logs', 'MAXLEN', 5);
  console.log(`精确修剪到 5 条,删除 ${removed} 条,剩余 =>`, await redis.xlen('demo:stream:logs'));
  console.log('(注:大数据量生产环境推荐 MAXLEN ~ n 近似修剪,性能更好)');

  console.log('\n========== 6. 阻塞等待新消息: XREAD BLOCK ==========');
  console.log('等待 1 秒看有没有新消息(模拟长轮询)...');
  await sleep(100);
  // 注意:ioredis 类型定义要求 COUNT 必须在 BLOCK 之前
  const blocked = await redis.xread('COUNT', 1, 'BLOCK', 1000, 'STREAMS', stream, '$');
  console.log('结果 =>', blocked === null ? '超时,暂无新消息' : JSON.stringify(blocked));

  await clearKeys(redis, 'demo:*');
  console.log('\n演示 key 已清理完毕');
  await redis.quit();
}

main().catch((err) => {
  console.error('运行出错:', err);
  redis.quit();
  process.exit(1);
});
