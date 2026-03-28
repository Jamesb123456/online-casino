// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const {
  mockSelect,
  mockInsert,
  mockUpdate,
  mockDelete,
  mockExecute,
} = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
  mockExecute: vi.fn(),
}));

vi.mock('../../../drizzle/db.js', () => ({
  db: {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    execute: mockExecute,
    transaction: vi.fn(async (cb) =>
      cb({
        select: mockSelect,
        insert: mockInsert,
        update: mockUpdate,
        delete: mockDelete,
        execute: mockExecute,
      }),
    ),
  },
}));

vi.mock('../../../drizzle/schema.js', () => ({
  messages: {
    id: 'messages.id',
    content: 'messages.content',
    userId: 'messages.userId',
    createdAt: 'messages.createdAt',
  },
  users: {
    id: 'users.id',
    username: 'users.username',
    avatar: 'users.avatar',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args) => ({ type: 'eq', args })),
  and: vi.fn((...args) => ({ type: 'and', args })),
  or: vi.fn((...args) => ({ type: 'or', args })),
  desc: vi.fn((col) => ({ type: 'desc', col })),
  asc: vi.fn((col) => ({ type: 'asc', col })),
  sql: vi.fn((...args) => ({ type: 'sql', args })),
  count: vi.fn(() => 'count_fn'),
  like: vi.fn((...args) => ({ type: 'like', args })),
  between: vi.fn((...args) => ({ type: 'between', args })),
  gte: vi.fn((...args) => ({ type: 'gte', args })),
  lte: vi.fn((...args) => ({ type: 'lte', args })),
  isNull: vi.fn((col) => ({ type: 'isNull', col })),
  isNotNull: vi.fn((col) => ({ type: 'isNotNull', col })),
  inArray: vi.fn((...args) => ({ type: 'inArray', args })),
  sum: vi.fn(() => 'sum'),
}));

// ---------------------------------------------------------------------------
// Import the model AFTER mocks
// ---------------------------------------------------------------------------
import MessageModel from '../../../drizzle/models/Message.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildChain(resolvedValue: any) {
  const chain: any = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    then: (resolve: any) => resolve(resolvedValue),
    [Symbol.toStringTag]: 'Promise',
  };
  chain.then = (resolve: any, reject?: any) => Promise.resolve(resolvedValue).then(resolve, reject);
  chain.catch = (reject: any) => Promise.resolve(resolvedValue).catch(reject);
  return chain;
}

function buildInsertChain(resolvedValue: any) {
  const chain: any = {
    values: vi.fn().mockReturnThis(),
    then: (resolve: any) => resolve(resolvedValue),
    [Symbol.toStringTag]: 'Promise',
  };
  chain.then = (resolve: any, reject?: any) => Promise.resolve(resolvedValue).then(resolve, reject);
  chain.catch = (reject: any) => Promise.resolve(resolvedValue).catch(reject);
  return chain;
}

function buildUpdateChain(resolvedValue: any) {
  const chain: any = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    then: (resolve: any) => resolve(resolvedValue),
    [Symbol.toStringTag]: 'Promise',
  };
  chain.then = (resolve: any, reject?: any) => Promise.resolve(resolvedValue).then(resolve, reject);
  chain.catch = (reject: any) => Promise.resolve(resolvedValue).catch(reject);
  return chain;
}

function buildDeleteChain(resolvedValue: any) {
  const chain: any = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    then: (resolve: any) => resolve(resolvedValue),
    [Symbol.toStringTag]: 'Promise',
  };
  chain.then = (resolve: any, reject?: any) => Promise.resolve(resolvedValue).then(resolve, reject);
  chain.catch = (reject: any) => Promise.resolve(resolvedValue).catch(reject);
  return chain;
}

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------

const sampleMessage = {
  id: 1,
  content: 'Hello everyone!',
  userId: 10,
  createdAt: new Date('2025-06-01T10:00:00Z'),
};

