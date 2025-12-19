# Organizo
Task Management App


Organizo is simple task management app that has backend with authentication, REST APIs, and real-time updates using Socket.IO.

## Tech Stack

- Node.js + TypeScript
- Express
- PostgreSQL (or any SQL database supported by your ORM)
- Prisma (or similar ORM) for data access
- JWT-based authentication
- Socket.IO for real-time updates

## Getting Started

### Prerequisites

- Node.js (LTS)
- npm or yarn
- PostgreSQL running locally (or a connection URL for a remote DB)

### Installation

git clone <your-repo-url>
cd <your-repo-folder>
npm install


### Environment variables

Create a `.env` file in the project root:

DATABASE_URL=postgresql://user:password@localhost:5432/yourdb
JWT_SECRET=your_jwt_secret
PORT=3001


### Database setup

Run the migrations to create tables:

npx prisma migrate dev



### Run the server

npm run dev

The server will start on `http://localhost:3001` by default.

---

## REST API Overview

### Authentication

#### `POST /api/auth/register`

- Registers a new user.
- Body: `{ "name": string, "email": string, "password": string }`
- Returns: user data (without password).

#### `POST /api/auth/login`

- Logs in an existing user.
- Body: `{ "email": string, "password": string }`
- Returns: `{ "token": string, "user": { ... } }` (JWT token used in `Authorization: Bearer <token>` for protected routes).

### Tasks

All task endpoints require a valid JWT in the `Authorization` header.

#### `GET /api/tasks`

- Returns a list of tasks visible to the current user.

#### `POST /api/tasks`

- Creates a new task.
- Example body:

{
"title": "Design login page",
"description": "Create responsive UI for login",
"dueDate": "2025-12-31T00:00:00.000Z",
"priority": "HIGH",
"status": "ToDo",
"assignedToId": "user-id-or-null"
}



#### `PUT /api/tasks/:id`

- Updates a task (status, priority, assignee, etc.).

#### `DELETE /api/tasks/:id`

- Deletes a task.

---

## Real-time Events (Socket.IO)

The backend exposes a Socket.IO server on the same host/port as the REST API (for example, `http://localhost:3001`).



### Socket.IO connection

In the frontend, the client will connect using the JWT received from the login endpoint and then subscribe to the events below. 

Example :

import { io } from "socket.io-client";

const socket = io("http://localhost:3001", {
auth: {
token: "<JWT_TOKEN_FROM_LOGIN>"
}
});

// Real-time task updates
socket.on("task:created", (task) => {
// Add the new task to the current list
});

socket.on("task:updated", (task) => {
// Update the task in the current list
});

socket.on("task:deleted", ({ id }) => {
// Remove the task with this id from the current list
});

// Assignment notifications
socket.on("task:assigned", (task) => {
// Show an in-app notification for the assigned task
});

---

## Events emitted by the server

These events are emitted over Socket.IO whenever a task changes. Any objects that can be encoded as JSON are supported by Socket.IO. 

### `task:created`

Emitted after a new task is created.

Payload:

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


### `task:updated`

Emitted after an existing task is updated (for example, status, priority, assignee, title, or description).

Payload: same shape as `task:created`.

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



### `task:deleted`

Emitted after a task is deleted.

Payload:

{ "id": "string" }


### `task:assigned`

Emitted to the assigned user’s personal room when a task is assigned or reassigned. Rooms and namespaces are a core concept in Socket.IO for targeting specific clients.

- Room: `user:<assignedToId>`

Payload: same shape as `task:created`.

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



---

## Frontend responsibilities

When the React frontend is implemented, it should:

- Authenticate the user and store the JWT from `/api/auth/login`.  
- Establish a Socket.IO connection with `{ auth: { token: "<JWT>" } }`.  
- Listen to `task:created`, `task:updated`, and `task:deleted` to keep task lists in sync in real time.  
- Listen to `task:assigned` and display a clear in-app notification for the currently logged-in user.
