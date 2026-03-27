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

const FileRepository = require('../../src/repositories/FileRepository');

describe('FileRepository', () => {
  let repo;

  beforeEach(() => {
    repo = new FileRepository();
  });

  function createEntry(id, bytes = 100) {
    return {
      metadata: {
        id,
        object: 'file',
        bytes,
        created_at: Math.floor(Date.now() / 1000),
        filename: `${id}.txt`,
        purpose: 'assistants',
        status: 'processed',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      },
      buffer: Buffer.alloc(bytes),
    };
  }

  describe('store and get', () => {
    it('should store and retrieve a file entry', () => {
      const entry = createEntry('file-1');
      repo.store('file-1', entry);

      const result = repo.get('file-1');
      expect(result).toBe(entry);
    });

    it('should return undefined for missing file', () => {
      expect(repo.get('nonexistent')).toBeUndefined();
    });

    it('should track totalBytes on store', () => {
      repo.store('file-1', createEntry('file-1', 200));
      repo.store('file-2', createEntry('file-2', 300));

      expect(repo.getTotalBytes()).toBe(500);
    });
  });

  describe('delete', () => {
    it('should delete an existing file and return true', () => {
      repo.store('file-1', createEntry('file-1', 150));
      const result = repo.delete('file-1');

      expect(result).toBe(true);
      expect(repo.get('file-1')).toBeUndefined();
    });

    it('should return false for missing file', () => {
      expect(repo.delete('nonexistent')).toBe(false);
    });

    it('should decrement totalBytes on delete', () => {
      repo.store('file-1', createEntry('file-1', 200));
      repo.store('file-2', createEntry('file-2', 300));
      repo.delete('file-1');

      expect(repo.getTotalBytes()).toBe(300);
    });
  });

  describe('list', () => {
    beforeEach(() => {
      const entry1 = createEntry('file-1', 100);
      entry1.metadata.created_at = 1000;
      entry1.metadata.purpose = 'assistants';

      const entry2 = createEntry('file-2', 200);
      entry2.metadata.created_at = 2000;
      entry2.metadata.purpose = 'vision';

      const entry3 = createEntry('file-3', 300);
      entry3.metadata.created_at = 3000;
      entry3.metadata.purpose = 'assistants';

      repo.store('file-1', entry1);
      repo.store('file-2', entry2);
      repo.store('file-3', entry3);
    });

    it('should list all files in descending order by default', () => {
      const result = repo.list();
      expect(result).toHaveLength(3);
      expect(result[0].id).toBe('file-3');
      expect(result[1].id).toBe('file-2');
      expect(result[2].id).toBe('file-1');
    });

    it('should list files in ascending order', () => {
      const result = repo.list({ order: 'asc' });
      expect(result[0].id).toBe('file-1');
      expect(result[2].id).toBe('file-3');
    });

    it('should filter by purpose', () => {
      const result = repo.list({ purpose: 'assistants' });
      expect(result).toHaveLength(2);
      expect(result.every((m) => m.purpose === 'assistants')).toBe(true);
    });

    it('should apply limit', () => {
      const result = repo.list({ limit: 2 });
      expect(result).toHaveLength(2);
    });

    it('should paginate with after cursor', () => {
      const result = repo.list({ after: 'file-3' });
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('file-2');
    });

    it('should return empty array for empty repo', () => {
      const emptyRepo = new FileRepository();
      expect(emptyRepo.list()).toEqual([]);
    });
  });

  describe('getAll', () => {
    it('should return the internal map', () => {
      repo.store('file-1', createEntry('file-1'));
      const all = repo.getAll();
      expect(all).toBeInstanceOf(Map);
      expect(all.size).toBe(1);
    });
  });

  describe('getCount', () => {
    it('should return number of stored files', () => {
      expect(repo.getCount()).toBe(0);
      repo.store('file-1', createEntry('file-1'));
      expect(repo.getCount()).toBe(1);
    });
  });

  describe('clear', () => {
    it('should remove all files and reset totalBytes', () => {
      repo.store('file-1', createEntry('file-1', 100));
      repo.store('file-2', createEntry('file-2', 200));

      repo.clear();

      expect(repo.getCount()).toBe(0);
      expect(repo.getTotalBytes()).toBe(0);
      expect(repo.get('file-1')).toBeUndefined();
    });
  });
});
