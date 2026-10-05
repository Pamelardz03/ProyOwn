package app.whital.android;

import androidx.browser.trusted.TrustedWebActivityDisplayMode;

import com.google.androidbrowserhelper.trusted.LauncherActivity;

/**
 * Abre Whital sin la barra del navegador. Con la verificación del dominio (assetlinks.json)
 * Chrome la quita; la barra de estado (hora, batería) se queda visible.
 */
public class MainActivity extends LauncherActivity {
    @Override
    protected TrustedWebActivityDisplayMode getDisplayMode() {
        return new TrustedWebActivityDisplayMode.DefaultMode();
    }
}
