/**
 * Mock n8n Server for Load Testing
 *
 * Simulates n8n webhook responses without actually calling n8n.
 * Configurable via environment variables:
 * - MOCK_PORT: Port to run on (default: 3001)
 * - MOCK_LATENCY_MIN: Minimum response latency in ms (default: 50)
 * - MOCK_LATENCY_MAX: Maximum response latency in ms (default: 200)
 * - MOCK_ERROR_RATE: Probability of error response 0-1 (default: 0)
 * - MOCK_STREAM_CHUNK_DELAY: Delay between stream chunks in ms (default: 30)
 */

const express = require("express");
const app = express();

// Configuration
const PORT = process.env.MOCK_PORT || 3001;
const LATENCY_MIN = parseInt(process.env.MOCK_LATENCY_MIN || "50", 10);
const LATENCY_MAX = parseInt(process.env.MOCK_LATENCY_MAX || "200", 10);
const ERROR_RATE = parseFloat(process.env.MOCK_ERROR_RATE || "0");
const STREAM_CHUNK_DELAY = parseInt(
  process.env.MOCK_STREAM_CHUNK_DELAY || "30",
  10,
);

app.use(express.json());

// Request counter for stats
let requestCount = 0;
let errorCount = 0;

// Helper: Random latency
function getRandomLatency() {
  return (
    Math.floor(Math.random() * (LATENCY_MAX - LATENCY_MIN + 1)) + LATENCY_MIN
  );
}

// Helper: Should simulate error?
function shouldSimulateError() {
  return Math.random() < ERROR_RATE;
}

// Health endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    mock: true,
    stats: {
      requests: requestCount,
      errors: errorCount,
      errorRate: requestCount > 0 ? (errorCount / requestCount).toFixed(4) : 0,
    },
    config: {
      latencyMin: LATENCY_MIN,
      latencyMax: LATENCY_MAX,
      errorRate: ERROR_RATE,
      streamChunkDelay: STREAM_CHUNK_DELAY,
    },
  });
});

// Mock n8n API - Get workflows (for Auto-Discovery)
app.get("/api/v1/workflows", (req, res) => {
  requestCount++;

  const latency = getRandomLatency();

  // Simulate error
  if (shouldSimulateError()) {
    errorCount++;
    setTimeout(() => {
      res.status(500).json({ message: "Internal server error (simulated)" });
    }, latency);
    return;
  }

  // Parse query params
  const tags = req.query.tags;
  const limit = parseInt(req.query.limit || "100", 10);
  const cursor = req.query.cursor;

  // Generate mock workflows
  const mockWorkflows = [];
  const workflowCount = Math.floor(Math.random() * 20) + 5; // 5-25 workflows

  for (let i = 0; i < workflowCount; i++) {
    const workflow = {
      id: `workflow-mock-${i}`,
      name: `Mock Workflow ${i}`,
      active: Math.random() > 0.2, // 80% active
      createdAt: new Date(
        Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      updatedAt: new Date().toISOString(),
      tags: [],
      nodes: [
        {
          id: `webhook-node-${i}`,
          type: "n8n-nodes-base.webhook",
          name: "Webhook",
          webhookId: `webhook-mock-${i}`,
          parameters: {
            path: `mock-workflow-${i}`,
            httpMethod: "POST",
            responseMode: "lastNode",
          },
          position: [250, 300],
        },
        {
          id: `ai-node-${i}`,
          type: "n8n-nodes-base.openAi",
          name: "OpenAI",
          parameters: {},
          position: [450, 300],
        },
      ],
      connections: {},
    };

    // Add tags if requested
    if (tags) {
      workflow.tags.push({ id: `tag-${i}`, name: tags });
    } else {
      // Random tags
      if (Math.random() > 0.5) {
        workflow.tags.push({ id: `tag-${i}`, name: "n8n-openai-model" });
      }
    }

    mockWorkflows.push(workflow);
  }

  // Filter by tags if specified
  let filteredWorkflows = mockWorkflows;
  if (tags) {
    filteredWorkflows = mockWorkflows.filter((wf) =>
      wf.tags.some((tag) => tag.name === tags),
    );
  }

  // Handle pagination with cursor
  let startIndex = 0;
  if (cursor === "mock-cursor-next") {
    // Return empty results for subsequent pages (simulate end of pagination)
    startIndex = filteredWorkflows.length;
  }

  // Apply limit and pagination
  const paginatedWorkflows = filteredWorkflows.slice(
    startIndex,
    startIndex + limit,
  );

  // Simulate API response
  setTimeout(() => {
    res.json({
      data: paginatedWorkflows,
      nextCursor:
        startIndex + limit < filteredWorkflows.length
          ? "mock-cursor-next"
          : null,
    });
  }, latency);
});

// Mock non-streaming completion
app.post("/webhook/:webhookId", (req, res) => {
  requestCount++;

  const latency = getRandomLatency();

  // Simulate random errors
  if (shouldSimulateError()) {
    errorCount++;
    setTimeout(() => {
      const errorType = Math.random();
      if (errorType < 0.33) {
        res.status(500).json({ error: "Internal server error (simulated)" });
      } else if (errorType < 0.66) {
        res.status(503).json({ error: "Service unavailable (simulated)" });
      } else {
        // Simulate timeout by not responding
        req.socket.destroy();
      }
    }, latency);
    return;
  }

  // Normal response
  setTimeout(() => {
    res.json({
      id:
        "chatcmpl-mock-" +
        Date.now() +
        "-" +
        Math.random().toString(36).substring(7),
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: req.body.model || "gpt-4",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content:
              "This is a mock response from n8n webhook. Your message was: " +
              (req.body.messages?.[req.body.messages.length - 1]?.content ||
                "unknown"),
          },
          finish_reason: "stop",
        },
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30,
      },
    });
  }, latency);
});

// Mock streaming completion
app.post("/webhook/:webhookId/stream", (req, res) => {
  requestCount++;

  // Simulate error
  if (shouldSimulateError()) {
    errorCount++;
    const latency = getRandomLatency();
    setTimeout(() => {
      res.status(500).json({ error: "Internal server error (simulated)" });
    }, latency);
    return;
  }

  // Setup SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const userMessage =
    req.body.messages?.[req.body.messages.length - 1]?.content || "unknown";
  const words = `Mock streaming response for: ${userMessage}`.split(" ");

  let i = 0;
  const interval = setInterval(() => {
    if (i < words.length) {
      const chunk = {
        id: "chatcmpl-mock-" + Date.now(),
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: req.body.model || "gpt-4",
        choices: [
          {
            index: 0,
            delta: { content: (i === 0 ? "" : " ") + words[i] },
            finish_reason: null,
          },
        ],
      };
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      i++;
    } else {
      // Send final chunk
      const finalChunk = {
        id: "chatcmpl-mock-" + Date.now(),
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: req.body.model || "gpt-4",
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
      clearInterval(interval);
    }
  }, STREAM_CHUNK_DELAY);

  // Handle client disconnect
  req.on("close", () => {
    clearInterval(interval);
  });
});

// Catch all
app.use((req, res) => {
  res.status(404).json({ error: "Not found - this is a mock n8n server" });
});

const server = app.listen(PORT, () => {
  console.log(`Mock n8n server running on port ${PORT}`);
  console.log(
    `Config: latency=${LATENCY_MIN}-${LATENCY_MAX}ms, errorRate=${ERROR_RATE}`,
  );
  console.log(`Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("\nShutting down mock server...");
  server.close(() => {
    console.log("Mock server stopped");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("\nShutting down mock server...");
  server.close(() => {
    console.log("Mock server stopped");
    process.exit(0);
  });
});
