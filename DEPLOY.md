# 生产部署指南

面向第一次把爪印后端部署到云服务器的场景。按顺序执行，每一步都有验证方法。

---

## 0. 前置条件

| 项 | 说明 | 耗时 |
|---|---|---|
| 云服务器 | 2 核 4G 起步（Ubuntu 22.04），带宽 3M 以上 | 10 分钟 |
| 域名 | 如 `api.example.com` | 10 分钟 |
| **ICP 备案** | 国内服务器必须，**最长的一步** | **1–2 周** |
| SSL 证书 | Let's Encrypt 免费，脚本自动签 | 5 分钟 |

> ⚠️ 备案没下来之前，小程序正式版无法把域名加入 request 白名单。**先提交备案，其余工作并行做。**

---

## 1. 服务器初始化

```bash
# 登录
ssh root@你的服务器IP

# 基础环境
apt update && apt upgrade -y
apt install -y curl git nginx

# Node 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node -v    # 应为 v20.x

# Docker（跑 PostgreSQL）
curl -fsSL https://get.docker.com | bash
docker -v

# pm2（进程守护）
npm i -g pm2
```

---

## 2. 拉代码与配置

```bash
mkdir -p /var/www && cd /var/www
git clone 你的仓库地址 paw-print-server
cd paw-print-server

# 生产环境变量
cp .env.production.example .env
chmod 600 .env
nano .env      # 逐项填写，重点：DATABASE_URL / WX_SECRET / JWT_SECRET
```

**生成 JWT_SECRET**：

```bash
openssl rand -base64 32
```

**必改的三项**（不改等于裸奔）：

| 变量 | 错误值 | 正确做法 |
|---|---|---|
| `JWT_SECRET` | `dev-secret` | 随机 32 字节 |
| `ALLOW_MOCK_LOGIN` | `true` | `false` |
| `DATABASE_URL` 密码 | `paw123456` | 强密码 |

---

## 3. 启动数据库

```bash
docker compose up -d
docker compose ps        # 状态应为 healthy
```

> 云数据库（RDS）用户跳过这步，直接改 `DATABASE_URL` 指向 RDS。
> **不要**把 5432 暴露到公网：`docker-compose.yml` 里的端口映射建议改成 `127.0.0.1:5432:5432`。

---

## 4. 建表与启动服务

```bash
npm install --production=false   # 需要 devDependencies 里的 prisma/tsc
npx prisma generate

# 首次建表（二选一）
npx prisma db push               # 简单直接，适合首次
# npx prisma migrate deploy      # 有 migrations 目录时更稳妥

npm run build
pm2 start ecosystem.config.js
pm2 save
pm2 startup                      # 按提示执行输出的命令，实现开机自启

# 验证
curl http://127.0.0.1:4000/api/health
# {"ok":true,"ts":...}
```

**目录权限**：图片存在 `uploads/`，确保运行用户有写权限：

```bash
mkdir -p uploads logs && chmod 755 uploads logs
```

---

## 5. Nginx 反向代理

```bash
cp deploy/nginx.conf.example /etc/nginx/sites-available/paw-print
nano /etc/nginx/sites-available/paw-print   # 改 server_name 为你的域名
ln -s /etc/nginx/sites-available/paw-print /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

**签 HTTPS 证书**：

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d api.example.com
# 按提示填邮箱，选择「将 HTTP 重定向到 HTTPS」

# 自动续期测试
certbot renew --dry-run
```

**验证**：

```bash
curl https://api.example.com/api/health
```

---

## 6. 云服务器安全组

只开这三个端口，**不要开 4000**：

| 端口 | 用途 |
|---|---|
| 22 | SSH |
| 80 | HTTP（跳转 HTTPS） |
| 443 | HTTPS |

4000 只监听本机，由 Nginx 转发。

---

## 7. 数据备份

```bash
mkdir -p /var/backups/paw
cat > /usr/local/bin/paw-backup.sh <<'EOF'
#!/bin/bash
DATE=$(date +%F)
docker exec paw-print-db pg_dump -U paw paw_print | gzip > /var/backups/paw/db_$DATE.sql.gz
# 只保留最近 14 天
find /var/backups/paw -name "db_*.sql.gz" -mtime +14 -delete
EOF
chmod +x /usr/local/bin/paw-backup.sh

# 每天凌晨 3 点备份
echo "0 3 * * * /usr/local/bin/paw-backup.sh" | crontab -
```

**恢复**：

```bash
gunzip -c /var/backups/paw/db_2026-11-09.sql.gz | docker exec -i paw-print-db psql -U paw -d paw_print
```

---

## 8. 小程序端配置

改 `paw-print/utils/config.js`：

```js
const RELEASE_API_BASE = 'https://api.example.com/api';
```

`devLoginCode` 已是 `isRelease ? '' : 'dev-user'`，正式版会自动走真实 `wx.login`，无需改动。

**小程序后台**要做的三件事：

1. 开发管理 → 开发设置 → **服务器域名** → request 合法域名填 `https://api.example.com`；
2. 开发管理 → 接口设置 → 申请 **位置接口**（`wx.getLocation`），说明用途「展示附近宠物医院」；
3. 设置 → 服务内容声明 → **用户隐私保护指引**，勾选：位置信息、相册（含相机）、微信昵称头像。

---

## 9. 上线检查清单

上线前逐项打勾：

- [ ] `curl https://域名/api/health` 返回 `{"ok":true}`
- [ ] `.env` 里 `ALLOW_MOCK_LOGIN=false`、`JWT_SECRET` 已更换
- [ ] 数据库端口未暴露公网
- [ ] HTTPS 证书有效期正常（`certbot renew --dry-run`）
- [ ] 备份脚本已跑过一次，`/var/backups/paw` 有文件
- [ ] 小程序 request 白名单已配置
- [ ] 隐私保护指引已提交并通过
- [ ] `config.js` 的 `RELEASE_API_BASE` 已换真实域名
- [ ] 体验版走一遍：登录 → 建宠物 → 记录 → 提醒 → 上传头像

---

## 10. 日常更新

```bash
cd /var/www/paw-print-server
git pull
npm install
npx prisma generate
npx prisma db push        # 仅在 schema 变更时
npm run build
pm2 reload paw-print-server
```

**改了 `.env` 一定要 `pm2 reload`**，否则进程里还是旧变量。

---

## 11. 常见问题

| 现象 | 原因 | 处理 |
|---|---|---|
| `502 Bad Gateway` | 后端没起或端口不对 | `pm2 status`、`pm2 logs` |
| 小程序报 `url not in domain list` | 域名没加白名单 / 证书无效 | 检查后台配置、`curl -I https://域名` |
| 请求很慢 | 服务器带宽小 / 数据库没索引 | 看 `pm2 logs` 里的响应耗时 |
| 图片 404 | `uploads/` 权限或路径问题 | 确认 `process.cwd()` 是项目根，目录可写 |
| 时间差 8 小时 | 服务器时区 | `timedatectl set-timezone Asia/Shanghai` |
| `Prisma Client did not initialize` | 忘了 `prisma generate` | 重新执行并 `pm2 restart` |

---

## 12. 后续建议

| 项 | 说明 |
|---|---|
| 图片换对象存储 | 本地磁盘在多实例或迁移时会丢，接 COS/OSS 更稳 |
| 内容安全审核 | 用户上传图片需过 `security.imgSecCheck`，这是审核必查项 |
| 监控告警 | 至少给 `/api/health` 配一个定时探测，挂了能收到通知 |
| 日志轮转 | pm2-logrotate，避免日志把磁盘写满 |
