package com.animuscrm.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

@CapacitorPlugin(name = "AnimusSecureStorage")
public class AnimusSecureStoragePlugin extends Plugin {
    private static final String ALIAS = "animus-device-credentials";

    private SecretKey key() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        if (!store.containsAlias(ALIAS)) {
            KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
            generator.init(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
            generator.generateKey();
        }
        return ((KeyStore.SecretKeyEntry) store.getEntry(ALIAS, null)).getSecretKey();
    }

    private SharedPreferences preferences() {
        return getContext().getSharedPreferences("animus-encrypted", Context.MODE_PRIVATE);
    }

    private boolean valid(PluginCall call) {
        if (!"push-device".equals(call.getString("key"))) {
            call.reject("Unsupported secure-storage key.");
            return false;
        }
        return true;
    }

    @PluginMethod
    public void set(PluginCall call) {
        if (!valid(call)) return;
        try {
            String value = call.getString("value");
            if (value == null || value.length() > 8192) { call.reject("Invalid credentials."); return; }
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key());
            cipher.updateAAD("push-device".getBytes(StandardCharsets.UTF_8));
            byte[] encrypted = cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));
            String data = Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP) + ":" + Base64.encodeToString(encrypted, Base64.NO_WRAP);
            if (!preferences().edit().putString("push-device", data).commit()) { call.reject("Credentials could not be saved."); return; }
            call.resolve();
        } catch (Exception error) { call.reject("Credentials could not be encrypted."); }
    }

    @PluginMethod
    public void get(PluginCall call) {
        if (!valid(call)) return;
        try {
            String data = preferences().getString("push-device", null);
            JSObject result = new JSObject();
            if (data == null) { result.put("value", (String) null); call.resolve(result); return; }
            String[] parts = data.split(":", 2);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, Base64.decode(parts[0], Base64.NO_WRAP)));
            cipher.updateAAD("push-device".getBytes(StandardCharsets.UTF_8));
            result.put("value", new String(cipher.doFinal(Base64.decode(parts[1], Base64.NO_WRAP)), StandardCharsets.UTF_8));
            call.resolve(result);
        } catch (Exception error) { call.reject("Device credentials could not be read. Pair this phone again."); }
    }

    @PluginMethod
    public void remove(PluginCall call) {
        if (!valid(call)) return;
        if (!preferences().edit().remove("push-device").commit()) { call.reject("Credentials could not be removed."); return; }
        call.resolve();
    }
}
