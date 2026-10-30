# 爪印后端 · 启动 / 部署 / 数据查看手册

> 技术栈：NestJS 10 + Prisma 5 + PostgreSQL 16
> 默认端口：后端 `4000`，数据库 `5432`
> 接口前缀：`/api`；上传的图片走 `/uploads/`（不带 `/api` 前缀）

相关文件速查：

| 文件 | 作用 |
|---|---|
| `start-dev.ps1` | 本地一键启动脚本（Docker 数据库 + 后端） |
| `docker-compose.yml` | 本地 PostgreSQL 容器（`paw-print-db`） |
| `.env.example` | 环境变量模板，复制为 `.env` 使用 |
| `prisma/schema.prisma` | 数据模型（改结构只改这里） |
| `dev.log` / `dev.err.log` | `-Background` 模式下的后端日志 |

---

## 一、本地开发

### 1. 前置条件

- Node 18+（实测 Node 22）
- Docker Desktop（或已有 Postgres 实例）
- 首次执行前从 `.env.example` 复制出 `.env`

### 2. 一键启动（推荐）

```powershell
cd d:\main\paw-print-server
.\start-dev.ps1                # 前台启动，Ctrl+C 停止
.\start-dev.ps1 -Background    # 后台启动，日志写 dev.log / dev.err.log
.\start-dev.ps1 -Stop          # 停掉本项目的 node 进程
.\start-dev.ps1 -NoDocker      # 跳过 Docker，连已有/远程 Postgres
```

脚本执行的 6 步：环境检查 → 启动 Docker 与 `paw-print-db` 容器 → `prisma generate` + `prisma db push` → 检查 4000 端口 → `npm run dev` → 轮询 `/api/health`。
**重复执行安全**：已在运行且健康检查通过时会直接返回。

### 3. 手动启动

```powershell
cp .env.example .env        # 1. 环境变量
docker compose up -d        # 2. 启动数据库
npm install                 # 3. 依赖
npm run db:generate         # 4. 生成 Prisma Client
npm run db:push             # 5. 同步表结构
npm run dev                 # 6. 启动（ts-node-dev 热重载）
```

自检：

```powershell
curl http://127.0.0.1:4000/api/health
```

### 4. 本地登录（免真实微信凭据）

`.env` 里 `WX_SECRET` 留空时，登录走 mock：`openid = mock_<code>`。小程序端固定传同一个 `code`（例如 `dev-user`）即可稳定复用一个用户。**线上必须填真实 `WX_SECRET` 并把 `ALLOW_MOCK_LOGIN` 设为 `false`。**

### 5. 本地常见问题

- **改了 `schema.prisma` 字段变 `undefined`**：必须依次执行 `npx prisma generate` → `npx prisma db push` → 手动重启 `npm run dev`（`ts-node-dev` 只监听 `src/**`，不会因 Client 更新而重启）。
- **端口被占但健康检查不通**：上次残留进程，执行 `.\start-dev.ps1 -Stop` 后重来。
- **Docker 引擎没起来**：脚本会尝试拉起 Docker Desktop，最多等 2 分钟；仍失败就手动打开。
- **镜像拉不动**：`docker-compose.yml` 默认走 `docker.m.daocloud.io` 镜像源。

---

## 二、线上部署（Linux 云服务器）

以下以 Ubuntu 22.04 + 宝塔/裸机通用流程为例，目录约定 `/var/www/paw-print-server`，域名 `api.example.com`。

### 1. 服务器准备

```bash
# Node 20（NodeSource）
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git nginx
sudo npm i -g pm2
```

### 2. 数据库

**方案 A：云数据库（推荐）** — 阿里云 RDS / 腾讯云 PostgreSQL，创建库 `paw_print`，记下连接串。

**方案 B：服务器自带 Docker**

```bash
sudo apt install -y docker.io docker-compose-plugin
# 复用仓库里的 docker-compose.yml，但生产务必改掉默认密码
docker compose up -d
```

无论哪种，最终都要落到 `DATABASE_URL`：

