#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
target=${1:-/opt/sun-panel}
[[ -f $target/.managed-by-sun-panel-vps ]] || { echo 'Not a managed deployment.' >&2; exit 1; }
target=$(realpath "$target")
install -d -m 700 "$target/backups"
stage=$(mktemp -d)
trap 'rm -rf -- "$stage"' EXIT
cp -a "$target/conf" "$stage/conf"
[[ ! -f $target/wallpaper-state.json ]] || cp "$target/wallpaper-state.json" "$stage/"
python3 - "$target" "$stage" <<'PY'
import sqlite3,sys,pathlib
src=pathlib.Path(sys.argv[1])/'conf/database/database.db'
dst=pathlib.Path(sys.argv[2])/'conf/database/database.db'
dst.unlink(missing_ok=True)
with sqlite3.connect(f'file:{src}?mode=ro',uri=True) as a,sqlite3.connect(dst) as b:
    a.backup(b)
    assert b.execute('pragma integrity_check').fetchone()[0]=='ok'
PY
file="$target/backups/panel-$(date -u +%Y%m%dT%H%M%S)-$$.tar.gz"
tar -C "$stage" -czf "$file" .
sha256sum "$file" > "$file.sha256"
echo "Backup saved: $file"
