"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card, Eyebrow } from "@/components/ui";
import AdminGate from "@/components/admin/AdminGate";

/**
 * /admin/forum — moderation for the community forum (2026-10-22).
 * The forum itself lives in the native app; its posts and comments
 * sit in the same Supabase (public.forum_posts / forum_comments).
 * This console lists the newest of each and deletes through
 * /api/admin/forum (server re-checks is_admin; deleting a post
 * takes its comments and upvotes with it via FK cascade).
 */

interface ForumPost {
  id: string;
  author_handle: string;
  title: string;
  body: string;
  created_at: string;
}

interface ForumComment {
  id: string;
  post_id: string;
  author_handle: string;
  body: string;
  created_at: string;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ForumConsole({ token }: { token: string }) {
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [comments, setComments] = useState<ForumComment[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/forum", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = (await res.json().catch(() => ({}))) as {
        posts?: ForumPost[];
        comments?: ForumComment[];
        error?: string;
      };
      if (!res.ok) {
        setStatus(json.error ?? "Could not load the forum.");
        return;
      }
      setPosts(Array.isArray(json.posts) ? json.posts : []);
      setComments(Array.isArray(json.comments) ? json.comments : []);
      setLoaded(true);
    } catch {
      setStatus("Could not load the forum — check your connection.");
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const postTitle = (id: string) =>
    posts.find((p) => p.id === id)?.title ?? "(post not in this list)";

  const remove = async (kind: "post" | "comment", id: string) => {
    if (
      !window.confirm(
        kind === "post"
          ? "Delete this post? Its comments and upvotes go with it. This cannot be undone."
          : "Delete this comment? This cannot be undone."
      )
    ) {
      return;
    }
    setBusyId(id);
    setStatus(null);
    try {
      const res = await fetch("/api/admin/forum", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ kind, id }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok) {
        setStatus(json.error ?? "Delete failed — try again.");
        return;
      }
      setStatus(kind === "post" ? "Post deleted." : "Comment deleted.");
      await load();
    } catch {
      setStatus("Delete failed — check your connection.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:py-16">
      <Eyebrow>Forum · admin</Eyebrow>
      <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-bone sm:text-4xl">
        Forum moderation
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
        The newest posts and comments from the community forum in the
        app. Deleting is permanent and immediate.{" "}
        <Link href="/admin" className="font-semibold text-gold hover:underline">
          Admin home →
        </Link>{" "}
        <Link href="/admin/content" className="font-semibold text-gold hover:underline">
          All content →
        </Link>{" "}
        <Link href="/admin/users" className="font-semibold text-gold hover:underline">
          Users &amp; Pro →
        </Link>{" "}
        <Link href="/admin/portal" className="font-semibold text-gold hover:underline">
          Portal review →
        </Link>{" "}
        <Link href="/admin/settings" className="font-semibold text-gold hover:underline">
          App settings →
        </Link>
      </p>

      {status && (
        <p className="mt-4 text-xs font-semibold text-gold-soft">{status}</p>
      )}

      <h2 className="mt-10 font-display text-xl font-extrabold text-bone">
        Latest posts ({posts.length})
      </h2>
      <div className="mt-4 space-y-3">
        {loaded && posts.length === 0 ? (
          <Card>
            <p className="text-sm text-muted">
              No posts yet — the forum is live in the app and fills as
              members post.
            </p>
          </Card>
        ) : (
          posts.map((p) => (
            <Card key={p.id} className="!p-4">
              <div className="flex flex-wrap items-start gap-4">
                <div className="min-w-0 flex-1">
                  <p className="font-display text-sm font-bold text-bone">
                    {p.title}
                  </p>
                  {p.body && (
                    <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-muted">
                      {p.body}
                    </p>
                  )}
                  <p className="mt-1.5 text-[11px] text-muted">
                    @{p.author_handle} · {formatDate(p.created_at)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => void remove("post", p.id)}
                  disabled={busyId !== null}
                  className="shrink-0 px-4 py-2 text-xs"
                >
                  {busyId === p.id ? "Deleting…" : "Delete post"}
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>

      <h2 className="mt-12 font-display text-xl font-extrabold text-bone">
        Latest comments ({comments.length})
      </h2>
      <div className="mt-4 space-y-3">
        {loaded && comments.length === 0 ? (
          <Card>
            <p className="text-sm text-muted">No comments yet.</p>
          </Card>
        ) : (
          comments.map((c) => (
            <Card key={c.id} className="!p-4">
              <div className="flex flex-wrap items-start gap-4">
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-3 text-sm leading-relaxed text-bone">
                    {c.body}
                  </p>
                  <p className="mt-1.5 text-[11px] text-muted">
                    @{c.author_handle} · on “{postTitle(c.post_id)}” ·{" "}
                    {formatDate(c.created_at)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => void remove("comment", c.id)}
                  disabled={busyId !== null}
                  className="shrink-0 px-4 py-2 text-xs"
                >
                  {busyId === c.id ? "Deleting…" : "Delete comment"}
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

export default function AdminForumPage() {
  return <AdminGate>{(token) => <ForumConsole token={token} />}</AdminGate>;
}
