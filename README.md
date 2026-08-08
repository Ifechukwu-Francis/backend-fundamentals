# Backend Fundamentals — Learning by Building

A hands-on, beginner-first walkthrough of backend development — built from the ground up using **Node.js** and **Express**, one concept at a time.

This repo isn't just code. It's meant to be **read**, not just run — every route exists to demonstrate a specific backend concept, and the goal is to help other beginners understand *why* things are built a certain way, not just *how* to copy them.

If you've never written backend code before, you're in the right place.

---

## How to use this repo

This isn't a repo you just clone and run — it's meant to be worked through, in order.

1. **Read the docs first, one at a time** — the [`/docs`](./docs) folder breaks the project down concept by concept, in the exact order it was built. Each file explains *why* the concept exists, *how* it works, and then shows the real code from this project.
2. **Then run the code** — after reading a doc, open [`server.js`](./server.js) and find the matching section, so you see the explanation and the real implementation side by side.
3. **Then break it on purpose** — change something, send a bad request, see what happens. That's genuinely the fastest way to make this stuff stick.

### 📚 Learning path

| # | Topic | What you'll learn |
|---|-------|--------------------|
| 1 | [The Server](./docs/01-the-server.md) | What a server actually is, ports, sockets, the event loop |
| 2 | [HTTP & HTTPS](./docs/02-http-and-https.md) | Requests, responses, status codes, why HTTPS matters |
| 3 | [Routing](./docs/03-routing.md) | Static/dynamic routes, route params, query params, route order bugs |
| 4 | [Validation](./docs/04-validation.md) | Manual validation, then schema-based validation with Zod |
| 5 | [Authentication & Authorization](./docs/05-authentication-and-authorization.md) | Password hashing, JWTs, protecting routes with middleware, ownership-based access control |
| 6 | [Database Integration](./docs/06-database.md) | Connecting a real PostgreSQL database with Prisma — schema design, migrations, and swapping in-memory storage for persistent data |

More topics (error handling, logging) will be added here as the project grows — check back or watch the repo.

---

## Tech Stack

| Tool | Purpose |
|------|---------|
| [Node.js](https://nodejs.org/) | JavaScript runtime for the backend |
| [Express](https://expressjs.com/) | Web framework — handles routing, middleware, requests/responses |
| [Zod](https://zod.dev/) | Schema-based data validation |
| [bcrypt](https://www.npmjs.com/package/bcrypt) | Password hashing |
| [jsonwebtoken](https://www.npmjs.com/package/jsonwebtoken) | Issuing and verifying JWTs for authentication |
| [dotenv](https://www.npmjs.com/package/dotenv) | Loading secrets from a `.env` file instead of hardcoding them |
| [PostgreSQL](https://www.postgresql.org/) | Relational database — persistent storage for users and products |
| [Neon](https://neon.tech/) | Serverless, cloud-hosted Postgres — no local database installation needed |
| [Prisma](https://www.prisma.io/) | ORM — defines the database schema and generates the client used to query it |
| [@prisma/adapter-pg](https://www.npmjs.com/package/@prisma/adapter-pg) | Driver adapter Prisma 7 requires to connect to Postgres |

---

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) installed (check with `node -v`)
- [Postman](https://www.postman.com/) (or similar) for testing routes that accept data — browsers alone can't easily send POST requests
- A free [Neon](https://neon.tech/) account (or any PostgreSQL database) — needed for `DATABASE_URL`

### Installation

```bash
git clone https://github.com/Ifechukwu-Francis/backend-fundamentals.git
cd backend-fundamentals
npm install
```

### Environment variables

This project uses a `.env` file for secrets (never committed to git). Copy the example file and fill in your own values:

```bash
cp .env.example .env
```

Then open `.env` and set a long, random value for `JWT_SECRET`. See [05-authentication-and-authorization.md](./docs/05-authentication-and-authorization.md) for why this matters.

Also set `DATABASE_URL` to your own PostgreSQL connection string (a free one is easy to get from [Neon](https://neon.tech/)). See [06-database.md](./docs/06-database.md) for the full setup walkthrough.

### Running the server

```bash
node server.js
```

You should see:
```
server is running on port 3000
```

The server will then be available at `http://localhost:3000`.

---

## API Routes

| Method | Path | Auth required? | Description | Concept doc |
|--------|------|:---:|-------------|-------------|
| GET | `/` | No | Homepage — confirms the server is running | [01](./docs/01-the-server.md) |
| GET | `/about` | No | Static example route | [03](./docs/03-routing.md) |
| GET | `/products/:id` | No | Demonstrates a **dynamic route parameter** — try `/products/12` | [03](./docs/03-routing.md) |
| GET | `/search?category=&sort=` | No | Demonstrates **query parameters** | [03](./docs/03-routing.md) |
| POST | `/register` | No | Registers a new user — hashes the password with bcrypt | [05](./docs/05-authentication-and-authorization.md), [06](./docs/06-database.md) |
| POST | `/login` | No | Logs in and returns a JWT | [05](./docs/05-authentication-and-authorization.md), [06](./docs/06-database.md)  |
| GET | `/profile` | ✅ Yes | Returns the logged-in user's decoded token payload | [05](./docs/05-authentication-and-authorization.md) |
| POST | `/products` | ✅ Yes | Creates a product owned by the logged-in user — validated with Zod | [04](./docs/04-validation.md), [05](./docs/05-authentication-and-authorization.md), [06](./docs/06-database.md) |
| DELETE | `/products/:id` | ✅ Yes | Deletes a product — only the **owner** can delete it | [05](./docs/05-authentication-and-authorization.md), [06](./docs/06-database.md)  |

Routes marked "Auth required" expect a header: `Authorization: Bearer <your-jwt-token>` — get a token from `POST /login` first.

### Example: Registering and logging in

**Register**
```
POST /register
Content-Type: application/json

{
  "email": "you@example.com",
  "password": "yourpassword123"
}
```

**Login**
```
POST /login
Content-Type: application/json

{
  "email": "you@example.com",
  "password": "yourpassword123"
}
```
Response includes a `token` — copy it for the next step.

### Example: Creating a product (requires a token)

**Request**
```
POST /products
Content-Type: application/json
Authorization: Bearer <your-token-here>

{
  "name": "Wireless Mouse",
  "price": 25
}
```

**Success response — `201 Created`**
```json
{
  "message": "Product created",
  "product": {
    "id": 1,
    "name": "Wireless Mouse",
    "price": 25,
    "ownerId": 1
  }
}
```

**Validation failure — `400 Bad Request`**
```json
{
  "message": "Validation failed",
  "errors": [
    "Price must be a positive number"
  ]
}
```

**No token / invalid token**
```json
{
  "message": "Access token is required"
}
```

**Trying to delete someone else's product — `403 Forbidden`**
```json
{
  "message": "You do not have permission to delete this product"
}
```

---

## A note for fellow beginners

If something here doesn't make sense, that's normal — it took building it step by step, testing each piece, and breaking things (a few times) to actually understand it. Read the docs in order, run the code alongside them, and don't be afraid to intentionally send broken requests just to see how the app responds. That's genuinely how this stuff clicks.

---

## Author

Built by **Ifechukwu Francis** — final-year Computer Science student, learning backend development one concept at a time.