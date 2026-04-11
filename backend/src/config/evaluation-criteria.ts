//backend/src/config/evaluation-criteria.ts

export interface EvaluationTopic {
  topic: string;
  criticality: 'Crítico' | '-';
  points: number | 'n/a';
  applies: boolean;
  whatToLookFor?: string;
}

export interface EvaluationBlock {
  blockName: string;
  topics: EvaluationTopic[];
}

export const FRAUD_CRITERIA: EvaluationBlock[] = [
  {
    blockName: 'Falcon',
    topics: [
      { 
        topic: 'Cierre correcto del caso', 
        criticality: 'Crítico', 
        points: 5, 
        applies: true,
        whatToLookFor: 'En transcripción: agente cierra adecuadamente el caso informando pasos siguientes al cliente'
      },
      { 
        topic: 'Creación y llenado correcto del caso: (creación correcto del caso, selección de casillas, calificación de transacciones, comentarios correctos)', 
        criticality: '-', 
        points: 10, 
        applies: true,
        whatToLookFor: 'En capturas FALCON: caso creado correctamente, casillas marcadas, transacciones calificadas, comentarios completos'
      },
      { 
        topic: 'Ingresa a HOTLIST_APROBAR / Ingresa a HOTLIST_Rechazar', 
        criticality: '-', 
        points: 'n/a', 
        applies: false,
        whatToLookFor: 'No aplica para FRAUDE'
      },
      { 
        topic: 'Ingresa a HOTLIST_APROBAR', 
        criticality: '-', 
        points: 'n/a', 
        applies: false,
        whatToLookFor: 'No aplica para FRAUDE'
      },
      { 
        topic: 'Ingresa a HOTLIST_Rechazar', 
        criticality: '-', 
        points: 'n/a', 
        applies: false,
        whatToLookFor: 'No aplica para FRAUDE'
      },
      { 
        topic: 'Ingreso a HOTLIST_AVISO DE VIAJE', 
        criticality: '-', 
        points: 'n/a', 
        applies: false,
        whatToLookFor: 'No aplica para FRAUDE'
      },
      { 
        topic: 'Califica correctamente la llamada', 
        criticality: '-', 
        points: 'n/a', 
        applies: false,
        whatToLookFor: 'No aplica para FRAUDE'
      }
    ]
  },
  {
    blockName: 'Front',
    topics: [
      { 
        topic: 'Codificación correcta del caso', 
        criticality: 'Crítico', 
        points: 5, 
        applies: true,
        whatToLookFor: 'En capturas FRONT: caso codificado correctamente con el código apropiado para fraude'
      },
      { 
        topic: 'Llenado correcto del front (caso correcto, comentarios acorde a la gestión)', 
        criticality: '-', 
        points: 'n/a', 
        applies: false,
        whatToLookFor: 'No aplica para FRAUDE (se usa otra versión del tópico)'
      },
      { 
        topic: 'Llenado correcto del front (caso correcto, comentarios acorde a la gestión, tienen afectación/ sin afectación)', 
        criticality: '-', 
        points: 5, 
        applies: true,
        whatToLookFor: 'En capturas FRONT: comentarios detallados con indicación clara de si hay afectación o no'
      },
      { 
        topic: 'Sube capturas completas', 
        criticality: '-', 
        points: 'n/a', 
        applies: false,
        whatToLookFor: 'No aplica directamente'
      },
      { 
        topic: 'Colocar capturas completas y correctas', 
        criticality: '-', 
        points: 5, 
        applies: true,
        whatToLookFor: 'Verificar que existen capturas de FALCON, VCAS, VISION, VRM, BI - todas completas y legibles'
      },
      { 
        topic: 'Subir Excel', 
        criticality: '-', 
        points: 5, 
        applies: true,
        whatToLookFor: 'En capturas o transcripción: evidencia de Excel con movimientos subido al sistema'
      },
      { 
        topic: 'Califica correctamente la llamada', 
        criticality: '-', 
        points: 'n/a', 
        applies: false,
        whatToLookFor: 'No aplica en esta sección para FRAUDE'
      }
    ]
  },
  {
    blockName: 'Vcas',
    topics: [
      { 
        topic: 'Calificación de transacciones', 
        criticality: '-', 
        points: 'n/a', 
        applies: false,
        whatToLookFor: 'No aplica (se usa "Califica transacciones")'
      },
      { 
        topic: 'Aplica Bypass', 
        criticality: '-', 
        points: 'n/a', 
        applies: false,
        whatToLookFor: 'No aplica para FRAUDE'
      },
      { 
        topic: 'Bloquea tarjeta', 
        criticality: 'Crítico', 
        points: 5, 
        applies: true,
        whatToLookFor: 'En transcripción: agente menciona bloqueo de tarjeta. En capturas VCAS: status BLKI o bloqueo aplicado'
      },
      { 
        topic: 'Califica transacciones', 
        criticality: '-', 
        points: 5, 
        applies: true,
        whatToLookFor: 'En capturas VCAS: transacciones marcadas correctamente como fraude o legítimas según corresponda'
      },
      { 
        topic: 'Calificación de transacciones', 
        criticality: '-', 
        points: 'n/a', 
        applies: false,
        whatToLookFor: 'Duplicado, no aplica'
      },
      { 
        topic: 'Valida compras por facturar y cortes para identificar la compra para aclaración.\nValida que las compras no tengan una reversa', 
        criticality: '-', 
        points: 'n/a', 
        applies: false,
        whatToLookFor: 'No aplica para FRAUDE'
      }
    ]
  },
  {
    blockName: 'Vision',
    topics: [
      { 
        topic: 'Valida pantalla OFAA y CRESP (CVV2 incorrecto, Tarjeta vencida, Fecha de vencimiento incorrecta, TJ Cancelada, etc)', 
        criticality: '-', 
        points: 'n/a', 
        applies: false,
        whatToLookFor: 'No aplica para FRAUDE'
      },
      { 
        topic: 'Comentarios correctos en ASHI', 
        criticality: '-', 
        points: 5, 
        applies: true,
        whatToLookFor: 'En capturas VISION/ASHI: comentarios claros y completos sobre la gestión realizada'
      },
      { 
        topic: 'Desbloquea tarjeta BLKI, BLKT, BPT0, BNFC', 
        criticality: '-', 
        points: 'n/a', 
        applies: false,
        whatToLookFor: 'No aplica para FRAUDE (en fraude se BLOQUEA, no se desbloquea)'
      },
      {
        topic: 'Bloqueo correcto',
        criticality: 'Crítico',
        points: 7,
        applies: true,
        whatToLookFor: 'En capturas VISION: tipo de bloqueo correcto aplicado (BLKI para fraude)'
      },
      {
        topic: 'Valida compras en ARTD y ARSD',
        criticality: '-',
        points: 5,
        applies: true,
        whatToLookFor: 'En capturas VISION: transacciones validadas en pantallas ARTD y ARSD'
      }
    ]
  },
  {
    blockName: 'VRM',
    topics: [
      {
        topic: 'Calificación de transacciones, comentarios y aplica mantenimiento',
        criticality: 'Crítico',
        points: 10,
        applies: true,
        whatToLookFor: 'En VRM: transacciones calificadas correctamente, comentarios agregados, y mantenimiento aplicado'
      }
    ]
  },
  {
    blockName: 'B.I',
    topics: [
      { 
        topic: 'Crea el Folio Correctamente', 
        criticality: '-', 
        points: 10, 
        applies: true,
        whatToLookFor: 'En capturas BI: folio creado con todos los datos completos y correctos'
      }
    ]
  },
  {
    blockName: 'Manejo de llamada',
    topics: [
      {
        topic: 'Script: Saludo y bienvenida',
        criticality: '-',
        points: 2,
        applies: true,
        whatToLookFor: 'En transcripción: agente dice saludo tipo "Monitoreo bradescard, te atiende [nombre] ¿con quién tengo el gusto?" y pregunta "¿En qué te puedo ayudar?" o similar para identificar el motivo de la llamada.'
      },
      {
        topic: 'Script: Autenticación (CallerID / OTP)',
        criticality: '-',
        points: 4,
        applies: true,
        whatToLookFor: 'En transcripción: agente pide los últimos 4 dígitos de la tarjeta y confirma si es el/la titular. Solicita OTP por SMS ("recibirás un mensaje de texto con un código de seguridad") o por email como fallback. Si falla: informa que no puede brindar información sin confirmar identidad del titular.'
      },
      {
        topic: 'Script: Sondeo de movimientos',
        criticality: '-',
        points: 3,
        applies: true,
        whatToLookFor: 'En transcripción: agente pregunta fecha, cantidad o nombre del comercio no reconocido; pregunta si recibió mensaje de texto; menciona transacción específica del sistema y pregunta si la reconoce; pregunta si tiene la tarjeta en su poder; pregunta si hay alguien más que la utilice.'
      },
      {
        topic: 'Script: Información de bloqueo',
        criticality: '-',
        points: 3,
        applies: true,
        whatToLookFor: 'En transcripción: agente informa que datos de tarjeta están comprometidos y se realizará bloqueo definitivo; menciona costo de $250 pesos más IVA por investigación si las compras resultaron ser del cliente; solicita confirmación ("¿Estás de acuerdo con continuar?").'
      },
      {
        topic: 'Script: Recapitulación del caso',
        criticality: '-',
        points: 3,
        applies: true,
        whatToLookFor: 'En transcripción: agente confirma número CNR, comercios y rango de fechas de la aclaración; informa que la investigación dura 60 días hábiles; confirma correo electrónico del cliente.'
      },
      {
        topic: 'Script: Reposición de tarjeta',
        criticality: '-',
        points: 1,
        applies: true,
        whatToLookFor: 'En transcripción: agente informa el proceso de reposición. Si es C&A/Bodega/GCC: indica acudir a sucursal participante con identificación. Si es Suburbia/LOB: indica que llegará al domicilio en 15 días hábiles.'
      },
      {
        topic: 'Script: Despedida',
        criticality: '-',
        points: 1,
        applies: true,
        whatToLookFor: 'En transcripción: agente recomienda descargar la aplicación bradescard; se despide mencionando su nombre y apellido ("te atendió [nombre y apellido]"); transfiere a encuesta de calificación del servicio.'
      },
      {
        topic: 'Educación, frases de conexión, comunicación efectiva y escucha activa',
        criticality: '-',
        points: 5,
        applies: true,
        whatToLookFor: 'En transcripción: usa frases de empatía, responde adecuadamente a las inquietudes del cliente, escucha activamente'
      },
      {
        topic: 'Control de llamada y Puntualidad',
        criticality: '-',
        points: 6,
        applies: true,
        whatToLookFor: 'En transcripción: mantiene control de la conversación, no se desvía del tema, maneja objeciones adecuadamente'
      },
      {
        topic: 'Autentica correctamente',
        criticality: '-',
        points: 11,
        applies: true,
        whatToLookFor: 'En transcripción: realiza autenticación completa al inicio de la llamada (CallerID, OTP, o preguntas de seguridad según protocolo)'
      }
    ]
  }
];

