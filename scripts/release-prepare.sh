#!/usr/bin/env bash
#
# 正式版本发布准备（独立前端仓库）：
#   develop 上构建/测试/发布 dry-run 通过 → 合并 develop 到 main → 打 tag v<X.Y.Z> → push。
# 用法：./scripts/release-prepare.sh        （或 pnpm release:prepare）
# 可用环境变量覆盖：BUILD_CMD / TEST_CMD / DRY_RUN_CMD
#
# 版本号约定（npm/semver）：package.json 里是「下一个正式版号」的纯 X.Y.Z，没有 -SNAPSHOT；
# 开发预览版由 ./scripts/release-dev.sh 生成 X.Y.Z-dev.<UTC 时间戳>，以 dist-tag `dev` 发布，
# `latest` 只给正式版。
#
# 本脚本会做 git 操作（checkout / merge / tag / push），只适用于**独立前端仓库**
#（包目录就是 git 仓库根）。若包位于混合仓库的 packages/ 下（仓库还承载 Scala 等其它产物、
# 有自己的 tag 序列），请改用不碰 git 的包级流程，不要复制本脚本。
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"
PKG_NAME="$(node -p "require('./package.json').name")"

BUILD_CMD="${BUILD_CMD:-pnpm build}"
TEST_CMD="${TEST_CMD:-pnpm test}"
DRY_RUN_CMD="${DRY_RUN_CMD:-pnpm publish --dry-run --no-git-checks}"

log() { printf '\033[1;36m[release]\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m[release] 错误:\033[0m %s\n' "$*" >&2; exit 1; }

GIT_ROOT="$(git -C "$REPO_ROOT" rev-parse --show-toplevel 2>/dev/null || true)"
if [ "$GIT_ROOT" != "$REPO_ROOT" ]; then
  die "包目录不是 git 仓库根（仓库根: ${GIT_ROOT:-未知}）：混合仓库内的前端包请使用不碰 git 的包级发布流程"
fi

VERSION="$(node -p "require('./package.json').version")"
if node -e "const d=require('./package.json').dependencies||{};process.exit(Object.values(d).some(v=>/^(link|file):/.test(String(v)))?0:1)"; then
  die "package.json 的 dependencies 仍有 link:/file: 本地路径，请改成正式版本号后再发布"
fi
case "$VERSION" in
  *-*) die "package.json 版本 $VERSION 带预发布后缀；正式发布要求纯 X.Y.Z（开发预览请用 ./scripts/release-dev.sh）" ;;
  [0-9]*.[0-9]*.[0-9]*) ;;
  *) die "package.json 版本 $VERSION 不是 X.Y.Z 形式" ;;
esac
log "待发布: $PKG_NAME@$VERSION"

if [ -n "$(git status --porcelain)" ]; then
  die "工作区有未提交改动，请先提交或暂存"
fi
if git rev-parse -q --verify "refs/tags/v$VERSION" >/dev/null; then
  die "tag v$VERSION 已存在：同号重发在 npm 体系里会让消费方卡在旧内容，请改版本号"
fi

log "检查 $PKG_NAME@$VERSION 是否已在 registry 上存在"
if npm view "$PKG_NAME@$VERSION" version >/dev/null 2>&1; then
  die "$PKG_NAME@$VERSION 已存在于 registry：npm 不允许同号重发（消费方的 lockfile/store 会卡在旧字节），请先 bump 版本号"
fi

START_BRANCH="$(git branch --show-current)"
if [ "$START_BRANCH" != "develop" ]; then
  log "切换到 develop"
  git checkout develop
fi
log "更新 develop 并确保最新"
if ! git pull --ff-only origin develop; then
  die "develop 无法快进更新（本地与远端分叉或拉取失败），发布停止"
fi

log "构建门禁: $BUILD_CMD"
$BUILD_CMD
log "测试门禁: $TEST_CMD"
$TEST_CMD
log "发布 dry-run: $DRY_RUN_CMD"
$DRY_RUN_CMD

log "切换到 main 并合并 develop"
git checkout main
git pull --ff-only origin main 2>/dev/null || log "main 无远端跟踪或已最新（忽略 pull）"
if ! git merge develop -m "release: v$VERSION"; then
  git checkout develop 2>/dev/null || true
  die "合并冲突，请手动处理（git merge --abort 后处理冲突）"
fi

log "打 tag v$VERSION 并推送"
git tag "v$VERSION"
git push origin main
git push origin "v$VERSION"

log "发布准备完成，当前在 main 分支。后续："
log "  1. pnpm publish --tag latest（发布正式版本 v$VERSION）"
log "  2. 发布完成后执行 ./scripts/release-finish.sh <patch|minor|major>（在 develop 上把版本号 bump 到下一个 X.Y.Z）"
