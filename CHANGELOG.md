# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Complete OpenAPI 3.1 specification (openapi.yaml)
- Interactive API documentation with Swagger UI (docs/api.html)
- Comprehensive test suite with 147 unit tests
- Integration tests for all API endpoints
- Edge case tests (network errors, malformed data, special characters)
- Service layer architecture:
  - sessionService: Session ID extraction logic
  - userService: User context extraction logic
  - validationService: Request validation logic
  - masking utils: Sensitive data masking

### Changed
- Refactored server.js to use service layer (416 → 282 lines, -32%)
- Improved code organization with separation of concerns
- Enhanced testability with modular architecture
- Better error handling and logging

### Documentation
- Added OpenAPI 3.1 specification
- Created interactive Swagger UI documentation
- Updated README.md with API documentation links
- Added test coverage information to features section

### Testing
- Test coverage: 40.1% → 78.86% (+38.76%)
- 147 tests passing across 9 test suites
- Service modules: 100% test coverage
- server.js: 0% → 56.25% coverage
- n8nClient.js: 75.26% → 80.64% coverage

### Code Quality
- Applied DRY principle throughout codebase
- Removed ~150 lines of duplicate code
- Improved maintainability with SOLID principles
- All business logic now fully tested

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

## [0.0.5] - 2025-10-15

### Fixed
- Release workflow permissions for Docker image publishing
- Removed automatic release body update that caused permission issues
- Simplified release workflow for more reliable deployments

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
