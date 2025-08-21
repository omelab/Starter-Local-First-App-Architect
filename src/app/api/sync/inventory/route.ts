import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { transactions } = await req.json();

  for (const tx of transactions) {
    await prisma.inventoryTransaction.create({
      data: {
        productId: tx.productId,
        change: tx.change,
        reason: tx.reason,
      },
    });

    await prisma.product.update({
      where: { id: tx.productId },
      data: { stock: { increment: tx.change } },
    });
  }

  return NextResponse.json({ success: true });
}
