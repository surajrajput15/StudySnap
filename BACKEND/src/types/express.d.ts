declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userRole?: import('../config/constants').UserRole;
      userPermissions?: readonly import('../config/constants').Permission[];
      userEmail?: string;
      /** Set by requestLogger at middleware entry for duration tracking. */
      _startTime?: number;
    }
  }
}

export {};