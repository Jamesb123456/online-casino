// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks -- use vi.hoisted so variables are available in vi.mock factories
// ---------------------------------------------------------------------------

const {
  mockSelect,
  mockInsert,
  mockUpdate,
  mockDelete,
  mockExecute,
  mockBcryptCompare,
} = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
  mockExecute: vi.fn(),
  mockBcryptCompare: vi.fn(),
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
  users: {
    id: 'id',
    username: 'username',
    role: 'role',
    balance: 'balance',
    avatar: 'avatar',
    isActive: 'isActive',
    lastLogin: 'lastLogin',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    passwordHash: 'passwordHash',
    email: 'email',
    name: 'name',
    emailVerified: 'emailVerified',
    image: 'image',
    displayUsername: 'displayUsername',
    banned: 'banned',
    banReason: 'banReason',
    banExpires: 'banExpires',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args) => ({ type: 'eq', args })),
  and: vi.fn((...args) => ({ type: 'and', args })),
  or: vi.fn((...args) => ({ type: 'or', args })),
  desc: vi.fn((col) => ({ type: 'desc', col })),
  asc: vi.fn((col) => ({ type: 'asc', col })),
  sql: vi.fn((...args) => ({ type: 'sql', args })),
  count: vi.fn(() => 'count'),
  like: vi.fn((...args) => ({ type: 'like', args })),
  between: vi.fn((...args) => ({ type: 'between', args })),
  gte: vi.fn((...args) => ({ type: 'gte', args })),
  lte: vi.fn((...args) => ({ type: 'lte', args })),
  isNull: vi.fn((col) => ({ type: 'isNull', col })),
  isNotNull: vi.fn((col) => ({ type: 'isNotNull', col })),
  inArray: vi.fn((...args) => ({ type: 'inArray', args })),
  sum: vi.fn(() => 'sum'),
}));

