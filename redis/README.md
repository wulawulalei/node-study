# Redis 学习指南(Node.js + ioredis)

> 通过可运行的 TypeScript demo 系统学习 Redis:五大数据结构、消息队列、Pipeline、Lua 脚本与实战场景。

## 一、环境准备

### 1. 启动 Redis(本机已装 Redis 8.10)

```bash
# 前台启动(调试用,Ctrl+C 停止)
redis-server

# 或后台启动
redis-server --daemonize yes

# 验证是否正常运行
redis-cli ping   # 返回 PONG 即正常
```

### 2. 安装依赖

```bash
cd redis
npm install
```

### 3. 运行 demo

```bash
# 单独运行某一个(推荐按编号顺序学习)
npx tsx 01-string.ts
npm run 02        # 等价于 npx tsx 02-hash.ts

# 一键运行全部
npm run all
```

每个 demo 运行前会写入 `demo:*` 前缀的测试 key,运行结束自动清理,不留垃圾数据。

## 二、学习路线

| 文件 | 主题 | 核心命令 | 实战场景 |
|------|------|---------|---------|
| [01-string.ts](01-string.ts) | String 字符串 | `SET/GET/SETNX/INCR/MSET` | 缓存对象、计数器、限流器 |
| [02-hash.ts](02-hash.ts) | Hash 哈希 | `HSET/HGET/HGETALL/HINCRBY` | 用户信息、文章多维度统计 |
| [03-list.ts](03-list.ts) | List 列表 | `LPUSH/RPOP/BRPOP/LTRIM` | 时间线、简单消息队列 |
| [04-set.ts](04-set.ts) | Set 集合 | `SADD/SINTER/SUNION/SPOP` | 去重签到、共同好友、抽奖 |
| [05-zset.ts](05-zset.ts) | ZSet 有序集合 | `ZADD/ZREVRANGE/ZINCRBY` | 排行榜、延迟队列 |
| [06-expire-keys.ts](06-expire-keys.ts) | 过期与 key 管理 | `EXPIRE/TTL/SCAN/TYPE` | 淘汰策略、安全遍历 |
| [07-pubsub.ts](07-pubsub.ts) | 发布订阅 | `PUBLISH/SUBSCRIBE/PSUBSCRIBE` | 实时通知、缓存失效广播 |
| [08-stream.ts](08-stream.ts) | Stream 消息队列 | `XADD/XREADGROUP/XACK/XCLAIM` | 可靠任务队列、消费组、失败重投 |
| [09-pipeline-lua.ts](09-pipeline-lua.ts) | Pipeline 与 Lua | `pipeline/multi/EVAL` | 批量提速、原子扣库存、分布式锁 |

建议按编号顺序学习:01~05 是数据结构基础,06 是通用管理,07~08 是消息能力,09 是性能与原子性进阶。

## 三、核心知识点速览

### 1. 五大数据结构怎么选

```
String  最简单:缓存 JSON、计数器(INCR 原子)、分布式锁(SET NX EX)
Hash    一个实体的多个字段:用户信息、可单字段自增的统计组
List    有序、两端进出:最新 N 条(LPUSH+LTRIM)、队列(BRPOP)
Set     无序去重:签到、标签、交集/并集/差集(共同好友)
ZSet    去重+按分数排序:排行榜(ZREVRANGE)、延迟队列(score=时间戳)
```

选型口诀:**要不要去重?要不要排序?要不要单字段操作?要不要两端进出?**

### 2. 过期与内存管理(面试高频)

- 过期时间:`SET key val EX 秒`(原子),或事后 `EXPIRE`;`TTL` 查剩余时间,`-1` 永久、`-2` 不存在
- 过期删除策略:**惰性删除**(访问时才删)+ **定期删除**(后台随机抽查)结合
- 内存淘汰策略(内存满时):缓存场景推荐 `maxmemory 2gb + allkeys-lru`
- 永远给缓存 key 设过期时间,防止内存无限增长

### 3. 遍历 key:只用 SCAN,禁用 KEYS