```
postgresql://paw:强密码@数据库内网地址:5432/paw_print?schema=public
```

### 3. 拉代码 + 安装 + 构建

```bash
sudo mkdir -p /var/www && cd /var/www
git clone <仓库地址> paw-print-server
cd paw-print-server

cp .env.example .env
vim .env          # 见下方“生产 .env 必改项”

npm ci
npx prisma generate
npx prisma db push --skip-generate   # 首次建表；见下方“关于迁移”
npm run build                        # 产出 dist/
```

**生产 `.env` 必改项：**

| 变量 | 生产值 |
|---|---|
| `PORT` | `4000`（或反代后的内部端口） |
| `DATABASE_URL` | 真实库地址 + 强密码 |
| `WX_SECRET` | 真实小程序 secret（小程序后台 → 开发管理 → 开发设置） |
| `ALLOW_MOCK_LOGIN` | `false`（否则任何人都能伪造登录） |
| `JWT_SECRET` | 换成长随机串，别用 `change-me-in-production` |
| `WX_SUBSCRIBE_TEMPLATE_ID` | 订阅消息模板 ID（不填则推送走 mock） |

### 4. 用 PM2 常驻

```bash
pm2 start dist/main.js --name paw-print-api
pm2 save
pm2 startup            # 按提示执行输出的那行命令，实现开机自启
pm2 logs paw-print-api # 看日志
pm2 restart paw-print-api
```

> 注意：`npm run start` 等价于 `node dist/main.js`，PM2 不跑 `npm run dev`。

### 5. Nginx 反代 + HTTPS

```nginx
server {
    listen 80;
    server_name api.example.com;
    client_max_body_size 6m;      # 上传限制后端是 5MB，这里略放宽

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/paw-print-api /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.example.com     # 自动签发并配置 443
```

**上传目录**：`uploads/` 在 `process.cwd()` 下，即 `/var/www/paw-print-server/uploads`。备份/迁移时要一起带走；生产建议改对象存储（COS/OSS）。

### 6. 小程序端联调前提

1. 微信小程序后台 → 开发管理 → 服务器域名，把 `https://api.example.com` 加到 **request 合法域名** 和 **uploadFile 合法域名**；
2. 小程序端把 API 基址改成线上地址（不再是 `127.0.0.1:4000`）；
3. 图片回显地址来自 `POST /api/upload` 返回的 `url`（用请求 Host 拼的），经反代后即为线上域名。

### 7. 发布/更新流程

```bash
cd /var/www/paw-print-server
git pull
npm ci
npx prisma generate
npx prisma db push --skip-generate   # 有结构变更时
npm run build
pm2 restart paw-print-api
curl -s https://api.example.com/api/health
```

### 8. 关于数据库迁移

仓库当前**没有 `prisma/migrations` 目录**，所以生产直接 `npx prisma db push`（结构以 `schema.prisma` 为准）。

想规范化版本管理，先在做完结构变更时执行一次：

```bash
npx prisma migrate dev --name init     # 生成 prisma/migrations，提交进仓库
```

之后生产改用：

```bash
npx prisma migrate deploy
```

⚠️ `migrate deploy` 本身**不会**执行 `generate`，且 `db push` 和 `migrate` 不要混用。

---

## 三、查看后台数据

### 1. Prisma Studio（图形化，最常用）

**本地：**

```powershell
npm run db:studio        # 打开 http://localhost:5555，数据在左侧边栏切换表
```

**线上（推荐用 SSH 隧道，不要直接暴露 5555 端口）：**

```bash
# 服务器上启动，只监听本地回环
cd /var/www/paw-print-server
npx prisma studio --port 5555 --browser none
# 本机另开一个终端建立隧道
ssh -L 5555:127.0.0.1:5555 user@服务器IP
# 然后本机浏览器访问 http://localhost:5555
```

（若用 PM2 常驻：`pm2 start "npx prisma studio --port 5555 --browser none" --name paw-studio`，用完记得 `pm2 delete paw-studio`。）

