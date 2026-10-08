package app.whital.wear;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.Gravity;
import android.widget.LinearLayout;
import android.widget.TextView;

import com.google.android.gms.wearable.DataItem;
import com.google.android.gms.wearable.DataMapItem;
import com.google.android.gms.wearable.Wearable;

import java.text.NumberFormat;
import java.util.Locale;

/** Pantalla principal del reloj: lo que queda hoy, lo que queda de la semana y el "+" para un gasto rápido. */
public class MainActivity extends Activity {
    private static final int VINO = 0xFF3A0F1F;
    private TextView etiquetaHoy;
    private TextView montoHoy;
    private TextView semana;
    private TextView aviso;

    private int dp(int v) {
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics()));
    }

    private static String dinero(int n) {
        return (n < 0 ? "-$" : "$") + NumberFormat.getIntegerInstance(new Locale("es", "MX")).format(Math.abs(n));
    }

    private TextView texto(String t, int sp, boolean negrita, int color) {
        TextView v = new TextView(this);
        v.setText(t);
        v.setTextSize(sp);
        v.setTextColor(color);
        v.setGravity(Gravity.CENTER);
        v.setIncludeFontPadding(false);
        if (negrita) v.setTypeface(Typeface.DEFAULT_BOLD);
        return v;
    }

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        // Para pruebas con adb: --es codigo <código> guarda el código sin pasar por el teléfono.
        String porIntent = getIntent().getStringExtra("codigo");
        if (porIntent != null) Datos.guardarToken(this, porIntent);

        LinearLayout raiz = new LinearLayout(this);
        raiz.setOrientation(LinearLayout.VERTICAL);
        raiz.setGravity(Gravity.CENTER);
        raiz.setBackgroundColor(VINO);
        raiz.setPadding(dp(18), dp(14), dp(18), dp(10));

        etiquetaHoy = texto("Para gastar hoy", 12, false, 0xBFFFFFFF);
        montoHoy = texto("—", 40, true, Color.WHITE);
        semana = texto("", 14, false, Color.WHITE);
        aviso = texto("", 10, false, 0xFFFFC9C9);

        TextView mas = texto("+", 30, true, VINO);
        mas.setContentDescription("Registrar un gasto");
        GradientDrawable fondo = new GradientDrawable();
        fondo.setShape(GradientDrawable.OVAL);
        fondo.setColor(Color.WHITE);
        mas.setBackground(fondo);
        mas.setOnClickListener(v -> startActivity(new Intent(this, RegistroActivity.class)));

        raiz.addView(etiquetaHoy);
        raiz.addView(montoHoy);
        LinearLayout.LayoutParams lpSemana = new LinearLayout.LayoutParams(-2, -2);
        lpSemana.topMargin = dp(4);
        raiz.addView(semana, lpSemana);
        raiz.addView(aviso, new LinearLayout.LayoutParams(-2, -2));
        LinearLayout.LayoutParams lpMas = new LinearLayout.LayoutParams(dp(48), dp(48));
        lpMas.topMargin = dp(8);
        raiz.addView(mas, lpMas);
        setContentView(raiz);
        pintar();
    }

    @Override
    protected void onResume() {
        super.onResume();
        buscarCodigoEnTelefono();
        new Thread(() -> {
            Datos.enviarPendientes(this);
            Datos.actualizar(this);
            runOnUiThread(this::pintar);
        }).start();
    }

    /** Si el reloj aún no tiene el código, lo pide al teléfono (donde ya lo guardaste para el widget). */
    private void buscarCodigoEnTelefono() {
        if (!Datos.token(this).isEmpty()) return;
        try {
            Wearable.getDataClient(this).getDataItems(Uri.parse("wear://*/whital/codigo")).addOnSuccessListener(items -> {
                try {
                    for (DataItem item : items) {
                        Datos.guardarToken(this, DataMapItem.fromDataItem(item).getDataMap().getString("t"));
                    }
                } finally {
                    items.release();
                }
                if (!Datos.token(this).isEmpty()) onResume();
            });
        } catch (Exception e) {
            // sin Google Play Services en este dispositivo: se puede dar el código con adb
        }
    }

    private void pintar() {
        SharedPreferences p = Datos.prefs(this);
        int pend = Datos.pendientes(this);
        if (Datos.token(this).isEmpty()) {
            etiquetaHoy.setText("Whital");
            montoHoy.setText("—");
            montoHoy.setTextSize(TypedValue.COMPLEX_UNIT_SP, 30);
            semana.setText("Guarda el código del widget en el teléfono");
            semana.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);
            aviso.setText("");
            return;
        }
        semana.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        montoHoy.setTextSize(TypedValue.COMPLEX_UNIT_SP, 40);
        if (p.getBoolean("hayDatos", false)) {
            int hoy = p.getInt("paraHoy", 0);
            etiquetaHoy.setText("Para gastar hoy");
            montoHoy.setText(dinero(hoy));
            montoHoy.setTextColor(hoy < 0 ? 0xFFFFB4B4 : Color.WHITE);
            semana.setText("Semana " + dinero(p.getInt("restanteSemana", 0)) + " de " + dinero(p.getInt("presupuestoSemana", 0)));
        } else {
            semana.setText("Cargando…");
        }
        String error = p.getString("error", "");
        String nota = pend > 0 ? pend + (pend == 1 ? " gasto por enviar" : " gastos por enviar") : "";
        if ("codigo".equals(error)) nota = "Código inválido: renuévalo en el teléfono";
        else if ("red".equals(error) && nota.isEmpty()) nota = "Sin conexión";
        aviso.setText(nota);
    }
}
