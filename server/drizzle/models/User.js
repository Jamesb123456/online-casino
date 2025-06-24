import { eq, desc } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { users } from '../schema.js';

class UserModel {
  // Create a new user
  static async create(userData) {
    try {
      // Hash password if provided
      if (userData.passwordHash) {
        const salt = await bcrypt.genSalt(10);
        userData.passwordHash = await bcrypt.hash(userData.passwordHash, salt);
      }

      const result = await db.insert(users).values({
        ...userData,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Get the created user by ID
      const userId = result.insertId;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      return user;
    } catch (error) {
      throw new Error(`Error creating user: ${error.message}`);
    }
  }

  // Find user by ID
  static async findById(id) {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      return user || null;
    } catch (error) {
      throw new Error(`Error finding user by ID: ${error.message}`);
    }
  }

  // Find user by criteria
  static async findOne(filter) {
    try {
      const conditions = [];
      if (filter.username) conditions.push(eq(users.username, filter.username));
      if (filter.role) conditions.push(eq(users.role, filter.role));

      if (conditions.length === 0) {
        throw new Error('No filter conditions provided');
      }

      const [user] = await db.select().from(users).where(conditions[0]);
      return user || null;
    } catch (error) {
      throw new Error(`Error finding user: ${error.message}`);
    }
  }

  // Update user by ID
  static async updateById(id, updateData) {
    try {
      // Hash password if being updated
      if (updateData.passwordHash) {
        const salt = await bcrypt.genSalt(10);
        updateData.passwordHash = await bcrypt.hash(updateData.passwordHash, salt);
      }

      await db
        .update(users)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(users.id, id));

      // Return the updated user
      const [updatedUser] = await db.select().from(users).where(eq(users.id, id));
      return updatedUser;
    } catch (error) {
      throw new Error(`Error updating user: ${error.message}`);
    }
  }

  // Update user (alias for updateById)
  static async update(id, updateData) {
    return this.updateById(id, updateData);
  }

  // Compare password (for login)
  static async comparePassword(candidatePassword, hashedPassword) {
    return await bcrypt.compare(candidatePassword, hashedPassword);
  }

  // Get user without password
  static async findByIdSecure(id) {
    try {
      const [user] = await db
        .select({
          id: users.id,
          username: users.username,
          role: users.role,
          balance: users.balance,
          email: users.email,
          avatar: users.avatar,
          isActive: users.isActive,
          lastLogin: users.lastLogin,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        })
        .from(users)
        .where(eq(users.id, id));
      
      return user || null;
    } catch (error) {
      throw new Error(`Error finding secure user by ID: ${error.message}`);
    }
  }

  // Update last login
  static async updateLastLogin(id) {
    try {
      await db
        .update(users)
        .set({ lastLogin: new Date(), updatedAt: new Date() })
        .where(eq(users.id, id));

      // Return the updated user
      const [updatedUser] = await db.select().from(users).where(eq(users.id, id));
      return updatedUser;
    } catch (error) {
      throw new Error(`Error updating last login: ${error.message}`);
    }
  }

  // Delete user
  static async delete(id) {
    try {
      // Get user before deletion
      const [user] = await db.select().from(users).where(eq(users.id, id));
      
      await db.delete(users).where(eq(users.id, id));
      
      return user;
    } catch (error) {
      throw new Error(`Error deleting user: ${error.message}`);
    }
  }

  // Get all users (with pagination)
  static async find(filter = {}, options = {}) {
    try {
      let query = db
        .select({
          id: users.id,
          username: users.username,
          role: users.role,
          balance: users.balance,
          email: users.email,
          avatar: users.avatar,
          isActive: users.isActive,
          lastLogin: users.lastLogin,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        })
        .from(users);

      // Apply filters
      if (filter.role) {
        query = query.where(eq(users.role, filter.role));
      }

      // Apply sorting
      query = query.orderBy(desc(users.createdAt));

      // Apply pagination
      if (options.limit) {
        query = query.limit(options.limit);
      }
      if (options.offset) {
        query = query.offset(options.offset);
      }

      const allUsers = await query;
      return allUsers;
    } catch (error) {
      throw new Error(`Error finding all users: ${error.message}`);
    }
  }

  // Alias for find with no parameters
  static async findAll(limit = 50, offset = 0) {
    return this.find({}, { limit, offset });
  }
}

export default UserModel; 