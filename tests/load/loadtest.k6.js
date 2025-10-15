/**
 * k6 Load Test Script for n8n-openai-bridge
 *
 * Run with: k6 run loadtest.k6.js
 *
 * Environment variables:
 * - TARGET_URL: Base URL of the bridge (default: http://localhost:3000)
 * - BEARER_TOKEN: Auth token (default: test-token)
 * - VUS: Virtual users (default: 10)
 * - DURATION: Test duration (default: 30s)
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const chatCompletionDuration = new Trend('chat_completion_duration');
const streamingDuration = new Trend('streaming_duration');

// Configuration
const TARGET_URL = __ENV.TARGET_URL || 'http://localhost:3000';
const BEARER_TOKEN = __ENV.BEARER_TOKEN || 'test-token';
const VUS = parseInt(__ENV.VUS || '10');
const DURATION = __ENV.DURATION || '30s';

export const options = {
  stages: [
    { duration: '10s', target: Math.floor(VUS * 0.3) },  // Ramp-up to 30%
    { duration: '20s', target: VUS },                     // Ramp-up to 100%
    { duration: DURATION, target: VUS },                  // Stay at 100%
    { duration: '10s', target: 0 },                       // Ramp-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],  // 95% of requests should be below 2s
    http_req_failed: ['rate<0.05'],     // Less than 5% errors
    errors: ['rate<0.05'],
  },
};

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${BEARER_TOKEN}`,
};

// Test scenarios
export default function () {
  const scenario = Math.random();

  if (scenario < 0.4) {
    // 40% - Health check
    testHealthCheck();
  } else if (scenario < 0.6) {
    // 20% - List models
    testListModels();
  } else if (scenario < 0.9) {
    // 30% - Chat completion (non-streaming)
    testChatCompletion();
  } else {
    // 10% - Chat completion (streaming)
    testChatCompletionStreaming();
  }

  // Think time between requests
  sleep(Math.random() * 2 + 0.5); // 0.5-2.5s
}

function testHealthCheck() {
  const res = http.get(`${TARGET_URL}/health`);

  const success = check(res, {
    'health: status is 200': (r) => r.status === 200,
    'health: has status field': (r) => {
      try {
        return JSON.parse(r.body).status === 'ok';
      } catch {
        return false;
      }
    },
  });

  errorRate.add(!success);
}

function testListModels() {
  const res = http.get(`${TARGET_URL}/v1/models`, { headers });

  const success = check(res, {
    'models: status is 200': (r) => r.status === 200,
    'models: has data array': (r) => {
      try {
        return Array.isArray(JSON.parse(r.body).data);
      } catch {
        return false;
      }
    },
  });

  errorRate.add(!success);
}

function testChatCompletion() {
  const payload = JSON.stringify({
    model: 'docker-default-model',
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: `Test message ${Date.now()}` }
    ],
    temperature: 0.7,
    max_tokens: 100,
  });

  const start = Date.now();
  const res = http.post(`${TARGET_URL}/v1/chat/completions`, payload, { headers });
  const duration = Date.now() - start;

  const success = check(res, {
    'chat: status is 200': (r) => r.status === 200,
    'chat: has choices': (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body.choices) && body.choices.length > 0;
      } catch {
        return false;
      }
    },
    'chat: has message content': (r) => {
      try {
        const body = JSON.parse(r.body);
        return typeof body.choices[0].message.content === 'string';
      } catch {
        return false;
      }
    },
  });

  chatCompletionDuration.add(duration);
  errorRate.add(!success);
}

function testChatCompletionStreaming() {
  const payload = JSON.stringify({
    model: 'docker-default-model',
    messages: [
      { role: 'user', content: `Streaming test ${Date.now()}` }
    ],
    stream: true,
  });

  const params = {
    headers,
    timeout: '30s',
  };

  const start = Date.now();
  const res = http.post(`${TARGET_URL}/v1/chat/completions`, payload, params);
  const duration = Date.now() - start;

  const success = check(res, {
    'stream: status is 200': (r) => r.status === 200,
    'stream: is SSE': (r) => r.headers['Content-Type']?.includes('text/event-stream'),
    'stream: has data': (r) => r.body.includes('data:'),
    'stream: ends with DONE': (r) => r.body.includes('[DONE]'),
  });

  streamingDuration.add(duration);
  errorRate.add(!success);
}

// Summary handler
export function handleSummary(data) {
  return {
    'stdout': textSummary(data),
    'tests/load/summary.json': JSON.stringify(data, null, 2),
  };
}

function textSummary(data) {
  const metrics = data.metrics;
  const duration = metrics.http_req_duration.values;

  return `
========================================
  n8n-openai-bridge Load Test Results
========================================

Duration: ${(data.state.testRunDurationMs / 1000).toFixed(2)}s

HTTP Requests:
  Total:        ${metrics.http_reqs.values.count}
  Failed:       ${metrics.http_req_failed.values.passes} (${(metrics.http_req_failed.values.rate * 100).toFixed(2)}%)
  Rate:         ${metrics.http_reqs.values.rate.toFixed(2)} req/s

Response Times:
  Avg:          ${duration.avg.toFixed(2)}ms
  Min:          ${duration.min.toFixed(2)}ms
  Max:          ${duration.max.toFixed(2)}ms
  p(90):        ${duration['p(90)'].toFixed(2)}ms
  p(95):        ${duration['p(95)'].toFixed(2)}ms
  ${duration['p(99)'] ? `p(99):        ${duration['p(99)'].toFixed(2)}ms` : ''}

Virtual Users:
  Max:          ${metrics.vus_max.values.max}

Custom Metrics:
  Error Rate:   ${(metrics.errors.values.rate * 100).toFixed(2)}%
  ${metrics.chat_completion_duration ? `Chat Avg:     ${metrics.chat_completion_duration.values.avg.toFixed(2)}ms` : ''}
  ${metrics.streaming_duration ? `Stream Avg:   ${metrics.streaming_duration.values.avg.toFixed(2)}ms` : ''}

========================================
`;
}