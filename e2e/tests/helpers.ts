import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, type TestInfo } from "@playwright/test";
import { mkdirSync } from "node:fs";

const HOME_TITLES = ["A delivery has arrived", "Check a change", "Publish menu updates", "Menu for service", "Settings and privacy"];
/** Home buttons carry a second line of text, so match them by their title prefix. */
export const btn = (page: Page, name: string | RegExp, exact = true) =>
  typeof name === "string" && HOME_TITLES.includes(name)
    ? page.getByRole("button", { name: new RegExp(`^${name}( |$)`) })
    : page.getByRole("button", { name, exact: typeof name === "string" ? exact : undefined });

export async function start(page: Page, query = "") {
  await page.goto("/" + query);
  await expect(btn(page, "Start with the example kitchen")).toBeVisible();
  await btn(page, "Start with the example kitchen").click();
  await expect(page.getByRole("heading", { name: "To do", exact: true })).toBeVisible();
}
export async function home(page: Page) {
  await btn(page, "‹ Back to home").click();
  await expect(page.getByRole("heading", { name: "To do", exact: true })).toBeVisible();
}
export async function demo(page: Page) {
  await btn(page, "Demo options").click();
  await expect(page.getByRole("heading", { name: "Who are you?" })).toBeVisible();
}
export async function as(page: Page, who: string) {
  await demo(page);
  await page.getByRole("button", { name: new RegExp(`^${who} - `) }).click();
  await home(page);
}

/** Layout rules that must hold at every screen, at any text size. */
export async function layoutCheck(page: Page, label: string) {
  const res = await page.evaluate(() => {
    const out: string[] = [];
    const de = document.documentElement;
    if (de.scrollWidth - de.clientWidth > 1) out.push(`horizontal scroll: ${de.scrollWidth} > ${de.clientWidth}`);
    const vis = (el: Element) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const els = [...document.querySelectorAll<HTMLElement>('[role="button"], input, textarea, a[href]')].filter(vis);
    // text must stay inside its button
    for (const el of els) {
      const box = el.getBoundingClientRect();
      const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") continue;
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        if (!n.textContent?.trim()) continue;
        const r = document.createRange();
        r.selectNodeContents(n);
        const t = r.getBoundingClientRect();
        if (t.left < box.left - 1 || t.right > box.right + 1 || t.top < box.top - 1 || t.bottom > box.bottom + 1)
          out.push(`text overflows its box: "${(n.textContent ?? "").trim().slice(0, 40)}"`);
      }
      if (el.getAttribute("role") === "button" && box.height < 44) out.push(`target too short (${Math.round(box.height)}px): "${(el.innerText || "").slice(0, 30)}"`);
    }
    // interactive elements must not overlap each other
    const rects = els.map((el) => ({ el, r: el.getBoundingClientRect() }));
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i]!.r, b = rects[j]!.r;
        if (rects[i]!.el.contains(rects[j]!.el) || rects[j]!.el.contains(rects[i]!.el)) continue;
        const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (ox > 1 && oy > 1) out.push(`overlap: "${(rects[i]!.el.innerText || rects[i]!.el.getAttribute("aria-label") || "").slice(0, 30)}" and "${(rects[j]!.el.innerText || rects[j]!.el.getAttribute("aria-label") || "").slice(0, 30)}"`);
      }
    }
    return out;
  });
  expect(res, `layout problems on "${label}"`).toEqual([]);
}

export async function axeCheck(page: Page, label: string) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length}) ${v.nodes[0]?.html.slice(0, 120)}`), `axe on "${label}"`).toEqual([]);
}

export async function shot(page: Page, info: TestInfo, label: string) {
  if (!process.env.SHOTS) return;
  const dir = process.env.SHOTS;
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/${info.project.name}-${process.env.SHOT_TAG ?? "n"}-${label.replace(/[^a-z0-9]+/gi, "_")}.png`, fullPage: false });
}

/**
 * Walks through the whole app (sauce demo) and calls `check` on every screen state.
 * It is the single source for the accessibility, layout and large-text tests.
 */
