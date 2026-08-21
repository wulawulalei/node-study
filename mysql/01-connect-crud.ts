/**
 * 01 - 连接与基础 CRUD
 *
 * 核心知识点:
 *   - mysql2 的两种 API:query(直接拼接)/ execute(预编译 + 参数绑定)
 *   - 永远用占位符 ? 传参,禁止字符串拼接 SQL(SQL 注入!)
 *   - 连接必须关闭:conn.end(),否则进程不退出
 *   - 命名占位符 :name 的用法
 *
 * 运行: npx tsx mysql/01-connect-crud.ts
 */
import { createConnection, initDatabase, printRows } from './utils';

async function main() {
  await initDatabase();
  const conn = await createConnection();

  console.log('========== 1. 查询(SELECT) ==========');
  // execute:预编译语句,参数自动转义,这是标准姿势
  const [users] = await conn.execute('SELECT id, username, age, city FROM demo_users WHERE age > ?', [
    25,
  ]);
  printRows('age > 25 的用户', users);

  // IN 查询:占位符数量要匹配,可以用数组展开
  const cities = ['北京', '深圳'];
  const placeholders = cities.map(() => '?').join(',');
  const [cityUsers] = await conn.execute(
    `SELECT username, city FROM demo_users WHERE city IN (${placeholders})`,
    cities,
  );
  printRows('北京/深圳的用户', cityUsers);

  console.log('\n========== 2. 插入(INSERT) ==========');
  const [insertResult] = await conn.execute<import('mysql2').ResultSetHeader>(
    'INSERT INTO demo_users (username, email, age, city, balance) VALUES (?, ?, ?, ?, ?)',
    ['xiaoming', 'xiaoming@test.com', 26, '杭州', 666.0],
  );
  console.log(`插入成功, 自增 id = ${insertResult.insertId}, 影响行数 = ${insertResult.affectedRows}`);

  // 批量插入:query + VALUES ?(注意:批量插入是 mysql2 对 query 的扩展,execute 不支持)
  await conn.query('INSERT INTO demo_users (username, email, age, city) VALUES ?', [
    [
      ['batch_a', 'a@test.com', 20, '广州'],
      ['batch_b', 'b@test.com', 21, '广州'],
    ],
  ]);
  console.log('批量插入 2 条完成');

  console.log('\n========== 3. 更新(UPDATE) ==========');
  const [updateResult] = await conn.execute<import('mysql2').ResultSetHeader>(
    'UPDATE demo_users SET age = age + 1 WHERE username = ?',
    ['xiaoming'],
  );
  console.log(`更新影响行数 = ${updateResult.affectedRows}, 实际变更行数 = ${updateResult.changedRows}`);
  // 注意 affectedRows vs changedRows:值没变化时 changedRows 为 0

  console.log('\n========== 4. 删除(DELETE) ==========');
  const [deleteResult] = await conn.execute<import('mysql2').ResultSetHeader>(
    'DELETE FROM demo_users WHERE username IN (?, ?)',
    ['batch_a', 'batch_b'],
  );
  console.log(`删除影响行数 = ${deleteResult.affectedRows}`);

  console.log('\n========== 5. SQL 注入演示(为什么禁止拼接字符串) ==========');
  const input = "zhangsan' OR '1'='1";
  // ❌ 错误写法(仅演示,永远不要这么写):
  const [injected] = await conn.query(`SELECT username FROM demo_users WHERE username = '${input}'`);
  console.log(`拼接字符串查询到 ${(injected as unknown[]).length} 条(被注入了!)`);
  // ✅ 正确写法:占位符让参数永远不会被当成 SQL 语法
  const [safe] = await conn.execute('SELECT username FROM demo_users WHERE username = ?', [input]);
  console.log(`参数化查询到 ${(safe as unknown[]).length} 条(注入无效)`);

  console.log('\n========== 6. 命名占位符 ==========');
  const [named] = await conn.execute(
    'SELECT username, age FROM demo_users WHERE city = :city AND age >= :minAge',
    { city: '上海', minAge: 30 },
  );
  printRows('命名占位符查询', named);

  await conn.end();
  console.log('\n连接已关闭, demo 结束');
}

main().catch((err) => {
  console.error('运行出错:', err);
  process.exit(1);
});
