// frontend/src/components/PlantillaGPFTab.tsx
// Tabla de referencia de la Plantilla Cierre de GPF — solo lectura

const PLANTILLA_DATA: Array<{
  categoria: string;
  entries: Array<{ tipoCierre: string; descripcion: string }>;
}> = [
  {
    categoria: 'Aclaración Simple',
    entries: [
      { tipoCierre: 'ATM', descripcion: 'Cuando el TH marca por disposición de efectivo y no se le otorga' },
      { tipoCierre: 'Cancelación de servicios', descripcion: 'Canceló algún servicio y se lo siguen cobrando' },
      { tipoCierre: 'Recid mecánica diferente', descripcion: 'En general cualquier cargo diferente' },
      { tipoCierre: 'Cargo duplicado', descripcion: 'Más de dos cargos misma cantidad, fecha, comercio' },
      { tipoCierre: 'Cargos adicionales no autorizados por mi', descripcion: 'Cargo no autorizado con tarjeta presente en rango de 15 minutos' },
      { tipoCierre: 'Devolución no aplicada', descripcion: 'No reconoce compra o no recibe devolución (5 días hábiles)' },
      { tipoCierre: 'Discrepancia y servicios', descripcion: 'No reconoce monto, agrega servicio' },
      { tipoCierre: 'Monto modificado', descripcion: 'Cargo por diferente cantidad' },
      { tipoCierre: 'No pagué / pagué otro medio', descripcion: 'No pagó pero se le cobró' },
    ],
  },
  {
    categoria: 'Aviso de Viaje',
    entries: [
      { tipoCierre: 'Aviso de viaje USA', descripcion: 'Aplica para cualquier estado de USA' },
      { tipoCierre: 'Aviso de viaje Extranjero', descripcion: 'Aplica para cualquier país extranjero' },
      { tipoCierre: 'Internet', descripcion: 'No reconoce compras por internet' },
      { tipoCierre: 'Clonación de banda magnética', descripcion: 'No reconoce compras por banda magnética entrada U' },
      { tipoCierre: 'Robo de credenciales', descripcion: 'No reconoce tarjeta, sin term dato' },
      { tipoCierre: 'Adicional no reconocida', descripcion: 'No reconoce tarjeta adicional o reposición' },
    ],
  },
  {
    categoria: 'Fraude/ROEXT',
    entries: [
      { tipoCierre: 'Doble emboso', descripcion: 'No reconoce compras con régimen o doble emboso ATC liberado' },
      { tipoCierre: 'Robada/Extraviada', descripcion: 'No cuenta con tarjeta por robo o extravío' },
      { tipoCierre: 'Actualización de datos no reconocida', descripcion: 'No reconoce cambio de datos en cuenta o teléfono' },
      { tipoCierre: 'Primeras partes', descripcion: 'No reconoce ningún cargo ni terminal V o D' },
      { tipoCierre: 'ATM', descripcion: 'No reconoce disposición en efectivo' },
      { tipoCierre: 'Sin firma en documentos', descripcion: 'Sin firma en documentos' },
      { tipoCierre: 'Se liberan tarjetas/cuenta', descripcion: 'Comentario de liberar en ASHS o caja de comentarios' },
      { tipoCierre: 'Sin datos del cliente', descripcion: 'Sin comentarios o se desiste documentación' },
      { tipoCierre: 'Validación cuenta nueva', descripcion: 'Sin comentarios o se desiste documentación' },
    ],
  },
  {
    categoria: 'Seguimiento de originación',
    entries: [
      { tipoCierre: 'Cancelaciones', descripcion: 'Cancelar cuenta o seguros' },
      { tipoCierre: 'Seguimiento de aclaración', descripcion: 'Seguimiento aclaración o cambio de status' },
      { tipoCierre: 'Estado de cuenta', descripcion: 'Sin comentarios o estado de cuenta' },
      { tipoCierre: 'Lugares y coberturas de pago', descripcion: 'Dudas en estado de cuenta' },
      { tipoCierre: 'Otros bloqueos', descripcion: 'Validación de crédito en la tarjeta' },
      { tipoCierre: 'Promociones', descripcion: 'Promociones no válidas' },
      { tipoCierre: 'Saldos', descripcion: 'Dudas en saldo' },
      { tipoCierre: 'Bloqueo BLK1', descripcion: 'No reconoce regla o score alto. Fecha de expiración. Nip incorrecto' },
      { tipoCierre: 'Bloqueo BKT', descripcion: 'Incorrecto' },
    ],
  },
  {
    categoria: 'Servicio al cliente',
    entries: [
      { tipoCierre: 'Sin registro en plataformas', descripcion: 'Sin registro en Falcon/VCAS/Vision' },
      { tipoCierre: 'MSI no permitido', descripcion: 'Rechazo cresp 302' },
      { tipoCierre: 'Ingreso incorrecto de CVV', descripcion: 'Validación de ingreso de salida' },
      { tipoCierre: 'Bloqueo P preventivo', descripcion: 'Bloqueo P desbloqueable BPTS' },
      { tipoCierre: 'VCAS/Visión', descripcion: 'OCC no registra aunque datos correctos' },
    ],
  },
  {
    categoria: 'Th confirma movimientos',
    entries: [
      { tipoCierre: 'Sin registro en plataformas', descripcion: 'Sin registro en Falcon/VCAS/Vision' },
      { tipoCierre: 'MSI no permitido', descripcion: 'Rechazo cresp 302' },
      { tipoCierre: 'Ingreso incorrecto de CVV', descripcion: 'Validación de ingreso de salida' },
      { tipoCierre: 'Bloqueo P preventivo', descripcion: 'Bloqueo P desbloqueable BPTS' },
    ],
  },
  {
    categoria: 'Th no pasa autenticación',
    entries: [
      { tipoCierre: 'No recibió OTP', descripcion: 'No recibió OTP aunque datos correctos' },
      { tipoCierre: 'Mal interpretación de datos', descripcion: 'Error de interpretación de datos' },
    ],
  },
  {
    categoria: 'General',
    entries: [
      { tipoCierre: 'Th no responde / llamada cortada', descripcion: 'No se escucha o se cortó la llamada antes de saber porque se comunicó el th' },
    ],
  },
];

