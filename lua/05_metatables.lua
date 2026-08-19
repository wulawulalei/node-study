--[[
    05 - 元表与元方法（metatable & metamethod）
    元表是 Lua 实现运算符重载、面向对象、默认值机制的基础。
    运行方式：lua lua/05_metatables.lua
]]

-- 1. setmetatable / getmetatable 基础
print("===== 1. 元表基础 =====")
local t = {}
local mt = {}
setmetatable(t, mt)
print(getmetatable(t) == mt)      -- true

-- 2. __index：访问不存在的键时的兜底（最常用！）
print("\n===== 2. __index =====")
local defaults = {color = "红色", size = "中"}
local shirt = {size = "大"}

-- __index 是表：找不到就去该表查
setmetatable(shirt, {__index = defaults})
print(shirt.color, shirt.size)    -- 红色 大

-- __index 是函数：完全自定义查找逻辑
local logs = {}
local proxy = setmetatable({}, {
    __index = function(tbl, key)
        table.insert(logs, "读取了不存在的键: " .. key)
        return "默认值"
    end
})
print(proxy.foo)                  -- 默认值
print(logs[1])

-- 3. __newindex：给不存在的键赋值时触发
print("\n===== 3. __newindex =====")
local backup = {}
local guarded = setmetatable({}, {
    __newindex = function(tbl, key, value)
        print("拦截赋值:", key, "=", value)
        rawset(backup, key, value)  -- rawset 绕过元方法直接写入
    end,
    __index = backup
})
guarded.name = "张三"             -- 被拦截，实际写进 backup
print(guarded.name)               -- 张三（读时从 backup 取）

-- 4. 算术运算符重载（实现一个向量类）
print("\n===== 4. 运算符重载 =====")
local Vector = {}
Vector.__index = Vector

function Vector.new(x, y)
    return setmetatable({x = x, y = y}, Vector)
end

Vector.__add = function(a, b)     -- 重载 +
    return Vector.new(a.x + b.x, a.y + b.y)
end
Vector.__sub = function(a, b)     -- 重载 -
    return Vector.new(a.x - b.x, a.y - b.y)
end
Vector.__eq = function(a, b)      -- 重载 ==
    return a.x == b.x and a.y == b.y
end
Vector.__tostring = function(v)   -- 重载 tostring
    return string.format("Vector(%d, %d)", v.x, v.y)
end

local v1 = Vector.new(1, 2)
local v2 = Vector.new(3, 4)
print(tostring(v1 + v2))          -- Vector(4, 6)
print(v1 + v2 == Vector.new(4, 6))-- true

-- 5. __call：让表可以像函数一样调用
print("\n===== 5. __call =====")
local multiplier = setmetatable({factor = 10}, {
    __call = function(self, n)
        return n * self.factor
    end
})
print(multiplier(5))              -- 50（表被当成函数调用）

-- 6. __len 与 __concat
print("\n===== 6. __len / __concat =====")
local bag = setmetatable({items = {"a", "b", "c"}}, {
    __len = function(self) return #self.items end,
    __concat = function(a, b) return "拼接结果" end,
})
print(#bag)                       -- 3
print(bag .. "任意")              -- 拼接结果

-- 7. rawget / rawset / rawequal：绕过元方法
print("\n===== 7. raw 系列 =====")
local raw = setmetatable({}, {__index = function() return "元表兜底" end})
print(raw.missing)                -- 元表兜底
print(rawget(raw, "missing"))     -- nil（绕过 __index）

-- 8. 常用元方法速查
print("\n===== 8. 元方法速查 =====")
print([[
__index     读不存在的键      __newindex  写不存在的键
__add/+     __sub/-    __mul/*    __div//    __mod/%    __pow/^
__eq/==     __lt/<     __le/<=
__call()    __len/#    __concat/..   __tostring
__gc 垃圾回收  __close 4.0 资源关闭  __mode 弱引用表("k"/"v"/"kv")
]])
