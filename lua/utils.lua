--[[
    utils - 演示模块（被 10_modules.lua require）
    标准模块写法：局部定义 + 返回导出表
]]

-- 私有部分：不导出，外部访问不到
local function privateFunc()
    return "我是私有函数"
end

local M = {}                          -- 模块表

M.VERSION = "1.0.0"

function M.add(a, b)
    return a + b
end

function M.sayHello(name)
    return "你好, " .. name .. "! (来自 utils v" .. M.VERSION .. ")"
end

return M                              -- 关键：return 导出表
