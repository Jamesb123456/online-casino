// @ts-nocheck
import { eq, desc, and, gte, lte } from 'drizzle-orm';
import { db } from '../db.js';
import { messages, users } from '../schema.js';

class MessageModel {
  // Create a new message
  static async create(data) {
    try {
      const result = await db.insert(messages).values(data);
      
      // For MySQL, we need to get the inserted message by insertId
      if (result.insertId) {
        const [newMessage] = await db
          .select()
          .from(messages)
          .where(eq(messages.id, result.insertId));
        return newMessage;
      }
      
      // Fallback if insertId is not available
      return { id: result.insertId, ...data };
    } catch (error) {
      throw new Error(`Error creating message: ${error.message}`);
    }
  }

  // Find message by ID
  static async findById(id) {
    const result = await db
      .select({
        id: messages.id,
        content: messages.content,
        createdAt: messages.createdAt,
        userId: messages.userId,
        isSystem: messages.isSystem,
        user: {
          id: users.id,
          username: users.username,
          avatar: users.avatar
        }
      })
      .from(messages)
      .leftJoin(users, eq(messages.userId, users.id))
      .where(eq(messages.id, id))
      .limit(1);
    
    return result[0] || null;
  }

  // Find message by ID with user details
  static async findByIdWithUser(id) {
    try {
      const [message] = await db
        .select({
          id: messages.id,
          content: messages.content,
          userId: messages.userId,
          createdAt: messages.createdAt,
          username: users.username,
          avatar: users.avatar,
        })
        .from(messages)
        .leftJoin(users, eq(messages.userId, users.id))
        .where(eq(messages.id, id));

      return message || null;
    } catch (error) {
      throw new Error(`Error finding message with user: ${error.message}`);
    }
  }

  // Get recent messages with user details
  static async getRecentMessages(limit = 50) {
    try {
      const recentMessages = await db
        .select({
          id: messages.id,
          content: messages.content,
          userId: messages.userId,
          createdAt: messages.createdAt,
          username: users.username,
          avatar: users.avatar,
        })
        .from(messages)
        .leftJoin(users, eq(messages.userId, users.id))
        .orderBy(desc(messages.createdAt))
        .limit(limit);

      return recentMessages;
    } catch (error) {
      throw new Error(`Error getting recent messages: ${error.message}`);
    }
  }

  // Find messages by user ID
  static async findByUserId(userId, limit = 50, offset = 0) {
    try {
      const userMessages = await db
        .select()
        .from(messages)
        .where(eq(messages.userId, userId))
        .orderBy(desc(messages.createdAt))
        .limit(limit)
        .offset(offset);

      return userMessages;
    } catch (error) {
      throw new Error(`Error finding messages by user ID: ${error.message}`);
    }
  }

  // Get messages with pagination
  static async findWithPagination(limit = 50, offset = 0) {
    try {
      const paginatedMessages = await db
        .select({
          id: messages.id,
          content: messages.content,
          userId: messages.userId,
          createdAt: messages.createdAt,
          username: users.username,
          avatar: users.avatar,
        })
        .from(messages)
        .leftJoin(users, eq(messages.userId, users.id))
        .orderBy(desc(messages.createdAt))
        .limit(limit)
        .offset(offset);

      return paginatedMessages;
    } catch (error) {
      throw new Error(`Error finding messages with pagination: ${error.message}`);
    }
  }

  // Update message
  static async update(id, updateData) {
    try {
      await db
        .update(messages)
        .set(updateData)
        .where(eq(messages.id, id));

      // Get the updated message
      const [updatedMessage] = await db
        .select()
        .from(messages)
        .where(eq(messages.id, id));

      return updatedMessage;
    } catch (error) {
      throw new Error(`Error updating message: ${error.message}`);
    }
  }

  // Delete message
  static async delete(id) {
    try {
      // Get the message before deleting
      const [messageToDelete] = await db
        .select()
        .from(messages)
        .where(eq(messages.id, id));

      if (!messageToDelete) {
        throw new Error('Message not found');
      }

      await db
        .delete(messages)
        .where(eq(messages.id, id));

      return messageToDelete;
    } catch (error) {
      throw new Error(`Error deleting message: ${error.message}`);
    }
  }

