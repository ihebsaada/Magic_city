import { Request, Response } from "express";
import prisma from "../prisma";
import { Prisma } from "@prisma/client";
import { normalizeCode, validateSubtotal, priceDiscount, OrderInputError } from "../services/orderPricing";

import {ReservationError} from "../services/reservations";

const normCode = (s: string) => s.trim().toUpperCase();

export async function adminGetDiscounts(req: Request, res: Response) {
  const discounts = await prisma.discount.findMany({
    orderBy: { createdAt: "desc" },
  });
  res.json(
    discounts.map((d) => ({
      id: d.id,
      code: d.code,
      type: d.type === "PERCENTAGE" ? "percentage" : "fixed",
      value: Number(d.value),
      usageCount: d.usageCount,
      reservedUses:d.reservedUses,
      usageLimit: d.usageLimit ?? null,
      expiresAt: d.expiresAt ? d.expiresAt.toISOString() : null,
      active: d.active,
    })),
  );
}

export async function adminCreateDiscount(req: Request, res: Response) {
  const { code, type, value, usageLimit, expiresAt, active } = req.body as any;
  if (!code || !type || value == null)
    return res.status(400).json({ error: "Missing fields" });

  if(usageLimit!=null && (!Number.isInteger(usageLimit)||usageLimit<0))
    return res.status(400).json({error:"INVALID_USAGE_LIMIT"});
  const created = await prisma.discount.create({
    data: {
      code: normCode(code),
      type: type === "percentage" ? "PERCENTAGE" : "FIXED",
      value: new Prisma.Decimal(value),
      usageLimit: usageLimit ?? null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      active: active ?? true,
    },
  });

  return res.status(201).json({ id: created.id });
}

export async function adminUpdateDiscount(req: Request, res: Response) {
  const { id } = req.params;
  const { type, value, usageLimit, expiresAt, active } = req.body as any;

  try {await prisma.$transaction(async tx=>{
    await tx.$queryRawUnsafe('SELECT "id" FROM "Discount" WHERE "id"=$1 FOR UPDATE',id);
    const d=await tx.discount.findUniqueOrThrow({where:{id}});
    if(usageLimit!==undefined && usageLimit!==null && (!Number.isInteger(usageLimit)||usageLimit<0))
      throw new ReservationError(400,"INVALID_USAGE_LIMIT");
    if(usageLimit!=null && usageLimit<d.usageCount+d.reservedUses)
      throw new ReservationError(409,"DISCOUNT_LIMIT_BELOW_RESERVATIONS");
    await tx.discount.update({
    where: { id },
    data: {
      ...(type ? { type: type === "percentage" ? "PERCENTAGE" : "FIXED" } : {}),
      ...(value != null ? { value: new Prisma.Decimal(value) } : {}),
      ...(usageLimit !== undefined ? { usageLimit: usageLimit ?? null } : {}),
      ...(expiresAt !== undefined
        ? { expiresAt: expiresAt ? new Date(expiresAt) : null }
        : {}),
      ...(active !== undefined ? { active: !!active } : {}),
    },
  });

  });
  res.json({ ok: true });
  }catch(error){if(error instanceof ReservationError)return res.status(error.status).json({error:error.code});throw error;}
}

export async function adminDeleteDiscount(req: Request, res: Response) {
  const { id } = req.params;
  try {await prisma.$transaction(async tx=>{
    await tx.$queryRawUnsafe('SELECT "id" FROM "Discount" WHERE "id"=$1 FOR UPDATE',id);
    if(await tx.orderReservation.count({where:{discountId:id}}))
      throw new ReservationError(409,"DISCOUNT_HAS_RESERVATION_HISTORY");
    await tx.discount.delete({where:{id}});
  });res.json({ok:true});}
  catch(error){if(error instanceof ReservationError)return res.status(error.status).json({error:error.code});throw error;}
}

export async function previewDiscount(req: Request, res: Response) {
  res.setHeader("Cache-Control","no-store");
  try {
    const subtotal = validateSubtotal(req.body?.subtotal);
    const code = normalizeCode(req.body?.discountCode);
    const result = await priceDiscount(subtotal, code);
    return res.json({ valid: result.valid, appliedCode: result.appliedCode, discountAmount: result.discountAmount.toNumber(),
      total: result.total.toNumber(), reason: result.reason });
  } catch (err) {
    if (err instanceof OrderInputError) return res.status(400).json({ error: err.message });
    console.error("API operation failed");
    return res.status(500).json({ error: "Erreur serveur (previewDiscount)" });
  }
}
