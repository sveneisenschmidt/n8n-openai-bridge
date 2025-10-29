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

/**
 * Task type constants for detecting automated generation tasks
 * from OpenWebUI, LibreChat, and similar clients
 */
const TaskType = Object.freeze({
  GENERATE_TITLE: 'generate_title',
  GENERATE_TAGS: 'generate_tags',
  GENERATE_FOLLOW_UP_QUESTIONS: 'generate_follow_up_questions',
});

module.exports = TaskType;