export async function tour(page: Page, check: (label: string) => Promise<void>) {
  await expect(btn(page, "Start with the example kitchen")).toBeVisible();
  await check("welcome");
  await btn(page, "Start with the example kitchen").click();
  await expect(page.getByRole("heading", { name: "To do", exact: true })).toBeVisible();
  await check("home");

  await btn(page, "A delivery has arrived").click();
  await expect(page.getByText("Step 1 of 3: What did you order?")).toBeVisible();
  await check("receive-step1");
  await home(page);

  await demo(page);
  await check("demo");
  await btn(page, "Fill in the replacement-sauce delivery").click();
  await expect(page.getByText("Step 2 of 3: What is on the pack?")).toBeVisible();
  await check("receive-step2");
  await btn(page, "Next: check and save").click();
  await check("receive-step3");
  await btn(page, "Save and check this delivery").click();
  await expect(page.getByText("Needs checking").first()).toBeVisible();
  await check("receive-result");

  await btn(page, "Go to Check a change").click();
  await check("review-list");
  await btn(page, "Open Harbour Teriyaki Sauce 1L review").click();
  await expect(page.getByText("This step is for Specification reviewer.")).toBeVisible();
  await check("review-needs-reviewer");

  await home(page);
  await demo(page);
  await btn(page, "Fill in the supplier sheet for the new sauce").click();
  await btn(page, "Open Harbour Teriyaki Sauce 1L review").click();
  await expect(page.getByText("Step 1 of 3: Check the paperwork")).toBeVisible();
  await check("review-form");
  await page.getByRole("button", { name: /^Allergens \(/ }).click();
  await check("review-form-allergens");
  await btn(page, "Save paperwork check").click();
  await expect(page.getByText("Step 2 of 3: Which recipes change?")).toBeVisible();
  await check("review-step2");
  await btn(page, "Show which recipes change").click();
  await expect(page.getByText("Recipes that change (3)")).toBeVisible();
  await check("review-impact");
  await page.getByRole("button", { name: "Allergens after the change" }).first().click();
  await check("review-impact-allergens");

  await page.getByRole("button", { name: "Switch to Sam (demo)" }).click();
  await expect(page.getByText("Step 3 of 3: Approve")).toBeVisible();
  await check("review-approve");
  await btn(page, "Approve this change").click();
  await expect(page.getByRole("heading", { name: "Approve this change?" })).toBeVisible();
  await check("confirm-approve");
  await btn(page, "Yes, approve").click();
  await expect(page.getByText("Approved by Sam")).toBeVisible();
  await check("review-approved");

  await btn(page, "Go to Publish menu updates").click();
  await expect(page.getByText("Step 1 of 2: Make revision 2")).toBeVisible();
  await check("publish-prepare");
  await btn(page, "Prepare revision 2").click();
  await check("confirm-prepare");
  await btn(page, "Yes, prepare revision 2").click();
  await expect(page.getByText("Step 2 of 2: Update each place (revision 2)")).toBeVisible();
  await check("publish-channels");
  await btn(page, "Update QR / web menu").click();
  await btn(page, "Yes, update QR / web menu").click();
  await btn(page, "Update Service view (staff)").click();
  await btn(page, "Yes, update Service view (staff)").click();
  await btn(page, "Replace printed menus").click();
  await check("confirm-printed");
  await btn(page, "Yes, update Printed menu").click();
  await expect(page.getByText("Update failed - still the old menu")).toBeVisible();
  await check("publish-failed");
  await page.getByRole("button", { name: "Details" }).click();
  await check("publish-details");

  await home(page);
  await check("home-todo");
  await as(page, "Jo");
  await btn(page, "Menu for service").click();
  await expect(page.getByRole("heading", { name: "Have you seen this?" })).toBeVisible();
  await check("service");
  await btn(page, "I have seen revision 2").click();
  await check("confirm-ack");
  await btn(page, "Yes, I have seen it").click();
  await expect(page.getByText("You acknowledged revision 2")).toBeVisible();
  await page.getByLabel("Revision number on the printed copy").fill("1");
  await btn(page, "Check this copy").click();
  await expect(page.getByText("OUT OF DATE - replace this copy")).toBeVisible();
  await check("service-acked");

  await home(page);
  await as(page, "Morgan");
  await btn(page, "Settings and privacy").click();
  await check("settings");
  for (const t of ["Privacy and your data", "Who can do what", "Manager tools"]) await btn(page, t).click();
  await check("settings-open");
  for (const t of ["Kitchen controls", "Small-team exception", "People", "History for review"]) await btn(page, t).click();
  await btn(page, "Show history").click();
  await expect(page.getByLabel("History export")).toBeVisible();
  await check("settings-manager");
  await home(page);
  await btn(page, "About this app").click();
  await check("about");
}
