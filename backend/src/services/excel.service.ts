//backend/src/services/excel.service.ts

import ExcelJS from 'exceljs';
import { logger } from '../utils/logger.js';
import type { AuditInput, EvaluationResult } from '../types/index.js';
import type { EvaluationBlock } from '../config/evaluation-criteria.js';
import { getDatabaseService } from './database.service.js';

class ExcelService {
 // Helper para limpiar nombres de archivos
 private sanitizeFilename(text: string): string {
 return text
 .replace(/\s+/g, '_')
 .replace(/\t/g, '_')
 .replace(/[^\w\-_.]/g, '')
 .substring(0, 100);
 }

 // Retorna { filename, buffer } en memoria
 async generateExcelReport(
 auditInput: AuditInput,
 evaluation: Omit<EvaluationResult, 'excelUrl'>
 ): Promise<{ filename: string; buffer: Buffer }> {
 try {
 logger.info('Generating Excel report in memory');

 const workbook = new ExcelJS.Workbook();
 workbook.creator = 'Audit AI System';
 workbook.created = new Date();

 // Despachar según tipo de reporte (excelType tiene prioridad sobre callType)
 const useMonitoreo = auditInput.excelType === 'MONITOREO' ||
 (!auditInput.excelType && (auditInput.callType || '').toUpperCase().includes('MONITOREO'));

 let criteria: EvaluationBlock[] = [];
 try {
 criteria = await getDatabaseService().getCriteriaForCallType(auditInput.callType) as EvaluationBlock[];
 } catch (err: any) {
 logger.warn('Excel: no se encontraron criterios en BD para generar el reporte', { callType: auditInput.callType, error: err.message });
 }

 if (useMonitoreo) {
 const sheet = workbook.addWorksheet('Monitoreo');
 this.createMonitoreoSheet(sheet, auditInput, evaluation, criteria);
 } else {
 const sheet = workbook.addWorksheet('Analisis');
 this.createAnalysisSheet(sheet, auditInput, evaluation, criteria);
 }

 const cleanExecutiveId = this.sanitizeFilename(auditInput.executiveId);
 const filename = `auditoria_${cleanExecutiveId}_${Date.now()}.xlsx`;

 const arrayBuffer = await workbook.xlsx.writeBuffer();
 const buffer = Buffer.from(arrayBuffer);

 logger.success('Excel report generated in memory', { filename, sizeKB: (buffer.length / 1024).toFixed(1) });

 return { filename, buffer };
 } catch (error) {
 logger.error('Error generating Excel report', error);
 throw error;
 }
 }

 // ============================================
 // HOJA INBOUND (horizontal) - SIN CAMBIOS
 // ============================================

