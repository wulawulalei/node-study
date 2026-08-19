--[[
    07 - 字符串与模式匹配
    Lua 的 string 库 + 自有模式语法（注意：不是完整正则！）
    运行方式：lua lua/07_strings.lua
]]

-- 1. string 库常用函数
print("===== 1. 常用函数 =====")
local s = "Hello Lua World"
print(s:upper(), s:lower())             -- 大小写（冒号调用）
print(string.len(s), #s)                -- 长度
print(s:sub(1, 5))                      -- Hello（截取，下标从1开始，含两端）
print(s:sub(-5))                        -- World（负数从尾部数）
print(s:rep(2))                         -- 重复拼接
print(s:reverse())                      -- 反转
print(s:byte(1), string.char(72))       -- 72 H（字符与编码互转）

-- 2. 查找与切分
print("\n===== 2. 查找 =====")
print(s:find("Lua"))                    -- 7 9（起止下标，找不到返回 nil）
print(s:find("o", 10))                  -- 从第 10 个字符开始找

-- 按分隔符切分（Lua 没有内置 split，自己实现）
local function split(str, sep)
    local result = {}
    for part in string.gmatch(str, "([^" .. sep .. "]+)") do
        table.insert(result, part)
    end
    return result
end
local words = split("a,b,c,d", ",")
print(table.concat(words, " | "))       -- a | b | c | d

-- 3. 模式匹配：Lua 自有语法，比正则精简
print("\n===== 3. 模式语法 =====")
print([[
字符类：
  %a 字母    %d 数字    %s 空白    %w 字母数字    %l 小写    %u 大写
  %p 标点    %x 十六进制   . 任意字符   %% 转义百分号本身
量词：
  + 1次或多次   * 0次或多次   - 0次或多次(非贪婪)   ? 0或1次
位置：
  ^ 开头(在模式开头时)   $ 结尾   %b 平衡匹配   () 捕获组
]])

-- 4. string.match：提取捕获组
print("\n===== 4. match 提取 =====")
local date = "今天是2026-08-19"
local year, month, day = date:match("(%d+)-(%d+)-(%d+)")
print(year, month, day)                 -- 2026 08 19

local email = "user@example.com"
local name, domain = email:match("([^@]+)@(.+)")
print(name, domain)

-- 5. string.gsub：替换（返回 新字符串 + 替换次数）
print("\n===== 5. gsub 替换 =====")
local text = "hello world hello lua"
local replaced, count = text:gsub("hello", "hi")
print(replaced, "替换", count, "次")    -- hi world hi lua 替换 2 次

-- 替换函数：每个匹配交给函数处理
local upper = text:gsub("%a+", function(word)
    return word:upper()
end)
print(upper)

-- 用表映射替换
local dict = {hello = "你好", world = "世界"}
print((text:gsub("%a+", dict)))         -- 你好 世界 你好 lua

-- 6. string.gmatch：迭代所有匹配
print("\n===== 6. gmatch 迭代 =====")
for num in string.gmatch("价格: 12, 35, 7, 99", "%d+") do
    io.write(num, " ")
end
print()

-- 7. 实战：trim 去首尾空格
print("\n===== 7. 实战 trim =====")
local function trim(str)
    return (str:match("^%s*(.-)%s*$"))
end
print("[" .. trim("  前后有空格  ") .. "]")

-- 8. 实战：解析键值对（类似解析 query string）
print("\n===== 8. 解析键值对 =====")
local function parseQuery(qs)
    local result = {}
    for k, v in qs:gmatch("([^&=]+)=([^&=]+)") do
        result[k] = v
    end
    return result
end
local params = parseQuery("name=lua&version=5.4&lang=zh")
for k, v in pairs(params) do
    print(k, "=", v)
end

-- 9. %b 平衡匹配（匹配成对括号）
print("\n===== 9. 平衡匹配 =====")
local code = "print(add(1, 2))"
print(code:match("%b()"))               -- (add(1, 2)
