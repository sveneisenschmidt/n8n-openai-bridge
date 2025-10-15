const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const config = require('./config');
const n8nClient = require('./n8nClient');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} ${req.method} ${req.path}`);
  
  if (config.logRequests) {
    console.log('--- Incoming Request ---');
    console.log('Headers:', maskSensitiveHeaders(req.headers));
    console.log('Body:', maskSensitiveBody(req.body));
    console.log('Query:', req.query);
    console.log('------------------------');
  }
  
  next();
});

// Mask sensitive information in headers
function maskSensitiveHeaders(headers) {
  const masked = { ...headers };
  if (masked.authorization) {
    const parts = masked.authorization.split(' ');
    if (parts.length === 2) {
      const token = parts[1];
      masked.authorization = `${parts[0]} ${token.substring(0, 8)}...${token.substring(token.length - 4)}`;
    }
  }
  return masked;
}

// Mask sensitive information in body
function maskSensitiveBody(body) {
  if (!body || typeof body !== 'object') return body;
  
  const masked = { ...body };
  
  // Mask API keys if present
  if (masked.api_key) {
    const key = masked.api_key;
    masked.api_key = `${key.substring(0, 8)}...${key.substring(key.length - 4)}`;
  }
  
  return masked;
}

// Health check (before authentication middleware)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    models: Object.keys(config.models).length,
    uptime: process.uptime(),
    logging: config.logRequests
  });
});

// Authentication middleware
function authenticate(req, res, next) {
  if (!config.bearerToken) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: { message: 'Unauthorized', type: 'authentication_error' } });
  }

  const token = authHeader.substring(7);
  if (token !== config.bearerToken) {
    return res.status(401).json({ error: { message: 'Invalid token', type: 'authentication_error' } });
  }

  next();
}

app.use(authenticate);

// Reload models config
app.post('/admin/reload', (req, res) => {
  try {
    config.reloadModels();
    res.json({ 
      status: 'ok', 
      message: 'Models reloaded',
      models: Object.keys(config.models).length
    });
  } catch (error) {
    res.status(500).json({ error: { message: error.message } });
  }
});

// List models (OpenAI compatible)
app.get('/v1/models', (req, res) => {
  const models = config.getAllModels();
  res.json({
    object: 'list',
    data: models,
  });
});

// Chat completions (OpenAI compatible)
app.post('/v1/chat/completions', async (req, res) => {
  const { model, messages, stream = false, user } = req.body;

  // SESSION ID DETECTION (Debug logging)
  if (config.logRequests) {
    console.log('\n========== SESSION ID DETECTION ==========');
    console.log('Checking request body for session identifiers:');
    console.log('  req.body.session_id:', req.body.session_id || 'NOT FOUND');
    console.log('  req.body.conversation_id:', req.body.conversation_id || 'NOT FOUND');
    console.log('  req.body.chat_id:', req.body.chat_id || 'NOT FOUND');
    
    console.log('\nChecking configured session ID headers:');
    config.sessionIdHeaders.forEach(headerName => {
      const lowerHeaderName = headerName.toLowerCase();
      console.log(`  ${headerName}:`, req.headers[lowerHeaderName] || 'NOT FOUND');
    });
    
    console.log('\nAll request body keys:', Object.keys(req.body));
    console.log('\nAll header keys:', Object.keys(req.headers));
    console.log('==========================================\n');
  }

  // Validation
  if (!model || !messages) {
    return res.status(400).json({ 
      error: { 
        message: 'Missing required fields: model, messages',
        type: 'invalid_request_error'
      } 
    });
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ 
      error: { 
        message: 'messages must be a non-empty array',
        type: 'invalid_request_error'
      } 
    });
  }

  const webhookUrl = config.getModelWebhookUrl(model);
  if (!webhookUrl) {
    return res.status(404).json({ 
      error: { 
        message: `Model '${model}' not found`,
        type: 'invalid_request_error'
      } 
    });
  }

  // Try to get session ID from configured sources
  let sessionId = null;
  let sessionSource = null;

  // 1. Try body fields first
  if (req.body.session_id) {
    sessionId = req.body.session_id;
    sessionSource = 'req.body.session_id';
  } else if (req.body.conversation_id) {
    sessionId = req.body.conversation_id;
    sessionSource = 'req.body.conversation_id';
  } else if (req.body.chat_id) {
    sessionId = req.body.chat_id;
    sessionSource = 'req.body.chat_id';
  }

  // 2. Try configured headers in order
  if (!sessionId) {
    for (const headerName of config.sessionIdHeaders) {
      const lowerHeaderName = headerName.toLowerCase();
      if (req.headers[lowerHeaderName]) {
        sessionId = req.headers[lowerHeaderName];
        sessionSource = `headers[${headerName}]`;
        break;
      }
    }
  }

  // 3. Fallback to UUID
  if (!sessionId) {
    sessionId = uuidv4();
    sessionSource = 'generated (new UUID)';
  }

  // Extract user information from headers or body
  let userId = null;
  let userEmail = null;
  let userName = null;
  let userRole = null;

  // Try to get userId from configured headers
  for (const headerName of config.userIdHeaders) {
    const lowerHeaderName = headerName.toLowerCase();
    if (req.headers[lowerHeaderName]) {
      userId = req.headers[lowerHeaderName];
      break;
    }
  }

  // Fallback to body fields for userId
  if (!userId) {
    userId = user || req.body.user_id || req.body.userId || 'anonymous';
  }

  // Try to get userEmail from configured headers
  for (const headerName of config.userEmailHeaders) {
    const lowerHeaderName = headerName.toLowerCase();
    if (req.headers[lowerHeaderName]) {
      userEmail = req.headers[lowerHeaderName];
      break;
    }
  }

  // Fallback to body fields for userEmail
  if (!userEmail) {
    userEmail = req.body.user_email || req.body.userEmail || null;
  }

  // Try to get userName from configured headers
  for (const headerName of config.userNameHeaders) {
    const lowerHeaderName = headerName.toLowerCase();
    if (req.headers[lowerHeaderName]) {
      userName = req.headers[lowerHeaderName];
      break;
    }
  }

  // Fallback to body fields for userName
  if (!userName) {
    userName = req.body.user_name || req.body.userName || null;
  }

  // Try to get userRole from configured headers
  for (const headerName of config.userRoleHeaders) {
    const lowerHeaderName = headerName.toLowerCase();
    if (req.headers[lowerHeaderName]) {
      userRole = req.headers[lowerHeaderName];
      break;
    }
  }

  // Fallback to body fields for userRole
  if (!userRole) {
    userRole = req.body.user_role || req.body.userRole || null;
  }

  console.log(`\n>>> SESSION ID: ${sessionId}`);
  console.log(`>>> SOURCE: ${sessionSource}`);
  console.log(`>>> USER ID: ${userId}`);
  console.log(`>>> USER EMAIL: ${userEmail || 'not provided'}`);
  console.log(`>>> USER NAME: ${userName || 'not provided'}`);
  console.log(`>>> USER ROLE: ${userRole || 'not provided'}`);
  console.log(`>>> MODEL: ${model}`);
  console.log(`>>> STREAM: ${stream}\n`);

  // Build user context object
  const userContext = {
    userId,
    userEmail,
    userName,
    userRole,
  };

  try {
    if (stream) {
      // Streaming response
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      try {
        const streamGenerator = n8nClient.streamCompletion(webhookUrl, messages, sessionId, userContext);

        for await (const content of streamGenerator) {
          const chunk = {
            id: `chatcmpl-${uuidv4()}`,
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model,
            choices: [{
              index: 0,
              delta: { content },
              finish_reason: null,
            }],
          };

          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        }

        // Send final chunk
        const finalChunk = {
          id: `chatcmpl-${uuidv4()}`,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model,
          choices: [{
            index: 0,
            delta: {},
            finish_reason: 'stop',
          }],
        };

        res.write(`data: ${JSON.stringify(finalChunk)}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();

        console.log(`Streaming completed for session: ${sessionId}`);
      } catch (streamError) {
        console.error('Stream error:', streamError);
        const errorChunk = {
          error: {
            message: 'Error during streaming',
            type: 'server_error'
          }
        };
        res.write(`data: ${JSON.stringify(errorChunk)}\n\n`);
        res.end();
      }
    } else {
      // Non-streaming response
      const content = await n8nClient.nonStreamingCompletion(webhookUrl, messages, sessionId, userContext);

      const response = {
        id: `chatcmpl-${uuidv4()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content,
          },
          finish_reason: 'stop',
        }],
        usage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
        },
      };

      console.log(`Non-streaming completed for session: ${sessionId}`);

      res.json(response);
    }
  } catch (error) {
    console.error('Error:', error);
    
    if (!res.headersSent) {
      res.status(500).json({ 
        error: { 
          message: 'Internal server error',
          type: 'server_error'
        } 
      });
    }
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: { 
      message: 'Internal server error',
      type: 'server_error'
    } 
  });
});

// Start server
const PORT = config.port;
const fs = require('fs');
const path = require('path');
const version = fs.readFileSync(path.join(__dirname, '../VERSION'), 'utf8').trim();

app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log(`n8n OpenAI Bridge v${version}`);
  console.log('='.repeat(60));
  console.log(`Server running on port: ${PORT}`);
  console.log(`Request logging: ${config.logRequests ? 'ENABLED' : 'DISABLED'}`);
  console.log(`Session ID headers: ${config.sessionIdHeaders.join(', ')}`);
  console.log('='.repeat(60));
  console.log('Available Models:');
  const modelsList = Object.keys(config.models);
  if (modelsList.length > 0) {
    modelsList.forEach(modelId => {
      console.log(`  - ${modelId}`);
    });
  } else {
    console.log('  (no models configured)');
  }
  console.log('='.repeat(60));
  console.log('Endpoints:');
  console.log(`  GET  /health`);
  console.log(`  GET  /v1/models`);
  console.log(`  POST /v1/chat/completions`);
  console.log(`  POST /admin/reload`);
  console.log('='.repeat(60));
});

module.exports = app;
