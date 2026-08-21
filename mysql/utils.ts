/**
 * demo 公共工具:数据库连接与测试数据初始化
 *
 * 所有 demo 统一使用 `mysql_study` 数据库,表名带 demo_ 前缀,
 * 每个 demo 运行前自动重建所需表,运行结束不删库(方便你用 mysql 客户端进去查看)
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';

/** 从环境变量读取连接配置(.env 文件或 shell 环境变量) */
export const DB_CONFIG = {
  host: process.env.MYSQL_HOST ?? '127.0.0.1',
  port: Number(process.env.MYSQL_PORT ?? 3306),
  user: process.env.MYSQL_USER ?? 'root',
  password: process.env.MYSQL_PASSWORD ?? '',
  // 允许一次执行多条 SQL(初始化 schema 时方便;查询时依然逐条参数化,无注入风险)
  multipleStatements: true,
  // 启用命名占位符 :name 写法(01 demo 第 6 节用到)
  namedPlaceholders: true,
} satisfies mysql.ConnectionOptions;

export const DB_NAME = 'mysql_study';

/** 创建不带数据库的连接(用于 CREATE DATABASE) */
export function createRawConnection() {
  return mysql.createConnection(DB_CONFIG);
}

/** 创建指向 mysql_study 库的连接 */
export function createConnection() {
  return mysql.createConnection({ ...DB_CONFIG, database: DB_NAME });
}

/** 创建连接池(演示 06 用) */
export function createPool() {
  return mysql.createPool({
    ...DB_CONFIG,
    database: DB_NAME,
    connectionLimit: 5,
    waitForConnections: true,
  });
}

