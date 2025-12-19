import { useState, useEffect, useMemo } from 'react';
import { LoginPage } from './features/auth/LoginPage';
import { RegisterPage } from './features/auth/RegisterPage';
import { loadAuth } from './features/auth/authStore';
import { connectSocket, disconnectSocket } from './realtime/socket';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { ProfilePanel } from './features/auth/ProfilePanel';
import { api } from './lib/api';

type AuthState = ReturnType<typeof loadAuth>;

type Task = {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'ToDo' | 'InProgress' | 'Review' | 'Completed';
  creatorId: string;
  assignedToId: string | null;
  createdAt: string;
  updatedAt: string;
};

type AppUser = {
  id: string;
  name: string | null;
  email: string;
};

type Notification = {
  id: string;
  taskId: string;
  title: string;
  createdAt: string;
};

type ViewFilter = 'ALL' | 'ASSIGNED_TO_ME' | 'CREATED_BY_ME' | 'OVERDUE';
type StatusFilter = 'ALL' | Task['status'];
type PriorityFilter = 'ALL' | Task['priority'];
type DueDateSort = 'NONE' | 'ASC' | 'DESC';

const taskFormSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(100, 'Title must be at most 100 characters'),
  description: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  status: z.enum(['ToDo', 'InProgress', 'Review', 'Completed']),
  dueDate: z.string().optional(),
  assignedToId: z.string().optional(),
});

type TaskFormValues = z.infer<typeof taskFormSchema>;

