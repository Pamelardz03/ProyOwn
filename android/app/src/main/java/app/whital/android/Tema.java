package app.whital.android;

import android.graphics.Color;

/**
 * Colores del tema de Whital para el widget. Son los mismos rellenos que usa la app:
 * con fondo beige o blanco el relleno es el tono oscuro de la paleta; con gris oscuro,
 * el tono medio (el texto blanco se lee bien en ambos).
 */
final class Tema {
    private Tema() {}

    // paleta -> { relleno sobre fondo claro, relleno sobre fondo oscuro }
    private static int[] rellenos(String paleta) {
        switch (paleta) {
            case "rosa": return new int[]{0xFF8C1D4F, 0xFFB0366B};
            case "salvia": return new int[]{0xFF2F4A47, 0xFF4D7772};
            case "oceano": return new int[]{0xFF0F2A3F, 0xFF2C6A8F};
            case "ciruela": return new int[]{0xFF2B1A4A, 0xFF6A46B0};
            case "terracota": return new int[]{0xFF4A1F12, 0xFFA8502F};
            default: return new int[]{0xFF3A0F1F, 0xFF6E2641}; // vino
        }
    }

    static int relleno(String paleta, String fondo) {
        int[] c = rellenos(paleta == null ? "vino" : paleta);
        return "oscuro".equals(fondo) ? c[1] : c[0];
    }

    /** Rojo claro para cuando te pasaste del día (legible sobre cualquier relleno). */
    static int alerta() {
        return Color.parseColor("#FFB4B4");
    }
}
