# Getting IngredientAlert onto an Android phone (no GitHub experience needed)

**What this is:** a test build of IngredientAlert, a tool for catching a substituted delivery at the door, getting it checked and approved by a second person, and keeping the menu's allergen information in step. You can try it with a **clearly labelled example kitchen** (made-up products and people) or **set up your own kitchen** on the device.

**What it is not:** it does not tell you whether a dish is safe. It supports trained people and your existing procedures. **There is no server**: the QR / web menu and the printer are simulated, and the app sends no notifications. Do not use it for real food-safety decisions yet. It has **not** been run on a physical phone by anyone; the only Android evidence so far comes from an emulator in the build system.

---

## Part 1: Install
1. On the phone, open Chrome and go to
   **https://github.com/Devilwalkx/ingredientalert/releases/tag/latest-test-build**
   (sign in to GitHub if asked).
2. Under **Assets** tap **IngredientAlert-test.apk**. If Chrome says the file could harm your device, tap **Download anyway**: this is a test build, not from the Play Store.
3. Open the file. If Android says it is not allowed to install unknown apps from this source, tap **Settings**, allow it, go back, tap **Install**. If Play Protect warns, tap **Install anyway** (the test build is signed with a public development key).
4. **One-time uninstall:** this build has a new application id (`app.devilwalkx.ingredientalert`). If an older IngredientAlert is installed, Android treats this as a different app. Uninstall the old one first (its made-up example data is lost, which is harmless).
5. Open it. You see **Set up my kitchen** and **Try the example kitchen**.

## Part 2: Check you have the right build
Open the app, sign in (or on the first screen tap **About this build**), then **Settings > About this build**. It shows the app ID (`app.devilwalkx.ingredientalert`), the version (0.2.0), the build number (the CI run number), the commit and the build time. The build number should match the number in the release notes. A build made on a developer machine says "development".

## Part 3: Permissions
The only permission is the **camera**, and the app asks only when you tap **Scan the barcode** on the delivery screen. It explains why first: it reads the number under the barcode, and pictures are not saved or sent. If you say no you can type the number or search by name. If Android has stopped asking, the screen says so and **Open Android settings** takes you to the app's settings. If the app asks for anything else (location, contacts, notifications), stop and tell me.

## Part 4: A five-minute tour of the main task (check a delivery, then review the substitution)
You will play several people on one device; that is only possible because the example kitchen has no PINs.
1. Tap **Try the example kitchen**, then tap **Alex Rivera** (goods-in).
2. Open **Settings > Demonstration tools (example kitchen only) > Fill in the replacement-sauce delivery**. (In a real kitchen you would scan or type what is on the pack; try **Scan the barcode** on a real pack if you want to test the camera.)
3. Tap **Next: check and save**, then **Save and check this delivery**. The app shows the order and the delivery **side by side**, with every difference marked **DIFFERENT**, and the status **Awaiting specification**.
4. Tap **Review this substitution**. Alex cannot enter a specification, and the screen says which role can. Tap the lock icon, choose **Priya Nair**, open **Settings > Demonstration tools > Fill in the supplier sheet for the new sauce**, open the review, **Save specification**, then **Show which recipes change**. The status is **Awaiting review**. Three recipes change. Notice that **Contains**, the supplier's **may contain** statements and the **kitchen cross-contact procedures** are three separate boxes.
5. Lock, choose **Sam Okoye**, open the review, **Approve this change**, **Yes, approve**. The status is **Approved revision**: it is not on any menu yet.
6. Open **Updates**, **Prepare revision 2**, update each place. Remember the QR / web menu and the printer are simulated. The printer fails in the example on purpose: **Publication incomplete** stays.
7. Lock, choose **Jo Bell**, **Menu for service and acknowledgement**, **I have seen revision 2**. **Staff acknowledgement outstanding** remains for Jess: nobody was messaged, and an acknowledgement only shows a person confirmed they saw it.

## Part 5: Your own kitchen
**Set up my kitchen** asks for the business name, the kitchen name, your name and a PIN (4 to 6 digits, not 0000 or 1234). You are the administrator and approver. In **Settings > Kitchen setup** add people (each chooses their own PIN when they first tap their name), products with the supplier specification evidence, and recipes. The app locks after 2 minutes without a tap (you can change it) and when you leave it for more than 30 seconds. A PIN says who is holding the device; it does not encrypt the data. If you uninstall the app or lose the device, the data is gone: there is no backup.

## If something goes wrong
| Problem | What to do |
|---|---|
| Link shows 404 | Sign in to GitHub and open it again. |
| "App not installed" | Uninstall any older IngredientAlert, then install again. |
| Camera will not scan | Good light, hold the barcode inside the frame, try the torch; otherwise type the number. Please tell me the pack and phone. |
| App opens then closes | Tell me the phone model, Android version and what you saw. |
| Top or bottom hidden behind the clock or buttons | Send a screenshot and the phone model. |
| Text too small or large | Settings > Display > Text size. The phone's own font size also applies. |
| **Cannot start safely** or **could not be opened** | The phone did not provide secure storage or the key is missing. The app stays locked on purpose. |
| Forgot a PIN | Another administrator opens Settings > Kitchen setup > People > Reset PIN. |
