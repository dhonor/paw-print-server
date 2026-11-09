# paw-print-server

爪印小程序的后端服务。NestJS + Prisma + PostgreSQL。

> 本地/线上启动、部署、查看后台数据的完整说明见 [DEPLOY.md](./DEPLOY.md)。

## 前置

- Node 18+（本机实测 Node 22）
- Docker（用于起本地 PostgreSQL）；也可以用已有的 Postgres 实例，改 `DATABASE_URL` 即可

## 生产部署

上线流程（服务器、HTTPS、备案、备份、检查清单）见 **[DEPLOY.md](./DEPLOY.md)**。

## 一键启动（推荐）

```powershell
.\start-dev.ps1              # 前台启动，日志直接打在终端，Ctrl+C 停止
.\start-dev.ps1 -Background  # 后台启动，日志写入 dev.log
.\start-dev.ps1 -Stop        # 停止后台运行的后端
.\start-dev.ps1 -NoDocker    # 跳过 Docker 检查（连远程 Postgres 时）
```

脚本会依次做：环境检查 → 启动 Docker 与数据库容器 → 同步 Prisma 结构 → 检查端口 → 启动后端 → 健康检查。重复执行是安全的。

## 手动启动

```bash
# 1. 环境变量
cp .env.example .env

# 2. 起数据库
docker compose up -d

# 3. 安装依赖 + 生成 Prisma Client
npm install
npm run db:generate

# 4. 建表（开发期用 db push，正式环境用 migrate）
npm run db:push

# 5. 启动
npm run dev
```

服务地址：`http://localhost:4000/api`

## 常用脚本

| 命令 | 作用 |
|---|---|
| `npm run dev` | 开发启动，`ts-node-dev` 热重载，只监听 `src/**` |
| `npm run build` | `tsc` 编译到 `dist/`（生产用） |
| `npm start` | 跑 `dist/main.js`，**必须先 build** |
| `npm run db:generate` | 重新生成 Prisma Client |
| `npm run db:push` | 把 `schema.prisma` 同步到数据库（开发期用） |
| `npm run db:migrate` | 生成正式迁移文件（当前仓库还没有 `prisma/migrations`） |
| `npm run db:studio` | 图形化看/改数据，`http://localhost:5555` |

## 目录结构

```
src/
  main.ts            入口：全局前缀 api、CORS、uploads 静态目录、ValidationPipe
  app.module.ts      模块装配
  health.controller.ts
  auth/              wx.login code -> openid -> 签发 JWT
  common/            JwtAuthGuard、@CurrentUser 装饰器
  prisma/            PrismaService（全局）
  pets/ records/ reminders/ bookings/ families/   业务模块（controller + service + dto）
  notify/            订阅消息推送 + 30 分钟到期扫描定时器
  upload/            图片上传（存本地 uploads/）
  lbs/               腾讯位置服务代理（周边搜索 / 逆地址解析）
  feedback/          用户反馈
  lbs/               腾讯位置服务代理（周边搜索 / 逆地址解析，key 只留在服务端）
prisma/schema.prisma 数据模型（唯一结构来源）
uploads/             上传的图片（不进 git，需单独备份）
```

## 环境变量

参考 `.env.example`：

| 变量 | 说明 |
|---|---|
| `PORT` | 服务端口，默认 `4000` |
| `DATABASE_URL` | PostgreSQL 连接串 |
| `WX_APPID` / `WX_SECRET` | 小程序凭据；`WX_SECRET` 留空则登录走 mock |
| `JWT_SECRET` / `JWT_EXPIRES_IN` | 签发 token 的密钥与有效期（默认 `30d`） |
| `ALLOW_MOCK_LOGIN` | 默认 `true`，**线上必须设 `false`** |
| `WX_SUBSCRIBE_TEMPLATE_ID` | 订阅消息模板 ID，留空则推送走 mock |
| `LBS_KEY` | 腾讯位置服务 WebServiceAPI key，**只放服务端**；留空时 `/api/lbs/*` 返回 503 |
| `LBS_KEY` | 腾讯位置服务 WebServiceAPI key，周边搜索代理用；留空则 `/api/lbs/*` 返回 503 |

