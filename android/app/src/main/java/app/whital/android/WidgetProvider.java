package app.whital.android;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.res.ColorStateList;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.widget.RemoteViews;

import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;

import java.text.NumberFormat;
import java.util.Locale;
import java.util.concurrent.TimeUnit;

/**
 * Widget de pantalla de inicio (3x2 o 2x2): lo que puedes gastar hoy, lo que queda de la
 * semana y si hay un Whimm disponible. Toma los colores del tema de la app.
 */
public class WidgetProvider extends AppWidgetProvider {
    static final String ACCION_REFRESCAR = "app.whital.android.REFRESCAR";
    private static final String TRABAJO_PERIODICO = "whital-widget";
    private static final String URL_APP = "https://pamelardz03.github.io/ProyOwn/";

    @Override
    public void onUpdate(Context c, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) pintar(c, mgr, id);
        programarPeriodico(c);
        descargarAhora(c);
    }

    /**
     * Baja los datos en el momento (sin esperar a que Android programe una tarea) y repinta.
     * Si falla, queda el aviso en el widget y la tarea periódica lo reintenta.
     */
    private void descargarAhora(Context c) {
        final Context app = c.getApplicationContext();
        final PendingResult pendiente = goAsync();
        new Thread(() -> {
            try {
                Datos.actualizar(app);
                repintarTodos(app);
            } finally {
                pendiente.finish();
            }
        }).start();
    }

    @Override
    public void onEnabled(Context c) {
        programarPeriodico(c);
    }

    @Override
    public void onDisabled(Context c) {
        // Solo se deja de actualizar si ya no queda ningún widget (ni 3x2 ni 2x2).
        if (idsDeTodos(c).length == 0) WorkManager.getInstance(c).cancelUniqueWork(TRABAJO_PERIODICO);
    }

    private static int[] idsDeTodos(Context c) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(c);
        int[] grandes = mgr.getAppWidgetIds(new ComponentName(c, WidgetProvider.class));
        int[] chicos = mgr.getAppWidgetIds(new ComponentName(c, WidgetProviderChico.class));
        int[] todos = new int[grandes.length + chicos.length];
        System.arraycopy(grandes, 0, todos, 0, grandes.length);
        System.arraycopy(chicos, 0, todos, grandes.length, chicos.length);
        return todos;
    }

    @Override
    public void onReceive(Context c, Intent intent) {
        super.onReceive(c, intent);
        if (ACCION_REFRESCAR.equals(intent.getAction())) {
            programarPeriodico(c);
            descargarAhora(c);
        }
    }

    static void programarPeriodico(Context c) {
        Constraints red = new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build();
        PeriodicWorkRequest req = new PeriodicWorkRequest.Builder(ActualizarWorker.class, 15, TimeUnit.MINUTES).setConstraints(red).build();
        WorkManager.getInstance(c).enqueueUniquePeriodicWork(TRABAJO_PERIODICO, ExistingPeriodicWorkPolicy.KEEP, req);
    }

    static void pedirActualizacion(Context c) {
        programarPeriodico(c);
        Constraints red = new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build();
        WorkManager.getInstance(c).enqueue(new OneTimeWorkRequest.Builder(ActualizarWorker.class).setConstraints(red).build());
    }

    static void repintarTodos(Context c) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(c);
        for (int id : idsDeTodos(c)) pintar(c, mgr, id);
    }

    private static String dinero(int n) {
        NumberFormat nf = NumberFormat.getIntegerInstance(new Locale("es", "MX"));
        return (n < 0 ? "-$" : "$") + nf.format(Math.abs(n));
    }


    /** Rellena el widget: tres franjas (gastado hoy y semana / último gasto / Whimms). */
    private static void rellenar(Context c, RemoteViews v) {
        SharedPreferences p = Datos.prefs(c);
        boolean sinCodigo = Datos.token(c).isEmpty();
        boolean hayDatos = p.getBoolean("hayDatos", false);
        String error = p.getString("error", "");

        // Colores del tema de la app (el relleno se tiñe; en Android < 12 queda el vino).
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            v.setColorStateList(R.id.raiz, "setBackgroundTintList", ColorStateList.valueOf(Tema.relleno(p.getString("paleta", "vino"), p.getString("fondo", "beige"))));
        }

        if (sinCodigo || !hayDatos) {
            // Sin datos todavía: dice qué pasa en vez de quedarse en blanco.
            v.setTextViewText(R.id.monto, "—");
            v.setTextViewText(R.id.semanaValor, "");
            v.setTextViewText(R.id.ultimoMonto, "");
            if (sinCodigo) {
                v.setTextViewText(R.id.ultimoTema, "Falta el código");
                v.setTextViewText(R.id.whimmValor, "Toca para pegarlo");
            } else if ("codigo".equals(error)) {
                v.setTextViewText(R.id.ultimoTema, "Código inválido");
                v.setTextViewText(R.id.whimmValor, "Pégalo de nuevo");
            } else if ("red".equals(error)) {
                v.setTextViewText(R.id.ultimoTema, "Sin conexión");
                v.setTextViewText(R.id.whimmValor, "Toca ↻ para reintentar");
            } else {
                v.setTextViewText(R.id.ultimoTema, "Cargando…");
                v.setTextViewText(R.id.whimmValor, "");
            }
            return;
        }

        // 1/3: lo gastado hoy (cambia cada vez que registras un gasto) y la semana.
        v.setTextViewText(R.id.monto, dinero(p.getInt("gastoHoy", 0)));
        int gastoSemana = p.getInt("gastoSemana", 0);
        int presupuesto = p.getInt("presupuestoSemana", 0);
        v.setTextViewText(R.id.semanaValor, dinero(gastoSemana) + " de " + dinero(presupuesto));
        v.setTextColor(R.id.semanaValor, gastoSemana > presupuesto ? Tema.alerta() : 0xFFFFFFFF);

        // 2/3: el último gasto de hoy, solo tema y monto.
        if (p.getBoolean("hayUltimo", false)) {
            v.setTextViewText(R.id.ultimoTema, p.getString("ultimoTema", ""));
            v.setTextViewText(R.id.ultimoMonto, dinero(p.getInt("ultimoMonto", 0)));
        } else {
            v.setTextViewText(R.id.ultimoTema, "Sin gastos hoy");
            v.setTextViewText(R.id.ultimoMonto, "");
        }

        // 3/3: Whimms.
        int hoyWhimms = p.getInt("whimmsHoy", 0);
        int proximo = p.getInt("proximoWhimmDias", -1);
        String whimm;
        if (hoyWhimms > 0) whimm = hoyWhimms == 1 ? "Whimm hoy" : hoyWhimms + " Whimms hoy";
        else if (proximo > 0) whimm = "Whimm en " + proximo + (proximo == 1 ? " día" : " d");
        else whimm = "Sin Whimms";
        v.setTextViewText(R.id.whimmValor, whimm);
    }

    private static void enlazar(Context c, RemoteViews v, boolean sinCodigo) {
        // Tocar el widget: abre Whital (o pide el código si aún no hay).
        Intent abrir = sinCodigo
                ? new Intent(c, ConfigActivity.class)
                : new Intent(Intent.ACTION_VIEW, Uri.parse(URL_APP)).setPackage(c.getPackageName());
        v.setOnClickPendingIntent(R.id.raiz, PendingIntent.getActivity(c, 0, abrir, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));
        Intent refrescar = new Intent(c, WidgetProvider.class).setAction(ACCION_REFRESCAR);
        v.setOnClickPendingIntent(R.id.refrescar, PendingIntent.getBroadcast(c, 1, refrescar, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));
    }

    static RemoteViews crear(Context c) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget);
        rellenar(c, v);
        enlazar(c, v, Datos.token(c).isEmpty());
        return v;
    }

    static void pintar(Context c, AppWidgetManager mgr, int id) {
        mgr.updateAppWidget(id, crear(c));
    }
}
