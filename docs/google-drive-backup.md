# Link Google Drive to the DZOFT backup (one time, about 10 minutes)

After this, **Paramètres › Sauvegardes et données › « Sauvegarder sur Google Drive »** sends the encrypted backup
straight into your Google Drive, in a folder called **« DZOFT – Sauvegardes »**. No download, no manual upload.

What DZOFT can and cannot do with your Drive:
- It asks Google for the **`drive.file`** permission only: it can see and create **only the files it creates itself**.
  It never sees your other files.
- The backup file is encrypted in your browser with your password before it leaves your computer. Google stores a file
  it cannot read.
- Nothing about Google is stored on your computer by DZOFT. Google remembers that you allowed it; you can remove that
  permission at any time in your Google account (Security › Third-party access).

Google renames these menus from time to time; if a name differs slightly, look for the closest one.

## 1. Create the Google access (in your Google account)

1. Open <https://console.cloud.google.com/> with the Google account whose Drive should receive the backups.
2. At the top, project menu › **New project** › name: `DZOFT Sauvegardes` › **Create**, then select that project.
3. Menu › **APIs & Services › Library** › search **Google Drive API** › **Enable**.
4. Menu › **Google Auth Platform** (or **APIs & Services › OAuth consent screen**) › **Get started**:
   - App name: `DZOFT`, user support e-mail: your address;
   - Audience: **External**;
   - Contact e-mail: your address › accept › **Create**.
5. **Audience** › **Test users** › **Add users** › your own Google address › **Save**.
   (Leave the app in « Testing »: it is only for you.)
6. **Data access** › **Add or remove scopes** › tick
   `https://www.googleapis.com/auth/drive.file` (« See, edit, create, and delete only the specific Google Drive files
   you use with this app ») › **Update** › **Save**.
7. **Clients** › **Create client** › Application type **Web application** › name `DZOFT admin`:
   - **Authorized JavaScript origins** › **Add URI** › `https://rdzoagbe.github.io`
   - (no redirect URI needed) › **Create**.
8. Copy the **Client ID**. It looks like `123456789012-abc123….apps.googleusercontent.com`.
   It is not a secret (Google designs it to be visible in web pages). **Do not copy the « client secret »**: DZOFT
   does not need it, and it must never be pasted anywhere.

## 2. Paste it in DZOFT

Admin › **Paramètres › Sauvegardes et données › « Relier Google Drive (une seule fois) »** › paste the Client ID ›
**Enregistrer**. The button **« Sauvegarder sur Google Drive »** appears.

## 3. First backup

1. Type your backup password twice (the browser's password manager can remember it).
2. **« Sauvegarder sur Google Drive »**.
3. The first time only, a Google window opens: choose your account. Google shows « Google hasn't verified this app »
   because the app is yours and in testing: click **Continue**, then **Allow** access to the files DZOFT creates.
4. The message « ✓ Sauvegarde enregistrée dans Google Drive » appears with a link to the file.

Next times: password, one click. If Google asks again (it may, from time to time), allow again.

## If the domain changes

When the site moves to `dzoft.fr`, add `https://dzoft.fr` (and `https://www.dzoft.fr` if used) to the
**Authorized JavaScript origins** of the same client (step 7).
