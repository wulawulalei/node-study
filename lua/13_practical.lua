--[[
    13 - 综合实战：用 Lua 写一个 Redis 风格的限流器
    知识点覆盖：表、元表、OOP、模块、协程、错误处理
    运行方式：lua 13_practical.lua
]]

-- ========== 1. 令牌桶限流器（OOP 实现） ==========
print("===== 1. 令牌桶限流器 =====")
local TokenBucket = {}
TokenBucket.__index = TokenBucket

function TokenBucket.new(capacity, rate)
    -- capacity: 桶容量  rate: 每秒补充令牌数
    local self = setmetatable({}, TokenBucket)
    self.capacity = capacity
    self.rate = rate
    self.tokens = capacity          -- 初始满桶
    self.lastTime = os.clock()
    return self
end

function TokenBucket:refill()
    local now = os.clock()
    local elapsed = now - self.lastTime
    self.tokens = math.min(self.capacity, self.tokens + elapsed * self.rate)
    self.lastTime = now
end

function TokenBucket:tryAcquire(n)
    n = n or 1
    self:refill()
    if self.tokens >= n then
        self.tokens = self.tokens - n
        return true
    end
    return false
end

-- 模拟：容量 5，每秒补 2 个，连续请求 8 次
local bucket = TokenBucket.new(5, 2)
for i = 1, 8 do
    local ok = bucket:tryAcquire()
    print(string.format("请求 %d: %s (剩余 %.1f)", i, ok and "通过" or "拒绝", bucket.tokens))
end

-- ========== 2. 简易日志器（模块风格 + 级别控制） ==========
print("\n===== 2. 简易日志器 =====")
local Logger = {}
Logger.__index = Logger

Logger.LEVELS = {DEBUG = 1, INFO = 2, WARN = 3, ERROR = 4}

function Logger.new(level)
    local self = setmetatable({}, Logger)
    self.level = Logger.LEVELS[level] or Logger.LEVELS.INFO
    return self
end

function Logger:log(level, msg)
    local lv = Logger.LEVELS[level]
    if lv and lv >= self.level then
        print(string.format("[%s] %s | %s", level, os.date("%H:%M:%S"), msg))
    end
end

-- 动态生成 DEBUG/INFO/... 方法
for name in pairs(Logger.LEVELS) do
    Logger[name:lower()] = function(self, msg)
        self:log(name, msg)
    end
end

local log = Logger.new("INFO")
log:debug("这条不会显示")           -- 低于 INFO 被过滤
log:info("服务启动")
log:warn("内存使用偏高")
log:error("连接失败")

-- ========== 3. 协程式任务调度器 ==========
print("\n===== 3. 协程任务调度器 =====")
local Scheduler = {}
Scheduler.__index = Scheduler

function Scheduler.new()
    local self = setmetatable({}, Scheduler)
    self.tasks = {}
    return self
end

function Scheduler:addTask(name, fn)
    table.insert(self.tasks, {
        name = name,
        co = coroutine.create(fn),
    })
end

function Scheduler:run()
    local pending = #self.tasks
    while pending > 0 do
        pending = 0
        for _, task in ipairs(self.tasks) do
            if coroutine.status(task.co) ~= "dead" then
                pending = pending + 1
                local ok, err = coroutine.resume(task.co)
                if not ok then
                    print("任务 " .. task.name .. " 出错:", err)
                end
            end
        end
    end
    print("所有任务执行完毕")
end

local sched = Scheduler.new()
sched:addTask("任务A", function()
    for i = 1, 3 do
        print("  [A] 步骤", i)
        coroutine.yield()
    end
end)
sched:addTask("任务B", function()
    for i = 1, 2 do
        print("  [B] 步骤", i)
        coroutine.yield()
    end
end)
sched:run()

-- ========== 4. 链式查询构造器（流畅接口） ==========
print("\n===== 4. 链式查询构造器 =====")
local Query = {}
Query.__index = Query

function Query.new(tbl)
    return setmetatable({_data = tbl, _filters = {}}, Query)
end

function Query:where(pred)
    table.insert(self._filters, pred)
    return self                              -- 返回 self 实现链式调用
end

function Query:select(fields)
    self._fields = fields
    return self
end

function Query:exec()
    local result = {}
    for _, row in ipairs(self._data) do
        local pass = true
        for _, pred in ipairs(self._filters) do
            if not pred(row) then pass = false; break end
        end
        if pass then
            if self._fields then
                local picked = {}
                for _, f in ipairs(self._fields) do
                    picked[f] = row[f]
                end
                table.insert(result, picked)
            else
                table.insert(result, row)
            end
        end
    end
    return result
end

local users = {
    {name = "小明", age = 18, city = "北京"},
    {name = "小红", age = 25, city = "上海"},
    {name = "小刚", age = 30, city = "北京"},
    {name = "小丽", age = 16, city = "广州"},
}

local adults = Query.new(users)
    :where(function(u) return u.age >= 18 end)
    :where(function(u) return u.city == "北京" end)
    :select({"name", "age"})
    :exec()

for _, u in ipairs(adults) do
    print("符合条件:", u.name, u.age)
end

print("\n===== 实战 demo 完成 =====")
