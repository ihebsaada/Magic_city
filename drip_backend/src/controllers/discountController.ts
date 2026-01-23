import { Request, Response } from "express";
import prisma from "../prisma";
import { Prisma } from "@prisma/client";

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

  await prisma.discount.update({
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

  res.json({ ok: true });
}

export async function adminDeleteDiscount(req: Request, res: Response) {
  const { id } = req.params;
  await prisma.discount.delete({ where: { id } });
  res.json({ ok: true });
}

export async function previewDiscount(req: Request, res: Response) {
  try {
    const { subtotal, discountCode } = req.body as {
      subtotal: number;
      discountCode?: string;
    };

    const sub = Number(subtotal);
    if (!Number.isFinite(sub) || sub < 0) {
      return res.status(400).json({ error: "Invalid subtotal" });
    }

    const raw = (discountCode ?? "").trim();
    if (!raw) {
      return res.json({
        valid: false,
        appliedCode: null,
        discountAmount: 0,
        total: sub,
        reason: "EMPTY",
      });
    }

    const code = raw.toUpperCase();
    const d = await prisma.discount.findUnique({ where: { code } });

    if (!d) {
      return res.json({
        valid: false,
        appliedCode: null,
        discountAmount: 0,
        total: sub,
        reason: "NOT_FOUND",
      });
    }

    if (!d.active) {
      return res.json({
        valid: false,
        appliedCode: null,
        discountAmount: 0,
        total: sub,
        reason: "INACTIVE",
      });
    }

    if (d.expiresAt && d.expiresAt.getTime() < Date.now()) {
      return res.json({
        valid: false,
        appliedCode: null,
        discountAmount: 0,
        total: sub,
        reason: "EXPIRED",
      });
    }

    if (d.usageLimit != null && d.usageCount >= d.usageLimit) {
      return res.json({
        valid: false,
        appliedCode: null,
        discountAmount: 0,
        total: sub,
        reason: "LIMIT_REACHED",
      });
    }

    const value = Number(d.value);
    const discountAmount =
      d.type === "PERCENTAGE" ? (sub * value) / 100 : value;

    const total = Math.max(sub - discountAmount, 0);

    return res.json({
      valid: true,
      appliedCode: code,
      discountAmount,
      total,
      reason: null,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erreur serveur (previewDiscount)" });
  }
}
