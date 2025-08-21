import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { orders } = await req.json();
  const idMap: { localId: number; serverId: number }[] = [];

  for (const order of orders) {
    const createdOrder = await prisma.order.create({
      data: { total: order.total, status: order.status },
    });
    idMap.push({ localId: order.id, serverId: createdOrder.id });

    for (const item of order.items) {
      await prisma.orderItem.create({
        data: {
          orderId: createdOrder.id,
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
        },
      });
      await prisma.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } },
      });
    }
  }

  const products = await prisma.product.findMany({
    select: { id: true, stock: true },
  });
  return NextResponse.json({ idMap, serverStock: products });
}
