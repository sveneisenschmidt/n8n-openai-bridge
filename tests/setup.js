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

// Global test setup - runs once before all tests

// Mock process.exit to prevent actual process termination during tests
// and suppress Jest warnings about process.exit calls
const originalExit = process.exit;

// Simply mock it without throwing - tests can check if it was called
process.exit = jest.fn();

// Restore original process.exit after all tests
afterAll(() => {
  process.exit = originalExit;
});
