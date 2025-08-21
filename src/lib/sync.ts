import { pushToServer } from "./api-client";
import { db } from "./db";

export async function syncCategory() {
  // 1. Get local category updated after last sync
  const localCategories = await db.categories.toArray();

  try {
    // 2. Push local changes to server
    const res = await fetch("/api/sync/category", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categories: localCategories }),
    });

    const { serverCategories } = await res.json();

    // 3. Merge server category into Dexie
    for (const category of serverCategories) {
      await db.categories.put({
        ...category,
        updatedAt: new Date(category.updatedAt).getTime(),
      });
    }

    return { success: true };
  } catch (err) {
    console.error("Sync failed", err);
    return { success: false };
  }
}

export async function syncOrders() {
  const localOrders = await db.orders.toArray();
  const localItems = await db.orderItems.toArray();

  const res = await fetch("/api/sync/orders", {
    method: "POST",
    body: JSON.stringify({
      orders: localOrders,
      orderItems: localItems,
    }),
  });

  const { idMap } = await res.json();

  // Update local DB with new server IDs
  for (const map of idMap) {
    await db.orders.update(map.localId, { id: map.serverId });
    await db.orderItems.where({ orderId: map.localId }).modify({
      orderId: map.serverId,
    });
  }
}

export async function startOfDay() {
  const unsynced = await db.orders.where("synced").equals(false).count();
  if (unsynced > 0) {
    alert("Unsynced orders exist! Please sync before starting a new day.");
    return;
  }

  // Clear local DB
  await db.products.clear();
  await db.orders.clear();

  // Pull fresh data from server
  const { products } = await pullServerData();
  for (const p of products) {
    await db.products.add({
      serverId: p.id,
      name: p.name,
      stock: p.stock,
      price: p.price,
      updatedAt: Date.now(),
    });
  }
  console.log("✅ Start-of-day complete");
}

export async function createOrder(order: unknown) {
  order.updatedAt = Date.now();
  order.synced = false;

  // Decrease local stock
  for (const item of order.items) {
    const product = await db.products.get({ serverId: item.productId });
    if (product) {
      await db.products.update(product.id!, {
        stock: product.stock - item.quantity,
      });
    }
  }

  await db.orders.add(order);
}

export async function endOfDaySync() {
  const unsyncedOrders = await db.orders
    .where("synced")
    .equals(false)
    .toArray();
  if (unsyncedOrders.length === 0) return;

  const { idMap, serverStock } = await pushToServer("", unsyncedOrders);

  // Update local orders as synced
  for (const map of idMap) {
    await db.orders.update(map.localId, {
      synced: true,
    });
  }

  // Update local stock
  for (const s of serverStock) {
    await db.products.where({ serverId: s.id }).modify({ stock: s.stock });
  }

  console.log("✅ End-of-day sync complete");
}
