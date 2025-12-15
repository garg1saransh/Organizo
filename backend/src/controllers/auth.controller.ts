import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import {
  createUser,
  findUserByEmail,
  findUserById,
  updateUserProfile,
} from '../services/user.service';

const JWT_SECRET = process.env.JWT_SECRET as string;

function signToken(userId: string) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '7d' });
}


//Register Function
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function register(req: Request, res: Response) {
  const { email, password, name } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: 'Invalid email format' });
  }

  if (password.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters' });
  }

  const existing = await findUserByEmail(email);
  if (existing) {
    return res.status(400).json({ message: 'Email already in use' });
  }

  const user = await createUser(email, password, name);
  const token = signToken(user.id);

  return res.status(201).json({ user, token });
}


//Login Function
export async function login(req: Request, res: Response) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: 'Invalid email format' });
  }

  const user = await findUserByEmail(email);
  if (!user) {
    return res.status(400).json({ message: 'Invalid credentials' });
  }

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    return res.status(400).json({ message: 'Invalid credentials' });
  }

  const token = signToken(user.id);
  const { password: _pw, ...safeUser } = user;

  return res.json({ user: safeUser, token });
}



//Get Current User Function
export async function me(req: Request, res: Response) {
  const userId = (req as any).userId as string;
  const user = await findUserById(userId);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }
  return res.json({ user });
}


//Update Profile Function
export async function updateProfile(req: Request, res: Response) {
  const userId = (req as any).userId as string;
  const { name } = req.body;

  const user = await updateUserProfile(userId, name);
  return res.json({ user });
}