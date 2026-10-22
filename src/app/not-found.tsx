import NotFoundExperience from "@/components/NotFoundExperience";

/**
 * The app's real 404 route (2026-10-22). Deliberately the exact
 * component the admin gates render for non-admins, so a hidden
 * admin URL and a genuinely unknown URL are indistinguishable.
 */
export default function NotFound() {
  return <NotFoundExperience />;
}
