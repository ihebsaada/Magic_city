import { validImageUrl, validMoney } from "@/lib/adminValues";
import type {
  DefaultVariantUpdatePayload,
  ProductUpdatePayload,
} from "@/services/productService";
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

  // ✅ CREATE needs pricing/inventory + option names
  onCreate: (payload: {
    title: string;
    handle: string;
    vendor?: string | null;
    descriptionHtml?: string | null;
    status?: string | null;
    tags?: string[];
    images?: string[];
    collectionIds?: number[];

    price: number;
    compareAtPrice?: number | null;
    inventoryQuantity?: number | null;
    sku?: string | null;

    productType?: string | null;
    option1Name?: string | null;
    option2Name?: string | null;
    option3Name?: string | null;
  }) => Promise<void>;

  // ✅ updates Product fields (not variant)
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

      variantUpdate?: DefaultVariantUpdatePayload;
      option1Name?: string | null;
      option2Name?: string | null;
      option3Name?: string | null;
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

function normalizeImages(raw: Product["images"] | string[]): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((i) => (typeof i === "string" ? i : i.src)).filter(Boolean);
}

function parseNumberOrNull(v: string): number | null {
  const s = v.trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export default function ProductFormDialog(props: Props) {
  const { open, onOpenChange, mode, product, collections, onCreate, onUpdate } =
    props;

  const initial = useMemo(() => {
    const p = product;

    if (mode === "edit" && p) {
      const v0 = Array.isArray(p.variants) ? p.variants[0] : null;

      return {
        title: p.title ?? "",
        handle: p.handle ?? "",
        vendor: p.vendor ?? "",
        productType: p.productType ?? "",
        status: p.status ?? "",
        descriptionHtml: p.descriptionHtml ?? "",
        tags: Array.isArray(p.tags) ? p.tags : [],
        images: normalizeImages(p.images),
        collectionIds: Array.isArray(p.collections)
          ? p.collections.map((c) => c.id)
          : [],

        // ✅ pricing/inventory from default variant
        price: v0?.price != null ? String(v0.price) : "",
        compareAtPrice:
          v0?.compareAtPrice != null ? String(v0.compareAtPrice) : "",
        sku: v0?.sku ?? "",
        stock:
          v0?.inventoryQuantity != null ? String(v0.inventoryQuantity) : "",

        // ✅ option names stored on Product
        option1Name: p.option1Name ?? "",
        option2Name: p.option2Name ?? "",
        option3Name: p.option3Name ?? "",
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

      price: "",
      compareAtPrice: "",
      sku: "",
      stock: "",

      option1Name: "Size",
      option2Name: "Color",
      option3Name: "",
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

  // pricing / inventory (now REAL)
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const selectedVariant = product?.variants?.find(
    (v) => String(v.id) === selectedVariantId,
  );
  const [price, setPrice] = useState<string>(initial.price);
  const [compareAtPrice, setCompareAtPrice] = useState<string>(
    initial.compareAtPrice,
  );
  const [sku, setSku] = useState<string>(initial.sku);
  const [stock, setStock] = useState<string>(initial.stock);

  // option names (saved on Product)
  const [option1Name, setOption1Name] = useState<string>(initial.option1Name);
  const [option2Name, setOption2Name] = useState<string>(initial.option2Name);
  const [option3Name, setOption3Name] = useState<string>(initial.option3Name);

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

    // ✅ reset pricing/options from initial
    setPrice(initial.price);
    setCompareAtPrice(initial.compareAtPrice);
    setSku(initial.sku);
    setStock(initial.stock);
    setOption1Name(initial.option1Name);
    setOption2Name(initial.option2Name);
    setOption3Name(initial.option3Name);

    setTagInput("");
    setImageInput("");
    setSaving(false);

    setSelectedVariantId(
      mode === "edit" && product?.variants?.length === 1
        ? String(product.variants[0].id)
        : "",
    );
    if (mode === "edit" && product?.variants?.length !== 1) {
      setPrice("");
      setStock("");
      setSku("");
      setCompareAtPrice("");
    }

    setAutoHandle(!initial.handle);
  }, [open, initial, mode, product]);

  function selectVariant(value: string) {
    setSelectedVariantId(value);
    const v = product?.variants.find((v) => String(v.id) === value);
    setPrice(v?.price == null ? "" : String(v.price));
    setCompareAtPrice(
      v?.compareAtPrice == null ? "" : String(v.compareAtPrice),
    );
    setSku(v?.sku ?? "");
    setStock(v?.inventoryQuantity == null ? "" : String(v.inventoryQuantity));
  }

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
    if (!validImageUrl(url)) {
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

    // ✅ validate price for create
    if (mode === "create") {
      const p = parseNumberOrNull(price);
      if (p == null || !validMoney(p)) {
        toast({
          title: "Price required",
          description: "Please enter a valid price (> 0).",
        });
        return;
      }
    }

    // ✅ validate numeric fields if present
    const stockN = parseNumberOrNull(stock);
    if (
      (mode === "create" || selectedVariant) &&
      stock.trim() &&
      (stockN == null ||
        !Number.isInteger(stockN) ||
        stockN < 0 ||
        stockN > 2147483647)
    ) {
      toast({
        title: "Invalid stock",
        description: "Stock must be a non-negative whole number.",
      });
      return;
    }

    const compareN = parseNumberOrNull(compareAtPrice);
    if (
      (mode === "create" || selectedVariant) &&
      compareAtPrice.trim() &&
      (compareN == null || !validMoney(compareN, true))
    ) {
      toast({
        title: "Invalid compare price",
        description: "Compare-at price must be a number.",
      });
      return;
    }

    if (
      mode === "edit" &&
      selectedVariant &&
      price.trim() &&
      !validMoney(Number(price))
    ) {
      toast({
        title: "Invalid price",
        description:
          "Enter a positive EUR amount with at most two decimal places.",
      });
      return;
    }
    if (
      images.some((url) => !validImageUrl(url)) &&
      JSON.stringify(images) !== JSON.stringify(initial.images)
    ) {
      toast({
        title: "Invalid image URL",
        description: "Use HTTP or HTTPS image URLs without credentials.",
      });
      return;
    }
    if (
      mode === "edit" &&
      initial.images.length > 0 &&
      images.length === 0 &&
      !confirm("Remove all product images?")
    )
      return;
    setSaving(true);
    try {
      if (mode === "create") {
        await onCreate({
          title: title.trim(),
          handle: finalHandle,
          vendor: vendor.trim() || null,
          descriptionHtml: descriptionHtml.trim() || null,
          productType: productType.trim() || null,
          status,
          tags,
          images,
          collectionIds,

          price: Number(price),
          compareAtPrice: compareN,
          inventoryQuantity: stockN ?? 0,
          sku: sku.trim() || null,

          option1Name: option1Name.trim() || null,
          option2Name: option2Name.trim() || null,
          option3Name: option3Name.trim() || null,
        });

        toast({
          title: "Created",
          description: "Product created successfully.",
        });
      } else {
        if (!product?.id) throw new Error("Missing product id");

        const values = {
          title: title.trim(),
          handle: finalHandle,
          vendor: vendor.trim() || null,
          productType: productType.trim() || null,
          descriptionHtml: descriptionHtml.trim() || null,
          status: status || null,
          tags,
          images,
          option1Name: option1Name.trim() || null,
          option2Name: option2Name.trim() || null,
          option3Name: option3Name.trim() || null,
        };
        const original = {
          title: initial.title,
          handle: initial.handle,
          vendor: initial.vendor || null,
          productType: initial.productType || null,
          descriptionHtml: initial.descriptionHtml || null,
          status: initial.status || null,
          tags: initial.tags,
          images: initial.images,
          option1Name: initial.option1Name || null,
          option2Name: initial.option2Name || null,
          option3Name: initial.option3Name || null,
        };
        const changed: ProductUpdatePayload = Object.fromEntries(
          Object.entries(values).filter(
            ([key, value]) =>
              JSON.stringify(value) !==
              JSON.stringify(original[key as keyof typeof original]),
          ),
        );
        const variantUpdate: DefaultVariantUpdatePayload = {};
        if (selectedVariant) {
          if (price !== String(selectedVariant.price ?? "")) {
            if (!price.trim()) throw new Error("Price cannot be cleared.");
            variantUpdate.price = Number(price);
          }
          if (compareAtPrice !== String(selectedVariant.compareAtPrice ?? ""))
            variantUpdate.compareAtPrice = compareAtPrice.trim()
              ? compareN
              : null;
          if (sku !== (selectedVariant.sku ?? ""))
            variantUpdate.sku = sku.trim() || null;
          if (stock !== String(selectedVariant.inventoryQuantity ?? "")) {
            if (!stock.trim())
              throw new Error(
                "Enter an explicit physical stock quantity. Blank does not mean unlimited.",
              );
            variantUpdate.inventoryQuantity = stockN;
          }
          if (Object.keys(variantUpdate).length)
            changed.variantUpdate = {
              ...variantUpdate,
              variantId: selectedVariant.id,
            };
        }
        if (
          JSON.stringify([...collectionIds].sort()) !==
          JSON.stringify([...initial.collectionIds].sort())
        )
          changed.collectionIds = collectionIds;
        if (Object.keys(changed).length) await onUpdate(product.id, changed);

        toast({
          title: "Updated",
          description: "Product updated successfully.",
        });
      }

      onOpenChange(false);
    } catch (e: unknown) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Operation failed",
      });
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
                  <Label htmlFor="product-field-1">Title *</Label>
                  <Input
                    id="product-field-1"
                    aria-label="Title *"
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
                  <Label htmlFor="product-field-2">Vendor</Label>
                  <Input
                    id="product-field-2"
                    aria-label="Vendor"
                    value={vendor}
                    onChange={(e) => setVendor(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="product-field-3">Status</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger aria-label="Product status">
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

              <div className="space-y-2 mt-4">
                <Label htmlFor="product-field-4">Product type</Label>
                <Input
                  id="product-field-4"
                  aria-label="Product type"
                  value={productType}
                  onChange={(e) => setProductType(e.target.value)}
                  placeholder="Shoes / Sneakers / ..."
                />
              </div>

              <div className="space-y-2 mt-4">
                <Label htmlFor="product-field-5">
                  Description (HTML or text)
                </Label>
                <Textarea
                  id="product-field-5"
                  aria-label="Description (HTML or text)"
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
                          aria-pressed={active}
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
                  Images change only after a successful save. Removing all
                  images requires confirmation.
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
                              aria-label={`Move image ${idx + 1} up`}
                              disabled={idx === 0}
                              onClick={() => moveImage(idx, idx - 1)}
                            >
                              ↑
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              aria-label={`Move image ${idx + 1} down`}
                              disabled={idx === images.length - 1}
                              onClick={() => moveImage(idx, idx + 1)}
                            >
                              ↓
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              aria-label={`Remove image ${idx + 1}`}
                              onClick={() => removeImage(idx)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-center rounded-md bg-muted p-3">
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

            {/* PRICING / INVENTORY */}
            <section className="rounded-xl border p-4">
              <div className="mb-3 font-medium">Pricing & Inventory (EUR)</div>
              {mode === "edit" && (
                <div className="space-y-2 mb-4">
                  <Label htmlFor="variant-selection">Variant to edit</Label>
                  <select
                    id="variant-selection"
                    aria-label="Variant to edit"
                    className="w-full rounded-md border bg-background p-2"
                    value={selectedVariantId}
                    onChange={(e) => selectVariant(e.target.value)}
                  >
                    <option value="">
                      Select a variant to edit its price, SKU and stock
                    </option>
                    {product?.variants.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.title || "Untitled"} — {v.sku || "No SKU"} (#{v.id})
                      </option>
                    ))}
                  </select>
                  {selectedVariant && (
                    <p className="text-sm text-muted-foreground">
                      Physical:{" "}
                      {selectedVariant.inventoryQuantity ?? "Unavailable"} ·
                      Reserved: {selectedVariant.reservedQuantity ?? 0} ·
                      Available:{" "}
                      {Math.max(
                        0,
                        (selectedVariant.inventoryQuantity ?? 0) -
                          (selectedVariant.reservedQuantity ?? 0),
                      )}
                      . Blank stock is unavailable, never unlimited.
                    </p>
                  )}
                </div>
              )}
              <fieldset
                disabled={mode === "edit" && !selectedVariant}
                className="disabled:opacity-50"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="product-field-6">Price *</Label>
                    <Input
                      id="product-field-6"
                      aria-label="Price *"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="e.g. 299.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="product-field-7">Compare at price</Label>
                    <Input
                      id="product-field-7"
                      aria-label="Compare at price"
                      value={compareAtPrice}
                      onChange={(e) => setCompareAtPrice(e.target.value)}
                      placeholder="e.g. 349.00"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="product-field-8">SKU</Label>
                    <Input
                      id="product-field-8"
                      aria-label="SKU"
                      value={sku}
                      onChange={(e) => setSku(e.target.value)}
                      placeholder="SKU-123"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="product-field-9">Stock</Label>
                    <Input
                      id="product-field-9"
                      aria-label="Stock"
                      value={stock}
                      onChange={(e) => setStock(e.target.value)}
                      placeholder="e.g. 20"
                    />
                  </div>
                </div>
              </fieldset>
              <div className="grid gap-4 sm:grid-cols-2 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="product-field-10">Option 1 name</Label>
                  <Input
                    id="product-field-10"
                    aria-label="Option 1 name"
                    value={option1Name}
                    onChange={(e) => setOption1Name(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-field-11">Option 2 name</Label>
                  <Input
                    id="product-field-11"
                    aria-label="Option 2 name"
                    value={option2Name}
                    onChange={(e) => setOption2Name(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2 mt-4">
                <Label htmlFor="product-field-12">Option 3 name</Label>
                <Input
                  id="product-field-12"
                  aria-label="Option 3 name"
                  value={option3Name}
                  onChange={(e) => setOption3Name(e.target.value)}
                />
              </div>

              <p className="text-xs text-muted-foreground mt-3">
                Price, SKU and stock apply only to the selected variant. Option
                names apply to the product.
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
