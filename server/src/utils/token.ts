import jwt from 'jsonwebtoken';
import type { TokenPayload, DecodedToken } from '../types';

const SECRET: string = process.env.JWT_SECRET!;
if (!SECRET) {
  throw new Error('JWT_SECRET environment variable is required. Set it in .env or your environment.');
}

export function signAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: '15m' });
}

export function verifyToken(token: string): DecodedToken {
  return jwt.verify(token, SECRET) as DecodedToken;
}
