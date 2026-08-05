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

More topics (authentication, database integration, error handling, logging) will be added here as the project grows — check back or watch the repo.

---

## Tech Stack

| Tool | Purpose |
|------|---------|
| [Node.js](https://nodejs.org/) | JavaScript runtime for the backend |
| [Express](https://expressjs.com/) | Web framework — handles routing, middleware, requests/responses |
| [Zod](https://zod.dev/) | Schema-based data validation |

---

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) installed (check with `node -v`)
- [Postman](https://www.postman.com/) (or similar) for testing routes that accept data — browsers alone can't easily send POST requests

### Installation

```bash
git clone https://github.com/Ifechukwu-Francis/backend-fundamentals.git
cd backend-fundamentals
npm install
```

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

| Method | Path | Description | Concept doc |
|--------|------|-------------|-------------|
| GET | `/` | Homepage — confirms the server is running | [01](./docs/01-the-server.md) |
| GET | `/about` | Static example route | [03](./docs/03-routing.md) |
| GET | `/products/:id` | Demonstrates a **dynamic route parameter** — try `/products/12` | [03](./docs/03-routing.md) |
| GET | `/search?category=&sort=` | Demonstrates **query parameters** | [03](./docs/03-routing.md) |
| POST | `/products` | Creates a product — demonstrates **request body validation** with Zod | [04](./docs/04-validation.md) |

### Example: Creating a product

**Request**
```
POST /products
Content-Type: application/json

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
    "name": "Wireless Mouse",
    "price": 25
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

---

## A note for fellow beginners

If something here doesn't make sense, that's normal — it took building it step by step, testing each piece, and breaking things (a few times) to actually understand it. Read the docs in order, run the code alongside them, and don't be afraid to intentionally send broken requests just to see how the app responds. That's genuinely how this stuff clicks.

---

## Author

Built by **Ifechukwe Francis** — final-year Computer Science student, learning backend development one concept at a time.