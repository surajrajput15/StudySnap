declare global {
  namespace Express {
    interface Request {
      userId?: string;
      /** Set by requestLogger at middleware entry for duration tracking. */
      _startTime?: number;
    }
  }
}

export {};