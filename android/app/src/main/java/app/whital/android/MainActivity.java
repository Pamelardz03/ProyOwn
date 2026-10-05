package app.whital.android;

import android.view.WindowManager;

import androidx.browser.trusted.TrustedWebActivityDisplayMode;

import com.google.androidbrowserhelper.trusted.LauncherActivity;

/**
 * Abre Whital en pantalla completa: sin barra de estado ni de navegación (se ven al
 * deslizar desde el borde), así la app llega hasta los bordes con el color del tema.
 */
public class MainActivity extends LauncherActivity {
    @Override
    protected TrustedWebActivityDisplayMode getDisplayMode() {
        return new TrustedWebActivityDisplayMode.ImmersiveMode(true, WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES);
    }
}
