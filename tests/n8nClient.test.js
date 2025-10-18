const axios = require("axios");

// Mock console methods to reduce noise in test output
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock axios
jest.mock("axios");

const N8nClient = require("../src/n8nClient");

describe("N8nClient", () => {
  let client;
  let mockConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConfig = {
      n8nBearerToken: "",
    };
    client = new N8nClient(mockConfig);
  });

  describe("getWebhookHeaders", () => {
    test("should return headers with Authorization when webhook token is set", () => {
      mockConfig.n8nWebhookBearerToken = "test-webhook-token";

      const headers = client.getWebhookHeaders();

      expect(headers).toHaveProperty("Content-Type", "application/json");
      expect(headers).toHaveProperty(
        "Authorization",
        "Bearer test-webhook-token",
      );
    });

    test("should return headers without Authorization when webhook token is empty", () => {
      mockConfig.n8nWebhookBearerToken = "";

      const headers = client.getWebhookHeaders();

      expect(headers).toHaveProperty("Content-Type", "application/json");
      expect(headers).not.toHaveProperty("Authorization");
    });
  });

  describe("getApiHeaders", () => {
    test("should return headers with Authorization when API token is set", () => {
      mockConfig.n8nApiBearerToken = "test-api-token";

      const headers = client.getApiHeaders();

      expect(headers).toHaveProperty("Content-Type", "application/json");
      expect(headers).toHaveProperty("Authorization", "Bearer test-api-token");
    });

    test("should return headers without Authorization when API token is empty", () => {
      mockConfig.n8nApiBearerToken = "";

      const headers = client.getApiHeaders();

      expect(headers).toHaveProperty("Content-Type", "application/json");
      expect(headers).not.toHaveProperty("Authorization");
    });
  });

  describe("buildPayload", () => {
    test("should build payload with system prompt and current message", () => {
      const messages = [
        { role: "system", content: "You are a helpful assistant" },
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there!" },
        { role: "user", content: "How are you?" },
      ];

      const userContext = {
        userId: "user-456",
        userEmail: "user@example.com",
        userName: "John Doe",
        userRole: "admin",
      };

      const payload = client.buildPayload(messages, "session-123", userContext);

      expect(payload.systemPrompt).toBe("You are a helpful assistant");
      expect(payload.currentMessage).toBe("How are you?");
      expect(payload.chatInput).toBe("How are you?");
      expect(payload.sessionId).toBe("session-123");
      expect(payload.userId).toBe("user-456");
      expect(payload.userEmail).toBe("user@example.com");
      expect(payload.userName).toBe("John Doe");
      expect(payload.userRole).toBe("admin");
    });

    test("should filter out system messages from messages array", () => {
      const messages = [
        { role: "system", content: "System prompt" },
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi!" },
      ];

      const userContext = { userId: "user-456" };
      const payload = client.buildPayload(messages, "session-123", userContext);

      expect(payload.messages).toHaveLength(2);
      expect(payload.messages.every((m) => m.role !== "system")).toBe(true);
    });

    test("should handle empty messages array", () => {
      const userContext = { userId: "user-456" };
      const payload = client.buildPayload([], "session-123", userContext);

      expect(payload.systemPrompt).toBe("");
      expect(payload.currentMessage).toBe("");
      expect(payload.messages).toEqual([]);
    });

    test("should only include userId when other user fields are null", () => {
      const messages = [{ role: "user", content: "Hello" }];

      const userContext = {
        userId: "user-456",
        userEmail: null,
        userName: null,
        userRole: null,
      };

      const payload = client.buildPayload(messages, "session-123", userContext);

      expect(payload.userId).toBe("user-456");
      expect(payload).not.toHaveProperty("userEmail");
      expect(payload).not.toHaveProperty("userName");
      expect(payload).not.toHaveProperty("userRole");
    });

    test("should include only provided optional user fields", () => {
      const messages = [{ role: "user", content: "Hello" }];

      const userContext = {
        userId: "user-456",
        userEmail: "user@example.com",
        userName: null,
        userRole: "admin",
      };

      const payload = client.buildPayload(messages, "session-123", userContext);

      expect(payload.userId).toBe("user-456");
      expect(payload.userEmail).toBe("user@example.com");
      expect(payload).not.toHaveProperty("userName");
      expect(payload.userRole).toBe("admin");
    });
  });

  describe("nonStreamingCompletion", () => {
    test("should collect and return complete streamed response", async () => {
      // Mock a stream response from n8n
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield Buffer.from('{"type":"begin","metadata":{}}');
          yield Buffer.from('{"type":"item","content":"Hello "}');
          yield Buffer.from('{"type":"item","content":"World"}');
          yield Buffer.from('{"type":"end","metadata":{}}');
        },
      };

      axios.post.mockResolvedValue({
        data: mockStream,
      });

      const userContext = { userId: "user-456" };
      const result = await client.nonStreamingCompletion(
        "https://n8n.example.com/webhook/test/chat",
        [{ role: "user", content: "Hello" }],
        "session-123",
        userContext,
      );

      expect(result).toBe("Hello World");
    });

    test("should handle single chunk response", async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield Buffer.from('{"type":"item","content":"Complete response"}');
          yield Buffer.from('{"type":"end"}');
        },
      };

      axios.post.mockResolvedValue({
        data: mockStream,
      });

      const userContext = { userId: "user-456" };
      const result = await client.nonStreamingCompletion(
        "https://n8n.example.com/webhook/test/chat",
        [{ role: "user", content: "Hello" }],
        "session-123",
        userContext,
      );

      expect(result).toBe("Complete response");
    });

    test("should handle response with different content fields", async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield Buffer.from('{"output":"Part 1 "}');
          yield Buffer.from('{"text":"Part 2 "}');
          yield Buffer.from('{"message":"Part 3"}');
        },
      };

      axios.post.mockResolvedValue({
        data: mockStream,
      });

      const userContext = { userId: "user-456" };
      const result = await client.nonStreamingCompletion(
        "https://n8n.example.com/webhook/test/chat",
        [{ role: "user", content: "Hello" }],
        "session-123",
        userContext,
      );

      expect(result).toBe("Part 1 Part 2 Part 3");
    });

    test("should handle errors gracefully", async () => {
      axios.post.mockRejectedValue(new Error("Network error"));

      const userContext = { userId: "user-456" };
      await expect(
        client.nonStreamingCompletion(
          "https://n8n.example.com/webhook/test/chat",
          [{ role: "user", content: "Hello" }],
          "session-123",
          userContext,
        ),
      ).rejects.toThrow("Network error");
    });
  });

  describe("extractJsonChunks", () => {
    test("should extract single JSON object", () => {
      const buffer = '{"content":"Hello"}';
      const result = client.extractJsonChunks(buffer);

      expect(result.extracted).toHaveLength(1);
      expect(result.extracted[0]).toBe('{"content":"Hello"}');
      expect(result.remainder).toBe("");
    });

    test("should extract multiple JSON objects", () => {
      const buffer = '{"content":"Hello"}{"content":"World"}';
      const result = client.extractJsonChunks(buffer);

      expect(result.extracted).toHaveLength(2);
      expect(result.extracted[0]).toBe('{"content":"Hello"}');
      expect(result.extracted[1]).toBe('{"content":"World"}');
    });

    test("should handle nested JSON objects", () => {
      const buffer = '{"data":{"nested":"value"}}';
      const result = client.extractJsonChunks(buffer);

      expect(result.extracted).toHaveLength(1);
      expect(result.extracted[0]).toBe('{"data":{"nested":"value"}}');
    });

    test("should keep incomplete JSON in remainder", () => {
      const buffer = '{"content":"Hello"}{"incomplete":';
      const result = client.extractJsonChunks(buffer);

      expect(result.extracted).toHaveLength(1);
      expect(result.remainder).toBe('{"incomplete":');
    });

    test("should handle buffer with no JSON", () => {
      const buffer = "plain text";
      const result = client.extractJsonChunks(buffer);

      expect(result.extracted).toHaveLength(0);
      expect(result.remainder).toBe("plain text");
    });
  });

  describe("parseN8nChunk", () => {
    test("should extract content from JSON chunk", () => {
      const chunk = '{"content":"Hello world"}';
      const result = client.parseN8nChunk(chunk);

      expect(result).toBe("Hello world");
    });

    test("should extract text from JSON chunk", () => {
      const chunk = '{"text":"Hello world"}';
      const result = client.parseN8nChunk(chunk);

      expect(result).toBe("Hello world");
    });

    test("should extract output from JSON chunk", () => {
      const chunk = '{"output":"Hello world"}';
      const result = client.parseN8nChunk(chunk);

      expect(result).toBe("Hello world");
    });

    test("should skip metadata chunks", () => {
      const chunk = '{"type":"metadata","data":"ignored"}';
      const result = client.parseN8nChunk(chunk);

      expect(result).toBeNull();
    });

    test("should skip begin/end/error chunks", () => {
      expect(client.parseN8nChunk('{"type":"begin"}')).toBeNull();
      expect(client.parseN8nChunk('{"type":"end"}')).toBeNull();
      expect(client.parseN8nChunk('{"type":"error"}')).toBeNull();
    });

    test("should handle plain text", () => {
      const result = client.parseN8nChunk("plain text");

      expect(result).toBe("plain text");
    });

    test("should return null for empty input", () => {
      expect(client.parseN8nChunk("")).toBeNull();
      expect(client.parseN8nChunk("   ")).toBeNull();
    });

    test("should return null for invalid JSON starting with brace", () => {
      const result = client.parseN8nChunk("{invalid json}");

      expect(result).toBeNull();
    });
  });

  describe("getWorkflows", () => {
    beforeEach(() => {
      mockConfig.n8nApiUrl = "https://n8n.example.com";
      mockConfig.n8nApiBearerToken = "test-api-token";
    });

    test("should fetch workflows with tag filter", async () => {
      const mockWorkflows = [
        {
          id: "wf-1",
          name: "Workflow 1",
          tags: [{ name: "n8n-openai-model" }],
        },
        {
          id: "wf-2",
          name: "Workflow 2",
          tags: [{ name: "n8n-openai-model" }],
        },
      ];

      axios.get.mockResolvedValue({
        data: {
          data: mockWorkflows,
          nextCursor: null,
        },
      });

      const result = await client.getWorkflows("n8n-openai-model");

      expect(result).toEqual(mockWorkflows);
      expect(axios.get).toHaveBeenCalledWith(
        "https://n8n.example.com/api/v1/workflows?limit=250&tags=n8n-openai-model",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer test-api-token",
          }),
        }),
      );
    });

    test("should fetch workflows without tag filter", async () => {
      const mockWorkflows = [{ id: "wf-1", name: "All Workflows" }];

      axios.get.mockResolvedValue({
        data: {
          data: mockWorkflows,
          nextCursor: null,
        },
      });

      const result = await client.getWorkflows();

      expect(result).toEqual(mockWorkflows);
      expect(axios.get).toHaveBeenCalledWith(
        "https://n8n.example.com/api/v1/workflows?limit=250",
        expect.any(Object),
      );
    });

    test("should handle pagination with cursor", async () => {
      const firstPage = [{ id: "wf-1", name: "Workflow 1" }];
      const secondPage = [{ id: "wf-2", name: "Workflow 2" }];

      axios.get
        .mockResolvedValueOnce({
          data: {
            data: firstPage,
            nextCursor: "cursor-abc",
          },
        })
        .mockResolvedValueOnce({
          data: {
            data: secondPage,
            nextCursor: null,
          },
        });

      const result = await client.getWorkflows("test-tag");

      expect(result).toEqual([...firstPage, ...secondPage]);
      expect(axios.get).toHaveBeenCalledTimes(2);
      expect(axios.get).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("cursor=cursor-abc"),
        expect.any(Object),
      );
    });

    test("should throw error if N8N_API_URL not configured", async () => {
      mockConfig.n8nApiUrl = "";

      await expect(client.getWorkflows()).rejects.toThrow(
        "N8N_API_URL not configured",
      );
    });

    test("should throw error if N8N_API_BEARER_TOKEN not configured", async () => {
      mockConfig.n8nApiBearerToken = "";

      await expect(client.getWorkflows()).rejects.toThrow(
        "N8N_API_BEARER_TOKEN not configured",
      );
    });

    test("should handle API errors", async () => {
      axios.get.mockRejectedValue(new Error("API Error"));

      await expect(client.getWorkflows("test-tag")).rejects.toThrow(
        "API Error",
      );
    });

    test("should remove trailing slash from API URL", async () => {
      mockConfig.n8nApiUrl = "https://n8n.example.com/";

      axios.get.mockResolvedValue({
        data: { data: [], nextCursor: null },
      });

      await client.getWorkflows();

      expect(axios.get).toHaveBeenCalledWith(
        expect.stringMatching(/^https:\/\/n8n\.example\.com\/api/),
        expect.any(Object),
      );
    });
  });

  describe("extractWebhookUrl", () => {
    beforeEach(() => {
      mockConfig.n8nWebhookBaseUrl = "https://webhooks.example.com";
    });

    test("should extract URL from webhookId", () => {
      const workflow = {
        id: "wf-1",
        name: "Test Workflow",
        nodes: [
          {
            type: "n8n-nodes-base.webhook",
            webhookId: "webhook-123",
          },
        ],
      };

      const result = client.extractWebhookUrl(workflow);

      expect(result).toBe("https://webhooks.example.com/webhook/webhook-123");
    });

    test("should extract URL from parameters.path as fallback", () => {
      const workflow = {
        id: "wf-1",
        name: "Test Workflow",
        nodes: [
          {
            type: "n8n-nodes-base.webhook",
            parameters: {
              path: "custom/path",
            },
          },
        ],
      };

      const result = client.extractWebhookUrl(workflow);

      expect(result).toBe("https://webhooks.example.com/webhook/custom/path");
    });

    test("should use workflow ID as last resort", () => {
      const workflow = {
        id: "wf-123",
        name: "Test Workflow",
        nodes: [
          {
            type: "n8n-nodes-base.webhook",
          },
        ],
      };

      const result = client.extractWebhookUrl(workflow);

      expect(result).toBe("https://webhooks.example.com/webhook/wf-123");
    });

    test("should return null if no webhook node found", () => {
      const workflow = {
        id: "wf-1",
        name: "Test Workflow",
        nodes: [
          {
            type: "n8n-nodes-base.someOtherNode",
          },
        ],
      };

      const result = client.extractWebhookUrl(workflow);

      expect(result).toBeNull();
    });

    test("should return null if nodes array is empty", () => {
      const workflow = {
        id: "wf-1",
        name: "Test Workflow",
        nodes: [],
      };

      const result = client.extractWebhookUrl(workflow);

      expect(result).toBeNull();
    });

    test("should return null if nodes is not an array", () => {
      const workflow = {
        id: "wf-1",
        name: "Test Workflow",
        nodes: null,
      };

      const result = client.extractWebhookUrl(workflow);

      expect(result).toBeNull();
    });

    test("should find webhook node by type pattern", () => {
      const workflow = {
        id: "wf-1",
        name: "Test Workflow",
        nodes: [
          {
            type: "custom-webhook-node",
            webhookId: "webhook-456",
          },
        ],
      };

      const result = client.extractWebhookUrl(workflow);

      expect(result).toBe("https://webhooks.example.com/webhook/webhook-456");
    });

    test("should remove trailing slash from webhook base URL", () => {
      mockConfig.n8nWebhookBaseUrl = "https://webhooks.example.com/";

      const workflow = {
        id: "wf-1",
        name: "Test Workflow",
        nodes: [
          {
            type: "n8n-nodes-base.webhook",
            webhookId: "webhook-123",
          },
        ],
      };

      const result = client.extractWebhookUrl(workflow);

      expect(result).toBe("https://webhooks.example.com/webhook/webhook-123");
    });
  });
});
