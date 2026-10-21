/**
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
