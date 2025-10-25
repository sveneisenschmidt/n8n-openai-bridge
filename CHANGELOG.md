# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- Model loader callback consistency - N8nApiModelLoader and JsonFileModelLoader now both only fire callbacks when models actually change (Closes #29)
- JsonFileModelLoader no longer triggers reloads on formatting/whitespace changes

### Changed
- Added `getModelsHash()` method to base ModelLoader class for consistent hash-based change detection
- Both loaders now use unified `lastHash` property name

## [0.0.9] - 2025-10-22

### Added
- **Automatic model discovery from n8n workflows** - Models are now automatically identified by their workflow names, eliminating manual configuration (Closes #16)
- New `N8nApiModelLoader` for dynamic model loading from n8n API
- `make setup` command for streamlined development environment initialization
- Demo GIF and compatibility section in README
- Git hooks for automatic code quality checks

### Changed
- **Environment variable rename:** `N8N_BEARER_TOKEN` → `N8N_WEBHOOK_BEARER_TOKEN` (backwards compatible, old name deprecated)
- Webhook extraction now uses `chatTrigger` nodes for simpler workflow configuration
- Enhanced ModelLoader and integration documentation

### Fixed
- Docker file permissions for non-root user
- Docker build workflow missing Dockerfile path
- Release workflow tag fetching

### Documentation
- Comprehensive N8nApiModelLoader documentation
- Updated CONFIGURATION.md and MODELLOADER.md with automatic discovery examples
- Development setup guide with git hooks

**Full Changelog**: https://github.com/sveneisenschmidt/n8n-openai-bridge/compare/v0.0.8...v0.0.9

## [0.0.8] - 2025-10-20

### Added
- Flexible ModelLoader architecture with validation and hot-reload support
- Complete ModelLoader system documentation (MODELLOADER.md)
- Comprehensive unit tests for health and models routes (41 new tests)
- Test coverage increased to 96.76% (303 tests passing)

### Changed
- Simplified test architecture with flat structure and logical grouping
- Reorganized Docker files for better clarity
- Extracted endpoints to separate route files for better maintainability
- Removed load/performance tests (moved to separate repository)
- Improved logging configuration and request logging

### Fixed
- Test resource cleanup issues ("worker process failed to exit gracefully")
- ESLint errors in test files (jest/expect-expect compliance)

### Documentation
- Added ModelLoader architecture and configuration guide
- Enhanced CONFIGURATION.md with error handling and recovery procedures
- Updated README.md with ModelLoader documentation links
- Comprehensive inline comments in ModelLoader components

### Dependencies
- Updated all dependencies to latest versions

**Full Changelog**: https://github.com/sveneisenschmidt/n8n-openai-bridge/compare/v0.0.7...v0.0.8

## [0.0.7] - 2025-10-16

### Changed
- Prepared codebase for open-source release
- Enhanced test coverage and documentation
- Code quality improvements and refactoring

### Documentation
- Comprehensive testing guide
- Release process documentation
- CI/CD workflow documentation

**Full Changelog**: https://github.com/sveneisenschmidt/n8n-openai-bridge/compare/v0.0.6...v0.0.7

## [0.0.6] - 2025-10-15

### Added
- User context header forwarding (userId, userEmail, userName, userRole)
- Four new configurable header groups via environment variables:
  - `USER_ID_HEADERS` (default: X-User-Id)
  - `USER_EMAIL_HEADERS` (default: X-User-Email)
  - `USER_NAME_HEADERS` (default: X-User-Name)
  - `USER_ROLE_HEADERS` (default: X-User-Role)
- First-found-wins priority for header extraction
- Fallback to request body fields for user information
- OpenWebUI integration documentation with header mapping examples
- LibreChat integration documentation with template variables
- New "Session & User Context Management" section in README
- 16 new unit tests for user header parsers
- Extended n8nClient tests for userContext handling

### Changed
- `n8nClient.buildPayload()` now accepts userContext object instead of just userId
- Console logging now includes all user context fields (email, name, role)
- n8n webhook payload now includes optional user fields when provided

### Documentation
- Updated README.md with comprehensive user context documentation
- Added integration guides for OpenWebUI and LibreChat
- Extended .env.example with new header configuration variables
- Updated n8n webhook payload documentation with user context fields

### Integration Support
- OpenWebUI (X-OpenWebUI-User-*) via configurable header lists
- LibreChat (LIBRECHAT_USER_*) via template variables

**Full Changelog**: https://github.com/sveneisenschmidt/n8n-openai-bridge/compare/v0.0.5...v0.0.6

## [0.0.5] - 2025-10-15

### Fixed
- Release workflow permissions for Docker image publishing
- Removed automatic release body update that caused permission issues
- Simplified release workflow for more reliable deployments

**Full Changelog**: https://github.com/sveneisenschmidt/n8n-openai-bridge/compare/v0.0.4...v0.0.5

## [0.0.4] - 2025-10-15

### Added
- Comprehensive CI/CD workflow with GitHub Actions for automated testing
- Docker image build validation in CI pipeline
- Security vulnerability scanning with Trivy
- Automated Docker image publishing to GitHub Container Registry on releases
- Pull request template for consistent contribution process
- Extensive documentation for testing, releases, and versioning
- Docker default configuration files for easier container deployment

### Fixed
- Docker image availability issue in GitHub Actions CI workflow
- SARIF upload permissions for security scan results in CI

### Improved
- Enhanced container startup validation with better error logging
- More robust health check implementation in CI tests
- Better Docker build caching in CI for faster builds

**Full Changelog**: https://github.com/sveneisenschmidt/n8n-openai-bridge/compare/v0.0.3...v0.0.4

## [0.0.3] - 2025-10-11

### Fixed
- Health check endpoint now works without authentication, preventing Docker healthcheck failures with 401 errors

## [0.0.2] - 2025-10-11

### Fixed
- Fixed non-streaming completion handling when `stream=false` is sent by OpenAI clients. Previously, only partial responses were returned because n8n always streams responses. The bridge now correctly collects all stream chunks and returns the complete response for non-streaming requests.

### Added
- LibreChat integration guide in README

## [0.0.1] - 2025-10-11

### Added
- Initial release
- OpenAI-compatible API middleware for n8n workflows
- Support for streaming and non-streaming responses
- Multi-model support via JSON configuration
- Session tracking for conversation memory
- Bearer token authentication
- Docker support with health checks
- Hot-reload models without restart
- Integration examples for Open WebUI
