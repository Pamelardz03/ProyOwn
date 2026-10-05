package app.whital.android;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.widget.RemoteViews;

import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;

import java.text.NumberFormat;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.concurrent.TimeUnit;

/** Widget de pantalla de inicio: cuánto puedes gastar hoy y tu próxima compra. */
public class WidgetProvider extends AppWidgetProvider {
    static final String ACCION_REFRESCAR = "app.whital.android.REFRESCAR";
    private static final String TRABAJO_PERIODICO = "whital-widget";
    private static final String URL_APP = "https://pamelardz03.github.io/ProyOwn/";

    @Override
    public void onUpdate(Context c, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) pintar(c, mgr, id);
        pedirActualizacion(c);
    }

    @Override
    public void onEnabled(Context c) {
        programarPeriodico(c);
    }

    @Override
    public void onDisabled(Context c) {
        WorkManager.getInstance(c).cancelUniqueWork(TRABAJO_PERIODICO);
    }

    @Override
    public void onReceive(Context c, Intent intent) {
        super.onReceive(c, intent);
        if (ACCION_REFRESCAR.equals(intent.getAction())) pedirActualizacion(c);
    }

    static void programarPeriodico(Context c) {
        Constraints red = new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build();
        PeriodicWorkRequest req = new PeriodicWorkRequest.Builder(ActualizarWorker.class, 30, TimeUnit.MINUTES).setConstraints(red).build();
        WorkManager.getInstance(c).enqueueUniquePeriodicWork(TRABAJO_PERIODICO, ExistingPeriodicWorkPolicy.KEEP, req);
    }

    static void pedirActualizacion(Context c) {
        programarPeriodico(c);
        Constraints red = new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build();
        WorkManager.getInstance(c).enqueue(new OneTimeWorkRequest.Builder(ActualizarWorker.class).setConstraints(red).build());
    }

    static void repintarTodos(Context c) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(c);
        for (int id : mgr.getAppWidgetIds(new ComponentName(c, WidgetProvider.class))) pintar(c, mgr, id);
    }

    static void pintar(Context c, AppWidgetManager mgr, int id) {
        SharedPreferences p = Datos.prefs(c);
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget);
        boolean sinCodigo = Datos.token(c).isEmpty();
        String error = p.getString("error", "");

        if (sinCodigo) {
            v.setTextViewText(R.id.monto, "Falta el código");
            v.setTextViewText(R.id.proxima, "Toca para pegarlo");
            v.setTextViewText(R.id.actualizado, "");
        } else if (!p.getBoolean("hayDatos", false)) {
            v.setTextViewText(R.id.monto, "Cargando…");
            v.setTextViewText(R.id.proxima, "");
            v.setTextViewText(R.id.actualizado, "codigo".equals(error) ? "El código no es válido" : "");
        } else {
            int hoy = p.getInt("paraHoy", 0);
            NumberFormat nf = NumberFormat.getIntegerInstance(new Locale("es", "MX"));
            v.setTextViewText(R.id.monto, (hoy < 0 ? "-$" : "$") + nf.format(Math.abs(hoy)));
            v.setTextColor(R.id.monto, hoy < 0 ? 0xFFFFB4B4 : 0xFFFFFFFF);
            String nombre = p.getString("proximaNombre", "");
            int dias = p.getInt("proximaDias", -1);
            String cuando = dias <= 0 ? "hoy" : dias == 1 ? "mañana" : "en " + dias + " días";
            v.setTextViewText(R.id.proxima, nombre.isEmpty() ? "Sin próxima compra" : nombre + " · " + cuando);
            String hora = new SimpleDateFormat("HH:mm", Locale.getDefault()).format(new Date(p.getLong("actualizado", 0)));
            v.setTextViewText(R.id.actualizado, "red".equals(error) ? "Sin conexión · último dato " + hora : "Actualizado " + hora);
        }

        // Tocar el widget: abre Whital (o pide el código si aún no hay).
        Intent abrir = sinCodigo
                ? new Intent(c, ConfigActivity.class)
                : new Intent(Intent.ACTION_VIEW, Uri.parse(URL_APP)).setPackage(c.getPackageName());
        v.setOnClickPendingIntent(R.id.raiz, PendingIntent.getActivity(c, 0, abrir, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));

        // Botón de refrescar.
        Intent refrescar = new Intent(c, WidgetProvider.class).setAction(ACCION_REFRESCAR);
        v.setOnClickPendingIntent(R.id.refrescar, PendingIntent.getBroadcast(c, 1, refrescar, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));

        mgr.updateAppWidget(id, v);
    }
}
