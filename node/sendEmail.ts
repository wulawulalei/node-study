import nodemailder from 'nodemailer';
import yaml from 'js-yaml';
import http from 'node:http';
import url from 'node:url';
import fs from 'node:fs';
const config: any = yaml.load(fs.readFileSync('./mail.yaml', 'utf8'));
console.log(config, 'config');
const transPort = nodemailder.createTransport({
    service: "qq",
    port: 587,
    host: 'smtp.qq.com',
    secure: true,
    auth: {
        pass: config.mail.pass,
        user: config.mail.user
    }
})


http.createServer((req, res) => {
    const { pathname } = url.parse(req.url || '')
    if (req.method === 'POST' && pathname == '/send/mail') {
        let mailInfo = ''
        req.on('data', (chunk) => {
            mailInfo += chunk.toString()
        })
        req.on('end', () => {
            const body = JSON.parse(mailInfo)
            transPort.sendMail({
                to: body.to,
                from: config.mail.user,
                subject: body.subject,
                text: body.text
            })
            res.end('ok')
        })
    }
}).listen(3000)

