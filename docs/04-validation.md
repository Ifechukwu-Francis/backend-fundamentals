# 4. Validation — Never Trust What Comes In

## The core principle

**Anything coming from outside your server is untrusted, no matter who sent it.** Not because users are necessarily malicious, but because:

- People make mistakes (empty fields, wrong types)
- Frontend code can have bugs
- Someone can bypass the frontend entirely (Postman, custom scripts) — so frontend checks alone prove nothing
- Some people *are* deliberately malicious

If business logic assumes data is correct and just uses it, you get a confusing crash, or worse — corrupted data or a security hole. Validation catches bad data **at the door**, before it can cause damage.

## Step 1: Reading the request body

Express doesn't parse JSON bodies by default — you have to tell it to:

```javascript
app.use(express.json());
```

This is **middleware** — code that runs *between* the request arriving and your route handler executing. `express.json()` looks at incoming requests, and if the body is JSON, parses it into a regular object on `req.body`. Without this line, `req.body` is `undefined`.

## Version 1: Manual validation

```javascript
app.post('/products', (req, res) => {
  const { name, price } = req.body;

  if (!name || typeof name !== 'string') {
    return res.status(400).json({ message: 'Product name is required and must be a text' });
  }

  if (!price || typeof price !== 'number') {
    return res.status(400).json({ message: 'Product price is required and must be a number' });
  }

  const newProduct = { name, price };
  res.status(201).json({ message: 'Product created', product: newProduct });
});
```

**What's happening:**
- `const { name, price } = req.body` — destructuring, pulling fields directly out of the body.
- Each `if` is a **gate**: if the check fails, respond immediately and stop.
- **The `return` matters.** Without it, code keeps running after sending a response, and can try to send a second one — which crashes Express ("Cannot set headers after they are sent"). Once you respond, stop executing.
- Only if every check passes does the "create product" logic run.

### ⚠️ A real gotcha: type-looking values aren't the same as the type

Sending `"price": "25"` (a string) is different from `"price": 25` (a number) — even though they *look* similar. `typeof "25"` is `'string'`, not `'number'`, so a proper type check correctly rejects it. This is exactly the kind of thing validation exists to catch, since a frontend bug or a manually-crafted request could easily send the wrong type without anyone noticing.

## Version 2: Schema-based validation with Zod

Manual `if` checks don't scale — imagine 10 fields, each needing multiple rules, repeated across every route. **Zod** lets you define the rules once, as a schema:

```bash
npm install zod
```

```javascript
const { z } = require('zod');

const productSchema = z.object({
  name: z.string().min(2, 'Product name must be at least 2 characters'),
  price: z.number().positive('Price must be a positive number'),
});
```

```javascript
app.post('/products', (req, res) => {
  const result = productSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: result.error.issues.map(issue => issue.message),
    });
  }

  const newProduct = result.data;
  res.status(201).json({ message: 'Product created', product: newProduct });
});
```

**What's happening:**
- `.safeParse(req.body)` — checks the data against the schema *without* throwing an error, returning `{ success, data | error }` instead. (`.parse()` also exists but throws on failure — risky inside a route handler since an uncaught throw can crash the process.)
- `result.error.issues.map(issue => issue.message)` — pulls out just the readable error messages. **Note the `issue =>` arrow function** — `.map()` needs a function to run *for each* item in the array; forgetting the arrow function is a common typo that breaks this line silently.
- `result.data` — if validation succeeded, this is the clean, correctly-typed data, ready to use directly.

## Test cases worth running against `/products`

| Body | Expected result |
|---|---|
| `{ "name": "M", "price": 25 }` | ❌ 400 — name too short |
| `{ "name": "Mouse", "price": -5 }` | ❌ 400 — price not positive |
| `{ "name": "Mouse", "price": "25" }` | ❌ 400 — price wrong type (string, not number) |
| `{ "name": "Mouse", "price": 25 }` | ✅ 201 — created |

## Industry note

Validation should always happen **before** business logic runs — it's a gate, not an afterthought. And it's layered: frontend validation is for UX (bypassable), backend validation is the real gatekeeper (non-negotiable), and database constraints are the final safety net.

---
⬅️ [Routing](./03-routing.md) · Next: [Authentication & Authorization →](./05-authentication-and-authorization.md)