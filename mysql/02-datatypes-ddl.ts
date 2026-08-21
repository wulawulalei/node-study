/**
 * 02 - 数据类型与表设计
 *
 * 核心知识点:
 *   - 整数:INT vs BIGINT,UNSIGNED 翻倍上限
 *   - 小数:金额永远用 DECIMAL,不要用 FLOAT/DOUBLE(精度丢失!)
 *   - 字符串:VARCHAR vs CHAR vs TEXT
 *   - 时间:DATETIME vs TIMESTAMP(时区差异)
 *   - JSON 类型:灵活但失去索引/约束能力
 *   - DDL:CREATE / ALTER / DROP
 *
 * 运行: npx tsx mysql/02-datatypes-ddl.ts
 */
import { createConnection, initDatabase, printRows } from './utils';

async function main() {
  await initDatabase();
  const conn = await createConnection();

  console.log('========== 1. 浮点数精度陷阱:FLOAT vs DECIMAL ==========');
  await conn.query(`
    DROP TABLE IF EXISTS demo_types;
    CREATE TABLE demo_types (
      id        INT PRIMARY KEY AUTO_INCREMENT,
      f_money   FLOAT        COMMENT '浮点存金额(错误示范)',
      d_money   DECIMAL(10,2) COMMENT '定点存金额(正确)',
      name      CHAR(5)      COMMENT '定长,不足补空格',
      nick      VARCHAR(50)  COMMENT '变长',
      is_vip    TINYINT(1)   COMMENT 'MySQL 没有真布尔,用 TINYINT(1)',
      meta      JSON         COMMENT 'JSON 类型',
      created_at DATETIME,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;
  `);

  await conn.execute(
    `INSERT INTO demo_types (f_money, d_money, name, nick, is_vip, meta, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [0.1, 0.1, 'ab', '变长字符串', 1, JSON.stringify({ tags: ['新用户', 'vip'], score: 9.5 }), '2026-08-20 10:00:00'],
  );

  // 累加 10 次 0.1,观察 FLOAT 的精度漂移
  for (let i = 0; i < 9; i++) {
    await conn.execute('UPDATE demo_types SET f_money = f_money + 0.1, d_money = d_money + 0.1 WHERE id = 1');
  }
  const [money] = await conn.execute('SELECT f_money, d_money FROM demo_types WHERE id = 1');
  printRows('0.1 累加 10 次后的对比(金额必须用 DECIMAL)', money);

  console.log('\n========== 2. CHAR 与 VARCHAR 的区别 ==========');
  // CHAR 尾部空格会被截掉(存的时候补,取的时候去),VARCHAR 保留
  const [strs] = await conn.execute(
    `SELECT name, LENGTH(name) AS char_len, nick, LENGTH(nick) AS varchar_len FROM demo_types WHERE id = 1`,
  );
  printRows("CHAR(5) 存 'ab'", strs);

  console.log('\n========== 3. JSON 类型的读写 ==========');
  // MySQL 5.7+ 原生 JSON:可以按路径查询、提取
  const [json] = await conn.execute(
    `SELECT
       meta -> '$.tags'        AS tags,          -- 带引号的 JSON
       meta ->> '$.score'      AS score,          -- ->> 去掉引号
       JSON_CONTAINS(meta -> '$.tags', '"vip"') AS has_vip_tag
     FROM demo_types WHERE id = 1`,
  );
  printRows('JSON 路径查询', json);

  // JSON 更新:JSON_SET / JSON_ARRAY_APPEND
  await conn.execute(
    `UPDATE demo_types SET meta = JSON_SET(meta, '$.score', 10) WHERE id = 1`,
  );
  console.log('JSON_SET 更新 score 为 10 完成');

  console.log('\n========== 4. DATETIME vs TIMESTAMP ==========');
  const [times] = await conn.execute(
    `SELECT created_at, updated_at,
            NOW() AS \`now_time\`, UTC_TIMESTAMP() AS \`utc_time\`
     FROM demo_types WHERE id = 1`,
  );
  printRows('时间类型(TIMESTAMP 随时区转换, DATETIME 不转)', times);

  console.log('\n========== 5. ALTER TABLE:修改表结构 ==========');
  // 加列
  await conn.execute(`ALTER TABLE demo_types ADD COLUMN remark VARCHAR(100) DEFAULT '' COMMENT '备注'`);
  // 改列
  await conn.execute(`ALTER TABLE demo_types MODIFY COLUMN remark VARCHAR(200) NOT NULL DEFAULT ''`);
  // 加索引
  await conn.execute(`ALTER TABLE demo_types ADD INDEX idx_is_vip (is_vip)`);
  console.log('ALTER: 加列 / 改列 / 加索引完成');

  // 查看建表语句(学习表结构最有用的命令)
  const [ddl] = await conn.execute<import('mysql2').RowDataPacket[]>('SHOW CREATE TABLE demo_types');
  console.log('\n最终建表语句:\n', (ddl[0] as Record<string, string>)['Create Table']);

  // 清理
  await conn.execute('DROP TABLE demo_types');
  await conn.end();
  console.log('\ndemo_types 表已删除, demo 结束');
}

main().catch((err) => {
  console.error('运行出错:', err);
  process.exit(1);
});
