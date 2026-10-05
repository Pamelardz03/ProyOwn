package app.whital.android;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/** Código del widget, último resumen guardado y descarga desde la función de Firebase. */
final class Datos {
    private static final String PREFS = "whital";
    private static final String URL_DATOS = "https://us-central1-admin-gastos-985f7.cloudfunctions.net/datosWidget";

    private Datos() {}

    static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static String token(Context c) {
        return prefs(c).getString("token", "");
    }

    static void guardarToken(Context c, String token) {
        prefs(c).edit().putString("token", token.trim()).remove("error").apply();
    }

    /** Descarga el resumen y lo guarda. Si falla, deja el último valor bueno y anota el motivo. */
    static void actualizar(Context c) {
        String token = token(c);
        if (token.isEmpty()) return;
        HttpURLConnection con = null;
        try {
            con = (HttpURLConnection) new URL(URL_DATOS + "?t=" + token).openConnection();
            con.setConnectTimeout(10000);
            con.setReadTimeout(20000);
            int codigo = con.getResponseCode();
            if (codigo == 404) {
                prefs(c).edit().putString("error", "codigo").apply();
                return;
            }
            if (codigo != 200) {
                prefs(c).edit().putString("error", "red").apply();
                return;
            }
            StringBuilder sb = new StringBuilder();
            try (BufferedReader r = new BufferedReader(new InputStreamReader(con.getInputStream(), StandardCharsets.UTF_8))) {
                String linea;
                while ((linea = r.readLine()) != null) sb.append(linea);
            }
            JSONObject json = new JSONObject(sb.toString());
            JSONObject tema = json.optJSONObject("tema");
            prefs(c).edit()
                    .putInt("paraHoy", json.optInt("paraHoy"))
                    .putInt("restanteSemana", json.optInt("restanteSemana"))
                    .putInt("diasSemana", json.optInt("diasSemana"))
                    .putInt("whimmsHoy", json.optInt("whimmsHoy"))
                    .putInt("proximoWhimmDias", json.isNull("proximoWhimmDias") ? -1 : json.optInt("proximoWhimmDias", -1))
                    .putString("paleta", tema != null ? tema.optString("paleta", "vino") : "vino")
                    .putString("fondo", tema != null ? tema.optString("fondo", "beige") : "beige")
                    .putBoolean("hayDatos", true)
                    .putLong("actualizado", System.currentTimeMillis())
                    .remove("error")
                    .apply();
        } catch (Exception e) {
            prefs(c).edit().putString("error", "red").apply();
        } finally {
            if (con != null) con.disconnect();
        }
    }
}
