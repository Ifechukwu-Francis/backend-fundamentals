# 07 — Centralized Error Handling

Up until this step, every route defended itself individually. Validation failures, missing tokens, ownership checks — all handled with explicit `if` checks and early returns. But there was a real gap: **none of the database calls were protected against unexpected failures.** If Neon's database ever went unreachable mid-request, an `await prisma.user.create(...)` would throw, and Express's default behavior would kick in — either crashing the process or returning a raw, unstyled HTML page with a full stack trace exposed to whoever sent the request. (You actually saw this exact page earlier in the project, during the Prisma driver adapter debugging — that HTML error page *is* Express's out-of-the-box crash behavior.)

This doc covers how the project moved from routes that could crash unpredictably to a single, centralized place that catches every error consistently.

## Why "centralized," specifically

The alternative — wrapping every route's logic in its own `try/catch` — works, but it means every route has to remember to do it, and every route ends up repeating near-identical code. Centralizing means: **one function decides what an error response looks like**, and every route just needs a way to hand its errors off to that one function.

This gives three concrete benefits:
- **Consistency** — every unexpected failure returns the same shape: `{ "message": "..." }`, regardless of which route or what broke.
- **Safety** — no route can accidentally leak a raw stack trace or crash the whole server just by forgetting error handling.
- **One place to extend later** — logging every error, sending alerts, whatever comes next — it's one function to change, not every route.

## Express's four-argument middleware

Express recognizes a special kind of middleware purely by its argument count — four parameters instead of the usual three:

```javascript
function errorHandler(err, req, res, next) {
    console.error(err);
    res.status(500).json({ message: 'Something went wrong on our end' });
}

app.use(errorHandler);
```

That extra `err` parameter is what tells Express "this middleware only runs when something goes wrong." It only fires when code explicitly calls `next(err)` — passing an error into `next` instead of calling it empty (which just moves on to the next matching route).

**Positioning matters:** `app.use(errorHandler)` has to be the *last* thing registered, after every route. Express processes middleware in the order it's defined — an error handler registered too early simply wouldn't be reachable by routes defined after it.

**Why the client only gets a generic message:** `console.error(err)` logs the *real*, detailed error — including the stack trace — to your own terminal, where only you can see it. The response sent back to whoever made the request stays deliberately vague. This is a real security boundary: your own logs can be as detailed as you need, but a client-facing error should never expose internal details like database structure, file paths, or library internals — that's exactly the kind of information an attacker could use.

## Getting errors to the handler: the explicit way first

Express catches synchronous errors (a plain `throw` inside a normal function) automatically. But every route in this project is `async`, and **Express does not automatically catch errors thrown inside `async` functions** in the version used here — an unhandled rejected Promise just disappears, or crashes the process, without ever reaching `errorHandler`.

The fix, applied to every route by hand at first:

```javascript
app.post('/register', async (req, res, next) => {
    try {
        // ...all existing route logic, unchanged...
        res.status(201).json({ message: 'User registered successfully', userId: newUser.id });
    } catch (err) {
        next(err);
    }
});
```

Nothing about the route's actual behavior changed — the validation checks, the Prisma calls, the response — all identical. What's new:
- **`next` added as a third parameter** to the route — every Express handler technically receives `(req, res, next)`, but it wasn't needed until now.
- **The whole route body wrapped in `try { ... }`.**
- **`catch (err) { next(err); }`** — if anything inside the `try` throws (a Prisma network failure, a bcrypt error, anything not explicitly checked for), it's caught here and handed to `next(err)`, which routes it straight to `errorHandler`.

**Why the existing `if (!result.success) return res.status(400)...` checks didn't need this:** those aren't thrown errors — they're expected, deliberate outcomes the code already checks for and responds to directly. `try/catch` exists specifically for *unexpected* failures, not validation you're already handling on purpose.

This same change was applied identically across all four database-touching routes: `/register`, `/login`, `POST /products`, and `DELETE /products/:id`.

## Removing the repetition: a wrapper function

Once the same `try { ... } catch (err) { next(err); }` shape had been typed four times, identically, it was a clear signal to extract it:

```javascript
function asyncHandler(fn) {
    return function (req, res, next) {
        fn(req, res, next).catch(next);
    };
}
```

**What's happening here:**
- `asyncHandler` takes a function — the actual route logic — and returns a *new* function, which is what Express actually calls on each request. A function that takes a function and returns a function is called a **higher-order function**, and it's a common pattern in JavaScript for exactly this kind of reusable wrapping.
- Calling `fn(req, res, next)` runs the original async route logic. Since `fn` is `async`, calling it always returns a Promise.
- **`.catch(next)`** — if that Promise rejects (i.e., anything inside `fn` threw), this catches it and calls `next` with the error automatically. It's functionally identical to the manual `try/catch`, just written once here instead of copy-pasted into every route.

With the wrapper in place, every route shrank back down to just its actual logic:

```javascript
app.post('/register', asyncHandler(async (req, res, next) => {
    const result = registerSchema.safeParse(req.body);
    // ...
    res.status(201).json({ message: 'User registered successfully', userId: newUser.id });
}));
```

No `try`, no `catch`, no `next(err)` inside the route itself — the safety net moved into `asyncHandler`, defined once near the top of `server.js` alongside `authenticateToken`.

## Verifying it actually works

The real test isn't the happy path — it's forcing a failure. Temporarily losing the connection to the database (or catching Neon's free-tier database mid-"waking up") and hitting any of the four wrapped routes confirmed the fix: instead of a crash or a raw HTML stack trace, the response was a clean

```json
{ "message": "Something went wrong on our end" }
```

with a `500` status — while the real error, including the stack trace, was still fully visible in the terminal via `console.error`.

## What's next

Errors are now caught consistently everywhere, but they're only visible if someone happens to be watching the terminal at the moment it happens. The next step — logging — is about making sure that information is actually recorded somewhere useful, not just printed and lost the moment the terminal scrolls past it.