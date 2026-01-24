import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  createProduct,
  deleteProduct,
  getProducts,
  updateProduct,
  updateDefaultVariant,
} from "@/services/productService";
import { getCollections } from "@/services/collectionService";
import type { Product, Collection } from "@/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Package, Eye, Pencil, Plus, Trash2 } from "lucide-react";
import ProductFormDialog from "@/components/admin/ProductFormDialog";
import { toast } from "@/hooks/use-toast";

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedCollection, setSelectedCollection] = useState<string>("all");

  // ✅ dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const data = await getProducts(search || undefined);
      setProducts(data);
    } catch (err) {
      setError("Failed to load products. Check your API connection.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const data = await getCollections();
        setCollections(data);
      } catch (err) {
        console.error("Failed to load collections:", err);
      }
    })();
  }, []);

  useEffect(() => {
    const debounce = setTimeout(refresh, 300);
    return () => clearTimeout(debounce);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const filteredProducts =
    selectedCollection === "all"
      ? products
      : products.filter((p) =>
          p.collections?.some((c) => c.handle === selectedCollection),
        );

  const getMainPrice = (product: Product) => {
    if (product.variants?.[0]?.price) {
      return `$${product.variants[0].price}`;
    }
    return "—";
  };

  const getMainCollection = (product: Product) => {
    return product.collections?.[0]?.title || "—";
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "active":
        return (
          <Badge className="bg-success/10 text-success border-0">Active</Badge>
        );
      case "draft":
        return <Badge variant="secondary">Draft</Badge>;
      case "archived":
        return (
          <Badge variant="outline" className="text-muted-foreground">
            Archived
          </Badge>
        );
      default:
        return null;
    }
  };

  function openCreate() {
    setDialogMode("create");
    setActiveProduct(null);
    setDialogOpen(true);
  }

  function openEdit(p: Product) {
    setDialogMode("edit");
    setActiveProduct(p);
    setDialogOpen(true);
  }

  async function onCreate(payload: any) {
    await createProduct(payload);
    await refresh();
  }

  async function onUpdate(id: number, payload: any) {
    // update product basic fields
    await updateProduct(id, payload);

    // if you have endpoint PUT /admin/products/:id/collections, you can call it here
    // BUT your backend create/update already handles collectionIds in create
    // For update, your controller currently ignores collectionIds -> so keep as TODO if needed.

    await refresh();
  }

  async function onDelete(id: number) {
    if (!confirm("Delete this product?")) return;
    try {
      await deleteProduct(id);
      toast({ title: "Deleted", description: "Product deleted." });
      await refresh();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Delete failed" });
    }
  }
  async function onUpdateDefaultVariant(productId: number, payload: any) {
    await updateDefaultVariant(productId, payload);
    await refresh();
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight">
            Products
          </h1>
          <p className="text-muted-foreground">Manage your product catalog</p>
        </div>
        <Button className="gap-2" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Add Product
        </Button>
      </div>

      <ProductFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={dialogMode}
        product={activeProduct}
        collections={collections}
        onCreate={onCreate}
        onUpdate={onUpdate}
        onUpdateDefaultVariant={onUpdateDefaultVariant}
      />

      {error && (
        <div className="bg-destructive/10 text-destructive rounded-lg p-4">
          {error}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={selectedCollection}
          onValueChange={setSelectedCollection}
        >
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="All collections" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All collections</SelectItem>
            {collections.map((c) => (
              <SelectItem key={c.id} value={c.handle}>
                {c.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16"></TableHead>
              <TableHead>Product</TableHead>
              <TableHead className="hidden md:table-cell">Vendor</TableHead>
              <TableHead className="hidden lg:table-cell">Collection</TableHead>
              <TableHead>Price</TableHead>
              <TableHead className="hidden sm:table-cell">Status</TableHead>
              <TableHead className="w-32">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-10 w-10 rounded" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-40" />
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <Skeleton className="h-4 w-28" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Skeleton className="h-5 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-8 w-24" />
                  </TableCell>
                </TableRow>
              ))
            ) : filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Package className="h-8 w-8" />
                    <p>No products found</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    <div className="w-10 h-10 rounded bg-muted flex items-center justify-center overflow-hidden">
                      {product.images?.[0]?.src ? (
                        <img
                          src={product.images[0].src}
                          alt={product.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Package className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{product.title}</span>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {product.vendor || "—"}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">
                    {getMainCollection(product)}
                  </TableCell>
                  <TableCell className="font-medium">
                    {getMainPrice(product)}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {getStatusBadge(product.status)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" asChild>
                        <Link to={`/admin/products/${product.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(product)}
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete(product.id)}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
