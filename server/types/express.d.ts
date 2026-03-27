// Global type declarations for Express
declare namespace Express {
  export interface User {
    userId: number;
    username: string;
    role?: string;
  }

  export interface Request {
    user?: User;
  }
}
