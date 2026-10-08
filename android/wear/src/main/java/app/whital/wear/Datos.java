package app.whital.wear;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/** Código del widget, último resumen y gastos rápidos pendientes de enviar. */
final class Datos {
    private static final String PREFS = "whital_reloj";
    private static final String BASE = "https://us-central1-admin-gastos-985f7.cloudfunctions.net/";

    private Datos() {}

    static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static String token(Context c) {
        return prefs(c).getString("token", "");
    }

    static void guardarToken(Context c, String token) {
        String limpio = token == null ? "" : token.trim();
        if (limpio.isEmpty() || limpio.equals(token(c))) return;
        prefs(c).edit().putString("token", limpio).remove("error").apply();
    }

    /** Descarga el resumen (el mismo que el widget). Si falla, deja el último valor bueno. */
    static void actualizar(Context c) {
        String token = token(c);
        if (token.isEmpty()) return;
        HttpURLConnection con = null;
        try {
            con = (HttpURLConnection) new URL(BASE + "datosWidget?t=" + token).openConnection();
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
            prefs(c).edit()
                    .putInt("paraHoy", json.optInt("paraHoy"))
                    .putInt("restanteSemana", json.optInt("restanteSemana"))
                    .putInt("presupuestoSemana", json.optInt("presupuestoSemana"))
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

    // --- Gastos rápidos: se mandan al momento; si no hay conexión quedan pendientes y se reintentan ---

    static int pendientes(Context c) {
        try {
            return new JSONArray(prefs(c).getString("pendientes", "[]")).length();
        } catch (Exception e) {
            return 0;
        }
    }

    /** Guarda el gasto como pendiente y trata de mandarlo. Regresa true si ya quedó en el servidor. */
    static synchronized boolean registrar(Context c, int monto) {
        try {
            JSONArray lista = new JSONArray(prefs(c).getString("pendientes", "[]"));
            lista.put(new JSONObject().put("id", java.util.UUID.randomUUID().toString().replace("-", "")).put("monto", monto));
            prefs(c).edit().putString("pendientes", lista.toString()).apply();
        } catch (Exception e) {
            return false;
        }
        return enviarPendientes(c);
    }

    /** Manda los pendientes uno por uno; el id evita duplicados si un reintento repite el envío. */
    static synchronized boolean enviarPendientes(Context c) {
        String token = token(c);
        if (token.isEmpty()) return false;
        try {
            JSONArray lista = new JSONArray(prefs(c).getString("pendientes", "[]"));
            while (lista.length() > 0) {
                JSONObject item = lista.getJSONObject(0);
                if (!enviar(token, item.getString("id"), item.getInt("monto"))) return false;
                JSONArray resto = new JSONArray();
                for (int i = 1; i < lista.length(); i++) resto.put(lista.get(i));
                lista = resto;
                prefs(c).edit().putString("pendientes", lista.toString()).apply();
            }
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private static boolean enviar(String token, String id, int monto) {
        HttpURLConnection con = null;
        try {
            con = (HttpURLConnection) new URL(BASE + "registrarGastoRapido").openConnection();
            con.setRequestMethod("POST");
            con.setDoOutput(true);
            con.setConnectTimeout(10000);
            con.setReadTimeout(20000);
            con.setRequestProperty("Content-Type", "application/json");
            con.getOutputStream().write(new JSONObject().put("t", token).put("monto", monto).put("id", id).toString().getBytes(StandardCharsets.UTF_8));
            return con.getResponseCode() == 200;
        } catch (Exception e) {
            return false;
        } finally {
            if (con != null) con.disconnect();
        }
    }
}
