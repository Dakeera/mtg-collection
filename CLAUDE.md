# MTG Collection — project rules for Claude

## What this is
A Magic: The Gathering collection and deck tracker, shipped as TWO versions from ONE repository:

1. **Web version (PWA)** — hosted on GitHub Pages. Used by everyone, including iPhone users. Starts empty; each person's data lives only in their own browser storage. Never ships the owner's personal collection.
2. **Android app (APK)** — built from the same web code wrapped with Capacitor. Ships EMPTY like the web version (no personal data inside the APK). The owner loads their collection once by restoring a backup file (More → Backup). Can use native Android capabilities.

## The parity rule (important — the owner asked for this explicitly)
- The two versions have DIFFERENT capabilities. For every feature or change, always think about both versions and offer a solution for each.
- They do not need to be identical. The Android version is expected to be more robust (e.g. live database file on the phone, automatic backups, better camera/OCR, file access).
- Do NOT let them drift far apart. Keep one shared codebase for everything that can be shared, and put platform-specific behavior behind a small platform layer (`isNative()` checks), not in forked copies.
- If a change cannot be shared or worked around, STOP and ask the owner for explicit approval before making the versions diverge. Say what each version will do differently and why.
- One push updates both: the web site and the APK are built and published together by the same GitHub Actions run.

## Working agreements
- Never push to GitHub without the owner's approval of the change first.
- Never commit the owner's personal collection data anywhere in the repo or the APK. Their data is loaded only by restoring their own backup file; keep the backup format (.sqlite/.json) restorable on both versions.
- The owner's real data lives on their phone. Updates must never overwrite or reset existing user data (storage keys stay stable; the app only ever starts empty or from a restored backup).
- The owner is not very familiar with GitHub: explain steps plainly and carefully.
- Existing app behaviors to preserve: confirm before +/- in deck viewer, verified-artwork gold checkmark, source dropdown with "add new", sleeve palette/photo crop, AI deck builder (Option A copy/paste, Option B own API key held in memory only), backup to share sheet / .sqlite / .json.

## Build & release
- Web: GitHub Pages serves the repo root (index.html, sw.js, manifest, icons). Android: `.github/workflows/android.yml` wraps the same files with Capacitor (appId com.dakeera.mtgdeckmaster, name "MtG DeckMaster") and publishes a signed APK to Releases on every push to main.
- The APK must always be signed with the same key (GitHub secrets ANDROID_KEYSTORE_BASE64, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS) so updates install over the old app and keep the user's data. Never change the appId or the key.
- Android-only code goes behind `window.Capacitor?.isNativePlatform()`; the shared index.html stays the single source for both.
- When a scan or printing change reveals that an existing entry's data is wrong, the app asks for approval and UPDATES THE EXISTING CARD. It must never create a duplicate card for that.
