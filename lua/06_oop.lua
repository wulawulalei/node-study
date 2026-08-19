--[[
    06 - 面向对象编程（OOP）
    Lua 没有 class 关键字，用 表 + 元表 模拟类、继承与多态。
    运行方式：lua 06_oop.lua
]]

-- 1. 冒号语法糖：自动传入 self
print("===== 1. 冒号语法 =====")
local obj = {name = "对象"}
function obj.sayDot(self)         -- 点号定义：需显式写 self
    print("点号调用:", self.name)
end
function obj:sayColon()           -- 冒号定义：隐含 self 参数
    print("冒号调用:", self.name)
end
obj.sayDot(obj)                   -- 点号调用要手动传对象
obj:sayColon()                    -- 冒号调用自动传入，等价 obj.sayColon(obj)

-- 2. 定义一个类（经典模板）
print("\n===== 2. 类的定义 =====")
local Animal = {}
Animal.__index = Animal           -- 关键：实例找不到的方法去类表查

function Animal.new(name, sound)  -- 构造函数（约定叫 new）
    local self = setmetatable({}, Animal)
    self.name = name
    self.sound = sound
    return self
end

function Animal:speak()
    print(self.name .. " 发出 " .. self.sound .. " 的声音")
end

function Animal:getType()
    return "动物"
end

local cat = Animal.new("小猫", "喵喵")
cat:speak()
print("类型:", cat:getType())

-- 3. 继承：子类的 __index 链指向父类
print("\n===== 3. 继承 =====")
local Dog = setmetatable({}, {__index = Animal})  -- Dog 继承 Animal
Dog.__index = Dog

function Dog.new(name)
    local self = Animal.new(name, "汪汪")         -- 调父类构造
    return setmetatable(self, Dog)
end

function Dog:getType()            -- 方法覆盖（多态）
    return "狗"
end

function Dog:fetch()              -- 子类独有方法
    print(self.name .. " 叼回了飞盘")
end

local dog = Dog.new("旺财")
dog:speak()                       -- 继承自 Animal
dog:fetch()                       -- 子类自有
print("类型:", dog:getType())     -- 覆盖后输出“狗”

-- 4. 判断实例与类的关系
print("\n===== 4. 类型判断 =====")
local function isInstance(obj, class)
    local mt = getmetatable(obj)
    while mt do
        if mt == class then return true end
        mt = getmetatable(mt) and getmetatable(mt).__index
    end
    return false
end
print("dog 是 Dog?", isInstance(dog, Dog))        -- true
print("dog 是 Animal?", isInstance(dog, Animal))  -- true
print("cat 是 Dog?", isInstance(cat, Dog))        -- false

-- 5. 私有性的模拟（闭包实现真私有）
print("\n===== 5. 闭包私有 =====")
local function newBankAccount(balance)
    local private = {balance = balance or 0}      -- 外部无法访问
    return {
        deposit = function(n)
            private.balance = private.balance + n
            return private.balance
        end,
        getBalance = function()
            return private.balance
        end,
    }
end
local account = newBankAccount(100)
account.deposit(50)
print("余额:", account.getBalance())              -- 150
print("直接访问私有:", account.balance)           -- nil（访问不到）

-- 6. 只读属性（__newindex 拦截）
print("\n===== 6. 只读属性 =====")
local function readonly(t)
    return setmetatable({}, {
        __index = t,
        __newindex = function()
            error("该表是只读的！", 2)
        end
    })
end
local config = readonly({version = "1.0"})
print(config.version)             -- 1.0
local ok, err = pcall(function() config.version = "2.0" end)
print(ok, err)                    -- false 该表是只读的！

-- 7. 多重继承（用 __index 函数依次查找多个父类）
print("\n===== 7. 多重继承 =====")
local Flyable = {fly = function() return "会飞" end}
local Swimmable = {swim = function() return "会游" end}
local Duck = setmetatable({}, {
    __index = function(t, key)
        return Flyable[key] or Swimmable[key]
    end
})
print(Duck.fly(), Duck.swim())    -- 会飞 会游
