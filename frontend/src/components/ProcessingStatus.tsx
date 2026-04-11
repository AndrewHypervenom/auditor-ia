// frontend/src/components/ProcessingStatus.tsx

import { Loader2, CheckCircle2, Clock, Brain, FileSearch, Mic, FileSpreadsheet } from 'lucide-react';

interface ProcessingStatusProps {
 stage: string;
 progress: number;
 message?: string;
}

export default function ProcessingStatus({ stage, progress, message }: ProcessingStatusProps) {
 const stages = [
 {
 id: 'upload',
 label: 'Obteniendo datos GPF',
 icon: Clock,
 duration: '~10s',
 color: 'blue'
 },
 {
 id: 'analysis',
 label: 'Analizando capturas (IA Vision)',
 icon: FileSearch,
 duration: '~30s',
 color: 'pink'
 },
 {
 id: 'audio',
 label: 'Procesando audio (AssemblyAI)',
 icon: Mic,
 duration: '~45s',
 color: 'purple'
 },
 {
 id: 'evaluation',
 label: 'Evaluando con IA',
 icon: Brain,
 duration: '~50s',
 color: 'green'
 },
 {
 id: 'excel',
 label: 'Generando reporte',
 icon: FileSpreadsheet,
 duration: '~5s',
 color: 'emerald'
 },
 {
 id: 'completed',
 label: 'Completado',
 icon: CheckCircle2,
 duration: '',
 color: 'emerald'
 }
 ];

 // Mapeo de posibles variantes de nombres de stage
 const stageNormalizer: Record<string, string> = {
 'uploading': 'upload',
 'upload': 'upload',
 'transcribing': 'audio',
 'transcription': 'audio',
 'audio': 'audio',
 'analyzing': 'analysis',
 'analysis': 'analysis',
 'evaluating': 'evaluation',
 'evaluation': 'evaluation',
 'excel': 'excel',
 'completed': 'completed',
 'error': 'error'
 };

 const normalizedStage = stageNormalizer[stage] || stage;
 const currentStageIndex = stages.findIndex(s => s.id === normalizedStage);

 const getStageColor = (color: string) => {
 const colors: Record<string, string> = {
 blue: 'from-brand-900/30 to-brand-800/30',
 purple: 'from-purple-500 to-purple-600',
 pink: 'from-pink-500 to-pink-600',
 green: 'from-green-500 to-green-600',
 emerald: 'from-emerald-500 to-emerald-600'
 };
 return colors[color] || colors.blue;
 };

 return (
 <div className="card animate-fadeIn max-w-3xl mx-auto">
 {/* Header */}
 <div className="text-center mb-5">
 {normalizedStage === 'completed' ? (
 <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 mb-4">
 <CheckCircle2 className="w-10 h-10 text-white" />
 </div>
 ) : (
 <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-brand-900/30 to-purple-500 mb-4 animate-pulse-ring">
 <Loader2 className="w-10 h-10 text-white animate-spin" />
 </div>
 )}
 <h2 className="text-2xl font-bold mb-2 bg-gradient-to-r from-brand-900/30 to-purple-400 bg-clip-text text-transparent">
 {normalizedStage === 'completed' ? '¡Auditoría Completada!' : 'Procesando Auditoría'}
 </h2>
 <p className="text-slate-400">
 {normalizedStage === 'completed' 
 ? 'Tu auditoría ha sido procesada exitosamente' 
 : 'Nuestro sistema de IA está analizando tu auditoría'}
 </p>
 </div>

 {/* Progress Bar */}
 <div className="mb-10">
 <div className="flex items-center justify-between mb-3">
 <span className="text-sm font-semibold text-slate-300">
 Progreso total
 </span>
 <span className="text-2xl font-bold bg-gradient-to-r from-brand-900/30 to-purple-400 bg-clip-text text-transparent">
 {progress}%
 </span>
 </div>
 <div className="relative w-full h-4 bg-slate-800 rounded-full overflow-hidden shadow-inner">
 <div
 className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out shadow-glow ${
 normalizedStage === 'completed'
 ? 'bg-gradient-to-r from-green-500 via-emerald-500 to-green-400'
 : 'bg-gradient-to-r from-brand-900/30 via-purple-500 to-pink-500'
 }`}
 style={{ width: `${progress}%` }}
 >
 <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent animate-pulse"></div>
 </div>
 </div>
 </div>

 {/* Message del SSE */}
 {message && (
 <div className={`mb-4 p-4 rounded-xl ${
 normalizedStage === 'completed'
 ? 'bg-green-500/10 border border-green-500/30'
 : 'bg-brand-500/10 border border-brand-700/40'
 }`}>
 <p className={`text-sm text-center font-medium ${
 normalizedStage === 'completed' ? 'text-green-300' : 'text-brand-300'
 }`}>
 {message}
 </p>
 </div>
 )}

 {/* Stages */}
 <div className="space-y-3">
 {stages.map((s, index) => {
 const isCompleted = index < currentStageIndex || normalizedStage === 'completed';
 const isCurrent = index === currentStageIndex && normalizedStage !== 'completed';
 const Icon = s.icon;

 return (
 <div
 key={s.id}
 className={`relative flex items-center gap-4 p-5 rounded-xl transition-all duration-500 ${
 isCurrent 
 ? 'bg-gradient-to-r from-brand-900/30 to-purple-500/10 border-2 border-brand-700/40 scale-[1.02] shadow-glow' 
 : isCompleted
 ? 'bg-slate-800/50 border border-green-500/20'
 : 'bg-slate-900/30 border border-slate-800'
 }`}
 >
 {/* Connector line */}
 {index < stages.length - 1 && (
 <div 
 className={`absolute left-7 top-full w-0.5 h-3 transition-colors duration-500 ${
 isCompleted ? 'bg-green-500' : isCurrent ? 'bg-brand-500' : 'bg-slate-700'
 }`}
 />
 )}

 {/* Icon */}
 <div className="flex-shrink-0">
 {isCompleted ? (
 <div className="w-14 h-14 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center shadow-lg transition-all duration-500">
 <CheckCircle2 className="w-7 h-7 text-white" />
 </div>
 ) : isCurrent ? (
 <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${getStageColor(s.color)} flex items-center justify-center shadow-glow animate-pulse-ring`}>
 <Icon className="w-7 h-7 text-white" />
 </div>
 ) : (
 <div className="w-14 h-14 rounded-full border-2 border-slate-700 bg-slate-800/50 flex items-center justify-center">
 <Icon className="w-6 h-6 text-slate-500" />
 </div>
 )}
 </div>

 {/* Content */}
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-3 mb-1">
 <p className={`font-semibold text-lg transition-colors duration-500 ${
 isCurrent 
 ? 'text-white' 
 : isCompleted 
 ? 'text-green-300' 
 : 'text-slate-500'
 }`}>
 {s.label}
 </p>
 {isCompleted && (
 <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
 Completado
 </span>
 )}
 {isCurrent && (
 <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-brand-500/10 text-brand-400 border border-brand-700/40 animate-pulse">
 En progreso...
 </span>
 )}
 </div>
 {s.duration && !isCompleted && (
 <p className={`text-sm ${
 isCurrent ? 'text-slate-400' : 'text-slate-600'
 }`}>
 {s.duration}
 </p>
 )}
 </div>

 {/* Loading spinner for current stage */}
 {isCurrent && (
 <div className="flex-shrink-0">
 <Loader2 className="w-5 h-5 text-brand-400 animate-spin" />
 </div>
 )}
 </div>
 );
 })}
 </div>

 {/* Footer info */}
 {normalizedStage !== 'completed' && (
 <div className="mt-8 p-4 bg-brand-500/5 border border-brand-700/20 rounded-xl">
 <div className="flex items-start gap-3">
 <Clock className="w-5 h-5 text-brand-400 flex-shrink-0 mt-0.5" />
 <div>
 <p className="text-sm font-medium text-brand-400 mb-1">
 Tiempo estimado: 2-4 minutos
 </p>
 <p className="text-xs text-slate-400">
 No cierres esta ventana. El proceso se completará automáticamente.
 </p>
 </div>
 </div>
 </div>
 )}
 </div>
 );
}