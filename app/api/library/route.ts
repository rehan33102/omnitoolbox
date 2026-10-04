import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";

/**
 * POST /api/library/upload
 * Upload a generated file to the user's cloud library.
 * Body: FormData { file: Blob, kind: string, name: string }
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to save to cloud library" }, { status: 401 });
  }

  try {
    const form = await req.formData();
    const file = form.get("file") as Blob | null;
    const kind = (form.get("kind") as string) || "image";
    const name = (form.get("name") as string) || `file-${Date.now()}`;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // 50MB limit per file
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large (max 50MB)" }, { status: 400 });
    }

    const supabase = createClient();
    const ext = name.split(".").pop() || "bin";
    const storagePath = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    // Upload to storage bucket
    const { error: uploadError } = await supabase.storage
      .from("user-library")
      .upload(storagePath, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    // Save metadata
    const { data, error: dbError } = await supabase
      .from("user_library")
      .insert({
        user_id: user.id,
        kind,
        name,
        mime_type: file.type || "application/octet-stream",
        size_bytes: file.size,
        storage_path: storagePath,
      })
      .select("id")
      .single();

    if (dbError) {
      // Cleanup orphaned file
      await supabase.storage.from("user-library").remove([storagePath]);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: data.id });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/library/list
 * List the signed-in user's cloud library.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ items: [] });
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("user_library")
    .select("id, kind, name, mime_type, size_bytes, storage_path, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ items: [], error: error.message });
  }

  // Generate signed URLs for each file (1 hour expiry)
  const items = await Promise.all(
    (data || []).map(async (row) => {
      const { data: urlData } = await supabase.storage
        .from("user-library")
        .createSignedUrl(row.storage_path, 3600);
      return { ...row, url: urlData?.signedUrl || null };
    })
  );

  return NextResponse.json({ items });
}

/**
 * DELETE /api/library/delete?id=xxx
 * Delete a file from the user's cloud library.
 */
export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const supabase = createClient();

  // Get the storage path (RLS ensures it's the user's own)
  const { data: row } = await supabase
    .from("user_library")
    .select("storage_path")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Delete from storage
  await supabase.storage.from("user-library").remove([row.storage_path]);

  // Delete metadata
  await supabase.from("user_library").delete().eq("id", id).eq("user_id", user.id);

  return NextResponse.json({ ok: true });
}
