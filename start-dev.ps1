#requires -Version 5.1
<#
.SYNOPSIS
    爪印后端一键启动（Docker 数据库 + NestJS 服务）

.DESCRIPTION
    依次完成：环境检查 -> 启动 PostgreSQL 容器 -> 同步数据库结构 -> 启动后端 -> 健康检查
    重复执行是安全的（已运行的会跳过）。

.PARAMETER Background
    后台启动后端，日志写入 dev.log，脚本执行完立即返回。

.PARAMETER Stop
    停止正在运行的后端进程。

.PARAMETER NoDocker
    跳过数据库检查（连远程/已有 Postgres 时用）。

.EXAMPLE
    .\start-dev.ps1
    .\start-dev.ps1 -Background
    .\start-dev.ps1 -Stop
#>
[CmdletBinding()]
param(
    [switch]$Background,
    [switch]$Stop,
    [switch]$NoDocker
)

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$DB_CONTAINER = 'paw-print-db'
$PORT = 4000
$HEALTH_URL = "http://127.0.0.1:$PORT/api/health"

function Step($text) { Write-Host ""; Write-Host "[$text]" -ForegroundColor Cyan }
function Ok($text) { Write-Host "  OK  $text" -ForegroundColor Green }
function Warn($text) { Write-Host "  !!  $text" -ForegroundColor Yellow }
function Fail($text) { Write-Host "  XX  $text" -ForegroundColor Red }

function Test-PortInUse {
    $conn = Get-NetTCPConnection -LocalPort $PORT -State Listen -ErrorAction SilentlyContinue
    return ($null -ne $conn -and $conn.Count -gt 0)
}

function Test-Health {
    try {
        $res = Invoke-WebRequest $HEALTH_URL -UseBasicParsing -TimeoutSec 2
        return ($res.StatusCode -eq 200)
    } catch {
        return $false
    }
}

function Stop-Backend {
    $procs = Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
        Where-Object { $_.CommandLine -like "*paw-print-server*" }
    if (-not $procs) {
        Warn '没有找到正在运行的后端进程'
        return
    }
    foreach ($p in $procs) {
        Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
    }
    Ok ('已停止后端进程 ' + ($procs.ProcessId -join ', '))
}

# ---------------- 停止模式 ----------------
if ($Stop) {
    Step '停止后端'
    Stop-Backend
    return
}

Step '1/6 环境检查'

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Fail '未找到 node，请先安装 Node.js 18 或更高版本'
    exit 1
}
Ok ('Node ' + (node -v))

if (-not (Test-Path '.env')) {
    Copy-Item '.env.example' '.env'
    Ok '已从 .env.example 生成 .env'
} else {
    Ok '.env 已存在'
}

if (-not (Test-Path 'node_modules')) {
    Warn '未安装依赖，开始 npm install（首次会比较慢）'
    npm install --registry=https://registry.npmmirror.com --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) {
        Fail 'npm install 失败'
        exit 1
    }
} else {
    Ok '依赖已安装'
}

Step '2/6 启动数据库'

if ($NoDocker) {
    Warn '已跳过数据库检查（-NoDocker）'
} else {
    docker info 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) {
        $desktop = 'C:\Program Files\Docker\Docker\Docker Desktop.exe'
        if (-not (Test-Path $desktop)) {
            Fail '未找到 Docker Desktop，请自行启动数据库或用 -NoDocker 连接已有实例'
            exit 1
        }
        Warn 'Docker 未运行，正在启动 Docker Desktop（最多等 2 分钟）'
        Start-Process $desktop
        $engineReady = $false
        for ($i = 0; $i -lt 24; $i++) {
            Start-Sleep -Seconds 5
            docker info 2>$null | Out-Null
            if ($LASTEXITCODE -eq 0) { $engineReady = $true; break }
        }
        if (-not $engineReady) {
            Fail 'Docker 引擎仍未就绪，请手动打开 Docker Desktop 后重试'
            exit 1
        }
        Ok 'Docker 引擎已就绪'
    } else {
        Ok 'Docker 引擎运行中'
    }

    docker compose up -d 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Fail 'docker compose up 失败，请检查 docker-compose.yml'
        exit 1
    }

    $healthy = $false
    for ($i = 0; $i -lt 20; $i++) {
        $status = (docker inspect --format "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}" $DB_CONTAINER 2>$null)
        if ($status -eq 'healthy' -or $status -eq 'running') {
            $healthy = $true
            break
        }
        Start-Sleep -Seconds 2
    }
    if ($healthy) {
        Ok ('数据库容器 ' + $DB_CONTAINER + ' 已就绪')
    } else {
        Warn '数据库容器状态未知，继续尝试连接'
    }
}

Step '3/6 同步数据库结构'

if (-not (Test-Path 'node_modules/.prisma/client/index.js')) {
    Warn 'Prisma Client 缺失，正在生成'
    npx prisma generate | Out-Null
}
npx prisma db push --skip-generate 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Ok '数据库结构与 schema 一致'
} else {
    Fail '数据库连接失败，检查 .env 里的 DATABASE_URL'
    exit 1
}

Step '4/6 检查后端端口'

if (Test-PortInUse) {
    if (Test-Health) {
        Ok "后端已在 $PORT 端口运行，无需重复启动"
        Warn '要重启请先执行： .\start-dev.ps1 -Stop'
        return
    }
    Warn "端口 $PORT 被占用但健康检查不通，可能是上一次的残留进程"
    Warn '可执行： .\start-dev.ps1 -Stop 清理后再启动'
    return
}
Ok "端口 $PORT 空闲"

Step '5/6 启动后端'

if ($Background) {
    Start-Process -FilePath 'npm.cmd' -ArgumentList 'run', 'dev' -WindowStyle Hidden `
        -RedirectStandardOutput 'dev.log' -RedirectStandardError 'dev.err.log'
    Ok '后端已在后台启动，日志：dev.log'
} else {
    Write-Host '  前台运行，按 Ctrl+C 可停止服务' -ForegroundColor DarkGray
    npm run dev
    return
}

Step '6/6 健康检查'

$up = $false
for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Seconds 2
    if (Test-Health) { $up = $true; break }
}

if ($up) {
    Ok '后端已就绪'
    Write-Host ""
    Write-Host "  接口地址   http://localhost:$PORT/api" -ForegroundColor White
    Write-Host "  健康检查   $HEALTH_URL" -ForegroundColor White
    Write-Host "  日志文件   $root\dev.log" -ForegroundColor White
    Write-Host "  停止服务   .\start-dev.ps1 -Stop" -ForegroundColor White
    Write-Host ""
    Write-Host "  下一步：打开微信开发者工具 -> 导入 d:\main\paw-print -> 编译" -ForegroundColor DarkGray
} else {
    Fail '后端启动超时，请查看 dev.err.log'
    if (Test-Path 'dev.err.log') {
        Get-Content 'dev.err.log' -Tail 15
    }
    exit 1
}
