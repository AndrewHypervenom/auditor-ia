// frontend/src/pages/NewAuditPage.tsx

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import FileUploader from '../components/FileUploader';
import ProcessingStatus from '../components/ProcessingStatus';
import { auditService } from '../services/api';
import type { AuditFormData } from '../types';
import { CALL_TYPES_VISIBLE, EXCEL_TYPES } from '../types';
import { Sparkles, RefreshCw, User, Phone, Calendar, Hash, ArrowLeft } from 'lucide-react';

type AppState = 'form' | 'processing';

// Tipos para mensajes SSE
interface SSEMessage {
  type: 'info' | 'success' | 'error' | 'progress' | 'stage' | 'result';
  stage?: string;
  progress?: number;
  message: string;
  data?: any;
  timestamp: string;
}

export default function NewAuditPage() {
  const navigate = useNavigate();
  const [state, setState] = useState<AppState>('form');
  const [processing, setProcessing] = useState({
    stage: 'uploading' as const,
    progress: 0,
    message: 'Iniciando...'
  });

  // Form data
  const [formData, setFormData] = useState<AuditFormData>({
    executiveName: '',
    executiveId: '',
    callType: '',
    excelType: '',
    clientId: '',
    callDate: ''
  });
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validaciones
    if (!audioFile) {
      toast.error('Debes subir un archivo de audio');
      return;
    }

    if (imageFiles.length === 0) {
      toast.error('Debes subir al menos una imagen');
      return;
    }

    setState('processing');
    
    try {
      // Generar clientId único para SSE
      const sseClientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const startTime = Date.now();
      
      // Variables para tracking de logs
      let currentStage = '';
      const stageTimings: Record<string, number> = {};
      let completedAuditId: string | null = null; // ✅ NUEVO: Variable para guardar auditId

      // Helper para formatear tiempo
      const formatTime = (ms: number) => {
        const seconds = Math.floor(ms / 1000);
        if (seconds < 60) return `${seconds}s`;
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}m ${secs}s`;
      };

      // Helper para timestamp
      const getTimestamp = () => {
        const now = new Date();
        return now.toLocaleTimeString('es-MX', { 
          hour: '2-digit', 
          minute: '2-digit', 
          second: '2-digit' 
        });
      };

      // ============================================
      // LOGS INICIALES EN CONSOLA
      // ============================================
      console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #3b82f6; font-weight: bold');
      console.log(`%c🚀 AUDITORÍA INICIADA - ${getTimestamp()}`, 'background: linear-gradient(90deg, #1e40af, #7c3aed); color: white; padding: 8px 16px; border-radius: 8px; font-weight: bold; font-size: 15px; text-shadow: 1px 1px 2px rgba(0,0,0,0.3)');
      console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #3b82f6; font-weight: bold');
      
      console.group('%c📋 Información de la Auditoría', 'color: #3b82f6; font-weight: bold; font-size: 13px');
      console.table({
        '👤 Ejecutivo': formData.executiveName,
        '🆔 ID Ejecutivo': formData.executiveId,
        '📞 Tipo de Llamada': formData.callType,
        '📅 Fecha': new Date(formData.callDate).toLocaleString('es-MX'),
        '🎤 Audio': `${(audioFile.size / 1024 / 1024).toFixed(2)} MB`,
        '🖼️ Imágenes': `${imageFiles.length} archivos`
      });
      console.groupEnd();

      // ============================================
      // CONECTAR A SSE PARA PROGRESO
      // ============================================
      const eventSource = new EventSource(
        `${import.meta.env.VITE_API_URL}/api/progress/${sseClientId}`
      );

      eventSource.onopen = () => {
        console.log('%c  ℹ️ Conexión establecida - Esperando inicio de procesamiento', 'color: #3b82f6');
      };

      eventSource.onmessage = (event) => {
        try {
          const message: SSEMessage = JSON.parse(event.data);
          
          // Actualizar UI con progreso
          if (message.stage && message.progress !== undefined) {
            setProcessing({
              stage: message.stage as any,
              progress: message.progress,
              message: message.message
            });
          }

          // ✅ FIX: Asegurar que el progreso sea válido (0-100)
          const safeProgress = Math.max(0, Math.min(100, message.progress || 0));
          
          // Logs de progreso visual
          const progressBar = '▓'.repeat(Math.floor(safeProgress / 5)) + 
                            '░'.repeat(20 - Math.floor(safeProgress / 5));
          console.log(
            `%c${progressBar} ${safeProgress}% ${message.message}`,
            'color: #60a5fa; font-family: monospace; font-weight: bold'
          );

          switch (message.type) {
            case 'stage':
              // Cerrar grupo anterior
              if (currentStage) {
                const stageDuration = Date.now() - stageTimings[currentStage];
                console.log(`%c⏱️  Duración: ${formatTime(stageDuration)}`, 'color: #6b7280; font-style: italic');
                console.groupEnd();
              }
              
              // Abrir nuevo grupo
              currentStage = message.stage || '';
              stageTimings[currentStage] = Date.now();
              
              const stageIcons: Record<string, string> = {
                uploading: '📤',
                transcription: '🎤',
                analysis: '🖼️',
                evaluation: '🤖',
                excel: '📊',
                completed: '✅'
              };
              
              const icon = stageIcons[currentStage] || '⚙️';
              console.group(`%c${icon} ${message.message}`, 'color: #8b5cf6; font-weight: bold; font-size: 13px');
              break;
              
            case 'info':
              if (message.data && typeof message.data === 'object' && 'confidence' in message.data) {
                const confidence = message.data.confidence;
                console.log(
                  `%c  ℹ️ ${message.message}`,
                  'color: #3b82f6',
                  `%c${confidence}% confianza`,
                  'color: #60a5fa; font-size: 10px; background: #1e3a8a; padding: 2px 6px; border-radius: 4px; margin-left: 8px'
                );
              } else {
                console.log(`%c  ℹ️ ${message.message}`, 'color: #3b82f6');
              }
              break;
              
            case 'success':
              console.log(`%c  ✅ ${message.message}`, 'color: #10b981; font-weight: bold');
              if (message.data) {
                console.log('     ', message.data);
              }
              break;
              
            case 'error':
              console.error(`%c  ❌ ${message.message}`, 'color: #ef4444; font-weight: bold');
              if (message.data) {
                console.error('     ', message.data);
              }
              break;
              
            case 'result':
              // Cerrar último grupo
              if (currentStage) {
                const stageDuration = Date.now() - stageTimings[currentStage];
                console.log(`%c⏱️  Duración: ${formatTime(stageDuration)}`, 'color: #6b7280; font-style: italic');
                console.groupEnd();
              }
              
              const totalTime = Date.now() - startTime;
              
              console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #10b981; font-weight: bold');
              console.log(`%c🎉 PROCESAMIENTO COMPLETADO - ${getTimestamp()}`, 'background: linear-gradient(90deg, #059669, #10b981); color: white; padding: 10px 20px; border-radius: 8px; font-weight: bold; font-size: 16px; text-shadow: 1px 1px 2px rgba(0,0,0,0.3)');
              console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #10b981; font-weight: bold');
              
              // Tabla de resultados
              console.group('%c📊 Resultado de la Evaluación', 'color: #10b981; font-weight: bold; font-size: 14px');
              console.table({
                '🆔 ID Auditoría': message.data.auditId,
                '📈 Puntuación': `${message.data.totalScore}/${message.data.maxPossibleScore} puntos`,
                '🎯 Porcentaje': `${message.data.percentage.toFixed(1)}%`,
                '⏱️ Tiempo Total': formatTime(totalTime),
                '📝 Criterios': message.data.detailedScores?.length || 0,
                '💡 Recomendaciones': message.data.recommendations?.length || 0,
                '🔑 Momentos Clave': message.data.keyMoments?.length || 0
              });
              console.groupEnd();
              
              // Desglose de tiempos
              console.group('%c⏱️  Desglose de Tiempos', 'color: #6b7280; font-weight: bold; font-size: 12px');
              const timingTable: Record<string, string> = {};
              for (const [stage, startTs] of Object.entries(stageTimings)) {
                const nextStages = Object.keys(stageTimings);
                const currentIndex = nextStages.indexOf(stage);
                const nextStageStart = currentIndex < nextStages.length - 1 
                  ? stageTimings[nextStages[currentIndex + 1]]
                  : Date.now();
                const duration = nextStageStart - startTs;
                timingTable[stage] = formatTime(duration);
              }
              console.table(timingTable);
              console.groupEnd();
              
              // Objeto completo
              console.group('%c📦 Datos Completos (expandir para ver detalles)', 'color: #6b7280; font-size: 11px; font-style: italic');
              console.log(message.data);
              console.groupEnd();
              
              console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #10b981; font-weight: bold');
              
              // ✅ GUARDAR auditId
              if (message.data?.auditId) {
                completedAuditId = message.data.auditId;
              }
              
              // Actualizar UI
              setProcessing({
                stage: 'completed',
                progress: 100,
                message: '¡Auditoría completada exitosamente!'
              });
              
              // Cerrar SSE
              eventSource.close();
              
              // Navegar a resultados
              setTimeout(() => {
                if (completedAuditId) {
                  toast.success('¡Evaluación completada exitosamente!', {
                    duration: 4000,
                    icon: '🎉'
                  });
                  navigate(`/audit/${completedAuditId}`);
                }
              }, 1000);
              break;
          }
        } catch (error) {
          console.error('Error parsing SSE message:', error);
        }
      };

      eventSource.onerror = () => {
        console.log('%c📡 Stream de progreso cerrado', 'color: #6b7280; font-style: italic; font-size: 11px');
        eventSource.close();
      };

      // ============================================
      // ENVIAR ARCHIVOS
      // ============================================
      const result = await auditService.processAudit(
        formData,
        audioFile,
        imageFiles,
        sseClientId
      );

      // ✅ NUEVO: Si la respuesta incluye auditId, guardarlo como fallback
      if (result?.auditId && !completedAuditId) {
        completedAuditId = result.auditId;
        
        // Si SSE no envió el resultado, navegar manualmente
        setTimeout(() => {
          if (completedAuditId) {
            toast.success('¡Evaluación completada exitosamente!', {
              duration: 4000,
              icon: '🎉'
            });
            navigate(`/audit/${completedAuditId}`);
          }
        }, 2000);
      }

    } catch (error: any) {
      console.error('Error processing audit:', error);
      toast.error(error.response?.data?.error || 'Error al procesar la auditoría');
      setState('form');
    }
  };

  const handleReset = () => {
    setFormData({
      executiveName: '',
      executiveId: '',
      callType: '',
      excelType: '',
      clientId: '',
      callDate: ''
    });
    setAudioFile(null);
    setImageFiles([]);
  };

  const isFormValid = () => {
    return (
      formData.executiveName &&
      formData.executiveId &&
      formData.callType &&
      formData.excelType &&
      formData.clientId &&
      formData.callDate &&
      audioFile &&
      imageFiles.length > 0
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="bg-slate-900/80 backdrop-blur-lg border-b border-slate-800 shadow-2xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/')}
                className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-slate-400" />
              </button>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent flex items-center gap-3">
                  <Sparkles className="w-8 h-8 text-purple-400" />
                  Nueva Auditoría
                </h1>
                <p className="text-slate-400 text-sm mt-1 flex items-center gap-2">
                  <Sparkles className="w-3 h-3" />
                  Sistema de Evaluación Automatizada con IA
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {state === 'form' ? (
          <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-slate-800 shadow-2xl p-8">
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Información del Ejecutivo */}
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-slate-200 flex items-center gap-2">
                  <User className="w-5 h-5 text-purple-400" />
                  Información del Ejecutivo
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Nombre Completo
                    </label>
                    <input
                      type="text"
                      value={formData.executiveName}
                      onChange={(e) => setFormData({ ...formData, executiveName: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-slate-200 placeholder-slate-500"
                      placeholder="Ej: Juan Pérez García"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      ID del Ejecutivo
                    </label>
                    <input
                      type="text"
                      value={formData.executiveId}
                      onChange={(e) => setFormData({ ...formData, executiveId: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-slate-200 placeholder-slate-500"
                      placeholder="Ej: EXE001"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Información de la Llamada */}
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-slate-200 flex items-center gap-2">
                  <Phone className="w-5 h-5 text-blue-400" />
                  Información de la Llamada
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Tipo de Llamada
                    </label>
                    <select
                      value={formData.callType}
                      onChange={(e) => setFormData({ ...formData, callType: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-slate-200"
                      required
                    >
                      <option value="">Seleccionar tipo...</option>
                      {CALL_TYPES_VISIBLE.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Tipo de Reporte
                    </label>
                    <select
                      value={formData.excelType}
                      onChange={(e) => setFormData({ ...formData, excelType: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-slate-200"
                      required
                    >
                      <option value="">Seleccionar formato...</option>
                      {EXCEL_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      ID del Cliente
                    </label>
                    <input
                      type="text"
                      value={formData.clientId}
                      onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-slate-200 placeholder-slate-500"
                      placeholder="Ej: CLI12345"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Fecha de la Llamada
                    </label>
                    <input
                      type="date"
                      value={formData.callDate}
                      onChange={(e) => setFormData({ ...formData, callDate: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-slate-200"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Archivos */}
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-slate-200 flex items-center gap-2">
                  <Hash className="w-5 h-5 text-pink-400" />
                  Archivos
                </h2>

                <div className="space-y-6">
                  <FileUploader
                    type="audio"
                    onFileSelect={setAudioFile}
                    accept="audio/wav,audio/mpeg,audio/mp3"
                    maxSize={100}
                  />

                  <FileUploader
                    type="images"
                    onFilesSelect={setImageFiles}
                    accept="image/jpeg,image/jpg,image/png"
                    maxSize={10}
                    multiple
                    maxFiles={15}
                  />
                </div>
              </div>

              {/* Botones */}
              <div className="flex gap-4 pt-6">
                <button
                  type="submit"
                  disabled={!isFormValid()}
                  className="flex-1 px-6 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-purple-500/50 flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-5 h-5" />
                  Iniciar Auditoría
                </button>

                <button
                  type="button"
                  onClick={handleReset}
                  className="px-6 py-4 bg-slate-800 text-slate-300 rounded-lg font-semibold hover:bg-slate-700 transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-5 h-5" />
                  Limpiar
                </button>
              </div>
            </form>
          </div>
        ) : (
          <ProcessingStatus
            stage={processing.stage}
            progress={processing.progress}
            message={processing.message}
          />
        )}
      </main>
    </div>
  );
}