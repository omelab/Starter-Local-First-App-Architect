import Dexie, { Table } from "dexie";

export interface Category {
  id?: number;
  name: string;
  updatedAt: number;
}

export interface Product {
  id?: number;
  name: string;
  price: number;
  stock: number;
  imageUrl?: string;
  categoryId: number;
  updatedAt: number;
}

export interface InventoryTransaction {
  id?: number;
  productId: number;
  change: number;
  reason: string;
  updatedAt: number;
}

export interface Order {
  id?: number;
  total: number;
  status: string;
  updatedAt: number;
  synced: boolean;
}

export interface OrderItem {
  id?: number;
  orderId: number;
  productId: number;
  quantity: number;
  price: number;
  updatedAt: number;
}

export interface SyncQueue {
  id?: number;
  table: string;
  action: "create" | "update" | "delete";
  record: unknown;
  updatedAt: number;
}

export interface Meta {
  key: string;
  value: unknown;
}

class AppDB extends Dexie {
  categories!: Table<Category, number>;
  products!: Table<Product, number>;
  inventory!: Table<InventoryTransaction, number>;
  orders!: Table<Order, number>;
  orderItems!: Table<OrderItem, number>;
  syncQueue!: Table<SyncQueue, number>;
  meta!: Table<Meta, string>;

  constructor() {
    super("AppDB");
    this.version(2).stores({
      categories: "++id, name, updatedAt",
      products: "++id, name, categoryId, updatedAt",
      inventory: "++id, productId, updatedAt",
      orders: "++id, status, updatedAt",
      orderItems: "++id, orderId, productId, updatedAt",
      syncQueue: "++id, table, action, updatedAt",
      meta: "key", // store metadata like lastSync
    });
  }
}

export const db = new AppDB();
