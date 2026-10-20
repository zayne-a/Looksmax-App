// scripts/eval-personalization.ts
//
// Personalization eval gate for Project Ascend.
//
// HOW TO RUN (from the project root):
//   npx -y tsx scripts/eval-personalization.ts
//
// tsx is fetched on demand via npx on first run — it is intentionally NOT
// added to package.json (no new dependencies).
//
// WHAT IT DOES: builds stub plans for the 5 archetype users defined in
// src/lib/eval.ts (oily-acne beginner, dry-dull 30s, hyperpigmentation-focused,
// sensitive-redness, advanced maintenance) and checks the pairwise Jaccard
// overlap of recommended product types. It exits 0 on PASS and non-zero on
// FAIL (any pair > 70% overlap).
//
// WHEN TO RUN: after any change to buildStubPlan (src/lib/kb.ts) or the plan
// prompt (src/app/api/plan/route.ts) that could make plans more generic.

import { evaluateArchetypeDiversity } from "../src/lib/eval.js";

try {
  evaluateArchetypeDiversity();
  console.log(
    "\nEVAL PASS: archetype diversity gate satisfied (no pair > 70% product-type overlap)."
  );
} catch (err) {
  console.error(`\nEVAL FAIL: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
}
