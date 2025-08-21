import { useEffect, useState } from "react";
import { db } from "@/lib/db";
import { startOfDay, createOrder, endOfDaySync } from "@/lib/sync";

export default function Page() {
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    db.products.toArray().then(setProducts);
  }, []);

  const handleStartDay = async () => {
    await startOfDay();
    setProducts(await db.products.toArray());
  };

  const handleEndDay = async () => {
    await endOfDaySync();
    setProducts(await db.products.toArray());
  };

  const handleCreateOrder = async () => {
    await createOrder({
      total: 100,
      status: "paid",
      items: [{ productId: 1, quantity: 1, price: 100 }],
    });
    alert("Order saved locally!");
  };

  return (
    <div>
      <h1>Offline-First POS</h1>
      <button onClick={handleStartDay}>Start Day (Pull)</button>
      <button onClick={handleCreateOrder}>Create Order</button>
      <button onClick={handleEndDay}>End Day (Sync)</button>

      <h2>Products</h2>
      <ul>
        {products.map((p) => (
          <li key={p.id}>
            {p.name} - Stock: {p.stock} - Price: {p.price}
          </li>
        ))}
      </ul>
    </div>
  );
}
