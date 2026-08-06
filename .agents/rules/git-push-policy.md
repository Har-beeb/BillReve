---
description: Rule to enforce waiting for local builds to succeed before pushing to git.
---

# Git Push Policy
- **Never push code while a build is running:** Always wait for local build commands (like `npm run build` or compilation tasks) to completely finish before executing `git push`.
- **Require successful builds:** Only execute `git push` if the build command succeeded (exit code 0). If the build fails, fix the errors and rebuild until successful before pushing to the remote repository.