export const TH_CONFIRMA_CRITERIA: EvaluationBlock[] = [
  {
    blockName: 'Falcon',
    topics: [
      {
        topic: 'Cierre correcto del caso',
        criticality: 'Crítico',
        points: 5,
        applies: true,
        whatToLookFor: 'En FALCON para TH CONFIRMA: verificar que el caso fue cerrado correctamente después de confirmar los movimientos. Buscar data.case_status = "Cerrado" y data.checkboxes_checked con opciones de confirmación.'
      },
      {
        topic: 'Creación y llenado correcto del caso: (creación correcto del caso, selección de casillas, calificación de transacciones, comentarios correctos)',
        criticality: '-',
        points: 10,
        applies: true,
        whatToLookFor: 'En FALCON: data.case_number debe existir, data.checkboxes_checked con 3+ items relevantes para TH CONFIRMA, data.transactions_marked = true (marcadas como legítimas), data.comment_text con descripción de confirmación del cliente.'
      },
      { 
        topic: 'Ingresa a HOTLIST_APROBAR / Ingresa a HOTLIST_Rechazar', 
        criticality: '-', 
        points: 'n/a', 
        applies: false,
        whatToLookFor: 'No aplica'
      },
      {
        topic: 'Ingresa a HOTLIST_APROBAR',
        criticality: '-',
        points: 12,
        applies: true,
        whatToLookFor: 'En capturas FALCON: evidencia de acceso a HOTLIST_APROBAR. La tarjeta debe ingresarse a lista de aprobados por 30+1 días calendario tras confirmar movimientos. Buscar data.hotlist_action o evidencia de aprobación en pantalla.'
      },
      { 
        topic: 'Ingresa a HOTLIST_Rechazar', 
        criticality: '-', 
        points: 'n/a', 
        applies: false,
        whatToLookFor: 'No aplica si aprobó'
      },
      { 
        topic: 'Ingreso a HOTLIST_AVISO DE VIAJE', 
        criticality: '-', 
        points: 'n/a', 
        applies: false,
        whatToLookFor: 'No aplica'
      },
      { 
        topic: 'Califica correctamente la llamada', 
        criticality: '-', 
        points: 'n/a', 
        applies: false,
        whatToLookFor: 'No aplica'
      }
    ]
  },
  {
    blockName: 'Front',
    topics: [
      {
        topic: 'Codificación correcta del caso',
        criticality: 'Crítico',
        points: 5,
        applies: true,
        whatToLookFor: 'En FRONT: data.case_code debe contener "TH CONFIRMA", "Confirma movimientos" o el código correcto para llamadas donde el cliente confirma sus movimientos. Buscar data.calificacion_tipo_llamada.'
      },
      {
        topic: 'Llenado correcto del front (caso correcto, comentarios acorde a la gestión)',
        criticality: '-',
        points: 5,
        applies: true,
        whatToLookFor: 'En FRONT: comentarios deben reflejar que el cliente confirmó los movimientos. data.comments_section debe mencionar la confirmación. Buscar también en FALCON: data.comment_text.'
      },
      { 
        topic: 'Llenado correcto del front (caso correcto, comentarios acorde a la gestión, tienen afectación/ sin afectación)', 
        criticality: '-', 
        points: 'n/a', 
        applies: false,
        whatToLookFor: 'No aplica'
      },
      { 
        topic: 'Sube capturas completas', 
        criticality: '-', 
        points: 'n/a', 
        applies: false,
        whatToLookFor: 'No aplica'
      },
      { 
        topic: 'Colocar capturas completas y correctas', 
        criticality: '-', 
        points: 5, 
        applies: true,
        whatToLookFor: 'Capturas necesarias'
      },
      { 
        topic: 'Subir Excel', 
        criticality: '-', 
        points: 5, 
        applies: true,
        whatToLookFor: 'Excel con movimientos'
      },
      {
        topic: 'Califica correctamente la llamada',
        criticality: '-',
        points: 5,
        applies: true,
        whatToLookFor: 'En FRONT: campo de calificación/tipo de llamada debe mostrar "TH CONFIRMA", "Confirma movimientos" o equivalente. Buscar data.calificacion_tipo_llamada que coincida con el tipo de llamada TH CONFIRMA.'
      }
    ]
  },
  {
    blockName: 'Vcas',
    topics: [
      {
        topic: 'Calificación de transacciones',
        criticality: '-',
        points: 10,
        applies: true,
        whatToLookFor: 'En TH CONFIRMA las transacciones se califican como LEGÍTIMAS (cliente las confirmó). En VCAS: transacciones marcadas como reconocidas o con calificación positiva. En FALCON: transacciones marcadas como legítimas.'
      },
      {
        topic: 'Aplica Bypass',
        criticality: '-',
        points: 'n/a',
        applies: false,
        whatToLookFor: 'No genera si es menos de 24hrs'
      },
      {
        topic: 'Bloquea tarjeta',
        criticality: 'Crítico',
        points: 5,
        applies: true,
        whatToLookFor: 'En TH CONFIRMA el cliente confirmó sus movimientos, por tanto se DESBLOQUEA la tarjeta. Buscar en VISION: código de desbloqueo retirado (BLKI/BLKT/BPT0/BNFC). En VCAS: account_status = ACTIVE (fue desbloqueada). En transcripción: agente menciona habilitar/desbloquear tarjeta.'
      },
      {
        topic: 'Califica transacciones',
        criticality: '-', 
        points: 'n/a', 
        applies: false,
        whatToLookFor: 'No aplica'
      },
      { 
        topic: 'Calificación de transacciones', 
        criticality: '-', 
        points: 'n/a', 
        applies: false,
        whatToLookFor: 'Duplicado'
      },
      { 
        topic: 'Valida compras por facturar y cortes para identificar la compra para aclaración.\nValida que las compras no tengan una reversa', 
        criticality: '-', 
        points: 'n/a', 
        applies: false,
        whatToLookFor: 'No aplica'
      }
    ]
  },
  {
    blockName: 'Vision',
    topics: [
      { 
        topic: 'Valida pantalla OFAA y CRESP (CVV2 incorrecto, Tarjeta vencida, Fecha de vencimiento incorrecta, TJ Cancelada, etc)', 
        criticality: '-', 
        points: 'n/a', 
        applies: false,
        whatToLookFor: 'No aplica'
      },
      { 
        topic: 'Comentarios correctos en ASHI', 
        criticality: '-', 
        points: 5, 
        applies: true,
        whatToLookFor: 'Comentarios en ASHI'
      },
      {
        topic: 'Desbloquea tarjeta BLKI, BLKT, BPT0, BNFC',
        criticality: '-',
        points: 5,
        applies: true,
        whatToLookFor: 'En VISION: verificar que el código de bloqueo fue RETIRADO. Buscar data.block_types_marked (debe estar vacío o con código de desbloqueo) y fechas de modificación. En VCAS: account_status = ACTIVE.'
      },
      {
        topic: 'Bloqueo correcto',
        criticality: 'Crítico',
        points: 'n/a',
        applies: false,
        whatToLookFor: 'No aplica (se desbloquea)'
      },
      {
        topic: 'Valida compras en ARTD y ARSD',
        criticality: '-',
        points: 'n/a',
        applies: false,
        whatToLookFor: 'No aplica para TH CONFIRMA'
      }
    ]
  },
  {
    blockName: 'VRM',
    topics: [
      {
        topic: 'Calificación de transacciones, comentarios y aplica mantenimiento',
        criticality: 'Crítico',
        points: 10,
        applies: true,
        whatToLookFor: 'En TH CONFIRMA las transacciones se califican como LEGÍTIMAS (cliente las confirmó). En VCAS: transacciones marcadas como reconocidas. En FALCON: transacciones con calificación positiva. En VRM: mantenimiento aplicado correctamente.'
      }
    ]
  },
  {
    blockName: 'B.I',
    topics: [
      {
        topic: 'Crea el Folio Correctamente',
        criticality: '-',
        points: 'n/a',
        applies: false,
        whatToLookFor: 'No aplica para TH CONFIRMA'
      }
    ]
  },
  {
    blockName: 'Manejo de llamada',
    topics: [
      {
        topic: 'Script: Saludo e identificación del cliente',
        criticality: '-',
        points: 2,
        applies: true,
        whatToLookFor: 'En transcripción: agente pregunta por el cliente usando su nombre completo con tratamiento ("¿Se encuentra el/la Sr./Sra./Srita. [Nombre]?").'
      },
      {
        topic: 'Script: Presentación de Bradescard y tarjeta',
        criticality: '-',
        points: 3,
        applies: true,
        whatToLookFor: 'En transcripción: agente se presenta con su nombre, menciona explícitamente "Bradescard México" y menciona la terminación de la tarjeta (últimos 4 dígitos) solicitando confirmación ("¿me puede apoyar a validarlos?").'
      },
      {
        topic: 'Script: Mención y confirmación de movimientos',
        criticality: '-',
        points: 5,
        applies: true,
        whatToLookFor: 'En transcripción: agente menciona compras específicas del sistema con día, cantidad en pesos y nombre del comercio; pregunta explícitamente si el cliente reconoce cada movimiento; al confirmar, informa que aplicará un mantenimiento a la tarjeta.'
      },
      {
        topic: 'Script: Acción de mantenimiento (HOTLIST / desbloqueo)',
        criticality: '-',
        points: 5,
        applies: true,
        whatToLookFor: 'En transcripción: agente indica al cliente que espere 5 minutos para volver a usar la tarjeta. En sistemas (capturas): ingresa tarjeta a APROBAR_HOTLIST en Falcon por 30+1 días; retira bloqueo BLKI/BLKT en Vision si aplica; habilita bypass por 24 horas si la compra fue por internet.'
      },
      {
        topic: 'Script: Despedida',
        criticality: '-',
        points: 2,
        applies: true,
        whatToLookFor: 'En transcripción: agente menciona que podrían comunicarse en no más de 30 minutos para seguimiento; se despide mencionando su nombre propio y "Bradescard México".'
      },
      {
        topic: 'Educación, frases de conexión, comunicación efectiva y escucha activa',
        criticality: '-',
        points: 5,
        applies: true,
        whatToLookFor: 'En transcripción: agente usa frases de cortesía, se expresa con claridad, escucha activamente al cliente y usa lenguaje profesional.'
      },
      {
        topic: 'Control de llamada y Puntualidad',
        criticality: '-',
        points: 6,
        applies: true,
        whatToLookFor: 'En transcripción: agente mantiene el hilo de la llamada, no hace pausas innecesarias, maneja el tiempo de manera eficiente.'
      },
      {
        topic: 'Autentica correctamente',
        criticality: '-',
        points: 11,
        applies: true,
        whatToLookFor: 'Autenticación al inicio'
      }
    ]
  }
];

