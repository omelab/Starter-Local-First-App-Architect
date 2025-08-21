import { db } from "./db";

export async function queueChange(
  table: string,
  action: "create" | "update" | "delete",
  record: unknown
) {
  await db.syncQueue.add({
    table,
    action,
    record,
    updatedAt: Date.now(),
  });
}

// Example usage when adding an order:
// await db.orders.add(order);
// await queueChange("orders", "create", order);
