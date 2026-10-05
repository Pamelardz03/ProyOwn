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
    private static final String URL_REGISTRO = "https://us-central1-admin-gastos-985f7.cloudfunctions.net/registrarDispositivoWidget";

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

    // --- Aviso instantáneo (FCM): el servidor sabe a qué teléfono avisar cuando registras un gasto ---

    static void guardarFcm(Context c, String fcm) {
        prefs(c).edit().putString("fcmToken", fcm).apply();
    }

    /** Pide el identificador de este teléfono (si falta) y lo registra en el servidor. */
    static void asegurarFcm(Context c) {
        final Context app = c.getApplicationContext();
        try {
            com.google.firebase.messaging.FirebaseMessaging.getInstance().getToken().addOnCompleteListener(tarea -> {
                if (tarea.isSuccessful() && tarea.getResult() != null) {
                    guardarFcm(app, tarea.getResult());
                    new Thread(() -> registrarDispositivo(app)).start();
                }
            });
        } catch (Exception e) {
            // sin Google Play Services: el widget sigue actualizándose cada 15 minutos
        }
    }

    /** Le dice al servidor "avísale a este teléfono"; solo lo hace si cambió el teléfono o el código. */
    static void registrarDispositivo(Context c) {
        String token = token(c);
        String fcm = prefs(c).getString("fcmToken", "");
        if (token.isEmpty() || fcm.isEmpty()) return;
        if (fcm.equals(prefs(c).getString("fcmEnviado", "")) && token.equals(prefs(c).getString("fcmCodigo", ""))) return;
        HttpURLConnection con = null;
        try {
            con = (HttpURLConnection) new URL(URL_REGISTRO).openConnection();
            con.setRequestMethod("POST");
            con.setDoOutput(true);
            con.setConnectTimeout(10000);
            con.setReadTimeout(20000);
            con.setRequestProperty("Content-Type", "application/json");
            byte[] cuerpo = new JSONObject().put("t", token).put("fcm", fcm).toString().getBytes(StandardCharsets.UTF_8);
            con.getOutputStream().write(cuerpo);
            if (con.getResponseCode() == 200) {
                prefs(c).edit().putString("fcmEnviado", fcm).putString("fcmCodigo", token).apply();
            }
        } catch (Exception e) {
            // se reintenta la próxima vez que el widget se actualice
        } finally {
            if (con != null) con.disconnect();
        }
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
            JSONObject ultimo = json.optJSONObject("ultimoGasto");
            prefs(c).edit()
                    .putInt("gastoHoy", json.optInt("gastoHoy"))
                    .putInt("gastoSemana", json.optInt("gastoSemana"))
                    .putInt("presupuestoSemana", json.optInt("presupuestoSemana"))
                    .putBoolean("hayUltimo", ultimo != null)
                    .putString("ultimoTema", ultimo != null ? ultimo.optString("tema") : "")
                    .putInt("ultimoMonto", ultimo != null ? ultimo.optInt("monto") : 0)
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
