# Privacy register (DRAFT for review - not legal advice, not a DPIA)

Nothing here is a legal conclusion. No consent, contract, registration, approval or statutory period has been invented. **ICO guidance (including on the Data (Use and Access) Act 2025) could not be read from the build environment**; the brief says the Act amends rather than replaces UK GDPR and the Data Protection Act 2018. Current guidance must be checked by whoever completes this register.

## 1. What personal data exists
| Data | Whose | Why it exists | Sensitivity |
|---|---|---|---|
| Staff name (first + last), staff id, role memberships | Kitchen staff | Accountability for who recorded, checked, approved, published and acknowledged | Personal data. Not special category. |
| Audit events (actor id, action, time, target id) | Kitchen staff | Show who did what, and detect tampering | Personal data (pseudonymous id). |
| Acknowledgement records | Service staff | Evidence a person saw a revision | Personal data. Could be misread as performance monitoring: the UI says it is receipt only. |
| Exception records (reason text, granter, beneficiary) | Managers/staff | Explain why a safeguard was relaxed | Personal data; reason text must not contain health details. |
| Product, supplier, specification, recipe, declaration data | Business | Core function | Business data. Approved declarations are intentionally public once published in a real service. |

**Also on the device:** a salted slow hash of each person's PIN (never the PIN), sign-in and wrong-PIN events in the audit trail, and a wrong-PIN counter in settings. Camera images are used only to read a barcode number: not stored, not sent.

**Not collected, by design:** diner names or allergy profiles, guest medical letters, worker photos or video, face recognition, staff location or surveillance, device identifiers, analytics. A later diner-allergy feature would need its own Article 9 and privacy assessment (health data).

## 2. Roles and bases (to be decided, not asserted)
| Question | Position in this draft |
|---|---|
| Controller/processor | In a real service the kitchen business would normally be controller of its staff and recipe records, and the product provider a processor for that business data, but the provider would be controller for its own account/security operations. **To be determined from actual purposes and contracts.** In this build no provider handles data (it is on the phone). |
| Article 6 basis for staff accountability records | Candidates include legitimate interests or legal obligation (food-safety records). **Not decided; needs a documented assessment.** |
| Article 9 | No health data of identifiable people is held. If a diner feature or staff health notes were added, an Article 9 condition would be needed. |
| Authority to upload third-party records | Supplier specification sheets may be copyrighted or confidential; only an evidence reference is stored, not the document. Terms with suppliers not reviewed. |
| DPIA screening | Not done. Likely low-risk for synthetic local data; staff-activity records and any future monitoring features need screening. |
| Processor contracts, transfers, subprocessors | Not applicable to this build; required before any server (hosting, auth, email, monitoring). |
| Rights handling (access, correction, erasure, restriction, objection) | Mechanisms: export of site history (admin/approver), staff erasure with justified audit retention (see RETENTION.md). Verification, timing and exemptions are open. |
| PECR | No marketing, cookies or tracking in this build. Assessment required if any are added. |
| Incident procedure | Not written. A real service needs one, including ICO notification assessment and processor escalation. |
| Privacy notice for staff | Not written. Staff must be told what is recorded about them. |
| DPO / ICO fee / representative | Not assessed. |

## 3. Encryption model (honest labelling)
- This build: **on-device encryption** (XChaCha20-Poly1305, authenticated, bound to account/item/version; key in Android Keystore-backed storage). Recovery secret is a design preview; no backup exists.
- A future server version would be **provider-managed encrypted business storage**: authorised server processes can read it, restricted audited support, **not owner-only**.
- Revocation/offboarding stops future access in the app; it cannot recall screenshots or copies already made.

## 4. Open items
Lawful-basis assessment, staff notice, DPIA screening, supplier terms, retention periods, incident runbook, support-access policy, independent privacy review. All **open**.
