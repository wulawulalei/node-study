---@meta

--- Redis Lua 脚本环境全局变量声明
--- 用于 Lua Language Server 类型提示和诊断

---@type string[]
---@global
KEYS = {}

---@type string[]
---@global
ARGV = {}

---@class RedisClient
---@field call fun(cmd: string, ...): any
---@field pcall fun(cmd: string, ...): any
---@field log fun(level: number, msg: string): nil
---@field status_reply fun(msg: string): table
---@field error_reply fun(msg: string): table
---@field sha1hex fun(str: string): string
---@field debug fun(...): nil
---@field time fun(): table
---@field replicate_commands fun(): nil
---@field set_repl fun(mode: number): nil
---@field break_on_debug fun(): nil
---@field redis_version fun(): string
---@field version fun(): table
redis = {}

--- Redis 日志级别常量
redis.LOG_DEBUG = 0
redis.LOG_VERBOSE = 1
redis.LOG_NOTICE = 2
redis.LOG_WARNING = 3
redis.LOG_ERR = 4

---@class cjson
---@field encode fun(value: any): string
---@field decode fun(str: string): any
---@field encode_keep_buffer fun(keep: boolean): nil
---@field decode_invalid_numbers fun(setting: boolean): nil
---@field encode_invalid_numbers fun(setting: boolean): nil
---@field encode_number_precision fun(precision: number): nil
---@field new fun(): cjson
cjson = {}

---@class cmsgpack
---@field pack fun(value: any): string
---@field unpack fun(str: string): any
cmsgpack = {}

---@class struct
---@field pack fun(fmt: string, ...): string
---@field unpack fun(fmt: string, str: string, pos?: number): any
---@field size fun(fmt: string): number
struct = {}

---@class bit
---@field band fun(a: number, b: number): number
---@field bor fun(a: number, b: number): number
---@field bxor fun(a: number, b: number): number
---@field bnot fun(a: number): number
---@field lshift fun(a: number, n: number): number
---@field rshift fun(a: number, n: number): number
---@field arshift fun(a: number, n: number): number
---@field rol fun(a: number, n: number): number
---@field ror fun(a: number, n: number): number
---@field bswap fun(a: number): number
---@field tobit fun(a: number): number
---@field tohex fun(a: number, n?: number): string
bit = {}

---@type fun(chunk: string, chunkname?: string): function|nil, string|nil
loadstring = loadstring or load

---@type fun(name: string): any
require = require or function(name) return nil end

---@type table
_G = _G or {}

---@type table
arg = arg or {}