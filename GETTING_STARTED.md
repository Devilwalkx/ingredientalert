# Getting IngredientAlert on your phone (no GitHub experience needed)

**What this is:** a test version of IngredientAlert. Everything in it is **made-up demonstration data**: a fictional bistro, fictional suppliers and fictional recipes. It shows how a kitchen could catch a substituted delivery, get it checked by a second person, and make sure every menu and every team member is on the same version.

**What it is not:** it does not tell you whether a dish is safe. It supports trained people and your existing kitchen procedures; it cannot replace them. Do not use it for real food-safety decisions. It has **not** been run on a real phone yet, so you are the first person to try the install.

You only need an Android phone and the link. You never use code, a command line or Git.

---

## Part 1: Install on an Android phone

1. **On your phone**, open Chrome and go to:
   **https://github.com/Devilwalkx/ingredientalert/releases/tag/latest-test-build**
2. If GitHub asks you to **sign in**, sign in with the Devilwalkx account (the project may be private).
3. Scroll to **Assets** and tap **IngredientAlert-test.apk**. The file downloads.
   - If Chrome says *"This type of file can harm your device"*, tap **Download anyway**. This is a test build, not from the Play Store.
4. When it finishes, tap **Open** (or open your **Downloads** folder and tap the file).
5. If Android says *"your phone isn't allowed to install unknown apps from this source"*, tap **Settings**, switch on **Allow from this source**, press the back arrow, then tap **Install**.
6. If **Play Protect** warns about an unrecognised app, tap **Install anyway**. This is expected: the test build is signed with a development key.
7. Tap **Open**. You should see a welcome card with **Start with the example kitchen**.

> The app asks for **no permissions** (no camera, no location, no internet). If Android asks for any, stop and tell me.

## Part 2: A two-minute tour (the replacement-sauce story)

**The story:** you ordered *Harbour Teriyaki Sauce*. A different sauce turned up in the box. It contains sesame and fish, which the old one did not. Two dishes use the sauce. Let's follow it.

1. Tap **Start with the example kitchen**. Home shows **To do: Nothing waiting**.
2. Tap the small **Demo options** button. This is where you choose who you are (the phone plays every staff member) and use demo helpers. Tap **Fill in the replacement-sauce delivery**.
3. You are now Alex, the receiving operator. The delivery form is filled in. Tap **Next: check and save**, then **Save and check this delivery**.
4. The app says **Needs checking**: the barcode is not in the approved list. Note the grey notice: *this does not prove the stock has been physically separated*. That is still your job.
5. Tap **Back to home**. The to-do says **1 delivery needs checking**. Try **Publish menu updates**: it refuses, because the dishes are now **UNKNOWN**.
6. **Demo options** -> **Fill in the supplier sheet for the new sauce**. You are now Priya, the reviewer. Tap **Open Harbour Teriyaki Sauce 1L review**, then **Save paperwork check**. (Open **Allergens** to see the answers: *Contains*, *May contain* and *Kitchen controls* are always separate.)
7. Tap **Show which recipes change**. Three recipes change: **House glaze** and the two dishes that use it (**Glazed salmon bowl**, **Glazed chicken rice**). Those are the "two nested recipes".
8. Priya cannot approve her own paperwork check. Tap **Switch to Sam (demo)** (the approver), then **Approve this change**, then read the confirmation and tap **Yes, approve**.
9. Tap **Go to Publish menu updates**, **Prepare revision 2**, **Yes, prepare revision 2**. Then update each place: **QR / web menu**, **Service view**, and **Printed menu**.
10. The **printed menu update fails** (the demo pretends the printer is off). It stays listed as **Update failed - still the old menu**. Home now shows **1 place still shows an old menu**. This is the point: a failure is never hidden.
11. **Demo options** -> **Jo** (service staff) -> **Menu for service**. Open **Allergens** on a dish, tap **I have seen revision 2** and confirm. Jess has not acknowledged yet, and the screen says so. Type **1** into *Is a printed menu out of date?* and tap **Check this copy**: it says **OUT OF DATE - replace this copy**.
12. To finish the story: **Demo options** -> switch **Printed-menu update fails** to OFF -> choose Sam -> **Publish menu updates** -> **Try Printed menu again**.

Other things to try: **Text size** on Home (Normal / Large / Extra large); **A delivery has arrived** -> *Write down now, check later*; **Settings and privacy** -> **Manager tools** (as Morgan).

## Part 3: Getting a newer version
Every time I publish a change, GitHub builds a new file (about 10 minutes). The same link in Part 1 always has the newest one. Download and install it again. If Android refuses, uninstall the old app first (this deletes the demo data, which is harmless).

## Part 4: iPhone
There is no iPhone app. A web version is built and attached to the same release page (`IngredientAlert-web.zip`) but it has not been put on a public web address, because that would make the demo visible to anyone.

## Part 5: If something goes wrong
| Problem | What to do |
|---|---|
| Link shows "404" | You are not signed in to GitHub. Sign in, then open the link again. |
| No **IngredientAlert-test.apk** under Assets | The build may still be running (about 10 minutes after my last update). Try later. |
| "App not installed" | Uninstall any older IngredientAlert, then install again. |
| App opens then closes | Tell me your phone model, Android version and what you saw. |
| The top or bottom of the screen is hidden behind the clock or buttons | Send me a screenshot and your phone model. (This was fixed once before on a sibling app; not yet confirmed on your phone.) |
| Text is too small or too big | Home -> **Text size**. The phone's own font-size setting also applies. |
| Screen says **Cannot start safely** or **could not be opened** | The phone did not provide secure storage or the key is missing. The app locks on purpose. Tell me the phone model. If you chose to erase or reinstall, the demo data is gone. |
| A button looks wrong or text overlaps | Screenshot, please, with the screen name. |

## GitHub words in plain English
- **Repository (repo):** the project's folder on GitHub: `Devilwalkx/ingredientalert`.
- **Release:** a labelled download attached to the project. The `.apk` lives there.
- **Actions:** GitHub's built-in robot that runs the tests and builds the app each time I publish a change.
- **Branch:** a version line of the project. `main` is the official one; I also keep a working branch called `claude/h-gm8m50`.

You do **not** need to press any buttons on GitHub other than downloading the file.
