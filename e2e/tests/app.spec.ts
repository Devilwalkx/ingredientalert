import { expect, test, type Page } from "@playwright/test";
import { as, auditLayout, axeCheck, btn, demoTools, example, field, goto, home, openSettings, pick, shot, tab, text, tour } from "./helpers";

const VALID_EAN = "4006381333931";

/** From the home screen: record the replacement-sauce delivery with the demo helper and save it. */
async function sauceDelivery(page: Page) {
  await btn(page, "Check a delivery", false).first().click();
  await demoTools(page);
  await btn(page, "Fill in the replacement-sauce delivery").click();
  await btn(page, "Next: check and save").click();
  await btn(page, "Save and check this delivery").click();
  await expect(text(page, "Ordered and arrived, side by side")).toBeVisible();
}

test.describe("IngredientAlert on a phone-sized browser", () => {
  test("this is IngredientAlert (guards against another app answering on the port)", async ({ page, request }) => {
    const html = await (await request.get("/")).text();
    expect(html).toContain('name="application-id" content="app.devilwalkx.ingredientalert"');
    await goto(page);
    await expect(page).toHaveTitle(/IngredientAlert/);
  });

  test("first run: one clear start for a real kitchen, a labelled example, no role switcher, no tabs, no demo banner", async ({ page }) => {
    await goto(page);
    await expect(btn(page, "Set up my kitchen")).toBeVisible();
    await expect(btn(page, "Try the example kitchen")).toBeVisible();
    await expect(page.getByRole("tab")).toHaveCount(0);
    await expect(text(page, "Demo options")).toHaveCount(0);
    await expect(text(page, "Example kitchen:")).toHaveCount(0);
  });

  test("example kitchen: people sign in by name, the example is labelled everywhere, demo tools exist only inside the example's Settings", async ({ page }) => {
    await example(page, "Alex");
    await expect(text(page, "Example kitchen: made-up products")).toBeVisible();
    await expect(text(page, "Demonstration tools")).toHaveCount(0);
    await expect(text(page, "Demo options")).toHaveCount(0);
    await openSettings(page);
    await expect(btn(page, "Demonstration tools (example kitchen only)")).toBeVisible();
    await btn(page, "Demonstration tools (example kitchen only)").click();
    await expect(text(page, "Demonstration only.")).toBeVisible();
  });

  test("R1 home: the three tasks, counts only when real", async ({ page }) => {
    await example(page);
    for (const t of ["Check a delivery", "Review substitutions", "Outstanding decisions and publication updates"]) await expect(btn(page, t, false).first()).toBeVisible();
    await expect(text(page, "Nothing waiting for review")).toBeVisible();
    await expect(text(page, "Nothing outstanding to publish or confirm")).toBeVisible();
    await expect(page.getByTestId("task-review")).not.toContainText(/\d/);
    await sauceDelivery(page);
    await home(page);
    await expect(page.getByTestId("task-review")).toContainText("1 waiting");
    await expect(page.getByRole("tab", { name: /^Review/ })).toHaveAttribute("aria-description", /1 outstanding/).catch(() => undefined);
  });

  test("the whole sauce demo: wrong sauce arrives, is entered and approved by different people, two nested recipes change, printed menu update fails and stays outstanding", async ({ page }, info) => {
    await example(page);
    await sauceDelivery(page);
    await expect(text(page, "This barcode is not in the approved product list")).toBeVisible();
    await expect(text(page, "does not prove the physical stock has been separated")).toBeVisible();
    await shot(page, info, "wrong-sauce-arrived");
    await home(page);
    await expect(text(page, "Awaiting specification").first()).toBeVisible();
    await tab(page, "Updates").click();
    await expect(text(page, "not decided")).toBeVisible();

    await as(page, "Priya");
    await demoTools(page);
    await btn(page, "Fill in the supplier sheet for the new sauce").click();
    await btn(page, /^Open review/, false).click();
    await btn(page, "Save specification").click();
    await expect(text(page, "Awaiting review").first()).toBeVisible();
    await btn(page, "Show which recipes change").click();
    await expect(text(page, "Glazed salmon bowl").first()).toBeVisible();
    await expect(text(page, "Glazed chicken rice").first()).toBeVisible();
    await expect(text(page, "House glaze (used inside other recipes)").first()).toBeVisible();
    await expect(text(page, "now contains Sesame").first()).toBeVisible();
    await shot(page, info, "impact");
    await expect(text(page, "This step is for the Publication approver.")).toBeVisible();

    await as(page, "Sam");
    await tab(page, "Review").click();
    await btn(page, /^Open review/, false).click();
    await btn(page, "Approve this change").click();
    await expect(text(page, "to replace Harbour Teriyaki Sauce 1L at Main kitchen")).toBeVisible();
    await btn(page, "Yes, approve").click();
    await expect(text(page, "Approved revision").first()).toBeVisible();

    await btn(page, "Go to publication updates").click();
    await btn(page, "Prepare revision 2").click();
    await btn(page, "Yes, prepare revision 2").click();
    await btn(page, "Update QR / web menu").click();
    await expect(text(page, "There is no server")).toBeVisible();
    await btn(page, "Yes, update QR / web menu").click();
    await btn(page, "Update Service view (staff)").click();
    await btn(page, "Yes, update Service view (staff)").click();
    await btn(page, "Replace printed menus").click();
    await btn(page, "Yes, update Printed menu").click();
    await expect(text(page, "Update failed: still the old menu")).toBeVisible();
    await expect(text(page, "Printer did not respond (simulated)")).toBeVisible();
    await expect(text(page, "Printed menus already on tables")).toBeVisible();
    await expect(text(page, "Publication incomplete").first()).toBeVisible();
    await shot(page, info, "printed-failed");
    await home(page);
    await expect(text(page, "Publication incomplete").first()).toBeVisible();

    // acknowledgement is per person and is not a notification
    await as(page, "Jo");
    await btn(page, "Menu for service and acknowledgement").click();
    await expect(text(page, "Revision 2: newest")).toBeVisible();
    await btn(page, "I have seen revision 2").click();
    await btn(page, "Yes, I have seen it").click();
    await expect(text(page, "You acknowledged revision 2")).toBeVisible();
    await expect(text(page, "Not yet confirmed: Jess")).toBeVisible();
    await expect(text(page, "Staff acknowledgement outstanding").first()).toBeVisible();
    await expect(text(page, "sends no notifications")).toBeVisible();
    await field(page, "Revision number on the printed copy").fill("1");
    await btn(page, "Check this copy").click();
    await expect(text(page, "OUT OF DATE: replace this copy")).toBeVisible();
    await shot(page, info, "service");

    // retry succeeds once the (simulated) printer works
    await as(page, "Sam");
    await demoTools(page);
    await pick(page, "Simulated printer failure: ON").click();
    await tab(page, "Updates").click();
    await btn(page, "Try Printed menu again").click();
    await btn(page, "Yes, update Printed menu").click();
    await expect(text(page, "Revision 2 is on every place")).toBeVisible();
  });

  test("R3 and R4: delivery and review show ordered and arrived side by side, differences marked in words, and the three kinds of allergen statement kept apart", async ({ page }) => {
    await example(page);
    await sauceDelivery(page);
    const cmp = page.getByTestId("comparison");
    await expect(cmp.getByText("Ordered (expected)").first()).toBeVisible();
    await expect(cmp.getByText("Arrived (delivered)").first()).toBeVisible();
    await expect(cmp.getByText("DIFFERENT").first()).toBeVisible();
    await expect(cmp.getByText("Harbour Teriyaki Sauce 1L")).toBeVisible();
    await expect(cmp.getByText("Not identified").first()).toBeVisible();
    // ordered and arrived cells sit side by side on a phone-width screen for short values (Pack size is the same, so no DIFFERENT)
    await as(page, "Priya");
    await demoTools(page);
    await btn(page, "Fill in the supplier sheet for the new sauce").click();
    await btn(page, /^Open review/, false).click();
    await btn(page, "Save specification").click();
    await btn(page, "Show which recipes change").click();
    await expect(page.getByTestId("scope")).toContainText("Recipes affected (3)");
    await expect(page.getByTestId("scope")).toContainText("Main kitchen");
    await expect(page.getByTestId("scope")).toContainText("Annex kitchen");
    await expect(page.getByTestId("scope")).toContainText("QR / web menu");
    await expect(page.getByTestId("scope")).toContainText("Printed menu");
    await expect(page.getByTestId("comparison")).toContainText("Eastern Glaze");
    // three separate groups, distinct headings, in the order contains / supplier / kitchen
    const groups = page.getByRole("heading", { name: /^(Contains \(ingredients\)|Supplier precautionary statements \(may contain\)|Kitchen cross-contact procedures)$/ });
    expect(await groups.allTextContents()).toEqual(["Contains (ingredients)", "Supplier precautionary statements (may contain)", "Kitchen cross-contact procedures"]);
    const contains = page.getByLabel("Contains (ingredients)").filter({ hasText: "Sesame" }).first();
    await expect(contains).toBeVisible();
    await expect(contains).not.toContainText("Peanuts"); // peanuts is only a supplier warning
    await expect(page.getByLabel("Supplier precautionary statements (may contain)").first()).toContainText("Peanuts");
  });

  test("R5: the five status words appear distinctly, in order, as the case moves; a notification is never an acknowledgement", async ({ page }) => {
    await example(page);
    await sauceDelivery(page);
    await home(page);
    await expect(text(page, "A delivery did not match.")).toBeVisible();
    await as(page, "Priya");
    await demoTools(page);
    await btn(page, "Fill in the supplier sheet for the new sauce").click();
    await btn(page, /^Open review/, false).click();
    await btn(page, "Save specification").click();
    await home(page);
    await expect(text(page, "A specification is entered.")).toBeVisible();
    await expect(text(page, "Awaiting specification")).toHaveCount(0);
    await tab(page, "Review").click();
    await btn(page, /^Open review/, false).click();
    await btn(page, "Show which recipes change").click();
    await as(page, "Sam");
    await tab(page, "Review").click();
    await btn(page, /^Open review/, false).click();
    await btn(page, "Approve this change").click();
    await btn(page, "Yes, approve").click();
    await home(page);
    await expect(text(page, "Publication incomplete").first()).toBeVisible();
    await expect(text(page, "Awaiting review")).toHaveCount(0);
    await tab(page, "Updates").click();
    await btn(page, "Prepare revision 2").click();
    await btn(page, "Yes, prepare revision 2").click();
    for (const ch of ["QR / web menu", "Service view (staff)"]) { await btn(page, `Update ${ch}`).click(); await btn(page, `Yes, update ${ch}`).click(); }
    await btn(page, "Replace printed menus").click();
    await btn(page, "Yes, update Printed menu").click();
    await home(page);
    await expect(text(page, "Publication incomplete").first()).toBeVisible(); // printer fails by default in the example
    await tab(page, "Updates").click();
    await expect(text(page, "No message is sent to them")).toBeVisible();
    await expect(text(page, "Staff acknowledgement outstanding").first()).toBeVisible();
  });

  test("R2 scanning in the browser build: honest fallback, typed number lookup and manual search", async ({ page }) => {
    await example(page);
    await btn(page, "Check a delivery", false).first().click();
    await field(page, "Search by name, supplier or barcode number").fill("teriyaki");
    await expect(pick(page, "Harbour Teriyaki Sauce 1L")).toBeVisible();
    await expect(pick(page, "Plain flour 16kg")).toHaveCount(0);
    await field(page, "Search by name, supplier or barcode number").fill("zzzz");
    await expect(text(page, "No product matches")).toBeVisible();
    await field(page, "Search by name, supplier or barcode number").fill("Mill");
    await expect(pick(page, "Plain flour 16kg")).toBeVisible();
    await pick(page, "Plain flour 16kg").click();
    await btn(page, "Next: what is on the pack?").click();
    await btn(page, "Scan the barcode").click();
    await expect(text(page, "Camera scanning is not available here")).toBeVisible();
    await btn(page, "Type the number or search instead").click();
    await field(page, "Barcode number").fill("5010000100161");
    await expect(text(page, "not a valid barcode number")).toBeVisible();
    await field(page, "Barcode number").fill("");
    await field(page, "Barcode number").fill("1234");
    await expect(text(page, "not a valid barcode number")).toBeVisible();
    await field(page, "Barcode number").fill(VALID_EAN);
    await expect(text(page, "not in your product list")).toBeVisible();
  });

  test("a matching barcode is only an identifier match; a pack-size change needs review; a duplicate is ignored", async ({ page }) => {
    await example(page);
    const gtin = (base: string) => base + String((10 - ([...base].reverse().reduce((n, d, i) => n + Number(d) * (i % 2 === 0 ? 3 : 1), 0) % 10)) % 10);
    const flour = gtin("501000010000"); // the example's plain flour barcode
    const receive = async (pack: string, batch: string, first = false) => {
      if (first) await btn(page, "Check a delivery", false).first().click();
      await pick(page, "Plain flour 16kg").click();
      await btn(page, "Next: what is on the pack?").click();
      await field(page, "Barcode number").fill(flour);
      await expect(text(page, "(the product you ordered)")).toBeVisible();
      await field(page, "Pack size").fill(pack);
      await field(page, "Batch or best-before code").fill(batch);
      await btn(page, "Next: check and save").click();
      await btn(page, "Save and check this delivery").click();
    };
    await receive("16kg", "F-1", true);
    await expect(text(page, "Barcode matches the ordered product")).toBeVisible();
    await expect(text(page, "does not prove what is inside the pack")).toBeVisible();
    await btn(page, "Check another delivery").click();
    await receive("16kg", "F-1");
    await expect(text(page, "Already recorded: duplicate ignored")).toBeVisible();
    await btn(page, "Check another delivery").click();
    await receive("5kg", "F-2");
    await expect(text(page, "differs from the approved specification pack")).toBeVisible();
    await expect(text(page, "Awaiting specification").first()).toBeVisible();
  });

  test("write down now, check later: queued deliveries keep menus UNKNOWN until checked", async ({ page }) => {
    await example(page);
    await btn(page, "Check a delivery", false).first().click();
    await demoTools(page);
    await btn(page, "Fill in the replacement-sauce delivery").click();
    await btn(page, "Next: check and save").click();
    await btn(page, "Write down now, check later").click();
    await expect(text(page, "Written down, not checked yet")).toBeVisible();
    await home(page);
    await expect(page.getByTestId("task-delivery")).toContainText("1 delivery written down, not checked yet");
    await btn(page, "Check a delivery", false).first().click();
    await btn(page, "Check them now").click();
    await home(page);
    await expect(text(page, "Awaiting specification").first()).toBeVisible();
  });

  test("unknown answers: a specification with UNKNOWN allergens can be saved but never approved", async ({ page }) => {
    await example(page);
    await sauceDelivery(page);
    await as(page, "Priya");
    await tab(page, "Review").click();
    await btn(page, /^Open review/, false).click();
    await field(page, "Product name").fill("Mystery sauce");
    await field(page, "Specification version (from the sheet)").fill("M-1");
    await field(page, "Pack size").fill("1L");
    await field(page, "Ingredients, as written on the sheet").fill("Water, soy");
    await field(page, "Where this came from").fill("Phone call with supplier");
    await expect(btn(page, /^Allergens \(28 still UNKNOWN\)|^Allergens \(14 still UNKNOWN\)/, false)).toBeVisible();
    await btn(page, "Save specification").click();
    await expect(text(page, "some answers UNKNOWN").first()).toBeVisible();
    await btn(page, "Show which recipes change").click();
    await as(page, "Sam");
    await tab(page, "Review").click();
    await btn(page, /^Open review/, false).click();
    await expect(text(page, "A product with unknown allergen answers cannot be approved")).toBeVisible();
    await expect(btn(page, "Approve this change")).toHaveCount(0);
  });

  test("drafts: a half-typed delivery survives a reload (sealed at rest), is private to the person, and is cleared on submit", async ({ page }) => {
    await example(page);
    await btn(page, "Check a delivery", false).first().click();
    await field(page, "Search by name, supplier or barcode number").fill("teriyaki");
    await pick(page, "Harbour Teriyaki Sauce 1L").click();
    await btn(page, "Next: what is on the pack?").click();
    await field(page, "Batch or best-before code").fill("DRAFT-123");
    await page.waitForTimeout(1200);
    const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }));
    expect(stored).toContain("ia-drafts");
    expect(stored).not.toContain("DRAFT-123");
    await page.reload();
    await btn(page, /^Alex/, false).click();
    await btn(page, "Check a delivery", false).first().click();
    await btn(page, "Next: what is on the pack?").click();
    await expect(field(page, "Batch or best-before code")).toHaveValue("DRAFT-123");
    await as(page, "Priya");
    await btn(page, "Check a delivery", false).first().click();
    await expect(text(page, "This step is for the Receiving operator")).toBeVisible();
  });

  test("shared device: the app locks after idle time and after being left, and the previous person's screen is not readable", async ({ page }) => {
    await page.clock.install();
    await example(page);
    await openSettings(page);
    await btn(page, "Shared device: lock and sign-in").click();
    await pick(page, "1 minute").click();
    await home(page);
    await page.clock.fastForward(75_000);
    await expect(page.getByText("Who is using the device?")).toBeVisible();
    await expect(text(page, "Nothing outstanding at Main kitchen")).toBeHidden();
    await btn(page, /^Alex/, false).click();
    await expect(page.getByRole("heading", { name: "Status now" })).toBeVisible();
  });

  test("real kitchen: set up with a PIN, add a person who chooses their own PIN, wrong PINs are throttled, erase asks for the PIN again", async ({ page }) => {
    await goto(page);
    await btn(page, "Set up my kitchen").click();
    await field(page, "Business or kitchen group name").fill("Test Cafe Group");
    await field(page, "This kitchen's name").fill("Cafe");
    await btn(page, "Next").click();
    await field(page, "Your name").fill("Pat Owner");
    await field(page, "Choose a PIN").fill("1234");
    await expect(btn(page, "Start my kitchen")).toBeDisabled(); // weak PIN refused
    await field(page, "Choose a PIN").fill("481516");
    await field(page, "Type the PIN again").fill("481517");
    await btn(page, "Start my kitchen").click();
    await expect(text(page, "The two PINs are not the same")).toBeVisible();
    await field(page, "Type the PIN again").fill("481516");
    await btn(page, "Start my kitchen").click();
    await expect(page.getByRole("heading", { name: "Status now" })).toBeVisible();
    await expect(text(page, "Example kitchen")).toHaveCount(0);
    await expect(text(page, "Finish setting up")).toBeVisible();
    // example data is not mixed in
    await btn(page, "Check a delivery", false).first().click();
    await expect(text(page, "This step is for the Receiving operator")).toBeVisible(); // the owner is not a receiving operator; no example people exist
    await expect(text(page, "Alex")).toHaveCount(0);
    await home(page);
    // add products and a person
    await btn(page, "Open kitchen setup").click();
    await field(page, "Name").fill("Robin Cook");
    await pick(page, "Receiving operator").click();
    await pick(page, "Specification reviewer").click();
    await btn(page, "Add this person").click();
    await expect(text(page, "Robin Cook added")).toBeVisible();
    await expect(text(page, "has not chosen a PIN yet")).toBeVisible();
    await field(page, "Product name").fill("Oat drink 1L");
    await field(page, "Supplier").fill("Test Supplier");
    await field(page, "Barcode number (optional)").fill(VALID_EAN);
    await field(page, "Pack size").fill("1L");
    await field(page, "Specification version").fill("OD-1");
    await field(page, "Where the allergen information came from").fill("Supplier sheet OD-1 page 2");
    await btn(page, "Add this product").click();
    await expect(text(page, "Product added")).toBeVisible();
    // switch person: Robin chooses a PIN
    await btn(page, "Lock and switch person").click();
    await btn(page, /^Robin/, false).click();
    await expect(text(page, "Choose a PIN, Robin")).toBeVisible();
    await field(page, "Choose a PIN").fill("908172");
    await field(page, "Type the PIN again").fill("908172");
    await btn(page, "Save PIN and sign in").click();
    await expect(page.getByRole("heading", { name: "Status now" })).toBeVisible();
    // Robin receives the product; its specification still has UNKNOWN answers, so it is not a clean match
    await btn(page, "Check a delivery", false).first().click();
    await field(page, "Search by name, supplier or barcode number").fill("oat");
    await pick(page, "Oat drink 1L").click();
    await btn(page, "Next: what is on the pack?").click();
    await field(page, "Barcode number").fill(VALID_EAN);
    await expect(text(page, "(the product you ordered)")).toBeVisible();
    await field(page, "Pack size").fill("1L");
    await field(page, "Batch or best-before code").fill("B1");
    await btn(page, "Next: check and save").click();
    await btn(page, "Save and check this delivery").click();
    await expect(text(page, "The approved specification is incomplete").first()).toBeVisible();
    // lock; wrong PIN is refused, and repeated wrong PINs are throttled
    await btn(page, "Lock and switch person").click();
    await btn(page, /^Robin/, false).click();
    for (let i = 0; i < 3; i++) { await field(page, "Your PIN").fill("000111"); await btn(page, "Unlock").click(); }
    await expect(text(page, /Wait \d+ seconds|Too many wrong PINs/)).toBeVisible();
    await field(page, "Your PIN").fill("908172");
    await btn(page, "Unlock").click();
    await expect(text(page, "Too many wrong PINs")).toBeVisible(); // even the right PIN waits
    // erase needs the PIN of whoever is signed in; use Pat (a different person, not throttled)
    await page.reload();
    await btn(page, /^Pat/, false).click();
    await field(page, "Your PIN").fill("481516");
    await btn(page, "Unlock").click();
    await openSettings(page);
    await btn(page, "Privacy and your data").click();
    await btn(page, "Erase everything on this device").click();
    await field(page, "Your PIN").fill("111222");
    await btn(page, "Yes, erase everything").click();
    await expect(text(page, "Wrong PIN")).toBeVisible();
    await field(page, "Your PIN").fill("481516");
    await btn(page, "Yes, erase everything").click();
    await expect(btn(page, "Set up my kitchen")).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("ia-state"))).toBeNull();
    expect(await page.evaluate(() => localStorage.getItem("ia-drafts"))).toBeNull();
  });

  test("text size: Extra large is remembered after reload and nothing overflows", async ({ page }) => {
    await example(page);
    await openSettings(page);
    await pick(page, "Extra large").click();
    await page.reload();
    await btn(page, /^Alex/, false).click();
    await expect(page.getByRole("heading", { name: "Status now" })).toBeVisible();
    const size = await page.getByRole("heading", { name: "Status now" }).evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
    expect(size).toBeGreaterThanOrEqual(24);
    await auditLayout(page, "home xlarge");
  });

  test("data is stored encrypted; reload restores it; a lost key fails closed; erase removes everything", async ({ page }) => {
    await example(page);
    await sauceDelivery(page);
    await page.waitForTimeout(400);
    const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
    expect(stored).toContain("ia-state");
    for (const needle of ["Fictional Bistro Group", "Harbour Teriyaki", "Glazed salmon bowl", "\"products\"", "Priya Nair", "EG240617", "tenants"]) expect(stored, `plaintext leaked: ${needle}`).not.toContain(needle);
    await page.reload();
    await btn(page, /^Alex/, false).click();
    await expect(page.getByTestId("task-review")).toContainText("1 waiting");
    await page.evaluate(() => new Promise<void>((res) => { const r = indexedDB.deleteDatabase("ingredientalert-keys"); r.onsuccess = () => res(); r.onerror = () => res(); r.onblocked = () => res(); }));
    await page.reload();
    await expect(text(page, "could not be opened on this device")).toBeVisible();
    await expect(text(page, "Glazed salmon bowl")).toHaveCount(0);
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
    expect(m.name).toBe("IngredientAlert");
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
    await example(page);
    await page.getByTestId("task-delivery").focus();
    await page.keyboard.press("Enter");
    await expect(text(page, "Step 1 of 3: what did you order?")).toBeVisible();
    await page.getByRole("button", { name: "Back", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Status now" })).toBeVisible();
  });

  test("dark theme is applied and readable on the main screens", async ({ page }) => {
    await example(page, "Alex", "?theme=dark");
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).not.toBe("rgb(255, 255, 255)");
    await axeCheck(page, "home dark");
    await auditLayout(page, "home dark");
  });

  test("tour: automated accessibility scan (axe, WCAG 2 A/AA) on every screen state", async ({ page }) => {
    await page.goto("/");
    await tour(page, (label) => axeCheck(page, label));
  });

  test("tour: no horizontal scroll, no overlapping buttons, text stays inside its button on every screen", async ({ page }, info) => {
    await page.goto("/");
    await tour(page, async (label) => { await auditLayout(page, label); await shot(page, info, label); });
  });

  test("tour in dark: audit and screenshots", async ({ page }, info) => {
    await page.goto("/?theme=dark");
    await tour(page, async (label) => { await auditLayout(page, `dark ${label}`); process.env.SHOT_TAG = "-dark"; await shot(page, info, label); process.env.SHOT_TAG = ""; });
  });

  test("tour at 2x text (?fontscale=2): nothing overflows or overlaps on any screen", async ({ page }, info) => {
    await page.goto("/?fontscale=2");
    await tour(page, async (label) => { await auditLayout(page, `fontscale2 ${label}`); process.env.SHOT_TAG = "-text200"; await shot(page, info, label); process.env.SHOT_TAG = ""; });
  });

  test("tour with the in-app Extra large setting: nothing overflows or overlaps on any screen", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.setItem("ia-settings", JSON.stringify({ textSize: "xlarge", theme: "system", printerFails: true, autoLockMin: 2, failures: {} })));
    await page.reload();
    await tour(page, async (label) => { await auditLayout(page, `xlarge ${label}`); });
  });

  test("system bars: content stays clear of the status bar and navigation buttons (simulated Android insets)", async ({ page }) => {
    await page.goto("/?insets=44,48");
    await expect(btn(page, "Try the example kitchen")).toBeVisible();
    const top = await page.getByText("IngredientAlert", { exact: true }).first().boundingBox();
    expect(top!.y, "first content starts below the status bar").toBeGreaterThanOrEqual(44);
    await btn(page, "Try the example kitchen").click();
    await btn(page, /^Alex/, false).click();
    const vh = await page.evaluate(() => window.innerHeight);
    const lastTab = await page.getByRole("tab").first().boundingBox();
    expect(lastTab!.y + lastTab!.height, "tab buttons end above the navigation buttons").toBeLessThanOrEqual(vh - 48 + 1);
  });
});
