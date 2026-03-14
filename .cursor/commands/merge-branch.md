---
description: 拉取远端分支并合并到当前分支
argument-hint: <branch-name>
---

将参数中的分支名记为 `BRANCH`，执行以下流程：

1. 先确认当前目录是 git 仓库，并输出当前分支名。
2. 执行 `git fetch origin BRANCH`。
3. 执行 `git merge origin/BRANCH` 合并到当前分支。
4. 输出最终 `git status -sb`。

要求：
- 不要改 git config。
- 不要使用 destructive 命令（如 reset --hard）。
- 如果出现冲突，停止并明确列出冲突文件。
- 若未提供分支名，先提示用户提供。