// ============================================
// CRITERIOS DE MONITOREO (estructura vertical)
// Basado en la plantilla Monitoreo.xlsx
// ============================================
export const MONITOREO_CRITERIA: EvaluationBlock[] = [
  {
    blockName: 'Falcon',
    topics: [
      { 
        topic: 'Califica transacciones, Cierre de caso, Selecciona casillas de acción', 
        criticality: '-', 
        points: 20, 
        applies: true,
        whatToLookFor: 'En capturas FALCON: transacciones calificadas correctamente, caso cerrado adecuadamente, casillas de acción seleccionadas'
      }
    ]
  },
  {
    blockName: 'VRM',
    topics: [
      { 
        topic: 'Califica transacciones/Mantenimiento/Comentario', 
        criticality: '-', 
        points: 8, 
        applies: true,
        whatToLookFor: 'En capturas VRM: transacciones calificadas, mantenimiento aplicado y comentarios correctos'
      }
    ]
  },
  {
    blockName: 'Front',
    topics: [
      { 
        topic: 'Ingresa correctamente los datos del front: Calificación, Subcalificación de llamada, Socio, Correo del cliente, Número de caso, 4 dígitos de la tarjeta, Capturas, Comentario, Subir Excel', 
        criticality: '-', 
        points: 15, 
        applies: true,
        whatToLookFor: 'En capturas FRONT: verificar que todos los campos estén correctamente llenados (calificación, subcalificación, socio, correo, número de caso, 4 dígitos, capturas, comentario, Excel)'
      }
    ]
  },
  {
    blockName: 'Vcas',
    topics: [
      { 
        topic: 'Califica transacciones / Bloqueo', 
        criticality: '-', 
        points: 7, 
        applies: true,
        whatToLookFor: 'En capturas VCAS: transacciones calificadas correctamente y bloqueo aplicado si corresponde'
      }
    ]
  },
  {
    blockName: 'Vision+',
    topics: [
      { 
        topic: 'Comentario en ASHI', 
        criticality: '-', 
        points: 3, 
        applies: true,
        whatToLookFor: 'En capturas VISION/ASHI: comentarios claros y completos sobre la gestión realizada'
      },
      { 
        topic: 'Bloqueo correcto de la tarjeta', 
        criticality: '-', 
        points: 7, 
        applies: true,
        whatToLookFor: 'En capturas VISION: tipo de bloqueo correcto aplicado según corresponda'
      }
    ]
  },
  {
    blockName: 'BI',
    topics: [
      { 
        topic: 'Levantamiento correcto de ticket', 
        criticality: '-', 
        points: 10, 
        applies: true,
        whatToLookFor: 'En capturas BI: ticket levantado correctamente con todos los datos completos'
      }
    ]
  },
  {
    blockName: 'Manejo de llamada',
    topics: [
      { 
        topic: 'Cumple con el script de llamada', 
        criticality: '-', 
        points: 5, 
        applies: true,
        whatToLookFor: 'En transcripción: sigue el script completo (saludo, validación, explicación del proceso, cierre)'
      },
      { 
        topic: 'Control de llamada, empatía y frases de conexión', 
        criticality: '-', 
        points: 10, 
        applies: true,
        whatToLookFor: 'En transcripción: mantiene control de la conversación, usa frases de empatía y conexión con el cliente'
      },
      { 
        topic: 'Cordialidad/Comunicación efectiva', 
        criticality: '-', 
        points: 5, 
        applies: true,
        whatToLookFor: 'En transcripción: tono cordial, comunicación clara y efectiva durante toda la llamada'
      },
      { 
        topic: 'Escucha activa', 
        criticality: '-', 
        points: 10, 
        applies: true,
        whatToLookFor: 'En transcripción: demuestra escucha activa, responde adecuadamente a las inquietudes del cliente sin interrumpir'
      },
      { 
        topic: 'Solución al contacto', 
        criticality: '-', 
        points: 5, 
        applies: true,
        whatToLookFor: 'En transcripción: ofrece solución efectiva al motivo de contacto del cliente'
      }
    ]
  },
  {
    blockName: 'Casos críticos',
    topics: [
      { 
        topic: 'Calificación de caso (cierre de caso en falcon)', 
        criticality: 'Crítico', 
        points: 'n/a', 
        applies: true,
        whatToLookFor: 'En capturas FALCON: caso calificado y cerrado correctamente. Error crítico si no se cumple.'
      },
      { 
        topic: 'Califica tipo de llamada correctamente (calificación a nivel front)', 
        criticality: 'Crítico', 
        points: 'n/a', 
        applies: true,
        whatToLookFor: 'En capturas FRONT: tipo de llamada calificado correctamente. Error crítico si no se cumple.'
      },
      { 
        topic: 'Bloquea tarjeta en V+ correctamente', 
        criticality: 'Crítico', 
        points: 'n/a', 
        applies: true,
        whatToLookFor: 'En capturas VISION+: tarjeta bloqueada correctamente cuando corresponde. Error crítico si no se cumple.'
      }
    ]
  }
];

export function getCriteriaForCallType(callType: string): EvaluationBlock[] {
  const normalizedType = callType.toUpperCase().trim();
  
  if (normalizedType.includes('MONITOREO')) {
    return MONITOREO_CRITERIA;
  } else if (normalizedType.includes('FRAUDE')) {
    return FRAUD_CRITERIA;
  } else if (normalizedType.includes('TH CONFIRMA') || normalizedType.includes('TH_CONFIRMA')) {
    return TH_CONFIRMA_CRITERIA;
  }
  
  // Default: INBOUND usa FRAUD_CRITERIA
  return FRAUD_CRITERIA;
}