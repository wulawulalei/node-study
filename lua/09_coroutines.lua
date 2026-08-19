--[[
    09 - 协程（coroutine）
    协程是协作式多任务：主动 yield 让出，resume 恢复。
    常用于生成器、生产者-消费者、异步流程。
    运行方式：lua lua/09_coroutines.lua
]]

-- 1. 协程基础：create / resume / yield
print("===== 1. 基础用法 =====")
local co = coroutine.create(function(a, b)
    print("协程开始:", a, b)
    local c = coroutine.yield(a + b)  -- 让出，把 a+b 传给 resume 方
    print("恢复执行，收到:", c)
    local d = coroutine.yield(c * 2)
    print("再次恢复，收到:", d)
    return "协程结束"
end)

print("状态:", coroutine.status(co))  -- suspended（尚未运行）
print(coroutine.resume(co, 2, 3))     -- true 3（resume 参数是协程入参）
print("状态:", coroutine.status(co))  -- suspended（yield 后挂起）
print(coroutine.resume(co, 10))       -- true 20（resume 的返回值传给 yield）
print(coroutine.resume(co, 99))       -- true 协程结束
print("状态:", coroutine.status(co))  -- dead

-- 2. 用协程实现生成器
print("\n===== 2. 生成器 =====")
local function fibonacci()
    return coroutine.wrap(function()  -- wrap：把协程包装成函数直接调用
        local a, b = 0, 1
        while true do
            coroutine.yield(a)
            a, b = b, a + b
        end
    end)
end

local fib = fibonacci()
for _ = 1, 10 do
    io.write(fib(), " ")              -- 0 1 1 2 3 5 8 13 21 34
end
print()

-- 3. 生产者-消费者模型
print("\n===== 3. 生产者-消费者 =====")
local function producer()
    return coroutine.create(function()
        for i = 1, 3 do
            local item = "商品" .. i
            print("[生产]", item)
            coroutine.yield(item)     -- 产出并挂起
        end
    end)
end

local function consumer(prod)
    while true do
        local ok, item = coroutine.resume(prod)
        if not item then break end    -- 生产完毕
        print("[消费]", item)
    end
end

consumer(producer())

-- 4. 协程间传值：双向通信
print("\n===== 4. 双向通信 =====")
local echo = coroutine.create(function()
    while true do
        local msg = coroutine.yield()
        print("协程收到:", msg)
    end
end)
coroutine.resume(echo)                -- 先启动，跑到第一个 yield
coroutine.resume(echo, "你好")
coroutine.resume(echo, "世界")

-- 5. 实战：协程式迭代器（排列生成）
print("\n===== 5. 排列生成器 =====")
local function permgen(a)
    return coroutine.wrap(function()
        local function perm(n)
            if n == 0 then
                coroutine.yield(a)    -- 产出一种排列
            else
                for i = 1, n do
                    a[n], a[i] = a[i], a[n]
                    perm(n - 1)
                    a[n], a[i] = a[i], a[n]
                end
            end
        end
        perm(#a)
    end)
end

local count = 0
for p in permgen({1, 2, 3}) do
    count = count + 1
    print("排列" .. count .. ":", table.concat(p, ""))
end

-- 6. 错误处理：协程内的错误不会直接崩溃
print("\n===== 6. 协程错误 =====")
local bad = coroutine.create(function()
    error("协程内出错")
end)
local ok, err = coroutine.resume(bad)
print(ok, err)                        -- false ... 协程内出错

-- 7. 对称协程传递控制权（coroutine.transfer 是 5.4 新增）
print("\n===== 7. 状态一览 =====")
print("suspended: 挂起（可恢复）")
print("running:   正在运行")
print("normal:    恢复了别的协程，等待其让出")
print("dead:      执行完毕或出错")
