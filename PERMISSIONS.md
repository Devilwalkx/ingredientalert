# Permissions (DRAFT)

## Android permissions
**One: CAMERA.** It is requested only by the barcode scan, which is implemented (`apps/mobile/src/Scanner.tsx`, using `expo-camera`). Everything else stays blocked in `app.json` and is removed from the merged manifest: RECORD_AUDIO (the camera plugin is configured with `recordAudioAndroid: false`), location (fine/coarse/background), storage (read/write/media), INTERNET, VIBRATE, SYSTEM_ALERT_WINDOW and POST_NOTIFICATIONS.

| Permission | Why | When asked | If refused |
|---|---|---|---|
| CAMERA | Read the number under a barcode on a delivery pack | Only when the person taps **Scan the barcode** on the delivery screen, after a plain-words reason ("only to read the number; pictures are not saved or sent") and their tap on **Allow camera** | Explained; can ask again once; if Android will not ask again the screen says so and **Open Android settings** opens the app's settings page. Typing the number and searching by name always work. |

Images: frames are decoded in memory by the camera module to read the barcode number. They are not written to storage and not sent anywhere (the app has no internet permission). This is the design and the manifest; no test inspects the camera module's internals.

Notifications: **none are sent, and POST_NOTIFICATIONS is not requested.** A notification feature needs a real local notification with a clear destination and its own test; it is not built. In the app a notification is never an acknowledgement.

Checks: unit test on `app.json` (`packages/core/test/security.test.ts`); CI step "Check requested permissions" on the prebuilt manifest, which fails if any requested permission other than CAMERA is present, if CAMERA is missing, or if INTERNET, VIBRATE, SYSTEM_ALERT_WINDOW, RECORD_AUDIO, location, storage or POST_NOTIFICATIONS appears; the emulator job records `dumpsys package` (requested and granted permissions) in `package.txt`.

**Not tested:** camera permission and scanning on a physical phone (NOT TESTED). The emulator job exercises the permission flows against an emulator camera with a virtual scene; that says nothing about real-world scan reliability (lighting, glare, curved packs, damaged codes).

## Roles (enforced in `packages/core/src/permissions.ts`, tested)
| Action | Receiving operator | Specification reviewer | Publication approver | Service staff | Administrator |
|---|:-:|:-:|:-:|:-:|:-:|
| Read site data | yes | yes | yes | yes | yes |
| Record / queue / reconcile deliveries | yes | | | | |
| Check specification, review impact | | yes | | | |
| Reject a review | | yes | yes | | |
| Approve a change, end a substitution | | | yes | | |
| Add approved recipe version | | | yes | | |
| Prepare / publish a revision | | | yes | | |
| Acknowledge a revision | | | | yes | |
| Set kitchen controls | | | | | yes |
| Grant / revoke exceptions | | | | | yes |
| Add / offboard staff, remove personal details | | | | | yes (tenant-wide) |
| Export history | | | yes | | yes |
| Add a product to the catalogue (with its specification evidence) | | yes | | | yes |

Rules: roles are held **per person** (no shared logins); a membership names a site or "*" (all sites of **that tenant only**); an offboarded person holds nothing; authorisation resolves the tenant from the target object, and a foreign or missing object returns the same error. A "limited support" role from the brief is **not built** (there is no server to support); head-office access is never automatic across tenants.

## Separation of duties
The person who **recorded the delivery** or **checked the specification** cannot approve a consequential change (different product, or any change to declarations, or an incomplete specification). Exception: an administrator may grant a **small-team exception** that is (a) for one named approver, (b) at one site, (c) backed by a written reason of at least 15 characters, (d) limited to 1-14 days (a design parameter, not a regulatory figure), (e) revocable, and (f) never grantable to oneself. The decision records which exception was used.


## Sign-in on a shared device
People sign in with their own PIN on the shared device (see docs/SHARED_DEVICE_SESSIONS.md). The rules above are enforced by software and every action is attributed to the signed-in person. A PIN is attribution, not strong identity: lending a PIN defeats it, and there is no server to revoke a device or person remotely. The example kitchen's people have no PINs and are labelled as made up.
