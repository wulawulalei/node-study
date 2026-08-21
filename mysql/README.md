# MySQL 学习指南(Node.js + mysql2)

> 通过可运行的 TypeScript demo 系统学习 MySQL:CRUD、查询进阶、聚合、JOIN、事务、索引与 Node.js 工程实战。

## 一、环境准备

### 1. 启动 MySQL(本机已装 MySQL 26.x)

```bash
# macOS (官方安装包)
sudo /usr/local/mysql/support-files/mysql.server start

# 验证是否正常运行
/usr/local/mysql/bin/mysql -h127.0.0.1 -uroot -p -e "SELECT VERSION();"
```

### 2. 配置连接

在**项目根目录** `.env` 里写入(所有 demo 自动读取):

```bash
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=你的密码
```

### 3. 运行 demo

```bash
# 单独运行某一个(推荐按编号顺序学习)
npx tsx mysql/01-connect-crud.ts

# 一键运行全部
npm run mysql:all
```

每个 demo 运行前会自动创建 `mysql_study` 库并重建 `demo_*` 测试表,不留脏数据。运行后可以进 MySQL 客户端查看表结构加深理解:

```bash
/usr/local/mysql/bin/mysql -h127.0.0.1 -uroot -p mysql_study -e "SHOW TABLES;"
```

## 二、学习路线

| 文件 | 主题 | 核心内容 | 实战场景 |
|------|------|---------|---------|
| [01-connect-crud.ts](mysql/01-connect-crud.ts) | 连接与 CRUD | `execute/query`、占位符参数化、命名占位符 | SQL 注入原理与防御 |
| [02-datatypes-ddl.ts](mysql/02-datatypes-ddl.ts) | 数据类型与 DDL | `DECIMAL/VARCHAR/JSON/DATETIME`、`ALTER TABLE` | 金额精度陷阱、JSON 路径查询 |
| [03-query.ts](mysql/03-query.ts) | 查询进阶 | `BETWEEN/IN/LIKE/NULL/ORDER BY/LIMIT/CASE WHEN` | NULL 三值逻辑、游标分页 |
| [04-aggregate.ts](mysql/04-aggregate.ts) | 聚合与分组 | `GROUP BY/HAVING/GROUP_CONCAT`、窗口函数 | 分组取 TopN、累计求和 |
| [05-join.ts](mysql/05-join.ts) | 多表关联 | `INNER/LEFT JOIN`、反连接、`EXISTS`、派生表、`UNION` | LEFT JOIN 条件位置陷阱 |
| [06-transaction.ts](mysql/06-transaction.ts) | 事务 | `beginTransaction/commit/rollback`、`FOR UPDATE`、乐观锁 | 转账、并发扣库存防超卖 |
| [07-index-explain.ts](mysql/07-index-explain.ts) | 索引与执行计划 | `EXPLAIN`、最左前缀、索引失效、覆盖索引 | 慢查询排查思路 |
| [08-node-pool.ts](mysql/08-node-pool.ts) | Node.js 实战 | 连接池、池中事务、错误码、upsert、批量插入 | 生产级连接管理 |

建议按编号顺序学习:01~02 是基础,03~05 是查询核心,06~07 是面试高频,08 是工程落地。

## 三、核心知识点速览

### 1. 安全铁律:永远参数化

```ts
// ❌ 永远不要拼接字符串 —— SQL 注入
conn.query(`SELECT * FROM users WHERE name = '${name}'`);

// ✅ 占位符:参数永远不会被解析成 SQL 语法
conn.execute('SELECT * FROM users WHERE name = ?', [name]);
```

### 2. 常用类型怎么选

```
金额     DECIMAL(10,2)     绝不用 FLOAT/DOUBLE(精度丢失)
主键     BIGINT UNSIGNED AUTO_INCREMENT
短字符串  VARCHAR(n)        CHAR 只适合定长(如 MD5、国家码)
状态     ENUM 或 TINYINT    ENUM 可读性好,改值要 ALTER
时间     DATETIME           不随时区转换;TIMESTAMP 会转,范围只到 2038
布尔     TINYINT(1)        MySQL 没有真布尔
灵活字段  JSON              能查能改但索引能力弱,热点字段别放 JSON 里
```

