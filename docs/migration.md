# 迁移记录

源环境：Ubuntu 24.04.4 LTS / x86_64。原目录 `/opt/sun-panel`，原端口 3002，容器 `sun-panel` 与 `sun-panel-web`。原 systemd 单元 `sun-wallpaper-refresh.service` / `.timer`，每日北京时间 08:00。

数据库通过 SQLite online backup 获取一致性副本，`PRAGMA integrity_check` 返回 `ok`。备份含 155 个导航项、15 个分组、1 个面板账号、4,518 条壁纸目录；未发现其他路径中的 Sun-Panel 部署或 cron 任务。原目录 `backups/`、旧脚本、备用 compose 与 systemd 单元保留在原始快照里。容器没有额外挂载独立 uploads 或 database 目录，均沿用 `/app/conf` 布局。

迁移修正：

1. 壁纸下载页面使用 `location.origin`，适配新 IP、域名、HTTP/HTTPS 与自定义端口。
2. 更新器以自身所在目录或 `SUN_PANEL_DIR` 环境变量定位数据，去掉固定 `/opt/sun-panel` 路径。
3. Compose 不固定容器名称，允许使用独立项目测试，固定原机镜像摘要以保持版本一致。
4. 定时任务由部署脚本按目标目录生成。
5. 重复部署先备份，未识别的已有部署不覆盖。

迁移包保留原面板账号与全部个人配置。未迁移整台 VPS 的系统文件、SSH 凭据或其他服务。Nginx 的可重建图片缓存、Python 字节码与瞬时锁文件未纳入快照。

验证结果见 `verification.txt`。验证在原 VPS 独立目录、独立 Compose 项目、仅本地访问的 13002 端口运行。原 3002 端口上的服务保持运行。本次没有第二台 VPS，也没有对干净系统安装 Docker 的实机验证；自动安装分支依据官方安装步骤编写。
