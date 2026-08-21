import express from "express";
import Redis from "ioredis";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const lua = fs.readFileSync(path.resolve(__dirname, "index.lua"), "utf8");
const redis = new Redis();
const app = express();
//限流阀

const TIME = 30;
const CHANGE = 5;
const KEY = "lottery";

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  next();
});

app.get("/lottery", async (req, res) => {
  //lua 就是lua的脚本
  //1 代表有一个key
  //key就是接受的key
  //TIME 是 第一个参数
  //CHANGE 是 第二个参数
  try {
    const result = await redis.eval(lua, 1, KEY, CHANGE, TIME);
    if (result === 1) {
      res.send("抽奖成功");
    } else {
      res.send("请稍后重试！");
    }
  } catch (err) {
    console.log(err);
    res.status(500).send("服务器错误");
  }
});

app.listen(3000, () => {
  console.log("Server started on port 3000");
});
