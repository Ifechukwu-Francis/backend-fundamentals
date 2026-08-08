# 5. Authentication & Authorization

## The core distinction

- **Authentication (AuthN)** — "Who are you?" Proving identity.
- **Authorization (AuthZ)** — "What are you allowed to do?" Even once identity is confirmed, that doesn't mean access to everything.

This project builds both: authentication via registration/login/JWTs, and one real form of authorization — **ownership-based** access control.

> ⚠️ **Note on this implementation:** users and products are currently stored in a plain in-memory array (`users = []`, `products = []`), not a real database. This means all data is lost on every server restart. This is intentional for now — it lets us focus purely on auth mechanics before adding database complexity. See [06-database.md](./06-database.md) *(coming soon)* for the real persistence layer.

---

## Part 1: Registration & Password Hashing

```bash
npm install bcrypt jsonwebtoken
```

```javascript
const bcrypt = require('bcrypt');
const users = [];

const registerSchema = z.object({
  email: z.string().email('Must be a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

app.post('/register', async (req, res) => {
  const result = registerSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: result.error.issues.map(issue => issue.message),
    });
  }

  const { email, password } = result.data;

  const existingUser = users.find(user => user.email === email);
  if (existingUser) {
    return res.status(409).json({ message: 'A user with this email already exists' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const newUser = { id: users.length + 1, email, password: hashedPassword };
  users.push(newUser);

  res.status(201).json({ message: 'User registered successfully', userId: newUser.id });
});
```

**Key points:**
- The route is `async` because `bcrypt.hash` takes real, deliberate time to compute — that's the whole point, it should be expensive to resist brute-force attacks.
- `bcrypt.hash(password, 10)` — `10` is the **salt rounds** (cost factor). Higher = slower to compute = harder to brute-force, but also slower for your server. `10` is a solid default.
- **The plain password is never stored** — only `hashedPassword` gets saved. This is non-negotiable in any real system.
- `409 Conflict` is used (not `400`) for "this resource already exists" — more precise than a generic client error.

---

## Part 2: Login & Issuing a JWT

```javascript
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;

const loginSchema = z.object({
  email: z.string().email('Must be a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

app.post('/login', async (req, res) => {
  const result = loginSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: result.error.issues.map(issue => issue.message),
    });
  }

  const { email, password } = result.data;

  const user = users.find(user => user.email === email);
  if (!user) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  const passwordMatches = await bcrypt.compare(password, user.password);
  if (!passwordMatches) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  const token = jwt.sign(
    { userId: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  res.status(200).json({ message: 'Login successful', token });
});
```

**Key points:**
- `bcrypt.compare(password, user.password)` — the server never "decrypts" a stored hash. It hashes the *incoming* password the same way and compares the two hashes.
- **Both failure cases return the exact same error message** — `"Invalid email or password"` — whether the email doesn't exist or the password is wrong. Returning different messages would let an attacker figure out which emails are actually registered.
- `jwt.sign(payload, secret, options)` — the payload (`userId`, `email`) is **signed, not encrypted**. Anyone can decode and read it; they just can't alter it without invalidating the signature. Never put sensitive data (passwords, etc.) in a JWT payload.
- `expiresIn: '1h'` — tokens automatically expire, limiting the damage window if one is ever stolen.

---

## Part 3: Environment Variables

The JWT secret must never be hardcoded in committed code — anyone who can read your source can forge tokens.

```bash
npm install dotenv
```

`.env` (never committed — must be in `.gitignore`):
```
JWT_SECRET=a-much-longer-random-secret-key-that-nobody-can-guess
PORT=3000
```

`.env.example` (**is** committed — shows the shape without exposing real values):
```
JWT_SECRET=your-secret-key-here
PORT=3000
```

At the very top of `server.js`:
```javascript
require('dotenv').config();
```

```javascript
const JWT_SECRET = process.env.JWT_SECRET;
const port = process.env.PORT || 3000;
```

> **Before pushing to GitHub**, always verify `.env` was never committed:
> ```bash
> git log --all --full-history -- .env
> ```
> If this returns nothing, your secret was never exposed in git history.

---

## Part 4: Protecting Routes with Middleware

```javascript
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token is required' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    req.user = decoded;
    next();
  });
}
```

