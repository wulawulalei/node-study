/**
 * 03 - 查询进阶:WHERE / 排序 / 分页 / 去重 / NULL
 *
 * 核心知识点:
 *   - 比较运算、BETWEEN、IN、LIKE 的用法与陷阱
 *   - NULL 的三值逻辑:= NULL 永远为 UNKNOWN,必须用 IS NULL
 *   - ORDER BY 多列排序、LIMIT 分页与深分页问题
 *   - DISTINCT 去重
 *   - CASE WHEN 条件表达式
 *
 * 运行: npx tsx mysql/03-query.ts
 */
import { createConnection, initDatabase, printRows } from './utils';

async function main() {
  await initDatabase();
  const conn = await createConnection();

  console.log('========== 1. 条件查询:比较 / BETWEEN / IN / LIKE ==========');
  const [between] = await conn.execute(
    `SELECT username, age FROM demo_users WHERE age BETWEEN 25 AND 30 ORDER BY age`,
  );
  printRows('年龄 25~30(BETWEEN 是闭区间)', between);

  // LIKE:% 任意字符任意个,_ 单个字符;% 开头无法走索引!
  const [like] = await conn.execute(
    `SELECT username FROM demo_users WHERE username LIKE ?`,
    ['zhang%'],
  );
  printRows("用户名 zhang 开头(前缀匹配可走索引)", like);

  console.log('\n========== 2. NULL 的三值逻辑(高频坑) ==========');
  // demo_users.city 是 NOT NULL,改成插入 NULL 邮箱的用户来演示
  await conn.execute(`ALTER TABLE demo_users MODIFY COLUMN email VARCHAR(100) NULL`);
  await conn.execute(
    `INSERT INTO demo_users (username, email, age, city) VALUES ('null_email', NULL, 99, '测试')`,
  );
  const [eqNull] = await conn.execute(
    `SELECT COUNT(*) AS c FROM demo_users WHERE email = NULL`,
  );
  const [neNull] = await conn.execute(
    `SELECT COUNT(*) AS c FROM demo_users WHERE email != NULL`,
  );
  const [isNull] = await conn.execute(
    `SELECT COUNT(*) AS c FROM demo_users WHERE email IS NULL`,
  );
  console.table([
    { 写法: 'email = NULL', 结果: (eqNull as never[])[0]['c'], 说明: '永远是 0!NULL 不等于任何值' },
    { 写法: 'email != NULL', 结果: (neNull as never[])[0]['c'], 说明: '也是 0!UNKNOWN 不为真' },
    { 写法: 'email IS NULL', 结果: (isNull as never[])[0]['c'], 说明: '✅ 正确写法' },
  ]);
  // 顺手演示:COUNT(列) 会排除 NULL
  const [cnt] = await conn.execute<import('mysql2').RowDataPacket[]>(
    `SELECT COUNT(*) AS 全部, COUNT(email) AS 排除NULL FROM demo_users`,
  );
  console.log(`COUNT(*) = ${cnt[0]['全部']}, COUNT(email) = ${cnt[0]['排除NULL']}(差值就是 NULL 行)`);
  await conn.execute(`DELETE FROM demo_users WHERE username = 'null_email'`);

  console.log('\n========== 3. 排序:ORDER BY 多列 ==========');
  const [sorted] = await conn.execute(
    `SELECT username, city, age FROM demo_users
     ORDER BY city ASC, age DESC
     LIMIT 5`,
  );
  printRows('按城市升序,同城按年龄降序', sorted);

  console.log('\n========== 4. 分页:LIMIT offset, size ==========');
  // 注意:execute 的预处理语句不接受 LIMIT 占位符(MySQL 服务端限制),
  // 分页参数要先在 JS 侧转成整数再拼进 SQL(parseInt 后无注入风险)
  const pageSize = 3;
  const offset = 0;
  const [page1] = await conn.query(
    `SELECT id, username FROM demo_users ORDER BY id LIMIT ${offset}, ${pageSize}`,
  );
  printRows('第 1 页(3 条)', page1);

  // 深分页优化:LIMIT 100000,10 要扫 100010 行;
  // 用"记录上次最大 id"的方式,WHERE id > ? LIMIT n 只扫 n 行(LIMIT 同样内联整数)
  const lastMaxId = 4000;
  const [deep] = await conn.query(
    `SELECT id, message FROM demo_logs WHERE id > ${lastMaxId} ORDER BY id LIMIT ${pageSize}`,
  );
  printRows('游标分页(id > 4000 后取 3 条,深分页推荐写法)', deep);

  console.log('\n========== 5. 去重:DISTINCT ==========');
  const [distinct] = await conn.execute(`SELECT DISTINCT city FROM demo_users ORDER BY city`);
  printRows('所有城市(去重)', distinct);

  console.log('\n========== 6. CASE WHEN:行内条件分支 ==========');
  const [caseWhen] = await conn.execute(
    `SELECT username, age,
       CASE
         WHEN age < 25 THEN '青年'
         WHEN age < 35 THEN '壮年'
         ELSE '资深'
       END AS age_group
     FROM demo_users ORDER BY age`,
  );
  printRows('CASE WHEN 分年龄段', caseWhen);

  // 用 CASE WHEN 实现"行列转换"风格的条件统计
  const [pivot] = await conn.execute(
    `SELECT
       COUNT(*) AS 总数,
       SUM(CASE WHEN city = '北京' THEN 1 ELSE 0 END) AS 北京,
       SUM(CASE WHEN city = '上海' THEN 1 ELSE 0 END) AS 上海,
       SUM(CASE WHEN city = '深圳' THEN 1 ELSE 0 END) AS 深圳
     FROM demo_users`,
  );
  printRows('条件计数(一行统计多个城市)', pivot);

  await conn.end();
  console.log('\ndemo 结束');
}

main().catch((err) => {
  console.error('运行出错:', err);
  process.exit(1);
});
