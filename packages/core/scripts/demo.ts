import { MAIN, SUB_NAME, sauceDelivery, substituteSpecInput, syntheticEngine, siteStatus } from "../src/index.js";

// Console walk-through of the sauce substitution demo (synthetic data).
const e = syntheticEngine();
const r = e.receiveDelivery("alex", sauceDelivery(), "demo-recv");
console.log("Delivery:", r.delivery.outcome, r.delivery.findings.map((f) => f.message));
const caseId = r.caseId!;
e.verifySpecification("priya", caseId, 1, { newProduct: { name: SUB_NAME, supplier: "Fictional Foods Ltd" }, spec: substituteSpecInput() });
const impact = e.reviewImpact("priya", caseId, 2);
console.log("Affected:", impact.items.map((i) => i.name));
const c = e.state.cases[0]!;
e.approveCase("sam", caseId, { expectedVersion: c.version, specId: c.specId!, impactDigest: impact.digest, requestId: "demo-approve" });
const { publication } = e.preparePublication("sam", MAIN, "demo-prep");
e.adapter = (ch) => (ch === "printed_menu" ? { ok: false, error: "Printer did not respond (simulated)" } : { ok: true });
for (const ch of ["qr_web", "service_view", "printed_menu"] as const) console.log(ch, e.publishChannel("sam", publication.id, ch, `demo-${ch}`));
console.log(siteStatus(e, MAIN).channels.map((c) => `${c.channel}: ${c.status} - ${c.text}`).join("\n"));
