# Offline-First POS with Next.js + Dexie + Prisma + Postgres

## 🏗 Project Architecture

### 1. High-Level Flow

```bash
Browser (Next.js App)
   ↔ Dexie (Offline DB)
   ↔ Sync Layer (API Routes in Next.js)
   ↔ Prisma ORM
   ↔ PostgreSQL (Server DB)
   ↔ Storage (S3/Azure/Supabase) for product images
```

### 2. Folder Structure

```bash
pos-app/
├── app/                       # Next.js (App Router)
│   ├── page.tsx               # POS dashboard (UI)
│   ├── products/              # Products management UI
│   ├── orders/                # Orders page
│   ├── inventory/             # Inventory page
│   ├── api/                   # Sync APIs
│   │   ├── sync/
│   │   │   ├── master/route.ts      # Sync Products & Categories
│   │   │   ├── orders/route.ts      # Sync Orders & OrderItems
│   │   │   ├── inventory/route.ts   # Sync Inventory transactions
│   │   │   └── images/route.ts      # Upload product images
│   └── layout.tsx             # Global layout
│
├── lib/
│   ├── db.ts                  # Dexie (client-side DB)
│   ├── sync.ts                # Sync functions (client ↔ API)
│   ├── prisma.ts              # Prisma client
│   ├── api-client.ts          # Helper for fetch requests
│
├── prisma/
│   ├── schema.prisma          # Prisma schema for Postgres
│
├── public/                    # Static files
│
├── package.json
├── tsconfig.json
├── .env                       # DATABASE_URL, S3/Azure config
```

### 3. Database Design (Postgres via Prisma)

**🔹 Master Data**

- Cegory → Product grouping
- Product → Name, price, stock, image URLat

**🔹 Transactional Data**

- Order → Each sale
- OrderItem → Products in order
- InventoryTransaction → Stock in/out

**Prisma Schema (simplified)**

```prisma
model Category {
  id        Int       @id @default(autoincrement())
  name      String
  updatedAt DateTime  @updatedAt
  products  Product[]
}

model Product {
  id          Int      @id @default(autoincrement())
  name        String
  price       Float
  stock       Int      @default(0)
  imageUrl    String?
  categoryId  Int
  category    Category @relation(fields: [categoryId], references: [id])
  updatedAt   DateTime @updatedAt
}

model InventoryTransaction {
  id        Int      @id @default(autoincrement())
  productId Int
  change    Int      // + for stock in, - for stock out
  reason    String
  product   Product  @relation(fields: [productId], references: [id])
  createdAt DateTime @default(now())
}

model Order {
  id        Int       @id @default(autoincrement())
  total     Float
  status    String    @default("pending")
  createdAt DateTime  @default(now())
  items     OrderItem[]
}

model OrderItem {
  id        Int      @id @default(autoincrement())
  orderId   Int
  productId Int
  quantity  Int
  price     Float
  order     Order    @relation(fields: [orderId], references: [id])
  product   Product  @relation(fields: [productId], references: [id])
}
```

**4. Client-Side (Dexie Schema)**

- categories (id, name, updatedAt)
- products (id, name, price, stock, categoryId, imageUrl, updatedAt)
- inventory (id, productId, change, reason, updatedAt)
- orders (id, total, status, updatedAt)
- orderItems (id, orderId, productId, quantity, price, updatedAt)

**5. Sync APIs**

/api/sync/master - GET → Fetch products + categories from Postgres → save to Dexie.

/api/sync/orders - POST → Push offline orders + items → insert in Postgres → return updated list.

/api/sync/inventory - POST → Push stock transactions → update Postgres stock + return latest stock.

/api/sync/images - POST → Upload product images → return URL → stored in product.imageUrl.

**6. Sync Logic (Client-Side)**

- On startup → load Dexie first (offline support).
- Periodically or when online →

  - syncMaster() → update categories/products.
  - syncOrders() → send offline orders.
  - syncInventory() → send offline inventory changes.

- Conflict handling:
  - Products → last updatedAt wins.
  - Transactions → always append (never overwrite).

**7. Image Handling**

- Store image in cloud storage (S3, Azure Blob, Supabase, Cloudinary).
- Save only imageUrl in Postgres + Dexie.
- For offline display, you can cache images in IndexedDB or use browser cache.

**8. Frontend Pages (Next.js)**

