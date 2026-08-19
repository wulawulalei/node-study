import jwt from "jsonwebtoken";

const SECRET = "your-secret-key";

// payload：存放身份信息，exp自动或者手动设置
// const token = jwt.sign(
//   {
//     userId: 1001, // 身份：用户ID
//     role: "admin", // 身份：角色
//   },
//   SECRET,
//   { expiresIn: "2h" }, // 2小时过期，库会自动加上exp(秒级时间戳)
// );

// console.log(token, "token");

const token =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc4NjUyNjYyNSwiZXhwIjoxNzg2NTMzODI1fQ.P9Nh3YbNktMx9Ockls_eJnjItewPdzpT2zIt0euLbPQ";

const eastbuyToken =
  "eyJhbGciOiJIUzUxMiJ9.eyJjcmVhdGVkIjoyMjQsIm5hbWUiOiJ4dXpoYW55aSIsInR5cCI6IkpXVCIsInRpbWUiOiIxNzg2NTAzODEwIiwiYWxnIjoiSFMyNTYifQ.gCOCmTH2383gIlrYdspojnzbK2WXni5k2RfhQRsyxZ1xu8mE0vI6TGuROmctFehLX9wOluQv9aCPobhPhjVjlw";

const data = jwt.verify(token, SECRET);
console.log(data, "data");
