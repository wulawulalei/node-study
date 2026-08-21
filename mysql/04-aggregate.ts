/**
 * 04 - 聚合与分组:GROUP BY / HAVING / 窗口函数
 *
 * 核心知识点:
 *   - 五个聚合函数:COUNT / SUM / AVG / MAX / MIN
 *   - COUNT(*) vs COUNT(列) vs COUNT(DISTINCT 列)
 *   - GROUP BY 分组 + HAVING 过滤分组(HAVING 在聚合后,WHERE 在聚合前)
 *   - 窗口函数(MySQL 8+):ROW_NUMBER / RANK / 累计求和
 *
 * 运行: npx tsx mysql/04-aggregate.ts
 */
import { createConnection, initDatabase, printRows } from './utils';

async function main() {
  await initDatabase();
  const conn = await createConnection();

  console.log('========== 1. 基础聚合 ==========');
  const [agg] = await conn.execute(
    `SELECT
       COUNT(*)        AS 订单总数,
       SUM(amount)     AS 总金额,
       AVG(amount)     AS 平均金额,
       MAX(amount)     AS 最大单,
       MIN(amount)     AS 最小单
     FROM demo_orders`,
  );
  printRows('订单总览', agg);

  console.log('\n========== 2. COUNT 的三种写法差异 ==========');
  await conn.execute(`UPDATE demo_logs SET user_id = NULL WHERE id <= 100`); // 造 NULL
  const [counts] = await conn.execute(
    `SELECT
       COUNT(*)                AS count_all,       -- 全部行
       COUNT(user_id)          AS count_col,        -- 排除 NULL!
       COUNT(DISTINCT user_id) AS count_distinct    -- 去重且排除 NULL
     FROM demo_logs`,
  );
  printRows('COUNT(*) / COUNT(列) / COUNT(DISTINCT 列)', counts);
  await conn.execute(`UPDATE demo_logs SET user_id = 1 WHERE user_id IS NULL`); // 还原

  console.log('\n========== 3. GROUP BY 分组聚合 ==========');
  const [group] = await conn.execute(
    `SELECT status,
            COUNT(*)    AS 订单数,
            SUM(amount) AS 金额合计,
            AVG(amount) AS 平均金额
     FROM demo_orders
     GROUP BY status
     ORDER BY 金额合计 DESC`,
  );
  printRows('按订单状态分组', group);

  console.log('\n========== 4. HAVING:过滤分组(区别于 WHERE) ==========');
  // WHERE 在分组前过滤行;HAVING 在分组后过滤组
  const [having] = await conn.execute(
    `SELECT user_id, COUNT(*) AS 下单次数, SUM(amount) AS 消费总额
     FROM demo_orders
     WHERE status != 'cancelled'      -- 先过滤掉已取消的订单(行级)
     GROUP BY user_id
     HAVING 消费总额 > 500             -- 再筛出消费超 500 的用户(组级)
     ORDER BY 消费总额 DESC`,
  );
  printRows('消费超 500 的用户(WHERE 先行, HAVING 后组)', having);

  console.log('\n========== 5. 多列分组 + GROUP_CONCAT ==========');
  const [multi] = await conn.execute(
    `SELECT status,
            COUNT(*) AS cnt,
            GROUP_CONCAT(product) AS 商品列表   -- 把组内值拼成一行
     FROM demo_orders
     GROUP BY status`,
  );
  printRows('GROUP_CONCAT 拼接组内值', multi);

  console.log('\n========== 6. 窗口函数(MySQL 8+, 面试加分项) ==========');
  // 普通 GROUP BY 会把多行压成一行;窗口函数保留每一行,只追加聚合结果
  const [win1] = await conn.execute(
    `SELECT username, city, age,
            ROW_NUMBER() OVER (PARTITION BY city ORDER BY age DESC) AS 城内年龄排名,
            RANK()       OVER (PARTITION BY city ORDER BY age DESC) AS 并列排名
     FROM demo_users`,
  );
  printRows('每个城市内的年龄排名(PARTITION BY)', win1);

  // 实战:取"每个城市年龄最大的用户" —— 经典 top-N-per-group 问题
  const [topN] = await conn.execute(
    `SELECT username, city, age FROM (
       SELECT username, city, age,
              ROW_NUMBER() OVER (PARTITION BY city ORDER BY age DESC) AS rn
       FROM demo_users
     ) t WHERE rn = 1`,
  );
  printRows('每个城市年龄最大的人(分组取 Top1)', topN);

  // 累计求和:财务报表常用
  const [running] = await conn.execute(
    `SELECT DATE(created_at) AS 日期, amount,
            SUM(amount) OVER (ORDER BY created_at) AS 累计金额
     FROM demo_orders WHERE status = 'paid' ORDER BY created_at`,
  );
  printRows('按时间的累计消费(移动求和)', running);

  await conn.end();
  console.log('\ndemo 结束');
}

main().catch((err) => {
  console.error('运行出错:', err);
  process.exit(1);
});
