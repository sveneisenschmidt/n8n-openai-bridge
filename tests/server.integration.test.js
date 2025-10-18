const request = require("supertest");
const fs = require("fs");
const path = require("path");

// Mock console methods to reduce noise in test output
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

describe("Server Integration Tests", () => {
  let app;
  let originalEnv;
  let tempConfigPath;

  beforeAll(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Create temporary models.json for testing
    tempConfigPath = path.join(__dirname, "integration-test-models.json");
    const testModels = {
      "test-model": "https://n8n.example.com/webhook/test/chat",
      "another-model": "https://n8n.example.com/webhook/another/chat",
    };
    fs.writeFileSync(tempConfigPath, JSON.stringify(testModels, null, 2));

    // Set test environment
    process.env.MODELS_CONFIG = tempConfigPath;
    process.env.PORT = "3333";
    process.env.BEARER_TOKEN = "test-bearer-token";
    process.env.LOG_REQUESTS = "false";
    process.env.SESSION_ID_HEADERS = "X-Session-Id,X-Chat-Id";
    process.env.USER_ID_HEADERS = "X-User-Id";
    process.env.USER_EMAIL_HEADERS = "X-User-Email";
    process.env.USER_NAME_HEADERS = "X-User-Name";
    process.env.USER_ROLE_HEADERS = "X-User-Role";

    // Mock fs.watch to prevent file watching in tests
    const mockWatcher = {
      close: jest.fn(),
      on: jest.fn(),
      removeAllListeners: jest.fn(),
    };
    jest.spyOn(fs, "watch").mockReturnValue(mockWatcher);

    // Clear module cache and require fresh instances
    jest.resetModules();

    // Mock n8nClient before requiring server
    jest.mock("../src/n8nClient");

    app = require("../src/server");
  });

  afterAll(() => {
    // Restore environment
    process.env = originalEnv;

    // Restore fs mocks
    if (fs.watch.mockRestore) {
      fs.watch.mockRestore();
    }
    if (fs.readFileSync.mockRestore) {
      fs.readFileSync.mockRestore();
    }

    // Clean up temp file
    if (fs.existsSync(tempConfigPath)) {
      fs.unlinkSync(tempConfigPath);
    }

    // Clear module cache
    jest.resetModules();
  });

  describe("GET /health", () => {
    test("should return 200 without authentication", async () => {
      const response = await request(app).get("/health");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("status", "ok");
      expect(response.body).toHaveProperty("models");
      expect(response.body).toHaveProperty("uptime");
    });

    test("should include model count", async () => {
      const response = await request(app).get("/health");

      expect(response.body.models).toBe(2); // test-model and another-model
    });
  });

  describe("GET /v1/models - Authentication", () => {
    test("should return 401 without Authorization header", async () => {
      const response = await request(app).get("/v1/models");

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toHaveProperty(
        "type",
        "authentication_error",
      );
    });

    test("should return 401 with invalid Bearer token", async () => {
      const response = await request(app)
        .get("/v1/models")
        .set("Authorization", "Bearer wrong-token");

      expect(response.status).toBe(401);
      expect(response.body.error).toHaveProperty(
        "type",
        "authentication_error",
      );
    });

    test("should return 401 with malformed Authorization header", async () => {
      const response = await request(app)
        .get("/v1/models")
        .set("Authorization", "InvalidFormat");

      expect(response.status).toBe(401);
    });

    test("should return 200 with valid Bearer token", async () => {
      const response = await request(app)
        .get("/v1/models")
        .set("Authorization", "Bearer test-bearer-token");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("object", "list");
      expect(response.body).toHaveProperty("data");
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe("GET /v1/models - Response Format", () => {
    test("should return OpenAI-compatible format", async () => {
      const response = await request(app)
        .get("/v1/models")
        .set("Authorization", "Bearer test-bearer-token");

      expect(response.body.object).toBe("list");
      expect(response.body.data).toHaveLength(2);

      const model = response.body.data[0];
      expect(model).toHaveProperty("id");
      expect(model).toHaveProperty("object", "model");
      expect(model).toHaveProperty("created");
      expect(model).toHaveProperty("owned_by", "n8n");
    });

    test("should include all configured models", async () => {
      const response = await request(app)
        .get("/v1/models")
        .set("Authorization", "Bearer test-bearer-token");

      const modelIds = response.body.data.map((m) => m.id);
      expect(modelIds).toContain("test-model");
      expect(modelIds).toContain("another-model");
    });
  });

  describe("POST /v1/chat/completions - Validation", () => {
    test("should return 400 when model is missing", async () => {
      const response = await request(app)
        .post("/v1/chat/completions")
        .set("Authorization", "Bearer test-bearer-token")
        .send({
          messages: [{ role: "user", content: "Hello" }],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toHaveProperty(
        "type",
        "invalid_request_error",
      );
      expect(response.body.error.message).toContain("model");
    });

    test("should return 400 when messages is missing", async () => {
      const response = await request(app)
        .post("/v1/chat/completions")
        .set("Authorization", "Bearer test-bearer-token")
        .send({
          model: "test-model",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toHaveProperty(
        "type",
        "invalid_request_error",
      );
    });

    test("should return 400 when messages is not an array", async () => {
      const response = await request(app)
        .post("/v1/chat/completions")
        .set("Authorization", "Bearer test-bearer-token")
        .send({
          model: "test-model",
          messages: "invalid",
        });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain("array");
    });

    test("should return 400 when messages array is empty", async () => {
      const response = await request(app)
        .post("/v1/chat/completions")
        .set("Authorization", "Bearer test-bearer-token")
        .send({
          model: "test-model",
          messages: [],
        });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain("non-empty");
    });

    test("should return 404 when model is not found", async () => {
      const response = await request(app)
        .post("/v1/chat/completions")
        .set("Authorization", "Bearer test-bearer-token")
        .send({
          model: "nonexistent-model",
          messages: [{ role: "user", content: "Hello" }],
        });

      expect(response.status).toBe(404);
      expect(response.body.error.message).toContain("not found");
    });
  });

  describe("POST /admin/reload", () => {
    test("should require authentication", async () => {
      const response = await request(app).post("/admin/reload");

      expect(response.status).toBe(401);
    });

    test("should reload models configuration", async () => {
      const response = await request(app)
        .post("/admin/reload")
        .set("Authorization", "Bearer test-bearer-token");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("status", "ok");
      expect(response.body).toHaveProperty("message");
      expect(response.body).toHaveProperty("models");
    });
  });

  describe("POST /admin/models-reload", () => {
    test("should require authentication", async () => {
      const response = await request(app).post("/admin/models-reload");

      expect(response.status).toBe(401);
    });

    test("should reload models configuration from disk", async () => {
      const response = await request(app)
        .post("/admin/models-reload")
        .set("Authorization", "Bearer test-bearer-token");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("status", "ok");
      expect(response.body).toHaveProperty("message");
      expect(response.body.message).toContain("reloaded from disk");
      expect(response.body).toHaveProperty("models");
      expect(typeof response.body.models).toBe("number");
    });
  });

  describe("POST /admin/models-discover", () => {
    test("should require authentication", async () => {
      const response = await request(app).post("/admin/models-discover");

      expect(response.status).toBe(401);
    });

    test("should return 400 when auto-discovery is disabled", async () => {
      const response = await request(app)
        .post("/admin/models-discover")
        .set("Authorization", "Bearer test-bearer-token");

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error.message).toContain("disabled");
    });
  });

  describe("CORS", () => {
    test("should allow CORS requests", async () => {
      const response = await request(app)
        .get("/health")
        .set("Origin", "http://example.com");

      expect(response.headers).toHaveProperty("access-control-allow-origin");
    });
  });

  describe("Request Logging", () => {
    test("should log requests to console", async () => {
      await request(app).get("/health");

      expect(console.log).toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    test("should handle JSON parse errors gracefully", async () => {
      const response = await request(app)
        .post("/v1/chat/completions")
        .set("Authorization", "Bearer test-bearer-token")
        .set("Content-Type", "application/json")
        .send("invalid json");

      // Express returns 400 for malformed JSON by default
      expect([400, 500]).toContain(response.status);
    });
  });
});
