#!/usr/bin/env bash
#
# 发布收尾（独立前端仓库）：在 develop 上把版本号 bump 到下一个纯 X.Y.Z 并提交推送。
# 用法：./scripts/release-finish.sh [patch|minor|major]   （默认 patch，或 pnpm release:finish）
#
# 版本号约定见 ./scripts/release-prepare.sh：正式版 X.Y.Z（无 -SNAPSHOT），
# 开发预览版 X.Y.Z-dev.<UTC 时间戳>（见 ./scripts/release-dev.sh）。
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"
PKG_NAME="$(node -p "require('./package.json').name")"

BUMP="${1:-patch}"
case "$BUMP" in
  patch|minor|major) ;;
  *) echo "版本参数只能是 patch|minor|major" >&2; exit 1 ;;
esac

log() { printf '\033[1;36m[release]\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m[release] 错误:\033[0m %s\n' "$*" >&2; exit 1; }

GIT_ROOT="$(git -C "$REPO_ROOT" rev-parse --show-toplevel 2>/dev/null || true)"
if [ "$GIT_ROOT" != "$REPO_ROOT" ]; then
  die "包目录不是 git 仓库根（仓库根: ${GIT_ROOT:-未知}）：混合仓库内的前端包请使用不碰 git 的包级发布流程"
fi

if [ -n "$(git status --porcelain)" ]; then
  die "工作区有未提交改动，请先提交或暂存"
fi

CURRENT="$(node -p "require('./package.json').version")"
RELEASED="${CURRENT%%-*}"
log "已发布版本: $RELEASED（来自 package.json，$PKG_NAME）"

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
")"

log "设置下一个开发版本: $NEXT"
node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json','utf8'));p.version='$NEXT';fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n')"
git add package.json
git commit -m "chore: next development version $NEXT"
git push origin develop
log "完成：develop 上版本为 $NEXT（无预发布后缀，发布时直接以 latest 发布）。"
