# One-time Android setup
1. Repo -> Settings -> Secrets and variables -> Actions -> New repository secret. Add three secrets with the names/values in SECRETS_TO_ADD.txt (not stored in this repo).
2. Push to main (or Actions tab -> Build Android APK -> Run workflow). After ~5-10 minutes the APK appears under Releases.
3. On the phone: open Releases, download MtG-DeckMaster.apk, allow "install unknown apps" for your browser, install.
4. Open the app, More -> Backup -> Restore from a backup file.
