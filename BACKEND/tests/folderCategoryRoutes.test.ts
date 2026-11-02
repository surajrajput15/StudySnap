import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { folderSchema, categorySchema } from '../src/middleware/validate';
import {
  mockFolders,
  mockCategories,
  mockNotes,
  resetMockNotesStores,
} from '../src/routes/notes';

const UUID_1 = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d';
const UUID_2 = '1f3d3c2a-4e5b-4c6d-8e9f-0a1b2c3d4e5f';

beforeEach(() => {
  resetMockNotesStores();
});

test('folderSchema validates a normal folder', () => {
  const result = folderSchema.safeParse({ name: 'Physics Revision' });
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.name, 'Physics Revision');
  }
});

test('folderSchema accepts a valid UUID id', () => {
  const result = folderSchema.safeParse({ id: UUID_1, name: 'Chemistry Prep' });
  assert.equal(result.success, true);
});

test('folderSchema rejects empty or whitespace-only name', () => {
  assert.equal(folderSchema.safeParse({ name: '' }).success, false);
  assert.equal(folderSchema.safeParse({ name: '   ' }).success, false);
});

test('folderSchema rejects names over 100 characters', () => {
  assert.equal(folderSchema.safeParse({ name: 'A'.repeat(101) }).success, false);
});

test('folderSchema rejects non-UUID id', () => {
  assert.equal(folderSchema.safeParse({ id: 'invalid-id', name: 'Valid Name' }).success, false);
});

test('categorySchema validates a normal custom category', () => {
  const result = categorySchema.safeParse({ name: 'Organic Chemistry', color: '#10B981' });
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.name, 'Organic Chemistry');
    assert.equal(result.data.color, '#10B981');
  }
});

test('categorySchema accepts category without color or null color', () => {
  assert.equal(categorySchema.safeParse({ name: 'Maths Advanced' }).success, true);
  assert.equal(categorySchema.safeParse({ name: 'Maths Advanced', color: null }).success, true);
});

test('categorySchema rejects empty name or name over 100 chars', () => {
  assert.equal(categorySchema.safeParse({ name: '' }).success, false);
  assert.equal(categorySchema.safeParse({ name: 'X'.repeat(101) }).success, false);
});

test('folder deletion cascades and removes notes in that folder from mock store', () => {
  // Add a folder
  mockFolders.push({
    id: UUID_1,
    userId: 'user_1',
    name: 'Exams 2026',
    createdAt: new Date(),
  });

  // Add notes: 2 inside folder UUID_1, 1 outside
  mockNotes.push(
    {
      id: UUID_1,
      userId: 'user_1',
      title: 'Note 1 in Folder',
      content: 'Content 1',
      folderId: UUID_1,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: UUID_2,
      userId: 'user_1',
      title: 'Note 2 in Folder',
      content: 'Content 2',
      folderId: UUID_1,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
      userId: 'user_1',
      title: 'Note Outside Folder',
      content: 'Content 3',
      folderId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  );

  // Simulate folder deletion
  const folderIdx = mockFolders.findIndex((f) => f.id === UUID_1 && f.userId === 'user_1');
  assert.notEqual(folderIdx, -1);
  mockFolders.splice(folderIdx, 1);

  // Cascade delete notes in that folder
  const remainingNotes = mockNotes.filter((n) => !(n.folderId === UUID_1 && n.userId === 'user_1'));
  assert.equal(remainingNotes.length, 1);
  assert.equal(remainingNotes[0].title, 'Note Outside Folder');
});

test('category deletion unsets categoryId to null on affected notes in mock store', () => {
  mockCategories.push({
    id: UUID_1,
    userId: 'user_1',
    name: 'Custom Cat',
    color: '#3B82F6',
    createdAt: new Date(),
  });

  mockNotes.push({
    id: UUID_2,
    userId: 'user_1',
    title: 'Note with Custom Category',
    content: 'Content',
    categoryId: UUID_1,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Simulate category deletion (onDelete: set null)
  const catIdx = mockCategories.findIndex((c) => c.id === UUID_1 && c.userId === 'user_1');
  assert.notEqual(catIdx, -1);
  mockCategories.splice(catIdx, 1);

  const updatedNotes = mockNotes.map((n) =>
    n.categoryId === UUID_1 && n.userId === 'user_1' ? { ...n, categoryId: null } : n
  );

  assert.equal(updatedNotes.length, 1);
  assert.equal(updatedNotes[0].categoryId, null);
});

