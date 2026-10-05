package app.whital.android;

import androidx.annotation.NonNull;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

/**
 * Recibe el aviso del servidor ("hay datos nuevos") cuando registras un gasto, y actualiza
 * el widget al instante. Es un mensaje de datos: no muestra ninguna notificación.
 */
public class WhitalMessagingService extends FirebaseMessagingService {
    @Override
    public void onNewToken(@NonNull String token) {
        Datos.guardarFcm(getApplicationContext(), token);
        Datos.registrarDispositivo(getApplicationContext());
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage mensaje) {
        if ("widget".equals(mensaje.getData().get("tipo"))) {
            Datos.actualizar(getApplicationContext());
            WidgetProvider.repintarTodos(getApplicationContext());
        }
    }
}