## 接口

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/health` | 健康检查 |
| POST | `/api/auth/login` | `{ code }` → `{ token, user }` |
| GET | `/api/pets` | 当前家庭的全部宠物 |
| POST | `/api/pets` | 新增宠物 |
| GET | `/api/pets/:id` | 宠物详情 |
| PATCH | `/api/pets/:id` | 更新宠物 |
| DELETE | `/api/pets/:id` | 删除宠物 |
| GET | `/api/records?petId=&take=` | 记录列表 |
| POST | `/api/records` | 新增记录 |
| PATCH | `/api/records/:id` | 更新记录 |
| DELETE | `/api/records/:id` | 删除记录 |
| GET | `/api/reminders?petId=` | 提醒列表（按到期日升序） |
| POST | `/api/reminders` | 新增提醒 |
| PATCH | `/api/reminders/:id` | 更新/开关提醒 |
| POST | `/api/reminders/:id/complete` | 完成一次，按周期顺延下次日期 |
| DELETE | `/api/reminders/:id` | 删除提醒 |
| GET | `/api/bookings?status=` | 预约列表 |
| POST | `/api/bookings` | 提交预约 |
| PATCH | `/api/bookings/:id` | 改状态（待服务/已完成/已取消） |
| POST | `/api/bookings/:id/rate` | 评价（仅已完成可评） |
| DELETE | `/api/bookings/:id` | 删除预约 |
| POST | `/api/notify/subscribe` | 用户授权后上报可发送额度（`{ count }`） |
| POST | `/api/notify/run` | 手动触发一次到期扫描（调试用） |
| GET | `/api/family` | 当前家庭 + 成员 + 邀请码 |
| PATCH | `/api/family` | 改家庭名称 |
| PATCH | `/api/family/me` | 改自己的昵称/角色 |
| POST | `/api/family/join` | 用邀请码加入家庭（返回新 token） |
| POST | `/api/upload` | 上传图片（`multipart/form-data`，字段名 `file`）→ `{ url, path, size }` |
| GET | `/api/lbs/search?keyword=&latitude=&longitude=&radius=&pageSize=` | 周边搜索（腾讯位置服务代理，按距离排序，`radius` 默认 5000 米，`pageSize` 上限 20） |
| GET | `/api/lbs/geocode?latitude=&longitude=` | 逆地址解析（坐标 → 地址/周边信息） |
| POST | `/api/feedback` | 提交反馈（`type`/`content`/`contact`/`images`）→ `{ id, createdAt }` |
| GET | `/api/feedback/mine` | 我提交过的反馈（最近 20 条，含处理状态） |
| GET | `/api/lbs/search?keyword=&latitude=&longitude=&radius=&pageSize=` | 周边搜索（代理腾讯位置服务，`radius` 默认 5000 米，`pageSize` 上限 20） |
| GET | `/api/lbs/geocode?latitude=&longitude=` | 逆地址解析（坐标 → 可读地址） |

除 `/api/health` 与 `/api/auth/login` 外，都要带 `Authorization: Bearer <token>`。

## 通用约定

- 统一前缀 `/api`；`POST /api/upload` 只收图片，单文件上限 5MB。
- 上传成功返回的 `url` 是按请求 Host 拼的绝对地址，图片静态目录是 **`/uploads/…`（不带 `/api`）**。
- 全局 `ValidationPipe`：`whitelist: true`，DTO 里没声明的字段会被静默丢弃（新增字段记得同时改 DTO）。
- 出错统一返回 `{ statusCode, message, path }`（`AllExceptionsFilter` 兜底）；token 缺失是 `未登录`，过期是 `登录已过期，请重新进入小程序`。
- `GET /api/records` 的 `take` 不传默认 100 条、上限 200，按 `date desc` 排序；`GET /api/reminders` 按 `nextDate` 升序返回。
- CORS 全开（`app.enableCors()`），仅靠 JWT 做鉴权；开放 4000 端口到公网时注意这一点。
- 位置服务不要从小程序直连：`/api/lbs/*` 由服务端带 `LBS_KEY` 转发。key 一旦打进小程序包就等于公开，会被盗刷配额。
- `/api/lbs/search` 与 `/api/lbs/geocode` 也走 `JwtAuthGuard`，防止被当成免费代理。

## 鉴权说明

- 小程序端：`wx.login()` 拿 `code` → `POST /api/auth/login` → 存下 `token`，后续请求带上。
- 服务端：`code` 换 `openid`（`jscode2session`），首次登录自动建家庭并建档用户，签发 JWT。
- **本地没配 `WX_SECRET` 时**会自动走 mock：`openid = mock_<code>`。前端本地固定传同一个 `code`（例如 `dev-user`），就能稳定复用一个用户。

## 数据隔离

所有业务表都带 `familyId`，服务端每个查询都按 `familyId` 过滤，家庭成员共享同一份数据，跨家庭互相看不到。

## 家庭共享

- 家庭 id 就是邀请码：家人在「家庭共享」里输入邀请码即可加入同一家庭；
- 加入后服务端会重新签发 token（token 里带 familyId），前端要替换本地 token；
- 同一家庭的所有成员共享同一份宠物、记录、提醒、预约数据。

## 位置服务（LBS）

为什么不让小程序直连腾讯：`WebServiceAPI` 的 key 一旦打进小程序包就等于公开，所以统一由后端代理（`src/lbs/`），key 只存 `.env` 的 `LBS_KEY`，并且这两个接口都要求登录态。

- `search`：`boundary=nearby(纬度,经度,半径,自动扩大)`，`orderby=_distance`，只看第 1 页；
- `geocode`：`get_poi=0`，只要行政区/街道信息；
- 响应**原样透传**腾讯的 `{ status, message, data }`，小程序侧自己映射字段；
- 错误映射：经纬度非法 → 400 `缺少有效的经纬度`；未配 `LBS_KEY` → 503；腾讯返回非 0 或超时（8s）→ 502。

## 用户反馈

- 类型枚举：`功能建议`（默认）/ `问题反馈` / `内容错误` / `其他`；`content` 必填、5~500 字；`contact` ≤60 字；`images` 最多 3 张，**先调 `/api/upload` 拿地址再传数组**。
- 图片在库里是逗号拼接的字符串（`images` 字段），不是关联表。
- `status` 默认 `待处理`，目前没有后台处理接口，改状态只能直接在库里改（见 `DEPLOY.md`）。
- `GET /api/feedback/mine` 只返回**当前登录用户**提交的记录，不带 `familyId` 维度。

## 订阅消息（到期提醒推送）

链路：用户在小程序里点「开启」→ `wx.requestSubscribeMessage` 授权 → 前端上报额度 → 后端每 30 分钟扫一次到期提醒 → 调 `subscribeMessage.send` 推送。

**上线前必须做的三件事**

1. 小程序后台 → 订阅消息 → 选用模板，拿到模板 ID；
2. 后端 `.env` 填 `WX_SUBSCRIBE_TEMPLATE_ID`，小程序端 `utils/config.js` 填同一个 ID；
3. `.env` 里填真实的 `WX_APPID` / `WX_SECRET`（获取 access_token 用）。

**模板字段要和代码对上**：当前发送体用的是 `thing1`（宠物名）、`thing2`（提醒类型）、`time3`（下次日期）、`thing4`（提示语）。选的模板如果不是这四个字段，改 `notify.service.ts` 里的 `data` 即可。

**一个平台限制**：微信是「一次性订阅」——用户每授权一次，后端只能发一条。额度用完需要用户再点一次「开启」。想要持续推送只能做长期订阅（对类目有要求）或引导用户多次授权。

**没有模板 ID 时会走 mock**：只打印日志、不真发，`POST /api/notify/run` 返回里的 `mock` 字段会统计条数，方便本地验证链路。

## 常见坑

**改了 `prisma/schema.prisma` 之后，一定要按顺序做三件事**，否则会出现「字段莫名变 undefined」：

```bash
npx prisma generate   # 重新生成 Client（ts-node-dev 不会因此重启）
npx prisma db push    # 同步数据库结构
# 然后手动重启 npm run dev —— 因为进程里加载的还是旧 Client
```

`ts-node-dev` 只在 `src/**` 变化时重启，`prisma generate` 改动的是 `node_modules/.prisma`，不会触发重启。

其它容易踩的点：

- **`npm start` 报找不到 `dist/main.js`**：先 `npm run build`。
- **图片 404**：`uploads/` 是运行时目录（`process.cwd()` 下），换了启动目录或在 Docker 里跑就找不到旧图；该目录不进 git，迁移/备份要单独带走。
- **定时推送重复发**：扫描器在进程内（启动 15 秒后补一次 + 每 30 分钟一次），部署多个实例会各自扫一遍，需要削成单实例或加锁。
- **线上还看到 mock 登录**：`WX_SECRET` 为空或 `ALLOW_MOCK_LOGIN` 没设成 `false`。
- **想看库里数据**：`npm run db:studio`；线上的安全做法见 `DEPLOY.md` 的「查看后台数据」。
