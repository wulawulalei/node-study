--[[
    11 - 错误处理
    Lua 用 error 抛出，pcall / xpcall 捕获，没有 try-catch 语法。
    运行方式：lua 11_error_handling.lua
]]

-- 1. error 抛出错误
print("===== 1. error 抛出 =====")
-- error("简单错误信息")            -- 会终止程序，注释掉避免中断

-- error 第二个参数：错误定位层级
local function throwErr()
    error("出错了！", 2)              -- level=2：把错误位置指向调用者
end

-- 2. pcall：保护模式调用（类似 try-catch）
print("\n===== 2. pcall =====")
local ok, result = pcall(function()
    return 1 + 1
end)
print(ok, result)                     -- true 2

local ok2, err = pcall(function()
    error("自定义错误")
end)
print(ok2, err)                       -- false ... 自定义错误

-- 捕获 nil 除法之类运行时错误
local ok3, err3 = pcall(function()
    local x = nil
    return x.field                    -- 对 nil 索引会报错
end)
print(ok3, err3)

-- 3. error 可以抛出任意类型的值（不只是字符串）
print("\n===== 3. 抛出非字符串 =====")
local ok4, errObj = pcall(function()
    error({code = 404, msg = "资源不存在"})  -- 抛出表
end)
if not ok4 then
    print("错误码:", errObj.code, "信息:", errObj.msg)
end

-- 4. xpcall：带追踪的捕获（能拿到调用栈）
print("\n===== 4. xpcall =====")
local function handler(err)
    return debug.traceback("错误: " .. tostring(err), 2)
end
local ok5, trace = xpcall(function()
    local t = nil
    return t.x
end, handler)
print(ok5)
print(trace)                          -- 打印调用栈

-- 5. assert：断言（条件为假则抛错）
print("\n===== 5. assert =====")
local function divide(a, b)
    assert(type(a) == "number", "a 必须是数字")
    assert(b ~= 0, "除数不能为 0")
    return a / b
end

print(divide(10, 2))                  -- 5.0
local ok6, err6 = pcall(divide, 10, 0)
print(ok6, err6)                      -- false 除数不能为 0

-- assert 妙用：配合“值, 错误信息”多返回值的惯用法
local function mightFail(success)
    if success then
        return "成功值"
    else
        return nil, "失败原因"
    end
end
print(assert(mightFail(true)))        -- 成功值
local ok7, err7 = pcall(function()
    return assert(mightFail(false))   -- 失败时 assert 抛出第二个返回值
end)
print(ok7, err7)

-- 6. 惯用法：返回 nil + 错误信息（而不是抛错）
print("\n===== 6. nil+err 惯用法 =====")
local function readConfig(path)
    local f, err = io.open(path, "r")
    if not f then
        return nil, "打开文件失败: " .. err
    end
    local content = f:read("a")
    f:close()
    return content
end

local content, errMsg = readConfig("不存在的文件.txt")
if not content then
    print("读取失败:", errMsg)
end

-- 7. 自定义错误类型与包装
print("\n===== 7. 错误包装 =====")
local function safeCall(fn, ...)
    local results = table.pack(pcall(fn, ...))
    if not results[1] then
        return nil, results[2]
    end
    return table.unpack(results, 2, results.n)
end

local value, callErr = safeCall(function(a, b) return a + b end, 1, 2)
print("safeCall 结果:", value, callErr)  -- 3 nil

-- 8. 真实场景：JSON 风格的防御性解析
print("\n===== 8. 防御性解析 =====")
local function safeParseNumber(str)
    local n = tonumber(str)
    if n == nil then
        return nil, string.format("无法解析数字: %q", str)
    end
    return n
end

print(safeParseNumber("123"))         -- 123
print(safeParseNumber("abc"))         -- nil 无法解析数字: "abc"
