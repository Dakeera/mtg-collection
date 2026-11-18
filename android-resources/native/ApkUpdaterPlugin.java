package com.dakeera.mtgdeckmaster;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.provider.DocumentsContract;
import android.provider.OpenableColumns;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.annotation.ActivityCallback;
import java.io.ByteArrayOutputStream;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * In-app updates for MtG DeckMaster (Android only).
 * Downloads a new APK from GitHub Releases into the app's private cache, then opens Android's own
 * "Install" screen. Android always asks the user to confirm; an app can't install itself silently.
 * The new APK must be signed with the same key as the installed app or Android refuses to install it.
 */
@CapacitorPlugin(name = "ApkUpdater")
public class ApkUpdaterPlugin extends Plugin {

    private File updatesDir() {
        File dir = new File(getContext().getCacheDir(), "updates");
        if (!dir.exists()) dir.mkdirs();
        return dir;
    }

    private boolean allowed() {
        return Build.VERSION.SDK_INT < 26 || getContext().getPackageManager().canRequestPackageInstalls();
    }

    @PluginMethod
    public void canInstall(PluginCall call) {
        JSObject r = new JSObject();
        r.put("allowed", allowed());
        call.resolve(r);
    }

    @PluginMethod
    public void openInstallSettings(PluginCall call) {
        try {
            Intent i = Build.VERSION.SDK_INT >= 26
                ? new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()))
                : new Intent(Settings.ACTION_SECURITY_SETTINGS);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            call.resolve();
        } catch (Exception e) {
            call.reject("Couldn't open the settings: " + e.getMessage());
        }
    }

    @PluginMethod
    public void download(PluginCall call) {
        final String url = call.getString("url");
        final String name = call.getString("name", "update.apk");
        if (url == null || !url.startsWith("https://")) {
            call.reject("The update address isn't a secure https link.");
            return;
        }
        new Thread(() -> {
            HttpURLConnection c = null;
            try {
                File dir = updatesDir();
                File[] old = dir.listFiles();
                if (old != null) for (File f : old) f.delete();
                File out = new File(dir, name.replaceAll("[^A-Za-z0-9._-]", "_"));
                URL u = new URL(url);
                int redirects = 0;
                while (true) {
                    c = (HttpURLConnection) u.openConnection();
                    c.setInstanceFollowRedirects(false);
                    c.setConnectTimeout(20000);
                    c.setReadTimeout(30000);
                    c.setRequestProperty("Accept", "application/octet-stream");
                    int code = c.getResponseCode();
                    if (code >= 300 && code < 400) {
                        String loc = c.getHeaderField("Location");
                        c.disconnect();
                        if (loc == null || ++redirects > 6) throw new IOException("too many redirects");
                        u = new URL(u, loc);
                        if (!"https".equals(u.getProtocol())) throw new IOException("insecure redirect");
                        continue;
                    }
                    if (code != 200) throw new IOException("server answered " + code);
                    break;
                }
                long total = c.getContentLength();
                long done = 0, last = 0;
                try (InputStream in = new BufferedInputStream(c.getInputStream()); OutputStream os = new FileOutputStream(out)) {
                    byte[] buf = new byte[65536];
                    int n;
                    while ((n = in.read(buf)) > 0) {
                        os.write(buf, 0, n);
                        done += n;
                        if (done - last > 262144) {
                            last = done;
                            JSObject p = new JSObject();
                            p.put("done", done);
                            p.put("total", total);
                            notifyListeners("progress", p);
                        }
                    }
                }
                if (total > 0 && done != total) throw new IOException("the download was incomplete");
                JSObject r = new JSObject();
                r.put("path", out.getAbsolutePath());
                r.put("size", done);
                call.resolve(r);
            } catch (Exception e) {
                call.reject("Download failed: " + e.getMessage());
            } finally {
                if (c != null) c.disconnect();
            }
        }).start();
    }

    @PluginMethod
    public void install(PluginCall call) {
        String path = call.getString("path");
        try {
            if (path == null) { call.reject("No update file."); return; }
            File f = new File(path);
            if (!f.exists() || !f.getCanonicalPath().startsWith(updatesDir().getCanonicalPath())) {
                call.reject("The downloaded update wasn't found. Please download it again.");
                return;
            }
            if (!allowed()) {
                JSObject r = new JSObject();
                r.put("needsPermission", true);
                call.resolve(r);
                return;
            }
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", f);
            Intent i = new Intent(Intent.ACTION_VIEW);
            i.setDataAndType(uri, "application/vnd.android.package-archive");
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            JSObject r = new JSObject();
            r.put("started", true);
            call.resolve(r);
        } catch (Exception e) {
            call.reject("Couldn't open the installer: " + e.getMessage());
        }
    }

    /* Opens the phone's file manager at Documents/MtG-DeckMaster (manual backups). Tries the Files app's folder view first, then any file manager. */
    @PluginMethod
    public void openFolder(PluginCall call) {
        String rel = call.getString("path", "Documents/MtG-DeckMaster");
        Uri doc = Uri.parse("content://com.android.externalstorage.documents/document/primary%3A" + Uri.encode(rel));
        /* 1) the phone's file browser opened INSIDE the backups folder (Android 8+); tapping a file hands it back to the app */
        try {
            Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
            i.addCategory(Intent.CATEGORY_OPENABLE);
            i.setType("*/*");
            if (Build.VERSION.SDK_INT >= 26) i.putExtra(DocumentsContract.EXTRA_INITIAL_URI, doc);
            startActivityForResult(call, i, "folderPicked");
            return;
        } catch (Exception e) { /* fall back below */ }
        /* 2) older ways: ask a file manager to show the folder */
        String[] types = {"vnd.android.document/directory", "resource/folder"};
        for (String t : types) {
            try {
                Intent i = new Intent(Intent.ACTION_VIEW);
                i.setDataAndType(doc, t);
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);
                getContext().startActivity(i);
                JSObject r = new JSObject(); r.put("opened", true); r.put("how", t); call.resolve(r); return;
            } catch (Exception e) { /* try the next way */ }
        }
        call.reject("No file manager app was found.");
    }

    @ActivityCallback
    private void folderPicked(PluginCall call, ActivityResult result) {
        if (call == null) return;
        JSObject r = new JSObject(); r.put("opened", true);
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) { r.put("picked", false); call.resolve(r); return; }
        Uri u = result.getData().getData();
        String name = "backup";
        try (Cursor c = getContext().getContentResolver().query(u, null, null, null, null)) {
            if (c != null && c.moveToFirst()) { int ix = c.getColumnIndex(OpenableColumns.DISPLAY_NAME); if (ix >= 0) name = c.getString(ix); }
        } catch (Exception e) { /* keep default name */ }
        try (InputStream in = getContext().getContentResolver().openInputStream(u)) {
            ByteArrayOutputStream out = new ByteArrayOutputStream(); byte[] buf = new byte[65536]; int n; long tot = 0;
            while ((n = in.read(buf)) > 0) { tot += n; if (tot > 60L * 1024 * 1024) { call.reject("That file is too big to open (over 60 MB)."); return; } out.write(buf, 0, n); }
            r.put("picked", true); r.put("name", name); r.put("data", Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP));
            call.resolve(r);
        } catch (Exception e) { call.reject("Couldn't read that file: " + e.getMessage()); }
    }
}
