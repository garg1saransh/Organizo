# Organizo – Collaborative Task Manager

Organizo is a full‑stack collaborative task management app with authentication, real‑time updates, and a responsive dashboard for managing personal and team tasks.

---

## Live Demo & Access

- **Frontend (Vercel)**: https://organizo-eight.vercel.app
- **Backend API**: https://collaborative-task-manager-79jq.onrender.com
- **Demo Account**  
  - Email: demo@example.com  
  - Password: demo@123

---

## Tech Stack & Design Decisions

### Frontend

- **React + TypeScript** (Vite)
- **Tailwind CSS** for styling and fully responsive layout (mobile → desktop)
- **React Query (@tanstack/react-query)** for server‑state management and caching
- **React Hook Form + Zod** for forms and validation

### Backend

- **Node.js + TypeScript**
- **Express** with a **service/repository** style architecture
- **PostgreSQL** as the primary database  
  - Chosen for strong relational guarantees, easy joins for users/tasks, and good support in hosting providers.
- **Prisma** as ORM for type‑safe DB access
- **JWT authentication** (Bearer token) with bcrypt‑hashed passwords
- **Socket.IO** for real‑time collaboration (task updates and assignment notifications)

### Deployment

- **Frontend**: Vercel
- **Backend + DB**: Render (Node service + managed PostgreSQL)

---

## Architecture Overview

### High‑Level Structure

- `backend/`
  - `src/controllers/` – HTTP route handlers (thin, no business logic)
  - `src/services/` – business logic (e.g., task creation, updates, assignment)
  - `src/repositories/` – data access via Prisma (UserRepo, TaskRepo)
  - `src/dto/` – Zod schemas for request validation (CreateTaskDto, UpdateTaskDto, AuthDto)
  - `src/socket/` – Socket.IO server setup and event wiring
  - `src/middleware/` – auth middleware, error handler

- `frontend/`
  - `src/features/auth/` – login/register/profile panels, auth store
  - `src/realtime/socket.ts` – Socket.IO client
  - `src/lib/api.ts` – fetch wrapper that injects JWT into `Authorization` header
  - `src/App.tsx` – main dashboard, task CRUD, filters, and responsive layout

### Authentication & Sessions

- Users register with **name, email, password**.
- Passwords are **hashed** using bcrypt before storing.
- On login:
  - Backend validates credentials and returns a **JWT** and basic user object.
  - Frontend stores `{ token, user }` in `localStorage` under `auth`.
  - All API requests use `Authorization: Bearer <token>` header.
- Protected routes validate the JWT in a middleware and attach `req.user` to the request.

---

## Backend Setup

### Prerequisites

- Node.js (LTS)
- npm or yarn
- PostgreSQL instance (local or remote)

### Installation

git clone <your-repo-url>
cd <your-repo-folder>/backend
npm install

text

### Environment Variables

Create a `.env` file in `backend`:

DATABASE_URL=postgresql://user:password@localhost:5432/yourdb
JWT_SECRET=your_jwt_secret
PORT=3001

text

### Database Setup

npx prisma migrate dev

text

### Run the Server (Dev)

npm run dev

text

The server runs on `http://localhost:3001`.

---

## Frontend Setup

### Installation

cd <your-repo-folder>/frontend
npm install

text

### Environment Variables

Create a `.env.local` in `frontend`:

VITE_API_URL=http://localhost:3001

text

For production, set `VITE_API_URL` in Vercel to your deployed backend URL (e.g. `https://collaborative-task-manager-79i9.onrender.com`).

### Run the Frontend (Dev)

npm run dev

text

The app runs on `http://localhost:5173` by default.

---

## API Contract

### Authentication

#### `POST /api/auth/register`

- Registers a new user.
- **Body**:

{
"name": "string",
"email": "string",
"password": "string"
}

text

- **Response**: user data (without password).

#### `POST /api/auth/login`

- Logs in an existing user.
- **Body**:

{
"email": "string",
"password": "string"
}

text

- **Response**:

{
"token": "jwt-token",
"user": {
"id": "string",
"name": "string | null",
"email": "string"
}
}

text

Use the token as `Authorization: Bearer <token>` for all protected routes.

---

### Tasks (Protected)

All task endpoints require a valid JWT.

#### `GET /api/tasks`

- Returns a list of tasks visible to the current user (used for dashboard views, filters, and search).

