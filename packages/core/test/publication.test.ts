import { describe, expect, it } from "vitest";
import { ANNEX, MAIN, checkCopy, channelStatus, outstandingAcks, sauceDelivery, siteStatus, type Channel } from "../src/index.js";
import { fullSauceChain, newEngine, receiveSauce } from "./helpers.js";

const code = (fn: () => unknown) => {
  try { fn(); } catch (e: any) { return e.code as string; }
  return "no-error";
};

function toRevision2() {
  const t = newEngine();
  fullSauceChain(t.e);
  const { publication } = t.e.preparePublication("sam", MAIN, "prep-2");
  return { ...t, pub: publication };
}

describe("publication channels", () => {
  it("starts consistent: every channel shows revision 1, everyone acknowledged", () => {
    const { e } = newEngine();
    expect(channelStatus(e.state, MAIN).every((c) => c.status === "current" && c.liveRevision === 1)).toBe(true);
    expect(outstandingAcks(e.state, MAIN).outstanding).toEqual([]);
    expect(siteStatus(e, MAIN).outstandingChannels).toBe(0);
  });

  it("a failed printed-menu update is surfaced and stays outstanding while the other channels succeed; retry is idempotent", () => {
    const { e, pub } = toRevision2();
    e.adapter = (ch) => (ch === "printed_menu" ? { ok: false, error: "Printer offline (simulated)" } : { ok: true });
    expect(e.publishChannel("sam", pub.id, "qr_web", "q1").ok).toBe(true);
    expect(e.publishChannel("sam", pub.id, "service_view", "s1").ok).toBe(true);
    const failed = e.publishChannel("sam", pub.id, "printed_menu", "p1");
    expect(failed).toMatchObject({ ok: false, error: "Printer offline (simulated)" });
    const status = channelStatus(e.state, MAIN);
    const printed = status.find((c) => c.channel === "printed_menu")!;
    expect(printed.status).toBe("failed");
    expect(printed.liveRevision).toBe(1);
    expect(printed.text).toMatch(/FAILED/);
    expect(printed.text).toMatch(/OLD revision 1/);
    expect(status.find((c) => c.channel === "qr_web")!.status).toBe("current");
    const st = siteStatus(e, MAIN);
    expect(st.outstandingChannels).toBe(1);
    // replaying the identical request does not retry or double count
    expect(e.publishChannel("sam", pub.id, "printed_menu", "p1").replayed).toBe(true);
    expect(e.state.publications.find((p) => p.id === pub.id)!.channels.printed_menu.attempts).toBe(1);
    // a new attempt with a new request id retries; still failing -> attempts 2
    e.publishChannel("sam", pub.id, "printed_menu", "p2");
    expect(e.state.publications.find((p) => p.id === pub.id)!.channels.printed_menu.attempts).toBe(2);
    // fixed
    e.adapter = () => ({ ok: true });
    expect(e.publishChannel("sam", pub.id, "printed_menu", "p3").ok).toBe(true);
    expect(siteStatus(e, MAIN).outstandingChannels).toBe(0);
    // publishing an already-published channel again is a no-op
    e.publishChannel("sam", pub.id, "printed_menu", "p4");
    expect(e.state.publications.find((p) => p.id === pub.id)!.channels.printed_menu.attempts).toBe(3);
  });

  it("an adapter that throws counts as a failure, not as success", () => {
    const { e, pub } = toRevision2();
    e.adapter = () => { throw new Error("boom"); };
    expect(e.publishChannel("sam", pub.id, "qr_web", "q").ok).toBe(false);
    expect(channelStatus(e.state, MAIN)[0]!.status).toBe("failed");
  });

  it("old printed copy: a printed menu showing revision 1 is reported stale once revision 2 exists", () => {
    const { e } = toRevision2();
    expect(checkCopy(e.state, MAIN, 1)).toBe("stale");
    expect(checkCopy(e.state, MAIN, 2)).toBe("current");
    expect(checkCopy(e.state, MAIN, 77)).toBe("unknown");
    const printed = channelStatus(e.state, MAIN).find((c) => c.channel === "printed_menu")!;
    expect(printed.status).not.toBe("current");
    expect(printed.text).toMatch(/OLD revision 1/);
  });

  it("older revisions are marked stale in the active/stale menu list; only the newest is active", () => {
    const { e, pub } = toRevision2();
    for (const ch of ["qr_web", "service_view", "printed_menu"] as Channel[]) e.publishChannel("sam", pub.id, ch, `x-${ch}`);
    const x = e.exportHistory("sam", MAIN);
    expect(x.menuVersions.map((m) => m.menuStatus)).toEqual(["ACTIVE (newest)", "STALE (replaced by a newer revision)"]);
  });

  it("publication cannot bypass a pending review: preparing is blocked, and a prepared revision goes stale when a review opens", () => {
    const { e, pub } = toRevision2();
    // a new unreviewed delivery arrives after revision 2 was prepared
    e.receiveDelivery("alex", { ...sauceDelivery(), barcode: "5010000100159", batchCode: "Z", deliveryNoteRef: "DN-Z", orderedProductId: "p-teriyaki" }, "late");
    expect(e.state.cases.some((c) => c.state === "review_required")).toBe(true);
    const v = e.state.version;
    expect(code(() => e.publishChannel("sam", pub.id, "qr_web", "q"))).toBe("stale_basis");
    expect(e.state.version).toBe(v);
    expect(code(() => e.preparePublication("sam", MAIN, "again"))).toBe("publish_blocked");
    expect(channelStatus(e.state, MAIN).find((c) => c.channel === "qr_web")!.liveRevision).toBe(1);
  });

  it("cannot publish a superseded revision (no downgrade) and prepare is idempotent", () => {
    const { e, pub } = toRevision2();
    expect(e.preparePublication("sam", MAIN, "prep-2").publication.id).toBe(pub.id);
    expect(e.preparePublication("sam", MAIN, "prep-3").publication.revision).toBe(3);
    expect(code(() => e.publishChannel("sam", pub.id, "qr_web", "q"))).toBe("superseded");
  });

  it("only publication approvers can prepare or publish", () => {
    const { e, pub } = toRevision2();
    expect(code(() => e.preparePublication("alex", MAIN, "z"))).toBe("forbidden");
    expect(code(() => e.publishChannel("jo", pub.id, "qr_web", "z"))).toBe("forbidden");
  });

  it("snapshots are immutable: approved publications, specifications and substitutions cannot be edited in place", () => {
    const { e, pub } = toRevision2();
    const stored = e.state.publications.find((p) => p.id === pub.id)!;
    expect(() => { (stored as any).revision = 99; }).toThrow();
    expect(() => { (stored.dishes[0] as any).resolved = false; }).toThrow();
    expect(() => { (stored.dishes[0]!.contains as any).push("fish"); }).toThrow();
    expect(() => { (e.state.specs[0]!.contains as any).milk = "not_declared"; }).toThrow();
    expect(() => { (e.state.substitutions[0] as any).specId = "x"; }).toThrow();
    expect(e.state.publications.find((p) => p.id === pub.id)!.revision).toBe(2);
  });
});

