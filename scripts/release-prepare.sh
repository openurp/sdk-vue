#!/usr/bin/env bash
#
# 发布准备：develop → main 合并 + 测试门禁 + 版本号提升。
# 用法：./scripts/release-prepare.sh [patch|minor|major]   （默认 patch）
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

BUMP="${1:-patch}"
case "$BUMP" in
  patch|minor|major) ;;
  *) echo "版本参数只能是 patch|minor|major" >&2; exit 1 ;;
esac

log() { printf '\033[1;36m[release]\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m[release] 错误:\033[0m %s\n' "$*" >&2; exit 1; }

# 1. 工作区必须干净
if [ -n "$(git status --porcelain)" ]; then
  die "工作区有未提交改动，请先提交或暂存"
fi

START_BRANCH="$(git branch --show-current)"
log "当前分支: $START_BRANCH"

# 2. 确保 develop 最新
if [ "$START_BRANCH" != "develop" ]; then
  log "切换到 develop"
  git checkout develop
fi
git pull --ff-only origin develop 2>/dev/null || log "develop 无远端跟踪或已最新（忽略 pull）"

# 3. 切到 main 并合并 develop（保留发布合并记录）
log "切换到 main 并合并 develop"
git checkout main
git pull --ff-only origin main 2>/dev/null || log "main 无远端跟踪或已最新（忽略 pull）"
if ! git merge --no-ff develop -m "release: merge develop into main"; then
  git checkout "$START_BRANCH" 2>/dev/null || true
  die "合并冲突，请手动处理（git merge --abort 后处理冲突）"
fi

# 4. 测试门禁：失败则回滚合并并回到原分支
log "运行测试: pnpm test"
if ! pnpm test; then
  log "测试未通过，回滚合并"
  git merge --abort
  git checkout "$START_BRANCH" 2>/dev/null || true
  die "测试未通过，已回滚并回到 $START_BRANCH"
fi

# 5. 在 main 上提升版本号（自动打 tag）
log "提升版本号: npm version $BUMP"
npm version "$BUMP"

log "发布准备完成，当前在 main 分支。后续步骤："
log "  1. pnpm publish（prepublishOnly 会自动构建）"
log "  2. git push origin main && git push origin --tags"
log "  3. git checkout develop && git merge main（回合并到 develop）"
