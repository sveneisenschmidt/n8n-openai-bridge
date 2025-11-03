/*
 * n8n OpenAI Bridge
 * Copyright (C) 2025 Sven Eisenschmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

const JsonFileModelLoader = require('../loaders/JsonFileModelLoader');
const N8nApiModelLoader = require('../loaders/N8nApiModelLoader');
const JsonHttpModelLoader = require('../loaders/JsonHttpModelLoader');
const StaticModelLoader = require('../loaders/StaticModelLoader');

/**
 * ModelLoaderFactory - Factory for creating ModelLoader instances
 *
 * Responsibilities:
 * - Maintain loader registry
 * - Create appropriate loader based on ENV
 * - Validate loader-specific ENV variables
 *
 * Does NOT:
 * - Manage model state (see ModelRepository)
 * - Parse server configuration (see Config)
 * - Orchestrate lifecycle (see Bootstrap)
 */
class ModelLoaderFactory {
  /**
   * Registry of available model loaders
   * Each loader must have a static TYPE property
   */
  static MODEL_LOADERS = [
    JsonFileModelLoader,
    N8nApiModelLoader,
    JsonHttpModelLoader,
    StaticModelLoader,
  ];

  /**
   * Validate and extract environment variables for a loader
   *
   * Uses the loader's getRequiredEnvVars() to determine which ENV vars are needed,
   * validates required ones, applies defaults for optional ones.
   * Returns raw ENV var values - the loader is responsible for mapping them
   * to its internal config structure.
   *
   * @param {Class} LoaderClass - The loader class (must have static getRequiredEnvVars())
   * @returns {Object} Object with ENV var names as keys and their values
   * @throws {Error} If required environment variables are missing
   */
  static validateEnvVars(LoaderClass) {
    const envVarDefs = LoaderClass.getRequiredEnvVars();
    const envValues = {};
    const missing = [];

    for (const def of envVarDefs) {
      const value = process.env[def.name];

      if (!value || !value.trim()) {
        if (def.required) {
          missing.push(`${def.name} (${def.description})`);
        } else {
          // Use default value for optional vars
          envValues[def.name] = def.defaultValue;
        }
      } else {
        envValues[def.name] = value.trim();
      }
    }

    if (missing.length > 0) {
      const loaderType = process.env.MODEL_LOADER_TYPE || 'file';
      throw new Error(
        `Missing required environment variables for MODEL_LOADER_TYPE="${loaderType}":\n${missing
          .map((m) => `  - ${m}`)
          .join('\n')}`,
      );
    }

    return envValues;
  }

  /**
   * Create the appropriate ModelLoader instance based on MODEL_LOADER_TYPE
   *
   * Uses loader registry to find the matching loader class by TYPE.
   * Each loader defines its own static TYPE identifier.
   *
   * Steps:
   * 1. Read MODEL_LOADER_TYPE from ENV (default: "file")
   * 2. Find matching loader class in registry
   * 3. Validate required ENV vars via loader's getRequiredEnvVars()
   * 4. Create config object from ENV vars
   * 5. Inject config into loader constructor
   *
   * @returns {ModelLoader} Configured model loader instance
   * @throws {Error} If loader type is invalid or required ENV vars are missing
   */
  static createModelLoader() {
    const loaderType = (process.env.MODEL_LOADER_TYPE || 'file').toLowerCase();

    // Find loader class by TYPE
    const LoaderClass = ModelLoaderFactory.MODEL_LOADERS.find(
      (loader) => loader.TYPE === loaderType,
    );

    if (!LoaderClass) {
      const availableTypes = ModelLoaderFactory.MODEL_LOADERS.map((l) => l.TYPE).join(', ');
      throw new Error(
        `Invalid MODEL_LOADER_TYPE: "${loaderType}". Available types: ${availableTypes}`,
      );
    }

    console.log(`Model Loader: ${LoaderClass.TYPE}`);

    // Validate env vars and pass to constructor
    // Loader is responsible for extracting and mapping ENV var values
    const envValues = ModelLoaderFactory.validateEnvVars(LoaderClass);
    return new LoaderClass(envValues);
  }
}

module.exports = ModelLoaderFactory;
