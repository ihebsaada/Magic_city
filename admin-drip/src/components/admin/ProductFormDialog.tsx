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
import { X, Plus, Image as ImageIcon } from "lucide-react";

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

function normalizeImages(raw: any): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((i) => (typeof i === "string" ? i : i?.src)).filter(Boolean);
}

export default function ProductFormDialog(props: Props) {
  const { open, onOpenChange, mode, product, collections, onCreate, onUpdate } =
    props;

  const initial = useMemo(() => {
    if (mode === "edit" && product) {
      return {
        title: product.title ?? "",
        handle: product.handle ?? "",
        vendor: (product as any).vendor ?? "",
        productType: (product as any).productType ?? "",
        status: (product as any).status ?? "active",
        descriptionHtml: (product as any).descriptionHtml ?? "",
        tags: Array.isArray((product as any).tags) ? (product as any).tags : [],
        images: normalizeImages((product as any).images),
        collectionIds: Array.isArray((product as any).collections)
          ? (product as any).collections.map((c: any) => c.id)
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
      tags: [] as string[],
      images: [] as string[],
      collectionIds: [] as number[],
    };
  }, [mode, product]);

  // Persisted fields
  const [title, setTitle] = useState(initial.title);
  const [handle, setHandle] = useState(initial.handle);
  const [vendor, setVendor] = useState(initial.vendor);
  const [productType, setProductType] = useState(initial.productType);
  const [status, setStatus] = useState(initial.status);
  const [descriptionHtml, setDescriptionHtml] = useState(
    initial.descriptionHtml,
  );
  const [tags, setTags] = useState<string[]>(initial.tags);
  const [collectionIds, setCollectionIds] = useState<number[]>(
    initial.collectionIds,
  );
  const [images, setImages] = useState<string[]>(initial.images);

  // UI-only fields (future variants/seo)
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDesc, setSeoDesc] = useState("");
  const [price, setPrice] = useState<string>("");
  const [compareAtPrice, setCompareAtPrice] = useState<string>("");
  const [sku, setSku] = useState<string>("");
  const [stock, setStock] = useState<string>("");
  const [option1Name, setOption1Name] = useState<string>("Size");
  const [option2Name, setOption2Name] = useState<string>("Color");

  // Helpers inputs
  const [tagInput, setTagInput] = useState("");
  const [imageInput, setImageInput] = useState("");

  const [saving, setSaving] = useState(false);
  const [autoHandle, setAutoHandle] = useState(true);

  useEffect(() => {
    if (!open) return;

    setTitle(initial.title);
    setHandle(initial.handle);
    setVendor(initial.vendor);
    setProductType(initial.productType);
    setStatus(initial.status);
    setDescriptionHtml(initial.descriptionHtml);
    setTags(initial.tags);
    setImages(initial.images);
    setCollectionIds(initial.collectionIds);

    setTagInput("");
    setImageInput("");
    setSaving(false);

    // UI-only reset
    setSeoTitle("");
    setSeoDesc("");
    setPrice("");
    setCompareAtPrice("");
    setSku("");
    setStock("");
    setOption1Name("Size");
    setOption2Name("Color");

    setAutoHandle(!initial.handle); // si edit et handle existe -> ne pas auto
  }, [open, initial]);

  // Auto handle from title if user didn't manually edit
  useEffect(() => {
    if (!open) return;
    if (!autoHandle) return;
    if (!title.trim()) return;
    setHandle(slugifyHandle(title));
  }, [title, autoHandle, open]);

  const toggleCollection = (id: number) => {
    setCollectionIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (!t) return;
    if (tags.includes(t)) {
      setTagInput("");
      return;
    }
    setTags((prev) => [...prev, t]);
    setTagInput("");
  };

  const removeTag = (t: string) => {
    setTags((prev) => prev.filter((x) => x !== t));
  };

  const addImage = () => {
    const url = imageInput.trim();
    if (!url) return;
    // petit check rapide
    if (!/^https?:\/\//i.test(url)) {
      toast({
        title: "Invalid URL",
        description: "Image must start with http:// or https://",
      });
      return;
    }
    setImages((prev) => [...prev, url]);
    setImageInput("");
  };

  const removeImage = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const moveImage = (from: number, to: number) => {
    setImages((prev) => {
      const copy = [...prev];
      const [it] = copy.splice(from, 1);
      copy.splice(to, 0, it);
      return copy;
    });
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
      <DialogContent className="w-[min(1000px,calc(100vw-2rem))] max-w-4xl max-h-[85vh] overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>
            {mode === "create" ? "Add Product" : "Edit Product"}
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[calc(85vh-84px)] overflow-y-auto px-6 pb-6">
          <div className="grid gap-6">
            {/* BASIC */}
            <section className="rounded-xl border p-4">
              <div className="mb-3 font-medium">Basic</div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Title *</Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label>Handle *</Label>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground select-none">
                      <input
                        type="checkbox"
                        checked={autoHandle}
                        onChange={(e) => setAutoHandle(e.target.checked)}
                      />
                      Auto from title
                    </label>
                  </div>

                  <Input
                    value={handle}
                    onChange={(e) => {
                      setHandle(e.target.value);
                      setAutoHandle(false);
                    }}
                    placeholder="my-product-handle"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 mt-4">
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

              {/* productType only really useful on edit too */}
              <div className="space-y-2 mt-4">
                <Label>Product type</Label>
                <Input
                  value={productType}
                  onChange={(e) => setProductType(e.target.value)}
                  placeholder="Shoes / Sneakers / ..."
                />
              </div>

              <div className="space-y-2 mt-4">
                <Label>Description (HTML or text)</Label>
                <Textarea
                  value={descriptionHtml}
                  onChange={(e) => setDescriptionHtml(e.target.value)}
                  rows={5}
                />
              </div>
            </section>

            {/* ORGANIZATION */}
            <section className="rounded-xl border p-4">
              <div className="mb-3 font-medium">Organization</div>

              <div className="space-y-2">
                <Label>Tags</Label>
                <div className="flex gap-2">
                  <Input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    placeholder="Add a tag and press +"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={addTag}
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" /> Add
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  {tags.length ? (
                    tags.map((t) => (
                      <Badge key={t} variant="secondary" className="gap-1">
                        {t}
                        <button
                          type="button"
                          className="ml-1 opacity-70 hover:opacity-100"
                          onClick={() => removeTag(t)}
                          aria-label={`remove ${t}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      No tags
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-2 mt-4">
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
                          className={`text-sm rounded-full border px-3 py-1 transition ${
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
            </section>

            {/* MEDIA */}
            <section className="rounded-xl border p-4">
              <div className="mb-3 font-medium">Media</div>

              <div className="space-y-2">
                <Label>Add image URL</Label>
                <div className="flex gap-2">
                  <Input
                    value={imageInput}
                    onChange={(e) => setImageInput(e.target.value)}
                    placeholder="https://...jpg"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addImage();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={addImage}
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" /> Add
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground">
                  On update: images are replaced (deleteMany + createMany côté
                  backend).
                </p>

                {images.length ? (
                  <div className="grid gap-3 pt-3 sm:grid-cols-2">
                    {images.map((src, idx) => (
                      <div
                        key={`${src}-${idx}`}
                        className="rounded-lg border p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-xs text-muted-foreground">
                              #{idx + 1}
                            </div>
                            <div className="text-xs break-all">{src}</div>
                          </div>

                          <div className="flex gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={idx === 0}
                              onClick={() => moveImage(idx, idx - 1)}
                            >
                              ↑
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={idx === images.length - 1}
                              onClick={() => moveImage(idx, idx + 1)}
                            >
                              ↓
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => removeImage(idx)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-center rounded-md bg-muted p-3">
                          {/* preview simple */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={src}
                            alt=""
                            className="max-h-40 w-auto object-contain"
                            onError={(e) => {
                              (
                                e.currentTarget as HTMLImageElement
                              ).style.display = "none";
                            }}
                          />
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <ImageIcon className="h-4 w-4" />
                            Preview
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="pt-2 text-xs text-muted-foreground">
                    No images
                  </div>
                )}
              </div>
            </section>

            {/* PRICING / INVENTORY (UI only for now) */}
            <section className="rounded-xl border p-4">
              <div className="mb-3 font-medium">
                Pricing & Inventory (future variants)
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Price</Label>
                  <Input
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="e.g. 299.000"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Compare at price</Label>
                  <Input
                    value={compareAtPrice}
                    onChange={(e) => setCompareAtPrice(e.target.value)}
                    placeholder="e.g. 349.000"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 mt-4">
                <div className="space-y-2">
                  <Label>SKU</Label>
                  <Input
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder="SKU-123"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Stock</Label>
                  <Input
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    placeholder="e.g. 20"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 mt-4">
                <div className="space-y-2">
                  <Label>Option 1 name</Label>
                  <Input
                    value={option1Name}
                    onChange={(e) => setOption1Name(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Option 2 name</Label>
                  <Input
                    value={option2Name}
                    onChange={(e) => setOption2Name(e.target.value)}
                  />
                </div>
              </div>

              <p className="text-xs text-muted-foreground mt-3">
                Ces champs sont UI-only tant que tu n’as pas ajouté `variants` +
                `option1Name/option2Name` en DB et dans `adminCreateProduct`.
              </p>
            </section>

            {/* SEO (UI only for now) */}
            <section className="rounded-xl border p-4">
              <div className="mb-3 font-medium">SEO (optional)</div>

              <div className="space-y-2">
                <Label>SEO title</Label>
                <Input
                  value={seoTitle}
                  onChange={(e) => setSeoTitle(e.target.value)}
                  placeholder="Title for search engines"
                />
              </div>

              <div className="space-y-2 mt-4">
                <Label>SEO description</Label>
                <Textarea
                  value={seoDesc}
                  onChange={(e) => setSeoDesc(e.target.value)}
                  rows={3}
                  placeholder="Short description..."
                />
              </div>

              <p className="text-xs text-muted-foreground mt-3">
                À sauvegarder plus tard quand tu ajoutes
                `seoTitle/seoDescription` dans Prisma.
              </p>
            </section>

            {/* ACTIONS */}
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
