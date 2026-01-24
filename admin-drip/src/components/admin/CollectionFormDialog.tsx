import { useEffect, useMemo, useState } from "react";
import type { Collection } from "@/types";
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
import { toast } from "@/hooks/use-toast";

type Mode = "create" | "edit";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: Mode;
  collection?: Collection | null;

  onCreate: (payload: {
    title: string;
    handle: string;
    description?: string | null;
  }) => Promise<void>;

  onUpdate: (
    id: number,
    payload: {
      title?: string;
      handle?: string;
      description?: string | null;
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

export default function CollectionFormDialog({
  open,
  onOpenChange,
  mode,
  collection,
  onCreate,
  onUpdate,
}: Props) {
  const initial = useMemo(() => {
    if (mode === "edit" && collection) {
      return {
        title: collection.title ?? "",
        handle: collection.handle ?? "",
        description: collection.description ?? "",
      };
    }
    return { title: "", handle: "", description: "" };
  }, [mode, collection]);

  const [title, setTitle] = useState(initial.title);
  const [handle, setHandle] = useState(initial.handle);
  const [description, setDescription] = useState(initial.description);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(initial.title);
    setHandle(initial.handle);
    setDescription(initial.description);
  }, [open, initial]);

  async function submit() {
    if (!title.trim()) {
      toast({ title: "Title required", description: "Please enter a title." });
      return;
    }

    const finalHandle = handle.trim() || slugifyHandle(title);
    if (!finalHandle) {
      toast({
        title: "Handle required",
        description: "Please enter a handle.",
      });
      return;
    }

    setSaving(true);
    try {
      if (mode === "create") {
        await onCreate({
          title: title.trim(),
          handle: finalHandle,
          description: description.trim() || null,
        });
        toast({ title: "Created", description: "Collection created." });
      } else {
        if (!collection?.id) throw new Error("Missing collection id");
        await onUpdate(collection.id, {
          title: title.trim(),
          handle: finalHandle,
          description: description.trim() || null,
        });
        toast({ title: "Updated", description: "Collection updated." });
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
      {/* ✅ Fix dialog too big: width + scroll */}
      <DialogContent className="w-[min(720px,calc(100vw-2rem))] max-h-[85vh] overflow-hidden p-0">
        <DialogHeader className="p-6 pb-3">
          <DialogTitle>
            {mode === "create" ? "Add Collection" : "Edit Collection"}
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

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={submit} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
