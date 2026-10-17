# Shared kitchen device: session design

Status: designed and partly implemented. Nothing here has been tested on a physical tablet, reviewed for security, or tried with kitchen staff.

## The problem
A kitchen tablet is passed between people (goods-in, chef, front of house) all day. The app records who recorded a delivery, who entered a specification, who approved, who published and who acknowledged. Separation of duties and acknowledgement mean something only if the person named is the person who acted. Long logins will be skipped in a busy kitchen, so the design has to be quick as well as attributable.

## Options considered
| Option | Attribution | Speed | Why not / why |
|---|---|---|---|
| One shared login | none | fastest | Defeats separation of duties. Rejected. |
| Full account password per person | strong (with a server) | slow | Needs a server; typing passwords with wet or gloved hands. Not buildable here. |
| Per-person short PIN with quick switch | per action, honest limits | a name tap and 4-6 digits | **Chosen.** |
| Device biometrics | depends on the phone | fast | Tied to the phone owner, not to kitchen staff on a shared device. Not used. |
| Badge / NFC / QR tag | per person | very fast | Needs a permission and hardware. Possible later. |
| Persona switcher (tap any name, no check) | none | fastest | Demonstration only. |

## What is implemented
1. **People are individuals.** Each has a name and roles (existing core model). The administrator adds them in Settings > Kitchen setup > People.
2. **PIN per person.** 4 to 6 digits, refused if all one digit or a straight run (0000, 1234). A person chooses their own PIN the first time they sign in; the administrator never sees it. The stored record is a salted scrypt hash (N=4096), kept inside the sealed state. The PIN is never stored, logged or put in the audit trail.
3. **Quick switch.** The lock icon in the app bar locks the app. The lock screen lists the people; tap a name, type the PIN, Unlock. No username, no password, no email.
4. **Auto-lock.** After a chosen idle time (1, 2, 5 or 10 minutes; default 2) without a tap, and when the app has been left for more than 30 seconds (screen off, another app, a call). The previous person's screen is kept but hidden and unreachable while locked, so a half-filled form is not lost if the same person signs back in. A different person starts at Home with their own, separate drafts.
5. **Per-action attribution.** Every command the engine runs is attributed to the signed-in person. Sign-ins, wrong PINs and PIN re-confirmations are written to the hash-chained audit trail (no secret in them).
6. **Step-up for consequential acts.** Approve, reject, prepare or update a menu place, acknowledge, grant an exception, remove a person, reset a PIN and erase all ask for the PIN again inside the confirmation dialog. This is what stops "the last person forgot to lock" from becoming an approval or an acknowledgement in someone else's name.
7. **Throttling.** 3 wrong PINs in a row: 30 s wait; 5: 5 min; 8: 15 min; the counters are saved, so killing the app does not reset them. A correct PIN during the wait is also refused. A correct PIN resets the count.
8. **Forgotten PIN.** An administrator clears it (Reset PIN); the person chooses a new one at next sign-in. An administrator cannot reset their own; another administrator must.
9. **No long flows.** Switching person is a name tap and a PIN.

## The example kitchen and the persona switcher
The example kitchen has made-up people with no PINs, so you can see the whole story on one phone. It is labelled on every screen. Switching person there uses the same lock screen (a name tap, no PIN). There is no hidden role switcher, and the demonstration shortcuts (fill in a delivery, printer failure, move the clock) exist only inside the example's Settings under "Demonstration tools", labelled "Demonstration only". A real kitchen has none of these.

## What this does not do (honest limits)
- **A PIN is attribution, not encryption.** The data key is held by the device; the PIN does not protect the data from someone who can read the app's storage. Four to six digits can be guessed offline by anyone who copies the sealed file and the hash. The slow hash and the on-device throttle raise the cost; they do not remove it.
- **Shoulder surfing and PIN sharing.** Someone can watch a PIN being typed, or lend theirs. The app cannot tell. The audit trail would then name the wrong person.
- **First-sign-in claim.** A person who has no PIN yet chooses one when first tapping their name. Anyone holding the device can tap that name first. Mitigation: the administrator sees "has not chosen a PIN yet" and should hand the device over directly.
- **Local only.** There is no server to revoke a person or a device remotely, no central lockout, and no sync between tablets. Each tablet is its own kitchen record.
- **Clock.** Lockout times use the device clock, which a person can change. Auto-lock uses elapsed time while the app runs.
- **Recovery.** If every administrator forgets their PIN there is no reset path; erasing the app and starting again deletes the data. A recovery design needs a server or a held recovery secret (open decision).
- **Not tested on a physical device.** Auto-lock after backgrounding relies on Android app-state events that the emulator tests only partly exercise.

## Verified vs intended
Verified in automated tests (see ANDROID_PASS_REPORT.md): PIN hash and check, weak PIN refusal, throttle policy, PIN reset permissions, audit chain intact after PIN events (core unit tests); in a browser: lock after idle time, wrong-PIN throttle, step-up on erase, first-sign-in PIN choice, drafts private to the person. Intended but not verified on a phone: lock after leaving the app, behaviour with a real on-screen keyboard and a secure-text field, throttle survival across a real process kill.

## Open decisions
Whether a second administrator is required; PIN length (4-6 now); whether approval needs a different PIN-holder than acknowledgement on the same tablet within N seconds; badge or NFC sign-in; what happens when the kitchen has no administrator available.
