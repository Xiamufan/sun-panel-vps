# Sun-Panel VPS 迁移包

从现有 VPS 整理的 **Sun-Panel 1.8.1 + 自定义二次元壁纸界面 + Nginx 图片代理缓存 + 每日更新任务**。支持使用 systemd 的 **Debian / Ubuntu x86_64 VPS**，需要 root、可用 Docker Hub 网络及未占用的 3002 端口。

## 一串指令部署

在新 VPS 以 root 执行：

```bash
apt-get update && apt-get install -y git && git clone https://github.com/Xiamufan/sun-panel-vps.git /opt/sun-panel-vps && bash /opt/sun-panel-vps/deploy.sh
```

这是私有仓库。Git 提示用户名时输入 `Xiamufan`，提示密码时输入有该仓库读取权限的 GitHub Personal Access Token（不能用 GitHub 登录密码）。已有 GitHub SSH 认证的机器可将克隆地址换为 `git@github.com:Xiamufan/sun-panel-vps.git`。不要把 token 写进 URL 或命令历史。仓库已克隆时，直接执行最后一条 `bash` 命令。

脚本自动安装缺少的 Docker / Compose / Python，校验迁移包，恢复面板配置与数据库，启动两个容器，验证自定义脚本响应，并安装每天北京时间 08:00（随机延后至多 5 分钟）的壁纸更新任务。Docker 软件包来自 Docker 官方签名软件源。

访问 `http://新VPS地址:3002/`，壁纸库为 `http://新VPS地址:3002/custom/wallpaper-downloads.html`。账号密码沿用原面板；SSH 密码与面板密码是两回事。服务器防火墙或云安全组需允许你使用的面板端口。当前配置提供 HTTP；已有 HTTPS 反向代理可接入该端口。

## 创建 GitHub Token（下载私有仓库）

在 GitHub 登录你的 `Xiamufan` 账号，打开：[创建 Fine-grained Token](https://github.com/settings/personal-access-tokens/new)。

1. **Token name**：填写 `sun-panel-deploy`。
2. **Expiration**：选择 `30 days`。
3. **Resource owner**：选择 `Xiamufan`。
4. **Repository access**：选择 **Only select repositories**，勾选 `sun-panel-vps`。
5. **Permissions → Repository permissions**：将 **Contents** 设置为 **Read-only**。如果没有看到 Contents，先点击 **Add permissions** 添加。
6. 点击 **Generate token**，复制生成的 Token。

运行前面的部署命令，Git 提示登录时按下面填写：

```text
Username for 'https://github.com': Xiamufan
Password for 'https://Xiamufan@github.com': 粘贴刚生成的 Token，然后回车
```

密码输入时不显示字符是正常的。这里使用 Token，不是 GitHub 登录密码，也不是 VPS 的 SSH 密码。Token 仅用于下载私有仓库，不需要发给任何人，也不要写进 README、仓库文件或命令 URL。

Token 过期后，已部署的面板仍可运行；再次从 GitHub 下载或更新仓库时，需要生成新的有效 Token。

参考：[GitHub 官方 Token 创建与使用说明](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)。

## 参数与重复部署

```bash
INSTALL_DIR=/opt/my-panel PANEL_PORT=8080 bash /opt/sun-panel-vps/deploy.sh
```

可选变量：`INSTALL_DIR`（默认 `/opt/sun-panel`）、`PANEL_PORT`（默认 `3002`）、`BIND_ADDRESS`（IPv4，默认 `0.0.0.0`）、`COMPOSE_PROJECT_NAME`（默认 `sun-panel-vps`）、`INSTALL_TIMER=0`（不安装宿主机定时任务）。修改过参数后，重复部署时应带上相同参数。每台 VPS 默认只部署一套；多套需要不同目录、端口、Compose 项目名，并为额外实例手动配置定时任务。

脚本遇到未受本仓库管理的已有部署会退出，防止覆盖。原 VPS 的 `/opt/sun-panel` 属于这种情况，请勿直接用默认目录在原机运行。受管理的部署重跑时先保存一致性数据库备份，再更新脚本和容器，不覆盖数据库、壁纸目录或刷新进度。升级前如需保留自行修改的界面，请额外备份 `conf/custom`，因为部署会同步仓库里的 JS/CSS/HTML。

## 日常管理

```bash
cd /opt/sun-panel
docker compose ps
docker compose logs --tail=100
docker compose restart
python3 grow-wallpapers.py                 # 手动更新壁纸目录
systemctl list-timers sun-panel-vps-wallpaper.timer
journalctl -u sun-panel-vps-wallpaper.service -n 100 --no-pager
bash /opt/sun-panel-vps/scripts/backup.sh /opt/sun-panel
```

数据库备份保存在部署目录 `backups/`。备份恢复会覆盖当前数据，请先备份再停止容器、解压选定备份到部署目录、重新启动：

```bash
cd /opt/sun-panel
docker compose stop
tar -xzf /绝对路径/panel-日期.tar.gz -C /opt/sun-panel
docker compose up -d
```

停止服务用 `docker compose stop`；停止自动更新用 `systemctl disable --now sun-panel-vps-wallpaper.timer`。停止命令保留数据。

## 仓库内容

| 文件 | 用途 |
| --- | --- |
| `deploy.sh`、`compose.yml` | 一键部署、固定原部署镜像摘要 |
| `nginx.conf` | 面板代理、限定 Wallhaven 路径、图片缓存、原图下载 |
| `custom/` | 可读可编辑的当前界面 JS/CSS 与壁纸下载页 |
| `grow-wallpapers.py` | 持续增补作品分类、保存扫描进度、防止重复更新 |
| `scripts/` | Docker 安装、一致性数据库备份 |
| `snapshots/seed.tar.gz` | 当前数据库、配置、自定义文件、4,518 条壁纸目录及刷新进度 |
| `snapshots/source-2026-10-14.tar.gz` | 原机 Sun-Panel 部署原始快照、历史备份及原 systemd 单元 |
| `docs/inventory.json`、`docs/migration.md` | 盘点、迁移说明与验证记录 |
| `tests/` | 壁纸更新器离线验证 |

两个压缩包均附 SHA-256 校验文件。原始快照不参与自动部署，仅用于追溯；可用 `tar -tzf` 查看内容。原图缓存约 260 MB 未纳入版本控制，会按需重建；缓存上限沿用原配置的 512 MB。上游 Docker 镜像不复制进仓库，部署时从 Docker Hub 拉取。

完整快照包含原面板账号密码哈希、登录令牌字段和个人导航配置，**请始终保持此仓库私有**。服务器 SSH 密码、GitHub 凭据均未写入仓库。壁纸更新依赖 Wallhaven 的网络连通性和 API 可用性，失败会写入 `wallpaper-update.json` 与 systemd 日志，已有目录仍可使用。

参考：[Sun-Panel 官方部署文档](https://doc.sun-panel.top/usage/quick_deploy.html)、[官方配置目录迁移说明](https://github.com/hslr-s/sun-panel/discussions/98)、[Docker Ubuntu 安装文档](https://docs.docker.com/engine/install/ubuntu/)、[Docker Debian 安装文档](https://docs.docker.com/engine/install/debian/)。自定义界面与壁纸图片仍遵循各自来源的权利约束。

