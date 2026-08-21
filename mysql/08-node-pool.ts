/**
 * 08 - Node.js 工程实战:连接池 / 预处理 / 错误处理
 *
 * 核心知识点:
 *   - 为什么生产环境必须用连接池而不是单连接
 *   - pool.execute 自动获取/归还连接
 *   - 连接池中的事务:必须显式 pool.getConnection()
 *   - 常见错误码处理:ER_DUP_ENTRY(唯一键冲突)等
 *   - 优雅关闭:pool.end()
 *
 * 运行: npx tsx mysql/08-node-pool.ts
 */
import { createPool, initDatabase, printRows } from './utils';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

async function main() {
  await initDatabase();
  const pool = createPool();

  console.log('========== 1. 连接池并发查询 ==========');
  // 单连接:10 个查询只能排队串行
  // 连接池:5 个连接并发执行,其余排队等待空闲连接
  const start = Date.now();
  await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      pool.execute('SELECT SLEEP(0.1) AS t, ? AS i', [i]), // 每个查询睡 100ms
    ),
  );
  console.log(`10 个 100ms 查询(池大小 5): 总耗时 ${Date.now() - start}ms(约 2 轮 = 200ms,证明并发)`);

  console.log('\n========== 2. 连接池 + 事务 ==========');
  // 注意:事务必须固定在同一个连接上,所以要从池里显式取连接
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(`UPDATE demo_users SET balance = balance + 10 WHERE id = 1`);
    await conn.execute(`UPDATE demo_users SET balance = balance - 10 WHERE id = 2`);
    await conn.commit();
    console.log('池连接事务提交成功');
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release(); // 归还连接到池(不是关闭!)
  }

  console.log('\n========== 3. 错误处理:唯一键冲突 ==========');
  try {
    await pool.execute(
      `INSERT INTO demo_users (username, email) VALUES (?, ?)`,
      ['zhangsan', 'dup@test.com'], // username 已存在,触发唯一键
    );
  } catch (err) {
    const e = err as { code?: string; errno?: number; sqlMessage?: string };
    if (e.code === 'ER_DUP_ENTRY') {
      // 业务上最常见的错误,应该转成友好提示而不是 500
      console.log(`捕获唯一键冲突: ${e.sqlMessage}`);
      console.log('→ 业务处理:返回"用户名已存在"而不是抛 500');
    }
  }

  console.log('\n========== 4. INSERT ... ON DUPLICATE KEY UPDATE(upsert) ==========');
  // 存在就更新,不存在就插入 —— 比先 SELECT 再判断的原子性写法
  await pool.execute(
    `INSERT INTO demo_stock (product, stock) VALUES ('机械键盘', 100)
     ON DUPLICATE KEY UPDATE stock = stock + VALUES(stock)`,
  );
  const [kb] = await pool.execute<RowDataPacket[]>(
    `SELECT product, stock FROM demo_stock WHERE product = '机械键盘'`,
  );
  printRows('upsert 补货 100 件', kb);

  console.log('\n========== 5. 批量写入性能对比 ==========');
  await pool.execute(`DROP TABLE IF EXISTS demo_perf`);
  await pool.execute(`CREATE TABLE demo_perf (id INT PRIMARY KEY AUTO_INCREMENT, val VARCHAR(50))`);

  // 逐条插入 1000 次
  let t = Date.now();
  for (let i = 0; i < 1000; i++) {
    await pool.execute(`INSERT INTO demo_perf (val) VALUES (?)`, [`row-${i}`]);
  }
  const oneByOne = Date.now() - t;
  await pool.execute(`TRUNCATE demo_perf`);

  // 批量插入:一次 SQL 带 1000 行
  t = Date.now();
  await pool.query(`INSERT INTO demo_perf (val) VALUES ?`, [
    Array.from({ length: 1000 }, (_, i) => [`row-${i}`]),
  ]);
  const batch = Date.now() - t;

  console.table([
    { 方式: '逐条 INSERT x 1000', 耗时ms: oneByOne },
    { 方式: '批量 INSERT VALUES ?', 耗时ms: batch },
  ]);
  console.log(`批量快 ${(oneByOne / batch).toFixed(1)} 倍(网络往返次数的差异)`);

  console.log('\n========== 6. 防止查询失控:超时与行数保护 ==========');
  // maxRows:限制返回行数;timeout:语句级超时(mysql2 仅对 query 有效)
  const [limited] = await pool.query<RowDataPacket[]>({
    sql: `SELECT * FROM demo_logs`,
    timeout: 5000, // 5 秒超时,超时抛出 ETIMEDOUT
  });
  console.log(`demo_logs 共 ${limited.length} 行,正常返回`);

  await pool.execute(`DROP TABLE demo_perf`);

  // 优雅关闭:等所有连接空闲后关闭池
  await pool.end();
  console.log('\n连接池已关闭, demo 结束');
}

main().catch((err) => {
  console.error('运行出错:', err);
  process.exit(1);
});
