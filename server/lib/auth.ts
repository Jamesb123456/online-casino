import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username } from "better-auth/plugins";
import { admin } from "better-auth/plugins";
import bcrypt from "bcryptjs";
import { db } from "../drizzle/db.js";
import * as schema from "../drizzle/schema.js";
import UserModel from "../drizzle/models/User.js";
import Balance from "../drizzle/models/Balance.js";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "mysql",
    schema: {
      ...schema,
      user: schema.users,
    },
  }),
  basePath: "/api/auth",
  emailAndPassword: {
    enabled: true,
    password: {
      hash: async (password: string) => bcrypt.hash(password, 12),
      verify: async ({ password, hash }: { password: string; hash: string }) =>
        bcrypt.compare(password, hash),
    },
  },
  user: {
    modelName: "users",
    additionalFields: {
      passwordHash: {
        type: "string",
        required: false,
        input: false,
      },
      balance: {
        type: "string",
        required: false,
        defaultValue: "0",
        input: false,
      },
      avatar: {
        type: "string",
        required: false,
        defaultValue: "",
        input: false,
      },
      isActive: {
        type: "boolean",
        required: false,
        defaultValue: true,
        input: false,
      },
      lastLogin: {
        type: "date",
        required: false,
        input: false,
      },
    },
  },
  session: {
    modelName: "session",
    expiresIn: 60 * 60 * 24, // 24 hours (session lifetime)
    updateAge: 60 * 60, // Refresh session every 1 hour
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // Cache cookie for 5 minutes
    },
  },
  advanced: {
    database: {
      generateId: "serial",
    },
  },
  plugins: [
    username({
      minUsernameLength: 3,
      maxUsernameLength: 30,
    }),
    admin({
      defaultRole: "user",
      adminRoles: ["admin"],
    }),
  ],
  trustedOrigins: [process.env.CLIENT_URL || "http://localhost"],
  databaseHooks: {
    user: {
      create: {
        after: async (user: any) => {
          // Set initial balance for new users
          const userId = Number(user.id);
          await UserModel.updateById(userId, { balance: "1000" });
          await Balance.create({
            userId,
            amount: "1000",
            previousBalance: "0",
            changeAmount: "1000",
            type: "deposit",
            note: "Welcome bonus - account creation",
            createdAt: new Date(),
          });
        },
      },
    },
  },
});

export type AuthType = typeof auth;
