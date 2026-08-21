--[[
    01 - 变量与基本数据类型
    Lua 是动态类型语言，变量无需声明类型，直接赋值即可。
    运行方式：lua lua/01_basics.lua
]]

-- 单行注释以两个短横线开头

-- 1. Lua 的 8 种基本类型
print("===== 1. 八种基本类型 =====")
print(type(nil)) -- nil（空）
print(type(true)) -- boolean（布尔）
print(type(10)) -- number（数字，整数小数同为 number）
print(type(3.14)) -- number
print(type("你好 Lua")) -- string（字符串）
print(type(print)) -- function（函数）
print(type({})) -- table（表，核心数据结构）
print(type(coroutine.create(function() end))) -- thread（协程）

-- 2. 变量：默认全局，加 local 才是局部变量
print("\n===== 2. 全局与局部 =====")
name = "我是全局变量" -- 不带 local，会成为全局变量（不推荐）
local age = 18 -- 局部变量（推荐写法）
print(name, age)

-- 3. 多重赋值： Lua 特色，常用于交换变量
print("\n===== 3. 多重赋值 =====")
local a, b = 1, 2
a, b = b, a -- 一行完成交换，遇到赋值语句Lua会先计算右边所有的值然后再执行赋值操作
print("a =", a, "b =", b)

-- 4. 字符串
print("\n===== 4. 字符串 =====")
local s1 = "双引号字符串"
local s2 = '单引号字符串'
local s3 = [[长括号字符串
可以跨行书写]]
print(s1, s2)
print(s3)

-- 字符串拼接用 ..（不是 +）
print("拼接：" .. s1 .. " 和 " .. s2)

-- string.format 格式化输出（类似 C 的 printf）
print(string.format("姓名：%s，年龄：%d，身高：%.2f", "小明", 18, 1.755))

-- 取字符串长度：# 操作符
print("#\"hello\" =", #"hello")

-- 5. 数字运算
print("\n===== 5. 数字运算 =====")
print("7 / 2  =", 7 / 2)  -- 3.5（除法结果永远是浮点）
print("7 // 2 =", 7 // 2) -- 3（整除，Lua 5.3+）
print("7 % 2  =", 7 % 2)  -- 1（取余）
print("2 ^ 10 =", 2 ^ 10) -- 1024（幂运算）

-- 6. 整数与浮点（Lua 5.3+ 区分）
print("\n===== 6. 整数与浮点 =====")
print(math.type(3))   -- integer
print(math.type(3.0)) -- float
print(1 == 1.0)       -- true（值相等）

-- 7. 类型转换
print("\n===== 7. 类型转换 =====")
print(tonumber("123") + 1)  -- 124（字符串转数字）
print(tonumber("abc"))      -- nil（转换失败返回 nil）
print(tostring(123) .. "!") -- 123!（数字转字符串）
print("10" + 5)             -- 15（数字字符串自动转型）

-- 8. 布尔与逻辑（重点：Lua 中只有 false 和 nil 为假，0 和空字符串为真！）
print("\n===== 8. 布尔与逻辑 =====")
if 0 then print("0 在 Lua 中是真") end
if "" then print("空字符串在 Lua 中是真") end

-- and / or 返回操作数本身，常用于默认值写法
local input = nil
local value = input or "默认值" -- 类似 JS 的 input || "默认值"
print("value =", value)

local x = 10 and 20 -- and：两者都真返回后者
print("x =", x)     -- 20
