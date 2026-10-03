"use client";

import { useCallback, useEffect, useState } from "react";
import { ADMIN_BLOG_EVENT, listAdminPosts } from "@/lib/admin-blog";
import type { BlogPost } from "@/types";

/**
 * useAdminBlogPosts — posts created/edited in /admin/blog (IndexedDB + LS).
 * Refreshes live when the admin panel saves.
 */
export function useAdminBlogPosts() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    const rows = await listAdminPosts();
    setPosts(rows);
    setLoaded(true);
  }, []);

  useEffect(() => {
    let alive = true;
    listAdminPosts().then((rows) => {
      if (alive) {
        setPosts(rows);
        setLoaded(true);
      }
    });
    const onEvent = () => alive && reload();
    window.addEventListener(ADMIN_BLOG_EVENT, onEvent);
    return () => {
      alive = false;
      window.removeEventListener(ADMIN_BLOG_EVENT, onEvent);
    };
  }, [reload]);

  return { posts, loaded, reload };
}
