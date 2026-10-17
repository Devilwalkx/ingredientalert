import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, type TestInfo } from "@playwright/test";
import { mkdirSync } from "node:fs";

export const btn = (page: Page, name: string | RegExp, exact = true) => page.getByRole("button", { name, exact: typeof name === "string" ? exact : undefined });
/** Radio and checkbox style choices (products, roles, toggles). */
export const pick = (page: Page, name: string) => page.getByRole("radio", { name, exact: true }).or(page.getByRole("checkbox", { name, exact: true }));
export const tab = (page: Page, name: string) => page.getByRole("tab", { name: new RegExp(`^${name}`) });
export const field = (page: Page, label: string) => page.getByLabel(label, { exact: true });
const text = (page: Page, t: string | RegExp) => page.getByText(t, { exact: false }).first();
export { text };

/** Opens the app, checks it is THIS app (not another app on the port) and shows the first screen. */
export async function goto(page: Page, qs = "") {
  await page.goto("/" + qs);
  await expect(btn(page, "Try the example kitchen").or(page.getByRole("heading", { name: "Sign in" })).or(page.getByRole("tab").first())).toBeVisible();
}
/** Example kitchen, signed in as `who` (the example people have no PINs; that is labelled on screen). */
export async function example(page: Page, who = "Alex", qs = "") {
  await goto(page, qs);
  await btn(page, "Try the example kitchen").click();
  await btn(page, new RegExp(`^${who}`), false).click();
  await expect(page.getByRole("heading", { name: "Status now" })).toBeVisible();
}
/** The ordinary shared-device action: lock, then tap another name. */
export async function as(page: Page, who: string) {
  await btn(page, "Lock and switch person").click();
  await expect(page.getByText("Who is using the device?")).toBeVisible();
  await btn(page, new RegExp(`^${who}`), false).click();
  await expect(page.getByRole("heading", { name: "Status now" })).toBeVisible();
}
export async function home(page: Page) {
  await tab(page, "Home").click();
  await expect(page.getByRole("heading", { name: "Status now" })).toBeVisible();
}
export async function openSettings(page: Page) {
  if (!(await page.getByRole("button", { name: "Display" }).isVisible().catch(() => false))) await btn(page, "Settings").click();
  await expect(page.getByRole("button", { name: "Display" })).toBeVisible();
}
export async function demoTools(page: Page) {
  await openSettings(page);
  await btn(page, "Demonstration tools (example kitchen only)").click();
}
/** Closes a confirmation dialog if one is open (a modal left open blocks later clicks). */
export async function closeDialog(page: Page) {
  const no = btn(page, "No, go back");
  if (await no.isVisible().catch(() => false)) await no.click();
}

