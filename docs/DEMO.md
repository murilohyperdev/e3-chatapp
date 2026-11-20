# Live demonstration script (item 8)

The exercise asks for **two independent sessions logged in as different user types**, showing chat, alert
delivery, location updates, permission enforcement, ending alerts, refresh/reconnection recovery and password
recovery. This is the script to follow during the video review (about 8 minutes).

## Before the call

```bash
docker compose up -d                  # backend, frontend, reverb, postgres, mailpit
docker compose exec backend php artisan migrate && docker compose exec backend php artisan db:seed   # first time only
./scripts/demo.sh --headless          # rehearsal: runs everything once, must end with "Demo finished"
```

* Open **two independent sessions**: a normal window for the administrator and a **private/incognito window** (or a
  second browser) for the user. Same browser profile would share cookies and sign one of them out.
* Administrator: `admin@example.com` / `password`. User: `user@example.com` / `password`. Place the windows side by side.
* Open Mailpit (http://localhost:8025) in a third tab for the password step.
* No alert should be active (the rehearsal ends its own).

## Script

| # | Scenario | Administrator window | User window | What to point out |
|---|----------|----------------------|-------------|-------------------|
| 1 | **Chat** | Type a message, press Send | It appears with the sender name, no refresh. Reply with Enter | One shared room over WebSockets (Reverb), sender name next to each message |
| 2 | **Permission enforcement** | "Start alert" button is visible | No Start/End buttons. DevTools console: `fetch('/api/alerts',{method:'POST',headers:{Accept:'application/json','X-XSRF-TOKEN':decodeURIComponent(document.cookie.match(/XSRF-TOKEN=([^;]+)/)[1])}})` → **403** | The UI hides it, the server enforces it (gates by ability). A visitor gets 401 |
| 3 | **Alert delivery** | Press **Start alert** | The "Alert: where are you?" modal opens by itself; it cannot be dismissed | Pushed through the `alerts` channel, no polling. Administrators are asked too |
| 4 | **Location updates** | Pick a square | Pick a square | Each pick shows the person's name in that square on **both** boards immediately. The first pick is final |
| 5 | **Refresh / reconnection** | Reload: pick and board are restored. In the user window: DevTools → Network → Offline | While offline, admin presses **End alert**. Set the user back to Online | After reconnecting the user sees "This alert has ended" without reloading (the client resyncs on reconnect) |
| 6 | **Ending alerts** | **End alert**, then **Start alert** again | Locations are closed on the ended alert; the new alert opens the modal and the board is empty | Ended alerts keep their record; a new alert starts clean |
| 7 | **Password recovery** | – | Sign out → "Forgot your password?" → enter `margaret@example.com` → open Mailpit, click the link → choose a new password → sign in. Try the link again: refused | One-use, expiring token; the old password stops working. Reset email is limited to one per minute per address |

After step 7 restore the account (run the same flow back to `password`) or use `./scripts/demo.sh --headless`,
which restores it automatically.

## Automated version

`./scripts/demo.sh` plays the same seven scenarios in two real browser windows, with a caption on each window:

```bash
./scripts/demo.sh                      # two windows side by side
./scripts/demo.sh --record             # also saves e2e/recordings/admin.webm and user.webm
./scripts/demo.sh --headless --record  # no windows; use it on a server or as a fallback recording
./scripts/demo.sh --slow 2             # slower pauses
```

It needs Chromium (`cd e2e && npm ci && npx playwright install chromium`, or `E2E_CHROMIUM_PATH`). It never
runs migrations, ends the alerts it starts and restores the password it changes. If something fails on camera,
play the recording and continue with the manual flow.

## Likely questions

* **Why two contexts and not two tabs?** Tabs share cookies; independent sessions need independent cookies and sockets.
* **How does the user get the alert without polling?** Laravel Reverb broadcasts an alert snapshot on a private
  channel authorised by the same session; the client also resyncs on reconnect, on a 409 and when the tab is visible again.
* **What stops a user from ending an alert?** The `end-alerts` gate on the route (403), tested in PHPUnit and in
  `e2e/tests/permissions.spec.ts`.
* **Where do emails go?** Mailpit, a local SMTP inbox at http://localhost:8025.
* **Known limitation:** the first location pick is final; one chat room; reset emails throttled to 1/min.
