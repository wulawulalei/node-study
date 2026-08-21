/**
 * 05 - 多表关联:JOIN / 子查询 / UNION
 *
 * 核心知识点:
 *   - INNER JOIN:只保留两边都匹配的行
 *   - LEFT JOIN:左表全保留,右表没匹配补 NULL(右表字段的 WHERE 条件要放进 ON!)
 *   - 用 LEFT JOIN ... IS NULL 找"没有关联数据"的行(反连接)
 *   - 子查询:IN / EXISTS / 派生表
 *   - UNION(去重)vs UNION ALL(不去重,更快)
 *
 * 运行: npx tsx mysql/05-join.ts
 */
import { createConnection, initDatabase, printRows } from './utils';

async function main() {
  await initDatabase();
  const conn = await createConnection();

  console.log('========== 1. INNER JOIN:两表交集 ==========');
  const [inner] = await conn.execute(
    `SELECT u.username, o.product, o.amount, o.status
     FROM demo_orders o
     INNER JOIN demo_users u ON o.user_id = u.id
     ORDER BY o.id`,
  );
  printRows('订单 + 下单用户(INNER JOIN)', inner);

  console.log('\n========== 2. LEFT JOIN:保留左表全部 ==========');
  // 用户 4、6、8 没有订单,LEFT JOIN 后订单字段为 NULL
  const [left] = await conn.execute(
    `SELECT u.username, o.product
     FROM demo_users u
     LEFT JOIN demo_orders o ON o.user_id = u.id
     ORDER BY u.id`,
  );
  printRows('所有用户(没下过单的也列出)', left);

  console.log('\n========== 3. 反连接:找出"从没下过单"的用户 ==========');
  const [anti] = await conn.execute(
    `SELECT u.username, u.city
     FROM demo_users u
     LEFT JOIN demo_orders o ON o.user_id = u.id
     WHERE o.id IS NULL`,
  );
  printRows('LEFT JOIN ... WHERE 右表主键 IS NULL', anti);

  console.log('\n========== 4. LEFT JOIN 高频坑:右表条件写错位置 ==========');
  // 条件放 WHERE:右表 NULL 行被过滤,LEFT JOIN 退化成 INNER JOIN
  const [wrong] = await conn.execute(
    `SELECT u.username, o.product
     FROM demo_users u
     LEFT JOIN demo_orders o ON o.user_id = u.id
     WHERE o.status = 'paid'`,
  );
  // 条件放 ON:左表依然全保留,只是不匹配的行右表为 NULL
  const [right] = await conn.execute(
    `SELECT u.username, o.product
     FROM demo_users u
     LEFT JOIN demo_orders o ON o.user_id = u.id AND o.status = 'paid'`,
  );
  console.log(`右表条件放 WHERE: 剩 ${(wrong as never[]).length} 行(退化成了 INNER JOIN)`);
  console.log(`右表条件放 ON:    剩 ${(right as never[]).length} 行(LEFT JOIN 语义正确)`);

  console.log('\n========== 5. 子查询:IN / EXISTS / 派生表 ==========');
  // IN 子查询
  const [inSub] = await conn.execute(
    `SELECT username FROM demo_users
     WHERE id IN (SELECT user_id FROM demo_orders WHERE status = 'paid')`,
  );
  printRows('下过已支付订单的用户(IN 子查询)', inSub);

  // EXISTS:通常比 IN 更优(尤其子查询结果大时),找到一条就停
  const [exists] = await conn.execute(
    `SELECT username FROM demo_users u
     WHERE EXISTS (
       SELECT 1 FROM demo_orders o WHERE o.user_id = u.id AND o.amount > 500
     )`,
  );
  printRows('有超过 500 元订单的用户(EXISTS)', exists);

  // 派生表(FROM 里的子查询):先聚合再 JOIN
  const [derived] = await conn.execute(
    `SELECT u.username, t.消费总额
     FROM demo_users u
     JOIN (
       SELECT user_id, SUM(amount) AS 消费总额
       FROM demo_orders WHERE status != 'cancelled'
       GROUP BY user_id
     ) t ON t.user_id = u.id
     ORDER BY t.消费总额 DESC`,
  );
  printRows('用户消费排行(派生表先聚合再 JOIN)', derived);

  console.log('\n========== 6. UNION vs UNION ALL ==========');
  const [union] = await conn.execute(
    `SELECT product FROM demo_orders WHERE user_id = 1
     UNION
     SELECT product FROM demo_orders WHERE user_id = 5`,
  );
  printRows('UNION:合并并去重(键盘重复只出现一次)', union);

  const [unionAll] = await conn.execute(
    `SELECT product FROM demo_orders WHERE user_id = 1
     UNION ALL
     SELECT product FROM demo_orders WHERE user_id = 5`,
  );
  printRows('UNION ALL:合并不去重(更快,能不用去重就用它)', unionAll);

  await conn.end();
  console.log('\ndemo 结束');
}

main().catch((err) => {
  console.error('运行出错:', err);
  process.exit(1);
});
