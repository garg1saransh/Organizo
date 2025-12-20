import prisma from '../utils/prisma';
import { createTask, updateTaskForUser } from './task.service';

// Simple Jest mock for prisma.task methods
jest.mock('../utils/prisma', () => ({
  __esModule: true,
  default: {
    task: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  },
}));

// Re-import after mock so TS type is correct
import mockedPrisma from '../utils/prisma';

const prismaMock = mockedPrisma as unknown as {
  task: {
    create: jest.Mock;
    findFirst: jest.Mock;
    update: jest.Mock;
  };
};

describe('task.service', () => {
  const creatorId = 'user-1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('createTask creates a task with defaults', async () => {
    const input = {
      title: 'Test task',
      description: 'desc',
      priority: 'HIGH' as const,
      status: 'ToDo' as const,
      dueDate: null as string | null,
      assignedToId: null as string | null,
    };

    const created = {
      id: 'task-1',
      ...input,
      creatorId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    prismaMock.task.create.mockResolvedValue(created);

    const result = await createTask(creatorId, input);

    expect(prismaMock.task.create).toHaveBeenCalledTimes(1);
    expect(result).toEqual(created);
  });

  it('updateTaskForUser updates task fields', async () => {
    const existing = {
      id: 'task-1',
      title: 'Old',
      description: 'Old desc',
      priority: 'LOW' as const,
      status: 'ToDo' as const,
      dueDate: null as string | null,
      creatorId,
      assignedToId: null as string | null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    prismaMock.task.findFirst.mockResolvedValue(existing);

    const updated = {
      ...existing,
      title: 'New',
      status: 'InProgress' as const,
    };

    prismaMock.task.update.mockResolvedValue(updated);

    const result = await updateTaskForUser(existing.id, creatorId, {
      title: 'New',
      status: 'InProgress',
    });

    expect(prismaMock.task.findFirst).toHaveBeenCalledTimes(1);
    expect(prismaMock.task.update).toHaveBeenCalledTimes(1);
    expect(result).toEqual(updated);
  });

  it('updateTaskForUser returns null if task not found for user', async () => {
    prismaMock.task.findFirst.mockResolvedValue(null);

    const result = await updateTaskForUser('task-unknown', creatorId, {
      title: 'X',
    });

    expect(result).toBeNull();
    expect(prismaMock.task.update).not.toHaveBeenCalled();
  });
});