表对应关系：`Family` 家庭 / `User` 用户 / `Pet` 宠物 / `Record` 记录 / `Reminder` 提醒 / `Booking` 预约。

常用字段含义：

- `User.subscribeCount`：剩余可推送次数（一次性订阅，授权 +1、发送 -1）；
- `Reminder.nextDate` / `lastNotifiedDate`：下次到期日 / 上次推送日（防当天重复推送）；
- `Booking.status`：`待服务` / `已完成` / `已取消`；`rating` 为 0 表示未评价；
- `Pet.noseprintCode` 等：鼻纹识别结果，可为空。

### 2. 命令行 SQL

本地 Docker 容器：

```bash
docker exec -it paw-print-db psql -U paw -d paw_print
```

线上直连（RDS 或同机 Postgres）：

```bash
psql "postgresql://paw:密码@主机:5432/paw_print" 
```

进入后常用命令：

```sql
\dt                                     -- 列表
\d "Pet"                                -- 表结构
SELECT id, name, "familyId" FROM "Pet" ORDER BY "createdAt" DESC LIMIT 20;
SELECT count(*) FROM "User";
SELECT * FROM "Reminder" WHERE "nextDate" <= to_char(now(),'YYYY-MM-DD') AND enabled;
SELECT status, count(*) FROM "Booking" GROUP BY status;
\d+ "Record"
```

> Prisma 建的表名和列名是**双引号驼峰**，SQL 里必须加引号。

### 3. 走接口看数据（无需 DB 权限）

先换 token：

```bash
curl -X POST https://api.example.com/api/auth/login \
  -H "Content-Type: application/json" -d '{"code":"dev-user"}'
```

再带 token 查询：

```bash
curl https://api.example.com/api/pets -H "Authorization: Bearer <token>"
curl "https://api.example.com/api/records?petId=<id>&take=20" -H "Authorization: Bearer <token>"
curl https://api.example.com/api/family -H "Authorization: Bearer <token>"
```

线上 `ALLOW_MOCK_LOGIN=false` 时必须有真实微信 `code`，`dev-user` 不再可用。

### 4. 订阅推送调试

```bash
# 手动触发一次到期扫描，返回里含发送/跳过/mock 统计
curl -X POST https://api.example.com/api/notify/run -H "Authorization: Bearer <token>"
```

定时扫描由进程内 `ReminderCronService` 负责：启动 15 秒后补跑一次，之后每 30 分钟一次。**多实例部署时每个实例都会扫**，需要改成单实例或加分布式锁。

### 5. 看日志

| 场景 | 命令 |
|---|---|
| 本地后台启动 | `Get-Content dev.log -Tail 50 -Wait`（错误看 `dev.err.log`） |
| 本地前台启动 | 直接看终端输出 |
| 线上 PM2 | `pm2 logs paw-print-api --lines 100` |
| 线上 Docker 数据库 | `docker logs paw-print-db` |

---

## 四、备份与恢复

```bash
# 备份（服务器上）
pg_dump "postgresql://paw:密码@主机:5432/paw_print" -Fc -f paw_print_$(date +%F).dump
# 恢复
pg_restore -d "postgresql://paw:密码@主机:5432/paw_print" --clean paw_print_2026-10-30.dump
# 上传文件
tar czf uploads_$(date +%F).tar.gz /var/www/paw-print-server/uploads
```

## 五、上线前检查清单

- [ ] `ALLOW_MOCK_LOGIN=false`、`JWT_SECRET` 已换
- [ ] `WX_SECRET` 已填，`WX_SUBSCRIBE_TEMPLATE_ID` 已填
- [ ] 数据库密码非默认值，且不对外开放 5432（只走内网/安全组）
- [ ] 域名已加 HTTPS，并在小程序后台配置 request/uploadFile 合法域名
- [ ] `pm2 save` + `pm2 startup` 已执行，重启服务器后服务能自恢复
- [ ] `uploads/` 已纳入备份策略
- [ ] `curl https://你的域名/api/health` 返回 200
