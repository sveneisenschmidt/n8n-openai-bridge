# Release Process

This document describes the complete release process for n8n OpenAI Bridge, including Docker image publishing to GitHub Container Registry.

## Quick Reference

```bash
# Check current version
make version

# Prepare new release
make release-prepare NEW_VERSION=0.0.4

# Create git tag (after commit & push)
make release-tag

# Create GitHub Release (triggers Docker image build)
gh release create v0.0.4 --title "Version 0.0.4" --notes-file CHANGELOG.md
```

## Prerequisites

- Git repository clean (no uncommitted changes)
- All changes merged to `main` branch
- Tests passing (`make test`)
- GitHub CLI installed (optional, for `gh` commands - see [Installation](#github-cli-installation) below)

## Release Workflow

### Step 1: Prepare Release

```bash
# Run release preparation
make release-prepare NEW_VERSION=0.0.4
```

This command:
1. Shows current and new version
2. Asks for confirmation
3. Updates `VERSION` file
4. Optionally opens `CHANGELOG.md` for editing

**Manual steps after `make release-prepare`:**

1. Edit `CHANGELOG.md` and add release notes:
   ```markdown
   ## [0.0.4] - 2025-10-15

   ### Added
   - New feature XYZ

   ### Changed
   - Updated ABC

   ### Fixed
   - Fixed issue #123
   ```

2. Commit changes:
   ```bash
   git add VERSION CHANGELOG.md
   git commit -m "Prepare release v0.0.4"
   ```

3. Push to GitHub:
   ```bash
   git push origin main
   ```

### Step 2: Check Release Readiness

```bash
make release-check
```

This validates:
- OK VERSION file exists and is valid
- OK No uncommitted changes
- OK Branch synced with origin/main
- OK Tag doesn't exist yet
- OK Version documented in CHANGELOG.md

### Step 3: Create Git Tag

```bash
make release-tag
```

This command:
1. Runs `release-check` validation
2. Shows what will happen
3. Asks for confirmation
4. Creates annotated git tag (`v0.0.4`)
5. Pushes tag to origin
6. Shows next steps

**Note:** Pushing the tag does NOT trigger the release workflow yet.

### Step 4: Create GitHub Release

#### Option A: GitHub CLI (Recommended)

```bash
gh release create v0.0.4 \
  --title "Version 0.0.4" \
  --notes-file CHANGELOG.md
```

Or with specific notes:
```bash
gh release create v0.0.4 \
  --title "Version 0.0.4" \
  --notes "Bug fixes and improvements"
```

#### Option B: GitHub Web UI

1. Go to: https://github.com/sveneisenschmidt/n8n-openai-bridge/releases/new
2. Select tag: `v0.0.4` (should exist from Step 3)
3. Release title: `Version 0.0.4`
4. Description: Copy from CHANGELOG.md
5. Click "Publish release"

### Step 5: Automated CI/CD

Once the GitHub Release is published:

1. **GitHub Actions Workflow Triggered** (`.github/workflows/release.yml`)
   - Checks out code
   - Extracts version from tag (`v0.0.4` → `0.0.4`)
   - Builds Docker image for multiple platforms (amd64, arm64)

2. **Docker Images Created & Tagged**
   ```
   ghcr.io/sveneisenschmidt/n8n-openai-bridge:0.0.4
   ghcr.io/sveneisenschmidt/n8n-openai-bridge:0.0
   ghcr.io/sveneisenschmidt/n8n-openai-bridge:0
   ghcr.io/sveneisenschmidt/n8n-openai-bridge:latest
   ```

3. **Images Pushed to GitHub Container Registry**
   - Automatically pushed with all tags
   - Available at: https://github.com/sveneisenschmidt/n8n-openai-bridge/pkgs/container/n8n-openai-bridge

4. **Release Notes Updated**
   - GitHub Actions adds Docker pull instructions to release

### Step 6: Verify Release

```bash
# Check GitHub Actions
# Visit: https://github.com/sveneisenschmidt/n8n-openai-bridge/actions

# Pull and test Docker image
docker pull ghcr.io/sveneisenschmidt/n8n-openai-bridge:0.0.4

# Verify version in container
docker run --rm ghcr.io/sveneisenschmidt/n8n-openai-bridge:0.0.4 cat /app/VERSION
# Expected: 0.0.4

# Test container startup
docker run --rm -d --name test-release \
  -e BEARER_TOKEN=test \
  ghcr.io/sveneisenschmidt/n8n-openai-bridge:0.0.4

# Check logs for version
docker logs test-release | grep "n8n OpenAI Bridge"
# Expected: n8n OpenAI Bridge v0.0.4

# Cleanup
docker stop test-release
```

## Make Commands

### `make version`
Shows current version from VERSION file.

```bash
$ make version
Current version: 0.0.3

This version is read from the VERSION file.
To update, run: make release-prepare NEW_VERSION=x.y.z
```

### `make release-check`
Validates release readiness (no commit required).

```bash
$ make release-check
Checking release readiness...

Current version: 0.0.3

OK VERSION file exists: 0.0.3
OK No uncommitted changes
OK Branch in sync with origin/main
OK Tag v0.0.3 does not exist yet
OK Version 0.0.3 documented in CHANGELOG.md

Ready for release!
```

### `make release-prepare NEW_VERSION=x.y.z`
Prepares a new release by updating VERSION file.

```bash
$ make release-prepare NEW_VERSION=0.0.4
Preparing release 0.0.4...

Current version: 0.0.3
New version: 0.0.4

Continue? [y/N] y
OK Updated VERSION file to 0.0.4

Next steps:
1. Update CHANGELOG.md with version 0.0.4 and changes
2. Run: git add VERSION CHANGELOG.md
3. Run: git commit -m 'Prepare release v0.0.4'
4. Run: git push origin main
5. Run: make release-tag

Or open CHANGELOG.md now? [y/N]
```

### `make release-tag`
Creates and pushes git tag for current version.

```bash
$ make release-tag
Creating release tag for version 0.0.4...

[runs release-check first]

This will:
  1. Create git tag: v0.0.4
  2. Push tag to origin
  3. Trigger GitHub Actions to build and publish Docker images

Continue? [y/N] y
OK Created tag v0.0.4
OK Pushed tag to origin

Tag created successfully!

Next step: Create GitHub Release
  Run: gh release create v0.0.4 --title 'Version 0.0.4' --notes-file CHANGELOG.md
  Or visit: https://github.com/sveneisenschmidt/n8n-openai-bridge/releases/new?tag=v0.0.4
```

## Version Management

### VERSION File

The `VERSION` file is the single source of truth for the project version.

**Format:**
```
0.0.4
```

- Plain text file
- Single line
- Semantic versioning: `MAJOR.MINOR.PATCH`
- No `v` prefix
- No trailing whitespace

### Git Tags

Git tags follow the format: `v<VERSION>`

Examples:
- VERSION file: `0.0.4`
- Git tag: `v0.0.4`

### Docker Tags

Docker images are tagged automatically by GitHub Actions:

| Tag Format | Example | Description |
|------------|---------|-------------|
| `MAJOR.MINOR.PATCH` | `0.0.4` | Specific version |
| `MAJOR.MINOR` | `0.0` | Latest patch version |
| `MAJOR` | `0` | Latest minor version |
| `latest` | `latest` | Latest release |

## Release Checklist

Use this checklist when creating a new release:

- [ ] All features/fixes merged to `main`
- [ ] Tests passing (`make test`)
- [ ] Branch synced with origin
- [ ] No uncommitted changes
- [ ] Run: `make release-prepare NEW_VERSION=x.y.z`
- [ ] Update `CHANGELOG.md` with version and changes
- [ ] Commit: `git commit -m "Prepare release vx.y.z"`
- [ ] Push: `git push origin main`
- [ ] Run: `make release-check` (validate)
- [ ] Run: `make release-tag` (create & push tag)
- [ ] Create GitHub Release (triggers CI/CD)
- [ ] Monitor GitHub Actions workflow
- [ ] Verify Docker images published
- [ ] Test released Docker image
- [ ] Update project documentation if needed
- [ ] Announce release (if applicable)

## Hotfix Releases

For urgent fixes:

1. Create hotfix branch from `main`:
   ```bash
   git checkout -b hotfix/critical-fix main
   ```

2. Make fix and test:
   ```bash
   # Fix code
   make test
   ```

3. Merge to main:
   ```bash
   git checkout main
   git merge hotfix/critical-fix
   git push origin main
   ```

4. Follow normal release process (Steps 1-6)

## Rollback

If a release has critical issues:

### Option 1: New Patch Release

```bash
# Fix the issue
git checkout -b fix/critical-issue
# Make fixes
git commit -m "Fix: critical issue"
git push origin fix/critical-issue
# Create PR, merge

# Release new version
make release-prepare NEW_VERSION=0.0.5
# Follow normal release process
```

### Option 2: Point `latest` to Previous Version

This requires manual Docker tag manipulation (not automated).

## Troubleshooting

### Release Check Fails

**Problem:** `make release-check` shows errors

**Solution:**
- Uncommitted changes: `git status` and commit/stash changes
- Out of sync: `git pull origin main` and `git push origin main`
- Tag exists: Version already released, increment version
- Not in CHANGELOG: Add version section to CHANGELOG.md

### GitHub Actions Fails

**Problem:** Docker build or push fails in Actions

**Solution:**
1. Check Actions tab for error logs
2. Common issues:
   - Permissions: Ensure workflow has `packages: write`
   - Dockerfile syntax: Test locally with `docker build .`
   - Dependencies: Check if all files copied correctly

### Docker Image Not Found

**Problem:** `docker pull` fails after release

**Solution:**
1. Check if GitHub Actions workflow completed
2. Verify package visibility is set to Public:
   - Go to: https://github.com/sveneisenschmidt/n8n-openai-bridge/pkgs/container/n8n-openai-bridge
   - Click "Package settings"
   - Change visibility to "Public" if needed

### Wrong Version in Container

**Problem:** Container shows wrong version

**Solution:**
1. Verify VERSION file was committed before tagging
2. Check GitHub Actions build logs
3. Rebuild: Delete tag, fix VERSION, re-tag

## GitHub CLI Installation

The GitHub CLI (`gh`) is optional but recommended for streamlined release creation.

### macOS

**Via Homebrew (Recommended):**
```bash
brew install gh
```

**Via MacPorts:**
```bash
sudo port install gh
```

### Linux

**Debian/Ubuntu:**
```bash
sudo apt install gh
```

**Fedora/CentOS/RHEL:**
```bash
sudo dnf install gh
```

**Arch Linux:**
```bash
sudo pacman -S github-cli
```

### Windows

**Via Winget:**
```bash
winget install --id GitHub.cli
```

**Via Chocolatey:**
```bash
choco install gh
```

### Authentication

After installation, authenticate with GitHub:

```bash
gh auth login
```

Follow the interactive prompts:
1. Select **GitHub.com**
2. Choose **HTTPS** as protocol
3. Select **Login with a web browser**
4. Copy the one-time code shown
5. Press Enter to open browser
6. Paste the code and authorize

**Verify authentication:**
```bash
gh auth status
```

### Usage for Releases

Once authenticated, you can create releases directly from the command line:

```bash
# Create release with auto-generated notes
gh release create v0.0.5 --title "Version 0.0.5" --generate-notes

# Create release with specific notes
gh release create v0.0.5 --title "Version 0.0.5" --notes "Bug fixes and improvements"

# Create release with notes from CHANGELOG
gh release create v0.0.5 --title "Version 0.0.5" --notes-file CHANGELOG.md
```

**Alternative:** You can always use the GitHub web interface instead of the CLI.

## Support

For questions or issues with the release process:
- Open an issue: https://github.com/sveneisenschmidt/n8n-openai-bridge/issues
- Check Actions logs: https://github.com/sveneisenschmidt/n8n-openai-bridge/actions
