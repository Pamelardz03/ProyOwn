package app.whital.android;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.LayerDrawable;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.Gravity;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

/**
 * Pantalla del widget: vista previa en vivo, color de fondo y código de Whital
 * (Perfil > Widget). Se abre al agregar el widget y al reconfigurarlo.
 */
public class ConfigActivity extends Activity {
    private static final int VINO = 0xFF3A0F1F;
    private int widgetId = AppWidgetManager.INVALID_APPWIDGET_ID;

    private int dp(int v) {
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics()));
    }

    /** Círculo de color; el elegido lleva un anillo vino alrededor. */
    private LayerDrawable circulo(int color, boolean elegido) {
        GradientDrawable anillo = new GradientDrawable();
        anillo.setShape(GradientDrawable.OVAL);
        anillo.setColor(0x00000000);
        if (elegido) anillo.setStroke(dp(2), VINO);
        GradientDrawable relleno = new GradientDrawable();
        relleno.setShape(GradientDrawable.OVAL);
        relleno.setColor(color);
        LayerDrawable capas = new LayerDrawable(new GradientDrawable[]{anillo, relleno});
        capas.setLayerInset(1, dp(4), dp(4), dp(4), dp(4));
        return capas;
    }

    /** Fila de colores para el fondo del widget: "Tema" (el de la app) y los colores fijos. */
    private void armarColores() {
        final LinearLayout fila = findViewById(R.id.colores);
        fila.removeAllViews();
        final SharedPreferences p = Datos.prefs(this);
        String actual = p.getString("fondoWidget", "auto");
        for (final String opcion : Tema.OPCIONES) {
            boolean auto = "auto".equals(opcion);
            int color = Tema.fondoWidget(opcion, p.getString("paleta", "vino"), p.getString("fondo", "beige"));
            TextView t = new TextView(this);
            t.setBackground(circulo(color, opcion.equals(actual)));
            t.setGravity(Gravity.CENTER);
            t.setText(auto ? "Tema" : "");
            t.setTextColor(0xFFFFFFFF);
            t.setTextSize(8);
            t.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
            t.setContentDescription(auto ? "Color del tema de la app" : "Color " + opcion);
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(dp(36), dp(36));
            lp.setMarginEnd(dp(6));
            t.setOnClickListener(v -> {
                p.edit().putString("fondoWidget", opcion).apply();
                WidgetProvider.repintarTodos(getApplicationContext());
                armarColores();
                actualizarPrevia();
            });
            fila.addView(t, lp);
        }
    }

    /** Datos de ejemplo para la vista previa cuando aún no hay datos reales. */
    private SharedPreferences ejemplo() {
        SharedPreferences real = Datos.prefs(this);
        SharedPreferences d = getSharedPreferences("whital_demo", MODE_PRIVATE);
        d.edit()
                .putBoolean("hayDatos", true)
                .putInt("paraHoy", 85).putInt("gastoSemana", 334).putInt("presupuestoSemana", 840)
                .putBoolean("hayUltimo", true).putString("ultimoTema", "Café").putInt("ultimoMonto", 45)
                .putInt("whimmsHoy", 2).putInt("proximoWhimmDias", -1)
                .putString("paleta", real.getString("paleta", "vino"))
                .putString("fondo", real.getString("fondo", "beige"))
                .putString("fondoWidget", real.getString("fondoWidget", "auto"))
                .apply();
        return d;
    }

    /** Dibuja aquí el widget de verdad, con el color elegido, para ver cómo queda. */
    private void actualizarPrevia() {
        FrameLayout marco = findViewById(R.id.vistaPrevia);
        marco.removeAllViews();
        SharedPreferences fuente = Datos.prefs(this).getBoolean("hayDatos", false) ? Datos.prefs(this) : ejemplo();
        try {
            marco.addView(WidgetProvider.crearConPrefs(this, fuente).apply(this, marco));
        } catch (Exception e) {
            // si algo falla, simplemente no hay vista previa
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
        actualizarPrevia();

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
            final Context app = getApplicationContext();
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