**How it works, step by step:**
1. Tokens are sent by the client in a header: `Authorization: Bearer <token>` — this is a convention, not something the server invents.
2. `authHeader.split(' ')[1]` — splits `"Bearer abc123"` into `["Bearer", "abc123"]` and grabs the token itself.
3. No token at all → `401 Unauthorized`.
4. `jwt.verify` checks the token's signature was really produced by *this* server's secret, and that it hasn't expired.
5. Invalid/expired token → `403 Forbidden`.
6. Valid token → `decoded` (the original payload from login) is attached to `req.user`, so every downstream route handler knows who's making the request without re-verifying anything.
7. `next()` — hands control to the actual route handler. **If `next()` is never called, the request hangs forever** — a common beginner mistake worth remembering.

Using it on a route:
```javascript
app.get('/profile', authenticateToken, (req, res) => {
  res.json({ message: 'This is your profile', user: req.user });
});
```

`app.get(path, middleware, handler)` — Express runs these in order. The middleware runs first; only if it calls `next()` does the actual handler run.

---

## Part 5: Ownership-Based Authorization

Authentication tells you *who* someone is. It doesn't tell you whether they're allowed to modify a *specific piece of data*. That's what ownership checks are for.

```javascript
app.post('/products', authenticateToken, (req, res) => {
  const result = productSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: result.error.issues.map(issue => issue.message),
    });
  }

  const newProduct = {
    id: nextProductId++,
    name: result.data.name,
    price: result.data.price,
    ownerId: req.user.userId,
  };

  products.push(newProduct);
  res.status(201).json({ message: 'Product created', product: newProduct });
});
```

Every product is stamped with `ownerId: req.user.userId` at the moment of creation — this establishes who owns it.

```javascript
app.delete('/products/:id', authenticateToken, (req, res) => {
  const productId = parseInt(req.params.id);

  const product = products.find(p => p.id === productId);

  if (!product) {
    return res.status(404).json({ message: 'Product not found' });
  }

  if (product.ownerId !== req.user.userId) {
    return res.status(403).json({ message: 'You do not have permission to delete this product' });
  }

  const index = products.indexOf(product);
  products.splice(index, 1);

  res.status(200).json({ message: 'Product deleted successfully' });
});
```

**The actual ownership check:**
```javascript
if (product.ownerId !== req.user.userId) {
  return res.status(403).json({ message: '...' });
}
```
This compares *who created the resource* against *who is making this request right now*. If they don't match → `403`. Note the order of checks: existence (`404`) is checked **before** ownership (`403`) — you can't ask "do you own this?" about something that doesn't exist.

### ⚠️ A real bug worth knowing about (and how it was caught)

An earlier version of this code signed the JWT with a field called `id`:
```javascript
jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, ...) // ❌
```
but the ownership check read `req.user.userId` — a field that was never actually in the token. This made `req.user.userId` silently `undefined`.

Because `JSON.stringify` (used internally by `res.json()`) **completely omits properties with `undefined` values**, the `ownerId` field vanished from API responses entirely — instead of showing up as `null`, making the bug easy to miss.

Worse: `product.ownerId !== req.user.userId` became `undefined !== undefined`, which evaluates to `false` — meaning the ownership check **always silently passed**, letting any logged-in user delete any product.

**Lesson:** always test ownership/authorization logic with two different real accounts, not just one. A single-account test can never reveal whether an ownership check is real or accidentally always passing.

---

## Testing checklist

| Test | Expected result |
|---|---|
| Register a new user | `201` with `userId` |
| Register the same email again | `409 Conflict` |
| Register with invalid email/short password | `400` with validation errors |
| Login with correct credentials | `200` with a `token` |
| Login with wrong password | `401`, vague message |
| Login with unregistered email | `401`, **same** vague message |
| `GET /profile` with no token | `401` |
| `GET /profile` with a garbage token | `403` |
| `GET /profile` with a valid token | `200` with `req.user` payload |
| Create a product (User 1) | `201`, response includes `ownerId` |
| Delete that product as User 2 | `403 Forbidden` |
| Delete that product as User 1 (the owner) | `200`, success |
| Delete a non-existent product ID | `404` |

---
⬅ [Validation](./04-validation.md) · Back to [README](../README.md)