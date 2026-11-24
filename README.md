# CorpoMerch Invoice (Android app)

Build the APK with GitHub (no Android Studio needed):

1. Create a new **private** repository on github.com.
2. Upload all files from this folder to it (including the hidden `.github` folder). If using git: `git init && git add . && git commit -m "app" && git branch -M main && git remote add origin <your repo url> && git push -u origin main`
3. Open the repo's **Actions** tab. The "Build Android APK" run starts automatically (about 5 to 8 minutes). You can also start it with "Run workflow".
4. When it is green, open the repo's **Releases** page on your phone, download `CorpoMerch-Invoice.apk` and install it (allow "Install unknown apps" for your browser when asked).

Every later push builds a new APK. All builds are signed with the same key, so a new APK installs over the old one and keeps your saved invoices.

Local development: `npm install`, `npm run build`, `npx cap sync android`.
