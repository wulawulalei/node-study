// CI/CD 触发演示脚本
console.log("🚀 CI/CD 流水线已被触发！");
console.log("===============================");
console.log("仓库:", process.env.GITHUB_REPOSITORY || "本地运行");
console.log("分支:", process.env.GITHUB_REF_NAME || "local");
console.log("提交:", process.env.GITHUB_SHA || "unknown");
console.log("触发事件:", process.env.GITHUB_EVENT_NAME || "manual");
console.log("Node 版本:", process.version);
console.log("当前时间:", new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }));
console.log("===============================");
console.log("✅ Demo 运行成功，流水线工作正常！");