describe("service acknowledgement", () => {
  it("is bound to the exact revision, needs the service view to be updated, and is receipt only", () => {
    const { e, pub } = toRevision2();
    expect(code(() => e.acknowledge("jo", pub.id, 2))).toBe("validation"); // service view not updated yet
    e.publishChannel("sam", pub.id, "service_view", "s");
    expect(code(() => e.acknowledge("jo", pub.id, 1))).toBe("wrong_revision");
    const ack = e.acknowledge("jo", pub.id, 2);
    expect(ack.revision).toBe(2);
    expect(e.acknowledge("jo", pub.id, 2).id).toBe(ack.id); // idempotent
    expect(outstandingAcks(e.state, MAIN)).toMatchObject({ revision: 2, outstanding: ["jess"] });
    expect(siteStatus(e, MAIN).outstandingAcks).toBe(1);
  });

  it("acknowledging an out-of-date revision is refused even if the number matches that revision", () => {
    const { e, pub } = toRevision2();
    e.publishChannel("sam", pub.id, "service_view", "s");
    const rev1 = e.state.publications.find((p) => p.revision === 1 && p.siteId === MAIN)!;
    e.addStaff("morgan", { name: "New Waiter", grants: [{ role: "service_staff", siteId: MAIN }] });
    const waiter = e.state.staff.find((s) => s.name === "New Waiter")!.id;
    expect(code(() => e.acknowledge(waiter, rev1.id, 1))).toBe("superseded");
    expect(outstandingAcks(e.state, MAIN).acked).toEqual([]);
  });

  it("only service staff at the site can acknowledge", () => {
    const { e, pub } = toRevision2();
    e.publishChannel("sam", pub.id, "service_view", "s");
    expect(code(() => e.acknowledge("sam", pub.id, 2))).toBe("forbidden");
    expect(code(() => e.acknowledge("omar", pub.id, 2))).toBe("forbidden");
  });
});

describe("annex site is unaffected", () => {
  it("annex publication state does not change when the main kitchen publishes", () => {
    const { e, pub } = toRevision2();
    e.publishChannel("sam", pub.id, "qr_web", "q");
    expect(channelStatus(e.state, ANNEX).every((c) => c.liveRevision === 1 && c.status === "current")).toBe(true);
    void receiveSauce;
  });
});
