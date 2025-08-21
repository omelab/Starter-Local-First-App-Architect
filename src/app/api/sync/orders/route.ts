import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { orders, orderItems } = await req.json();

  const idMap: { localId: number; serverId: number }[] = [];

  // Save orders
  for (const order of orders) {
    if (!order.id) {
      const created = await prisma.order.create({
        data: {
          total: order.total,
          status: order.status,
        },
      });
      idMap.push({ localId: order.id, serverId: created.id });
    }
  }

  // Replace localId with serverId in orderItems
  for (const item of orderItems) {
    const serverOrderId =
      item.orderId ??
      idMap.find((m) => m.localId === item.localOrderId)?.serverId;

    if (!serverOrderId) continue;

    await prisma.orderItem.create({
      data: {
        orderId: serverOrderId,
        productId: item.productId,
        quantity: item.quantity,
        price: item.price,
      },
    });

    // Update stock
    await prisma.product.update({
      where: { id: item.productId },
      data: { stock: { decrement: item.quantity } },
    });
  }

  return NextResponse.json({ success: true, idMap });
}
