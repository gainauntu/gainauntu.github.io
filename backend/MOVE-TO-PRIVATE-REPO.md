# Moving the backend to a private repository (optional, your decision)

Why: the site repository is public and served by GitHub Pages. The backend contains no secrets, but a private repository
keeps its code, issues and future operational notes out of public view. Note: this branch has already been pushed to the
public repository, so the current code is already public; moving it changes where future work happens, not the past.

Nothing below has been run. Creating a repository needs your GitHub account; I have not created one.

1. On GitHub create an **empty private** repository, for example `gainauntu/gainauntu-inquiry-backend` (no README,
   no licence, no .gitignore).
2. From any clone of `gainauntu.github.io`:
   ```
   git fetch origin phase5/inquiry-backend
   git subtree split --prefix=backend FETCH_HEAD -b backend-only
   git push https://github.com/gainauntu/gainauntu-inquiry-backend.git backend-only:main
   git branch -D backend-only
   ```
   Rehearsed locally on the branch as of commit `020dda3`: the result is one commit with the same author, date and message,
   with `backend/` as the repository root (`README.md`, `src/`, `migrations/`, `test/`, both `wrangler.*.toml`, …).
   Later commits on the branch produce more commits; the hash changes with them.
3. In the new repository: `npm ci && npm test`, then follow `PRODUCTION-CHECKLIST.md`.
4. Close draft PR #3 **without merging** and, if you like, delete the `phase5/inquiry-backend` branch. The site repository
   then never contains `backend/`.
5. Optional: in the private repository add the Cloudflare deploy as a GitHub Actions workflow with a scoped
   `CLOUDFLARE_API_TOKEN` repository secret (Workers Scripts:Edit, D1:Edit). Not prepared here.
