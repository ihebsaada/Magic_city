// src/pages/admin/Discounts.tsx
import { useEffect, useMemo, useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Discount } from "@/types";
import {
  getAdminDiscounts,
  createAdminDiscount,
  updateAdminDiscount,
  deleteAdminDiscount,
} from "@/services/discountService";

type FormState = {
  code: string;
  type: "percentage" | "fixed";
  value: string; // keep as string for input
  usageLimit: string; // "" or "100"
  expiresAt: string; // "" or "2026-02-01"
  active: boolean;
};

const emptyForm = (): FormState => ({
  code: "",
  type: "percentage",
  value: "",
  usageLimit: "",
  expiresAt: "",
  active: true,
});

function formatUsage(d: Discount) {
  if (d.usageLimit == null) return `${d.usageCount}`;
  return `${d.usageCount} / ${d.usageLimit}`;
}

function formatExpires(expiresAt?: string | null) {
  if (!expiresAt) return "No expiry";
  try {
    return new Date(expiresAt).toLocaleDateString();
  } catch {
    return "—";
  }
}

function discountLabel(d: Discount) {
  return d.type === "percentage" ? `${d.value}% off` : `${d.value} off`;
}

export default function Discounts() {
  const [items, setItems] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // create / edit dialog
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      setError(null);
      const data = await getAdminDiscounts();
      setItems(data);
    } catch (e) {
      console.error(e);
      setError("Failed to load discounts. Check API / auth.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const sorted = useMemo(() => items, [items]);

  function openCreate() {
    setMode("create");
    setEditingId(null);
    setForm(emptyForm());
    setOpen(true);
  }

  function openEdit(d: Discount) {
    setMode("edit");
    setEditingId(d.id);
    setForm({
      code: d.code,
      type: d.type,
      value: String(d.value),
      usageLimit: d.usageLimit == null ? "" : String(d.usageLimit),
      expiresAt: d.expiresAt ? d.expiresAt.slice(0, 10) : "", // YYYY-MM-DD
      active: d.active,
    });
    setOpen(true);
  }

  async function onSave() {
    const valueNum = Number(form.value);
    if (!form.code.trim()) {
      alert("Code is required");
      return;
    }
    if (!Number.isFinite(valueNum) || valueNum <= 0) {
      alert("Value must be a positive number");
      return;
    }

    const payload = {
      code: form.code.trim().toUpperCase(),
      type: form.type,
      value: valueNum,
      usageLimit:
        form.usageLimit.trim() === "" ? null : Number(form.usageLimit),
      expiresAt:
        form.expiresAt.trim() === ""
          ? null
          : new Date(form.expiresAt).toISOString(),
      active: form.active,
    };

    if (
      payload.usageLimit != null &&
      (!Number.isFinite(payload.usageLimit) || payload.usageLimit < 0)
    ) {
      alert("Usage limit must be a valid number");
      return;
    }

    setSaving(true);
    try {
      if (mode === "create") {
        await createAdminDiscount(payload);
      } else if (editingId) {
        // for update, code isn't needed (optional). keep it stable.
        await updateAdminDiscount(editingId, {
          type: payload.type,
          value: payload.value,
          usageLimit: payload.usageLimit,
          expiresAt: payload.expiresAt,
          active: payload.active,
        });
      }
      setOpen(false);
      await refresh();
    } catch (e) {
      console.error(e);
      alert("Save failed (check backend logs / auth).");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string) {
    const ok = confirm("Delete this discount?");
    if (!ok) return;

    try {
      await deleteAdminDiscount(id);
      await refresh();
    } catch (e) {
      console.error(e);
      alert("Delete failed.");
    }
  }

  async function toggleActive(d: Discount, next: boolean) {
    try {
      await updateAdminDiscount(d.id, { active: next });
      setItems((prev) =>
        prev.map((x) => (x.id === d.id ? { ...x, active: next } : x)),
      );
    } catch (e) {
      console.error(e);
      alert("Update failed.");
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight">
            Discounts
          </h1>
          <p className="text-muted-foreground">
            Manage promotional codes and offers
          </p>
        </div>

        <Button onClick={openCreate}>+ Create Discount</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Discount Codes</CardTitle>
          <CardDescription>
            {loading
              ? "Loading discounts from backend..."
              : error
                ? error
                : "Live data from backend (Prisma)."}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Usage</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {!loading && sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    No discounts yet.
                  </TableCell>
                </TableRow>
              ) : (
                sorted.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.code}</TableCell>
                    <TableCell>{discountLabel(d)}</TableCell>
                    <TableCell>{formatUsage(d)}</TableCell>
                    <TableCell>{formatExpires(d.expiresAt)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Badge
                          className={
                            d.active
                              ? "bg-success/10 text-success border-0"
                              : "bg-muted text-muted-foreground border-0"
                          }
                        >
                          {d.active ? "Active" : "Inactive"}
                        </Badge>
                        <Switch
                          checked={d.active}
                          onCheckedChange={(v) => toggleActive(d, v)}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(d)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => onDelete(d.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog create/edit */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {mode === "create" ? "Create Discount" : "Edit Discount"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="text-sm text-muted-foreground mb-1">Code</div>
                <Input
                  value={form.code}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, code: e.target.value }))
                  }
                  placeholder="MAGIC10"
                  disabled={mode === "edit"} // keep stable
                />
              </div>

              <div>
                <div className="text-sm text-muted-foreground mb-1">Type</div>
                <Select
                  value={form.type}
                  onValueChange={(v) =>
                    setForm((s) => ({ ...s, type: v as any }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">percentage</SelectItem>
                    <SelectItem value="fixed">fixed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="text-sm text-muted-foreground mb-1">Value</div>
                <Input
                  value={form.value}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, value: e.target.value }))
                  }
                  placeholder={form.type === "percentage" ? "10" : "5"}
                />
              </div>

              <div>
                <div className="text-sm text-muted-foreground mb-1">
                  Usage limit
                </div>
                <Input
                  value={form.usageLimit}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, usageLimit: e.target.value }))
                  }
                  placeholder="(optional) 100"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="text-sm text-muted-foreground mb-1">
                  Expires at
                </div>
                <Input
                  type="date"
                  value={form.expiresAt}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, expiresAt: e.target.value }))
                  }
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <div className="font-medium">Active</div>
                  <div className="text-sm text-muted-foreground">
                    Enable/disable this code
                  </div>
                </div>
                <Switch
                  checked={form.active}
                  onCheckedChange={(v) => setForm((s) => ({ ...s, active: v }))}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={saving} onClick={onSave}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
