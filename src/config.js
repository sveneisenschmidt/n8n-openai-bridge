require('dotenv').config();
const fs = require('fs');
const path = require('path');

class Config {
  constructor() {
    this.port = process.env.PORT || 3333;
    this.bearerToken = process.env.BEARER_TOKEN || '';
    this.n8nBearerToken = process.env.N8N_BEARER_TOKEN || '';
    this.modelsConfigPath = process.env.MODELS_CONFIG || './models.json';
    this.logRequests = process.env.LOG_REQUESTS === 'true';
    this.sessionIdHeaders = this.parseSessionIdHeaders();
    this.userIdHeaders = this.parseUserIdHeaders();
    this.userEmailHeaders = this.parseUserEmailHeaders();
    this.userNameHeaders = this.parseUserNameHeaders();
    this.userRoleHeaders = this.parseUserRoleHeaders();
    this.models = this.loadModels();
    this.watcher = null;
    this.setupFileWatcher();
  }

  setupFileWatcher() {
    const configPath = path.resolve(this.modelsConfigPath);

    try {
      this.watcher = fs.watch(configPath, (eventType) => {
        if (eventType === 'change') {
          console.log(`[${new Date().toISOString()}] models.json changed, reloading...`);
          this.reloadModels();
          console.log(`[${new Date().toISOString()}] Models reloaded successfully (${Object.keys(this.models).length} models)`);
        }
      });
      console.log(`[${new Date().toISOString()}] Watching ${configPath} for changes...`);
    } catch (error) {
      console.warn(`[${new Date().toISOString()}] Could not watch models.json: ${error.message}`);
    }
  }

  close() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }

  parseSessionIdHeaders() {
    const defaultHeaders = ['X-Session-Id', 'X-Chat-Id'];
    const envValue = process.env.SESSION_ID_HEADERS;

    if (!envValue || !envValue.trim()) {
      return defaultHeaders;
    }

    // Split by comma, trim whitespace, filter empty values
    const headers = envValue
      .split(',')
      .map(h => h.trim())
      .filter(h => h.length > 0);

    return headers.length > 0 ? headers : defaultHeaders;
  }

  parseUserIdHeaders() {
    const defaultHeaders = ['X-User-Id'];
    const envValue = process.env.USER_ID_HEADERS;

    if (!envValue || !envValue.trim()) {
      return defaultHeaders;
    }

    // Split by comma, trim whitespace, filter empty values
    const headers = envValue
      .split(',')
      .map(h => h.trim())
      .filter(h => h.length > 0);

    return headers.length > 0 ? headers : defaultHeaders;
  }

  parseUserEmailHeaders() {
    const defaultHeaders = ['X-User-Email'];
    const envValue = process.env.USER_EMAIL_HEADERS;

    if (!envValue || !envValue.trim()) {
      return defaultHeaders;
    }

    // Split by comma, trim whitespace, filter empty values
    const headers = envValue
      .split(',')
      .map(h => h.trim())
      .filter(h => h.length > 0);

    return headers.length > 0 ? headers : defaultHeaders;
  }

  parseUserNameHeaders() {
    const defaultHeaders = ['X-User-Name'];
    const envValue = process.env.USER_NAME_HEADERS;

    if (!envValue || !envValue.trim()) {
      return defaultHeaders;
    }

    // Split by comma, trim whitespace, filter empty values
    const headers = envValue
      .split(',')
      .map(h => h.trim())
      .filter(h => h.length > 0);

    return headers.length > 0 ? headers : defaultHeaders;
  }

  parseUserRoleHeaders() {
    const defaultHeaders = ['X-User-Role'];
    const envValue = process.env.USER_ROLE_HEADERS;

    if (!envValue || !envValue.trim()) {
      return defaultHeaders;
    }

    // Split by comma, trim whitespace, filter empty values
    const headers = envValue
      .split(',')
      .map(h => h.trim())
      .filter(h => h.length > 0);

    return headers.length > 0 ? headers : defaultHeaders;
  }

  loadModels() {
    try {
      const configPath = path.resolve(this.modelsConfigPath);
      const data = fs.readFileSync(configPath, 'utf8');
      const models = JSON.parse(data);
      return models;
    } catch (error) {
      console.error('Error loading models config:', error.message);
      return {};
    }
  }

  reloadModels() {
    this.models = this.loadModels();
  }

  getModelWebhookUrl(modelId) {
    return this.models[modelId];
  }

  getAllModels() {
    return Object.keys(this.models).map(id => ({
      id,
      object: 'model',
      created: Math.floor(Date.now() / 1000),
      owned_by: 'n8n',
    }));
  }
}

module.exports = new Config();
