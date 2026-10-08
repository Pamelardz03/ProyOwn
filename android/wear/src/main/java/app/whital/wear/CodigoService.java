package app.whital.wear;

import com.google.android.gms.wearable.DataEvent;
import com.google.android.gms.wearable.DataEventBuffer;
import com.google.android.gms.wearable.DataMapItem;
import com.google.android.gms.wearable.WearableListenerService;

/** Recibe del teléfono el código del widget, para que no tengas que escribirlo en el reloj. */
public class CodigoService extends WearableListenerService {
    @Override
    public void onDataChanged(DataEventBuffer eventos) {
        for (DataEvent e : eventos) {
            if (e.getType() == DataEvent.TYPE_CHANGED && "/whital/codigo".equals(e.getDataItem().getUri().getPath())) {
                Datos.guardarToken(getApplicationContext(), DataMapItem.fromDataItem(e.getDataItem()).getDataMap().getString("t"));
            }
        }
    }
}
