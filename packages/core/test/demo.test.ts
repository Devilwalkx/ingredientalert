import { describe, expect, it } from "vitest";
import { MAIN, ANNEX, SUB_NAME, channelStatus, checkCopy, outstandingAcks, sauceDelivery, siteStatus, substituteSpecInput, verifyAuditChain } from "../src/index.js";
import { newEngine } from "./helpers.js";

describe("the demo: a replacement sauce affects two nested recipes at one site, and the printed-menu update fails", () => {
  it("runs the whole chain end to end and leaves the failed channel and review follow-up outstanding", () => {
    const { e } = newEngine();
    const annexBefore = JSON.stringify(e.declarationsAt("sam", ANNEX));

    // 1 receiving: ordered Harbour Teriyaki, a different sauce arrives
    const r = e.receiveDelivery("alex", sauceDelivery(), "recv");
    expect(r.delivery.outcome).toBe("review_required");
    expect(r.delivery.findings.map((f) => f.kind)).toEqual(["unknown_barcode"]);
    const caseId = r.caseId!;
    // information hold: both nested dishes are UNRESOLVED, nothing can be published as routine
    const hold = e.declarationsAt("sam", MAIN).filter((d) => !d.resolved).map((d) => d.recipeName).sort();
    expect(hold).toEqual(["Glazed chicken rice", "Glazed salmon bowl"]);
    expect(() => e.preparePublication("sam", MAIN, "early")).toThrow(/blocked/);
    expect(siteStatus(e, MAIN).openCases).toBe(1);

    // 2 reviewer checks the exact specification and impact
    e.verifySpecification("priya", caseId, 1, { newProduct: { name: SUB_NAME, supplier: "Fictional Foods Ltd" }, spec: substituteSpecInput() });
    const impact = e.reviewImpact("priya", caseId, 2);
    expect(impact.items.map((i) => `${i.kind}:${i.name}`).sort()).toEqual(["component:House glaze", "dish:Glazed chicken rice", "dish:Glazed salmon bowl"]);
    const salmon = impact.items.find((i) => i.name === "Glazed salmon bowl")!;
    expect(salmon.path).toEqual(["Glazed salmon bowl", "House glaze"]);
    expect(salmon.after!.contains).toEqual(expect.arrayContaining(["sesame", "fish", "soybeans", "gluten"]));
    expect(salmon.after!.mayContain).toContain("peanuts");

    // 3 independent approver accepts that exact revision
    const c = e.state.cases[0]!;
    const { substitution } = e.approveCase("sam", caseId, { expectedVersion: c.version, specId: c.specId!, impactDigest: impact.digest, requestId: "approve" });
    expect(substitution.approvedBy).toBe("sam");
    expect(siteStatus(e, MAIN).pendingChange).toBe(true);

    // 4 publish revision 2: QR/web and service view succeed, printed menu fails
    const { publication } = e.preparePublication("sam", MAIN, "prep");
    expect(publication.revision).toBe(2);
    expect(publication.sources.substitutionIds).toEqual([substitution.id]);
    e.adapter = (ch) => (ch === "printed_menu" ? { ok: false, error: "Printer did not respond (simulated)" } : { ok: true });
    expect(e.publishChannel("sam", publication.id, "qr_web", "q").ok).toBe(true);
    expect(e.publishChannel("sam", publication.id, "service_view", "s").ok).toBe(true);
    expect(e.publishChannel("sam", publication.id, "printed_menu", "p").ok).toBe(false);

    // 5 only one person has acknowledged; the printed menu is out of date
    e.acknowledge("jo", publication.id, 2);
    const st = siteStatus(e, MAIN);
    expect(st.outstandingChannels).toBe(1);
    expect(st.outstandingAcks).toBe(1);
    expect(outstandingAcks(e.state, MAIN).outstanding).toEqual(["jess"]);
    expect(channelStatus(e.state, MAIN).find((x) => x.channel === "printed_menu")!.status).toBe("failed");
    expect(checkCopy(e.state, MAIN, 1)).toBe("stale");

    // 6 the annex is untouched
    expect(JSON.stringify(e.declarationsAt("sam", ANNEX))).toBe(annexBefore);

    // 7 nothing anywhere reads as a safety claim; every unknown stayed unknown
    const everything = JSON.stringify(e.state.publications) + JSON.stringify(e.exportHistory("sam", MAIN));
    expect(everything).not.toMatch(/allergen-free|safe to serve|free from|production ready/i);
    expect(publication.dishes.every((d) => d.resolved)).toBe(true);
    expect(verifyAuditChain(e.state)).toBe(true);

    // 8 source-linked export
    const x = e.exportHistory("sam", MAIN);
    expect(x.menuVersions[0]!.sources[0]!).toMatchObject({ replaces: "Harbour Teriyaki Sauce 1L", with: SUB_NAME, approvedBy: "sam", receivedBy: "alex", specVerifiedBy: "priya" });
    expect(x.menuVersions[0]!.sources[0]!.evidence.reference).toMatch(/EG-TS-2026-02/);
    expect(x.menuVersions[0]!.channels["printed_menu"]!.status).toBe("failed");
  });
});
