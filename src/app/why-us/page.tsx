import { redirect } from "next/navigation";

/** The comparison page lives at /why-ascend; keep old links working. */
export default function OldComparisonRedirect() {
  redirect("/why-ascend");
}
