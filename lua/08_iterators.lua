--[[
    08 - 迭代器与泛型 for
    泛型 for 的本质：反复调用迭代函数，直到返回 nil。
    运行方式：lua 08_iterators.lua
]]

-- 1. 泛型 for 的原理
print("===== 1. 原理拆解 =====")
-- for x in iter do end  等价于反复调用 iter()，直到第一个返回值为 nil

-- 2. 手写一个无状态迭代器
print("\n===== 2. 手写迭代器 =====")
local function range(n)
    local i = 0
    return function()                 -- 闭包记住 i
        i = i + 1
        if i <= n then
            return i
        end                           -- 返回 nil 时 for 自动结束
    end
end

for v in range(3) do
    print("range:", v)
end

-- 3. 手写 pairs（带状态的迭代器协议）
print("\n===== 3. 手写 pairs =====")
-- 迭代协议：for 需要 (迭代函数, 状态, 初始控制值)
local function myPairs(t)
    return next, t, nil               -- next 是内置函数：取表的下一个键值
end

local user = {name = "小明", age = 18}
for k, v in myPairs(user) do
    print(k, v)
end

-- 4. 手写 ipairs
print("\n===== 4. 手写 ipairs =====")
local function myIpairs(t)
    local function iter(tbl, i)
        i = i + 1
        local v = tbl[i]
        if v ~= nil then
            return i, v
        end
    end
    return iter, t, 0
end

for i, v in myIpairs({"a", "b", "c"}) do
    print(i, v)
end

-- 5. 实战：遍历目录文件（io.popen 列举）
print("\n===== 5. 遍历文件 =====")
local function listFiles(dir)
    local handle = io.popen('ls "' .. dir .. '"')
    if not handle then return function() return nil end end
    local output = handle:read("a")
    handle:close()
    local files = {}
    for name in output:gmatch("[^\n]+") do
        table.insert(files, name)
    end
    local i = 0
    return function()
        i = i + 1
        return files[i]
    end
end

-- 6. 实战：链式处理（用迭代器组合 filter/map）
print("\n===== 6. 链式处理 =====")
local function collect(iter)
    local result = {}
    for v in iter do
        table.insert(result, v)
    end
    return result
end

local function filter(iter, pred)
    return function()
        while true do
            local v = iter()
            if v == nil then return nil end
            if pred(v) then return v end
        end
    end
end

local function mapIter(iter, fn)
    return function()
        local v = iter()
        if v == nil then return nil end
        return fn(v)
    end
end

-- 从 1..10 中筛选偶数并平方
local evens = collect(mapIter(
    filter(range(10), function(x) return x % 2 == 0 end),
    function(x) return x * x end
))
print(table.concat(evens, ", "))      -- 4, 16, 36, 64, 100

-- 7. 迭代字符串的字符（按字节）
print("\n===== 7. 字符迭代 =====")
for byte in ("abc"):gmatch(".") do
    io.write(byte, " ")
end
print()

-- 8. 迭代器惰性求值：无限序列
print("\n===== 8. 惰性无限序列 =====")
local function naturals()             -- 无限自然数序列
    local n = 0
    return function()
        n = n + 1
        return n
    end
end

local gen = naturals()
for _ = 1, 5 do
    io.write(gen(), " ")              -- 1 2 3 4 5（按需取值）
end
print()
