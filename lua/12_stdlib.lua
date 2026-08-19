--[[
    12 - 常用标准库速览
    string / table / math / os / io 五大库的高频 API
    运行方式：lua lua/12_stdlib.lua
]]

print("===== 1. math 库 =====")
print("math.pi =", math.pi)
print("math.floor(3.7) =", math.floor(3.7))     -- 3（向下取整）
print("math.ceil(3.2) =", math.ceil(3.2))       -- 4（向上取整）
print("math.abs(-5) =", math.abs(-5))           -- 5
print("math.max(1,9,3) =", math.max(1, 9, 3))   -- 9
print("math.min(1,9,3) =", math.min(1, 9, 3))   -- 1
print("math.sqrt(16) =", math.sqrt(16))         -- 4.0
print("math.fmod(7,3) =", math.fmod(7, 3))      -- 1.0（浮点取余）

-- 随机数（5.4 自动播种，无需 randomseed）
print("math.random() =", math.random())                 -- [0,1) 浮点
print("math.random(6) =", math.random(6))               -- 1~6 整数
print("math.random(10,20) =", math.random(10, 20))      -- 10~20 整数

print("\n===== 2. os 库 =====")
print("os.time() =", os.time())                          -- 当前时间戳(秒)
print("os.date() =", os.date())                          -- 格式化当前时间
print("os.date('%Y-%m-%d %H:%M:%S') =", os.date("%Y-%m-%d %H:%M:%S"))
print("os.clock() =", os.clock())                        -- CPU 时间(秒)

-- os.date 反向：从时间戳格式化
print("指定时间戳:", os.date("%Y/%m/%d", 1000000000))

-- os.time 反向：从日期表生成时间戳
local ts = os.time({year = 2026, month = 8, day = 19, hour = 12})
print("2026-08-19 12:00 时间戳:", ts)

-- 计算时间差
local t1 = os.clock()
local sum = 0
for i = 1, 1000000 do sum = sum + i end
print("求和耗时(秒):", os.clock() - t1)

print("os.getenv('HOME') =", os.getenv("HOME"))

print("\n===== 3. io 库 =====")
-- 写文件
local f = assert(io.open("/tmp/lua_demo.txt", "w"))
f:write("第一行\n第二行\n")
f:close()

-- 读文件
local rf = assert(io.open("/tmp/lua_demo.txt", "r"))
print("read('a') 全读:", rf:read("a"))
rf:close()

-- 按行读
local lf = assert(io.open("/tmp/lua_demo.txt", "r"))
for line in lf:lines() do
    print("逐行:", line)
end
lf:close()

print("\n===== 4. table 库补充 =====")
local t = {3, 1, 2}
print("unpack:", table.unpack(t))            -- 3 1 2（展开为多返回值）
local packed = table.pack("a", nil, "c")     -- 打包，n 记录个数
print("pack.n =", packed.n)                  -- 3
print("move:", (function()
    local a = {1, 2, 3, 4, 5}
    local b = table.move(a, 2, 4, 1, {})     -- 把 a[2..4] 移到新表
    return table.concat(b, ",")
end)())

print("\n===== 5. string 库补充 =====")
print(string.format("%5d|%-5d|%05d", 42, 42, 42))  -- 对齐与补零
print(("x"):rep(3, "-"))                       -- x-x-x（带分隔符重复）
print(("hello"):byte(1, -1))                   -- 104 101 108 108 111

print("\n===== 6. utf8 库（5.3+ 自带） =====")
local cn = "你好世界"
print("字节长度:", #cn)                        -- 12（每个汉字3字节）
print("字符长度:", utf8.len(cn))               -- 4
for pos, code in utf8.codes(cn) do
    io.write(pos, ":", utf8.char(code), " ")
end
print()

print("\n===== 7. 全局函数 =====")
print("tostring(nil) =", tostring(nil))
print("tonumber('0x1F') =", tonumber("0x1F"))  -- 31（支持十六进制）
print("tonumber('z', 36) =", tonumber("z", 36)) -- 35（任意进制）
print("rawequal({}, {}) =", rawequal({}, {}))  -- false（不同表）
print("next({}) =", next({}))                  -- nil（空表）
