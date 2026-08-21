/**
 * 07 - 索引与 EXPLAIN 执行计划
 *
 * 核心知识点:
 *   - 索引本质:B+ 树,用空间换时间
 *   - EXPLAIN 关键字段:type(ALL 全表扫描最差)、key、rows、Extra
 *   - 联合索引最左前缀原则:(a,b,c) 能服务 a / a,b / a,b,c,不能服务 b,c
 *   - 索引失效场景:函数包列、隐式类型转换、% 开头 LIKE、OR 跨索引
 *   - 覆盖索引:SELECT 的列都在索引里,无需回表(Extra: Using index)
 *
 * 运行: npx tsx mysql/07-index-explain.ts
 */
import { createConnection, initDatabase, printRows } from './utils';
import type { RowDataPacket } from 'mysql2';

/**
 * 查看一条 SQL 的执行计划
 * 说明:本机是 MySQL 8.4/9.x(返回 "Rows fetched before execution" 风格的新执行计划),
 * 传统 EXPLAIN 的 tabular 输出已改为单字段文本,所以这里用 EXPLAIN FORMAT=JSON
 * 解析出 access_type / index_name / estimated_rows 等关键指标
 *
 * access_type 含义(从好到差):
 *   const / eq_ref  主键或唯一索引精准命中,最优
 *   index           索引查找/范围扫描,正常
 *   fulltext        全文索引
 *   filter / ALL    全表扫描过滤,数据量大时要警惕
 */
