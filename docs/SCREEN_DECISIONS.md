# Screen decisions

For each screen: why the person opened it, what they see first, the primary action, what happens next, and what happens when information or a connection is missing. The result comes before supporting detail; the evidence is one tap away. Wording here is the wording in the app.

There is no server and the app has no internet permission, so "connectivity missing" is always the normal case. What differs by screen is what the person can still do and what the screen refuses to claim.

## Entry: Welcome (nothing set up yet)
- **Why opened:** first launch, or after erasing everything.
- **First information:** what the app is for, in one sentence, and two starts: **Set up my kitchen** and **Try the example kitchen**.
- **Primary action:** Set up my kitchen. The example is a clearly labelled secondary start; the example and a real kitchen never share data.
- **Next:** setup (two steps) or the "who is using the device" screen of the example.
- **Missing information:** nothing is needed to start. If saved data exists but the key is missing the screen says it stays locked and shows nothing (fail closed).

## Entry: Set up my kitchen
- **Why opened:** the person is the first user of a real kitchen.
- **First information:** two names (business, kitchen), then the person's own name and PIN.
- **Primary action:** Start my kitchen (disabled until the PIN is acceptable).
- **Next:** Home, signed in as the first person, who is administrator and approver. A "Finish setting up" card lists what is still empty.
- **Missing:** a weak PIN (1234, 0000) is refused with the reason. The PIN is not recoverable by the app (see SHARED_DEVICE_SESSIONS.md).

## Entry: Who is using the device? (lock screen)
- **Why opened:** after launch, after the idle time, after leaving the app for more than 30 seconds, or when someone taps the lock icon to switch person.
- **First information:** names. Tapping a name is the whole identification step in the example kitchen; in a real kitchen it opens the PIN field.
- **Primary action:** tap your name, type your PIN, Unlock.
- **Next:** Home (or where the same person left off, if it is the same person).
- **Missing:** wrong PINs are counted and throttled (3 wrong: 30 s wait, 5: 5 min, 8: 15 min). A person with no PIN yet chooses one on first sign-in. Someone who forgot theirs asks an administrator to reset it.

## Home
- **Why opened:** start of a task, or to see what is outstanding.
- **First information:** three tasks, in this order: **Check a delivery**, **Review substitutions**, **Outstanding decisions and publication updates**. A count appears only when the underlying thing exists ("1 waiting"); otherwise the card says "Nothing waiting for review". Then **Status now**, which uses the five status words and says what each means.
- **Primary action:** Check a delivery.
- **Next:** each task opens its screen; a status card opens the screen where it is resolved.
- **Missing:** an empty real kitchen shows "Finish setting up" with what to add. "Nothing outstanding" is worded as the app's record only.

## Check a delivery (3 steps)
- **Why opened:** a delivery has arrived and someone is holding the pack.
- **First information:** step 1, what was ordered. Search by name, supplier or barcode number; up to eight products are listed without typing.
- **Primary action:** step 2 has **Scan the barcode** first, then typed fields for barcode, pack size, batch, specification version and delivery note. Under the barcode the app says which product that number belongs to, or that it is not in the list, or that it is not a valid number.
- **Next:** step 3 summarises, then **Save and check this delivery**. The result shows the outcome, the findings in words, and **ordered and arrived side by side** with every difference marked DIFFERENT. A mismatch leads to **Review this substitution**.
- **Missing:** no camera permission, a dark pack, or an unreadable barcode: type the number. No time: **Write down now, check later** saves it as unchecked and keeps menus that use the product UNKNOWN. A half-typed form is kept (sealed) per person and cleared on submit or cancel.
- **Not claimed:** a matching barcode is "Barcode matches the ordered product", never "correct product". The hold notice says it does not prove stock has been separated.

## Scan the barcode
- **Why opened:** the person chose to scan.
- **First information:** before the system dialog, a plain-words reason: the camera reads the number only, nothing is saved or sent.
- **Primary action:** Allow camera. Then a camera view with a frame, a torch switch, and **Type the number or search instead** always present.
- **Next:** a valid number returns to step 2 with the number filled in and the product named. A misread (failed check digit) keeps scanning and says so. After 20 seconds with nothing read: a notice with **Try scanning again** and the typing route.
- **Missing:** denied once: explained, can ask again. Denied permanently: explained, **Open Android settings** opens the app's settings page. The browser build has no camera and says so.

## Review substitutions (list)
- **Why opened:** a delivery did not match, or someone wants to see what is waiting.
- **First information:** one card per open review: status word, ordered product, arrived product, batch.
- **Primary action:** Open review. Finished reviews are one tap away under "Finished".
- **Missing:** the empty state explains what appears here.

## Review substitution (one case)
- **Why opened:** to move a mismatch to a decision.
- **First information:** the status word and "Ordered / Arrived". Then the next step for the person who is signed in: step 1 enter the specification, step 2 which recipes change, step 3 decide. A person without the role sees which role the step needs and a **Switch person** button.
- **Primary action:** the step's button. Approval is a confirmation dialog that names the specification, the site and the recipes, and asks for the PIN again in a real kitchen.
- **Next:** approved becomes **Approved revision** and links to publication updates. It is explicit that nothing is on a menu yet.
- **Evidence (open by default because it is safety-relevant):** the side-by-side comparison; "What this change touches" (recipes, the site, other sites that use the recipes but are not changed, the three publication places); the allergen information in three separate groups: **Contains (ingredients)**, **Supplier precautionary statements (may contain)**, **Kitchen cross-contact procedures**. The approval trail is one tap away.
- **Missing:** unknown answers are saved as UNKNOWN and block approval ("cannot be approved"), never read as "not declared".

## Decisions and updates (publication)
- **Why opened:** something is approved, or places show an old menu.
- **First information:** a notice that there is no server and the QR / web menu and the printer are simulated.
- **Primary action:** Prepare the revision, then update each place. Each place shows "Up to date", "Out of date" or "Update failed: still the old menu".
- **Next:** staff acknowledgement outstanding is listed with names and the sentence that no message is sent to them.
- **Missing:** a failed place stays outstanding; the printed menus already on walls are named as a physical problem the app cannot fix.

## Menu for service
- **Why opened:** service staff want the current allergen information and to confirm they saw the newest revision.
- **First information:** newest or OLD revision, then dishes with allergens in the same three separate groups.
- **Primary action:** I have seen revision N (PIN in a real kitchen, so it is the person's own act).
- **Missing:** an out-of-date service view says so in words and tells people to ask a manager. An UNKNOWN dish says not to serve it on this information.

## Settings
- **Why opened:** display, lock time, setup, manager tools, privacy, build identity.
- **First information:** Display (colours, text size) open; everything else is a titled section.
- **Primary action:** depends on the section. **Kitchen setup** adds people (they choose their own PIN), products with their specification evidence, and recipes. **Manager tools** hold kitchen cross-contact procedures, small-team exceptions and history.
- **Demonstration tools** exist only in the example kitchen, are labelled demonstration only, and are not part of ordinary use.
- **Missing:** the privacy section says what leaves the device (nothing), that camera images are not stored or sent, and that there is no backup.
