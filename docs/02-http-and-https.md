# 2. HTTP & HTTPS — How Client and Server Actually "Talk"

## Why this is needed

For a client and server to communicate, they need an agreed-upon language — a **protocol**. For web backends, that's almost always **HTTP** (HyperText Transfer Protocol). Without a shared, strict shape for messages, communication breaks down — like two people speaking different languages.

## Anatomy of a request

Every HTTP request is made of the same core parts:

- **Method (verb)** — the intent of the request:
  - `GET` — "give me data" (read-only)
  - `POST` — "create something new"
  - `PUT` / `PATCH` — "update something existing"
  - `DELETE` — "remove something"
- **Path (URL)** — what the request is about, e.g. `/products`, `/products/12`
- **Headers** — metadata about the request (the envelope, not the letter itself). Auth tokens live here.
- **Body** — the actual data being sent, usually as JSON. `GET` requests typically have no body.

## Anatomy of a response

- **Status code** — a 3-digit summary of what happened:
  | Code | Meaning |
  |------|---------|
  | 200 | OK — success |
  | 201 | Created — success, specifically from creating something |
  | 400 | Bad Request — the client sent something wrong |
  | 401 | Unauthorized — not logged in |
  | 403 | Forbidden — logged in, but not allowed |
  | 404 | Not Found |
  | 500 | Internal Server Error — the server's fault, not the client's |
- **Headers** — metadata about the response
- **Body** — the actual returned data

> **Rule of thumb:** 4xx codes mean the *client* messed up. 5xx codes mean the *server* messed up. Keeping this boundary clear helps whoever's debugging know where to start looking.

## Other protocols worth knowing about

HTTP isn't the only option — just the most common for typical backends:

- **WebSocket** — keeps a connection open so both sides can send messages anytime (chat apps, live notifications, multiplayer). Starts as an HTTP request, then "upgrades."
- **gRPC** — used for backend-to-backend communication (microservices), binary format, fast but not browser-native.
- **GraphQL** — still runs over HTTP, but uses a single endpoint where the client specifies exactly what data fields it wants.
- **MQTT** — lightweight, built for IoT/low-power devices.
- **Raw TCP/UDP** — HTTP is actually built on top of TCP. Some systems (games, low-level tools) skip HTTP for maximum speed.

As a beginner, HTTP will be the vast majority of what you use. WebSocket is the next most likely one you'll touch for real-time features.

## HTTPS = HTTP + Encryption

HTTPS isn't a separate protocol — it's HTTP wrapped in **TLS** encryption ("S" = Secure).

**Why it matters:** requests travel across networks you don't control. Without encryption, anyone along the path can read the raw data — passwords, card numbers, everything. This is called a **man-in-the-middle** vulnerability. HTTPS scrambles the data so it's unreadable if intercepted.

- **TLS handshake** — client and server negotiate encryption and exchange keys before any real data is sent.
- **Certificates** — issued by a trusted Certificate Authority, proves a domain is who it claims to be (the padlock icon in your browser).

In practice, you rarely set up TLS by hand — free tools like **Let's Encrypt**, or hosting providers (Render, Railway, Vercel, AWS), handle it automatically. HTTPS doesn't change *what* you communicate (methods, paths, bodies stay the same) — only *how safely* it travels.

## Where this shows up in the code

Every route we write uses this request/response shape directly:

```javascript
app.post('/products', (req, res) => {
  // req.body   → the request's data (parsed from JSON)
  // res.status(201).json({...}) → the response: status code + body
});
```

`req` and `res` are literally Express's representation of the HTTP request and response we just described.

---
⬅ [The Server](./01-the-server.md) · Next: [Routing →](./03-routing.md)