async function explain(
  conn: import('mysql2/promise').Connection,
  sql: string,
  params: unknown[] = [],
) {
  // 参数化占位符在新版 EXPLAIN 下不被支持,这里先把参数转义内联(仅用于演示计划,不执行)
  let fullSql = sql;
  for (const p of params) {
    const placeholder = typeof p === 'number' ? String(p) : conn.escape(p);
    fullSql = fullSql.replace(/^\?/, placeholder); // 占位符在句首
    fullSql = fullSql.replace(/([ (]) \?/, `$1 ${placeholder}`); // 句中(带前导空格防误匹配)
    fullSql = fullSql.replace(/\?/, placeholder); // 兜底顺序替换
  }
  const [rows] = await conn.query<RowDataPacket[]>(`EXPLAIN FORMAT=JSON ${fullSql}`);
  const plan = JSON.parse((rows[0] as Record<string, string>)['EXPLAIN']);
  const qp = plan.query_plan ?? {};
  // 新版计划在 query_plan 上;filter 节点把真正的表访问藏在 inputs 里,下钻一层取索引信息
  const node = qp.table_name ? qp : (qp.inputs ?? []).find((n: Record<string, unknown>) => n.table_name) ?? qp;
  const extra: string[] = [];
  if (node.covering) extra.push('覆盖索引');
  if (node.key_columns) extra.push(`索引列: ${(node.key_columns as string[]).join(',')}`);
  if (node.lookup_condition) extra.push(String(node.lookup_condition));
  if (qp.attached_condition) extra.push(`过滤: ${String(qp.attached_condition).slice(0, 40)}`);
  if (node.index_access_type) extra.push(String(node.index_access_type));
  return [
    {
      access_type: node.access_type ?? qp.access_type ?? '-',
      index: node.index_name ?? null,
      预估行数: node.estimated_rows ?? qp.estimated_rows ?? null,
      备注: extra.join('; ') || (node.operation ?? qp.operation ?? '-'),
    },
  ];
}

async function main() {
  await initDatabase();
  const conn = await createConnection();

  console.log('========== 1. 没有索引时:全表扫描 ==========');
  // demo_users.username 有唯一索引,先删掉演示
  await conn.execute(`ALTER TABLE demo_users DROP INDEX uk_username`);
  printRows(
    'WHERE username = ?(无索引 → type=ALL)',
    await explain(conn, `SELECT * FROM demo_users WHERE username = ?`, ['zhangsan']),
  );

  console.log('\n========== 2. 加索引后:精准查找 ==========');
  await conn.execute(`ALTER TABLE demo_users ADD UNIQUE KEY uk_username (username)`);
  printRows(
    'WHERE username = ?(唯一索引 → type=const)',
    await explain(conn, `SELECT * FROM demo_users WHERE username = ?`, ['zhangsan']),
  );

  console.log('\n========== 3. 联合索引与最左前缀 ==========');
  // demo_users 上有联合索引 idx_city_age (city, age)
  printRows(
    'WHERE city = ?(用上前缀 city ✅)',
    await explain(conn, `SELECT * FROM demo_users WHERE city = ?`, ['北京']),
  );
  printRows(
    'WHERE city = ? AND age > ?(city+age 都用上 ✅)',
    await explain(conn, `SELECT * FROM demo_users WHERE city = ? AND age > ?`, ['北京', 25]),
  );
  printRows(
    'WHERE age > ?(跳过 city,最左前缀失效 ❌)',
    await explain(conn, `SELECT * FROM demo_users WHERE age > ?`, [25]),
  );

  console.log('\n========== 4. 索引失效的三种典型写法 ==========');
  // demo_logs 已有 idx_level_created(level, created_at),
  // 加上 level 前缀条件,范围查询才能命中联合索引的第二列
  printRows(
    '对列做函数运算 YEAR(created_at)(❌ 失效)',
    await explain(conn, `SELECT * FROM demo_logs WHERE YEAR(created_at) = 2026`),
  );
  printRows(
    '改成范围查询(✅ 走上联合索引第二列)',
    await explain(
      conn,
      `SELECT * FROM demo_logs WHERE level = ? AND created_at >= ? AND created_at < ?`,
      ['error', '2026-01-01', '2027-01-01'],
    ),
  );
  printRows(
    "LIKE '%关键词' 前导通配符(❌ 失效)",
    await explain(conn, `SELECT * FROM demo_users WHERE username LIKE ?`, ['%san']),
  );
  printRows(
    "LIKE '前缀%'(✅ 可走索引)",
    await explain(conn, `SELECT * FROM demo_users WHERE username LIKE ?`, ['zhang%']),
  );

  console.log('\n========== 5. 覆盖索引:不回表 ==========');
  // idx_city_age(city, age) 里既有 city 又有 age,SELECT 只要这两列就不用回表
  printRows(
    'SELECT city, age(索引里有全部所需列 → Using index)',
    await explain(conn, `SELECT city, age FROM demo_users WHERE city = ?`, ['北京']),
  );
  printRows(
    'SELECT *(需要回表取其他列 → Using index condition 或回表)',
    await explain(conn, `SELECT * FROM demo_users WHERE city = ?`, ['北京']),
  );

  console.log('\n========== 6. 索引下推(ICP)与实战建议 ==========');
  // MySQL 5.6+ 的 ICP:把 WHERE 中能用到索引列的条件先在下层过滤,减少回表次数
  printRows(
    'city + username 模糊(ICP 下推过滤)',
    await explain(
      conn,
      `SELECT * FROM demo_users WHERE city = ? AND username LIKE ?`,
      ['北京', 'z%'],
    ),
  );

  console.log('\n📌 实战索引原则:');
  console.log('  1. 为 WHERE / JOIN ON / ORDER BY 涉及的列建索引');
  console.log('  2. 高频查询做成联合索引,区分度高的列放前面');
  console.log('  3. 索引不是越多越好:每个索引都会拖慢 INSERT/UPDATE');
  console.log('  4. 字符串列用前缀索引省空间: INDEX(email(20))');
  console.log('  5. 写 SQL 后 EXPLAIN 一遍,type=ALL 且 rows 大就要警惕');

  await conn.end();
  console.log('\ndemo 结束');
}

main().catch((err) => {
  console.error('运行出错:', err);
  process.exit(1);
});
