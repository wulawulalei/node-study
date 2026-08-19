import os from 'node:os';

// 输出系统信息，验证 TypeScript 可正常运行
const info = {
  平台: os.platform(),
  架构: os.arch(),
  CPU核数: os.cpus().length,
  总内存GB: (os.totalmem() / 1024 / 1024 / 1024).toFixed(2),
  空闲内存GB: (os.freemem() / 1024 / 1024 / 1024).toFixed(2),
  主机名: os.hostname(),
  用户目录: os.homedir(),
};

console.log('TypeScript 运行成功，系统信息如下：');
console.log(info);

// 验证类型推导正常工作
const cpus: os.CpuInfo[] = os.cpus();
console.log(`CPU 型号: ${cpus[0]?.model ?? '未知'}`);
console.log(cpus, 'cpus');
