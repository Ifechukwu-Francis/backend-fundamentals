# 1. The Server

## What it actually is

Strip away the buzzwords: **a server is just a program that never stops running, and its whole job is to wait.**

Think of it like a shop attendant standing at a counter all day — not doing anything most of the time, just standing there, ready. The moment a customer walks up and asks for something, they respond, then go back to waiting. A server does the same thing, except the "customers" are other programs (browsers, mobile apps, other servers) sending requests over the internet.

## Why this is needed

Without a server, there's nothing on the other end of the line. If you write code that runs once and finishes, there's no way for someone else, somewhere else, to reach it and get a response. A server solves the problem of **availability** — it needs to be there, listening, so that whenever someone needs something from your application, someone is home to answer.

## How it works

A few concepts click together to make "waiting and responding" possible:

- **A process that stays alive** — instead of running top to bottom and exiting like a script, a server runs an internal loop: wait for something → handle it → go back to waiting.
- **A port** — like an apartment number on a building (the building being your computer's IP address). It's how the operating system knows which program on your machine should receive incoming traffic.
- **A socket** — the actual low-level connection point that makes exchanging data between two programs possible. The server opens a socket, binds it to a port — that's what "listening" technically means.
- **The event loop (JavaScript specific)** — a server needs to handle many people at once, not one at a time. Instead of freezing while handling one request, Node.js juggles many requests concurrently through the event loop. This is a big reason Node became popular for backend work.

## The actual code

```javascript
const express = require('express');

const app = express();
const port = 3000;

app.listen(port, () => {
  console.log(`server is running on port ${port}`);
});
```

- `require('express')` — pulls in the Express framework, which sits on top of Node's raw server capabilities and gives us conveniences (routing, middleware) instead of handling raw sockets manually.
- `express()` — creates your server application instance. Everything you build attaches to this `app`.
- `app.listen(port, callback)` — this is the line that makes the server actually start listening. It binds to the port and begins waiting for requests. The callback runs once, right when the server starts, just to confirm it's alive.

## How to test it

```bash
node server.js
```

Then visit `http://localhost:3000` in your browser. If you see `Cannot GET /`, that's actually a **good sign** — it means the server received your request and responded, it just doesn't know what to do with that path yet (that's the next concept: [Routing](./03-routing.md)).

## Industry note

Real production servers almost never run "raw" — frameworks like Express are standard. Servers are also typically run behind a **reverse proxy** (like Nginx) in production, but that's an operations-layer concept for later — just know the term exists.

---
⬅ [Back to README](../README.md) · Next: [HTTP & HTTPS →](./02-http-and-https.md)