vi.mock('bcryptjs', () => ({
  default: {
    compare: mockBcryptCompare,
    hash: vi.fn(),
    genSalt: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Import the model AFTER mocks are established
// ---------------------------------------------------------------------------
import UserModel from '../../../drizzle/models/User.js';

// ---------------------------------------------------------------------------
// Helpers -- build a fluent chain that resolves to the provided data
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
  // Make chain thenable so `await` works
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

const sampleUser = {
  id: 1,
  username: 'testuser',
  email: 'test@example.com',
  name: 'Test User',
  emailVerified: false,
  role: 'user',
  balance: '100.00',
  avatar: '',
  isActive: true,
  lastLogin: new Date('2025-01-01'),
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
  passwordHash: '$2a$10$hashedpassword',
};

const sampleSecureUser = {
  id: 1,
  username: 'testuser',
  role: 'user',
  balance: '100.00',
  avatar: '',
  isActive: true,
  lastLogin: new Date('2025-01-01'),
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('UserModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // create()
  // -------------------------------------------------------------------------
  describe('create()', () => {
    it('should insert a user and return the created user', async () => {
      const insertResult = { insertId: 1 };
      const insertChain = buildInsertChain(insertResult);
      mockInsert.mockReturnValue(insertChain);

      // After insert, it does a select to fetch the created user
      const selectChain = buildChain([sampleUser]);
      mockSelect.mockReturnValue(selectChain);

      const result = await UserModel.create({
        username: 'testuser',
        email: 'test@example.com',
        name: 'Test User',
        passwordHash: '$2a$10$hashedpassword',
      });

      expect(mockInsert).toHaveBeenCalled();
      expect(mockSelect).toHaveBeenCalled();
      expect(result).toEqual(sampleUser);
    });

    it('should include createdAt and updatedAt in the inserted values', async () => {
      const insertChain = buildInsertChain({ insertId: 1 });
      mockInsert.mockReturnValue(insertChain);

      const selectChain = buildChain([sampleUser]);
      mockSelect.mockReturnValue(selectChain);

      await UserModel.create({ username: 'testuser', email: 'test@example.com' });

      // Verify values() was called with createdAt and updatedAt
      const valuesCall = insertChain.values.mock.calls[0][0];
      expect(valuesCall).toHaveProperty('createdAt');
      expect(valuesCall).toHaveProperty('updatedAt');
      expect(valuesCall.createdAt).toBeInstanceOf(Date);
      expect(valuesCall.updatedAt).toBeInstanceOf(Date);
    });

    it('should throw an error when insert fails', async () => {
      mockInsert.mockImplementation(() => {
        throw new Error('DB connection lost');
      });

      await expect(
        UserModel.create({ username: 'fail' }),
      ).rejects.toThrow('Error creating user: DB connection lost');
    });
  });

  // -------------------------------------------------------------------------
  // findById()
  // -------------------------------------------------------------------------
  describe('findById()', () => {
    it('should return the user when found', async () => {
      const selectChain = buildChain([sampleUser]);
      mockSelect.mockReturnValue(selectChain);

      const result = await UserModel.findById(1);

      expect(mockSelect).toHaveBeenCalled();
      expect(result).toEqual(sampleUser);
    });

    it('should return null when user is not found', async () => {
      const selectChain = buildChain([]);
      mockSelect.mockReturnValue(selectChain);

      const result = await UserModel.findById(999);

      expect(result).toBeNull();
    });

    it('should throw an error when query fails', async () => {
      mockSelect.mockImplementation(() => {
        throw new Error('Query failed');
      });

      await expect(UserModel.findById(1)).rejects.toThrow(
        'Error finding user by ID: Query failed',
      );
    });
  });

  // -------------------------------------------------------------------------
  // findOne()
  // -------------------------------------------------------------------------
  describe('findOne()', () => {
    it('should find user by username', async () => {
      const selectChain = buildChain([sampleUser]);
      mockSelect.mockReturnValue(selectChain);

      const result = await UserModel.findOne({ username: 'testuser' });

      expect(mockSelect).toHaveBeenCalled();
      expect(result).toEqual(sampleUser);
    });

    it('should find user by role', async () => {
      const adminUser = { ...sampleUser, role: 'admin' };
      const selectChain = buildChain([adminUser]);
      mockSelect.mockReturnValue(selectChain);

      const result = await UserModel.findOne({ role: 'admin' });

      expect(result).toEqual(adminUser);
    });

    it('should return null when no user matches the filter', async () => {
      const selectChain = buildChain([]);
      mockSelect.mockReturnValue(selectChain);

      const result = await UserModel.findOne({ username: 'nonexistent' });

      expect(result).toBeNull();
    });

    it('should throw an error when no filter conditions are provided', async () => {
      await expect(UserModel.findOne({})).rejects.toThrow(
        'Error finding user: No filter conditions provided',
      );
    });
  });

  // -------------------------------------------------------------------------
  // updateById()
  // -------------------------------------------------------------------------
  describe('updateById()', () => {
    it('should update the user and return the updated record', async () => {
      const updatedUser = { ...sampleUser, username: 'updated_user' };

      const updateChain = buildUpdateChain(undefined);
      mockUpdate.mockReturnValue(updateChain);

      const selectChain = buildChain([updatedUser]);
      mockSelect.mockReturnValue(selectChain);

      const result = await UserModel.updateById(1, { username: 'updated_user' });

      expect(mockUpdate).toHaveBeenCalled();
      expect(mockSelect).toHaveBeenCalled();
      expect(result).toEqual(updatedUser);
    });

    it('should include updatedAt in the set values', async () => {
      const updateChain = buildUpdateChain(undefined);
      mockUpdate.mockReturnValue(updateChain);

      const selectChain = buildChain([sampleUser]);
      mockSelect.mockReturnValue(selectChain);

      await UserModel.updateById(1, { balance: '200.00' });

      const setCall = updateChain.set.mock.calls[0][0];
      expect(setCall).toHaveProperty('updatedAt');
      expect(setCall.updatedAt).toBeInstanceOf(Date);
      expect(setCall.balance).toBe('200.00');
    });

    it('should throw an error when update fails', async () => {
      mockUpdate.mockImplementation(() => {
        throw new Error('Update failed');
      });

      await expect(
        UserModel.updateById(1, { balance: '200.00' }),
      ).rejects.toThrow('Error updating user: Update failed');
    });
  });

  // -------------------------------------------------------------------------
  // update() -- alias for updateById
  // -------------------------------------------------------------------------
  describe('update()', () => {
    it('should delegate to updateById', async () => {
      const updateChain = buildUpdateChain(undefined);
      mockUpdate.mockReturnValue(updateChain);

      const selectChain = buildChain([sampleUser]);
      mockSelect.mockReturnValue(selectChain);

      const result = await UserModel.update(1, { balance: '300.00' });

      expect(mockUpdate).toHaveBeenCalled();
      expect(result).toEqual(sampleUser);
    });
  });

  // -------------------------------------------------------------------------
  // comparePassword()
  // -------------------------------------------------------------------------
  describe('comparePassword()', () => {
    it('should return true when the password matches', async () => {
      mockBcryptCompare.mockResolvedValue(true);

      const result = await UserModel.comparePassword('password123', '$2a$10$hashedpassword');

      expect(mockBcryptCompare).toHaveBeenCalledWith('password123', '$2a$10$hashedpassword');
      expect(result).toBe(true);
    });

    it('should return false when the password does not match', async () => {
      mockBcryptCompare.mockResolvedValue(false);

      const result = await UserModel.comparePassword('wrongpass', '$2a$10$hashedpassword');

      expect(mockBcryptCompare).toHaveBeenCalledWith('wrongpass', '$2a$10$hashedpassword');
      expect(result).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // findByIdSecure()
  // -------------------------------------------------------------------------
  describe('findByIdSecure()', () => {
    it('should return user without sensitive fields', async () => {
      const selectChain = buildChain([sampleSecureUser]);
      mockSelect.mockReturnValue(selectChain);

      const result = await UserModel.findByIdSecure(1);

      expect(mockSelect).toHaveBeenCalled();
      expect(result).toEqual(sampleSecureUser);
      // The select call should use a specific field list (not select() with no args)
      const selectCall = mockSelect.mock.calls[0][0];
      expect(selectCall).toBeDefined();
      expect(selectCall).toHaveProperty('id');
      expect(selectCall).toHaveProperty('username');
      expect(selectCall).not.toHaveProperty('passwordHash');
    });

    it('should return null when user is not found', async () => {
      const selectChain = buildChain([]);
      mockSelect.mockReturnValue(selectChain);

      const result = await UserModel.findByIdSecure(999);

      expect(result).toBeNull();
    });

    it('should throw an error when query fails', async () => {
      mockSelect.mockImplementation(() => {
        throw new Error('Secure query failed');
      });

      await expect(UserModel.findByIdSecure(1)).rejects.toThrow(
        'Error finding secure user by ID: Secure query failed',
      );
    });
  });

  // -------------------------------------------------------------------------
  // updateLastLogin()
  // -------------------------------------------------------------------------
  describe('updateLastLogin()', () => {
    it('should update the lastLogin timestamp and return the user', async () => {
      const userWithNewLogin = { ...sampleUser, lastLogin: new Date() };

      const updateChain = buildUpdateChain(undefined);
      mockUpdate.mockReturnValue(updateChain);

      const selectChain = buildChain([userWithNewLogin]);
      mockSelect.mockReturnValue(selectChain);

      const result = await UserModel.updateLastLogin(1);

      expect(mockUpdate).toHaveBeenCalled();
      const setCall = updateChain.set.mock.calls[0][0];
      expect(setCall).toHaveProperty('lastLogin');
      expect(setCall.lastLogin).toBeInstanceOf(Date);
      expect(setCall).toHaveProperty('updatedAt');
      expect(result).toEqual(userWithNewLogin);
    });

    it('should throw an error when update fails', async () => {
      mockUpdate.mockImplementation(() => {
        throw new Error('Login update failed');
      });

      await expect(UserModel.updateLastLogin(1)).rejects.toThrow(
        'Error updating last login: Login update failed',
      );
    });
  });

  // -------------------------------------------------------------------------
  // delete()
  // -------------------------------------------------------------------------
  describe('delete()', () => {
    it('should delete the user and return the deleted user', async () => {
      // First call: select to get user before deletion
      const selectChain = buildChain([sampleUser]);
      mockSelect.mockReturnValue(selectChain);

      // Second call: delete
      const deleteChain = buildDeleteChain(undefined);
      mockDelete.mockReturnValue(deleteChain);

      const result = await UserModel.delete(1);

      expect(mockSelect).toHaveBeenCalled();
      expect(mockDelete).toHaveBeenCalled();
      expect(result).toEqual(sampleUser);
    });

    it('should throw an error when delete fails', async () => {
      // Select succeeds but delete fails
      const selectChain = buildChain([sampleUser]);
      mockSelect.mockReturnValue(selectChain);

      mockDelete.mockImplementation(() => {
        throw new Error('Delete failed');
      });

      await expect(UserModel.delete(1)).rejects.toThrow(
        'Error deleting user: Delete failed',
      );
    });
  });

  // -------------------------------------------------------------------------
  // find()
  // -------------------------------------------------------------------------
  describe('find()', () => {
    it('should return all users with secure fields', async () => {
      const usersList = [sampleSecureUser, { ...sampleSecureUser, id: 2, username: 'user2' }];
      const selectChain = buildChain(usersList);
      mockSelect.mockReturnValue(selectChain);

      const result = await UserModel.find();

      expect(mockSelect).toHaveBeenCalled();
      expect(result).toEqual(usersList);
    });

    it('should filter by role when provided', async () => {
      const adminUsers = [{ ...sampleSecureUser, role: 'admin' }];
      const selectChain = buildChain(adminUsers);
      mockSelect.mockReturnValue(selectChain);

      const result = await UserModel.find({ role: 'admin' });

      expect(result).toEqual(adminUsers);
    });

    it('should apply limit and offset when provided', async () => {
      const selectChain = buildChain([sampleSecureUser]);
      mockSelect.mockReturnValue(selectChain);

      const result = await UserModel.find({}, { limit: 10, offset: 5 });

      expect(selectChain.limit).toHaveBeenCalledWith(10);
      expect(selectChain.offset).toHaveBeenCalledWith(5);
      expect(result).toEqual([sampleSecureUser]);
    });

    it('should apply orderBy descending createdAt', async () => {
      const selectChain = buildChain([sampleSecureUser]);
      mockSelect.mockReturnValue(selectChain);

      await UserModel.find();

      expect(selectChain.orderBy).toHaveBeenCalled();
    });

    it('should throw an error when query fails', async () => {
      mockSelect.mockImplementation(() => {
        throw new Error('Find all failed');
      });

      await expect(UserModel.find()).rejects.toThrow(
        'Error finding all users: Find all failed',
      );
    });
  });

  // -------------------------------------------------------------------------
  // findAll() -- alias
  // -------------------------------------------------------------------------
  describe('findAll()', () => {
    it('should delegate to find with default limit and offset', async () => {
      const selectChain = buildChain([sampleSecureUser]);
      mockSelect.mockReturnValue(selectChain);

      const result = await UserModel.findAll();

      expect(mockSelect).toHaveBeenCalled();
      expect(selectChain.limit).toHaveBeenCalledWith(50);
      // offset(0) is not called because 0 is falsy in `if (options.offset)` check
    });

    it('should pass custom limit and offset', async () => {
      const selectChain = buildChain([sampleSecureUser]);
      mockSelect.mockReturnValue(selectChain);

      await UserModel.findAll(20, 10);

      expect(selectChain.limit).toHaveBeenCalledWith(20);
      expect(selectChain.offset).toHaveBeenCalledWith(10);
    });
  });
});
