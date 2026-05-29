import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

/**
 * M-55: Deduct recipe ingredient quantities from inventory stock when an order is completed.
 *
 * For each menu item in the order, looks up the recipe (if one exists) and
 * deducts the ingredient quantities from the linked inventory items.
 * Creates InventoryMovement records for audit trail.
 *
 * Should be called inside a $transaction to ensure atomicity.
 */
export async function deductRecipeStockForOrder(
  tx: Prisma.TransactionClient,
  orderItems: { menuItemId: string | null; quantity: number; itemName?: string | null }[],
  propertyId: string,
  orderId: string,
  orderNumber: string,
  userId: string,
): Promise<{ deductions: number; skipped: string[] }> {
  const deductions = 0;
  const skipped: string[] = [];

  // Collect unique menuItemIds from the order
  const menuItemIds = orderItems
    .map((item) => item.menuItemId)
    .filter(Boolean) as string[];

  if (menuItemIds.length === 0) return { deductions, skipped };

  // Fetch recipes for these menu items (with ingredients that have inventoryItemId links)
  const recipes = await tx.recipe.findMany({
    where: {
      menuItemId: { in: menuItemIds },
      deletedAt: null,
      ingredients: {
        some: {
          inventoryItemId: { not: null },
        },
      },
    },
    include: {
      ingredients: {
        where: {
          inventoryItemId: { not: null },
        },
      },
    },
  });

  if (recipes.length === 0) return { deductions, skipped };

  // Build a map from menuItemId -> recipe
  const recipeMap = new Map(recipes.map((r) => [r.menuItemId, r]));

  // Build a map from order item quantity by menuItemId
  const quantityByMenuItem = new Map<string, number>();
  for (const item of orderItems) {
    if (!item.menuItemId) continue;
    const current = quantityByMenuItem.get(item.menuItemId) || 0;
    quantityByMenuItem.set(item.menuItemId, current + item.quantity);
  }

  // Collect all inventoryItemIds that need to be updated
  const allInventoryItemIds = recipes.flatMap((r) =>
    r.ingredients.map((ing) => ing.inventoryItemId).filter(Boolean) as string[],
  );

  // Fetch current stock for all involved inventory items
  const inventoryItems = await tx.inventoryItem.findMany({
    where: {
      id: { in: allInventoryItemIds },
      propertyId,
      deletedAt: null,
    },
  });

  const inventoryMap = new Map(inventoryItems.map((inv) => [inv.id, inv]));

  let totalDeductions = 0;

  for (const [menuItemId, recipe] of recipeMap) {
    const orderQuantity = quantityByMenuItem.get(menuItemId) || 1;

    for (const ingredient of recipe.ingredients) {
      if (!ingredient.inventoryItemId) continue;

      const invItem = inventoryMap.get(ingredient.inventoryItemId);
      if (!invItem) {
        skipped.push(`${ingredient.name} (inventory item not found)`);
        continue;
      }

      const deductQty = ingredient.quantity * orderQuantity;
      const previousStock = invItem.currentStock;
      const newStock = Math.max(0, Math.round((previousStock - deductQty) * 100) / 100);

      if (previousStock <= 0) {
        skipped.push(`${ingredient.name} (already at zero stock)`);
        continue;
      }

      // Update inventory stock
      await tx.inventoryItem.update({
        where: { id: invItem.id },
        data: {
          currentStock: newStock,
          status: newStock <= invItem.lowStockThreshold ? 'low_stock' : invItem.status,
        },
      });

      // Create inventory movement for audit
      await tx.inventoryMovement.create({
        data: {
          propertyId,
          inventoryItemId: invItem.id,
          quantity: -deductQty,
          previousStock,
          newStock,
          reason: 'order_consumption',
          note: `Consumed for order ${orderNumber} (${ingredient.name}, recipe for menu item qty: ${orderQuantity})`,
          performedBy: userId,
        },
      });

      totalDeductions++;
    }
  }

  if (totalDeductions > 0) {
    console.log(`[StockDeduction] Order ${orderNumber}: ${totalDeductions} ingredient stock deductions applied`);
  }

  return { deductions: totalDeductions, skipped };
}
