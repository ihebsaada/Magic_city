import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { Collection } from "@/types";
import {
  createCollection,
  deleteCollection,
  getCollections,
  updateCollection,
} from "@/services/collectionService";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { FolderOpen, Eye, Plus, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import CollectionFormDialog from "@/components/admin/CollectionFormDialog";

export default function Collections() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [selected, setSelected] = useState<Collection | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const data = await getCollections();
      setCollections(data);
    } catch (err: any) {
      toast({
        title: "Error",
        description: err?.message ?? "Failed to load collections",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return collections;
    return collections.filter((c) =>
      [c.title, c.handle].some((v) => (v ?? "").toLowerCase().includes(q)),
    );
  }, [collections, search]);

  const openCreate = () => {
    setMode("create");
    setSelected(null);
    setDialogOpen(true);
  };

  const openEdit = (c: Collection) => {
    setMode("edit");
    setSelected(c);
    setDialogOpen(true);
  };

  const onDelete = async (c: Collection) => {
    if (!confirm(`Delete collection "${c.title}" ?`)) return;
    try {
      await deleteCollection(c.id);
      toast({ title: "Deleted", description: "Collection deleted." });
      await refresh();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Delete failed" });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight">
            Collections
          </h1>
          <p className="text-muted-foreground">Organize your products</p>
        </div>
        <Button className="gap-2" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Add Collection
        </Button>
      </div>

      {/* Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search collections..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Handle</TableHead>
              <TableHead className="text-right">Products</TableHead>
              <TableHead className="w-28 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="h-4 w-8 ml-auto" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="h-8 w-24 ml-auto" />
                  </TableCell>
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <FolderOpen className="h-8 w-8" />
                    <p>No collections found</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.title}</TableCell>
                  <TableCell className="text-muted-foreground font-mono text-sm">
                    {c.handle}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant="secondary">{c.productsCount}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-1">
                      <Button variant="ghost" size="icon" asChild>
                        <Link to={`/admin/collections/${c.handle}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(c)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete(c)}
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

      <CollectionFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={mode}
        collection={selected}
        onCreate={async (payload) => {
          await createCollection(payload);
          await refresh();
        }}
        onUpdate={async (id, payload) => {
          await updateCollection(id, payload);
          await refresh();
        }}
      />
    </div>
  );
}