export default function PlantillaGPFTab() {
  return (
    <div className="animate-fadeIn">
      <p className="mb-5 text-sm text-slate-400 leading-relaxed">
        Tabla de referencia para el Cierre de GPF. La <span className="text-teal-400 font-medium">Calificación</span> corresponde
        a la Categoría y la <span className="text-teal-400 font-medium">Sub-calificación</span> al Tipo de Cierre.
        Estos campos se registran automáticamente en cada auditoría proveniente de GPF.
      </p>

      <div className="rounded-2xl border border-slate-800 overflow-hidden">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-800/70 border-b border-slate-700/60">
              <th className="px-4 py-3 text-left text-xs font-semibold text-teal-400 uppercase tracking-wider w-48">
                Categoría (Calificación)
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-teal-400 uppercase tracking-wider w-64">
                Tipo de Cierre (Sub-calificación)
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-teal-400 uppercase tracking-wider">
                Descripción
              </th>
            </tr>
          </thead>
          <tbody>
            {PLANTILLA_DATA.map((group) =>
              group.entries.map((entry, idx) => (
                <tr
                  key={`${group.categoria}-${idx}`}
                  className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors"
                >
                  {idx === 0 && (
                    <td
                      rowSpan={group.entries.length}
                      className="px-4 py-2.5 align-top font-semibold text-white bg-slate-900/50 border-r border-slate-700/40 whitespace-nowrap"
                    >
                      {group.categoria}
                    </td>
                  )}
                  <td className="px-4 py-2.5 text-slate-300 border-r border-slate-800/40">
                    {entry.tipoCierre}
                  </td>
                  <td className="px-4 py-2.5 text-slate-400">
                    {entry.descripcion}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
