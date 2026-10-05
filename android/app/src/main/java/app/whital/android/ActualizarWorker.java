package app.whital.android;

import android.content.Context;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

/** Trabajo en segundo plano: baja el resumen y repinta los widgets. */
public class ActualizarWorker extends Worker {
    public ActualizarWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        Datos.asegurarFcm(getApplicationContext());
        Datos.actualizar(getApplicationContext());
        WidgetProvider.repintarTodos(getApplicationContext());
        return Result.success();
    }
}
