# IngredientAlert - Specification (DRAFT for review)

> **Read this first.** IngredientAlert supports trained people and established kitchen controls. It cannot guarantee that any dish is safe, and it must **shadow** existing kitchen procedures, not replace them. This is a draft built for review. It is not legal, privacy, security or food-safety certification, and none of those reviews has happened. All data in this build is synthetic.

## 1. What this is
A phone-first tool for one kitchen to connect **what was actually delivered** to **what the menu says**:

1. Receiving staff record a delivery and the app compares it with the approved product (identity, pack size, batch, specification version).
2. A difference opens a **review**. The affected dishes show **UNKNOWN** until a second person has checked the supplier's paperwork and approved the change.
3. A reviewer checks the exact specification; an approver accepts that exact revision; the new declaration is published to separate channels (QR/web, service view, printed menu), each with its own status.
4. Service staff acknowledge the new revision (a recorded receipt, nothing more). Stale channels and unacknowledged staff stay visibly outstanding.

## 2. The honest scope of this build
| Item | This build |
|---|---|
| Servers, accounts, sync | **None.** One phone, local-first, no network permission. |
| Staff roles | **Simulated** on one phone with a role switcher ("Demo: one phone plays every role; real staff logins need a server (not built)"). Permissions and separation of duties are nevertheless enforced in core and tested. |
| Scale | One tenant for the demo (plus a second tenant used only to test isolation), two sites, **20 synthetic ingredients**, 9 synthetic recipes. |
| Data entry | Manual (typed barcode, typed specification). No camera, no AI extraction. AI reading of specification sheets is a **disclosed future option** that would need its own reviewed design, human review of the original sheet, and an approved data-processing arrangement. |
| Channels | QR/web, service view and printed menu are **simulated adapters**. The printer failure in the demo is simulated on purpose. |
| Supplier feeds / integrations | None. Any integration needs real API contracts or documented CSV formats; none were invented. |
| Diner data | None. No diner allergy profiles, no photos, no worker monitoring. |

## 3. Required behaviours (and where they are tested)
- **Barcode is an identifier aid**, never proof of formulation. A matching barcode yields only "identifier match"; pack size, batch and specification version are compared separately.
- **Mismatch** against the approved item (unknown/mistyped barcode, other product's barcode, pack variant, specification version, uncovered batch, incomplete specification) opens a review.
- **Information hold**: "quarantine" is a workflow/information state. The UI states that it does not prove stock has been physically separated.
- **14 UK allergens** (celery, cereals containing gluten, crustaceans, eggs, fish, lupin, milk, molluscs, mustard, tree nuts, peanuts, sesame, soybeans, sulphur dioxide/sulphites). *The list is taken from the build brief; current FSA guidance was not verified in this build.*
- **Three separate things**, never merged: declared ingredient allergens ("Contains"), supplier precautionary statements ("May contain"), and **kitchen cross-contact controls** (written by people per site, never inferred from ingredients).
- **Unknown stays unknown.** An allergen unknown anywhere in a dish's dependency tree (and not declared elsewhere) makes the dish UNRESOLVED. Unresolved dishes block routine publication. No label says "free from"; allergens not listed are described only as "not declared in the reviewed specifications", with a standing "not a guarantee" line. Allergens are never inferred from dish names.
- **Recipes**: versioned, nested, site-applicable; impact propagates through nesting; dependency cycles are rejected; stale/missing sub-recipe references are UNRESOLVED.
- **Approval** is of a precise specification revision and a precise impact digest; actor and evidence are preserved. Approved snapshots (specifications, substitutions, publications) are immutable (frozen; no edit API).
- **Separation of duties**: the person who recorded the delivery or checked the specification cannot approve a consequential change, unless a **named, reasoned, scoped, expiring** small-team exception exists. Overrides cannot make unknown data allergen-free; the only publish-related override still labels the dish UNRESOLVED.
- **Concurrency**: review actions carry a version; a second reviewer acting on stale data is refused. Publication re-checks a "basis hash" so it cannot bypass a review that opened after it was prepared.
- **Publication**: per-channel status and revision; idempotent retry; partial failure surfaced; a failed or stale channel stays outstanding; superseded revisions cannot be published; a printed copy can be checked by its revision number.
- **Acknowledgement** is bound to the exact revision, requires the service view to show it, and means recorded receipt only (not training, not understanding).
- **Offboarding** removes access immediately; offboarded staff are no longer expected to acknowledge; their exceptions lapse. Personal details can be removed while a justified audit record is kept (see RETENTION.md).
- **Export**: source-linked history (publication -> substitution -> review -> delivery -> specification evidence) marking the newest menu ACTIVE and older ones STALE.

## 4. Existing systems may already cover this
Other products may already replace ingredients across recipes and menus, and some publish supplier integrations. **None of that was verified here**: competitor and regulator websites could not be reached from the build environment (only package registries and GitHub were reachable), so no competitor fact, feature or price in this repository is a verified claim. The brief itself says existing systems may already cover this adequately and that this must be tested before major development. The honest hypothesis under test is narrow: capture of a substituted delivery at the door, independent approval, correct per-site application, and one clear revision across every channel and every team member. Run a shadow pilot beside existing systems before building more.

## 5. Not built / open
Server and real authentication; real-device testing; barcode scanning; supplier outage handling (no supplier feed exists); real channel integrations; specialist food-safety review; privacy/security review; current FSA guidance check; pricing validation (the brief's GBP 79-199 per site per month is **unvalidated**); pilot design. See STATUS.md and RISK_REGISTER.md.
