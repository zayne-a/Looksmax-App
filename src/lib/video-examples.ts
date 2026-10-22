/**
 * @deprecated — superseded by the unified content system
 * (src/lib/content.ts, the `creator-examples` collection, managed
 * from /admin/content). /creator/video-examples now reads its items
 * from the database and no longer depends on this list being
 * non-empty. This type/export is kept ONLY for backwards
 * compatibility with existing imports; do not add new entries here.
 *
 * Creator video examples for /creator/video-examples. Data-driven:
 * add an entry and the grid + modal player light up; while the list
 * is empty the page renders its Coming Soon state (the same pattern
 * the reference uses for its Graphics page). No creator videos exist
 * yet, so nothing is listed — never invent examples.
 */
export interface VideoExample {
  id: string;
  title: string;
  youtubeId: string;
}

export const VIDEO_EXAMPLES: VideoExample[] = [];
