import type { Request, Response, NextFunction, RequestHandler } from "express";

// Wraps async controllers to catch errors and pass them to the global error middleware
export const asyncHandler = (fn: (...args: any[]) => any): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
