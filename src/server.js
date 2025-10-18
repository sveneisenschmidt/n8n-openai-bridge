/*
 * n8n OpenAI Bridge
 * Copyright (C) 2025 Sven Eisenschmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

const express = require("express");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
const config = require("./config");
const N8nClient = require("./n8nClient");
const ModelDiscoveryService = require("./services/modelDiscoveryService");
const { maskSensitiveHeaders, maskSensitiveBody } = require("./utils/masking");
const { extractSessionId } = require("./services/sessionService");
const { extractUserContext } = require("./services/userService");
const {
  validateChatCompletionRequest,
} = require("./services/validationService");

const app = express();
const n8nClient = new N8nClient(config);
const discoveryService = new ModelDiscoveryService(config, n8nClient);

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} ${req.method} ${req.path}`);

  if (config.logRequests) {
    console.log("--- Incoming Request ---");
    console.log("Headers:", maskSensitiveHeaders(req.headers));
    console.log("Body:", maskSensitiveBody(req.body));
    console.log("Query:", req.query);
    console.log("------------------------");
  }

  next();
});

// Health check (before authentication middleware)
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    models: Object.keys(config.models).length,
    uptime: process.uptime(),
    logging: config.logRequests,
  });
});

// Authentication middleware
function authenticate(req, res, next) {
  if (!config.bearerToken) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: { message: "Unauthorized", type: "authentication_error" },
    });
  }

  const token = authHeader.substring(7);
  if (token !== config.bearerToken) {
    return res.status(401).json({
      error: { message: "Invalid token", type: "authentication_error" },
    });
  }

  next();
}

app.use(authenticate);

// Reload models config from disk
app.post("/admin/models-reload", (req, res) => {
  try {
    config.reloadModels();
    res.json({
      status: "ok",
      message: "Models reloaded from disk",
      models: Object.keys(config.models).length,
    });
  } catch (error) {
    res.status(500).json({ error: { message: error.message } });
  }
});

// Trigger model discovery
app.post("/admin/models-discover", async (req, res) => {
  try {
    if (!config.autoFetchModelsByTag) {
      return res.status(400).json({
        error: {
          message:
            "Auto-discovery is disabled (AUTO_FETCH_MODELS_BY_TAG=false)",
        },
      });
    }

    const result = await discoveryService.discover();

    if (result.success) {
      res.json({
        status: "ok",
        message: "Discovery completed",
        discovered: result.discovered,
        added: result.added,
        skipped: result.skipped,
        warnings: result.warnings || [],
        models: Object.keys(config.models).length,
      });
    } else {
      res.status(500).json({
        error: {
          message: "Discovery failed",
          details: result.error,
          errorCount: result.errorCount,
        },
      });
    }
  } catch (error) {
    res.status(500).json({ error: { message: error.message } });
  }
});

// Legacy endpoint (backwards compatibility)
app.post("/admin/reload", (req, res) => {
  try {
    config.reloadModels();
    res.json({
      status: "ok",
      message: "Models reloaded (legacy endpoint, use /admin/models-reload)",
      models: Object.keys(config.models).length,
    });
  } catch (error) {
    res.status(500).json({ error: { message: error.message } });
  }
});

// List models (OpenAI compatible)
app.get("/v1/models", (req, res) => {
  const models = config.getAllModels();
  res.json({
    object: "list",
    data: models,
  });
});

// Chat completions (OpenAI compatible)
app.post("/v1/chat/completions", async (req, res) => {
  const { model, messages, stream = false } = req.body;

  // SESSION ID DETECTION (Debug logging)
  if (config.logRequests) {
    console.log("\n========== SESSION ID DETECTION ==========");
    console.log("Checking request body for session identifiers:");
    console.log("  req.body.session_id:", req.body.session_id || "NOT FOUND");
    console.log(
      "  req.body.conversation_id:",
      req.body.conversation_id || "NOT FOUND",
    );
    console.log("  req.body.chat_id:", req.body.chat_id || "NOT FOUND");

    console.log("\nChecking configured session ID headers:");
    config.sessionIdHeaders.forEach((headerName) => {
      const lowerHeaderName = headerName.toLowerCase();
      console.log(
        `  ${headerName}:`,
        req.headers[lowerHeaderName] || "NOT FOUND",
      );
    });

    console.log("\nAll request body keys:", Object.keys(req.body));
    console.log("\nAll header keys:", Object.keys(req.headers));
    console.log("==========================================\n");
  }

  // Validation
  const validation = validateChatCompletionRequest(req.body);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  const webhookUrl = config.getModelWebhookUrl(model);
  if (!webhookUrl) {
    return res.status(404).json({
      error: {
        message: `Model '${model}' not found`,
        type: "invalid_request_error",
      },
    });
  }

  // Extract session ID using service
  const { sessionId, sessionSource } = extractSessionId(
    req,
    config.sessionIdHeaders,
    uuidv4,
  );

  // Extract user context using service
  const userContext = extractUserContext(req, config);

  console.log(`\n>>> SESSION ID: ${sessionId}`);
  console.log(`>>> SOURCE: ${sessionSource}`);
  console.log(`>>> USER ID: ${userContext.userId}`);
  console.log(`>>> USER EMAIL: ${userContext.userEmail || "not provided"}`);
  console.log(`>>> USER NAME: ${userContext.userName || "not provided"}`);
  console.log(`>>> USER ROLE: ${userContext.userRole || "not provided"}`);
  console.log(`>>> MODEL: ${model}`);
  console.log(`>>> STREAM: ${stream}\n`);

  try {
    if (stream) {
      // Streaming response
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      try {
        const streamGenerator = n8nClient.streamCompletion(
          webhookUrl,
          messages,
          sessionId,
          userContext,
        );

        for await (const content of streamGenerator) {
          const chunk = {
            id: `chatcmpl-${uuidv4()}`,
            object: "chat.completion.chunk",
            created: Math.floor(Date.now() / 1000),
            model,
            choices: [
              {
                index: 0,
                delta: { content },
                finish_reason: null,
              },
            ],
          };

          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        }

        // Send final chunk
        const finalChunk = {
          id: `chatcmpl-${uuidv4()}`,
          object: "chat.completion.chunk",
          created: Math.floor(Date.now() / 1000),
          model,
          choices: [
            {
              index: 0,
              delta: {},
              finish_reason: "stop",
            },
          ],
        };

        res.write(`data: ${JSON.stringify(finalChunk)}\n\n`);
        res.write("data: [DONE]\n\n");
        res.end();

        console.log(`Streaming completed for session: ${sessionId}`);
      } catch (streamError) {
        console.error("Stream error:", streamError);
        const errorChunk = {
          error: {
            message: "Error during streaming",
            type: "server_error",
          },
        };
        res.write(`data: ${JSON.stringify(errorChunk)}\n\n`);
        res.end();
      }
    } else {
      // Non-streaming response
      const content = await n8nClient.nonStreamingCompletion(
        webhookUrl,
        messages,
        sessionId,
        userContext,
      );

      const response = {
        id: `chatcmpl-${uuidv4()}`,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content,
            },
            finish_reason: "stop",
          },
        ],
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
    console.error("Error:", error);

    if (!res.headersSent) {
      res.status(500).json({
        error: {
          message: "Internal server error",
          type: "server_error",
        },
      });
    }
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    error: {
      message: "Internal server error",
      type: "server_error",
    },
  });
});

// Start server
const PORT = config.port;

const server = app.listen(PORT, async () => {
  console.log("=".repeat(60));
  console.log("n8n OpenAI Bridge");
  console.log("=".repeat(60));

  // Check for deprecated environment variables
  if (process.env.N8N_BEARER_TOKEN && !process.env.N8N_WEBHOOK_BEARER_TOKEN) {
    console.warn("WARNING: N8N_BEARER_TOKEN is deprecated!");
    console.warn("   Please use N8N_WEBHOOK_BEARER_TOKEN instead.");
    console.warn("   N8N_BEARER_TOKEN will be removed in a future version.");
    console.log("=".repeat(60));
  }

  console.log(`Server running on port: ${PORT}`);
  console.log(
    `Request logging: ${config.logRequests ? "ENABLED" : "DISABLED"}`,
  );
  console.log(`Session ID headers: ${config.sessionIdHeaders.join(", ")}`);
  console.log("=".repeat(60));

  // Start Auto-Discovery
  if (config.autoFetchModelsByTag) {
    console.log("Auto-Discovery: ENABLED");
    console.log(`  Tag: ${config.autoDiscoveryTag}`);
    console.log(`  Polling: ${config.autoDiscoveryPolling}s`);
    console.log(`  n8n API: ${config.n8nApiUrl || "NOT CONFIGURED"}`);
    console.log(
      `  Webhook Base: ${config.n8nWebhookBaseUrl || "NOT CONFIGURED"}`,
    );
    console.log("=".repeat(60));

    try {
      await discoveryService.start();
    } catch (error) {
      console.error("Auto-Discovery startup failed:", error.message);
      console.log("Continuing with existing models.json...");
    }
  } else {
    console.log("Auto-Discovery: DISABLED");
    console.log("=".repeat(60));
  }

  console.log("Available Models:");
  const modelsList = Object.keys(config.models);
  if (modelsList.length > 0) {
    modelsList.forEach((modelId) => {
      console.log(`  - ${modelId}`);
    });
  } else {
    console.log("  (no models configured)");
  }
  console.log("=".repeat(60));
  console.log("Endpoints:");
  console.log(`  GET  /health`);
  console.log(`  GET  /v1/models`);
  console.log(`  POST /v1/chat/completions`);
  console.log(`  POST /admin/reload (legacy)`);
  console.log(`  POST /admin/models-reload`);
  console.log(`  POST /admin/models-discover`);
  console.log("=".repeat(60));
});

// Graceful shutdown
const shutdown = async (signal) => {
  console.log(`\n${signal} received, shutting down gracefully...`);

  // Stop auto-discovery polling
  if (discoveryService) {
    discoveryService.stop();
  }

  // Close config file watcher
  if (config) {
    config.close();
  }

  // Close server
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });

  // Force exit after 10 seconds
  setTimeout(() => {
    console.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

module.exports = app;
