--[[
    04 - 表（table）：Lua 唯一的数据结构
    表同时充当数组、字典、对象、模块。掌握表就掌握了 Lua。
    运行方式：lua lua/04_tables.lua
]]

-- 1. 表作为数组（下标从 1 开始，不是 0！）
print("===== 1. 数组用法 =====")
local arr = {"a", "b", "c"}       -- 等价于 {[1]="a", [2]="b", [3]="c"}
print(arr[1], arr[2], arr[3])     -- a b c
print("长度：", #arr)             -- 3

-- 2. 表作为字典
print("\n===== 2. 字典用法 =====")
local user = {
    name = "小明",                -- 字符串键可省略引号
    ["age"] = 18,                 -- 等价写法
    [100] = "数字键"
}
print(user.name, user["name"])    -- 点语法与方括号等价
print(user.age, user[100])

-- 动态增删
user.city = "北京"
user.age = nil                    -- 赋值 nil 即删除键
print(user.city, user.age)

-- 3. 混合表（数组 + 字典）
print("\n===== 3. 混合表 =====")
local mixed = {"苹果", "香蕉", category = "水果", count = 2}
print(#mixed)                     -- 2（# 只数数组部分）
print(mixed.category, mixed.count)

-- 4. 表的遍历方式
print("\n===== 4. 遍历 =====")
local t = {10, 20, 30, key = "value"}
for i, v in ipairs(t) do          -- ipairs：只遍历数组部分，遇 nil 停止
    print("ipairs:", i, v)
end
for k, v in pairs(t) do           -- pairs：遍历所有键值对，顺序不定
    print("pairs:", k, v)
end

-- 5. table 库常用函数
print("\n===== 5. table 库 =====")
local nums = {3, 1, 4, 1, 5, 9, 2, 6}
table.sort(nums)                              -- 原地排序
print(table.concat(nums, "-"))                -- 拼接成字符串
table.insert(nums, 7)                         -- 末尾追加
table.insert(nums, 1, 0)                      -- 指定位置插入
print(table.concat(nums, ","))
print("移除末尾：", table.remove(nums))       -- 弹出并返回
print("移除首位：", table.remove(nums, 1))
print(table.concat(nums, ","))

-- 自定义排序（比较函数返回 true 表示 a 排前面）
table.sort(nums, function(a, b) return a > b end)
print("降序：", table.concat(nums, ","))

-- 6. 表的引用特性（重要！）
print("\n===== 6. 引用语义 =====")
local a = {1, 2, 3}
local b = a                       -- 不是拷贝，b 和 a 指向同一张表
b[1] = 100
print("a[1] =", a[1])             -- 100（a 也被改了）

-- 浅拷贝
local function shallowCopy(src)
    local dst = {}
    for k, v in pairs(src) do dst[k] = v end
    return dst
end
local c = shallowCopy(a)
c[1] = 999
print("a[1] =", a[1], "c[1] =", c[1])  -- 100 999

-- 7. 深拷贝（递归处理嵌套表）
print("\n===== 7. 深拷贝 =====")
local function deepCopy(src, seen)
    if type(src) ~= "table" then return src end
    seen = seen or {}
    if seen[src] then return seen[src] end   -- 处理循环引用
    local dst = {}
    seen[src] = dst
    for k, v in pairs(src) do
        dst[deepCopy(k, seen)] = deepCopy(v, seen)
    end
    return dst
end
local nested = {list = {1, 2}, info = {name = "测试"}}
local copied = deepCopy(nested)
copied.list[1] = 999
print(nested.list[1], copied.list[1])        -- 1 999（互不影响）

-- 8. 表构造器的语法细节
print("\n===== 8. 构造细节 =====")
local tricky = {1, 2, 3, nil, 5}
print("含 nil 的长度：", #tricky)            -- 长度不确定！数组中不要放 nil

-- 函数调用时的语法糖：单参数是表或字符串可省略括号
local function show(t) print("name =", t.name) end
show {name = "省略括号调用"}
