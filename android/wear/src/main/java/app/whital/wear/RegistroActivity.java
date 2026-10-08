package app.whital.wear;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.Gravity;
import android.widget.LinearLayout;
import android.widget.TextView;

/** Teclado numérico para anotar un gasto rápido (solo el monto, en pesos). */
public class RegistroActivity extends Activity {
    private static final int VINO = 0xFF3A0F1F;
    private static final int MAX_DIGITOS = 5;
    private final StringBuilder digitos = new StringBuilder();
    private TextView pantalla;
    private boolean enviando = false;

    private int dp(int v) {
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics()));
    }

    private TextView tecla(String t, int fondoColor, int textoColor, Runnable alTocar) {
        TextView v = new TextView(this);
        v.setText(t);
        v.setTextSize(17);
        v.setTypeface(Typeface.DEFAULT_BOLD);
        v.setTextColor(textoColor);
        v.setGravity(Gravity.CENTER);
        v.setIncludeFontPadding(false);
        GradientDrawable f = new GradientDrawable();
        f.setShape(GradientDrawable.OVAL);
        f.setColor(fondoColor);
        v.setBackground(f);
        v.setOnClickListener(x -> alTocar.run());
        return v;
    }

    private void pintar() {
        pantalla.setText("$" + (digitos.length() == 0 ? "0" : digitos.toString()));
    }

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        LinearLayout raiz = new LinearLayout(this);
        raiz.setOrientation(LinearLayout.VERTICAL);
        raiz.setGravity(Gravity.CENTER);
        raiz.setBackgroundColor(VINO);

        pantalla = new TextView(this);
        pantalla.setTextSize(26);
        pantalla.setTypeface(Typeface.DEFAULT_BOLD);
        pantalla.setTextColor(Color.WHITE);
        pantalla.setGravity(Gravity.CENTER);
        pantalla.setIncludeFontPadding(false);
        raiz.addView(pantalla, new LinearLayout.LayoutParams(-2, dp(34)));

        String[][] filas = {{"1", "2", "3"}, {"4", "5", "6"}, {"7", "8", "9"}, {"<", "0", "ok"}};
        for (String[] fila : filas) {
            LinearLayout l = new LinearLayout(this);
            l.setGravity(Gravity.CENTER);
            for (final String t : fila) {
                TextView k;
                if ("<".equals(t)) {
                    k = tecla("⌫", 0x33FFFFFF, Color.WHITE, () -> {
                        if (digitos.length() > 0) digitos.setLength(digitos.length() - 1);
                        pintar();
                    });
                } else if ("ok".equals(t)) {
                    k = tecla("✓", Color.WHITE, VINO, this::guardar);
                } else {
                    k = tecla(t, 0x33FFFFFF, Color.WHITE, () -> {
                        if (digitos.length() < MAX_DIGITOS && !(digitos.length() == 0 && "0".equals(t))) digitos.append(t);
                        pintar();
                    });
                }
                LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(dp(38), dp(38));
                lp.setMargins(dp(3), dp(2), dp(3), dp(2));
                l.addView(k, lp);
            }
            raiz.addView(l, new LinearLayout.LayoutParams(-2, -2));
        }
        setContentView(raiz);
        pintar();
    }

    private void guardar() {
        if (enviando || digitos.length() == 0) return;
        final int monto = Integer.parseInt(digitos.toString());
        enviando = true;
        pantalla.setText("Guardando…");
        pantalla.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        new Thread(() -> {
            boolean enviado = Datos.registrar(this, monto);
            Datos.actualizar(this);
            runOnUiThread(() -> {
                pantalla.setText(enviado ? "Guardado ✓" : "Guardado,\npor enviar");
                pantalla.postDelayed(this::finish, 1100);
            });
        }).start();
    }
}
