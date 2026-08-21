# 09 — Real-Time Updates with WebSocket

Everything built so far follows the same pattern: a client sends a request, the server sends back one response, and the connection ends there. That's how HTTP works, and it's the right model for almost everything in this project — registering, logging in, creating a product. But it has a real limitation: **the server can never speak first.** If another user creates a new product right now, there's no way for anyone else to find out except by manually sending a new request and asking.

This doc covers WebSocket — a different kind of connection that stays open, letting the server push information out the moment something happens, without being asked.

## The scenario this solves

Imagine this project as a small online marketplace: users list products for sale, other users browse them. Right now, if someone lists a new product, nobody else finds out unless they happen to refresh or re-request the list. This step adds a **live product feed** — the moment any user creates or deletes a product, every other user currently connected is notified instantly, the same way a live auction or marketplace page updates without a manual refresh.

Every registered user here is the same "type" of user — there's no admin or special role involved. This feature notifies *any* connected, authenticated user about *anyone's* activity; the only permission check that still applies is the existing ownership rule, which already governs who's allowed to delete a given product.

## WebSocket vs. HTTP: the key difference

An HTTP request is a single round trip: request in, response out, done. A WebSocket connection starts as a normal HTTP request too, but then **upgrades** into a connection that stays open — after that handshake, either side (client *or* server) can send messages at any time, independent of each other. That's what makes push notifications possible: the server doesn't need a request to send something.

## Installing `ws`

There are higher-level libraries like Socket.IO that handle reconnection logic and fallbacks automatically. This project uses [`ws`](https://github.com/websockets/ws) instead — a minimal, close-to-the-metal library — specifically so the underlying mechanism stays visible rather than hidden behind abstraction, matching how error handling and request logging were built in this project: the manual version first.

```bash
npm install ws
```

## Attaching WebSocket to the existing Express server

An important detail: **WebSocket doesn't run as a second server.** It attaches to the exact same underlying HTTP server Express already created — both REST routes and WebSocket connections share the same port.

Previously, the app started with:
```javascript
app.listen(port, () => { ... });
```

`app.listen(...)` is shorthand — internally, Express creates a raw Node HTTP server and starts it, without ever exposing that server object. To let `ws` attach to it, that server needs to be created explicitly instead:

```javascript
const http = require('http');
const server = http.createServer(app);
```

This does the same job `app.listen` was doing internally — it just makes the underlying server visible, so something else (`ws`) can also use it. `app.listen` was then replaced with:

```javascript
server.listen(port, () => {
    logger.info(`server is running on port ${port}`);
});
```

Nothing about *when* the server starts changed — only *what* creates and starts it.

## Setting up the WebSocket server

```javascript
const { WebSocketServer } = require('ws');
const wss = new WebSocketServer({ server });
```

Passing `{ server }` tells `ws`: listen for upgrade requests on this same HTTP server, rather than creating a separate one. This is placed near the bottom of `server.js`, grouped together with the rest of the WebSocket-specific code — `server`, `wss`, the connection handler, and `server.listen(...)` all sit together, after every route and after `app.use(errorHandler)`, so all of Express's setup is fully assembled before the raw server and WebSocket layer are built on top of it.

## Authenticating a WebSocket connection

WebSocket connections don't carry an `Authorization` header the way ordinary requests do after the initial handshake, so the JWT is passed as a query parameter on the connection URL instead:

```
ws://localhost:3000?token=<jwt-token>
```

```javascript
wss.on('connection', (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            ws.close(1008, 'Invalid or expired token');
            return;
        }

        ws.user = decoded;
        logger.info(`WebSocket connection established for user: ${decoded.email}`);
    });
});
```

- **`wss.on('connection', ...)`** fires once per client that successfully opens a connection. `ws` here is that *specific* client's connection — not to be confused with `wss`, the whole server.
- **Extracting the token from the URL** rather than a header, since that's the practical way to pass it during a WebSocket handshake.
- **`jwt.verify(...)`** is the exact same function [`authenticateToken`](./05-authentication-and-authorization.md) already uses for REST routes — same secret, same verification — just triggered once at connection time instead of on every request.
- **`ws.close(1008, ...)`** immediately closes the connection with a real WebSocket close code (`1008` = policy violation) if the token is invalid, rather than letting an unauthenticated connection stay open.
- **`ws.user = decoded`** attaches the decoded user info directly onto this specific connection, so later code can identify who this open connection belongs to.

## Broadcasting to every connected client

```javascript
function broadcast(message) {
    wss.clients.forEach((client) => {
        if (client.readyState === client.OPEN) {
            client.send(JSON.stringify(message));
        }
    });
}
```

- **`wss.clients`** is a `Set` that `ws` maintains automatically, containing every currently-connected client — no manual bookkeeping required.
- **`client.readyState === client.OPEN`** guards against sending to a connection that's mid-disconnect or already closed, which would otherwise throw.
- **`client.send(JSON.stringify(message))`** — WebSocket messages are sent as text, not JavaScript objects, so the message is serialized to a JSON string; the receiving client parses it back with `JSON.parse`.

`broadcast` is defined near `wss`, at the bottom of the file — but it's still callable from routes defined much earlier, because function declarations (`function broadcast(...) {}`) are hoisted throughout the file. By the time any real request can reach a route, the server has already fully started and `wss` already exists.

## Triggering broadcasts from existing routes

The REST routes themselves barely changed — one line was added to each, right after the database operation succeeds and before the response is sent:

**`POST /products`:**
```javascript
const newProduct = await prisma.product.create({ ... });

broadcast({
    event: 'product_created',
    product: newProduct,
    by: req.user.email,
});

res.status(201).json({ message: 'Product created', product: newProduct });
```

**`DELETE /products/:id`:**
```javascript
await prisma.product.delete({ where: { id: productId } });

broadcast({
    event: 'product_deleted',
    productId: productId,
    by: req.user.email,
});

res.status(200).json({ message: 'Product deleted successfully' });
```

Placing the broadcast *after* the database call succeeds, but still inside the same `asyncHandler`-wrapped route, matters: if the database operation had failed, execution would never reach the broadcast at all — nobody gets notified about a product that doesn't actually exist.

## Verifying it works

Testing this needs a connection that stays open, which is different from the request/response testing used everywhere else in this project. Postman supports this directly, as a separate request type from its normal HTTP requests:

1. Open a **WebSocket Request** in Postman, connect to `ws://localhost:3000?token=<a-real-jwt-from-login>`.
2. In a separate tab, send an ordinary `POST /products` (or `DELETE /products/:id`) request, exactly as before.
3. Back in the WebSocket tab, the corresponding `product_created` or `product_deleted` message appears in the message log — pushed by the server, without the WebSocket tab ever sending a request of its own.

A second connected client (a different logged-in user) receives the same broadcast, confirming this is a genuine broadcast to everyone listening — not just a notification back to whoever made the change.

## Where this leaves the project

REST and WebSocket now coexist on the same server: ordinary CRUD operations work exactly as they did before, but two of them now also announce themselves in real time to anyone connected. This is the same authentication system, the same database, and the same routes — just with one additional way for the server to communicate.