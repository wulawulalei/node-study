--[[
    02 - 流程控制
    Lua 的条件与循环语法：if / while / repeat / 数值 for / 泛型 for
    运行方式：lua lua/02_control_flow.lua
]]

-- 1. if 语句：then 必须有，end 必须有，没有大括号
print("===== 1. if 语句 =====")
local score = 85
if score >= 90 then
    print("优秀")
elseif score >= 60 then          -- 注意是 elseif（一个单词）
    print("及格")
else
    print("不及格")
end

-- 2. Lua 没有 switch，用 if-elseif 链或表查法替代
print("\n===== 2. 表查法替代 switch =====")
local actions = {
    start = function() return "启动" end,
    stop  = function() return "停止" end,
    pause = function() return "暂停" end,
}
local cmd = "start"
local action = actions[cmd]
print(action and action() or "未知命令")

-- 3. while 循环
print("\n===== 3. while 循环 =====")
local i = 1
while i <= 3 do
    print("while 第 " .. i .. " 次")
    i = i + 1                     -- 注意：Lua 没有 i++ 或 i+=1
end

-- 4. repeat-until：先执行后判断（类似 do-while），条件为真时退出
print("\n===== 4. repeat-until =====")
local n = 0
repeat
    n = n + 1
    print("repeat n =", n)
until n >= 3                      -- 与 while 相反：条件成立就结束

-- 5. 数值 for：for 变量 = 起始, 结束, 步长（步长可省略，默认 1；范围包含两端！）
print("\n===== 5. 数值 for =====")
for j = 1, 5 do
    io.write(j, " ")
end
print()

for j = 10, 1, -3 do              -- 倒序 + 步长
    io.write(j, " ")
end
print()

-- 6. 泛型 for + 迭代器
print("\n===== 6. 泛型 for =====")
local fruits = {"苹果", "香蕉", "橙子"}
for index, value in ipairs(fruits) do
    print(index, value)
end

local user = {name = "张三", age = 20, city = "北京"}
for key, value in pairs(user) do  -- pairs 遍历键值对（顺序不定）
    print(key, "=", value)
end

-- 7. break 与 goto
print("\n===== 7. break 与 goto =====")
for j = 1, 100 do
    if j > 3 then break end       -- break 跳出循环（Lua 没有 continue）
    print("break 示例 j =", j)
end

-- goto 可模拟 continue（Lua 5.2+）
for j = 1, 5 do
    if j % 2 == 0 then goto continue end
    print("奇数 j =", j)
    ::continue::                  -- 标签语法
end

-- 8. 三元表达式的替代写法
print("\n===== 8. 模拟三元 =====")
local age = 20
local desc = (age >= 18) and "成年人" or "未成年"
print(desc)
