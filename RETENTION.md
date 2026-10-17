# Retention and deletion (DRAFT)

**No statutory retention period has been invented or asserted.** Periods below are marked *not decided* and need legal and food-safety input.

| Record | Deletable? | Behaviour in this build | Period |
|---|---|---|---|
| Staff display name | Yes, after offboarding | Replaced with "Former staff member N"; the record is flagged erased | n/a |
| Audit events, approvals, substitutions, acknowledgements attributed to a staff id | **Retained** (justified) | They show who approved allergen-declaration changes and when. The id becomes pseudonymous after erasure. | **Not decided (open item)** |
| Approved publications and specification snapshots | Retained; immutable | Editing would break the source-linked history; superseded revisions are marked STALE, not deleted | **Not decided (open item)** |
| Draft/unapproved items | Not separately modelled | Cases stay as records | Not decided |
| Local data on the phone | Yes, by the user | "Erase everything on this phone" deletes the data file and the key. No backup exists, so it cannot be restored. | Immediate |
| Backups | None | Not applicable. Future: backup expiry and restore tombstones (so deleted records do not reappear when an old backup is restored) must be designed and tested. | Not decided |

## Deletion request flow (`requestStaffErasure`)
1. Administrator offboards the person (access ends immediately).
2. Administrator removes personal details. The system records **what was deleted** and **what was retained and why**, in a retention record.
3. The audit hash chain still verifies. The retained reason states that the period is not decided.

Limits: copies exported or screenshotted elsewhere are not affected. Independent copies held by recipients cannot be recalled. A request that would delete active approved declarations is not offered.

Tested: "deletion versus justified audit retention" in `packages/core/test/security.test.ts`.
