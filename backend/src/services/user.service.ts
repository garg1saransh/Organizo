import bcrypt from 'bcrypt';
import prisma from '../utils/prisma';

const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS) || 12;

export async function createUser(email: string, password: string, name?: string) {
  const hashed = await bcrypt.hash(password, SALT_ROUNDS);
  return prisma.user.create({
    data: { email, password: hashed, name },
    select: { id: true, email: true, name: true, createdAt: true },
  });
}

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export async function findUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, name: true, createdAt: true },
  });
}

export async function updateUserProfile(id: string, name?: string) {
  return prisma.user.update({
    where: { id },
    data: { name },
    select: { id: true, email: true, name: true, createdAt: true },
  });
}