import { useEffect, useMemo, useState } from "react";
import type { Collection, Product } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

type Mode = "create" | "edit";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;

  mode: Mode;
  product?: Product | null;

  collections: Collection[];

  onCreate: (payload: {
    title: string;
    handle: string;
    vendor?: string | null;
    descriptionHtml?: string | null;
    status?: string | null;
    tags?: string[];
    images?: string[];
    collectionIds?: number[];
  }) => Promise<void>;

  onUpdate: (
    id: number,
    payload: {
      title?: string;
      handle?: string;
      vendor?: string | null;
      descriptionHtml?: string | null;
      productType?: string | null;
      status?: string | null;
      tags?: string[];
      images?: string[];
      collectionIds?: number[];
    },
  ) => Promise<void>;
};

function slugifyHandle(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function ProductFormDialog(props: Props) {
  const { open, onOpenChange, mode, product, collections, onCreate, onUpdate } =
    props;

  const initial = useMemo(() => {
    if (mode === "edit" && product) {
      return {
        title: product.title ?? "",
        handle: product.handle ?? "",
        vendor: product.vendor ?? "",
        productType: product.productType ?? "",
        status: product.status ?? "active",
        descriptionHtml: product.descriptionHtml ?? "",
        tagsText: Array.isArray(product.tags) ? product.tags.join(", ") : "",
        imagesText: Array.isArray(product.images)
          ? product.images.map((i: any) => i?.src ?? i).join("\n")
          : "",
        collectionIds: Array.isArray(product.collections)
          ? product.collections.map((c: any) => c.id)
          : [],
      };
    }
    return {
      title: "",
      handle: "",
      vendor: "",
      productType: "",
      status: "active",
      descriptionHtml: "",
      tagsText: "",
      imagesText: "",
      collectionIds: [] as number[],
    };
  }, [mode, product]);

  const [title, setTitle] = useState(initial.title);
  const [handle, setHandle] = useState(initial.handle);
  const [vendor, setVendor] = useState(initial.vendor);
  const [productType, setProductType] = useState(initial.productType);
  const [status, setStatus] = useState(initial.status);
  const [descriptionHtml, setDescriptionHtml] = useState(
    initial.descriptionHtml,
  );
  const [tagsText, setTagsText] = useState(initial.tagsText);
  const [imagesText, setImagesText] = useState(initial.imagesText);
  const [collectionIds, setCollectionIds] = useState<number[]>(
    initial.collectionIds,
  );

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(initial.title);
    setHandle(initial.handle);
    setVendor(initial.vendor);
    setProductType(initial.productType);
    setStatus(initial.status);
    setDescriptionHtml(initial.descriptionHtml);
    setTagsText(initial.tagsText);
    setImagesText(initial.imagesText);
    setCollectionIds(initial.collectionIds);
  }, [open, initial]);

  const tags = tagsText
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const images = imagesText
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const toggleCollection = (id: number) => {
    setCollectionIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  async function submit() {
    if (!title.trim()) {
      toast({
        title: "Title required",
        description: "Please enter product title.",
      });
      return;
    }

    const finalHandle = handle.trim() || slugifyHandle(title);
    if (!finalHandle) {
      toast({
        title: "Handle required",
        description: "Please enter product handle.",
      });
      return;
    }

    setSaving(true);
    try {
      if (mode === "create") {
        await onCreate({
          title: title.trim(),
          handle: finalHandle,
          vendor: vendor.trim() || null,
          descriptionHtml: descriptionHtml.trim() || null,
          status,
          tags,
          images,
          collectionIds,
        });
        toast({
          title: "Created",
          description: "Product created successfully.",
        });
      } else {
        if (!product?.id) throw new Error("Missing product id");
        await onUpdate(product.id, {
          title: title.trim(),
          handle: finalHandle,
          vendor: vendor.trim() || null,
          productType: productType.trim() || null,
          descriptionHtml: descriptionHtml.trim() || null,
          status,
          tags,
          images,
          collectionIds,
        });
        toast({
          title: "Updated",
          description: "Product updated successfully.",
        });
      }
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Operation failed" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(900px,calc(100vw-2rem))] max-w-2xl max-h-[85vh] overflow-hidden p-0">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Add Product" : "Edit Product"}
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-[calc(85vh-80px)] overflow-y-auto px-6 pb-6">
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Handle</Label>
                <Input
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  placeholder="auto from title if empty"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Vendor</Label>
                <Input
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">active</SelectItem>
                    <SelectItem value="draft">draft</SelectItem>
                    <SelectItem value="archived">archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description (HTML or text)</Label>
              <Textarea
                value={descriptionHtml}
                onChange={(e) => setDescriptionHtml(e.target.value)}
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label>Tags (comma separated)</Label>
              <Input
                value={tagsText}
                onChange={(e) => setTagsText(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                {tags.length ? (
                  tags.map((t) => (
                    <Badge key={t} variant="secondary">
                      {t}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">No tags</span>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Images (one URL per line)</Label>
              <Textarea
                value={imagesText}
                onChange={(e) => setImagesText(e.target.value)}
                rows={4}
                placeholder="https://...jpg"
              />
              <p className="text-xs text-muted-foreground">
                On update: images are replaced (deleteMany + createMany côté
                backend).
              </p>
            </div>

            <div className="space-y-2">
              <Label>Collections</Label>
              <div className="flex flex-wrap gap-2">
                {collections.length ? (
                  collections.map((c) => {
                    const active = collectionIds.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleCollection(c.id)}
                        className={`text-sm rounded-full border px-3 py-1 ${
                          active
                            ? "bg-foreground text-background"
                            : "bg-background"
                        }`}
                      >
                        {c.title}
                      </button>
                    );
                  })
                ) : (
                  <span className="text-xs text-muted-foreground">
                    No collections
                  </span>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={submit} disabled={saving} className="gap-2">
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
