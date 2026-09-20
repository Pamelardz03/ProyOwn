// Categorías de Whimm en uso — antes cada pantalla las derivaba solo de
// `whimms.categoria`, así que una categoría creada al vuelo desde un Gasto
// (tipo Whimm, campo `categoriaWhimm`) nunca se sumaba a la lista real y
// "se perdía" para el siguiente Gasto o Whimm que se agregara: dependía de
// desde qué pantalla abrieras el "+", porque tampoco todas pasaban `cats`
// a AddSheet. Ahora se deriva igual en todos lados a partir de las dos
// fuentes reales (whimms + gastos), así una categoría nueva persiste sin
// importar dónde se creó.
export function deriveWhimmCats(whimms, gastos) {
  return [...new Set([
    ...(whimms || []).map((w) => w.categoria),
    ...(gastos || []).map((g) => g.categoriaWhimm),
  ].filter(Boolean))]
}
