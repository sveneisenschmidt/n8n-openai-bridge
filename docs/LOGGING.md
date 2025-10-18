# Logging

This document describes the logging standards and practices for the n8n OpenAI Bridge application.

## Logging Principles

1. **Standard Console API**: All logging uses Node.js standard `console.*` methods
   - `console.log()` - General information
   - `console.error()` - Errors
   - `console.warn()` - Warnings

2. **No Wrapper Functions**: We do not use custom logging wrappers or utilities

3. **No Manual Timestamps**: Timestamps are automatically added by Node.js/Docker runtime

4. **Structured Output**: Log messages should be clear and descriptive

## Standard Logging Behaviors

### Server Startup

The server logs its configuration and available endpoints on startup:

```
==============================================================
n8n OpenAI Bridge
==============================================================
Server running on port: 3000
Request logging: ENABLED
Session ID headers: x-session-id, x-conversation-id
==============================================================
Available Models:
  - my-agent
  - support-bot
==============================================================
Endpoints:
  GET  /health
  GET  /v1/models
  POST /v1/chat/completions
  POST /admin/reload
==============================================================
```

### Model Loading

Model configuration loading is logged with the following format:

**Successful loading:**
```javascript
console.log(`Watching ${filePath} for changes...`);
console.log(`${filePath} changed, reloading...`);
console.log(`Models reloaded successfully (3 models)`);
```

**Invalid configuration:**
```javascript
console.warn(`Already watching ${filePath}`);
console.warn(`Could not watch ${filePath}: ${error.message}`);
console.error(`Error reloading models: ${error.message}`);
```

### Request Logging

Request logging is controlled by the `LOG_REQUESTS` environment variable.

**Always logged** (regardless of `LOG_REQUESTS` setting):
```javascript
console.log(`${req.method} ${req.path}`);
```

**Logged only when `LOG_REQUESTS=true`**:
```
--- Incoming Request ---
Headers: { ... }  // Sensitive values masked
Body: { ... }     // Sensitive values masked
Query: { ... }
------------------------
Session ID: abc-123
Session Source: request-body
User ID: user-456
User Email: user@example.com
User Name: John Doe
User Role: admin
Model: my-agent
Stream: true
```

**Session detection debug logging** (when `LOG_REQUESTS=true`):
```
========== SESSION ID DETECTION ==========
Checking request body for session identifiers:
  req.body.session_id: abc-123
  req.body.conversation_id: NOT FOUND
  req.body.chat_id: NOT FOUND
Checking configured session ID headers:
  x-session-id: NOT FOUND
  x-conversation-id: NOT FOUND
All request body keys: model, messages, stream, session_id
All header keys: host, content-type, authorization, ...
==========================================
```

### Error Logging

Errors are always logged, regardless of `LOG_REQUESTS` setting:

```javascript
console.error('Streaming error:', error.message);
console.error('Non-streaming error:', error.message);
console.error('Unhandled error:', error);
console.error('Stream error:', streamError);
console.error('Error:', err);
```

## Sensitive Data Masking

When logging request data (headers and body), sensitive information is automatically masked:

- **Authorization headers**: Only first 8 and last 4 characters shown
- **API keys**: Only first 8 and last 4 characters shown

Example:
```javascript
// Before masking:
{ authorization: 'Bearer sk-1234567890abcdefghijklmnopqrstuvwxyz' }

// After masking:
{ authorization: 'Bearer sk-12345...wxyz' }
```

See `src/utils/masking.js` for implementation details.

## Configuration

### Environment Variables

- `LOG_REQUESTS` - Enable detailed request/response logging (default: `false`)
  - `true` - Log request headers, body, query params, session details
  - `false` - Only log request method and path

### Example Configuration

**Production (minimal logging):**
```bash
LOG_REQUESTS=false
```

**Development (verbose logging):**
```bash
LOG_REQUESTS=true
```

## Best Practices

1. **Use appropriate log levels**:
   - `console.log()` for informational messages
   - `console.warn()` for warnings that don't stop execution
   - `console.error()` for errors

2. **Keep messages concise and descriptive**:
   ```javascript
   // Good
   console.error('Streaming error:', error.message);
   
   // Avoid
   console.error('An error occurred');
   ```

3. **Never log sensitive data directly**:
   ```javascript
   // Bad
   console.log('Token:', bearerToken);
   
   // Good
   console.log('Headers:', maskSensitiveHeaders(headers));
   ```

4. **Use consistent message formats**:
   ```javascript
   // Model loading
   console.log(`Models reloaded successfully (${count} models)`);
   
   // Request completion
   console.log(`Streaming completed for session: ${sessionId}`);
   ```

## Implementation Files

- `src/middleware/requestLogger.js` - Request logging middleware
- `src/utils/masking.js` - Sensitive data masking utilities
- `src/utils/debugSession.js` - Session ID detection debug logging
- `src/loaders/JsonFileModelLoader.js` - Model loading logs
- `src/server.js` - Server startup logs
