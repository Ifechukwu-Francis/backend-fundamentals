# 08 — Logging

Error handling (see [07](./07-error-handling.md)) made sure the *client* never sees a raw crash. But it left an important gap: the only place any of this was ever visible was your own terminal, via `console.error`. Close that terminal, and every record of what happened is gone.

This doc covers how the project moved from console-only output to structured, persistent logging — using [Winston](https://github.com/winstonjs/winston) — for both errors and every incoming request.

## Why logging is a separate concern from error handling

Error handling decides *what to do* when something goes wrong — return a clean response instead of crashing. Logging is about **leaving a permanent record**, so a question like "what happened at 3am when a user said login failed?" has an actual answer, days later, on a server you're not even watching live.

## What's worth logging

Logging *everything* buries the useful signal in noise. Logging *only errors* means you have no record of what normal traffic even looked like. This project settled on three categories:

- **Every incoming request** — method, path, status code, response time. Useful for spotting patterns (repeated failed logins, an unexpectedly slow route) even when nothing technically "errored."
- **Every error** — already caught by the centralized error handler; now written somewhere permanent instead of just printed.
- **Meaningful application events** — like the server starting up. Small, but genuinely useful for answering "did my last restart actually take effect?"

## Log levels

Real logging systems categorize messages by severity, in this order of priority: `error` > `warn` > `info` > `debug`. This project uses:

- **`error`** — something broke; needs attention.
- **`info`** — normal operational events: the server starting, a request completing.

The point of levels isn't just categorization — it's **configurability without touching your code**. In production you might only want to see `error` and `warn`; while actively debugging, you might want everything down to `debug`. That's a one-line config change, not a rewrite of every log call.

## Setting up Winston

```bash
npm install winston
```

Configured in its own file, `logger.js`, alongside `server.js` — the same pattern already used for `authenticateToken` and `asyncHandler`: a reusable piece, defined once, used everywhere.

```javascript
const winston = require('winston');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' }),
    ],
});

if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        ),
    }));
}

module.exports = logger;
```

A few things worth understanding:

- **`level: 'info'`** — the *minimum* severity Winston will record. `error` and `info` both pass; `debug` would be silently dropped. Changing this one line changes verbosity everywhere, instantly.
- **`timestamp()` + `json()`** — every log entry gets a timestamp automatically, and is written as structured JSON rather than a plain string. This matters once you have more than a handful of log lines: JSON is trivially searchable and filterable by other tools, plain text isn't.
- **Two file `transports`** (Winston's term for "where logs get written"): `error.log` only receives `error`-level entries (a fast place to check "what actually broke"), while `combined.log` receives everything — a full record of normal operation plus errors.
- **The development-only console transport** — prints logs to the terminal too, colorized and human-readable, but *only* when not running in production (`NODE_ENV !== 'production'`). In a real deployment you generally don't want console clutter; the files are the actual record. Locally, though, seeing logs live is genuinely useful while coding.

`logs/` is added to `.gitignore` — log files are runtime output generated fresh wherever the app runs, the same category as `node_modules` or the generated Prisma client.

## Wiring it into the app

```javascript
const logger = require('./logger');
```

**The error handler now writes to Winston instead of `console.error`:**
```javascript
function errorHandler(err, req, res, next) {
    logger.error(err.message, { stack: err.stack });
    res.status(500).json({ message: 'Something went wrong on our end' });
}
```

The second argument — `{ stack: err.stack }` — is Winston's way of attaching structured metadata alongside a message. The full stack trace ends up stored in the log entry itself, not just a one-line summary, without cluttering the message text.

**The server startup message moved from `console.log` to `logger.info`:**
```javascript
app.listen(port, () => {
    logger.info(`server is running on port ${port}`);
});
```

Small change, but it means "when was this server last restarted" is now a permanent, timestamped fact in `logs/combined.log`, not something only visible in a terminal you've since closed.

## Logging every request

Errors and startup only cover part of the picture — most requests don't error at all, and having zero record of ordinary traffic makes it impossible to notice patterns (repeated failed logins from one source, a route that's unexpectedly slow) until something breaks outright.

```javascript
app.use((req, res, next) => {
    const start = Date.now();

    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
    });

    next();
});
```

Registered early — right after `app.use(express.json())`, before any routes — so it runs for every request.

**Why it's built this way:**

- **`app.use(...)` with no path** — this middleware applies to every request, regardless of method or route, unlike route-specific middleware such as `authenticateToken`.
- **`res` is an EventEmitter, and emits `'finish'`** once Express has fully sent the response. Logging inside that listener — instead of immediately — is what lets the log line include the *actual* final status code (`200`, `404`, `500`, whatever it ends up being), which isn't known yet at the top of the middleware.
- **`next()` is called immediately, outside the listener.** This is the part that actually lets the request proceed to its route handler. The `finish` listener just waits quietly in the background; it doesn't block anything. Putting `next()` inside the callback instead would hang every request forever, since nothing would ever move it forward.
- **`req.originalUrl`** rather than `req.url` — preserves the full path as the client requested it, a more reliable choice once any route-level middleware is involved.

## A note on doing this by hand vs. a library

This request-logging middleware was written manually, the same way the error-handling `try/catch` was written manually before being replaced by `asyncHandler`. In a real production project, this exact job is very commonly handled by [**morgan**](https://www.npmjs.com/package/morgan), a small dedicated Express logging middleware — `app.use(morgan('combined'))` gets similar output in one line.

The manual version wasn't built because it's the "correct" way — it's built because seeing the actual mechanism (middleware with no path, `res.on('finish')`, why `next()` fires immediately rather than after) makes tools like `morgan` make sense as a shortcut, instead of feeling like an unexplained black box.

## Verifying it all works

- **Startup**: `logs/combined.log` contains an `info` entry the moment the server starts.
- **Errors**: deliberately breaking `DATABASE_URL` and hitting a database-backed route produces a clean `500` response to the client, while `logs/error.log` records the real error message and full stack trace.
- **Every request**: hitting any route — successful or not — produces a corresponding `info` line in `logs/combined.log`, in the shape `METHOD /path STATUS - Xms`.

## Where this leaves the project

With database integration, centralized error handling, and structured logging all in place, this project now demonstrates a genuinely complete (if intentionally small) backend: real persistent storage, authentication and authorization, validated input, errors that fail safely instead of crashing, and a permanent record of what the server actually did. That's the full arc this repo set out to teach.