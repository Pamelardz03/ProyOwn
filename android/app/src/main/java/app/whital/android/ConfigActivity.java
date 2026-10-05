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

    private int dp(int v) {
        return Math.round(android.util.TypedValue.applyDimension(android.util.TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics()));
    }

    /** Fila de colores para el fondo del widget: "Tema" (el de la app) y los colores fijos. */
    private void armarColores() {
        final android.widget.LinearLayout fila = findViewById(R.id.colores);
        fila.removeAllViews();
        String actual = Datos.prefs(this).getString("fondoWidget", "auto");
        android.content.SharedPreferences p = Datos.prefs(this);
        for (final String opcion : Tema.OPCIONES) {
            boolean auto = "auto".equals(opcion);
            int color = Tema.fondoWidget(opcion, p.getString("paleta", "vino"), p.getString("fondo", "beige"));
            android.graphics.drawable.GradientDrawable forma = new android.graphics.drawable.GradientDrawable();
            forma.setColor(color);
            forma.setCornerRadius(dp(16));
            boolean elegido = opcion.equals(actual);
            forma.setStroke(dp(elegido ? 3 : 1), elegido ? 0xFF1A1208 : 0x55000000);
            android.widget.TextView t = new android.widget.TextView(this);
            t.setBackground(forma);
            t.setGravity(android.view.Gravity.CENTER);
            t.setText(auto ? "Tema" : "");
            t.setTextColor(0xFFFFFFFF);
            t.setTextSize(11);
            t.setContentDescription(auto ? "Color del tema de la app" : "Color " + opcion);
            android.widget.LinearLayout.LayoutParams lp = new android.widget.LinearLayout.LayoutParams(auto ? dp(52) : dp(32), dp(32));
            lp.setMarginEnd(dp(6));
            t.setOnClickListener(v -> {
                p.edit().putString("fondoWidget", opcion).apply();
                WidgetProvider.repintarTodos(getApplicationContext());
                armarColores();
            });
            fila.addView(t, lp);
        }
    }

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
        armarColores();

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
                    Datos.asegurarFcm(app);
                    if (widgetId != AppWidgetManager.INVALID_APPWIDGET_ID) {
                        setResult(RESULT_OK, new Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId));
                    }
                    finish();
                });
            }).start();
        });
    }
}
