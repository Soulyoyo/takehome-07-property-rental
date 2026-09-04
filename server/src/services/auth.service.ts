import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDb } from '../db/database.js';
import { config } from '../config.js';
import { User, AuthTokenPayload } from '../types/index.js';

export class AuthService {
  static login(email: string, password: string, customDb?: any): { user: User; token: string } {
    const db = customDb || getDb();

    if (!email || !password) {
      throw { status: 400, message: 'Email and password are required.' };
    }

    const user = db.prepare(`
      SELECT * FROM users WHERE email = ?
    `).get(email.trim().toLowerCase()) as User | undefined;

    if (!user || !user.password_hash) {
      throw { status: 401, message: 'Invalid email or password.' };
    }

    const isMatch = bcrypt.compareSync(password, user.password_hash);
    if (!isMatch) {
      throw { status: 401, message: 'Invalid email or password.' };
    }

    const payload: AuthTokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    };

    const token = jwt.sign(payload, config.jwtSecret, {
      expiresIn: config.jwtExpiresIn as any,
    });

    const sanitizedUser: User = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      specialty: user.specialty,
      created_at: user.created_at,
    };

    return { user: sanitizedUser, token };
  }

  static getUserById(id: number, customDb?: any): User | null {
    const db = customDb || getDb();
    const user = db.prepare(`
      SELECT id, email, name, role, specialty, created_at
      FROM users WHERE id = ?
    `).get(id) as User | undefined;

    return user || null;
  }

  static listContractors(customDb?: any): User[] {
    const db = customDb || getDb();
    return db.prepare(`
      SELECT id, email, name, role, specialty, created_at
      FROM users
      WHERE role = 'contractor'
      ORDER BY name ASC
    `).all() as User[];
  }
}
