# Lua 学习 Demo 集

一套从零到实战的 Lua 5.4 学习示例，共 13 个主题，每个文件独立可运行、注释全中文。

## 运行环境

本机已通过源码编译安装 Lua 5.4.8 到 `~/.local/bin/`（已写入 `~/.zshrc` 的 PATH）。
新开终端后直接使用 `lua` 命令即可；当前终端请先执行：

```bash
export PATH="$HOME/.local/bin:$PATH"
```

## 运行方式

```bash
cd lua
lua 01_basics.lua        # 运行单个
# 或从项目根目录运行
lua lua/01_basics.lua
```

## 学习路径（按编号顺序）

| 文件 | 主题 | 核心知识点 |
|------|------|-----------|
| [01_basics.lua](01_basics.lua) | 变量与基本类型 | 8 种类型、`local`、多重赋值、`..` 拼接、`and/or` 默认值 |
| [02_control_flow.lua](02_control_flow.lua) | 流程控制 | `if/while/repeat/for`、`ipairs/pairs`、表查法替代 switch |
| [03_functions.lua](03_functions.lua) | 函数 | 多返回值、可变参数 `...`、闭包、尾调用优化 |
| [04_tables.lua](04_tables.lua) | 表 | 数组/字典/混合、引用语义、浅拷贝与深拷贝 |
| [05_metatables.lua](05_metatables.lua) | 元表 | `__index/__newindex/__call`、运算符重载、raw 系列 |
| [06_oop.lua](06_oop.lua) | 面向对象 | 冒号语法、类与继承、闭包私有、只读属性、多重继承 |
| [07_strings.lua](07_strings.lua) | 字符串与模式匹配 | Lua 模式语法（非正则）、`match/gmatch/gsub`、实战 split/trim |
| [08_iterators.lua](08_iterators.lua) | 迭代器 | 手写 `pairs/ipairs`、filter/map 链式、惰性无限序列 |
| [09_coroutines.lua](09_coroutines.lua) | 协程 | `resume/yield`、生成器、生产者-消费者、任务调度 |
| [10_modules.lua](10_modules.lua) | 模块 | `require` 机制、缓存、`package.path`、模块写法 |
| [utils.lua](utils.lua) | 演示模块 | 被 10 号 demo require 的标准模块示例 |
| [11_error_handling.lua](11_error_handling.lua) | 错误处理 | `pcall/xpcall/assert`、nil+err 惯用法、错误包装 |
| [12_stdlib.lua](12_stdlib.lua) | 标准库速览 | `math/os/io/table/string/utf8` 高频 API |
| [13_practical.lua](13_practical.lua) | 综合实战 | 令牌桶限流器、日志器、协程调度器、链式查询构造器 |

## 学习建议

1. 按编号顺序逐个运行，对照注释理解每个知识点；
2. 修改示例代码再运行，观察输出变化（Lua 报错信息很友好）；
3. 重点吃透 **04 表**、**05 元表**、**06 OOP** —— 这三章是 Lua 的灵魂；
4. 13 号实战是前 12 章的综合运用，可当作检验。

## 备忘：Lua 与其他语言的关键差异

- 数组下标从 **1** 开始，不是 0；
- 只有 `false` 和 `nil` 为假，`0` 和空字符串都是真；
- 没有 `++`、`+=`、`continue`、`switch`、`try-catch`；
- 字符串拼接用 `..` 不是 `+`；
- 表是引用类型，赋值不拷贝；
- 函数可多返回值，模块本质就是返回一个表。
