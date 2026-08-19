--[[
    03 - 函数
    Lua 函数是一等公民：可赋值、可传参、可返回。
    支持多返回值、可变参数、闭包。
    运行方式：lua lua/03_functions.lua
]]

-- 1. 函数定义与调用的三种写法
print("===== 1. 定义方式 =====")
local function add1(a, b)         -- 局部函数（推荐）
    return a + b
end

local add2 = function(a, b)       -- 匿名函数赋给变量（与上面等价）
    return a + b
end

function GlobalAdd(a, b)          -- 全局函数（省略 local，不推荐）
    return a + b
end

print(add1(1, 2), add2(3, 4), GlobalAdd(5, 6))

-- 2. 多返回值（Lua 特色）
print("\n===== 2. 多返回值 =====")
local function divmod(a, b)
    return a // b, a % b          -- 同时返回商和余数
end
local q, r = divmod(10, 3)
print("商 =", q, "余数 =", r)

-- 用 select 处理多返回值
local function multi() return 1, 2, 3 end
print(select("#", multi()))       -- 3（返回值个数）
print(select(2, multi()))         -- 2 3（从第 2 个开始）

-- 3. 参数个数不匹配时的规则
print("\n===== 3. 参数匹配 =====")
local function f(a, b)
    print("a =", a, "b =", b)
end
f(1)                              -- 缺少的补 nil
f(1, 2, 3)                        -- 多余的被丢弃

-- 4. 可变参数 ...
print("\n===== 4. 可变参数 =====")
local function sum(...)
    local total = 0
    for _, v in ipairs({...}) do  -- {...} 把变长参数打包成表
        total = total + v
    end
    return total
end
print("sum(1,2,3,4,5) =", sum(1, 2, 3, 4, 5))

-- Lua 5.4 可用 table.pack 保留 nil
local function countArgs(...)
    local args = table.pack(...)
    return args.n                 -- n 是参数个数
end
print("参数个数：", countArgs(1, nil, 3))

-- 5. 闭包：函数捕获定义时的局部变量
print("\n===== 5. 闭包 =====")
local function newCounter()
    local count = 0               -- 被闭包捕获的“上值”（upvalue）
    return function()
        count = count + 1
        return count
    end
end

local c1 = newCounter()
local c2 = newCounter()
print(c1(), c1(), c1())           -- 1 2 3（独立计数）
print(c2())                       -- 1（互不影响）

-- 6. 递归函数（注意：局部递归函数需要先声明）
print("\n===== 6. 递归 =====")
local fact                        -- 先声明变量
fact = function(n)
    if n <= 1 then return 1 end
    return n * fact(n - 1)        -- 这样才能引用到自身
end
print("5! =", fact(5))

-- 7. 尾调用优化：递归不爆栈
print("\n===== 7. 尾调用 =====")
local function loop(n, acc)
    if n == 0 then return acc end
    return loop(n - 1, acc + n)   -- return 函数调用 = 尾调用，复用栈帧
end
print("1..1000000 求和 =", loop(1000000, 0))  -- 不会栈溢出

-- 8. 函数作为参数（回调）
print("\n===== 8. 回调 =====")
local function map(list, fn)
    local result = {}
    for i, v in ipairs(list) do
        result[i] = fn(v)
    end
    return result
end
local doubled = map({1, 2, 3}, function(x) return x * 2 end)
print(table.concat(doubled, ", "))