- / → POS dashboard (cart + checkout).
- /products → Manage products (view list, search, sync).
- /categories → Manage categories.
- /inventory → Track stock in/out.
- /orders → Order history.

**9. Architecture Diagram**

```batch
 ┌─────────────┐
 │   Browser   │
 │ Next.js UI  │
 │  Dexie DB   │
 └──────┬──────┘
        │
        │ Sync (API)
        ▼
 ┌─────────────┐
 │ Next.js API │
 │   (App Dir) │
 │   Prisma    │
 └──────┬──────┘
        │
        ▼
 ┌─────────────┐
 │ PostgreSQL  │
 │  (Cloud DB) │
 └─────────────┘
        │
        ▼
 ┌─────────────┐
 │  S3/Azure   │
 │ Product Img │
 └─────────────┘
```

## Write step by step guide to create project

**1. Create New project**

```bash
npx create-next-app@latest local_first_app

```

**2.Install Dexie**

```bash
bun add dexie
```

**3.Prisma Setup**

```bash
bun add @prisma/client
bunx prisma init
```

In .env (configure your Postgres):

```env
DATABASE_URL="postgresql://user:password@localhost:5432/mydb"

```

**4. Prisma Schema (/prisma/schema.prisma)**

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model Task {
  id        Int      @id @default(autoincrement())
  title     String
  completed Boolean   @default(false)
  updatedAt DateTime  @updatedAt
  createdAt DateTime  @default(now())
}
```

Then run:

```bash
bunx prisma migrate dev --name init
```

**5. Prisma Client (/lib/prisma.ts)**

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ["query"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

**6. Sync API (/app/api/sync/route.ts)**

This replaces the in-memory DB with real Postgres.

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const { tasks } = await req.json();

  // Merge local tasks into server DB
  for (const task of tasks) {
    if (!task.id) {
      // If no id, create a new task
      await prisma.task.create({
        data: {
          title: task.title,
          completed: task.completed,
          updatedAt: new Date(task.updatedAt),
        },
      });
    } else {
      // Check if exists
      const existing = await prisma.task.findUnique({
        where: { id: task.id },
      });

      if (existing) {
        // Conflict resolution: take the newer one
        if (task.updatedAt > existing.updatedAt.getTime()) {
          await prisma.task.update({
            where: { id: task.id },
            data: {
              title: task.title,
              completed: task.completed,
              updatedAt: new Date(task.updatedAt),
            },
          });
        }
      } else {
        // Insert if not found
        await prisma.task.create({
          data: {
            id: task.id,
            title: task.title,
            completed: task.completed,
            updatedAt: new Date(task.updatedAt),
          },
        });
      }
    }
  }

  // Send back all tasks from server (single source of truth)
  const serverTasks = await prisma.task.findMany();

  return NextResponse.json({ serverTasks });
}
```

**7. Adjust Dexie Schema (/lib/db.ts)**

Since Postgres IDs are integers (autoincrement), keep them aligned:

```ts
import Dexie, { Table } from "dexie";

export interface Task {
  id?: number; // Will match Postgres id
  title: string;
  completed: boolean;
  updatedAt: number; // timestamp for sync
}

class AppDB extends Dexie {
  tasks!: Table<Task, number>;

  constructor() {
    super("AppDB");
    this.version(1).stores({
      tasks: "++id, title, completed, updatedAt",
    });
  }
}

export const db = new AppDB();
```

**8. Sync Logic (/lib/sync.ts)**

Now when client syncs, it merges with Postgres:

```ts
import { db, Task } from "./db";

export async function syncTasks() {
  const localTasks = await db.tasks.toArray();

  try {
    const res = await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tasks: localTasks }),
    });

    const { serverTasks } = await res.json();

    // Merge server tasks into Dexie
    for (const task of serverTasks) {
      await db.tasks.put({
        ...task,
        updatedAt: new Date(task.updatedAt).getTime(),
      });
    }

    return { success: true };
  } catch (err) {
    console.error("Sync failed", err);
    return { success: false };
  }
}
```

**🔄 Workflow**
User creates/edits tasks → stored in Dexie (offline).

When syncing:

- Client sends all local tasks to /api/sync.
- API merges them into Postgres (conflict resolution by updatedAt).
- Server sends back all tasks from DB.
- Dexie updates to match the server (single source of truth).

This way, your app is:

- Offline-first → always loads from Dexie.
- Syncs with Postgres → keeps remote copy consistent.
