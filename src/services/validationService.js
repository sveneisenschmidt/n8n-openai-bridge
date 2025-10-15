/**
 * Service for validating chat completion requests
 */

/**
 * Validates chat completion request body
 * @param {Object} body - Request body
 * @returns {Object} { valid: boolean, error: Object|null }
 */
function validateChatCompletionRequest(body) {
  const { model, messages } = body;

  if (!model || !messages) {
    return {
      valid: false,
      error: {
        message: 'Missing required fields: model, messages',
        type: 'invalid_request_error',
      },
    };
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return {
      valid: false,
      error: {
        message: 'messages must be a non-empty array',
        type: 'invalid_request_error',
      },
    };
  }

  return { valid: true, error: null };
}

module.exports = {
  validateChatCompletionRequest,
};