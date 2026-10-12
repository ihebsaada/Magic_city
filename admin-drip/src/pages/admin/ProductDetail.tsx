import { formatEUR } from "@/lib/adminValues";
import { errorMessage } from "@/services/api";
import ProductFormDialog from "@/components/admin/ProductFormDialog";
import { getCollections } from "@/services/collectionService";
import { saveProductChanges, updateProduct } from "@/services/productService";
import type { ProductUpdatePayload } from "@/services/productService";
import type { Collection } from "@/types";
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getProductById } from "@/services/productService";
import type { Product } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Package, Save } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({
    title: "",
    handle: "",
    vendor: "",
    productType: "",
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProduct() {
      if (!id) return;
      try {
        const data = await getProductById(Number(id));
        setProduct(data);
        setDraft({
          title: data.title,
          handle: data.handle,
          vendor: data.vendor ?? "",
          productType: data.productType ?? "",
        });
        setCollections(await getCollections());
      } catch (err) {
        setError(errorMessage(err));
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchProduct();
  }, [id]);

  const reload = async () => {
    const data = await getProductById(Number(id));
    setProduct(data);
    setDraft({
      title: data.title,
      handle: data.handle,
      vendor: data.vendor ?? "",
      productType: data.productType ?? "",
    });
  };
  const handleSave = async () => {
    if (!product || !draft.title.trim() || !draft.handle.trim()) {
      toast({ title: "Title and handle are required" });
      return;
    }
    const values = {
      title: draft.title.trim(),
      handle: draft.handle.trim(),
      vendor: draft.vendor.trim() || null,
      productType: draft.productType.trim() || null,
    };
    const payload = Object.fromEntries(
      Object.entries(values).filter(
        ([key, value]) => value !== (product[key as keyof Product] ?? null),
      ),
    );
    setSaving(true);
    try {
      if (Object.keys(payload).length) await updateProduct(product.id, payload);
      await reload();
      toast({ title: "Saved", description: "Product saved successfully." });
    } catch (error) {
      toast({
        title: "Save failed",
        description: errorMessage(error),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };
  const onUpdate = async (productId: number, payload: ProductUpdatePayload) => {
    try {
      await saveProductChanges(
        productId,
        payload,
        product?.collections?.map((c) => c.id) ?? [],
      );
    } finally {
      try {
        await reload();
      } catch {
        /* Preserve the original write error; the operator can reload. */
      }
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
          <Skeleton className="h-80 w-full" />
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="animate-fade-in">
        <Link
          to="/admin/products"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to products
        </Link>
        <div className="bg-destructive/10 text-destructive rounded-lg p-4">
          {error || "Product not found"}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            to="/admin/products"
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-display font-bold tracking-tight">
              {product.title}
            </h1>
            <p className="text-muted-foreground">Product ID: {product.id}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setDialogOpen(true)}>
            Edit product
          </Button>
          <Button disabled={saving} onClick={handleSave} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </div>

      <ProductFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode="edit"
        product={product}
        collections={collections}
        onCreate={async () => {
          throw new Error("Creation is unavailable in this view");
        }}
        onUpdate={onUpdate}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={draft.title}
                    onChange={(e) =>
                      setDraft({ ...draft, title: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vendor">Vendor</Label>
                  <Input
                    id="vendor"
                    value={draft.vendor}
                    onChange={(e) =>
                      setDraft({ ...draft, vendor: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="handle">Handle</Label>
                  <Input
                    id="handle"
                    value={draft.handle}
                    onChange={(e) =>
                      setDraft({ ...draft, handle: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="productType">Product Type</Label>
                  <Input
                    id="productType"
                    value={draft.productType}
                    onChange={(e) =>
                      setDraft({ ...draft, productType: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Tags</Label>
                <div className="flex flex-wrap gap-2">
                  {product.tags?.length ? (
                    product.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-muted-foreground text-sm">
                      No tags
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Variants */}
          <Card>
            <CardHeader>
              <CardTitle>Variants</CardTitle>
            </CardHeader>
            <CardContent>
              {product.variants?.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Compare At</TableHead>
                      <TableHead>Physical / Reserved / Available</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {product.variants.map((variant) => (
                      <TableRow key={variant.id}>
                        <TableCell className="font-mono text-sm">
                          {variant.sku || "—"}
                        </TableCell>
                        <TableCell>{variant.title}</TableCell>
                        <TableCell>{formatEUR(variant.price)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {variant.compareAtPrice
                            ? formatEUR(variant.compareAtPrice)
                            : "—"}
                        </TableCell>
                        <TableCell>
                          {variant.inventoryQuantity ?? "Unavailable"} /{" "}
                          {variant.reservedQuantity ?? 0} /{" "}
                          {Math.max(
                            0,
                            (variant.inventoryQuantity ?? 0) -
                              (variant.reservedQuantity ?? 0),
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground text-sm">No variants</p>
              )}
            </CardContent>
          </Card>

          {/* Collections */}
          <Card>
            <CardHeader>
              <CardTitle>Collections</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {product.collections?.length ? (
                  product.collections.map((c) => (
                    <Badge key={c.id} variant="outline">
                      {c.title}
                    </Badge>
                  ))
                ) : (
                  <span className="text-muted-foreground text-sm">
                    Not in any collection
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status */}
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge className="bg-success/10 text-success border-0">
                {product.status || "Active"}
              </Badge>
              {product.createdAt && (
                <p className="text-xs text-muted-foreground mt-4">
                  Created: {new Date(product.createdAt).toLocaleDateString()}
                </p>
              )}
              {product.updatedAt && (
                <p className="text-xs text-muted-foreground">
                  Updated: {new Date(product.updatedAt).toLocaleDateString()}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Images */}
          <Card>
            <CardHeader>
              <CardTitle>Images</CardTitle>
            </CardHeader>
            <CardContent>
              {product.images?.length ? (
                <div className="grid grid-cols-2 gap-2">
                  {product.images.map((image) => (
                    <div
                      key={image.id}
                      className="aspect-square rounded-lg bg-muted overflow-hidden"
                    >
                      <img
                        src={image.src}
                        alt={image.alt || product.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="aspect-square rounded-lg bg-muted flex items-center justify-center">
                  <Package className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
