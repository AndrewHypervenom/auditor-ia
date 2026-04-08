// frontend/src/pages/AuditDetailPage.tsx

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { auditService, type AuditDetail } from '../services/api';
import ResultsView from '../components/ResultsView';
import { ArrowLeft, Loader2, UserCheck } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function AuditDetailPage() {
  const { auditId } = useParams<{ auditId: string }>();
  const navigate = useNavigate();
  const [auditDetail, setAuditDetail] = useState<AuditDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAuditDetail();
  }, [auditId]);

  const loadAuditDetail = async () => {
    if (!auditId) return;

    try {
      setLoading(true);
      const data = await auditService.getAuditById(auditId);
      setAuditDetail(data);
    } catch (error: any) {
      toast.error('Error al cargar auditoría');
      console.error(error);
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!auditDetail?.evaluation?.excel_filename) return;

    try {
      toast.loading('Preparando descarga...', { id: 'download' });
      const blob = await auditService.downloadExcel(auditDetail.evaluation.excel_filename);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = auditDetail.evaluation.excel_filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Excel descargado exitosamente', { id: 'download' });
    } catch (error) {
      toast.error('Error al descargar el archivo', { id: 'download' });
      console.error(error);
    }
  };

  const handleNewAudit = () => {
    navigate('/audit/new');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-400 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Cargando auditoría...</p>
        </div>
      </div>
    );
  }

  if (!auditDetail || !auditDetail.evaluation) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400 mb-4">Auditoría no encontrada</p>
          <button onClick={() => navigate('/dashboard')} className="btn-primary">
            Volver al Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Convertir datos de BD a formato EvaluationResult
  const evaluationResult = {
    totalScore: auditDetail.evaluation.total_score,
    maxPossibleScore: auditDetail.evaluation.max_possible_score,
    percentage: auditDetail.evaluation.percentage,
    detailedScores: auditDetail.evaluation.detailed_scores,
    observations: auditDetail.evaluation.observations,
    recommendations: auditDetail.evaluation.recommendations,
    keyMoments: auditDetail.evaluation.key_moments,
    transcript: auditDetail.transcription?.full_text || '',
    audioConfidence: auditDetail.transcription?.confidence !== undefined
      ? auditDetail.transcription.confidence * 100
      : undefined,
    excelUrl: auditDetail.evaluation.excel_filename
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="bg-slate-900/80 backdrop-blur-lg border-b border-slate-800 shadow-2xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="btn-ghost flex items-center gap-2"
            >
              <ArrowLeft className="w-5 h-5" />
              Volver al Dashboard
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Info del creador */}
        {auditDetail.audit?.created_by_name && (
          <div className="mb-6 px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl flex items-center gap-3 text-sm">
            <UserCheck className="w-5 h-5 text-cyan-400 flex-shrink-0" />
            <span className="text-slate-400">Creado por:</span>
            <span className="text-cyan-300 font-semibold">{auditDetail.audit.created_by_name}</span>
            {auditDetail.audit.created_by_email && (
              <span className="text-slate-500">({auditDetail.audit.created_by_email})</span>
            )}
          </div>
        )}
        <ResultsView
          result={evaluationResult}
          callType={auditDetail.audit?.call_type}
          onDownload={handleDownload}
          onNewAudit={handleNewAudit}
        />
      </main>
    </div>
  );
}