### 3. 事务模板(背下来)

```ts
const conn = await pool.getConnection();
try {
  await conn.beginTransaction();
  // ... 多条 SQL,其中任何一条失败都会走 catch
  await conn.commit();
} catch (err) {
  await conn.rollback();   // 回滚到事务开始前
  throw err;
} finally {
  conn.release();          // 归还连接,不是关闭
}
```

防超卖两条路:
- **悲观锁**:`SELECT ... FOR UPDATE` 锁行,其他事务排队 —— 冲突多时用
- **乐观锁**:`UPDATE ... WHERE version = 读到的版本`,更新 0 行就重试 —— 冲突少时用

### 4. 索引口诀

- **最左前缀**:`INDEX(a,b,c)` 能服务 `a`、`a,b`、`a,b,c`,不能服务 `b` 或 `c` 单独查询
- **失效三兄弟**:对列做函数、`LIKE '%xx'` 前导通配符、隐式类型转换(字符串列传数字)
- **覆盖索引**:SELECT 的列都在索引里 → `Extra: Using index`,不回表,最快
- **EXPLAIN 看三个字段**:`type`(出现 `ALL` 且 `rows` 大要警惕)、`key`(NULL = 没用索引)、`rows`

### 5. 查询性能常识

```
深分页    LIMIT 100000, 10 → 扫 100010 行
          改游标分页:WHERE id > 上次最大id LIMIT 10 → 只扫 10 行

COUNT     COUNT(*) 计全部行;COUNT(列) 排除 NULL;COUNT(DISTINCT 列) 去重

JOIN      小表驱动大表;被 JOIN 的列必须有索引;
          LEFT JOIN 右表的过滤条件放 ON 里,放 WHERE 会退化成 INNER JOIN

批量写    批量 INSERT ... VALUES (...),(...),(...) 比逐条快一个数量级
```

## 四、常用 mysql 客户端调试命令

```bash
# 进入交互终端
/usr/local/mysql/bin/mysql -h127.0.0.1 -uroot -p

USE mysql_study;
SHOW TABLES;                       -- 看表
SHOW CREATE TABLE demo_users\G     -- 看建表语句(含索引)
DESCRIBE demo_users;               -- 看列结构
EXPLAIN SELECT ... ;               -- 看执行计划
SHOW INDEX FROM demo_users;        -- 看索引详情
SELECT * FROM information_schema.innodb_trx\G   -- 看当前事务(排查锁)
SHOW ENGINE INNODB STATUS\G        -- 死锁日志(LATEST DETECTED DEADLOCK)
SHOW PROCESSLIST;                  -- 看当前连接在跑什么
```

## 五、进阶方向(demo 之外的功课)

- **MVCC**:InnoDB 如何用 undo log + ReadView 实现可重复读
- **锁体系**:行锁/间隙锁/临键锁,死锁排查与 `SHOW ENGINE INNODB STATUS`
- **主从复制**:binlog 同步原理,读写分离
- **分库分表**:数据量超过单表千万级后的拆分思路(中间件 vs 客户端)
- **慢查询日志**:`slow_query_log` + `mysqldumpslow` 定位慢 SQL
- **备份恢复**:`mysqldump` 逻辑备份 vs `xtrabackup` 物理备份

## 六、目录结构

```
mysql/
├── 01-connect-crud.ts    连接、CRUD、SQL 注入防御
├── 02-datatypes-ddl.ts   数据类型、金额精度、JSON、ALTER
├── 03-query.ts           条件查询、NULL 陷阱、分页、CASE WHEN
├── 04-aggregate.ts       聚合、GROUP BY/HAVING、窗口函数
├── 05-join.ts            JOIN 家族、子查询、UNION
├── 06-transaction.ts     事务、转账、悲观锁/乐观锁防超卖
├── 07-index-explain.ts   EXPLAIN、最左前缀、索引失效
├── 08-node-pool.ts       连接池、错误处理、upsert、批量性能
├── utils.ts              公共工具(连接、建库建表、测试数据)
└── README.md
```
