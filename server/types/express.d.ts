// Global type declarations for Express
declare namespace Express {
  export interface User {
    id: number;
    userId?: number; // For backward compatibility
    username: string;
    email?: string;
    role?: string;
  }
  
  export interface Request {
    user?: User;
  }
}
