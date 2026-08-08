# 06 — Connecting a Real Database

Up to this point, every user and product in this project has lived in a plain JavaScript array — `users = []`, `products = []`. That worked for learning the concepts, but it has a fatal flaw: **the moment you restart the server, everything is gone.** Real applications need storage that survives restarts, crashes, and deployments. That's what a database gives you.

This doc walks through how this project moved from in-memory arrays to a real, persistent PostgreSQL database, using [Prisma](https://www.prisma.io/) as the tool that sits between our code and the database.

## Why Prisma, and what is an ORM?

You *could* write raw SQL directly in your routes — `INSERT INTO users...`, `SELECT * FROM products WHERE...`. Plenty of production apps do exactly that. But raw SQL as a string is easy to get wrong, awkward to keep in sync with your actual data shape, and doesn't give you any help from your editor.

Prisma is an **ORM** — an Object-Relational Mapper. It lets you define your data shape once (in a schema file) and then interact with your database using regular JavaScript function calls like `prisma.user.create(...)` instead of hand-written SQL strings. Prisma translates those calls into real SQL behind the scenes.

The tradeoff: you're trusting a tool to generate correct SQL for you, and you have one more layer to understand when something goes wrong. For a learning project — and for a lot of real ones — that tradeoff is worth it.

## Step 1: Getting a real Postgres database with Neon

PostgreSQL itself is just database software — something has to actually run it. You could install Postgres locally, but for this project we used [Neon](https://neon.tech), which gives you a free, fully managed Postgres database in the cloud in about a minute, with no local installation.

After creating a Neon project, Neon gives you a **connection string** — a single URL that contains everything needed to connect: host, port, database name, username, and password, all packed together, e.g.:

```
postgresql://user:password@ep-bold-water-zal8tvrz-pooler.c-2.eu-west-2.aws.neon.tech/neondb?sslmode=require
```

This is a secret. It goes in `.env` as `DATABASE_URL`, never committed to git — same rule as `JWT_SECRET`. A placeholder version goes in `.env.example` so other people cloning the repo know the variable exists without seeing the real value.

## Step 2: Installing and initializing Prisma

```bash
npm install prisma --save-dev
npm install @prisma/client
```

Notice these are two separate packages with two different jobs:

- **`prisma`** (dev dependency) — the command-line tool you use *while building* the app: generating files, running migrations.
- **`@prisma/client`** (regular dependency) — the library your *running app* actually imports and uses to talk to the database.

Then:

```bash
npx prisma init
```

This scaffolds a `prisma/` folder containing `schema.prisma` — the single file where you describe your entire data shape.

## Step 3: Defining the schema

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        Int       @id @default(autoincrement())
  email     String    @unique
  password  String
  products  Product[]
  createdAt DateTime  @default(now())
}

model Product {
  id      Int    @id @default(autoincrement())
  name    String
  price   Float
  owner   User   @relation(fields: [ownerId], references: [id])
  ownerId Int
}
```

A few things worth understanding line by line:

- **`@id @default(autoincrement())`** — marks this field as the primary key, and tells Postgres to assign the next number automatically. You never set an `id` yourself; the database does it.
- **`@unique`** on `email` — a real database-level constraint. Postgres itself will refuse a duplicate, not just our application code.
- **`products Product[]`** on `User` — this isn't a real column in the database. It's a *relation accessor*: a convenience Prisma gives you so you can write `user.products` in code to fetch a user's products, without you manually writing that join.
- **`ownerId Int`** on `Product` — this *is* a real column: a foreign key, storing the `id` of the `User` who owns this product.

**A naming question worth pausing on:** why is it `ownerId` on `Product`, but `userId` inside the JWT payload elsewhere in this app? They both just hold "a user's ID number" — so why two different names?

Because a field name should describe the *role* that value plays in its specific context, not just its type. `ownerId` on a `Product` tells you exactly what relationship that ID represents — this user *owns* this product. If `Product` later needed a second user reference (say, `lastEditedByUserId`), having everything generically called `userId` would get confusing fast. The code that compares them doesn't care about the names matching — `product.ownerId !== req.user.userId` works by comparing the *values* on each side, not the variable names.

## Step 4: Running the first migration

```bash
npx prisma migrate dev --name init
```

This command does two things:

1. Compares your schema to the actual state of the database, and generates a `migration.sql` file containing the SQL needed to make the database match — in this case, `CREATE TABLE` statements for `User` and `Product`.
2. Runs that SQL against your real Neon database.

The result is saved under `prisma/migrations/`, timestamped, so your project has a permanent, ordered history of every schema change — not just the current state, but *how* you got there. This matters in real teams: migrations are how everyone's database stays in sync as the schema evolves.

## Step 5: Generating the Prisma Client

Your schema describes the data. The **Prisma Client** is the actual JavaScript code — generated from that schema — that gives you methods like `prisma.user.create()` with the correct fields already known. It's regenerated any time the schema changes:

```bash
npx prisma generate
```

> **A gotcha worth knowing about:** newer versions of Prisma (7.x, which this project uses) support multiple client generators. The default generator in some setups (`provider = "prisma-client"`) outputs **TypeScript** files meant for modern build tooling — not something a plain `require()` in a CommonJS Node file can load directly. For a standard Node/Express app like this one, the classic generator is what you want:
>
> ```prisma
> generator client {
>   provider = "prisma-client-js"
> }
> ```
>
> This generates plain `.js` output into `node_modules/.prisma/client`, which `require('@prisma/client')` finds automatically — no custom import paths needed.

## Step 6: Connecting the client — Prisma 7's driver adapter requirement

Older Prisma versions let you connect with just:

```javascript
const prisma = new PrismaClient();
```

**Prisma 7 removed that built-in connection engine.** You now have to explicitly tell Prisma *how* to talk to your specific database, using a small "driver adapter" package:

```bash
npm install @prisma/adapter-pg
```

```javascript
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
```

- `PrismaPg` specifically knows how to speak Postgres — other databases (MySQL, SQLite) have their own adapter packages.
- You construct it with your connection string, so it knows *where* to connect.
- You pass it into `PrismaClient({ adapter })` — note the object with a key named `adapter`, not the adapter passed in directly. This one tripped us up during the build — `new PrismaClient(adapter)` (no braces) throws a confusing "Unknown property" error, because Prisma tries to read the adapter's *own* internal fields as if they were constructor options.

## Step 7: Swapping the routes, one at a time

With the client wired up, every route that used to touch an array now uses `prisma` instead. The pattern is consistent across all four:

**Registration** — array `.find()` and `.push()` become:
```javascript
const existingUser = await prisma.user.findUnique({ where: { email } });
// ...
const newUser = await prisma.user.create({ data: { email, password: hashedPassword } });
```

**Login** — same swap for the lookup:
```javascript
const user = await prisma.user.findUnique({ where: { email } });
```

**Creating a product:**
```javascript
const newProduct = await prisma.product.create({
  data: { name: result.data.name, price: result.data.price, ownerId: req.user.userId },
});
```

**Deleting a product:**
```javascript
const product = await prisma.product.findUnique({ where: { id: productId } });
// ...ownership check stays exactly the same...
await prisma.product.delete({ where: { id: productId } });
```

Two important, easy-to-miss details that apply to every one of these swaps:

- **Every Prisma call is asynchronous.** It's a real network request to a database sitting on a server somewhere, not an instant read from local memory — so every call needs `await`, and every route handler using `await` must be declared `async`.
- **`findUnique` only works on fields marked `@unique`** in the schema (like `email`, or `id`, which is always unique as the primary key). It's how Prisma guarantees at most one result, matching the "exactly one match or none" semantics we relied on with `.find()`.

Notice what *didn't* change: business logic like the ownership check (`product.ownerId !== req.user.userId`) stayed identical. Only the *data access* — where the data came from — changed. That's a good sign of a reasonably well-structured route: swapping the storage layer didn't require rewriting the rules.

## Verifying it's real

The real proof this all worked: after registering a user or creating a product, the row is visible in Neon's own dashboard — a table you can browse, completely independent of your Node process. Restart the server, and the data is still there. That's the entire point.

## What's next

The database is now the single source of truth for this app — no more arrays, no more data disappearing on restart. From here, the project moves on to centralized error handling and logging: making sure failures (including database failures) are caught, reported consistently, and actually visible when something goes wrong in production.