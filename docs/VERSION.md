# VERSION File

The `VERSION` file contains the current version of the n8n OpenAI Bridge.

## Format

Single line with semantic version number:
```
0.0.3
```

## Usage

### In Node.js Code

```javascript
const fs = require('fs');
const path = require('path');
const version = fs.readFileSync(path.join(__dirname, '../VERSION'), 'utf8').trim();
console.log(`Version: ${version}`);
```

### In Shell Scripts

```bash
VERSION=$(cat VERSION)
echo "Building version: $VERSION"
```

### In Makefile

```makefile
VERSION := $(shell cat VERSION)
build:
	docker build -t myimage:$(VERSION) .
```

## Updating the Version

When creating a new release:

1. Update the `VERSION` file:
   ```bash
   echo "0.0.4" > VERSION
   ```

2. Update `CHANGELOG.md` with the new version and changes

3. Commit both files:
   ```bash
   git add VERSION CHANGELOG.md
   git commit -m "Prepare release v0.0.4"
   ```

4. Create GitHub Release with tag `v0.0.4`
   - This triggers the CI/CD workflow
   - Docker images are automatically built and tagged

## Integration Points

The VERSION file is used by:

- **Server startup** ([src/server.js](src/server.js)) - Displays version in console
- **Docker image** ([Dockerfile](Dockerfile)) - Copied into the image
- **CI/CD workflows** (future) - Can be used for automated tagging

## Why Not package.json?

We use a separate `VERSION` file instead of `package.json` version field because:

1. **Simplicity** - Easy to read from any script (bash, make, etc.)
2. **No JSON parsing** - Plain text file
3. **Flexibility** - Can be used in non-Node.js contexts
4. **Single Source of Truth** - Version is clearly defined in one place
5. **CI/CD Friendly** - Easy to extract in GitHub Actions

## Format Requirements

- Single line
- Semantic versioning: `MAJOR.MINOR.PATCH`
- No `v` prefix
- No trailing newline or whitespace (will be trimmed)

Examples:
- OK `0.0.3`
- OK `1.2.0`
- OK `2.0.1`
- FAIL `v0.0.3` (no prefix)
- FAIL `0.0.3-beta` (pre-release tags in GitHub release, not VERSION file)
