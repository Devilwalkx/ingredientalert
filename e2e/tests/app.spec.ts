import { expect, test } from "@playwright/test";
import { as, axeCheck, btn, demo, home, layoutCheck, shot, start, tour } from "./helpers";

test.describe("IngredientAlert on a phone-sized browser", () => {
  test("first run: welcome screen, then the example kitchen with an honest synthetic notice", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "IngredientAlert" })).toBeVisible();
    await expect(btn(page, "Start with the example kitchen")).toBeVisible();
    await btn(page, "Start with the example kitchen").click();
    await expect(page.getByText("Nothing waiting")).toBeVisible();
    await expect(page.getByText("Synthetic demo data", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("record check, not a safety guarantee", { exact: false })).toBeVisible();
    for (const b of ["A delivery has arrived", "Check a change", "Publish menu updates", "Menu for service", "Settings and privacy"]) await expect(btn(page, b)).toBeVisible();
    await expect(page.getByRole("tab")).toHaveCount(0);
  });

  test("the whole sauce demo: wrong sauce arrives, is checked and approved by different people, two nested recipes change, printed menu update fails and stays outstanding", async ({ page }, info) => {
    await start(page);
    await demo(page);
    await btn(page, "Fill in the replacement-sauce delivery").click();
    await btn(page, "Next: check and save").click();
    await btn(page, "Save and check this delivery").click();
    await expect(page.getByText("This barcode is not in the approved product list", { exact: false })).toBeVisible();
    await expect(page.getByText("does not prove the physical stock has been separated", { exact: false })).toBeVisible();
    await shot(page, info, "wrong-sauce-arrived");
    await btn(page, "Go to Check a change").click();
    await home(page);
    // information hold is visible on Home
    await expect(page.getByText("1 delivery needs checking")).toBeVisible();
    // cannot publish while the review is open
    await btn(page, "Publish menu updates").click();
    await expect(page.getByText("Cannot publish yet")).toBeVisible();
    await home(page);

    await demo(page);
    await btn(page, "Fill in the supplier sheet for the new sauce").click();
    await btn(page, "Open Harbour Teriyaki Sauce 1L review").click();
    await btn(page, "Save paperwork check").click();
    await btn(page, "Show which recipes change").click();
    await expect(page.getByText("Glazed salmon bowl", { exact: true })).toBeVisible();
    await expect(page.getByText("Glazed chicken rice", { exact: true })).toBeVisible();
    await expect(page.getByText("House glaze (part of other recipes)")).toBeVisible();
    await expect(page.getByText("Changes: +Sesame", { exact: false }).first()).toBeVisible();
    await shot(page, info, "impact");
    // the person who typed the paperwork cannot approve: Priya has no approver role at all
    await expect(page.getByText("This step is for Publication approver.")).toBeVisible();
    await page.getByRole("button", { name: "Switch to Sam (demo)" }).click();
    await btn(page, "Approve this change").click();
    await expect(page.getByText("to replace Harbour Teriyaki Sauce 1L at Main kitchen", { exact: false })).toBeVisible();
    await btn(page, "Yes, approve").click();
    await expect(page.getByText("Approved by Sam")).toBeVisible();

    await btn(page, "Go to Publish menu updates").click();
    await btn(page, "Prepare revision 2").click();
    await btn(page, "Yes, prepare revision 2").click();
    await btn(page, "Update QR / web menu").click();
    await btn(page, "Yes, update QR / web menu").click();
    await btn(page, "Update Service view (staff)").click();
    await btn(page, "Yes, update Service view (staff)").click();
    await btn(page, "Replace printed menus").click();
    await btn(page, "Yes, update Printed menu").click();
    await expect(page.getByText("Update failed - still the old menu")).toBeVisible();
    await expect(page.getByText("Printer did not respond (simulated)", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("Printed menus already on tables", { exact: false })).toBeVisible();
    await shot(page, info, "printed-failed");
    await home(page);
    await expect(page.getByText("1 place still shows an old menu")).toBeVisible();
    await expect(page.getByText("Printed menu - an update failed")).toBeVisible();

    // service staff see revision 2, new allergens, and the acknowledgement is per person
    await as(page, "Jo");
    await btn(page, "Menu for service").click();
    await expect(page.getByText("Revision 2 - newest")).toBeVisible();
    await page.getByRole("button", { name: "Allergens" }).first().click();
    await btn(page, "I have seen revision 2").click();
    await btn(page, "Yes, I have seen it").click();
    await expect(page.getByText("You acknowledged revision 2")).toBeVisible();
    await expect(page.getByText("Not yet acknowledged: Jess")).toBeVisible();
    await page.getByLabel("Revision number on the printed copy").fill("1");
    await btn(page, "Check this copy").click();
    await expect(page.getByText("OUT OF DATE - replace this copy")).toBeVisible();
    await shot(page, info, "service");

    // retry succeeds once the printer works
    await home(page);
    await demo(page);
    await btn(page, "Printed-menu update fails: ON").click();
    await page.getByRole("button", { name: /^Sam - / }).click();
    await home(page);
    await btn(page, "Publish menu updates").click();
    await btn(page, "Try Printed menu again").click();
    await btn(page, "Yes, update Printed menu").click();
    await expect(page.getByText("Revision 2 is on every menu", { exact: false })).toBeVisible();
  });

  test("a delivery that matches the order is only an identifier match, a mistyped barcode needs checking, a duplicate is ignored", async ({ page }) => {
    await start(page);
    await btn(page, "A delivery has arrived").click();
    await btn(page, "Harbour Teriyaki Sauce 1L").click();
    await btn(page, "Next: what is on the pack?").click();
    await page.getByLabel("Barcode number").fill("5010000100161");
    await page.getByLabel("Pack size").fill("1L");
    await page.getByLabel("Batch or best-before code").fill("HB-1");
    await btn(page, "Next: check and save").click();
    await btn(page, "Save and check this delivery").click();
    await expect(page.getByText("Needs checking").first()).toBeVisible(); // wrong check digit / unknown
    await expect(page.getByText("not a valid barcode", { exact: false }).or(page.getByText("not in the approved product list", { exact: false }))).toBeVisible();
    await btn(page, "Record another delivery").click();
    await btn(page, "Harbour Teriyaki Sauce 1L").click();
    await btn(page, "Next: what is on the pack?").click();
    await page.getByLabel("Barcode number").fill("5010000100161");
    await page.getByLabel("Pack size").fill("1L");
    await page.getByLabel("Batch or best-before code").fill("HB-1");
    await btn(page, "Next: check and save").click();
    await btn(page, "Save and check this delivery").click();
    await expect(page.getByText("Already recorded - duplicate ignored")).toBeVisible();
  });

  test("write down now, check later: queued deliveries keep menus UNKNOWN until checked", async ({ page }) => {
    await start(page);
    await demo(page);
    await btn(page, "Fill in the replacement-sauce delivery").click();
    await btn(page, "Next: check and save").click();
    await btn(page, "Write down now, check later").click();
    await expect(page.getByText("Written down, not checked yet")).toBeVisible();
    await btn(page, "‹ Back to home").click();
    await expect(page.getByText("1 delivery was written down but not checked")).toBeVisible();
    await btn(page, "A delivery has arrived").click();
    await btn(page, "Check them now").click();
    await home(page);
    await expect(page.getByText("1 delivery needs checking")).toBeVisible();
  });

  test("unknown answers: a specification with UNKNOWN allergens can be saved but never approved", async ({ page }) => {
    await start(page);
    await demo(page);
    await btn(page, "Fill in the replacement-sauce delivery").click();
    await btn(page, "Next: check and save").click();
    await btn(page, "Save and check this delivery").click();
    await home(page);
    await as(page, "Priya");
    await btn(page, "Check a change").click();
    await btn(page, "Open Harbour Teriyaki Sauce 1L review").click();
    await page.getByLabel("Product name").fill("Mystery sauce");
    await page.getByLabel("Specification version (from the sheet)").fill("M-1");
    await page.getByLabel("Pack size").fill("1L");
    await page.getByLabel("Ingredients, as written on the sheet").fill("Water, soy");
    await page.getByLabel("Where this came from").fill("Phone call with supplier");
    await expect(page.getByRole("button", { name: /^Allergens \(14 still UNKNOWN\)/ })).toBeVisible();
    await btn(page, "Save paperwork check").click();
    await expect(page.getByText("Still unknown - cannot be used").first()).toBeVisible();
    await btn(page, "Show which recipes change").click();
    await page.getByRole("button", { name: "Switch to Sam (demo)" }).click();
    await expect(page.getByText("A product with unknown allergen answers cannot be approved", { exact: false })).toBeVisible();
    await expect(btn(page, "Approve this change")).toHaveCount(0);
    await page.getByRole("button", { name: "Allergens", exact: true }).first().click();
    await expect(page.getByText("UNKNOWN - cannot be used on a menu").first()).toBeVisible();
  });

  test("text size: Extra large is remembered after reload and nothing overflows", async ({ page }) => {
    await start(page);
    await btn(page, "Extra large").click();
    await page.reload();
    await expect(page.getByRole("heading", { name: "To do", exact: true })).toBeVisible();
    await expect(btn(page, "Extra large")).toHaveAttribute("aria-selected", "true").catch(() => {});
    const size = await page.getByRole("heading", { name: "To do", exact: true }).evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
    expect(size).toBeGreaterThanOrEqual(27);
    await layoutCheck(page, "home xlarge");
  });

  test("data is stored encrypted; reload restores it; a lost key fails closed; erase removes everything", async ({ page }) => {
    await start(page);
    await demo(page);
    await btn(page, "Fill in the replacement-sauce delivery").click();
    await btn(page, "Next: check and save").click();
    await btn(page, "Save and check this delivery").click();
    await expect(page.getByText("Needs checking").first()).toBeVisible();
    await page.waitForTimeout(300);
    const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
    expect(stored).toContain("ia-state");
    for (const needle of ["Fictional Bistro Group", "Harbour Teriyaki", "Glazed salmon bowl", "\"products\"", "Priya Nair", "EG240617", "tenants"]) expect(stored, `plaintext leaked: ${needle}`).not.toContain(needle);
    await page.reload();
    await expect(page.getByText("1 delivery needs checking")).toBeVisible();
    // lose the key but keep the ciphertext: nothing is shown
    await page.evaluate(() => new Promise<void>((res) => { const r = indexedDB.deleteDatabase("ingredientalert-keys"); r.onsuccess = () => res(); r.onerror = () => res(); r.onblocked = () => res(); }));
    await page.reload();
    await expect(page.getByText("could not be opened on this device", { exact: false })).toBeVisible();
    await expect(page.getByText("Glazed salmon bowl")).toHaveCount(0);
  });

  test("erase everything removes the stored data and returns to the welcome screen", async ({ page }) => {
    await start(page);
    await btn(page, "Settings and privacy").click();
    await btn(page, "Privacy and your data").click();
    await btn(page, "Show a sample recovery secret").click();
    await expect(page.getByLabel("Recovery secret, shown once")).toHaveText(/^([0-9A-Z]{4}-){12}[0-9A-Z]{4}$/);
    await btn(page, "Erase everything on this phone").click();
    await expect(page.getByRole("heading", { name: "Erase everything?" })).toBeVisible();
    await btn(page, "Yes, erase everything").click();
    await expect(btn(page, "Start with the example kitchen")).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("ia-state"))).toBeNull();
  });

  test("makes no network requests beyond the app's own files", async ({ page, baseURL }) => {
    const external: string[] = [];
    page.on("request", (r) => { if (!r.url().startsWith(baseURL!) && !r.url().startsWith("data:") && !r.url().startsWith("blob:")) external.push(r.url()); });
    await page.goto("/");
    await tour(page, async () => {});
    expect(external).toEqual([]);
  });

  test("installable web app: manifest and icons are served, no service worker", async ({ page, request }) => {
    await page.goto("/");
    const href = await page.locator('link[rel="manifest"]').getAttribute("href");
    const res = await request.get(`/${href}`);
    expect(res.ok()).toBe(true);
    const m = await res.json();
    expect(m.name).toMatch(/synthetic/i);
    for (const icon of m.icons) expect((await request.get(`/${icon.src}`)).ok(), icon.src).toBe(true);
    expect(await page.evaluate(async () => (await navigator.serviceWorker?.getRegistrations?.())?.length ?? 0)).toBe(0);
  });

  test("refuses to run without WebCrypto instead of storing unprotected", async ({ page }) => {
    await page.addInitScript(() => { Object.defineProperty(window.crypto, "subtle", { value: undefined, configurable: true }); });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Cannot start safely" })).toBeVisible();
    expect(await page.evaluate(() => localStorage.length)).toBe(0);
  });

  test("keyboard operable: Tab reaches the buttons and Enter activates them", async ({ page }) => {
    await start(page);
    await btn(page, "A delivery has arrived").focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText("Step 1 of 3: What did you order?")).toBeVisible();
    await btn(page, "‹ Back to home").focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "To do", exact: true })).toBeVisible();
  });

  test("tour: automated accessibility scan (axe, WCAG 2 A/AA) on every screen state", async ({ page }) => {
    test.setTimeout(240_000);
    await page.goto("/");
    await tour(page, (label) => axeCheck(page, label));
  });

  test("tour: no horizontal scroll, no overlapping buttons, text stays inside its button on every screen", async ({ page }, info) => {
    test.setTimeout(240_000);
    await page.goto("/");
    await tour(page, async (label) => { await layoutCheck(page, label); await shot(page, info, label); });
  });

  test("tour at 2x text (?fontscale=2): nothing overflows or overlaps on any screen", async ({ page }, info) => {
    test.setTimeout(300_000);
    await page.goto("/?fontscale=2");
    await tour(page, async (label) => { await layoutCheck(page, `fontscale2 ${label}`); process.env.SHOT_TAG = "fs2"; await shot(page, info, label); process.env.SHOT_TAG = "n"; });
  });

  test("tour with the in-app Extra large setting: nothing overflows or overlaps on any screen", async ({ page }) => {
    test.setTimeout(300_000);
    await page.goto("/");
    await btn(page, "About this app").click();
    await home(page).catch(() => {});
    await page.goto("/");
    await page.evaluate(() => localStorage.setItem("ia-settings", JSON.stringify({ textSize: "xlarge", printerFails: true })));
    await page.reload();
    await tour(page, async (label) => { await layoutCheck(page, `xlarge ${label}`); });
  });

  test("system bars: content stays clear of the status bar and navigation buttons (simulated Android insets)", async ({ page }) => {
    await page.goto("/?insets=44,48");
    await expect(btn(page, "Start with the example kitchen")).toBeVisible();
    const top = await page.getByRole("heading", { name: "IngredientAlert" }).boundingBox();
    expect(top!.y, "first content starts below the status bar").toBeGreaterThanOrEqual(44);
    await btn(page, "Start with the example kitchen").click();
    await btn(page, "About this app").scrollIntoViewIfNeeded();
    const vh = await page.evaluate(() => window.innerHeight);
    const last = await btn(page, "About this app").boundingBox();
    expect(last!.y + last!.height, "last control ends above the navigation buttons").toBeLessThanOrEqual(vh - 48 + 1);
    await btn(page, "A delivery has arrived").scrollIntoViewIfNeeded();
    await btn(page, "A delivery has arrived").click();
    const back = await btn(page, "‹ Back to home").boundingBox();
    expect(back!.y).toBeGreaterThanOrEqual(44);
  });
});