/** Layout audit: text inside its button, no overlapping interactive elements, no horizontal scroll, nothing truncated, 48 dp targets. */
export async function auditLayout(page: Page, where: string) {
  await page.waitForTimeout(250);
  const problems = await page.evaluate(() => {
    const out: string[] = [];
    const doc = document.documentElement;
    if (doc.scrollWidth - doc.clientWidth > 1) out.push(`horizontal scroll ${doc.scrollWidth - doc.clientWidth}px`);
    const sel = '[role="button"],[role="radio"],[role="checkbox"],[role="tab"],input,textarea,a[href]';
    const modal = document.querySelector('[aria-modal="true"]');
    const scope: ParentNode = modal ?? document;
    // Rectangle of an element after clipping by scrolling/overflow ancestors (content scrolled out of view is not "overlapping" anything).
    const clipped = (e: HTMLElement) => {
      let r = e.getBoundingClientRect();
      let a: HTMLElement | null = e.parentElement;
      while (a && a !== document.body) {
        const cs = getComputedStyle(a);
        if (/(auto|scroll|hidden|clip)/.test(cs.overflow + cs.overflowY + cs.overflowX)) {
          const b = a.getBoundingClientRect();
          r = new DOMRect(Math.max(r.left, b.left), Math.max(r.top, b.top), Math.max(0, Math.min(r.right, b.right) - Math.max(r.left, b.left)), Math.max(0, Math.min(r.bottom, b.bottom) - Math.max(r.top, b.top)));
        }
        a = a.parentElement;
      }
      return r;
    };
    const els = [...scope.querySelectorAll<HTMLElement>(sel)].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
    const label = (e: HTMLElement) => (e.getAttribute("aria-label") || e.innerText || e.tagName).slice(0, 40);
    for (const e of els) {
      const r = e.getBoundingClientRect();
      if (r.height < 48 - 0.5) out.push(`"${label(e)}" is only ${Math.round(r.height)}px tall`);
      if (r.width < 44 - 0.5 && e.getAttribute("role") !== "checkbox") out.push(`"${label(e)}" is only ${Math.round(r.width)}px wide`);
      if (r.right > window.innerWidth + 1 || r.left < -1) out.push(`"${label(e)}" sticks out of the screen`);
      const role = e.getAttribute("role");
      if (role === "button" || role === "radio" || role === "checkbox" || role === "tab") {
        const walker = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
        let n: Node | null;
        while ((n = walker.nextNode())) {
          if (!n.textContent?.trim()) continue;
          const range = document.createRange();
          range.selectNodeContents(n);
          for (const q of range.getClientRects()) {
            if (q.left < r.left - 1 || q.right > r.right + 1 || q.top < r.top - 1 || q.bottom > r.bottom + 1) out.push(`text of "${label(e)}" spills outside its button`);
          }
        }
      }
    }
    for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
      const a = els[i]!, b = els[j]!;
      if (a.contains(b) || b.contains(a)) continue;
      const x = clipped(a), y = clipped(b);
      const w = Math.min(x.right, y.right) - Math.max(x.left, y.left);
      const h = Math.min(x.bottom, y.bottom) - Math.max(x.top, y.top);
      if (w > 1 && h > 1) out.push(`"${label(a)}" overlaps "${label(b)}"`);
    }
    return [...new Set(out)];
  });
  expect(problems, `layout problems on ${where}`).toEqual([]);
}


export async function axeCheck(page: Page, label: string) {
  await page.waitForTimeout(350); // let the screen's fade-in finish: contrast is measured on the settled screen
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length}) ${v.nodes[0]?.html.slice(0, 140)}`), `axe on "${label}"`).toEqual([]);
}

export async function shot(page: Page, info: TestInfo, label: string) {
  if (!process.env.SHOTS) return;
  const dir = process.env.SHOTS;
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/${label.replace(/[^a-z0-9]+/gi, "_")}-${info.project.name === "android-phone" ? "pixel7" : info.project.name === "small-phone" ? "small320" : info.project.name}${process.env.SHOT_TAG ?? ""}.png` });
}

/**
 * The whole sauce demo, one screen state at a time. `check` runs on every state (accessibility, layout, screenshots),
 * so the same walk serves every sweep. People switch the ordinary way: lock, then tap a name.
 */
