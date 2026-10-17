# Risk register (DRAFT)

L = likelihood, I = impact (Low/Med/High), judgement only, not measured.

| ID | Risk | L | I | Control in this repo | Remaining action |
|---|---|:-:|:-:|---|---|
| R1 | Staff treat the app as a safety guarantee | Med | High | Notices on Home/About; "not a guarantee" line on menus; no "safe"/"free from" wording (tested) | Specialist wording review; training outside the app |
| R2 | Unknown data shown as "not declared" | Low | High | Unknown propagates; property test with 300 random specs; mutation-checked | Real-data entry quality is a human control |
| R3 | Wrong data typed from a specification sheet | Med | High | Evidence reference mandatory; second-person approval; UNKNOWN default for every answer | Pilot to measure error rate; sheet photo review needs a privacy/design decision |
| R4 | Supplier changes recipe without changing barcode/label | Med | High | Barcode treated as identifier only; pack/batch/version compared | Supplier communication process; outside software |
| R5 | Approver rubber-stamps | Med | High | Must see impact list; approval bound to impact digest; separation of duties | Pilot observation; do not time-pressure |
| R6 | Small team uses the exception routinely | Med | Med | Expiring, named, reasoned, audited; max 14 days | Review exception use in pilot |
| R7 | Printed menus stay out of date | High | High | Per-channel status; failed/stale stays outstanding; printed copy revision check | Physical replacement procedure |
| R8 | Acknowledgement mistaken for training | Med | Med | Receipt-only wording everywhere | Training programme outside the app |
| R9 | Existing systems already solve this | Med | Med (commercial) | SPEC section 4; narrow hypothesis | Competitor trial from an unrestricted machine (not verified here) |
| R10 | Lost phone = lost data | Med | Med | Encrypted, fails closed | Server/sync with backup and restore drills |
| R11 | A shared PIN-protected device mistaken for strong identity; PINs lent or watched | Med | Med | Per-person PIN, step-up on consequential acts, throttling, audit; limits written in docs/SHARED_DEVICE_SESSIONS.md; demonstration shortcuts exist only in the labelled example | Real authentication with a server; pilot observation |
| R12 | APK untested on real devices (storage, Keystore, fonts, insets) | High | Med | Web e2e at 3 phone sizes with simulated insets and text scale; permission audit | **Install and try on a phone**; report |
| R13 | Staff-activity data feels like monitoring | Low | Med | No location, no photos, receipt-only acks | Staff notice; consult staff |
| R14 | Over-reliance on hash-chain "tamper evidence" | Low | Low | Documented as evidence only | Server-side logging |
| R15 | Dependency vulnerabilities | Med | Med | Lockfile; pinned Expo SDK versions | `npm audit` review, SBOM |
| R16 | Allergen list or labelling rules change | Low | High | List isolated in one file | Verify against current FSA guidance (not verified here) |
| R17 | Wording drift into compliance claims | Low | High | Test asserts forbidden phrases absent from published data | Review every doc before sharing |
| R18 | Pricing assumptions treated as fact | Med | Low | Stated as unvalidated | Paid pilot offer |
| R19 | Camera scan misreads or fails on real packs (glare, curved labels, damaged codes) | Med | Med | Check digit rejects misreads; typed entry and name search always available; a barcode never proves contents | **Real-device scan test (NOT TESTED)** |
| R20 | Staff read "Approved revision" as "on the menu" or an acknowledgement as training | Med | High | Five distinct status words, each with its meaning text; approval shows "not on any menu yet"; receipt-only acknowledgement wording | Fresh-user sessions (NOT RUN, plan in docs/USABILITY_SESSION_PLAN.md) |
| R21 | Simulated QR / printer mistaken for real publication | Med | High | Labelled "(simulated)" with "There is no server" on the publication screen and in confirmations | A real channel needs a server (not built) |
| R22 | A person claims another's account by tapping a name before they have chosen a PIN | Low | Med | Administrator sees "has not chosen a PIN yet"; documented | Administrator hands the device over directly; invite-code design |
| R23 | Forgotten PIN of the only administrator: no recovery | Low | Med | Documented; second administrator recommended | Recovery design needs a server or held secret |
| R24 | The encryption description is read as stronger than it is (not reviewed; hardware backing unknown; screens can be captured; storage rollback undetected) | Med | Med | docs/ENCRYPTION_ACCOUNT.md states library, algorithm, keys, what stays readable, who can decrypt; on-phone self-check | Independent review; hardware-backing check on a real phone |
| R25 | A private release key does not exist, so test builds cannot be updated over by a release build (Android refuses, user data lost) | Med | Med | docs/SIGNING.md; emulator step shows the refusal; no real data should live in test builds | Owner creates and backs up the key |
