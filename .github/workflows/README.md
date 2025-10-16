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

### 2. Release on Merge Workflow (`release-on-merge.yml`)

**Triggers:**
- Pull request closed and merged to `main` **with the `release` label**

**Jobs:**

#### 1. Create Release
- Only runs when a PR with the `release` label is merged
- Increments patch version (0.0.1 → 0.0.2)
- Generates release notes from commit history
- Requires at least one existing tag to work
- No release is created if no previous version tag exists

#### 2. Build and Push Docker Image
- Builds Docker image for multiple platforms (amd64, arm64)
- Pushes to GitHub Container Registry (ghcr.io)
- Creates semantic version tags:
  - Full version (e.g., `0.0.7`)
  - Major.Minor (e.g., `0.0`)
  - Major (e.g., `0`)
  - `latest`

**Required Permissions:**
- `contents: write` - Create tags and releases
- `packages: write` - Push to GitHub Container Registry

**How it works:**
1. Add the `release` label to your PR before merging
2. Merge the PR to `main` (squash, merge commit, or rebase)
3. Workflow checks if PR was merged AND has `release` label
4. Finds the latest version tag (e.g., `v0.0.6`)
5. Increments the patch version (e.g., `v0.0.7`)
6. Creates a new GitHub Release with auto-generated notes
7. Immediately builds and pushes Docker images

**Important:** PRs without the `release` label will NOT trigger a release, even when merged to `main`.

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

The project uses **automated releases on merge**. When you merge a PR with the `release` label to `main`, a new release is automatically created.

### How Version Numbers are Determined

The release workflow automatically determines the version:

1. **Finds the latest version tag** in the repository (e.g., `v0.0.6`)
2. **Increments the patch version** (e.g., `v0.0.6` → `v0.0.7`)
3. **Creates a new GitHub Release** with the incremented version
4. **Generates release notes** automatically from merged PRs and commits
5. **Triggers Docker image build** automatically

**Important:** The workflow requires at least one existing version tag (e.g., `v0.0.1`). If no tags exist, no release will be created.

### Release Workflow

#### 1. Make Your Changes
```bash
# Create feature branch
git checkout -b feature/my-feature

# Make changes
# ...

# Commit
git add .
git commit -m "Add: my awesome feature"
git push origin feature/my-feature
```

#### 2. Create Pull Request
- Open PR on GitHub
- Wait for CI checks to pass
- Get approval (if required)

#### 3. Merge to Main
```bash
# Merge via GitHub UI or CLI
gh pr merge --squash --delete-branch
```

#### 4. Automatic Release Process
After merge to `main` (with `release` label):
1. ✅ `release-on-merge` workflow triggers
2. ✅ Finds latest tag (e.g., `v0.0.6`)
3. ✅ Creates new tag (e.g., `v0.0.7`)
4. ✅ Creates GitHub Release with auto-generated notes
5. ✅ Docker image builds for amd64 and arm64
6. ✅ Image pushed to `ghcr.io/sveneisenschmidt/n8n-openai-bridge`
7. ✅ Tagged with `0.0.7`, `0.0`, `0`, and `latest`

**That's it!** Everything happens in one workflow - no manual steps needed.

### Verify the Release

After a few minutes, check:

```bash
# View releases
gh release list

# Pull the new image
docker pull ghcr.io/sveneisenschmidt/n8n-openai-bridge:latest

# Test it
docker run -d \
  --name test-bridge \
  -p 3333:3333 \
  -e BEARER_TOKEN=test-token \
  ghcr.io/sveneisenschmidt/n8n-openai-bridge:latest

# Check health
curl http://localhost:3333/health

# Cleanup
docker stop test-bridge && docker rm test-bridge
```

### Manual Version Control (Optional)

If you need to create a specific version (e.g., for major/minor bumps):

```bash
# Create and push a version tag manually
git tag v1.0.0
git push origin v1.0.0

# Create a GitHub Release
gh release create v1.0.0 --generate-notes

# This will trigger the Docker image build
```

After this, the automated workflow will continue from `v1.0.0` with patch increments (`v1.0.1`, `v1.0.2`, etc.).

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