export async function tour(page: Page, check: (label: string) => Promise<void>) {
  await expect(btn(page, "Try the example kitchen")).toBeVisible();
  await check("1-first-run");
  await btn(page, "Try the example kitchen").click();
  await expect(page.getByText("Who is using the device?")).toBeVisible();
  await check("lock");
  await btn(page, /^Alex/, false).click();
  await expect(page.getByRole("heading", { name: "Status now" })).toBeVisible();
  await check("2-main-screen");

  await btn(page, "Check a delivery", false).first().click();
  await expect(page.getByText("Step 1 of 3: what did you order?")).toBeVisible();
  await check("order-step");
  await demoTools(page);
  await check("settings-demo");
  await btn(page, "Fill in the replacement-sauce delivery").click();
  await expect(page.getByText("What is on the pack?").first()).toBeVisible();
  await check("3-delivery-form");
  await btn(page, "Scan the barcode").click();
  await expect(page.getByText("Camera scanning is not available here")).toBeVisible();
  await check("scan-unavailable");
  await btn(page, "Type the number or search instead").click();
  await btn(page, "Next: check and save").click();
  await check("check-step");
  await btn(page, "Save and check this delivery").click();
  await expect(page.getByText("Ordered and arrived, side by side")).toBeVisible();
  await check("4-delivery-result");

  await btn(page, "Review this substitution").click();
  await expect(page.getByText("This step is for the Specification reviewer.")).toBeVisible();
  await check("5-review-side");
  await as(page, "Priya");
  await demoTools(page);
  await btn(page, "Fill in the supplier sheet for the new sauce").click();
  await btn(page, /^Open review/, false).click();
  await expect(page.getByText("Step 1 of 3: enter the supplier's specification")).toBeVisible();
  await check("spec-form");
  await btn(page, /^Allergens \(/, false).click();
  await check("spec-form-allergens");
  await btn(page, "Save specification").click();
  await expect(page.getByText("Step 2 of 3: which recipes change?")).toBeVisible();
  await check("impact-step");
  await btn(page, "Show which recipes change").click();
  await expect(page.getByText("Recipes that change (3)")).toBeVisible();
  await check("impact");
  await page.getByRole("button", { name: /^Allergens after the change: Glazed salmon bowl/ }).click();
  await check("impact-allergens");

  await as(page, "Sam");
  await tab(page, "Review").click();
  await btn(page, /^Open review/, false).click();
  await expect(page.getByText("Step 3 of 3: decide")).toBeVisible();
  await check("decide");
  await btn(page, "Approve this change").click();
  await expect(page.getByRole("heading", { name: "Approve this change?" })).toBeVisible();
  await check("6-approve-confirm");
  await btn(page, "Yes, approve").click();
  await expect(page.getByText("Approved revision").first()).toBeVisible();
  await check("approved");

  await tab(page, "Updates").click();
  await expect(page.getByText("Step 1 of 2: make revision 2")).toBeVisible();
  await check("publish-prepare");
  await btn(page, "Prepare revision 2").click();
  await check("confirm-prepare");
  await btn(page, "Yes, prepare revision 2").click();
  await expect(page.getByText("Step 2 of 2: update each place (revision 2)")).toBeVisible();
  await check("publish-channels");
  await btn(page, "Update QR / web menu").click();
  await btn(page, "Yes, update QR / web menu").click();
  await btn(page, "Update Service view (staff)").click();
  await btn(page, "Yes, update Service view (staff)").click();
  await btn(page, "Replace printed menus").click();
  await check("confirm-printed");
  await btn(page, "Yes, update Printed menu").click();
  await expect(page.getByText("Update failed: still the old menu")).toBeVisible();
  await check("publish-failed");
  await btn(page, "History and details").click();
  await check("publish-details");

  await home(page);
  await check("home-status");
  await as(page, "Jo");
  await btn(page, "Menu for service and acknowledgement").click();
  await expect(page.getByRole("heading", { name: "Have you seen this?" })).toBeVisible();
  await check("service");
  await btn(page, "I have seen revision 2").click();
  await check("confirm-ack");
  await btn(page, "Yes, I have seen it").click();
  await expect(page.getByText("You acknowledged revision 2")).toBeVisible();
  await field(page, "Revision number on the printed copy").fill("1");
  await btn(page, "Check this copy").click();
  await expect(page.getByText("OUT OF DATE: replace this copy")).toBeVisible();
  await check("service-acked");

  await as(page, "Morgan");
  await openSettings(page);
  for (const t of ["Shared device: lock and sign-in", "Kitchen setup: people, products, recipes", "Manager tools", "Privacy and your data", "About this build"]) await btn(page, t).click();
  await check("settings-open");
}
