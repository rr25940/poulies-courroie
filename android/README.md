# Publishing Poulies-courroies on Google Play

The Android app is a **Trusted Web Activity (TWA)**: a small Android app that opens
the website full screen, without a browser bar. The Python server is not inside
the app, so the website must be online over HTTPS first.

Do the steps in order. The parts marked **you** need your accounts, payment or
identity, so nobody else can do them for you.

## 1. Put the website online (you, about 20 minutes)

1. Create a GitHub account and an empty repository, then push the `webapp` folder:
   ```powershell
   cd D:\server\douda\webapp
   git add -A
   git commit -m "Poulies-courroies"
   git remote add origin https://github.com/YOUR-NAME/poulies-courroies.git
   git push -u origin main
   ```
2. Create a Render account at https://render.com and sign in with GitHub.
3. **New → Blueprint**, pick the repository, then **Apply**. Render reads `render.yaml`.
4. Wait for "Live", then open the address Render gives you, for example
   `https://poulies-courroies.onrender.com`. Check that `/privacy` and `/healthz` open.

The free plan sleeps after 15 minutes without visits, and the first visit after that takes
about a minute. For a store app, the paid "Starter" plan avoids that wait.

## 2. Build the app bundle (one command)

Docker Desktop must be running. From the `webapp` folder:
```powershell
.\android\build-aab.ps1 -Url https://poulies-courroies.onrender.com/
```
The first run downloads about 1 GB into a Docker image. The script then:
- creates your **upload key** in `android\keystore\` and `android\keystore.properties` (only once),
- builds `android\dist\poulies-courroies-1.0.0-1.aab` and checks its signature,
- prints the upload key's **SHA-256 fingerprint**. Keep it for step 4.

**Back up `android\keystore\` and `android\keystore.properties`** on a USB stick or in a
password manager. You need them for every update. They are never committed to git.

## 3. Create the Play Console account and the app (you)

1. Go to https://play.google.com/console and register as a developer: one-time
   fee of 25 US dollars, identity check with an ID document and a phone number.
   A personal account is fine.
2. **Create app**: name *Poulies-courroies*, default language *French*, *App*, *Free*.
3. Fill **Policy → App content** and **Store listing** with the answers and texts in
   [`store/listing.md`](store/listing.md), and upload the images from `store/`.

## 4. Link the app and the website (Digital Asset Links)

Without this link, the app shows a browser address bar at the top.

1. In Play Console: **Test and release → Closed testing → Create track**, then upload
   the `.aab` from `android\dist\`. Accept **Play App Signing** when asked.
2. Open **Test and release → App integrity → App signing**, and copy the
   **App signing key certificate → SHA-256 certificate fingerprint**.
3. In Render, service **Environment**, set `ANDROID_SHA256_CERT_FINGERPRINT` to
   both fingerprints separated by a comma: `<Play app-signing SHA-256>,<upload key SHA-256 from step 2>`.
   Save. Render restarts the site.
4. Open `https://YOUR-SITE/.well-known/assetlinks.json` and check that both fingerprints appear.

## 5. Closed test: 12 testers for 14 days (you)

New personal developer accounts must run a closed test with at least **12 testers who stay
opted in for 14 days in a row** before Google allows a public release.

1. In the closed testing track, **Testers**: add the Gmail addresses of 12 or more people
   (classmates, colleagues, family) who have an Android phone.
2. Send them the **opt-in link** shown on that page. Each tester opens it, accepts, and
   installs the app from Google Play.
3. Keep at least 12 of them opted in for 14 days. Ask them to really use the app.

## 6. Ask for production access and publish (you)

After the 14 days, Play Console offers **Apply for production**. Answer the short
questionnaire about your test, then create a **Production** release with the same
bundle. Google's review usually takes a few days.

## Updating the app later

The app shows the website, so most changes only need a new deploy of the website.
Rebuild the bundle only if the Android part changes (icon, name, URL, Android version).
Raise the version code each time:
```powershell
.\android\build-aab.ps1 -Url https://poulies-courroies.onrender.com/ -VersionCode 2 -VersionName 1.0.1
```
