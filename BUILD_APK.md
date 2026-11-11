# Get an Android APK (free, no Android Studio needed)

## Option A: GitHub builds it for you (about 10 minutes)

1. Create a free account at github.com and make a **new repository** (any name, Public or Private).
2. Upload **everything in this folder** to it. On the repo page choose *Add file > Upload files* and drag all the files in.
   Make sure the hidden `.github` folder goes up too. If your browser skips hidden folders, drag the `.github/workflows/build-apk.yml` file in separately and keep the path.
3. Open the **Actions** tab. If asked, click "I understand my workflows, enable them".
4. Choose **Build Android APK** on the left, then **Run workflow**. It takes about 5 to 8 minutes.
5. When the run turns green, open it and download **daybloom-apk** from the Artifacts section at the bottom. Unzip it to get `app-debug.apk`.
6. Send the APK to your phone (WhatsApp, Drive, USB). Open it and allow "Install unknown apps" for that app when Android asks.

If the build fails, open the failed step in Actions and share the red error text with Claude.

## Option B: PWABuilder (no GitHub)

1. Host the folder on https (for example drag it onto app.netlify.com/drop).
2. Go to pwabuilder.com, paste your site link, and choose **Package for stores > Android**.
3. Download the package and install the APK it contains.

## Good to know

- This is a debug-signed APK. It is fine for installing on your own phone but not for uploading to the Play Store.
- Reminders in the APK are real Android notifications, scheduled with the phone's alarm system for the next 14 days, so they arrive even when the app is closed. They are rescheduled automatically whenever you add, edit or complete tasks, and after a phone restart.
- Data is stored on the phone. Use Export / Import in Settings to back it up.
- Each time you change the app, re-run the workflow to get a fresh APK.

## Turning reminders on (first launch)

1. Open Daybloom, tap the gear, then **Notifications**, and tap **Allow** on the permission prompt.
2. If Android opens the "Alarms & reminders" screen, switch it **on** for Daybloom so reminders arrive on time.
3. Set a **Reminder** (for example "10 min before") on each task that should alert you.
4. Some phones (Xiaomi, Oppo, Vivo, Samsung and others) kill background apps. If reminders are late or missing, go to Settings > Apps > Daybloom > Battery and choose **Unrestricted** (or "No restrictions"), and allow Autostart if your phone has that option.
