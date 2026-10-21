import { NextResponse } from "next/server";
import { requireAdmin, type AdminClient } from "@/lib/admin-api";
import { ladderCents, type Tier } from "@/lib/portal";

/**
 * /api/admin/portal — admin review queues for the Creator Portal
 * (2026-10-22). Verification requests approve a connected account
 * into an earning tier; video submissions approve with the ladder
 * amount frozen at approval. Approving a creator's FIRST video flips
 * their referral to qualified ($20 to the referrer). All writes go
 * through the service-role client after requireAdmin — the portal
 * tables have no client write path for review fields (RLS + protect
 * triggers), so this route IS the review security.
 */

function forbidden() {
  return NextResponse.json({ error: "Admins only" }, { status: 403 });
}

interface JoinedRefs {
  creators: Map<string, { discord_username: string | null; discord_avatar_url: string | null }>;
  accounts: Map<string, { platform: string; handle: string; profile_url: string; tier: string | null; status: string }>;
}

async function loadRefs(admin: AdminClient): Promise<JoinedRefs> {
  const [{ data: creators }, { data: accounts }] = await Promise.all([
    admin.from("creator_profiles").select("id, discord_username, discord_avatar_url"),
    admin.from("connected_accounts").select("id, platform, handle, profile_url, tier, status"),
  ]);
  return {
    creators: new Map(
      (creators ?? []).map((c) => [
        c.id as string,
        {
          discord_username: c.discord_username as string | null,
          discord_avatar_url: c.discord_avatar_url as string | null,
        },
      ])
    ),
    accounts: new Map(
      (accounts ?? []).map((a) => [
        a.id as string,
        {
          platform: a.platform as string,
          handle: a.handle as string,
          profile_url: a.profile_url as string,
          tier: a.tier as string | null,
          status: a.status as string,
        },
      ])
    ),
  };
}

/** GET — pending queues + recently decided, with creator/account
 *  context joined in and signed URLs for uploaded recordings. */
export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth) return forbidden();
  const { admin } = auth;
  const refs = await loadRefs(admin);

  const [{ data: verifications }, { data: submissions }] = await Promise.all([
    admin
      .from("verification_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("video_submissions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  type JoinedRow = Record<string, unknown> & { status: string };
  const join = (row: Record<string, unknown>): JoinedRow => ({
    ...(row as JoinedRow),
    creator: refs.creators.get(row.creator_id as string) ?? null,
    account: refs.accounts.get(row.account_id as string) ?? null,
  });

  const verificationRows = await Promise.all(
    (verifications ?? []).map(async (v) => {
      const row = join(v as Record<string, unknown>);
      let recording_view_url: string | null =
        (v.recording_url as string | null) ?? null;
      if (!recording_view_url && v.storage_path) {
        const { data: signed } = await admin.storage
          .from("verification-recordings")
          .createSignedUrl(v.storage_path as string, 3600);
        recording_view_url = signed?.signedUrl ?? null;
      }
      return { ...row, recording_view_url };
    })
  );

  const byStatus = <T extends { status: string }>(rows: T[]) => ({
    pending: rows.filter((r) => r.status === "pending"),
    decided: rows.filter((r) => r.status !== "pending").slice(0, 20),
  });

  return NextResponse.json({
    verifications: byStatus(verificationRows),
    submissions: byStatus((submissions ?? []).map(join)),
  });
}

interface ActionBody {
  action?: unknown;
  id?: unknown;
  tier?: unknown;
}

const str = (v: unknown): string =>
  typeof v === "string" ? v.trim() : "";

/** POST — one review action. */
export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth) return forbidden();
  const { admin } = auth;

  let body: ActionBody;
  try {
    body = (await req.json()) as ActionBody;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const action = str(body.action);
  const id = str(body.id);
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  if (action === "verification_approve" || action === "verification_reject") {
    const approve = action === "verification_approve";
    const tier: Tier = body.tier === "ELITE" ? "ELITE" : "BASIC";
    const { data: request, error } = await admin
      .from("verification_requests")
      .select("id, account_id, status")
      .eq("id", id)
      .single();
    if (error || !request) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }
    if (request.status !== "pending") {
      return NextResponse.json({ error: "Already decided" }, { status: 409 });
    }
    const { error: reqError } = await admin
      .from("verification_requests")
      .update({ status: approve ? "approved" : "rejected" })
      .eq("id", id);
    if (reqError) {
      return NextResponse.json({ error: "Could not save the decision" }, { status: 500 });
    }
    if (approve) {
      await admin
        .from("connected_accounts")
        .update({ status: "approved", tier, updated_at: new Date().toISOString() })
        .eq("id", request.account_id);
    } else {
      // Only downgrade the account if it isn't already approved via
      // another request.
      const { data: account } = await admin
        .from("connected_accounts")
        .select("status")
        .eq("id", request.account_id)
        .single();
      if (account && account.status !== "approved") {
        await admin
          .from("connected_accounts")
          .update({ status: "rejected", tier: null, updated_at: new Date().toISOString() })
          .eq("id", request.account_id);
      }
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "submission_approve" || action === "submission_reject") {
    const approve = action === "submission_approve";
    const { data: submission, error } = await admin
      .from("video_submissions")
      .select("id, creator_id, account_id, locked_views, status")
      .eq("id", id)
      .single();
    if (error || !submission) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }
    if (submission.status !== "pending") {
      return NextResponse.json({ error: "Already decided" }, { status: 409 });
    }
    if (!approve) {
      const { error: updError } = await admin
        .from("video_submissions")
        .update({ status: "rejected" })
        .eq("id", id);
      if (updError) {
        return NextResponse.json({ error: "Could not save the decision" }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }

    const { data: account } = await admin
      .from("connected_accounts")
      .select("tier")
      .eq("id", submission.account_id)
      .single();
    const tier: Tier = account?.tier === "ELITE" ? "ELITE" : "BASIC";
    const earned = ladderCents(submission.locked_views as number, tier);
    const { error: updError } = await admin
      .from("video_submissions")
      .update({ status: "approved", earned_cents: earned, tier_at_approval: tier })
      .eq("id", id);
    if (updError) {
      return NextResponse.json({ error: "Could not save the decision" }, { status: 500 });
    }

    // Referral trigger: the invitee's FIRST approved video qualifies
    // their referral ($20 to the referrer, counted on Referrals).
    const { count } = await admin
      .from("video_submissions")
      .select("id", { count: "exact", head: true })
      .eq("creator_id", submission.creator_id)
      .eq("status", "approved");
    if (count === 1) {
      await admin
        .from("referrals")
        .update({ status: "qualified", qualified_at: new Date().toISOString() })
        .eq("invitee_id", submission.creator_id)
        .eq("status", "in_progress");
    }
    return NextResponse.json({ ok: true, earned_cents: earned });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