  // Delete messages by user ID (for cleanup)
  static async deleteByUserId(userId) {
    try {
      // Get messages before deleting
      const messagesToDelete = await db
        .select()
        .from(messages)
        .where(eq(messages.userId, userId));

      await db
        .delete(messages)
        .where(eq(messages.userId, userId));

      return messagesToDelete;
    } catch (error) {
      throw new Error(`Error deleting messages by user ID: ${error.message}`);
    }
  }

  // Get message count
  static async getMessageCount() {
    try {
      const result = await db.select({ count: messages.id }).from(messages);
      return result.length;
    } catch (error) {
      throw new Error(`Error getting message count: ${error.message}`);
    }
  }

  // Get message count for a specific user
  static async getUserMessageCount(userId) {
    try {
      const result = await db
        .select({ count: messages.id })
        .from(messages)
        .where(eq(messages.userId, userId));
      return result.length;
    } catch (error) {
      throw new Error(`Error getting user message count: ${error.message}`);
    }
  }

  // Get all messages (with optional limit)
  static async findAll(limit = null) {
    try {
      let query = db
        .select({
          id: messages.id,
          content: messages.content,
          userId: messages.userId,
          createdAt: messages.createdAt,
          username: users.username,
          avatar: users.avatar,
        })
        .from(messages)
        .leftJoin(users, eq(messages.userId, users.id))
        .orderBy(desc(messages.createdAt));

      if (limit) {
        query = query.limit(limit);
      }

      const allMessages = await query;
      return allMessages;
    } catch (error) {
      throw new Error(`Error finding all messages: ${error.message}`);
    }
  }

  // Search messages by content (simple text search)
  static async searchByContent(searchTerm, limit = 50) {
    try {
      // Note: This is a simple search. For production, consider using full-text search
      const searchResults = await db
        .select({
          id: messages.id,
          content: messages.content,
          userId: messages.userId,
          createdAt: messages.createdAt,
          username: users.username,
          avatar: users.avatar,
        })
        .from(messages)
        .leftJoin(users, eq(messages.userId, users.id))
        .where(messages.content.includes(searchTerm))
        .orderBy(desc(messages.createdAt))
        .limit(limit);

      return searchResults;
    } catch (error) {
      throw new Error(`Error searching messages: ${error.message}`);
    }
  }

  static async find(conditions = {}) {
    let query = db
      .select({
        id: messages.id,
        content: messages.content,
        createdAt: messages.createdAt,
        userId: messages.userId,
        isSystem: messages.isSystem,
        username: users.username,
        avatar: users.avatar
      })
      .from(messages)
      .leftJoin(users, eq(messages.userId, users.id));

    const whereConditions = [];
    
    Object.entries(conditions).forEach(([key, value]) => {
      if (typeof value === 'object' && value.$gte && value.$lte) {
        whereConditions.push(and(
          gte(messages[key], value.$gte),
          lte(messages[key], value.$lte)
        ));
      } else {
        whereConditions.push(eq(messages[key], value));
      }
    });

    if (whereConditions.length > 0) {
      query = query.where(and(...whereConditions));
    }

    return await query.orderBy(desc(messages.createdAt)).limit(50);
  }

  static async findOne(conditions) {
    const whereConditions = [];
    
    Object.entries(conditions).forEach(([key, value]) => {
      whereConditions.push(eq(messages[key], value));
    });

    const result = await db
      .select({
        id: messages.id,
        content: messages.content,
        createdAt: messages.createdAt,
        userId: messages.userId,
        isSystem: messages.isSystem,
        username: users.username,
        avatar: users.avatar
      })
      .from(messages)
      .leftJoin(users, eq(messages.userId, users.id))
      .where(and(...whereConditions))
      .limit(1);
    
    return result[0] || null;
  }

  // Instance method for save functionality
  async save() {
    if (this.id) {
      await db
        .update(messages)
        .set(this)
        .where(eq(messages.id, this.id));
      
      // Get the updated message
      const [updatedMessage] = await db
        .select()
        .from(messages)
        .where(eq(messages.id, this.id));
      
      Object.assign(this, updatedMessage);
      return this;
    } else {
      const result = await db.insert(messages).values(this);
      this.id = result.insertId;
      return this;
    }
  }
}

export default MessageModel; 