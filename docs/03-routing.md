# 3. Routing — Deciding What to Do With a Request

## Why this is needed

A real backend does dozens of different things: create a user, fetch a product, delete a comment, log someone in. Without routing, every request would end up handled by the same pile of logic, with no clean way to separate "get all products" from "delete a specific comment." Routing exists to **map each specific request to the specific piece of logic responsible for handling it.**

Think of it like a receptionist directing visitors to the right department — they don't do the work themselves, they just know where to send each person.

## How it works

A route is a combination of **method + path**, matched to a handler function:

```javascript
GET     /products        → "give me the list of products"
GET     /products/12     → "give me details for product #12"
POST    /products        → "create a new product"
```

Notice: the **same path** can mean different things depending on the method. Method + path together form a route's identity.

## Route parameters — handling values that change

You can't write a separate route for every possible product ID. Instead, part of the path becomes a variable:

```javascript
app.get('/products/:id', (req, res) => {
  const productId = req.params.id;
  res.json({ id: productId, name: 'Sample Product' });
});
```

`:id` is a placeholder. A request to `/products/12` matches this route, and Express puts `12` into `req.params.id`. This is what makes routing **dynamic** instead of only handling exact, hardcoded matches.

## Query parameters — filters and options

```javascript
app.get('/search', (req, res) => {
  const category = req.query.category;
  const sort = req.query.sort;
  res.send(`Searching category: ${category}, sorted by: ${sort}`);
});
```

A request like `/search?category=shoes&sort=price` puts everything after the `?` into `req.query`.

**The distinction:**
- Route parameter → identifies **which** resource (`/products/12`)
- Query parameter → modifies **how** to fetch/filter it (`/products?category=shoes`)

## ⚠️ Route order matters (a real bug worth knowing)

If you have both a dynamic and a static route at the same "position," **order determines which one wins.**

```javascript
// ❌ WRONG ORDER
app.get('/products/:id', (req, res) => { ... });      // this matches almost anything
app.get('/products/featured', (req, res) => { ... });  // never reached — "featured" gets treated as an :id
```

```javascript
// ✅ CORRECT ORDER — specific/static routes first
app.get('/products/featured', (req, res) => { ... });
app.get('/products/:id', (req, res) => { ... });
```

**Rule:** static routes should come before dynamic routes that could accidentally "catch" them. Express matches top to bottom and stops at the first match.

## Industry standard: RESTful routing

Use the HTTP **method** to express the action, and the **path** to express the resource — don't stuff verbs into the path.

| ❌ Non-RESTful | ✅ RESTful |
|---|---|
| `POST /createProduct` | `POST /products` |
| `POST /deleteProduct/12` | `DELETE /products/12` |

The verb is already expressed by the HTTP method — repeating it in the path is redundant.

---
⬅ [HTTP & HTTPS](./02-http-and-https.md) · Next: [Validation →](./04-validation.md)