# Git Repository Workflow

## Purpose

This specification defines the git workflow for this project.

**Project constraint**: This project requires linear history. No merge commits allowed in master branch history.

---

## Integration Requirements

### Goal

Integrate a branch into master while preserving linear history.

### Requirements

- Master must be up-to-date before integration
- Integration branch must be rebased onto latest master
- Only fast-forward merge allowed (no merge commits)
- Verify linear history after integration: `git log --oneline --graph` shows straight line

### Boundaries

- Never create merge commits
- Never force-push to master
- Never integrate without verification

### Reliable Approach

A reliable approach to meet these requirements:

1. Update master to latest: `git checkout master && git pull`
2. Rebase branch onto master: `git checkout <branch> && git rebase master`
3. Fast-forward merge: `git checkout master && git merge --ff-only <branch>`
4. Verify linear history: `git log --oneline --graph`
5. Push to remote: `git push origin master`

If fast-forward merge fails (master has advanced), repeat from step 1.

### Conflict Resolution

If rebase encounters conflicts:

1. Resolve conflicts in affected files
2. Stage resolved files: `git add <files>`
3. Continue rebase: `git rebase --continue`
4. If conflicts are too complex, abort and escalate: `git rebase --abort`

---

## Integration Evidence and Cleanup

### Integration Evidence Requirement

Integration is complete only when:

- The commit is visible in `git log` on master branch
- Linear history is verified: `git log --oneline --graph` shows straight line
- No merge commits exist

Do not report integration complete until repository evidence confirms the commit exists in master history.

### Cleanup After Integration

After successful integration and verification:

1. Remove the integrated worktree: `git worktree remove <worktree-path>`
2. Remove the local integration branch: `git branch -d <branch>`
3. Verify cleanup: `git worktree list` should not show the removed worktree

