--[[
    10 - 模块与包（module & require）
    Lua 模块就是一个返回表的文件，require 负责加载和缓存。
    运行方式：lua 10_modules.lua（依赖同目录 utils.lua）
]]

-- 1. require 加载模块（自动去 package.path 指定的路径找文件）
print("===== 1. require 基础 =====")

-- 取脚本所在目录加入搜索路径，保证在任意目录下运行都能找到 utils.lua
local scriptDir = arg[0]:match("(.*/)") or "./"
package.path = package.path .. ";" .. scriptDir .. "?.lua"

local utils = require("utils")        -- 模块名对应同目录 utils.lua
print(utils.add(3, 4))
print(utils.sayHello("小明"))

-- 2. require 的缓存特性：同一模块只加载一次
print("\n===== 2. 缓存 =====")
local u1 = require("utils")
local u2 = require("utils")
print(u1 == u2)                       -- true（返回同一个表）

-- 3. package.loaded 查看已加载模块
print("\n===== 3. package.loaded =====")
print(package.loaded["utils"] == utils)  -- true

-- 强制重新加载：先清缓存再 require
package.loaded["utils"] = nil
local u3 = require("utils")
print(u3 == u1)                       -- false（是新加载的表）

-- 4. package.path / package.cpath
print("\n===== 4. 搜索路径 =====")
print("package.path =", package.path)

-- 5. 模块的三种写法（见 utils.lua 用的是返回表的标准写法）
print("\n===== 5. 模块写法对比 =====")
print([[
推荐：local M = {} ... return M
旧式：module("name", package.seeall)  -- 已废弃，别用
全局：直接定义全局函数               -- 污染全局，别用
]])

-- 6. 子模块与目录结构
-- 模块名 "a.b.c" 对应文件 a/b/c.lua，用点号组织层级
print("\n===== 6. 层级模块 =====")
print("模块名 utils.math 对应文件 utils/math.lua")

-- 7. 实用技巧：模块内保持私有
print("\n===== 7. 模块私有 =====")
-- utils.lua 里 local 的函数/变量不会暴露，只有放进返回表的才公开
print("私有函数无法访问:", utils.privateFunc)  -- nil
