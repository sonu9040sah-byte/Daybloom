# Daybloom — a free daily planner (mobile app)

A mobile-first visual day planner with a timeline, inbox, recurring tasks, reminders, focus timer and insights.
Every feature is unlocked. No account, no ads, no subscription. Your data stays in your browser (localStorage).

This is an original app inspired by timeline-style planners. It does not use any other app's name, logo or artwork.

## Run it in VS Code

**Option A: Live Server (easiest)**
1. Unzip the folder and open it in VS Code (File > Open Folder).
2. Install the "Live Server" extension (VS Code will suggest it).
3. Right-click `index.html` > "Open with Live Server".

**Option B: Node (no extension needed)**
1. Open the folder in VS Code, then open the terminal (Ctrl+`).
2. Run `node server.js` (or `npm start`).
3. Open http://localhost:5173

**Option C:** just double-click `index.html`. It works from the file system too.

## Features

- Day timeline with a live "now" line; click an empty slot to add a task there
- Drag a task to move it (15 min snapping); drag its bottom edge to resize
- Week strip with daily progress rings, plus Month view and Insights (completion rate, streak, focus minutes)
- Inbox for undated tasks; one click to schedule them onto the selected day
- Task icons, colors, notes, subtasks with progress, duplicate, delete
- Recurring tasks: daily, weekdays, weekly, monthly (delete one day or the whole series)
- Reminders (in-app toasts plus browser notifications once enabled; keep the tab open)
- Focus / Pomodoro timer (15/25/45/50 min) that logs focus time
- Light / dark / system theme, accent colors, 12h/24h clock, week start
- Export / import JSON backups

## Use it on Android

Daybloom is an installable web app (PWA): it works offline and runs full-screen like a normal app.

1. Put the folder online over HTTPS (needed for install and offline). Free, takes about a minute:
   - Netlify Drop: go to app.netlify.com/drop and drag the `daybloom` folder in, or
   - GitHub Pages: upload the files to a repo, then Settings > Pages.
2. Open the link in **Chrome on your phone**, tap the menu (⋮) > **Install app** (or **Add to Home screen**).
3. Open it from the home screen. Allow notifications from the in-app Notifications button for reminders.

Testing on the same Wi-Fi without hosting: run `node server.js` on your PC and open `http://<your-PC-IP>:5173` in phone Chrome. It works, but can't be installed or used offline over plain http.

On phones: tap a task to edit, drag the ⠿ grip to move it, drag the bottom edge to resize, swipe left/right to change day, drag a sheet's handle down to close it. Your data lives on each device separately; use Export / Import to move it between phone and PC.

## Make an APK

See `BUILD_APK.md`. A ready GitHub Actions workflow builds an installable `.apk` for free, with real background reminder notifications.

## Notes

- Opened on a computer, the app shows in a phone-width column, so it also previews fine in VS Code.
- Smooth motion: sheets slide up, day swipes slide, checkboxes pop with a small confetti burst, tasks lift while dragging, and your phone gives light haptic taps. Motion is reduced automatically if your phone has "reduce animations" turned on.

## Keyboard shortcuts (desktop preview only)

`n` new task · `t` today · `←` `→` change day · `1` `2` `3` Day / Month / Insights · `Esc` close

## Files

- `index.html`: page shell
- `css/styles.css`: styles
- `js/app.js`: all app logic
- `server.js`: optional zero-dependency static server

Tip: dragging tasks works best with a mouse; on touch screens, tap a task to edit its time.
