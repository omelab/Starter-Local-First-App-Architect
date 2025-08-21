import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const { categories } = await req.json();

  // Merge local categories into server DB
  for (const category of categories) {
    if (!category.id) {
      // If no id, create a new category
      await prisma.category.create({
        data: {
          title: category.title,
          completed: category.completed,
          updatedAt: new Date(category.updatedAt),
        },
      });
    } else {
      // Check if exists
      const existing = await prisma.Category.findUnique({
        where: { id: category.id },
      });

      if (existing) {
        // Conflict resolution: take the newer one
        if (category.updatedAt > existing.updatedAt.getTime()) {
          await prisma.Category.update({
            where: { id: category.id },
            data: {
              title: category.title,
              completed: category.completed,
              updatedAt: new Date(category.updatedAt),
            },
          });
        }
      } else {
        // Insert if not found
        await prisma.Category.create({
          data: {
            id: category.id,
            title: category.title,
            completed: category.completed,
            updatedAt: new Date(category.updatedAt),
          },
        });
      }
    }
  }

  // Send back all categories from server (single source of truth)
  const serverCategories = await prisma.category.findMany();

  return NextResponse.json({ serverCategories });
}
