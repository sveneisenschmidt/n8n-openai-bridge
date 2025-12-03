# Release Process

Releases are automated via GitHub Actions when PRs with the `release` label are merged to `main`.

## How It Works

1. Create a PR with your changes to `main`
2. Add the `release` label to the PR
3. Merge the PR
4. GitHub Actions automatically:
   - Creates a new release with auto-incremented patch version
   - Builds Docker images for amd64 and arm64
   - Pushes to GitHub Container Registry with tags: `latest`, `x.y.z`, `x.y`, `x`

## Docker Image Tags

After release, images are available at:

```bash
docker pull ghcr.io/sveneisenschmidt/n8n-openai-bridge:latest
docker pull ghcr.io/sveneisenschmidt/n8n-openai-bridge:0.0.4
docker pull ghcr.io/sveneisenschmidt/n8n-openai-bridge:0.0
docker pull ghcr.io/sveneisenschmidt/n8n-openai-bridge:0
```

## Verify Release

```bash
# Check GitHub Actions completed
# Visit: https://github.com/sveneisenschmidt/n8n-openai-bridge/actions

# Pull and test
docker pull ghcr.io/sveneisenschmidt/n8n-openai-bridge:latest
docker run --rm -e BEARER_TOKEN=test ghcr.io/sveneisenschmidt/n8n-openai-bridge:latest
```

## Hotfix Releases

For urgent fixes, follow the same process:
1. Create PR with fix
2. Add `release` label
3. Merge to trigger release

## Troubleshooting

**GitHub Actions fails:**
- Check Actions tab for error logs
- Verify workflow has `packages: write` permission

**Docker image not found:**
- Verify GitHub Actions completed successfully
- Check package visibility at: https://github.com/sveneisenschmidt/n8n-openai-bridge/pkgs/container/n8n-openai-bridge
