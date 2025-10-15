/**
 * Service for extracting user context from requests
 */

/**
 * Extracts user context from request with fallback priority:
 * 1. Configured HTTP headers (first-found-wins)
 * 2. Request body fields
 * 3. Defaults (userId: 'anonymous', others: null)
 *
 * @param {Object} req - Express request object
 * @param {Object} config - Configuration with header arrays
 * @returns {Object} { userId, userEmail, userName, userRole }
 */
function extractUserContext(req, config) {
  const { userIdHeaders, userEmailHeaders, userNameHeaders, userRoleHeaders } = config;
  const { user } = req.body || {};

  // Extract userId
  let userId = extractFromHeaders(req.headers, userIdHeaders);
  if (!userId) {
    userId = user || req.body?.user_id || req.body?.userId || 'anonymous';
  }

  // Extract userEmail
  let userEmail = extractFromHeaders(req.headers, userEmailHeaders);
  if (!userEmail) {
    userEmail = req.body?.user_email || req.body?.userEmail || null;
  }

  // Extract userName
  let userName = extractFromHeaders(req.headers, userNameHeaders);
  if (!userName) {
    userName = req.body?.user_name || req.body?.userName || null;
  }

  // Extract userRole
  let userRole = extractFromHeaders(req.headers, userRoleHeaders);
  if (!userRole) {
    userRole = req.body?.user_role || req.body?.userRole || null;
  }

  return {
    userId,
    userEmail,
    userName,
    userRole,
  };
}

/**
 * Extracts value from headers using configured header names (first-found-wins)
 * @param {Object} headers - Request headers
 * @param {Array<string>} headerNames - Header names to check
 * @returns {string|null} Header value or null
 */
function extractFromHeaders(headers, headerNames) {
  for (const headerName of headerNames) {
    const lowerHeaderName = headerName.toLowerCase();
    if (headers[lowerHeaderName]) {
      return headers[lowerHeaderName];
    }
  }
  return null;
}

module.exports = {
  extractUserContext,
  extractFromHeaders,
};