const sampleMessageWithUser = {
  id: 1,
  content: 'Hello everyone!',
  userId: 10,
  createdAt: new Date('2025-06-01T10:00:00Z'),
  username: 'testuser',
  avatar: 'avatar.png',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MessageModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // create()
  // -------------------------------------------------------------------------
  describe('create()', () => {
    it('should insert a message and return the created record via insertId', async () => {
      const insertChain = buildInsertChain({ insertId: 1 });
      mockInsert.mockReturnValue(insertChain);

      const selectChain = buildChain([sampleMessage]);
      mockSelect.mockReturnValue(selectChain);

      const result = await MessageModel.create({
        content: 'Hello everyone!',
        userId: 10,
      });

      expect(mockInsert).toHaveBeenCalled();
      expect(mockSelect).toHaveBeenCalled();
      expect(result).toEqual(sampleMessage);
    });

    it('should return a fallback object when insertId is not available', async () => {
      const insertChain = buildInsertChain({});
      mockInsert.mockReturnValue(insertChain);

      const data = { content: 'Hello!', userId: 10 };
      const result = await MessageModel.create(data);

      // Fallback: { id: undefined, ...data }
      expect(result).toHaveProperty('content', 'Hello!');
      expect(result).toHaveProperty('userId', 10);
    });

    it('should throw an error when insert fails', async () => {
      mockInsert.mockImplementation(() => {
        throw new Error('Insert failed');
      });

      await expect(
        MessageModel.create({ content: 'Hello', userId: 10 }),
      ).rejects.toThrow('Error creating message: Insert failed');
    });
  });

  // -------------------------------------------------------------------------
  // findById()
  // -------------------------------------------------------------------------
  describe('findById()', () => {
    it('should return the message with user details when found', async () => {
      const selectChain = buildChain([sampleMessageWithUser]);
      mockSelect.mockReturnValue(selectChain);

      const result = await MessageModel.findById(1);

      expect(mockSelect).toHaveBeenCalled();
      expect(selectChain.leftJoin).toHaveBeenCalled();
      expect(selectChain.limit).toHaveBeenCalledWith(1);
      expect(result).toEqual(sampleMessageWithUser);
    });

    it('should return null when message is not found', async () => {
      const selectChain = buildChain([]);
      mockSelect.mockReturnValue(selectChain);

      const result = await MessageModel.findById(999);

      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // findByIdWithUser()
  // -------------------------------------------------------------------------
  describe('findByIdWithUser()', () => {
    it('should return message with user details', async () => {
      const selectChain = buildChain([sampleMessageWithUser]);
      mockSelect.mockReturnValue(selectChain);

      const result = await MessageModel.findByIdWithUser(1);

      expect(mockSelect).toHaveBeenCalled();
      expect(selectChain.leftJoin).toHaveBeenCalled();
      expect(selectChain.where).toHaveBeenCalled();
      expect(result).toEqual(sampleMessageWithUser);
    });

    it('should return null when message is not found', async () => {
      const selectChain = buildChain([]);
      mockSelect.mockReturnValue(selectChain);

      const result = await MessageModel.findByIdWithUser(999);

      expect(result).toBeNull();
    });

    it('should throw an error when query fails', async () => {
      mockSelect.mockImplementation(() => {
        throw new Error('Query failed');
      });

      await expect(MessageModel.findByIdWithUser(1)).rejects.toThrow(
        'Error finding message with user: Query failed',
      );
    });
  });

  // -------------------------------------------------------------------------
  // getRecentMessages()
  // -------------------------------------------------------------------------
  describe('getRecentMessages()', () => {
    it('should return recent messages with user details', async () => {
      const messages = [
        sampleMessageWithUser,
        { ...sampleMessageWithUser, id: 2, content: 'Hi there!' },
      ];
      const selectChain = buildChain(messages);
      mockSelect.mockReturnValue(selectChain);

      const result = await MessageModel.getRecentMessages();

      expect(mockSelect).toHaveBeenCalled();
      expect(selectChain.leftJoin).toHaveBeenCalled();
      expect(selectChain.orderBy).toHaveBeenCalled();
      expect(selectChain.limit).toHaveBeenCalledWith(50);
      expect(result).toEqual(messages);
    });

    it('should accept a custom limit', async () => {
      const selectChain = buildChain([]);
      mockSelect.mockReturnValue(selectChain);

      await MessageModel.getRecentMessages(25);

      expect(selectChain.limit).toHaveBeenCalledWith(25);
    });

    it('should throw an error when query fails', async () => {
      mockSelect.mockImplementation(() => {
        throw new Error('Recent messages failed');
      });

      await expect(MessageModel.getRecentMessages()).rejects.toThrow(
        'Error getting recent messages: Recent messages failed',
      );
    });
  });

  // -------------------------------------------------------------------------
  // findByUserId()
  // -------------------------------------------------------------------------
  describe('findByUserId()', () => {
    it('should return messages for a user with pagination', async () => {
      const userMessages = [sampleMessage, { ...sampleMessage, id: 2 }];
      const selectChain = buildChain(userMessages);
      mockSelect.mockReturnValue(selectChain);

      const result = await MessageModel.findByUserId(10);

      expect(mockSelect).toHaveBeenCalled();
      expect(selectChain.where).toHaveBeenCalled();
      expect(selectChain.orderBy).toHaveBeenCalled();
      expect(selectChain.limit).toHaveBeenCalledWith(50);
      expect(selectChain.offset).toHaveBeenCalledWith(0);
      expect(result).toEqual(userMessages);
    });

    it('should accept custom limit and offset', async () => {
      const selectChain = buildChain([]);
      mockSelect.mockReturnValue(selectChain);

      await MessageModel.findByUserId(10, 20, 5);

      expect(selectChain.limit).toHaveBeenCalledWith(20);
      expect(selectChain.offset).toHaveBeenCalledWith(5);
    });

    it('should throw an error when query fails', async () => {
      mockSelect.mockImplementation(() => {
        throw new Error('User messages failed');
      });

      await expect(MessageModel.findByUserId(10)).rejects.toThrow(
        'Error finding messages by user ID: User messages failed',
      );
    });
  });

  // -------------------------------------------------------------------------
  // findWithPagination()
  // -------------------------------------------------------------------------
  describe('findWithPagination()', () => {
    it('should return paginated messages with user details', async () => {
      const messages = [sampleMessageWithUser];
      const selectChain = buildChain(messages);
      mockSelect.mockReturnValue(selectChain);

      const result = await MessageModel.findWithPagination();

      expect(mockSelect).toHaveBeenCalled();
      expect(selectChain.leftJoin).toHaveBeenCalled();
      expect(selectChain.orderBy).toHaveBeenCalled();
      expect(selectChain.limit).toHaveBeenCalledWith(50);
      expect(selectChain.offset).toHaveBeenCalledWith(0);
      expect(result).toEqual(messages);
    });

    it('should accept custom limit and offset', async () => {
      const selectChain = buildChain([]);
      mockSelect.mockReturnValue(selectChain);

      await MessageModel.findWithPagination(20, 10);

      expect(selectChain.limit).toHaveBeenCalledWith(20);
      expect(selectChain.offset).toHaveBeenCalledWith(10);
    });

    it('should throw an error when query fails', async () => {
      mockSelect.mockImplementation(() => {
        throw new Error('Pagination failed');
      });

      await expect(MessageModel.findWithPagination()).rejects.toThrow(
        'Error finding messages with pagination: Pagination failed',
      );
    });
  });

  // -------------------------------------------------------------------------
  // update()
  // -------------------------------------------------------------------------
  describe('update()', () => {
    it('should update the message and return the updated record', async () => {
      const updatedMessage = { ...sampleMessage, content: 'Updated content' };
      const updateChain = buildUpdateChain(undefined);
      mockUpdate.mockReturnValue(updateChain);

      const selectChain = buildChain([updatedMessage]);
      mockSelect.mockReturnValue(selectChain);

      const result = await MessageModel.update(1, { content: 'Updated content' });

      expect(mockUpdate).toHaveBeenCalled();
      expect(mockSelect).toHaveBeenCalled();
      expect(result).toEqual(updatedMessage);
    });

    it('should throw an error when update fails', async () => {
      mockUpdate.mockImplementation(() => {
        throw new Error('Update failed');
      });

      await expect(
        MessageModel.update(1, { content: 'Updated' }),
      ).rejects.toThrow('Error updating message: Update failed');
    });
  });

  // -------------------------------------------------------------------------
  // delete()
  // -------------------------------------------------------------------------
  describe('delete()', () => {
    it('should delete the message and return the deleted record', async () => {
      // First select to get the message before deleting
      const selectChain = buildChain([sampleMessage]);
      mockSelect.mockReturnValue(selectChain);

      const deleteChain = buildDeleteChain(undefined);
      mockDelete.mockReturnValue(deleteChain);

      const result = await MessageModel.delete(1);

      expect(mockSelect).toHaveBeenCalled();
      expect(mockDelete).toHaveBeenCalled();
      expect(result).toEqual(sampleMessage);
    });

    it('should throw an error when message is not found', async () => {
      const selectChain = buildChain([]);
      mockSelect.mockReturnValue(selectChain);

      await expect(MessageModel.delete(999)).rejects.toThrow(
        'Error deleting message: Message not found',
      );
    });

    it('should throw an error when delete fails', async () => {
      const selectChain = buildChain([sampleMessage]);
      mockSelect.mockReturnValue(selectChain);

      mockDelete.mockImplementation(() => {
        throw new Error('Delete failed');
      });

      await expect(MessageModel.delete(1)).rejects.toThrow(
        'Error deleting message: Delete failed',
      );
    });
  });

  // -------------------------------------------------------------------------
  // deleteByUserId()
  // -------------------------------------------------------------------------
  describe('deleteByUserId()', () => {
    it('should delete all messages by user and return deleted messages', async () => {
      const userMessages = [sampleMessage, { ...sampleMessage, id: 2 }];

      // First select to get messages before deleting
      const selectChain = buildChain(userMessages);
      mockSelect.mockReturnValue(selectChain);

      const deleteChain = buildDeleteChain(undefined);
      mockDelete.mockReturnValue(deleteChain);

      const result = await MessageModel.deleteByUserId(10);

      expect(mockSelect).toHaveBeenCalled();
      expect(mockDelete).toHaveBeenCalled();
      expect(result).toEqual(userMessages);
    });

    it('should throw an error when delete fails', async () => {
      const selectChain = buildChain([sampleMessage]);
      mockSelect.mockReturnValue(selectChain);

      mockDelete.mockImplementation(() => {
        throw new Error('Batch delete failed');
      });

      await expect(MessageModel.deleteByUserId(10)).rejects.toThrow(
        'Error deleting messages by user ID: Batch delete failed',
      );
    });
  });

  // -------------------------------------------------------------------------
  // getMessageCount()
  // -------------------------------------------------------------------------
  describe('getMessageCount()', () => {
    it('should return the count of all messages', async () => {
      const selectChain = buildChain([{ count: 'id1' }, { count: 'id2' }, { count: 'id3' }]);
      mockSelect.mockReturnValue(selectChain);

      const result = await MessageModel.getMessageCount();

      expect(mockSelect).toHaveBeenCalled();
      expect(result).toBe(3); // result.length
    });

    it('should return 0 when no messages exist', async () => {
      const selectChain = buildChain([]);
      mockSelect.mockReturnValue(selectChain);

      const result = await MessageModel.getMessageCount();

      expect(result).toBe(0);
    });

    it('should throw an error when query fails', async () => {
      mockSelect.mockImplementation(() => {
        throw new Error('Count failed');
      });

      await expect(MessageModel.getMessageCount()).rejects.toThrow(
        'Error getting message count: Count failed',
      );
    });
  });

  // -------------------------------------------------------------------------
  // getUserMessageCount()
  // -------------------------------------------------------------------------
  describe('getUserMessageCount()', () => {
    it('should return the count of messages for a specific user', async () => {
      const selectChain = buildChain([{ count: 'id1' }, { count: 'id2' }]);
      mockSelect.mockReturnValue(selectChain);

      const result = await MessageModel.getUserMessageCount(10);

      expect(mockSelect).toHaveBeenCalled();
      expect(selectChain.where).toHaveBeenCalled();
      expect(result).toBe(2); // result.length
    });

    it('should return 0 when user has no messages', async () => {
      const selectChain = buildChain([]);
      mockSelect.mockReturnValue(selectChain);

      const result = await MessageModel.getUserMessageCount(999);

      expect(result).toBe(0);
    });

    it('should throw an error when query fails', async () => {
      mockSelect.mockImplementation(() => {
        throw new Error('User count failed');
      });

      await expect(MessageModel.getUserMessageCount(10)).rejects.toThrow(
        'Error getting user message count: User count failed',
      );
    });
  });

  // -------------------------------------------------------------------------
  // findAll()
  // -------------------------------------------------------------------------
  describe('findAll()', () => {
    it('should return all messages with user details', async () => {
      const messages = [sampleMessageWithUser, { ...sampleMessageWithUser, id: 2 }];
      const selectChain = buildChain(messages);
      mockSelect.mockReturnValue(selectChain);

      const result = await MessageModel.findAll();

      expect(mockSelect).toHaveBeenCalled();
      expect(selectChain.leftJoin).toHaveBeenCalled();
      expect(selectChain.orderBy).toHaveBeenCalled();
      expect(result).toEqual(messages);
    });

    it('should apply a limit when provided', async () => {
      const selectChain = buildChain([]);
      mockSelect.mockReturnValue(selectChain);

      await MessageModel.findAll(10);

      expect(selectChain.limit).toHaveBeenCalledWith(10);
    });

    it('should not call limit when limit is null', async () => {
      const selectChain = buildChain([]);
      mockSelect.mockReturnValue(selectChain);

      await MessageModel.findAll(null);

      expect(selectChain.limit).not.toHaveBeenCalled();
    });

    it('should throw an error when query fails', async () => {
      mockSelect.mockImplementation(() => {
        throw new Error('FindAll failed');
      });

      await expect(MessageModel.findAll()).rejects.toThrow(
        'Error finding all messages: FindAll failed',
      );
    });
  });

  // -------------------------------------------------------------------------
  // searchByContent()
  // -------------------------------------------------------------------------
  describe('searchByContent()', () => {
    it('should return messages matching the search term', async () => {
      const searchResults = [sampleMessageWithUser];
      const selectChain = buildChain(searchResults);
      mockSelect.mockReturnValue(selectChain);

      const result = await MessageModel.searchByContent('Hello');

      expect(mockSelect).toHaveBeenCalled();
      expect(selectChain.leftJoin).toHaveBeenCalled();
      expect(selectChain.where).toHaveBeenCalled();
      expect(selectChain.orderBy).toHaveBeenCalled();
      expect(selectChain.limit).toHaveBeenCalledWith(50);
      expect(result).toEqual(searchResults);
    });

    it('should accept a custom limit', async () => {
      const selectChain = buildChain([]);
      mockSelect.mockReturnValue(selectChain);

      await MessageModel.searchByContent('test', 10);

      expect(selectChain.limit).toHaveBeenCalledWith(10);
    });

    it('should return empty array when no matches', async () => {
      const selectChain = buildChain([]);
      mockSelect.mockReturnValue(selectChain);

      const result = await MessageModel.searchByContent('nonexistent');

      expect(result).toEqual([]);
    });

    it('should throw an error when query fails', async () => {
      mockSelect.mockImplementation(() => {
        throw new Error('Search failed');
      });

      await expect(MessageModel.searchByContent('hello')).rejects.toThrow(
        'Error searching messages: Search failed',
      );
    });
  });

  // -------------------------------------------------------------------------
  // find()
  // -------------------------------------------------------------------------
  describe('find()', () => {
    it('should return messages matching conditions', async () => {
      const messages = [sampleMessageWithUser];
      const selectChain = buildChain(messages);
      mockSelect.mockReturnValue(selectChain);

      const result = await MessageModel.find({ userId: 10 });

      expect(mockSelect).toHaveBeenCalled();
      expect(selectChain.leftJoin).toHaveBeenCalled();
      expect(selectChain.where).toHaveBeenCalled();
      expect(selectChain.orderBy).toHaveBeenCalled();
      expect(selectChain.limit).toHaveBeenCalledWith(50);
      expect(result).toEqual(messages);
    });

    it('should return all messages when no conditions are provided', async () => {
      const messages = [sampleMessageWithUser];
      const selectChain = buildChain(messages);
      mockSelect.mockReturnValue(selectChain);

      const result = await MessageModel.find();

      expect(selectChain.where).not.toHaveBeenCalled();
      expect(result).toEqual(messages);
    });
  });

  // -------------------------------------------------------------------------
  // findOne()
  // -------------------------------------------------------------------------
  describe('findOne()', () => {
    it('should return a single message matching conditions', async () => {
      const selectChain = buildChain([sampleMessageWithUser]);
      mockSelect.mockReturnValue(selectChain);

      const result = await MessageModel.findOne({ id: 1 });

      expect(mockSelect).toHaveBeenCalled();
      expect(selectChain.leftJoin).toHaveBeenCalled();
      expect(selectChain.where).toHaveBeenCalled();
      expect(selectChain.limit).toHaveBeenCalledWith(1);
      expect(result).toEqual(sampleMessageWithUser);
    });

    it('should return null when no message matches', async () => {
      const selectChain = buildChain([]);
      mockSelect.mockReturnValue(selectChain);

      const result = await MessageModel.findOne({ id: 999 });

      expect(result).toBeNull();
    });
  });
});
