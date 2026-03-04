// backend/src/config/scripts-content.ts
// Script steps hardcodeados extraídos de los PDFs oficiales de Bradescard
// NO se usan PDFs en runtime — estos datos son estáticos y compilan igual en local y Vercel

// Script FRAUDE (INBOUND) - Pasos obligatorios del script
export const SCRIPT_FRAUDE_STEPS = {
  bienvenida: [
    'Saludo: "Monitoreo bradescard, te atiende [nombre] ¿con quién tengo el gusto?"',
    'Identificar motivo: "¿En qué te puedo ayudar?"'
  ],
  autenticacion: [
    'CallerID: "Por favor, indícame los últimos 4 dígitos de tu tarjeta. ¿Eres el/la titular?"',
    'OTP SMS: "En unos momentos, recibirás un mensaje de texto con un código de seguridad de 4 dígitos"',
    'OTP Email (fallback): "Voy a enviar el código al correo electrónico que está registrado"',
    'Fallo: "Por motivos de seguridad, no puedo brindarte información hasta confirmar que estoy hablando con el titular"'
  ],
  sondeo: [
    '"¿Me podrías indicar la fecha, cantidad o nombre del comercio de la compra que no reconoce?"',
    '"¿Recibiste algún mensaje de texto?"',
    '"En el sistema aparece una transacción del día XX por $XXX en XXX. ¿Reconoces este movimiento?"',
    '"¿Tienes la tarjeta de crédito contigo?"',
    '"¿Hay alguien más que utilice tu tarjeta?"'
  ],
  bloqueo_con_afectacion: [
    '"Debido a que los datos de tu tarjeta se encuentran comprometidos, vamos a hacer el bloqueo definitivo"',
    '"Se cobrará $250 pesos más IVA por investigación si las compras resultaron ser tuyas"',
    '"¿Estás de acuerdo con continuar?"'
  ],
  bloqueo_sin_afectacion: [
    '"Debido a que los datos de tu tarjeta se encuentran comprometidos, será necesario generar el bloqueo definitivo"'
  ],
  recapitulacion: [
    '"Te confirmo que estoy generando la aclaración de [#CNR] en [comercios] con fechas [rango], ¿correcto?"',
    '"La investigación tiene una duración de 60 días hábiles"',
    '"Te confirmo tu correo: [correo], ¿es correcto?"'
  ],
  reposicion: [
    'C&A/Bodega/GCC: "Es necesario que acudas a la sucursal participante más cercana, lleva tu identificación oficial"',
    'Suburbia/LOB: "Tu reposición llegará a tu domicilio en un lapso de 15 días hábiles"'
  ],
  despedida: [
    '"Por último, te recomiendo descargar nuestra aplicación bradescard"',
    '"Por mi parte sería todo, [nombre] te atendió [nombre y apellido]"',
    '"Te transfiero a una breve encuesta para calificar el servicio"'
  ]
};

// Script MONITOREO (OUTBOUND) - Pasos obligatorios
export const SCRIPT_MONITOREO_STEPS = {
  inicio: [
    '"Buenos días/tardes/noches, ¿se encuentra el/la Sr./Sra./Srita. [Nombre y Apellido]?"'
  ],
  presentacion: [
    '"Mi nombre es [nombre] me comunico de Bradescard México para confirmar compras o pagos registradas en su tarjeta"',
    '"Terminación [últimos 4 dígitos de la tarjeta], ¿me puede apoyar a validarlos?"'
  ],
  mencion_compras: [
    '"Le voy a mencionar compras que aparecen en el sistema, si no reconoce alguna me lo indica"',
    '"Del día [X] por la cantidad de [$XXX] en el comercio [X] aprobada/rechazada"'
  ],
  si_confirma: [
    '"Ya que nos ha confirmado que usted realizó las compras, aplicaré un mantenimiento a su tarjeta"',
    '"Le pido esperar 5 minutos para volver a utilizarla"',
    'NOTA sistema: Ingresar tarjeta a APROBAR_HOTLIST en Falcon por 30+1 días'
  ],
  si_no_reconoce: [
    '"¿Cuenta con la tarjeta en su poder?"',
    '"¿Alguien más que esté haciendo uso de ella aparte de usted?"',
    '"Para evitar que se sigan haciendo compras que no reconozca, vamos a bloquear su tarjeta"'
  ],
  reposicion: [
    'C&A/Bodega/GCC: "Le agradeceré pasar a tienda por un nuevo plástico"',
    'Suburbia/LOB: "Su reposición llegará a su domicilio en un lapso de 15 días hábiles"'
  ],
  despedida: [
    '"Por último, le recomiendo descargar nuestra aplicación Bradescard"',
    '"Por mi parte sería todo, le atendió [nombre y apellido] de Bradescard México"'
  ]
};

// Script TH CONFIRMA (cuando cliente confirma movimientos en llamada de monitoreo)
export const SCRIPT_TH_CONFIRMA_STEPS = {
  inicio: [
    '"Buenos días/tardes/noches, ¿se encuentra el/la Sr./Sra./Srita. [Nombre]?"'
  ],
  presentacion: [
    '"Me comunico de Bradescard México para confirmar compras en su tarjeta terminación [4 dígitos]"'
  ],
  confirmacion_movimientos: [
    '"Le voy a mencionar compras que aparecen en el sistema"',
    '"Del día [X] por la cantidad de [$XXX] en [comercio], ¿reconoce este movimiento?"',
    '"Ya que confirmó que realizó las compras, aplicaré un mantenimiento"'
  ],
  accion_sistema: [
    'Ingresar tarjeta a APROBAR_HOTLIST en Falcon (30+1 días)',
    'Retirar bloqueo en Vision (BLKI/BLKT) si aplica',
    'Si es internet: ingresar a bypass y habilitar por 24 horas'
  ],
  despedida: [
    '"En un lapso no mayor a 30 minutos podrían comunicarse para el seguimiento"',
    '"Por mi parte sería todo, le atendió [nombre] de Bradescard México"'
  ]
};

export function getScriptForCallType(callType: string): object {
  const normalized = callType.toUpperCase();
  if (normalized.includes('MONITOREO')) return SCRIPT_MONITOREO_STEPS;
  if (normalized.includes('TH CONFIRMA') || normalized.includes('TH_CONFIRMA')) return SCRIPT_TH_CONFIRMA_STEPS;
  return SCRIPT_FRAUDE_STEPS; // Default: FRAUDE / INBOUND
}
