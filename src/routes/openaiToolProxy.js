const axios = require('axios');
const express = require('express');
const { emitExternalToolCalls } = require('../utils/externalToolEvents');

const router = express.Router();

function getStreamId(req) {
  const headerValue = req.get('x-stream-id');
  return headerValue?.trim() || null;
}

function emitToolCalls(registry, streamId, model, toolCalls) {
  return emitExternalToolCalls(registry, streamId, model, toolCalls);
}

async function proxyRequest(req, res, next, endpoint) {
  const { config, activeStreamRegistry } = req.app.locals;
  if (!config?.openaiToolProxyBaseUrl) {
    return res.status(503).json({
      error: { message: 'OpenAI-compatible tool proxy is not configured', type: 'server_error' },
    });
  }

  const streamId = getStreamId(req);
  const targetUrl = `${config.openaiToolProxyBaseUrl}${endpoint}`;
  const upstreamBody = req.body;
  const headers = { 'Content-Type': 'application/json' };
  if (config.openaiToolProxyApiKey) {
    headers.Authorization = `Bearer ${config.openaiToolProxyApiKey}`;
  } else if (req.get('authorization')) {
    headers.Authorization = req.get('authorization');
  }
  if (req.get('x-stream-id')) {
    headers['X-Stream-Id'] = req.get('x-stream-id');
  }

  try {
    const isStreamingRequest = req.body?.stream === true;
    console.log(
      `[OpenAI Tool Proxy] Ontvangen: ${endpoint} | stream: ${isStreamingRequest} | streamId: ${streamId || 'GEEN'}`,
    );

    const upstream = await axios.post(targetUrl, upstreamBody, {
      headers,
      timeout: config.openaiToolProxyTimeout,
      responseType: isStreamingRequest ? 'stream' : 'json',
      validateStatus: () => true,
    });

    if (isStreamingRequest) {
      res.status(upstream.status);
      res.setHeader('Content-Type', upstream.headers['content-type'] || 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const accumulatedToolCalls = [];
      let buffer = '';

      upstream.data.on('data', (chunk) => {
        // Schrijf direct door naar n8n
        res.write(chunk);

        // Analyseer tegelijkertijd de chunks voor tool calls naar LibreChat
        buffer += chunk.toString('utf8');
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:') || trimmed === 'data: [DONE]') {
            continue;
          }
          try {
            const parsed = JSON.parse(trimmed.slice(5).trim());
            const deltaCalls = parsed.choices?.[0]?.delta?.tool_calls;
            if (Array.isArray(deltaCalls)) {
              for (const tc of deltaCalls) {
                const idx = tc.index ?? 0;
                if (!accumulatedToolCalls[idx]) {
                  accumulatedToolCalls[idx] = {
                    id: tc.id || '',
                    type: 'function',
                    function: { name: '', arguments: '' },
                  };
                }
                if (tc.id) {
                  accumulatedToolCalls[idx].id = tc.id;
                }
                if (tc.function?.name) {
                  accumulatedToolCalls[idx].function.name += tc.function.name;
                }
                if (tc.function?.arguments) {
                  accumulatedToolCalls[idx].function.arguments += tc.function.arguments;
                }
              }
            }
            if (
              parsed.choices?.[0]?.finish_reason === 'tool_calls' &&
              streamId &&
              accumulatedToolCalls.length > 0
            ) {
              emitToolCalls(
                activeStreamRegistry,
                streamId,
                req.body?.model,
                accumulatedToolCalls.filter((toolCall) => toolCall?.id && toolCall.function?.name),
              );
            }
          } catch {
            // Ignore malformed or incomplete SSE JSON fragments.
          }
        }
      });

      upstream.data.on('end', () => {
        res.end();
      });

      upstream.data.on('error', (err) => {
        console.error('[OpenAI Tool Proxy] Upstream stream fout:', err);
        res.end();
      });

      return;
    }

    // NON-STREAMING ROUTE:
    const toolCalls = upstream.data?.choices?.[0]?.message?.tool_calls;
    if (
      endpoint === '/v1/chat/completions' &&
      upstream.status >= 200 &&
      upstream.status < 300 &&
      Array.isArray(toolCalls) &&
      toolCalls.length
    ) {
      console.log(
        `[OpenAI Tool Proxy] Non-stream emit tool calls naar streamId: ${streamId}`,
        toolCalls,
      );
      const emitted =
        streamId && emitToolCalls(activeStreamRegistry, streamId, req.body?.model, toolCalls);
      if (!emitted) {
        console.warn(
          `[OpenAI Tool Proxy] Tool calls niet verzonden; inactieve streamId: ${streamId || 'geen'}`,
        );
      }
    }

    return res.status(upstream.status).json(upstream.data);
  } catch (error) {
    console.error('[OpenAI Tool Proxy] Fout:', error.message);
    return next(error);
  }
}

router.post('/v1/chat/completions', (req, res, next) =>
  proxyRequest(req, res, next, '/v1/chat/completions'),
);

router.post('/v1/responses', (req, res, next) => proxyRequest(req, res, next, '/v1/responses'));

module.exports = router;
module.exports.emitToolCalls = emitToolCalls;
module.exports.getStreamId = getStreamId;
