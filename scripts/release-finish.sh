#!/usr/bin/env bash
#
# 发布收尾：回到 develop，把版本号设为下一个 -SNAPSHOT 并提交推送。
# 用法：./scripts/release-finish.sh <已发布版本号> [patch|minor|major]   （默认 patch）
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

RELEASED="${1:?缺少已发布版本号，如 0.0.2}"
BUMP="${2:-patch}"
case "$BUMP" in
  patch|minor|major) ;;
  *) echo "版本参数只能是 patch|minor|major" >&2; exit 1 ;;
esac

log() { printf '\033[1;36m[release]\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m[release] 错误:\033[0m %s\n' "$*" >&2; exit 1; }

if [ -n "$(git status --porcelain)" ]; then
  die "工作区有未提交改动，请先提交或暂存"
fi

log "切换到 develop"
git checkout develop
git pull --ff-only origin develop 2>/dev/null || log "develop 无远端跟踪或已最新（忽略 pull）"

NEXT="$(node -e "
const [maj, min, pat] = '$RELEASED'.split('.').map(Number)
let next
if ('$BUMP' === 'major') next = (maj + 1) + '.0.0'
else if ('$BUMP' === 'minor') next = maj + '.' + (min + 1) + '.0'
else next = maj + '.' + min + '.' + (pat + 1)
process.stdout.write(next)
")-SNAPSHOT"

log "设置下一个开发版本: $NEXT"
node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json','utf8'));p.version='$NEXT';fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n')"
git add package.json
git commit -m "chore: next development version $NEXT"
git push origin develop
