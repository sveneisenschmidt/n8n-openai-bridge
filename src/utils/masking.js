/**
 * Utility functions for masking sensitive information in logs
 */

/**
 * Masks sensitive information in HTTP headers
 * @param {Object} headers - Request headers
 * @returns {Object} Headers with masked sensitive values
 */
function maskSensitiveHeaders(headers) {
  const masked = { ...headers };

  if (masked.authorization) {
    const parts = masked.authorization.split(' ');
    if (parts.length === 2) {
      const token = parts[1];
      if (token.length > 12) {
        masked.authorization = `${parts[0]} ${token.substring(0, 8)}...${token.substring(token.length - 4)}`;
      }
    }
  }

  return masked;
}

/**
 * Masks sensitive information in request body
 * @param {Object} body - Request body
 * @returns {Object} Body with masked sensitive values
 */
function maskSensitiveBody(body) {
  if (!body || typeof body !== 'object') {
    return body;
  }

  const masked = { ...body };

  // Mask API keys if present
  if (masked.api_key && typeof masked.api_key === 'string') {
    const key = masked.api_key;
    if (key.length > 12) {
      masked.api_key = `${key.substring(0, 8)}...${key.substring(key.length - 4)}`;
    }
  }

  return masked;
}

module.exports = {
  maskSensitiveHeaders,
  maskSensitiveBody,
};