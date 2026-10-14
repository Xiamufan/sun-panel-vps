#!/usr/bin/env bash
set -Eeuo pipefail
[[ $EUID -eq 0 ]] || { echo 'Please run as root.' >&2; exit 1; }
if command -v docker >/dev/null && docker compose version >/dev/null 2>&1; then
  systemctl start docker
  docker info >/dev/null
  exit 0
fi
source /etc/os-release
case "$ID" in ubuntu|debian) ;; *) echo 'Automatic Docker installation supports Debian/Ubuntu.' >&2; exit 1;; esac
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL "https://download.docker.com/linux/$ID/gpg" -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
arch=$(dpkg --print-architecture)
codename=${UBUNTU_CODENAME:-$VERSION_CODENAME}
printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/%s %s stable\n' "$arch" "$ID" "$codename" > /etc/apt/sources.list.d/docker.list
apt-get update
if command -v docker >/dev/null; then
  apt-get install -y docker-compose-plugin
else
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker
docker compose version
docker info >/dev/null