 private createAnalysisSheet(
 sheet: ExcelJS.Worksheet,
 auditInput: AuditInput,
 evaluation: Omit<EvaluationResult, 'excelUrl'>,
 criteria: EvaluationBlock[]
 ) {

 // MEJORADO: Crear múltiples mapas para buscar coincidencias
 const evaluationMap = new Map<string, any>();
 const evaluationByTopicOnly = new Map<string, any>();
 const evaluationByBlockOnly = new Map<string, any>();
 
 evaluation.detailedScores.forEach(score => {
 const match = score.criterion.match(/\[(.*?)\]\s*(.*)/);
 if (match) {
 const block = match[1].trim();
 const topic = match[2].trim();
 
 // Mapa principal con clave completa
 const key = `${block}|${topic}`;
 evaluationMap.set(key, score);
 
 // Mapas secundarios para búsqueda flexible
 evaluationByTopicOnly.set(topic, score);
 evaluationByBlockOnly.set(block, score);
 
 // También guardar versiones normalizadas (sin acentos, minúsculas)
 const normalizedKey = `${this.normalizeText(block)}|${this.normalizeText(topic)}`;
 evaluationMap.set(normalizedKey, score);
 }
 });

 logger.info(' Evaluation map created', {
 totalEvaluations: evaluation.detailedScores.length,
 mappedKeys: Array.from(evaluationMap.keys())
 });

 // Color principal del encabezado — verde de marca S+
 const HEADER_COLOR = 'FF10B981';
 const WHITE_FONT = 'FFFFFFFF';

 // Estilos reutilizables
 const headerStyle: Partial<ExcelJS.Style> = {
 font: { bold: true, size: 10, color: { argb: WHITE_FONT } },
 fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_COLOR } },
 alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
 border: this.getAllBorders()
 };

 const dataStyle: Partial<ExcelJS.Style> = {
 font: { size: 9 },
 alignment: { horizontal: 'left', vertical: 'middle', wrapText: true },
 border: this.getAllBorders()
 };

 // ============================================
 // FILA 1: TÃ­tulo y Metadata
 // ============================================
 sheet.getRow(1).height = 35;

 const cellA1 = sheet.getCell('A1');
 cellA1.value = 'Auditoría de Llamada - Análisis Detallado';
 cellA1.font = { bold: true, size: 16, color: { argb: HEADER_COLOR } };
 cellA1.alignment = { horizontal: 'left', vertical: 'middle' };
 sheet.mergeCells('A1:H1');

 // ============================================
 // FILA 2: Información del Ejecutivo
 // ============================================
 sheet.getRow(2).height = 25;

 const cellA2 = sheet.getCell('A2');
 cellA2.value = 'Ejecutivo:';
 cellA2.font = { bold: true, size: 10 };
 cellA2.alignment = { horizontal: 'right', vertical: 'middle' };

 const cellB2 = sheet.getCell('B2');
 cellB2.value = auditInput.executiveName;
 cellB2.font = { size: 10 };
 cellB2.alignment = { horizontal: 'left', vertical: 'middle' };
 sheet.mergeCells('B2:C2');

 const cellD2 = sheet.getCell('D2');
 cellD2.value = 'ID:';
 cellD2.font = { bold: true, size: 10 };
 cellD2.alignment = { horizontal: 'right', vertical: 'middle' };

 const cellE2 = sheet.getCell('E2');
 cellE2.value = auditInput.executiveId;
 cellE2.font = { size: 10 };
 cellE2.alignment = { horizontal: 'left', vertical: 'middle' };

 const cellF2 = sheet.getCell('F2');
 cellF2.value = 'Tipo de Llamada:';
 cellF2.font = { bold: true, size: 10 };
 cellF2.alignment = { horizontal: 'right', vertical: 'middle' };

 const cellG2 = sheet.getCell('G2');
 cellG2.value = auditInput.callType;
 cellG2.font = { size: 10 };
 cellG2.alignment = { horizontal: 'left', vertical: 'middle' };
 sheet.mergeCells('G2:H2');

 // ============================================
 // FILA 3: Resultados Generales
 // ============================================
 sheet.getRow(3).height = 25;

 const cellA3 = sheet.getCell('A3');
 cellA3.value = 'Puntuación Total:';
 cellA3.font = { bold: true, size: 10 };
 cellA3.alignment = { horizontal: 'right', vertical: 'middle' };

 const cellB3 = sheet.getCell('B3');
 cellB3.value = `${evaluation.totalScore} / ${evaluation.maxPossibleScore}`;
 cellB3.font = { bold: true, size: 11, color: { argb: evaluation.criticalFailure ? 'FFDC2626' : 'FF10B981' } };
 cellB3.alignment = { horizontal: 'left', vertical: 'middle' };

 const cellD3 = sheet.getCell('D3');
 cellD3.value = 'Porcentaje:';
 cellD3.font = { bold: true, size: 10 };
 cellD3.alignment = { horizontal: 'right', vertical: 'middle' };

 const cellE3 = sheet.getCell('E3');
 cellE3.value = evaluation.criticalFailure
 ? `0.0% - CRITICO`
 : `${evaluation.percentage.toFixed(1)}%`;
 cellE3.font = { bold: true, size: 11, color: { argb: evaluation.criticalFailure ? 'FFDC2626' : 'FF10B981' } };
 cellE3.alignment = { horizontal: 'left', vertical: 'middle' };

 const cellF3 = sheet.getCell('F3');
 cellF3.value = 'Cliente:';
 cellF3.font = { bold: true, size: 10 };
 cellF3.alignment = { horizontal: 'right', vertical: 'middle' };

 const cellG3 = sheet.getCell('G3');
 cellG3.value = auditInput.clientId || 'N/A';
 cellG3.font = { size: 10 };
 cellG3.alignment = { horizontal: 'left', vertical: 'middle' };
 sheet.mergeCells('G3:H3');

 // ============================================
 // FILA 4: Encabezados de columnas principales
 // ============================================
 const row4 = sheet.getRow(4);
 row4.height = 30;

 // Columnas de metadata
 const headers = [
 { col: 1, label: '#', width: 8 },
 { col: 2, label: 'Bloque', width: 30 },
 { col: 3, label: 'Criticidad', width: 12 },
 { col: 4, label: 'Criterio', width: 25 },
 { col: 5, label: 'Puntaje Máximo', width: 18 },
 { col: 6, label: 'Puntaje Obtenido', width: 18 },
 { col: 7, label: 'Aplica', width: 12 },
 { col: 8, label: 'Observaciones', width: 40 }
 ];

 headers.forEach(h => {
 const cell = row4.getCell(h.col);
 cell.value = h.label;
 Object.assign(cell, headerStyle);
 sheet.getColumn(h.col).width = h.width;
 });

 // Encabezados de tópicos (columnas 9-39)
 let colNum = 9;
 criteria.forEach(block => {
 block.topics.forEach(topic => {
 const cell = row4.getCell(colNum);
 cell.value = `${block.blockName}: ${topic.topic}`;
 Object.assign(cell, headerStyle);
 colNum++;
 });
 });

 // Columna 40: Observaciones generales
 const cell40 = row4.getCell(40);
 cell40.value = 'Observaciones Generales';
 Object.assign(cell40, headerStyle);

 // ============================================
 // FILAS DE DATOS: Iterar criterios horizontalmente
 // ============================================
 let rowNum = 5;
 let topicIndex = 1;

 // MEJORADO: Helper para buscar evaluación con múltiples estrategias
 const getTopicValueWithReason = (blockName: string, topicName: string, topic: any) => {
 if (!topic.applies) {
 return { 
 value: 'n/a', 
 reason: 'No aplica según el contexto de la llamada', 
 shouldHighlight: false 
 };
 }

 // Estrategia 1: Búsqueda exacta
 let key = `${blockName}|${topicName}`;
 let score = evaluationMap.get(key);

 // Estrategia 2: Búsqueda normalizada (sin acentos, minúsculas)
 if (!score) {
 key = `${this.normalizeText(blockName)}|${this.normalizeText(topicName)}`;
 score = evaluationMap.get(key);
 }

 // Estrategia 3: Búsqueda solo por tópico
 if (!score) {
 score = evaluationByTopicOnly.get(topicName);
 }

 // Estrategia 4: Búsqueda solo por bloque
 if (!score) {
 score = evaluationByBlockOnly.get(blockName);
 }

 // Estrategia 5: Búsqueda parcial (contiene)
 if (!score) {
 const normalizedTopic = this.normalizeText(topicName);
 for (const [mapKey, mapScore] of evaluationMap.entries()) {
 const normalizedMapKey = this.normalizeText(mapKey);
 if (normalizedMapKey.includes(normalizedTopic) || normalizedTopic.includes(normalizedMapKey)) {
 score = mapScore;
 break;
 }
 }
 }

 if (!score) {
 logger.warn(' No evaluation found for criterion', { 
 blockName, 
 topicName,
 availableKeys: Array.from(evaluationMap.keys()).slice(0, 5)
 });
 return { 
 value: 'Sin evaluar', 
 reason: 'No se encontró evidencia suficiente en transcripción ni en capturas para evaluar este criterio', 
 shouldHighlight: false 
 };
 }

 const justification = score.observations || score.justification || '';

 if (score.score === 0) {
 return { 
 value: 0, 
 reason: justification || 'No cumplió con el criterio', 
 shouldHighlight: true 
 };
 }

 return { 
 value: score.score, 
 reason: justification || 'Cumplió correctamente', 
 shouldHighlight: true 
 };
 };

 criteria.forEach(block => {
 block.topics.forEach(topic => {
 const row = sheet.getRow(rowNum);
 row.height = 25;

 // Columna 1: Índice
 const cellA = row.getCell(1);
 cellA.value = topicIndex;
 cellA.alignment = { horizontal: 'center', vertical: 'middle' };
 cellA.border = this.getAllBorders();

 // Columna 2: Bloque
 const cellB = row.getCell(2);
 cellB.value = block.blockName;
 cellB.font = { bold: true, size: 9 };
 Object.assign(cellB, dataStyle);

 // Columna 3: Criticidad
 const cellC = row.getCell(3);
 cellC.value = topic.criticality || '-';
 cellC.alignment = { horizontal: 'center', vertical: 'middle' };
 cellC.border = this.getAllBorders();
 if (topic.criticality === 'Crítico') {
 cellC.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFECACA' } };
 cellC.font = { bold: true, size: 9, color: { argb: 'FFDC2626' } };
 }

 // Columna 4: Criterio
 const cellD = row.getCell(4);
 cellD.value = topic.topic;
 Object.assign(cellD, dataStyle);

 // Columna 5: Puntaje Máximo
 const cellE = row.getCell(5);
 cellE.value = topic.points;
 cellE.alignment = { horizontal: 'center', vertical: 'middle' };
 cellE.border = this.getAllBorders();

 // Columna 6: Puntaje Obtenido + Observaciones
 const result = getTopicValueWithReason(block.blockName, topic.topic, topic);
 const cellF = row.getCell(6);
 cellF.value = result.value;
 cellF.alignment = { horizontal: 'center', vertical: 'middle' };
 cellF.border = this.getAllBorders();

 if (result.shouldHighlight) {
 if (typeof result.value === 'number') {
 const maxPoints = typeof topic.points === 'number' ? topic.points : 0;
 if (result.value === maxPoints) {
 cellF.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD4EDDA' } };
 cellF.font = { bold: true, size: 10, color: { argb: 'FF155724' } };
 } else if (result.value === 0) {
 cellF.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8D7DA' } };
 cellF.font = { bold: true, size: 10, color: { argb: 'FF721C24' } };
 } else {
 cellF.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3CD' } };
 cellF.font = { bold: true, size: 10, color: { argb: 'FF856404' } };
 }
 }
 } else if (result.value === 'n/a') {
 cellF.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
 cellF.font = { size: 9, color: { argb: 'FF666666' } };
 }

 // Columna 7: Aplica
 const cellG = row.getCell(7);
 cellG.value = topic.applies ? 'Sí' : 'No';
 cellG.alignment = { horizontal: 'center', vertical: 'middle' };
 cellG.border = this.getAllBorders();

 // Columna 8: Observaciones
 const cellH = row.getCell(8);
 cellH.value = result.reason;
 Object.assign(cellH, dataStyle);

 rowNum++;
 topicIndex++;
 });
 });

 // Columnas 9-39: Calificaciones de cada tópico (vista matricial)
 colNum = 9;
 criteria.forEach(block => {
 block.topics.forEach(topic => {
 const cell = sheet.getRow(5).getCell(colNum);
 const result = getTopicValueWithReason(block.blockName, topic.topic, topic);
 
 cell.value = result.value;
 cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
 cell.border = this.getAllBorders();

 if (result.shouldHighlight) {
 cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } };
 cell.font = { size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
 
 cell.note = {
 texts: [
 {
 font: { size: 10, name: 'Calibri' },
 text: result.reason
 }
 ],
 margins: {
 insetmode: 'custom',
 inset: [0.1, 0.1, 0.1, 0.1]
 }
 };
 } else if (result.value === 'n/a') {
 cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
 cell.font = { size: 10, color: { argb: 'FF666666' } };
 } else {
 cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
 cell.font = { size: 9, italic: true, color: { argb: 'FF666666' } };
 
 cell.note = {
 texts: [
 {
 font: { size: 10, name: 'Calibri' },
 text: result.reason
 }
 ],
 margins: {
 insetmode: 'custom',
 inset: [0.1, 0.1, 0.1, 0.1]
 }
 };
 }
 
 colNum++;
 });
 });

 // Columna 40: Observaciones generales
 const obsCell = sheet.getRow(5).getCell(40);
 
 let observationsText = evaluation.observations;
 
 if (evaluation.keyMoments && evaluation.keyMoments.length > 0) {
 observationsText += '\n\nMomentos clave de la llamada:\n';
 evaluation.keyMoments.forEach(moment => {
 const formattedTimestamp = this.formatTimestamp(moment.timestamp);
 observationsText += `[${formattedTimestamp}] ${moment.type}: ${moment.description}\n`;
 });
 }
 
 obsCell.value = observationsText;
 obsCell.font = { size: 9 };
 obsCell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true };
 obsCell.border = this.getAllBorders();

 // Ajustar anchos finales
 sheet.getColumn(40).width = 50;
 for (let i = 9; i <= 39; i++) {
 sheet.getColumn(i).width = 15;
 }
 }

 // ============================================
 // HOJA MONITOREO (vertical)
 // ============================================

 private createMonitoreoSheet(
 sheet: ExcelJS.Worksheet,
 auditInput: AuditInput,
 evaluation: Omit<EvaluationResult, 'excelUrl'>,
 criteria: EvaluationBlock[]
 ) {

 // MEJORADO: Crear múltiples mapas para buscar coincidencias
 const evaluationMap = new Map<string, any>();
 const evaluationByTopicOnly = new Map<string, any>();
 const evaluationByBlockOnly = new Map<string, any>();
 
 evaluation.detailedScores.forEach(score => {
 const match = score.criterion.match(/\[(.*?)\]\s*(.*)/);
 if (match) {
 const block = match[1].trim();
 const topic = match[2].trim();
 
 // Mapa principal con clave completa
 const key = `${block}|${topic}`;
 evaluationMap.set(key, score);
 
 // Mapas secundarios para búsqueda flexible
 evaluationByTopicOnly.set(topic, score);
 evaluationByBlockOnly.set(block, score);
 
 // También guardar versiones normalizadas
 const normalizedKey = `${this.normalizeText(block)}|${this.normalizeText(topic)}`;
 evaluationMap.set(normalizedKey, score);
 }
 });

 logger.info(' Monitoreo evaluation map created', {
 totalEvaluations: evaluation.detailedScores.length,
 mappedKeys: Array.from(evaluationMap.keys())
 });

 // Color principal del encabezado — verde de marca S+
 const HEADER_COLOR = 'FF10B981';
 const WHITE_FONT = 'FFFFFFFF';

 // Estilos reutilizables
 const headerStyle: Partial<ExcelJS.Style> = {
 font: { bold: true, size: 11, color: { argb: WHITE_FONT } },
 fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_COLOR } },
 alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
 border: this.getAllBorders()
 };

 // ============================================
 // Anchos de columnas: B=20, C=50, D=15
 // ============================================
 sheet.getColumn(1).width = 3; // A (vacía, margen)
 sheet.getColumn(2).width = 22; // B - Bloques
 sheet.getColumn(3).width = 55; // C - Rubros
 sheet.getColumn(4).width = 18; // D - Ponderación / Calificación

 // ============================================
 // FILA 2: ENCABEZADO PRINCIPAL
 // Monitoreo | Nombre del Ejecutivo | ID
 // ============================================
 const row2 = sheet.getRow(2);
 row2.height = 30;

 const cellB2 = sheet.getCell('B2');
 cellB2.value = 'Monitoreo';
 Object.assign(cellB2, headerStyle);

 const cellC2 = sheet.getCell('C2');
 cellC2.value = auditInput.executiveName;
 Object.assign(cellC2, headerStyle);

 const cellD2 = sheet.getCell('D2');
 cellD2.value = auditInput.clientId || auditInput.executiveId;
 Object.assign(cellD2, headerStyle);

 // ============================================
 // FILA 3: ENCABEZADOS DE COLUMNAS
 // Bloques | Rubros | Ponderación
 // ============================================
 const row3 = sheet.getRow(3);
 row3.height = 25;

 const cellB3 = sheet.getCell('B3');
 cellB3.value = 'Bloques';
 Object.assign(cellB3, headerStyle);

 const cellC3 = sheet.getCell('C3');
 cellC3.value = 'Rubros';
 Object.assign(cellC3, headerStyle);

 const cellD3 = sheet.getCell('D3');
 cellD3.value = 'Ponderación';
 Object.assign(cellD3, headerStyle);

 // ============================================
 // FILAS DE DATOS: Iterar criterios verticalmente
 // ============================================
 let currentRow = 4;

 // MEJORADO: Helper para buscar evaluación con múltiples estrategias
 const getTopicResult = (blockName: string, topicName: string, topic: any) => {
 if (!topic.applies) {
 return { value: 'n/a', reason: 'No aplica', isCritical: false };
 }

 // Estrategia 1: Búsqueda exacta
 let key = `${blockName}|${topicName}`;
 let score = evaluationMap.get(key);

 // Estrategia 2: Búsqueda normalizada
 if (!score) {
 key = `${this.normalizeText(blockName)}|${this.normalizeText(topicName)}`;
 score = evaluationMap.get(key);
 }

 // Estrategia 3: Búsqueda solo por tópico
 if (!score) {
 score = evaluationByTopicOnly.get(topicName);
 }

 // Estrategia 4: Búsqueda solo por bloque
 if (!score) {
 score = evaluationByBlockOnly.get(blockName);
 }

 // Estrategia 5: Búsqueda parcial
 if (!score) {
 const normalizedTopic = this.normalizeText(topicName);
 for (const [mapKey, mapScore] of evaluationMap.entries()) {
 const normalizedMapKey = this.normalizeText(mapKey);
 if (normalizedMapKey.includes(normalizedTopic) || normalizedTopic.includes(normalizedMapKey)) {
 score = mapScore;
 break;
 }
 }
 }

 if (!score) {
 logger.warn(' No evaluation found for criterion', { 
 blockName, 
 topicName,
 availableKeys: Array.from(evaluationMap.keys()).slice(0, 5)
 });
 return { 
 value: 'Sin evaluar', 
 reason: 'No se encontró evidencia suficiente', 
 isCritical: topic.criticality === 'Crítico'
 };
 }

 const justification = score.observations || score.justification || '';

 if (topic.criticality === 'Crítico') {
 // Para críticos: mostrar "Cumple" o "No Cumple"
 const cumple = score.score > 0;
 return { 
 value: cumple ? 'Cumple' : 'No Cumple', 
 reason: justification || (cumple ? 'Cumplió correctamente' : 'No cumplió - Error Crítico'),
 isCritical: true
 };
 }

 return { 
 value: score.score, 
 reason: justification || 'Evaluado', 
 isCritical: false
 };
 };

 criteria.forEach(block => {
 const blockStartRow = currentRow;
 const topicCount = block.topics.length;

 block.topics.forEach((topic, topicIdx) => {
 const row = sheet.getRow(currentRow);
 row.height = topicIdx === 0 && topicCount === 1 ? 40 : 30;

 // Columna B: Bloque (solo en la primera fila, luego se mergea)
 if (topicIdx === 0) {
 const cellB = sheet.getCell(`B${currentRow}`);
 cellB.value = block.blockName;
 cellB.font = { bold: true, size: 11, color: { argb: WHITE_FONT } };
 cellB.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_COLOR } };
 cellB.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
 cellB.border = this.getAllBorders();
 }

 // Columna C: Rubro/Tópico
 const cellC = sheet.getCell(`C${currentRow}`);
 cellC.value = topic.topic;
 cellC.font = { size: 10 };
 cellC.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
 cellC.border = this.getAllBorders();

 // Columna D: Ponderación + Calificación
 const cellD = sheet.getCell(`D${currentRow}`);
 const result = getTopicResult(block.blockName, topic.topic, topic);

 if (topic.criticality === 'Crítico') {
 // Críticos: mostrar resultado directamente
 cellD.value = result.value;
 cellD.font = { size: 10, bold: true };
 cellD.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
 cellD.border = this.getAllBorders();

 // Color según resultado
 if (result.value === 'No Cumple') {
 cellD.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };
 cellD.font = { size: 10, bold: true, color: { argb: WHITE_FONT } };
 } else if (result.value === 'Cumple') {
 cellD.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } };
 cellD.font = { size: 10, bold: true, color: { argb: WHITE_FONT } };
 } else if (result.value === 'Sin evaluar') {
 cellD.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
 cellD.font = { size: 9, italic: true, color: { argb: 'FF666666' } };
 }
 } else if (!topic.applies) {
 cellD.value = 'n/a';
 cellD.font = { size: 10, color: { argb: 'FF666666' } };
 cellD.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
 cellD.alignment = { horizontal: 'center', vertical: 'middle' };
 cellD.border = this.getAllBorders();
 } else {
 // Numéricos: mostrar calificación obtenida
 cellD.value = result.value;
 cellD.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
 cellD.border = this.getAllBorders();

 if (typeof result.value === 'number') {
 const maxPoints = typeof topic.points === 'number' ? topic.points : 0;
 if (result.value === maxPoints) {
 // Puntaje completo - verde suave
 cellD.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD4EDDA' } };
 cellD.font = { size: 10, bold: true, color: { argb: 'FF155724' } };
 } else if (result.value === 0) {
 // Cero - rojo suave
 cellD.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8D7DA' } };
 cellD.font = { size: 10, bold: true, color: { argb: 'FF721C24' } };
 } else {
 // Parcial - amarillo suave
 cellD.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3CD' } };
 cellD.font = { size: 10, bold: true, color: { argb: 'FF856404' } };
 }
 } else if (result.value === 'Sin evaluar') {
 cellD.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
 cellD.font = { size: 9, italic: true, color: { argb: 'FF666666' } };
 }
 }

 // Agregar nota con justificación si hay evaluación
 if (result.reason && result.reason !== 'No aplica') {
 const maxPtsText = typeof topic.points === 'number' ? `/${topic.points}` : '';
 cellD.note = {
 texts: [
 {
 font: { bold: true, size: 10, name: 'Calibri' },
 text: `Ponderación: ${topic.criticality === 'Crítico' ? 'Crítico' : topic.points}${maxPtsText}\n`
 },
 {
 font: { size: 10, name: 'Calibri' },
 text: result.reason
 }
 ],
 margins: {
 insetmode: 'custom',
 inset: [0.1, 0.1, 0.1, 0.1]
 }
 };
 }

 currentRow++;
 });

 // Merge celdas de bloque si hay más de un tópico
 if (topicCount > 1) {
 sheet.mergeCells(`B${blockStartRow}:B${blockStartRow + topicCount - 1}`);
 }
 });

 // ============================================
 // FILA TOTAL
 // ============================================
 const totalStartRow = currentRow;

 // Merge C para "Total"
 sheet.mergeCells(`C${totalStartRow}:C${totalStartRow + 1}`);
 const cellCTotal = sheet.getCell(`C${totalStartRow}`);
 cellCTotal.value = 'Total';
 cellCTotal.font = { bold: true, size: 12, color: { argb: WHITE_FONT } };
 cellCTotal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_COLOR } };
 cellCTotal.alignment = { horizontal: 'center', vertical: 'middle' };
 cellCTotal.border = this.getAllBorders();

 // Merge D para el puntaje total
 sheet.mergeCells(`D${totalStartRow}:D${totalStartRow + 1}`);
 const cellDTotal = sheet.getCell(`D${totalStartRow}`);
 cellDTotal.value = evaluation.criticalFailure
 ? `0 / ${evaluation.maxPossibleScore} - CRITICO`
 : `${evaluation.totalScore} / ${evaluation.maxPossibleScore}`;
 cellDTotal.font = { bold: true, size: 12, color: { argb: WHITE_FONT } };
 cellDTotal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: evaluation.criticalFailure ? 'FFDC2626' : HEADER_COLOR } };
 cellDTotal.alignment = { horizontal: 'center', vertical: 'middle' };
 cellDTotal.border = this.getAllBorders();

 // Bordes para filas de total
 sheet.getCell(`B${totalStartRow}`).border = this.getAllBorders();
 sheet.getCell(`B${totalStartRow + 1}`).border = this.getAllBorders();
 sheet.getCell(`C${totalStartRow + 1}`).border = this.getAllBorders();
 sheet.getCell(`D${totalStartRow + 1}`).border = this.getAllBorders();

 sheet.getRow(totalStartRow).height = 20;
 sheet.getRow(totalStartRow + 1).height = 20;

 currentRow = totalStartRow + 2;

 // ============================================
 // FILA OBSERVACIONES
 // ============================================
 const obsStartRow = currentRow;

 // Merge B para "Observaciones"
 sheet.mergeCells(`B${obsStartRow}:B${obsStartRow + 2}`);
 const cellBObs = sheet.getCell(`B${obsStartRow}`);
 cellBObs.value = 'Observaciones';
 cellBObs.font = { bold: true, size: 11, color: { argb: WHITE_FONT } };
 cellBObs.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_COLOR } };
 cellBObs.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
 cellBObs.border = this.getAllBorders();

 // Merge C-D para contenido de observaciones
 sheet.mergeCells(`C${obsStartRow}:D${obsStartRow + 2}`);
 const cellCObs = sheet.getCell(`C${obsStartRow}`);

 let observationsText = evaluation.observations || '';

 if (evaluation.recommendations && evaluation.recommendations.length > 0) {
 observationsText += '\n\nRecomendaciones:\n';
 evaluation.recommendations.forEach((rec, idx) => {
 observationsText += `${idx + 1}. ${rec}\n`;
 });
 }

 if (evaluation.keyMoments && evaluation.keyMoments.length > 0) {
 observationsText += '\nMomentos clave:\n';
 evaluation.keyMoments.forEach(moment => {
 const formattedTimestamp = this.formatTimestamp(moment.timestamp);
 observationsText += `[${formattedTimestamp}] ${moment.type}: ${moment.description}\n`;
 });
 }

 cellCObs.value = observationsText;
 cellCObs.font = { size: 10 };
 cellCObs.alignment = { horizontal: 'left', vertical: 'top', wrapText: true };
 cellCObs.border = this.getAllBorders();

 // Altura de filas de observaciones
 sheet.getRow(obsStartRow).height = 25;
 sheet.getRow(obsStartRow + 1).height = 25;
 sheet.getRow(obsStartRow + 2).height = 25;

 // Bordes adicionales para celdas mergeadas
 for (let r = obsStartRow; r <= obsStartRow + 2; r++) {
 sheet.getCell(`B${r}`).border = this.getAllBorders();
 sheet.getCell(`C${r}`).border = this.getAllBorders();
 sheet.getCell(`D${r}`).border = this.getAllBorders();
 }
 }

 // ============================================
 // HELPERS
 // ============================================

 /**
 * NUEVO: Normaliza texto para comparaciones flexibles
 * Remueve acentos, convierte a minúsculas, elimina espacios extras
 */
 private normalizeText(text: string): string {
 return text
 .toLowerCase()
 .normalize('NFD')
 .replace(/[\u0300-\u036f]/g, '')
 .replace(/\s+/g, ' ')
 .trim();
 }

 private getAllBorders(): Partial<ExcelJS.Borders> {
 return {
 top: { style: 'thin', color: { argb: 'FF000000' } },
 left: { style: 'thin', color: { argb: 'FF000000' } },
 bottom: { style: 'thin', color: { argb: 'FF000000' } },
 right: { style: 'thin', color: { argb: 'FF000000' } }
 };
 }

 private formatTimestamp(timestamp: string): string {
 if (!timestamp) return '00:00';
 
 const match = timestamp.match(/(\d+):(\d+)/);
 if (!match) return timestamp;
 
 const mins = match[1].padStart(2, '0');
 const secs = match[2].padStart(2, '0');
 return `${mins}:${secs}`;
 }
}

export { ExcelService };

let instance: ExcelService | null = null;
export const getExcelService = () => {
 if (!instance) {
 instance = new ExcelService();
 }
 return instance;
};

export const excelService = {
 generateExcelReport: async (auditInput: any, evaluation: any) => {
 return getExcelService().generateExcelReport(auditInput, evaluation);
 }
};