# Load Testing

Performance testing setup for n8n-openai-bridge using k6 and a mock n8n server.

## Overview

The load testing suite uses **Docker Compose** to orchestrate:

1. **Mock n8n Server** ([mock-n8n-server.js](mock-n8n-server.js)) - Simulates n8n webhook responses
2. **n8n-openai-bridge** - The service under test
3. **k6** - Load testing tool from Grafana

All services run in isolated Docker containers with automatic health checks and cleanup.

## Quick Start

### Run Quick Load Test (10 users, 30s)

```bash
make test-load-simple
```

### Run Full Load Test (Default: 10 users, 30s + ramp-up/down)

```bash
make test-load
```

### Custom Load Test

```bash
# With environment variables
VUS=50 DURATION=2m make test-load

# With different error rate and latency
MOCK_ERROR_RATE=0.05 MOCK_LATENCY_MAX=500 VUS=100 make test-load
```

### Manual Docker Compose

```bash
# Build images
docker-compose -f docker-compose.loadtest.yml build

# Run tests
docker-compose -f docker-compose.loadtest.yml up --abort-on-container-exit --exit-code-from k6

# Cleanup
docker-compose -f docker-compose.loadtest.yml down -v
```

## Mock Server Configuration

Configure the mock n8n server via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `MOCK_PORT` | 3001 | Port to run mock server |
| `MOCK_LATENCY_MIN` | 50 | Minimum response latency (ms) |
| `MOCK_LATENCY_MAX` | 200 | Maximum response latency (ms) |
| `MOCK_ERROR_RATE` | 0 | Error probability (0-1, e.g., 0.01 = 1%) |
| `MOCK_STREAM_CHUNK_DELAY` | 30 | Delay between stream chunks (ms) |

### Example: Simulate High Latency

```bash
MOCK_LATENCY_MIN=500 MOCK_LATENCY_MAX=2000 node tests/load/mock-n8n-server.js
```

### Example: Simulate Errors

```bash
MOCK_ERROR_RATE=0.05 node tests/load/mock-n8n-server.js  # 5% error rate
```

### Health Check

```bash
curl http://localhost:3001/health
```

Returns mock server stats and configuration.

## k6 Load Test Configuration

Configure k6 tests via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `TARGET_URL` | http://localhost:3000 | Bridge URL |
| `BEARER_TOKEN` | test-token | Auth token |
| `VUS` | 10 | Virtual users (concurrent) |
| `DURATION` | 30s | Test duration |

## Test Scenarios

The k6 script tests multiple scenarios with realistic distribution:

- **35%** - Health check (`GET /health`)
- **15%** - List models (`GET /v1/models`)
- **25%** - Chat completion non-streaming (`POST /v1/chat/completions`)
- **10%** - Chat completion streaming (`POST /v1/chat/completions?stream=true`)
- **7%** - Models reload (`POST /admin/models-reload`)
- **8%** - Models discover (`POST /admin/models-discover`) - Auto-Discovery feature

Each virtual user has a "think time" of 0.5-2.5 seconds between requests.

## Load Test Stages

Default load test progression:

1. **Ramp-up (10s)** - 0 → 30% of VUS
2. **Ramp-up (20s)** - 30% → 100% of VUS
3. **Sustained Load** - Hold at 100% for DURATION
4. **Ramp-down (10s)** - 100% → 0 VUS

## Metrics & Thresholds

### Key Metrics

- **HTTP Request Duration** - Response time percentiles (p90, p95, p99)
- **HTTP Request Rate** - Requests per second
- **Error Rate** - Failed requests ratio
- **Chat Completion Duration** - Specific timing for chat endpoints
- **Streaming Duration** - Specific timing for streaming endpoints
- **Reload Duration** - Timing for models reload endpoint
- **Discovery Duration** - Timing for auto-discovery endpoint

### Thresholds (Fail Conditions)

- `http_req_duration p(95) < 2000ms` - 95% of requests under 2 seconds
- `http_req_failed rate < 0.05` - Less than 5% errors

## Results

### Console Output

Results are printed to stdout during and after the test.

### JSON Summary

Detailed results are saved to [summary.json](summary.json) after each run.

```bash
cat tests/load/summary.json | jq '.metrics.http_req_duration'
```

## Troubleshooting

### View container logs

```bash
# All services
docker-compose -f docker-compose.loadtest.yml logs

# Specific service
docker-compose -f docker-compose.loadtest.yml logs mock-n8n
docker-compose -f docker-compose.loadtest.yml logs n8n-bridge
docker-compose -f docker-compose.loadtest.yml logs k6
```

### Check service health

```bash
docker-compose -f docker-compose.loadtest.yml ps
```

### Ports already in use

If you get port conflicts, stop existing containers:

```bash
docker ps
docker stop <container_id>
```

### Manual cleanup

```bash
docker-compose -f docker-compose.loadtest.yml down -v --remove-orphans
```

## Advanced Usage

### Different Load Patterns

**Spike Test** - Sudden traffic spike:

```javascript
export const options = {
  stages: [
    { duration: '10s', target: 100 },  // Spike to 100 users
    { duration: '1m', target: 100 },   // Stay
    { duration: '10s', target: 0 },    // Drop
  ],
};
```

**Stress Test** - Find breaking point:

```javascript
export const options = {
  stages: [
    { duration: '2m', target: 50 },
    { duration: '5m', target: 100 },
    { duration: '2m', target: 200 },
    { duration: '5m', target: 200 },
    { duration: '2m', target: 0 },
  ],
};
```

### Monitor Resources

While running load tests, monitor system resources:

```bash
# Terminal 1: Run load test
make test-load

# Terminal 2: Monitor CPU/Memory
top -pid $(pgrep -f "node src/server.js")

# Or use htop
htop -p $(pgrep -f "node src/server.js")
```

## CI/CD Integration

### GitHub Actions Example

```yaml
- name: Run load tests
  run: make test-load

- name: Upload results
  uses: actions/upload-artifact@v3
  with:
    name: load-test-results
    path: tests/load/summary.json
```

## Best Practices

1. **Baseline First** - Run tests on clean system to establish baseline
2. **Consistent Environment** - Use same hardware/network conditions
3. **Multiple Runs** - Run 3-5 times, take median results
4. **Monitor System** - Watch CPU, memory, network during tests
5. **Realistic Data** - Use production-like payload sizes
6. **Gradual Load** - Always ramp up/down, don't spike instantly

## Docker Architecture

The load test setup uses three Docker containers:

```
┌─────────────────────────────────────────────────┐
│              loadtest network (bridge)          │
│                                                 │
│  ┌──────────────┐      ┌──────────────────┐   │
│  │  mock-n8n    │◄─────┤  n8n-bridge      │   │
│  │  :3001       │      │  :3000           │   │
│  │              │      │                  │   │
│  │ Simulates    │      │ Service Under    │◄──┤───┐
│  │ n8n webhooks │      │ Test             │   │   │
│  └──────────────┘      └──────────────────┘   │   │
│                                                 │   │
│  ┌─────────────────────────────────────────┐  │   │
│  │  k6                                      │  │   │
│  │  Load Testing Tool                      │──┘   │
│  │  - Sends HTTP requests                  │      │
│  │  - Measures performance                 │      │
│  │  - Exits when done                      │      │
│  └─────────────────────────────────────────┘      │
│                                                     │
└─────────────────────────────────────────────────────┘
```

All containers share the `loadtest` network and use health checks to ensure proper startup order.