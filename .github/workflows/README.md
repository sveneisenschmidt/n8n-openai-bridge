# GitHub Actions Workflows

This directory contains the CI/CD workflows for the n8n OpenAI Bridge project.

## Workflows

### 1. CI Workflow (`ci.yml`)

**Triggers:**
- Push to `main` branch
- Push to feature branches (`feature/**`, `fix/**`, `hotfix/**`)
- Pull requests to `main`

**Jobs:**

#### Test
- Runs unit tests with coverage
- Uploads coverage to Codecov (if configured)
- Node.js version: 20

#### Lint
- Code style checks
- Can be extended with ESLint

#### Docker Build
- Builds Docker image for testing
- Runs health check validation
- Uses GitHub Actions cache for faster builds

#### Security Scan
- Scans codebase for vulnerabilities using Trivy
- Uploads results to GitHub Security tab

### 2. Release Workflow (`release.yml`)

**Triggers:**
- GitHub Release published

**Jobs:**

#### Build and Push
- Builds Docker image for multiple platforms (amd64, arm64)
- Pushes to GitHub Container Registry (ghcr.io)
- Creates semantic version tags:
  - Full version (e.g., `1.0.0`)
  - Major.Minor (e.g., `1.0`)
  - Major (e.g., `1`)
  - `latest` (for default branch)
- Updates release notes with Docker instructions

**Required Permissions:**
- `contents: read` - Read repository contents
- `packages: write` - Push to GitHub Container Registry

## Branch Strategy

### Main Branch
- Protected branch (requires PR and passing CI)
- All releases are tagged from this branch
- Direct pushes should be disabled

### Feature Branches
- Naming convention: `feature/description`
- Example: `feature/add-rate-limiting`
- CI runs automatically on push
- Requires PR to merge to main

### Fix Branches
- Naming convention: `fix/description`
- Example: `fix/session-id-detection`
- For bug fixes
- CI runs automatically on push

### Hotfix Branches
- Naming convention: `hotfix/description`
- Example: `hotfix/security-patch`
- For urgent production fixes
- CI runs automatically on push

## Creating a Release

### 1. Prepare the Release

Update version in relevant files:
```bash
# Update CHANGELOG.md with new version and changes
nano CHANGELOG.md

# Commit changes
git add CHANGELOG.md
git commit -m "Prepare release v1.0.0"
git push origin main
```

### 2. Create a GitHub Release

#### Option A: GitHub UI
1. Go to repository → Releases → "Draft a new release"
2. Click "Choose a tag" → Enter new tag (e.g., `v1.0.0`)
3. Target: `main` branch
4. Release title: `v1.0.0` (or descriptive name)
5. Description: Copy from CHANGELOG.md
6. Click "Publish release"

#### Option B: GitHub CLI
```bash
gh release create v1.0.0 \
  --title "Version 1.0.0" \
  --notes "$(cat CHANGELOG.md | sed -n '/## \[1.0.0\]/,/## \[/p' | head -n -1)"
```

### 3. Automatic Process

After publishing the release:
1. ✅ Release workflow triggers automatically
2. ✅ Docker image builds for amd64 and arm64
3. ✅ Image pushed to `ghcr.io/[owner]/n8n-openai-bridge`
4. ✅ Tagged with version and `latest`
5. ✅ Release notes updated with Docker instructions

### 4. Verify the Release

```bash
# Pull the new image
docker pull ghcr.io/[owner]/n8n-openai-bridge:v1.0.0

# Test it
docker run -d \
  --name test-bridge \
  -p 3333:3333 \
  -e BEARER_TOKEN=test-token \
  ghcr.io/[owner]/n8n-openai-bridge:v1.0.0

# Check health
curl http://localhost:3333/health

# Cleanup
docker stop test-bridge && docker rm test-bridge
```

## Docker Image Tags

After release `v1.0.0`, the following tags are available:

- `ghcr.io/[owner]/n8n-openai-bridge:1.0.0` - Full version
- `ghcr.io/[owner]/n8n-openai-bridge:1.0` - Major.Minor
- `ghcr.io/[owner]/n8n-openai-bridge:1` - Major only
- `ghcr.io/[owner]/n8n-openai-bridge:latest` - Latest release

## Recommended Branch Protection Rules

Configure in GitHub Settings → Branches → Branch protection rules:

### Main Branch
- ✅ Require a pull request before merging
- ✅ Require approvals: 1
- ✅ Dismiss stale pull request approvals when new commits are pushed
- ✅ Require status checks to pass before merging:
  - `test`
  - `docker-build`
  - `lint`
  - `security-scan`
- ✅ Require branches to be up to date before merging
- ✅ Require conversation resolution before merging
- ✅ Do not allow bypassing the above settings

## Secrets Configuration

No secrets are required for the basic setup! The workflow uses `GITHUB_TOKEN` which is automatically provided.

### Optional Secrets

#### Codecov (Optional)
If you want code coverage reporting:
1. Sign up at https://codecov.io
2. Add repository
3. Add `CODECOV_TOKEN` secret in GitHub Settings → Secrets

## Troubleshooting

### Docker Push Fails
**Error:** "permission denied"
**Solution:** Ensure workflow has `packages: write` permission

### Image Not Found
**Error:** "manifest unknown"
**Solution:** Check if image is public in Package settings

### Make Image Public
1. Go to repository → Packages
2. Click on the package
3. Package settings → Change visibility → Public

## Local Testing

Test workflows locally with [act](https://github.com/nektos/act):

```bash
# Install act
brew install act  # macOS
# or
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

# Test CI workflow
act push

# Test release workflow (dry run)
act release --secret-file .secrets
```
