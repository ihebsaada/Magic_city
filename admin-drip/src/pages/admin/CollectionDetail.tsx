import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getCollectionProducts } from "@/services/collectionService";
import type { CollectionWithProducts } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Package, Eye } from "lucide-react";

export default function CollectionDetail() {
  const { handle } = useParams<{ handle: string }>();
  const [data, setData] = useState<CollectionWithProducts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      if (!handle) return;
      try {
        const result = await getCollectionProducts(handle);
        setData(result);
      } catch (err) {
        setError("Failed to load collection details.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [handle]);

  const getMainPrice = (variants: { price: string }[]) => {
    if (variants?.[0]?.price) return `$${variants[0].price}`;
    return "—";
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="animate-fade-in">
        <Link to="/admin/collections" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="h-4 w-4" />
          Back to collections
        </Link>
        <div className="bg-destructive/10 text-destructive rounded-lg p-4">
          {error || "Collection not found"}
        </div>
      </div>
    );
  }

  const { collection, products } = data;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Link to="/admin/collections" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight">{collection.title}</h1>
          <p className="text-muted-foreground font-mono text-sm">{collection.handle}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Products in this collection</CardTitle>
        </CardHeader>
        <CardContent>
          {products.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-8 w-8 mx-auto mb-2" />
              <p>No products in this collection</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16"></TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="hidden sm:table-cell">Vendor</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead className="w-16">View</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
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
                    <TableCell className="font-medium">{product.title}</TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">
                      {product.vendor || "—"}
                    </TableCell>
                    <TableCell className="font-medium">{getMainPrice(product.variants)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" asChild>
                        <Link to={`/admin/products/${product.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
