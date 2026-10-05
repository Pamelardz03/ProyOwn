package app.whital.android;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.widget.Button;
import android.widget.EditText;
import android.widget.Toast;

/** Pega aquí el código que sale en Whital > Perfil > Widget. */
public class ConfigActivity extends Activity {
    private int widgetId = AppWidgetManager.INVALID_APPWIDGET_ID;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        // Si se cierra sin guardar al agregar el widget, Android lo cancela.
        setResult(RESULT_CANCELED);
        setContentView(R.layout.config);

        Intent i = getIntent();
        if (i.getExtras() != null) widgetId = i.getExtras().getInt(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);

        EditText campo = findViewById(R.id.codigo);
        campo.setText(Datos.token(this));

        Button pegar = findViewById(R.id.pegar);
        pegar.setOnClickListener(v -> {
            ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
            ClipData clip = cm.getPrimaryClip();
            if (clip != null && clip.getItemCount() > 0 && clip.getItemAt(0).getText() != null) campo.setText(clip.getItemAt(0).getText().toString().trim());
        });

        Button guardar = findViewById(R.id.guardar);
        guardar.setOnClickListener(v -> {
            String codigo = campo.getText().toString().trim();
            if (!codigo.matches("[0-9a-f]{48}")) {
                Toast.makeText(this, "El código debe tener 48 caracteres. Cópialo desde Whital > Perfil > Widget.", Toast.LENGTH_LONG).show();
                return;
            }
            Datos.guardarToken(this, codigo);
            guardar.setEnabled(false);
            guardar.setText("Conectando…");
            // Se comprueba el código ahora mismo: así el widget nace ya con datos (o con el aviso claro).
            final android.content.Context app = getApplicationContext();
            new Thread(() -> {
                Datos.actualizar(app);
                runOnUiThread(() -> {
                    if ("codigo".equals(Datos.prefs(app).getString("error", ""))) {
                        Toast.makeText(this, "Ese código no es válido. Cópialo de nuevo desde Whital > Perfil > Widget.", Toast.LENGTH_LONG).show();
                        guardar.setEnabled(true);
                        guardar.setText("Guardar");
                        return;
                    }
                    WidgetProvider.repintarTodos(app);
                    WidgetProvider.programarPeriodico(app);
                    if (widgetId != AppWidgetManager.INVALID_APPWIDGET_ID) {
                        setResult(RESULT_OK, new Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId));
                    }
                    finish();
                });
            }).start();
        });
    }
}
