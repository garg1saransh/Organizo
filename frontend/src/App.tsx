import React, { useState, useEffect } from 'react';
import { LoginPage } from './features/auth/LoginPage';
import { loadAuth } from './features/auth/authStore';
import { connectSocket, disconnectSocket } from './realtime/socket';

type Task = {
  id: string;
  title: string;
  completed: boolean;
};

function App() {
  const initial = loadAuth();
  const [token, setToken] = useState<string | null>(initial.token);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);

  function normalizeTask(rawWrapper: any): Task {
    const raw = rawWrapper.task ?? rawWrapper;
    return {
      id: raw.id ?? raw._id,
      title: raw.title,
      completed: raw.completed ?? false,
    };
  }

  function normalizeList(rawData: any): Task[] {
    const rawList = Array.isArray(rawData) ? rawData : rawData.tasks ?? [];
    return rawList.map(normalizeTask);
  }

  function handleLoggedIn() {
    const updated = loadAuth();
    setToken(updated.token);
  }

  function handleLogout() {
    localStorage.removeItem('auth');
    setToken(null);
    setTasks([]);
    disconnectSocket();
  }

  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim() || !token) return;

    try {
      setCreating(true);

      const response = await fetch('http://localhost:3001/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: newTitle.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create task (${response.status})`);
      }

      const created = await response.json();
      const normalized = normalizeTask(created);

      // Optimistic add; other clients will get it via socket
      setTasks((prev) => [...prev, normalized]);
      setNewTitle('');
    } catch (err: any) {
      setError(err.message ?? 'Failed to create task');
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleTask(task: Task) {
    if (!token) return;

    const updatedCompleted = !task.completed;

    try {
      const response = await fetch(
        `http://localhost:3001/api/tasks/${task.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ completed: updatedCompleted }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to update task (${response.status})`);
      }

      const updated = await response.json();
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
      const response = await fetch(
        `http://localhost:3001/api/tasks/${taskId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to delete task (${response.status})`);
      }

      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    } catch (err: any) {
      setError(err.message ?? 'Failed to delete task');
    }
  }

  // Load tasks when token changes
  useEffect(() => {
    if (!token) {
      setTasks([]);
      return;
    }

    async function fetchTasks() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('http://localhost:3001/api/tasks', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to load tasks (${response.status})`);
        }

        const data = await response.json();
        const list = normalizeList(data);
        setTasks(list);
      } catch (err: any) {
        setError(err.message ?? 'Failed to load tasks');
      } finally {
        setLoading(false);
      }
    }

    fetchTasks();
  }, [token]);

  // Real-time Socket.IO subscriptions
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

    return () => {
      socket.off('task:created');
      socket.off('task:updated');
      socket.off('task:deleted');
    };
  }, [token]);

  if (!token) {
    return <LoginPage onLoggedIn={handleLoggedIn} />;
  }

  return (
    <div>
      <header style={{ padding: 16, borderBottom: '1px solid #ddd' }}>
        <span>Task Manager</span>
        <button style={{ marginLeft: 16 }} onClick={handleLogout}>
          Logout
        </button>
      </header>
      <main style={{ padding: 16 }}>
        <form onSubmit={handleCreateTask} style={{ marginBottom: 16 }}>
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="New task title"
            style={{ marginRight: 8 }}
          />
          <button type="submit" disabled={creating || !newTitle.trim()}>
            {creating ? 'Adding...' : 'Add task'}
          </button>
        </form>

        {loading && <p>Loading tasks...</p>}
        {error && <p style={{ color: 'red' }}>{error}</p>}

        {!loading && !error && (
          <>
            {tasks.length === 0 ? (
              <p>No tasks yet.</p>
            ) : (
              <ul>
                {tasks.map((task) => (
                  <li key={task.id} style={{ marginBottom: 8 }}>
                    <span
                      style={{
                        textDecoration: task.completed
                          ? 'line-through'
                          : 'none',
                        marginRight: 8,
                      }}
                    >
                      {task.title}
                    </span>
                    <button
                      onClick={() => handleToggleTask(task)}
                      style={{ marginRight: 8 }}
                    >
                      {task.completed ? 'Mark undone' : 'Mark done'}
                    </button>
                    <button
                      onClick={() => handleDeleteTask(task.id)}
                      style={{ color: 'red' }}
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default App;