`KEYS *` 全量扫描会阻塞主线程(生产事故常客);`SCAN` 游标式增量迭代,配合 `MATCH`/`COUNT` 使用。

### 4. 消息方案对比

| 方案 | 持久化 | 消费组 | ACK/重投 | 适用 |
|------|--------|--------|----------|------|
| List + BRPOP | ✅ | ❌ | ❌ | 极简队列,单消费者 |
| Pub/Sub | ❌ 即发即弃 | ❌ | ❌ | 实时广播,允许丢消息 |
| Stream | ✅ | ✅ 多组多消费者 | ✅ PEL + XCLAIM | 可靠队列,生产推荐 |

### 5. 性能与原子性

- **Pipeline**:批量命令一次网络往返,数量级提速(非事务,单条失败不影响其他)
- **MULTI/EXEC**:事务,原子执行但无回滚
- **Lua 脚本**:多步操作合成原子操作,是分布式锁释放、扣库存防超卖的正确姿势

### 6. 缓存三大经典问题(理论,必读)

```
缓存穿透:查询一个"数据库也不存在"的数据,缓存永远落空
  对策:缓存空值(短 TTL)、布隆过滤器拦截

缓存击穿:某个热点 key 过期瞬间,大量请求同时打到数据库
  对策:互斥锁(SET NX,只放一个请求去回源)、热点 key 不过期 + 逻辑过期

缓存雪崩:大量 key 在同一时刻集体过期
  对策:过期时间加随机抖动(如 300s ± 60s)、多级缓存
```

### 7. 分布式锁正确姿势(见 09 demo)

1. 加锁:`SET key 随机token NX EX 10` —— 原子完成"不存在才设置 + 过期防死锁"
2. 释放:Lua 脚本先比对 token 再 DEL —— 防止误删别人的锁
3. 业务耗时可能超过锁时长时,需要看门狗续期(生产推荐直接用 [Redlock/Redisson] 或 ioredis 生态的 `redlock` 库)

## 四、常用 redis-cli 调试命令

```bash
redis-cli ping                    # 测试连通
redis-cli monitor                 # 实时观察所有命令(学习时开着特别有感觉!)
redis-cli keys 'demo:*'           # 本地调试看 key(生产禁用)
redis-cli type <key>              # 看 key 类型
redis-cli ttl <key>               # 看剩余过期时间
redis-cli info memory             # 内存使用详情
redis-cli info stats              # 命中率等统计
redis-cli config get maxmemory*   # 查看内存配置
redis-cli flushdb                 # 清空当前库(危险,仅本地)
```

## 五、进阶方向(demo 之外的功课)

- **持久化**:RDB(快照)vs AOF(追加日志),混合持久化
- **高可用**:主从复制 → 哨兵(Sentinel)自动故障转移 → Cluster 集群分片
- **客户端分片**:ioredis 的 `Cluster` 类连接集群
- **高级数据结构**:Bitmap(亿级签到)、HyperLogLog(UV 统计)、Geo(附近的人)
- **Redis 8 新特性**:8.x 起内置了 JSON、时间序列、搜索(Redisearch)、布隆过滤器等模块能力,可直接 `JSON.SET`、`FT.SEARCH` 等命令

## 六、目录结构

```
redis/
├── 01-string.ts        String:缓存、计数器、限流
├── 02-hash.ts          Hash:对象存储、多字段统计
├── 03-list.ts          List:时间线、阻塞队列
├── 04-set.ts           Set:去重、集合运算、抽奖
├── 05-zset.ts          ZSet:排行榜、延迟队列
├── 06-expire-keys.ts   过期策略、SCAN 遍历
├── 07-pubsub.ts        发布订阅、缓存失效广播
├── 08-stream.ts        Stream 消费组、ACK、失败重投
├── 09-pipeline-lua.ts  Pipeline 提速、Lua 原子操作、分布式锁
├── utils.ts            公共工具(SCAN 清理 key、sleep)
└── package.json
```