/** 确保数据库存在,并初始化全部 demo 表 + 测试数据 */
export async function initDatabase() {
  const conn = await createRawConnection();
  await conn.query(
    `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`
     DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
  await conn.changeUser({ database: DB_NAME });

  // 重建带外键的表前,先关闭外键检查(否则 DROP 父表会报 3730),全部建完再恢复
  await conn.query('SET FOREIGN_KEY_CHECKS = 0');

  // ---- 用户表(01~06 都用它) ----
  await conn.query(`
    DROP TABLE IF EXISTS demo_users;
    CREATE TABLE demo_users (
      id         BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT COMMENT '主键',
      username   VARCHAR(50)  NOT NULL COMMENT '用户名',
      email      VARCHAR(100) NOT NULL COMMENT '邮箱',
      age        TINYINT UNSIGNED NOT NULL DEFAULT 18 COMMENT '年龄',
      city       VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '城市',
      balance    DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT '余额(演示事务转账)',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
      UNIQUE KEY uk_username (username),
      KEY idx_city_age (city, age)
    ) ENGINE=InnoDB COMMENT='用户表演示表';
  `);

  await conn.query(
    `INSERT INTO demo_users (username, email, age, city, balance) VALUES ?`,
    [
      [
        ['zhangsan', 'zhangsan@test.com', 25, '北京', 1000.0],
        ['lisi', 'lisi@test.com', 30, '上海', 500.0],
        ['wangwu', 'wangwu@test.com', 25, '北京', 200.0],
        ['zhaoliu', 'zhaoliu@test.com', 35, '上海', 0.0],
        ['sunqi', 'sunqi@test.com', 28, '深圳', 800.0],
        ['zhouba', 'zhouba@test.com', 40, '北京', 150.0],
        ['wujiu', 'wujiu@test.com', 22, '深圳', 300.0],
        ['zhengshi', 'zhengshi@test.com', 33, '上海', 50.0],
      ],
    ],
  );

  // ---- 订单表(演示 JOIN、聚合、索引) ----
  await conn.query(`
    DROP TABLE IF EXISTS demo_orders;
    CREATE TABLE demo_orders (
      id         BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      user_id    BIGINT UNSIGNED NOT NULL COMMENT '下单用户',
      product    VARCHAR(100) NOT NULL COMMENT '商品名',
      amount     DECIMAL(10,2) NOT NULL COMMENT '订单金额',
      status     ENUM('pending','paid','shipped','cancelled') NOT NULL DEFAULT 'pending' COMMENT '订单状态',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_user_id (user_id),
      KEY idx_status_created (status, created_at),
      CONSTRAINT fk_orders_user FOREIGN KEY (user_id)
        REFERENCES demo_users (id) ON DELETE CASCADE
    ) ENGINE=InnoDB COMMENT='订单表演示表';
  `);

  await conn.query(
    `INSERT INTO demo_orders (user_id, product, amount, status, created_at) VALUES ?`,
    [
      [
        [1, '机械键盘', 299.0, 'paid', '2026-08-01 10:00:00'],
        [1, '鼠标', 99.0, 'shipped', '2026-08-05 11:00:00'],
        [2, '显示器', 1299.0, 'paid', '2026-08-03 09:30:00'],
        [2, '键盘膜', 19.9, 'cancelled', '2026-08-04 14:00:00'],
        [3, '耳机', 399.0, 'pending', '2026-08-10 16:20:00'],
        [5, '机械键盘', 299.0, 'paid', '2026-08-11 08:00:00'],
        [5, '鼠标', 99.0, 'paid', '2026-08-12 12:00:00'],
        [5, '音箱', 599.0, 'shipped', '2026-08-15 19:45:00'],
        [7, '数据线', 29.9, 'paid', '2026-08-18 20:00:00'],
      ],
    ],
  );

  // ---- 库存表(演示行锁、悲观锁/乐观锁) ----
  await conn.query(`
    DROP TABLE IF EXISTS demo_stock;
    CREATE TABLE demo_stock (
      id      BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      product VARCHAR(100) NOT NULL,
      stock   INT UNSIGNED NOT NULL COMMENT '库存数量',
      version INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '乐观锁版本号',
      UNIQUE KEY uk_product (product)
    ) ENGINE=InnoDB COMMENT='库存表演示表';
  `);

  await conn.query(`INSERT INTO demo_stock (product, stock) VALUES ('机械键盘', 10), ('鼠标', 50)`);

  // ---- 日志表(演示 COUNT/索引覆盖、大数据量场景) ----
  await conn.query(`
    DROP TABLE IF EXISTS demo_logs;
    CREATE TABLE demo_logs (
      id      BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      level   ENUM('debug','info','warn','error') NOT NULL,
      message VARCHAR(255) NOT NULL,
      user_id BIGINT UNSIGNED NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_level_created (level, created_at)
    ) ENGINE=InnoDB COMMENT='日志表演示表';
  `);

  // 批量插入 5000 条日志,供索引/慢查询演示
  const levels = ['debug', 'info', 'warn', 'error'] as const;
  const rows: [string, string, number][] = [];
  for (let i = 1; i <= 5000; i++) {
    const level = levels[i % 100 === 0 ? 3 : i % 4]; // 1% error,其余均分
    rows.push([level, `日志消息 ${i}`, (i % 8) + 1]);
  }
  // 分批插入,每批 1000 条
  for (let i = 0; i < rows.length; i += 1000) {
    await conn.query(`INSERT INTO demo_logs (level, message, user_id) VALUES ?`, [
      rows.slice(i, i + 1000),
    ]);
  }

  await conn.query('SET FOREIGN_KEY_CHECKS = 1');
  const [u] = await conn.query<mysql.RowDataPacket[]>(`SELECT COUNT(*) AS c FROM demo_users`);
  const [o] = await conn.query<mysql.RowDataPacket[]>(`SELECT COUNT(*) AS c FROM demo_orders`);
  const [l] = await conn.query<mysql.RowDataPacket[]>(`SELECT COUNT(*) AS c FROM demo_logs`);
  console.log(
    `[init] 数据库 ${DB_NAME} 初始化完成: 用户 ${u[0].c} 条, 订单 ${o[0].c} 条, 日志 ${l[0].c} 条`,
  );
  await conn.end();
}

/** 打印查询结果表格 */
export function printRows(title: string, rows: unknown) {
  console.log(`\n--- ${title} ---`);
  console.table(rows);
}