#### `POST /api/tasks`

- Creates a new task.
- **Body** (validated with Zod DTO):

{
"title": "Design login page",
"description": "Create responsive UI for login",
"dueDate": "2025-12-31T00:00:00.000Z",
"priority": "LOW | MEDIUM | HIGH | URGENT",
"status": "ToDo | InProgress | Review | Completed",
"assignedToId": "user-id-or-null"
}

text

- **Response**: created task object.

#### `PUT /api/tasks/:id`

- Updates an existing task (title, description, status, priority, dueDate, assignedToId).
- **Body**: same shape as create task (partial or full, depending on implementation).

#### `DELETE /api/tasks/:id`

- Deletes a task created by the user (or according to your authorization rules).

---

## Real‑Time Collaboration (Socket.IO)

The backend exposes a Socket.IO server on the same host/port as the REST API (e.g. `http://localhost:3001`).

### Client Connection

The frontend connects with the JWT token:

import { io } from 'socket.io-client';

const socket = io(import.meta.env.VITE_API_URL, {
auth: {
token: '<JWT_TOKEN_FROM_LOGIN>',
},
});

text

### Events Emitted by the Server

All payloads are JSON‑serializable task objects.

#### `task:created`

Emitted after a new task is created.

{
"id": "string",
"title": "string",
"description": "string or null",
"dueDate": "string or null",
"priority": "LOW | MEDIUM | HIGH | URGENT",
"status": "ToDo | InProgress | Review | Completed",
"creatorId": "string",
"assignedToId": "string or null",
"createdAt": "string",
"updatedAt": "string"
}

text

#### `task:updated`

Emitted after an existing task is updated (status, priority, assignee, etc.).  
Payload shape is the same as `task:created`.

#### `task:deleted`

Emitted after a task is deleted.

{ "id": "string" }

text

#### `task:assigned`

Emitted to the assigned user’s personal room when a task is assigned or reassigned.

- Room name: `user:<assignedToId>`
- Payload: same shape as `task:created`.

The frontend listens to this event and shows an in‑app notification in the top‑right corner.

---

## Frontend Behaviour

The React frontend:

- Stores the JWT and user info from `/api/auth/login` in `localStorage`.
- Uses a shared `api` client that automatically attaches `Authorization: Bearer <token>` to every request.
- Uses **React Query** to:
  - Fetch and cache `/api/tasks` and `/api/users`.
  - Show loading skeletons / spinners while data is loading.
  - Show retry options on errors.
- Uses **Socket.IO** to:
  - Listen to `task:created`, `task:updated`, and `task:deleted` and keep the task list in sync.
  - Listen to `task:assigned` and show persistent notifications.
- Provides a responsive dashboard with:
  - Views: All, Assigned to me, Created by me, Overdue.
  - Filters: status and priority.
  - Sorting: due date (none / ascending / descending).
  - Search: by title or description.
  - Overview panel: total tasks, completed, overdue.

---

## Validation, Error Handling & DTOs

- All critical endpoints use **Zod DTOs** for input validation (e.g., `CreateTaskDto`, `UpdateTaskDto`, `AuthDto`).
- Errors return appropriate HTTP status codes:
  - `400` – validation error.
  - `401` – missing/invalid token.
  - `404` – resource not found.
  - `500` – unexpected server error (logged on the server).

---

## Testing

- Backend tests (Jest) cover key business logic, such as:
  - Task creation service (valid/invalid payloads).
  - Assignment logic and emitted events.
  - Auth service (password hashing & JWT issuing).

> Add exact test file paths here once implemented, e.g. `src/services/taskService.test.ts`.

---

## Trade‑Offs & Assumptions

- No password reset or email verification flows (out of scope for assessment).
- Basic access rules: users can see tasks relevant to them; fine‑grained RBAC is not implemented.
- Optimistic UI and audit logging are not implemented / partially implemented depending on time.

---

## How to Run Everything Locally (Summary)

1. **Backend**
   - `cd backend`
   - Configure `.env`
   - `npm install`
   - `npx prisma migrate dev`
   - `npm run dev`

2. **Frontend**
   - `cd frontend`
   - Configure `.env.local` with `VITE_API_URL=http://localhost:3001`
   - `npm install`
   - `npm run dev`

Open `http://localhost:5173` and log in with the demo user (or register a new one).

---