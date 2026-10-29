import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import type { Role, User } from './types.js';

const jwtSecret = process.env.JWT_SECRET ?? 'development-only-change-me';

export interface AuthenticatedRequest extends Request {
  user?: Pick<User, 'id' | 'email' | 'name' | 'role'>;
}

export function issueToken(user: User): string {
  return jwt.sign(
    { sub: user.id, email: user.email, name: user.name, role: user.role },
    jwtSecret,
    { expiresIn: '8h' }
  );
}

export function requireAuth(request: AuthenticatedRequest, response: Response, next: NextFunction): void {
  const header = request.header('authorization');
  if (!header?.startsWith('Bearer ')) {
    response.status(401).json({ error: 'Authentication required' });
    return;
  }
  try {
    const payload = jwt.verify(header.slice(7), jwtSecret) as Pick<User, 'id' | 'email' | 'name' | 'role'>;
    request.user = payload;
    next();
  } catch {
    response.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireRole(...roles: Role[]) {
  return (request: AuthenticatedRequest, response: Response, next: NextFunction): void => {
    if (!request.user || !roles.includes(request.user.role)) {
      response.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}
