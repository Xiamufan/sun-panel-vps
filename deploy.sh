#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
[[ $EUID -eq 0 ]] || { echo 'Please run as root.' >&2; exit 1; }
repo=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
target=${INSTALL_DIR:-/opt/sun-panel}
port=${PANEL_PORT:-3002}
bind=${BIND_ADDRESS:-0.0.0.0}
project=${COMPOSE_PROJECT_NAME:-sun-panel-vps}
timer=${INSTALL_TIMER:-1}
[[ $(uname -m) == x86_64 ]] || { echo 'This snapshot pins amd64 images; use an x86_64 VPS.' >&2; exit 1; }
[[ $target =~ ^/[a-zA-Z0-9/_-]+$ && $target != / ]] || { echo 'INSTALL_DIR must be a simple absolute path.' >&2; exit 1; }
[[ $port =~ ^[0-9]+$ ]] && ((10#$port >= 1 && 10#$port <= 65535)) || { echo 'Invalid PANEL_PORT.' >&2; exit 1; }
[[ $bind =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo 'BIND_ADDRESS must be IPv4.' >&2; exit 1; }
[[ $project =~ ^[a-z0-9][a-z0-9_-]*$ ]] || { echo 'Invalid COMPOSE_PROJECT_NAME.' >&2; exit 1; }
[[ $timer == 0 || $timer == 1 ]] || { echo 'INSTALL_TIMER must be 0 or 1.' >&2; exit 1; }
install -d -m 700 "$target"
target=$(realpath "$target")
exec 9>"$target/.deploy.lock"
flock -n 9 || { echo 'Another deployment is running.' >&2; exit 1; }
if [[ -d $target/conf || -f $target/compose.yml || -f $target/.env ]]; then
  [[ -f $target/.managed-by-sun-panel-vps ]] || { echo "Refusing to overwrite existing deployment: $target. Use another INSTALL_DIR." >&2; exit 1; }
fi
bash "$repo/scripts/install-docker.sh"
command -v python3 >/dev/null || { apt-get update; apt-get install -y python3; }
command -v curl >/dev/null || { apt-get update; apt-get install -y curl; }
if [[ ! -f $target/.managed-by-sun-panel-vps ]]; then
  (cd "$repo/snapshots"; sha256sum -c seed.tar.gz.sha256)
  [[ ! -d $target/conf ]] || { echo 'Existing configuration cannot be overwritten.' >&2; exit 1; }
  tar -xzf "$repo/snapshots/seed.tar.gz" -C "$target"
  touch "$target/.managed-by-sun-panel-vps"
else
  [[ -d $target/conf ]] || { echo 'Managed directory lost conf; restore a backup first.' >&2; exit 1; }
  bash "$repo/scripts/backup.sh" "$target"
fi
install -d -m 755 "$target/conf/custom" "$target/wallpaper-cache"
for name in compose.yml nginx.conf grow-wallpapers.py; do
  [[ $repo/$name == "$target/$name" ]] || install -m 644 "$repo/$name" "$target/$name"
done
install -m 644 "$repo"/custom/* "$target/conf/custom/"
printf 'PANEL_PORT=%s\nBIND_ADDRESS=%s\nCOMPOSE_PROJECT_NAME=%s\n' "$port" "$bind" "$project" > "$target/.env"
chmod 600 "$target/.env"
cd "$target"
docker compose config --quiet
docker compose pull
docker compose up -d
ready=0
check_address=$bind
[[ $bind != 0.0.0.0 ]] || check_address=127.0.0.1
for attempt in $(seq 1 60); do
  if curl --noproxy '*' -fsS "http://$check_address:$port/custom/index.js" 2>/dev/null | grep -q anime-wallpaper; then ready=1; break; fi
  sleep 2
done
((ready)) || { docker compose ps; echo 'Startup check failed. Inspect docker compose logs.' >&2; exit 1; }
docker compose exec -T panel-web nginx -t
if [[ $timer == 1 ]]; then
  cat > /etc/systemd/system/sun-panel-vps-wallpaper.service <<EOF
[Unit]
Description=Update Sun-Panel wallpaper catalog
After=network-online.target
Wants=network-online.target
[Service]
Type=oneshot
Environment="SUN_PANEL_DIR=$target"
ExecStart=/usr/bin/python3 $target/grow-wallpapers.py
User=root
Nice=10
TimeoutStartSec=3600
EOF
  cat > /etc/systemd/system/sun-panel-vps-wallpaper.timer <<'EOF'
[Unit]
Description=Daily wallpapers at 08:00 Asia/Shanghai
[Timer]
OnCalendar=*-*-* 08:00:00 Asia/Shanghai
Persistent=true
RandomizedDelaySec=5min
Unit=sun-panel-vps-wallpaper.service
[Install]
WantedBy=timers.target
EOF
  systemctl daemon-reload
  systemctl enable --now sun-panel-vps-wallpaper.timer
fi
echo "Deployment ready. Visit http://<VPS-IP>:$port/ (bind address $bind)."
echo "Wallpaper library: http://<VPS-IP>:$port/custom/wallpaper-downloads.html"
echo "Data: $target. Panel login is preserved from the source snapshot."
