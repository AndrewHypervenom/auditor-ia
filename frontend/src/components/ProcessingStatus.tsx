// frontend/src/components/ProcessingStatus.tsx

import { Loader2, CheckCircle2, Clock, Brain, FileSearch, Mic, FileSpreadsheet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { Stagger, StaggerItem } from '../lib/motion';

interface ProcessingStatusProps {
 stage: string;
 progress: number;
 message?: string;
}

// Gradiente corporativo: verde #10D451 (primario) → magenta #B33D9E (secundario)
const CORP_GRADIENT = 'linear-gradient(90deg, #10D451, #B33D9E)';

export default function ProcessingStatus({ stage, progress, message }: ProcessingStatusProps) {
 const { t } = useTranslation();
 const stages = [
 { id: 'upload',     label: t('processingStatus.stageGpfData'),    icon: Clock,           duration: '~10s' },
 { id: 'analysis',   label: t('processingStatus.stageAnalyzing'),  icon: FileSearch,      duration: '~30s' },
 { id: 'audio',      label: t('processingStatus.stageAudio'),      icon: Mic,             duration: '~45s' },
 { id: 'evaluation', label: t('processingStatus.stageEvaluation'), icon: Brain,           duration: '~50s' },
 { id: 'excel',      label: t('processingStatus.stageExcel'),      icon: FileSpreadsheet, duration: '~5s'  },
 { id: 'completed',  label: t('processingStatus.stageCompleted'),  icon: CheckCircle2,    duration: ''     },
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
 const done = normalizedStage === 'completed';

 return (
 <div className="card animate-fadeIn max-w-2xl mx-auto p-5">
 {/* Header */}
 <div className="text-center mb-4">
 {done ? (
 <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-corp-green to-green-600 mb-3 shadow-glow">
 <CheckCircle2 className="w-8 h-8 text-white" />
 </div>
 ) : (
 <div className="relative inline-flex items-center justify-center mb-3">
 <div className="absolute inset-0 rounded-2xl blur-lg opacity-60" style={{ background: CORP_GRADIENT }} />
 <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: CORP_GRADIENT }}>
 <Loader2 className="w-7 h-7 text-white animate-spin" />
 </div>
 </div>
 )}
 <h2 className="text-xl font-bold mb-1 bg-clip-text text-transparent" style={{ backgroundImage: CORP_GRADIENT }}>
 {done ? t('processingStatus.completedTitle') : t('processingStatus.processingTitle')}
 </h2>
 <p className="text-slate-400 text-sm">
 {done ? t('processingStatus.completedMessage') : t('processingStatus.processingMessage')}
 </p>
 </div>

 {/* Progress Bar */}
 <div className="mb-6">
 <div className="flex items-center justify-between mb-2">
 <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
 {t('processingStatus.progressLabel')}
 </span>
 <span className="text-xl font-bold tabular-nums bg-clip-text text-transparent" style={{ backgroundImage: CORP_GRADIENT }}>
 {progress}%
 </span>
 </div>
 <div className="relative w-full h-2.5 bg-slate-800 rounded-full overflow-hidden shadow-inner">
 <motion.div
 className="absolute inset-y-0 left-0 rounded-full overflow-hidden"
 style={{ background: done ? 'linear-gradient(90deg,#10D451,#1ADE50)' : CORP_GRADIENT }}
 initial={false}
 animate={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
 transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
 >
 {/* Brillo que recorre la barra */}
 {!done && (
 <motion.div
 className="absolute inset-0"
 style={{ background: 'linear-gradient(100deg, transparent 30%, rgba(255,255,255,0.4) 50%, transparent 70%)' }}
 initial={{ x: '-100%' }}
 animate={{ x: '100%' }}
 transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
 />
 )}
 </motion.div>
 </div>
 </div>

 {/* Message del SSE */}
 {message && (
 <div className={`mb-4 px-4 py-2.5 rounded-lg border ${
 done ? 'bg-corp-green/10 border-corp-green/30' : 'bg-magenta-500/10 border-magenta-500/25'
 }`}>
 <p className={`text-sm text-center font-medium ${done ? 'text-corp-green' : 'text-magenta-300'}`}>
 {message}
 </p>
 </div>
 )}

 {/* Stages */}
 <Stagger className="space-y-2">
 {stages.map((s, index) => {
 const isCompleted = index < currentStageIndex || done;
 const isCurrent = index === currentStageIndex && !done;
 const Icon = s.icon;

 return (
 <StaggerItem
 key={s.id}
 className={`relative flex items-center gap-3 p-3 rounded-xl border transition-colors duration-500 ${
 isCurrent
 ? 'border-corp-green/40 shadow-glow'
 : isCompleted
 ? 'bg-slate-800/40 border-corp-green/15'
 : 'bg-slate-900/30 border-slate-800'
 }`}
 >
 {isCurrent && (
 <div className="absolute inset-0 rounded-xl opacity-10 pointer-events-none" style={{ background: CORP_GRADIENT }} />
 )}

 {/* Connector line */}
 {index < stages.length - 1 && (
 <div className={`absolute left-[26px] top-full w-0.5 h-2 transition-colors duration-500 ${
 isCompleted ? 'bg-corp-green' : isCurrent ? 'bg-corp-green/50' : 'bg-slate-700'
 }`} />
 )}

 {/* Icon */}
 <div className="relative flex-shrink-0">
 {isCompleted ? (
 <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-corp-green to-green-600 flex items-center justify-center shadow-lg">
 <CheckCircle2 className="w-5 h-5 text-white" />
 </div>
 ) : isCurrent ? (
 <div className="w-11 h-11 rounded-xl flex items-center justify-center shadow-glow animate-pulse-ring" style={{ background: CORP_GRADIENT }}>
 <Icon className="w-5 h-5 text-white" />
 </div>
 ) : (
 <div className="w-11 h-11 rounded-xl border border-slate-700 bg-slate-800/50 flex items-center justify-center">
 <Icon className="w-5 h-5 text-slate-500" />
 </div>
 )}
 </div>

 {/* Content */}
 <div className="relative flex-1 min-w-0">
 <div className="flex items-center gap-2 flex-wrap">
 <p className={`font-semibold text-sm transition-colors duration-500 ${
 isCurrent ? 'text-white' : isCompleted ? 'text-corp-green' : 'text-slate-500'
 }`}>
 {s.label}
 </p>
 {isCompleted && (
 <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-corp-green/15 text-corp-green border border-corp-green/30">
 {t('processingStatus.completedBadge')}
 </span>
 )}
 {isCurrent && (
 <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-magenta-500/15 text-magenta-300 border border-magenta-500/30 animate-pulse">
 {t('processingStatus.inProgress')}
 </span>
 )}
 </div>
 {s.duration && !isCompleted && (
 <p className={`text-xs mt-0.5 ${isCurrent ? 'text-slate-400' : 'text-slate-600'}`}>
 {s.duration}
 </p>
 )}
 </div>

 {/* Loading spinner for current stage */}
 {isCurrent && (
 <div className="relative flex-shrink-0">
 <Loader2 className="w-4 h-4 text-corp-green animate-spin" />
 </div>
 )}
 </StaggerItem>
 );
 })}
 </Stagger>

 {/* Footer info */}
 {!done && (
 <div className="mt-5 px-4 py-3 bg-corp-green/5 border border-corp-green/20 rounded-xl">
 <div className="flex items-start gap-3">
 <Clock className="w-4 h-4 text-corp-green flex-shrink-0 mt-0.5" />
 <div>
 <p className="text-xs font-semibold text-corp-green mb-0.5">
 {t('processingStatus.estimatedTime')}
 </p>
 <p className="text-xs text-slate-400">
 {t('processingStatus.doNotClose')}
 </p>
 </div>
 </div>
 </div>
 )}
 </div>
 );
}