function normalizeTask(rawWrapper: any): Task {
  const raw = rawWrapper?.task ?? rawWrapper;
  return {
    id: raw.id,
    title: raw.title,
    description: raw.description ?? null,
    dueDate: raw.dueDate ?? null,
    priority: raw.priority,
    status: raw.status,
    creatorId: raw.creatorId,
    assignedToId: raw.assignedToId ?? null,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

function normalizeList(rawData: any): Task[] {
  const rawList = Array.isArray(rawData) ? rawData : rawData.tasks ?? [];
  return rawList.map(normalizeTask);
}

function App() {
  const initial: AuthState = loadAuth();
  const [token, setToken] = useState<string | null>(initial.token);
  const [user] = useState(initial.user);
  const currentUserId = user?.id ?? null;

  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [viewFilter, setViewFilter] = useState<ViewFilter>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [priorityFilter, setPriorityFilter] =
    useState<PriorityFilter>('ALL');
  const [dueSort, setDueSort] = useState<DueDateSort>('NONE');
  const [search, setSearch] = useState('');

  const [creating, setCreating] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: '',
      description: '',
      priority: 'LOW',
      status: 'ToDo',
      dueDate: '',
      assignedToId: undefined,
    },
  });

  const queryClient = useQueryClient();

  function handleLoggedIn() {
    const updated = loadAuth();
    setToken(updated.token);
  }

  function handleLogout() {
    localStorage.removeItem('auth');
    setToken(null);
    setTasks([]);
    disconnectSocket();
    queryClient.clear();
  }

  async function handleCreateTask(values: TaskFormValues) {
    if (!token) return;

    try {
      setCreating(true);

      await api.post('/api/tasks', {
  title: values.title.trim(),
  description: values.description?.trim() || null,
  priority: values.priority,
  status: values.status,
  dueDate: values.dueDate || null,
  assignedToId: values.assignedToId || null,
});

      reset({
        title: '',
        description: '',
        priority: 'LOW',
        status: 'ToDo',
        dueDate: '',
        assignedToId: undefined,
      });
    } catch (err: any) {
      setError(err.message ?? 'Failed to create task');
    } finally {
      setCreating(false);
    }
  }

  async function handleEditTask(id: string, values: TaskFormValues) {
    if (!token) return;

    try {
      const updated = await api.put<any>(`/api/tasks/${id}`, {
  title: values.title.trim(),
  description: values.description?.trim() || null,
  priority: values.priority,
  status: values.status,
  dueDate: values.dueDate || null,
  assignedToId: values.assignedToId || null,
});
      const normalized = normalizeTask(updated);

      setTasks((prev) =>
        prev.map((t) => (t.id === id ? normalized : t))
      );
      setEditingTaskId(null);
    } catch (err: any) {
      setError(err.message ?? 'Failed to update task');
    }
  }

  async function handleToggleTask(task: Task) {
    if (!token) return;

    const updatedStatus =
      task.status === 'Completed' ? 'ToDo' : 'Completed';

    try {
      const updated = await api.put<any>(`/api/tasks/${task.id}`, {
  status: updatedStatus,
});
      const normalized = normalizeTask(updated);

      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? normalized : t))
      );
    } catch (err: any) {
      setError(err.message ?? 'Failed to update task');
    }
  }

  async function handleDeleteTask(taskId: string) {
    if (!token) return;

    try {
      await api.delete(`/api/tasks/${taskId}`);

setTasks((prev) => prev.filter((t) => t.id !== taskId));
    } catch (err: any) {
      setError(err.message ?? 'Failed to delete task');
    }
  }

  const {
    data: tasksData,
    isLoading,
    error: queryError,
    refetch,
  } = useQuery<Task[]>({
    queryKey: ['tasks', token],
    enabled: !!token,
    queryFn: async () => {
      const data = await api.get<any>('/api/tasks');
return normalizeList(data);
    },
  });

  const { data: usersData } = useQuery<{ users: AppUser[] }>({
    queryKey: ['users', token],
    enabled: !!token,
    queryFn: async () => {
      const res = await api.get<{ users: AppUser[] }>('/api/users');
return res;
    },
  });
  const users = usersData?.users ?? [];

  useEffect(() => {
    if (tasksData) {
      setTasks(tasksData);
      setError(null);
    }
  }, [tasksData]);

  useEffect(() => {
    if (queryError) {
      const err = queryError as Error;
      setError(err.message ?? 'Failed to load tasks');
    }
  }, [queryError]);

  useEffect(() => {
    if (!token) return;

    const socket = connectSocket(token);

    socket.on('task:created', (payload: any) => {
      const task = normalizeTask(payload);
      setTasks((prev) => {
        if (prev.some((t) => t.id === task.id)) return prev;
        return [...prev, task];
      });
    });

    socket.on('task:updated', (payload: any) => {
      const task = normalizeTask(payload);
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? task : t))
      );
    });

    socket.on('task:deleted', (payload: any) => {
      const id = payload.id;
      if (!id) return;
      setTasks((prev) => prev.filter((t) => t.id !== id));
    });

    socket.on('task:assigned', (payload: any) => {
      if (
        payload.assignedToId &&
        payload.assignedToId === currentUserId
      ) {
        setNotifications((prev) => [
          {
            id: `${payload.id}-${Date.now()}`,
            taskId: payload.id,
            title: payload.title,
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ]);
      }
    });

    return () => {
      socket.off('task:created');
      socket.off('task:updated');
      socket.off('task:deleted');
      socket.off('task:assigned');
    };
  }, [token, currentUserId]);

  const visibleTasks = useMemo(() => {
    let result = [...tasks];

    const now = new Date();

    if (viewFilter === 'ASSIGNED_TO_ME' && currentUserId) {
      result = result.filter((t) => t.assignedToId === currentUserId);
    } else if (viewFilter === 'CREATED_BY_ME' && currentUserId) {
      result = result.filter((t) => t.creatorId === currentUserId);
    } else if (viewFilter === 'OVERDUE') {
      result = result.filter((t) => {
        if (!t.dueDate) return false;
        const due = new Date(t.dueDate);
        return due < now && t.status !== 'Completed';
      });
    }

    if (statusFilter !== 'ALL') {
      result = result.filter((t) => t.status === statusFilter);
    }

    if (priorityFilter !== 'ALL') {
      result = result.filter((t) => t.priority === priorityFilter);
    }

    if (search.trim()) {
      const term = search.trim().toLowerCase();
      result = result.filter((t) => {
        const inTitle = t.title.toLowerCase().includes(term);
        const inDesc = t.description
          ? t.description.toLowerCase().includes(term)
          : false;
        return inTitle || inDesc;
      });
    }

    if (dueSort !== 'NONE') {
      result.sort((a, b) => {
        const aTime = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        const bTime = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        if (dueSort === 'ASC') return aTime - bTime;
        return bTime - aTime;
      });
    }

    return result;
  }, [
    tasks,
    viewFilter,
    statusFilter,
    priorityFilter,
    dueSort,
    search,
    currentUserId,
  ]);

  // Auth screens
  if (!token) {
    if (authMode === 'login') {
      return (
        <LoginPage
          onLoggedIn={handleLoggedIn}
          onSwitchToRegister={() => setAuthMode('register')}
        />
      );
    }

    return (
      <RegisterPage
        onRegistered={() => setAuthMode('login')}
        onSwitchToLogin={() => setAuthMode('login')}
      />
    );
  }

  const shellCardClass =
    'bg-white rounded-3xl shadow-sm border border-gray-100';

  const widgetCardClass =
    'bg-white rounded-3xl shadow-sm border border-gray-100 px-5 py-4 flex flex-col';

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-yellow-300 via-yellow-200 to-yellow-300 flex items-center justify-center px-4">
        <div
          className={`${shellCardClass} w-full max-w-6xl h-[700px] flex overflow-hidden`}
        >
          {/* Sidebar */}
          <aside className="w-64 bg-white border-r border-yellow-100 flex flex-col justify-between py-6">
            <div className="px-6 space-y-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-yellow-400 flex items-center justify-center font-semibold text-sm text-gray-900">
                  {user?.name?.[0]?.toUpperCase() ?? 'U'}
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold text-lg text-gray-900">
                    Organizo
                  </span>
                  <span className="text-xs text-gray-400">
                    Task dashboard
                  </span>
                </div>
              </div>

              <nav className="space-y-2 text-sm">
                <button className="w-full flex items-center gap-3 px-3 py-2 rounded-xl bg-yellow-50 border-l-4 border-yellow-400 text-gray-900 font-medium">
                  <span>Tasks</span>
                </button>
              </nav>
            </div>

            <div className="px-6 space-y-2 text-sm text-gray-500">
              <button
                onClick={() => setShowProfile(true)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-50"
              >
                <span>Profile</span>
              </button>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-50"
              >
                <span>Log out</span>
              </button>
            </div>
          </aside>

          {/* Main dashboard */}
          <main className="flex-1 flex flex-col px-8 py-6 space-y-5 bg-[#fdfdfd]">
            {/* Header */}
            <header className="flex items-center justify_between">
              <div className="flex flex-col">
                <span className="text-lg font-semibold text-gray-900">
                  Tasks
                </span>
                {user && (
                  <span className="text-xs text-gray-500">
                    Hi, {user.name ?? user.email}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by title or description"
                  className="w-80 h-10 rounded-full bg-gray-50 border border-gray-200 px-4 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-300"
                />
              </div>
            </header>

            {/* Filters and create task row */}
            <section className={`${shellCardClass} px-5 py-4 space-y-4`}>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="mr-2 font-semibold text-gray-700">
                  View:
                </span>
                <button
                  onClick={() => setViewFilter('ALL')}
                  className={`rounded-full px-3 py-1 font-medium ${
                    viewFilter === 'ALL'
                      ? 'bg-yellow-400 text-gray-900'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setViewFilter('ASSIGNED_TO_ME')}
                  disabled={!currentUserId}
                  className={`rounded-full px-3 py-1 font-medium ${
                    viewFilter === 'ASSIGNED_TO_ME'
                      ? 'bg-yellow-400 text-gray-900'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  } ${
                    !currentUserId ? 'cursor-not-allowed opacity-50' : ''
                  }`}
                >
                  Assigned to me
                </button>
                <button
                  onClick={() => setViewFilter('CREATED_BY_ME')}
                  disabled={!currentUserId}
                  className={`rounded-full px-3 py-1 font-medium ${
                    viewFilter === 'CREATED_BY_ME'
                      ? 'bg-yellow-400 text-gray-900'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  } ${
                    !currentUserId ? 'cursor-not-allowed opacity-50' : ''
                  }`}
                >
                  Created by me
                </button>
                <button
                  onClick={() => setViewFilter('OVERDUE')}
                  className={`rounded-full px-3 py-1 font-medium ${
                    viewFilter === 'OVERDUE'
                      ? 'bg-red-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Overdue
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-gray-700">
                <label className="flex items-center gap-2">
                  <span>Status:</span>
                  <select
                    value={statusFilter}
                    onChange={(e) =>
                      setStatusFilter(e.target.value as StatusFilter)
                    }
                    className="rounded-lg border border-gray-200 bg-white px-2 py-1 focus:border-yellow-400 focus:outline-none"
                  >
                    <option value="ALL">All</option>
                    <option value="ToDo">To Do</option>
                    <option value="InProgress">In Progress</option>
                    <option value="Review">Review</option>
                    <option value="Completed">Completed</option>
                  </select>
                </label>

                <label className="flex items-center gap-2">
                  <span>Priority:</span>
                  <select
                    value={priorityFilter}
                    onChange={(e) =>
                      setPriorityFilter(
                        e.target.value as PriorityFilter
                      )
                    }
                    className="rounded-lg border border-gray-200 bg-white px-2 py-1 focus:border-yellow-400 focus:outline-none"
                  >
                    <option value="ALL">All</option>
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </label>

                <label className="flex items-center gap-2">
                  <span>Sort by due date:</span>
                  <select
                    value={dueSort}
                    onChange={(e) =>
                      setDueSort(e.target.value as DueDateSort)
                    }
                    className="rounded-lg border border-gray-200 bg-white px-2 py-1 focus:border-yellow-400 focus:outline-none"
                  >
                    <option value="NONE">None</option>
                    <option value="ASC">Soonest first</option>
                    <option value="DESC">Latest first</option>
                  </select>
                </label>
              </div>

              <form
                onSubmit={handleSubmit(handleCreateTask)}
                className="flex flex-wrap items-start gap-3 pt-2 border-t border-gray-100 mt-2"
              >
                <div className="min-w-[180px] flex-1">
                  <input
                    type="text"
                    placeholder="New task title"
                    {...register('title')}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs placeholder:text-gray-400 focus:border-yellow-400 focus:outline-none"
                  />
                  {errors.title && (
                    <p className="mt-1 text-[11px] text-red-500">
                      {errors.title.message}
                    </p>
                  )}
                </div>

                <div className="min-w-[220px] flex-1">
                  <input
                    type="text"
                    placeholder="Description (optional)"
                    {...register('description')}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs placeholder:text-gray-400 focus:border-yellow-400 focus:outline-none"
                  />
                  {errors.description && (
                    <p className="mt-1 text-[11px] text-red-500">
                      {errors.description.message}
                    </p>
                  )}
                </div>

                <div className="w-28">
                  <select
                    {...register('priority')}
                    className="w-full rounded-xl border border-gray-200 bg-white px-2 py-2 text-xs focus:border-yellow-400 focus:outline-none"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                  {errors.priority && (
                    <p className="mt-1 text-[11px] text-red-500">
                      {errors.priority.message}
                    </p>
                  )}
                </div>

                <div className="w-32">
                  <select
                    {...register('status')}
                    className="w-full rounded-xl border border-gray-200 bg-white px-2 py-2 text-xs focus:border-yellow-400 focus:outline-none"
                  >
                    <option value="ToDo">To Do</option>
                    <option value="InProgress">In Progress</option>
                    <option value="Review">Review</option>
                    <option value="Completed">Completed</option>
                  </select>
                  {errors.status && (
                    <p className="mt-1 text-[11px] text-red-500">
                      {errors.status.message}
                    </p>
                  )}
                </div>

                <div className="w-40">
                  <select
                    {...register('assignedToId')}
                    className="w-full rounded-xl border border-gray-200 bg-white px-2 py-2 text-xs focus:border-yellow-400 focus:outline-none"
                  >
                    <option value="">Unassigned</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name || u.email}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="w-56">
                  <input
                    type="datetime-local"
                    {...register('dueDate')}
                    className="w-full rounded-xl border border-gray-200 bg-white px-2 py-2 text-xs focus:border-yellow-400 focus:outline-none"
                  />
                  {errors.dueDate && (
                    <p className="mt-1 text-[11px] text-red-500">
                      {errors.dueDate.message}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-full bg-yellow-400 px-5 py-2 text-xs font-semibold text-gray-900 shadow-sm hover:bg-yellow-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {creating ? 'Adding...' : 'Add task'}
                </button>
              </form>
            </section>

            {/* Main content */}
            <section className="flex-1 grid grid-cols-3 gap-4">
              {/* Tasks list */}
              <div className={`${widgetCardClass} col-span-2`}>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-sm text-gray-900">
                    My tasks ({visibleTasks.length})
                  </h2>
                  {isLoading && (
                    <span className="text-xs text-gray-400">
                      Loading...
                    </span>
                  )}
                </div>

                {queryError && (
                  <div className="mb-2 flex items-center justify-between rounded-xl bg-red-50 px-3 py-2">
                    <p className="text-xs text-red-600">
                      Failed to load tasks. Please try again.
                    </p>
                    <button
                      onClick={() => refetch()}
                      className="text-[11px] font-semibold text-red-700 underline"
                    >
                      Retry
                    </button>
                  </div>
                )}

                {isLoading && !tasksData && (
                  <ul className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <li
                        key={i}
                        className="rounded-2xl border border-gray-100 bg-gray-50 px-3 py-2 animate-pulse"
                      >
                        <div className="h-3 w-32 rounded bg-gray-200 mb-2" />
                        <div className="h-2 w-48 rounded bg-gray-200" />
                      </li>
                    ))}
                  </ul>
                )}

                {error && !queryError && (
                  <p className="text-xs text-red-500 mb-2">{error}</p>
                )}

                {!isLoading && !queryError && visibleTasks.length === 0 && (
                  <p className="text-xs text-gray-400">No tasks found.</p>
                )}

                {!isLoading && !queryError && visibleTasks.length > 0 && (
                  <ul className="space-y-2 overflow-y-auto pr-1">
                    {visibleTasks.map((task) => (
                      <li
                        key={task.id}
                        className="rounded-2xl border border-gray-100 bg-gray-50 px-3 py-2 text-xs flex flex-col gap-1"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleToggleTask(task)}
                              className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                                task.status === 'Completed'
                                  ? 'border-yellow-400 bg-yellow-400'
                                  : 'border-gray-300 bg-white'
                              }`}
                            >
                              {task.status === 'Completed' && (
                                <span className="h-2 w-2 rounded-full bg-white" />
                              )}
                            </button>
                            <span
                              className={`font-medium text-gray-900 ${
                                task.status === 'Completed'
                                  ? 'line-through text-gray-400'
                                  : ''
                              }`}
                            >
                              {task.title}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600 border border-gray-200">
                              {task.status}
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-yellow-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-yellow-800 border border-yellow-100">
                              {task.priority}
                            </span>
                          </div>
                        </div>

                        {task.description && (
                          <p className="text-[11px] text-gray-500">
                            {task.description}
                          </p>
                        )}

                        {task.dueDate && (
                          <p className="text-[11px] text-gray-400">
                            Due:{' '}
                            {new Date(task.dueDate).toLocaleString()}
                          </p>
                        )}

                        <p className="text-[11px] text-gray-400">
                          Assigned to:{' '}
                          <span className="font-medium text-gray-700">
                            {users.find(
                              (u) => u.id === task.assignedToId
                            )?.name ||
                              users.find(
                                (u) => u.id === task.assignedToId
                              )?.email ||
                              'Unassigned'}
                          </span>
                        </p>

                        <div className="flex flex-wrap gap-2 pt-1">
                          <button
                            onClick={() => handleToggleTask(task)}
                            className="rounded-full bg-white px-3 py-1 text-[11px] font-medium text-gray-700 border border-gray-200 hover:bg-gray-100"
                          >
                            {task.status === 'Completed'
                              ? 'Mark not completed'
                              : 'Mark completed'}
                          </button>

                          <button
                            onClick={() => {
                              setEditingTaskId(task.id);
                              reset({
                                title: task.title,
                                description: task.description ?? '',
                                priority: task.priority,
                                status: task.status,
                                dueDate: task.dueDate
                                  ? new Date(task.dueDate)
                                      .toISOString()
                                      .slice(0, 16)
                                  : '',
                                assignedToId:
                                  task.assignedToId ?? undefined,
                              });
                            }}
                            className="rounded-full bg_white px-3 py-1 text-[11px] font-medium text-gray-700 border border-gray-200 hover:bg-gray-100"
                          >
                            Edit
                          </button>

                          <button
                            onClick={() => handleDeleteTask(task.id)}
                            className="rounded-full bg-red-500 px-3 py-1 text-[11px] font-medium text-white hover:bg-red-600"
                          >
                            Delete
                          </button>
                        </div>

                        {editingTaskId === task.id && (
                          <form
                            onSubmit={handleSubmit((values) =>
                              handleEditTask(task.id, values)
                            )}
                            className="mt-2 flex flex-wrap items-start gap-2 border-t border-gray-200 pt-2"
                          >
                            <input
                              type="text"
                              placeholder="Title"
                              {...register('title')}
                              className="flex-1 min-w-[140px] rounded-xl border border-gray-200 bg-white px-2 py-1 text-[11px] placeholder:text-gray-400 focus:border-yellow-400 focus:outline-none"
                            />
                            <input
                              type="text"
                              placeholder="Description"
                              {...register('description')}
                              className="flex-[2] min-w-[180px] rounded-xl border border-gray-200 bg-white px-2 py-1 text-[11px] placeholder:text-gray-400 focus:border-yellow-400 focus:outline-none"
                            />
                            <select
                              {...register('priority')}
                              className="w-24 rounded-xl border border-gray-200 bg-white px-2 py-1 text-[11px] focus:border-yellow-400 focus:outline-none"
                            >
                              <option value="LOW">Low</option>
                              <option value="MEDIUM">Medium</option>
                              <option value="HIGH">High</option>
                              <option value="URGENT">Urgent</option>
                            </select>
                            <select
                              {...register('status')}
                              className="w-28 rounded-xl border border-gray-200 bg-white px-2 py-1 text-[11px] focus:border-yellow-400 focus:outline-none"
                            >
                              <option value="ToDo">To Do</option>
                              <option value="InProgress">In Progress</option>
                              <option value="Review">Review</option>
                              <option value="Completed">Completed</option>
                            </select>
                            <select
                              {...register('assignedToId')}
                              className="w-36 rounded-xl border border-gray-200 bg-white px-2 py-1 text-[11px] focus:border-yellow-400 focus:outline-none"
                            >
                              <option value="">Unassigned</option>
                              {users.map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.name || u.email}
                                </option>
                              ))}
                            </select>
                            <input
                              type="datetime-local"
                              {...register('dueDate')}
                              className="w-44 rounded-xl border border-gray-200 bg-white px-2 py-1 text-[11px] focus:border-yellow-400 focus:outline-none"
                            />
                            <button
                              type="submit"
                              className="rounded-full bg-yellow-400 px-3 py-1 text-[11px] font-semibold text-gray-900 shadow-sm hover:bg-yellow-500"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingTaskId(null)}
                              className="rounded-full bg-gray-100 px-3 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-200"
                            >
                              Cancel
                            </button>
                          </form>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Overview */}
              <div className={widgetCardClass}>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-semibold text-sm text-gray-900">
                    Overview
                  </h2>
                </div>
                <div className="space-y-2 text-[11px] text-gray-600">
                  <p>
                    Total tasks:{' '}
                    <span className="font-semibold text-gray-900">
                      {tasks.length}
                    </span>
                  </p>
                  <p>
                    Completed:{' '}
                    <span className="font-semibold text-green-600">
                      {
                        tasks.filter(
                          (t) => t.status === 'Completed'
                        ).length
                      }
                    </span>
                  </p>
                  <p>
                    Overdue:{' '}
                    <span className="font-semibold text-red-500">
                      {
                        tasks.filter((t) => {
                          if (!t.dueDate) return false;
                          const due = new Date(t.dueDate);
                          return (
                            due < new Date() && t.status !== 'Completed'
                          );
                        }).length
                      }
                    </span>
                  </p>
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>

      {notifications.length > 0 && (
        <div className="fixed top-4 right-4 z-40 w-72 space-y-2">
          {notifications.slice(0, 5).map((n) => (
            <div
              key={n.id}
              className="rounded-2xl bg-white shadow-lg border border-yellow-200 px-4 py-3 text-xs text-gray-800"
            >
              <div className="flex justify-between items-center mb-1">
                <span className="font-semibold text-gray-900">
                  New assignment
                </span>
                <button
                  onClick={() =>
                    setNotifications((prev) =>
                      prev.filter((x) => x.id !== n.id)
                    )
                  }
                  className="text-[10px] text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
              <p className="text-gray-700">
                Task:{' '}
                <span className="font-medium">{n.title}</span>
              </p>
              <p className="text-[10px] text-gray-400 mt-1">
                {new Date(n.createdAt).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}

      {showProfile && token && (
        <ProfilePanel
          token={token}
          onClose={() => setShowProfile(false)}
        />
      )}
    </>
  );
}

export default App;