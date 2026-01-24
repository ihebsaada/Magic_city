import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ShoppingCart } from "lucide-react";
import type { Order } from "@/types";
import { getAdminOrders } from "@/services/orderService";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { AdminOrderDetail } from "@/types";
import { getAdminOrderById, updateAdminOrder } from "@/services/orderService";

const STATUS = [
  "pending",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
] as const;
const PAY = ["pending", "paid", "refunded"] as const;

const statusColors: Record<string, string> = {
  pending: "bg-warning/10 text-warning border-0",
  processing: "bg-accent/10 text-accent border-0",
  shipped: "bg-blue-100 text-blue-700 border-0",
  delivered: "bg-success/10 text-success border-0",
  cancelled: "bg-destructive/10 text-destructive border-0",
};

const paymentColors: Record<string, string> = {
  pending: "bg-warning/10 text-warning border-0",
  paid: "bg-success/10 text-success border-0",
  refunded: "bg-muted text-muted-foreground border-0",
};

function formatMoney(total: any, currency?: string) {
  // total can be "299.00" or 299 or "$299.00" (legacy mock)
  const num =
    typeof total === "number"
      ? total
      : typeof total === "string"
        ? Number(total.replace(/[^\d.-]/g, ""))
        : 0;

  const cur = (currency || "EUR").toUpperCase();
  const symbol = cur === "EUR" ? "€" : cur === "USD" ? "$" : `${cur} `;
  return `${symbol}${num.toFixed(2)}`;
}

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminOrderDetail | null>(null);
  const [saving, setSaving] = useState(false);

  async function openOrder(id: string) {
    setSelectedId(id);
    setOpen(true);
    setDetail(null);
    const d = await getAdminOrderById(id);
    setDetail(d);
  }

  useEffect(() => {
    (async () => {
      try {
        setError(null);
        const data = await getAdminOrders();
        setOrders(data);
      } catch (e) {
        console.error(e);
        setError("Failed to load orders. Check API URL / backend.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-display font-bold tracking-tight">
          Orders
        </h1>
        <p className="text-muted-foreground">Manage customer orders</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Recent Orders</CardTitle>
          </div>
          <CardDescription>
            {loading
              ? "Loading orders from backend..."
              : error
                ? error
                : "Live data from backend (Prisma)."}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead className="hidden sm:table-cell">Customer</TableHead>
                <TableHead>Total</TableHead>
                <TableHead className="hidden md:table-cell">Status</TableHead>
                <TableHead className="hidden lg:table-cell">Payment</TableHead>
                <TableHead className="hidden sm:table-cell">Date</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {!loading && orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    No orders yet.
                  </TableCell>
                </TableRow>
              ) : (
                orders.map((order) => {
                  const status = (order.status || "").toLowerCase();
                  const pay = (order.paymentStatus || "").toLowerCase();

                  return (
                    <TableRow
                      key={order.id}
                      className="cursor-pointer"
                      onClick={() => openOrder(order.id)}
                    >
                      <TableCell className="font-medium">
                        {order.orderNumber}
                      </TableCell>

                      <TableCell className="hidden sm:table-cell">
                        <div>
                          <p className="font-medium">{order.customer.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {order.customer.email}
                          </p>
                        </div>
                      </TableCell>

                      <TableCell className="font-medium">
                        {formatMoney(
                          (order as any).total,
                          (order as any).currency,
                        )}
                      </TableCell>

                      <TableCell className="hidden md:table-cell">
                        <Badge
                          className={
                            statusColors[status] ??
                            "bg-muted text-muted-foreground border-0"
                          }
                        >
                          {status
                            ? status.charAt(0).toUpperCase() + status.slice(1)
                            : "Unknown"}
                        </Badge>
                      </TableCell>

                      <TableCell className="hidden lg:table-cell">
                        <Badge
                          className={
                            paymentColors[pay] ??
                            "bg-muted text-muted-foreground border-0"
                          }
                        >
                          {pay
                            ? pay.charAt(0).toUpperCase() + pay.slice(1)
                            : "Unknown"}
                        </Badge>
                      </TableCell>

                      <TableCell className="hidden sm:table-cell text-muted-foreground">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {detail ? `Order ${detail.orderNumber}` : "Loading order..."}
            </SheetTitle>
          </SheetHeader>

          {!detail ? (
            <div className="py-6 text-muted-foreground">Loading…</div>
          ) : (
            <div className="space-y-6 py-4">
              {/* Customer */}
              <div className="rounded-lg border p-4 space-y-1">
                <div className="font-semibold">Customer</div>
                <div>{detail.customer.name}</div>
                <div className="text-sm text-muted-foreground">
                  {detail.customer.email}
                </div>
              </div>

              {/* Shipping */}
              <div className="rounded-lg border p-4 space-y-1">
                <div className="font-semibold">Shipping</div>
                <div className="text-sm text-muted-foreground">
                  {detail.shipping.name || "-"} • {detail.shipping.phone || "-"}
                </div>
                <div className="text-sm">
                  {detail.shipping.address1 || "-"}{" "}
                  {detail.shipping.address2 || ""}
                  <br />
                  {detail.shipping.city || "-"} {detail.shipping.zip || ""}{" "}
                  {detail.shipping.state || ""}
                  <br />
                  {detail.shipping.country || "-"}
                </div>
              </div>

              {/* Items */}
              <div className="rounded-lg border p-4 space-y-3">
                <div className="font-semibold">Items</div>
                <div className="space-y-3">
                  {detail.items.map((it) => (
                    <div
                      key={it.id}
                      className="flex gap-3 border-b pb-3 last:border-b-0 last:pb-0"
                    >
                      {it.mainImage ? (
                        <img
                          src={it.mainImage}
                          alt={it.productTitle}
                          className="h-14 w-14 rounded-md object-cover"
                        />
                      ) : (
                        <div className="h-14 w-14 rounded-md bg-muted" />
                      )}

                      <div className="flex-1">
                        <div className="font-medium">{it.productTitle}</div>
                        <div className="text-sm text-muted-foreground">
                          Qty {it.quantity} •{" "}
                          {it.selectedSize ? `Size: ${it.selectedSize}` : ""}{" "}
                          {it.selectedColor
                            ? `• Color: ${it.selectedColor}`
                            : ""}
                          {it.variantSku ? ` • SKU: ${it.variantSku}` : ""}
                        </div>
                      </div>

                      <div className="text-right font-medium">
                        {formatMoney(
                          Number(it.unitPrice) * it.quantity,
                          detail.currency,
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals */}
              <div className="rounded-lg border p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>
                    {formatMoney(
                      detail.originalTotal ?? detail.total,
                      detail.currency,
                    )}
                  </span>
                </div>

                {detail.discountCode ? (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Discount ({detail.discountCode})
                    </span>
                    <span>
                      -
                      {formatMoney(detail.discountAmount ?? 0, detail.currency)}
                    </span>
                  </div>
                ) : null}

                <div className="flex justify-between font-semibold">
                  <span>Total</span>
                  <span>{formatMoney(detail.total, detail.currency)}</span>
                </div>
              </div>

              {/* Update controls */}
              <div className="rounded-lg border p-4 space-y-3">
                <div className="font-semibold">Update</div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">
                      Status
                    </div>
                    <Select
                      value={detail.status}
                      onValueChange={(v) =>
                        setDetail({ ...detail, status: v as any })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <div className="text-sm text-muted-foreground mb-1">
                      Payment
                    </div>
                    <Select
                      value={detail.paymentStatus}
                      onValueChange={(v) =>
                        setDetail({ ...detail, paymentStatus: v as any })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAY.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button
                  disabled={saving}
                  onClick={async () => {
                    if (!selectedId || !detail) return;
                    setSaving(true);

                    console.log("PATCH order", selectedId, {
                      status: detail.status.toUpperCase(),
                      paymentStatus: detail.paymentStatus.toUpperCase(),
                    });

                    try {
                      const r = await updateAdminOrder(selectedId, {
                        status: detail.status.toUpperCase(),
                        paymentStatus: detail.paymentStatus.toUpperCase(),
                      });

                      console.log("PATCH success", r);

                      const data = await getAdminOrders();
                      setOrders(data);
                    } catch (e) {
                      console.error("PATCH failed", e);
                      alert("Update failed. Check console/network.");
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  Save changes
                </Button>
              </div>

              {/* Payment refs */}
              <div className="rounded-lg border p-4 space-y-1 text-sm">
                <div className="font-semibold">Refs</div>
                <div className="text-muted-foreground">
                  Stripe session: {detail.stripeSessionId || "-"}
                </div>
                <div className="text-muted-foreground">
                  SumUp checkout: {detail.sumupCheckoutId || "-"}
                </div>
                <div className="text-muted-foreground">
                  SumUp payment: {detail.sumupPaymentId || "-"}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
