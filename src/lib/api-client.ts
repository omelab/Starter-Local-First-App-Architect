/**
 * A small API client for communicating with Next.js API routes.
 * Handles sync calls, CRUD operations, and error handling.
 */

export type ApiMethod = "GET" | "POST" | "PUT" | "DELETE";

async function apiClient<T>(
  url: string,
  method: ApiMethod = "GET",
  body?: unknown
): Promise<T> {
  try {
    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      throw new Error(`API error: ${res.status} ${res.statusText}`);
    }

    return (await res.json()) as T;
  } catch (err) {
    console.error("API Client Error:", err);
    throw err;
  }
}

/**
 * Sync API — pushes local changes and pulls remote updates.
 */
export async function syncWithServer(changes: unknown) {
  return apiClient<{ success: boolean; updatedAt: string; data: unknown }>(
    "/api/sync",
    "POST",
    { changes }
  );
}

/**
 * Fetch data to update local dbs.
 */
export async function pullFromServer(location: string) {
  return apiClient<[]>(location, "GET");
}

/**
 * Push Data to server
 * @param location:string, Data: any[]
 * @returns
 */
export async function pushToServer(location: string, data: unknown[]) {
  const res = await fetch(location, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data }),
  });
  return res.json();
}

/**
 * Example CRUD API wrappers
 */

// Fetch all products
export async function fetchProducts() {
  return apiClient<unknown[]>("/api/products", "GET");
}

// Create new order
export async function createOrder(order: unknown) {
  return apiClient<{ id: string }>("/api/orders", "POST", order);
}

// Fetch categories
export async function fetchCategories() {
  return apiClient<unknown[]>("/api/categories", "GET");
}

// Upload product image (stub – you can replace with real upload API later)
export async function uploadProductImage(productId: string, imageFile: File) {
  const formData = new FormData();
  formData.append("image", imageFile);

  const res = await fetch(`/api/products/${productId}/image`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    throw new Error("Image upload failed");
  }

  return res.json();
}
