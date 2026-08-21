/**
 * 06 - 事务:ACID / 提交回滚 / 隔离级别 / 死锁
 *
 * 核心知识点:
 *   - 事务四大特性 ACID:原子性、一致性、隔离性、持久性
 *   - 基本流程:beginTransaction → 执行 SQL → commit / rollback
 *   - 经典场景:转账(要么都成功,要么都失败)
 *   - 隔离级别:读未提交 < 读已提交 < 可重复读(InnoDB 默认) < 串行化
 *   - SELECT ... FOR UPDATE:悲观锁,锁住行防止并发修改
 *
 * 运行: npx tsx mysql/06-transaction.ts
 */
import { createConnection, initDatabase, printRows } from './utils';

/** 转账:A 给 B 转 amount 元,要么全成功要么全失败 */
async function transfer(fromId: number, toId: number, amount: number) {
  const conn = await createConnection();
  try {
    // 1. 开启事务(关闭自动提交)
    await conn.beginTransaction();

    // 2. 扣款(FOR UPDATE 加行锁,防止并发转账读到旧余额)
    const [rows] = await conn.execute<import('mysql2').RowDataPacket[]>(
      'SELECT balance FROM demo_users WHERE id = ? FOR UPDATE',
      [fromId],
    );
    if (rows.length === 0) throw new Error('付款人不存在');
    if (Number(rows[0].balance) < amount) throw new Error('余额不足,转账回滚');

    await conn.execute('UPDATE demo_users SET balance = balance - ? WHERE id = ?', [amount, fromId]);
    await conn.execute('UPDATE demo_users SET balance = balance + ? WHERE id = ?', [amount, toId]);

    // 3. 全部成功才提交
    await conn.commit();
    console.log(`✅ 转账成功: ${fromId} -> ${toId}, 金额 ${amount}`);
  } catch (err) {
    // 4. 任何一步失败,回滚到事务开始前的状态
    await conn.rollback();
    console.log(`❌ 转账失败已回滚: ${(err as Error).message}`);
  } finally {
    await conn.end();
  }
}

async function main() {
  await initDatabase();

  console.log('========== 1. 转账事务:成功与回滚 ==========');
  const [before] = await createConnection().then(async (c) => {
    const [r] = await c.execute(
      `SELECT username, balance FROM demo_users WHERE id IN (1, 2)`,
    );
    await c.end();
    return [r];
  });
  printRows('转账前余额(id=1 张三, id=2 李四)', before);

  await transfer(1, 2, 100); // 余额够:成功
  await transfer(1, 2, 99999); // 余额不够:抛错回滚

  const conn = await createConnection();
  const [after] = await conn.execute(`SELECT username, balance FROM demo_users WHERE id IN (1, 2)`);
  printRows('转账后余额(只有成功的那笔生效)', after);

  console.log('\n========== 2. 并发扣库存:FOR UPDATE 悲观锁防超卖 ==========');
  // 场景:库存 10 件,20 个并发请求各买 1 件
  // 错误做法:SELECT 读出 stock → JS 判断 > 0 → UPDATE,并发下会超卖
  // 正确做法:事务内 SELECT ... FOR UPDATE 锁住该行,其他事务排队等待
  async function buyWithLock(buyerId: number): Promise<boolean> {
    const c = await createConnection();
    try {
      await c.beginTransaction();
      // FOR UPDATE:拿到这一行的排他锁,其他事务的 FOR UPDATE 会阻塞等待
      const [rows] = await c.execute<import('mysql2').RowDataPacket[]>(
        `SELECT stock FROM demo_stock WHERE product = '机械键盘' FOR UPDATE`,
      );
      if (rows[0].stock <= 0) {
        await c.rollback();
        return false;
      }
      await c.execute(`UPDATE demo_stock SET stock = stock - 1 WHERE product = '机械键盘'`);
      await c.commit();
      return true;
    } catch {
      await c.rollback();
      return false;
    } finally {
      await c.end();
    }
  }

  const results = await Promise.all(
    Array.from({ length: 20 }, (_, i) => buyWithLock(i)),
  );
  const successCount = results.filter(Boolean).length;
  const [stockAfter] = await conn.execute(
    `SELECT stock FROM demo_stock WHERE product = '机械键盘'`,
  );
  console.log(`20 人抢购 10 件库存: 成功 ${successCount} 人, 剩余库存 ${(stockAfter as never[])[0]['stock']}`);
  console.log('库存恰好为 0,没有超卖 —— FOR UPDATE 起了作用');

  console.log('\n========== 3. 乐观锁:版本号机制 ==========');
  // 悲观锁串行化性能差;冲突少的场景用乐观锁:UPDATE 时校验版本号
  async function buyOptimistic(retries = 3): Promise<boolean> {
    for (let i = 0; i < retries; i++) {
      const c = await createConnection();
      const [rows] = await c.execute<import('mysql2').RowDataPacket[]>(
        `SELECT stock, version FROM demo_stock WHERE product = '鼠标'`,
      );
      await c.end();
      const { stock, version } = rows[0];
      if (stock <= 0) return false;

      const c2 = await createConnection();
      // 关键:WHERE 里带上读到的 version;被别人改过就更新 0 行
      const [r] = await c2.execute<import('mysql2').ResultSetHeader>(
        `UPDATE demo_stock SET stock = stock - 1, version = version + 1
         WHERE product = '鼠标' AND version = ? AND stock > 0`,
        [version],
      );
      await c2.end();
      if (r.affectedRows === 1) return true; // 成功
      // affectedRows = 0 说明版本被改,重试
    }
    return false;
  }
  const optResults = await Promise.all(Array.from({ length: 20 }, () => buyOptimistic()));
  const [mouseStock] = await conn.execute(
    `SELECT stock, version FROM demo_stock WHERE product = '鼠标'`,
  );
  console.log(`20 人抢购 50 件鼠标(乐观锁): 成功 ${optResults.filter(Boolean).length} 人`);
  printRows('鼠标库存与版本号', mouseStock);

  console.log('\n========== 4. 查看与设置隔离级别 ==========');
  const [iso] = await conn.execute<import('mysql2').RowDataPacket[]>(
    `SELECT @@transaction_isolation AS 当前隔离级别`,
  );
  printRows('InnoDB 默认 REPEATABLE-READ(可重复读)', iso);
  // 四种隔离级别解决的问题:
  //   READ UNCOMMITTED  会读到别人没提交的数据(脏读)
  //   READ COMMITTED    只读已提交,但同事务两次读可能不同(不可重复读)
  //   REPEATABLE READ   同事务多次读结果一致(MVCC 快照,InnoDB 默认)
  //   SERIALIZABLE      完全串行,最慢最安全
  // 设置方式: SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED;

  await conn.end();
  console.log('\ndemo 结束');
}

main().catch((err) => {
  console.error('运行出错:', err);
  process.exit(1);
});
