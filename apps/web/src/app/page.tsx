'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Status = 'upload_pending' | 'queued' | 'processing' | 'completed' | 'failed';
type Prediction = { category: string; confidence: number };
type ClassificationResult = { model: string; sample_rate: number; duration_seconds: number; predictions: Prediction[]; confidence_low?: boolean };
type Analysis = { id: string; originalFilename: string; contentType: string; status: Status; result: ClassificationResult | null; errorMessage: string | null; createdAt: string; updatedAt: string };

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, '');
const MAX_RECORDING_SECONDS = 12;
const labels: Record<string, string> = { hungry: 'Fome', tired: 'Sono', belly_pain: 'Desconforto abdominal', burping: 'Arrotar', discomfort: 'Desconforto geral', uncertain: 'Ainda não sei' };
const labelFor = (value: string) => labels[value] ?? value.replaceAll('_', ' ');
const statusFor = (status: Status) => ({ upload_pending: 'Aguardando upload', queued: 'Na fila', processing: 'Analisando áudio', completed: 'Concluída', failed: 'Falhou' })[status];
const formatDate = (value: string) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
const normalizedContentType = (file: File) => file.type.split(';', 1)[0].trim().toLowerCase() || 'audio/webm';

async function apiError(response: Response, fallback: string): Promise<Error> {
  try {
    const body = (await response.json()) as { message?: string | string[] };
    const message = Array.isArray(body.message) ? body.message.join(' ') : body.message;
    return new Error(message || fallback);
  } catch {
    return new Error(fallback);
  }
}

function MicIcon({ size = 34 }: { size?: number }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 32 32" fill="none"><rect x="10" y="3" width="12" height="18" rx="6" fill="currentColor" /><path d="M6.5 15.5a9.5 9.5 0 0 0 19 0M16 25v4M11.5 29h9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>;
}

function SparkleIcon() {
  return <svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none"><path d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2ZM19 16l.7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z" fill="currentColor" /></svg>;
}

const categoryIcons: Record<string, string> = { hungry: '🍼', tired: '🌙', belly_pain: '🫧', burping: '💨', discomfort: '🧸', uncertain: '❔' };
const iconFor = (category?: string) => categoryIcons[category ?? 'uncertain'] ?? '🧸';
const predictionsFor = (analysis: Analysis) => analysis.result?.predictions.filter((prediction) => prediction.category !== 'uncertain') ?? [];
const topPredictionFor = (analysis: Analysis) => predictionsFor(analysis)[0] ?? analysis.result?.predictions[0];
const confidenceIsLow = (analysis: Analysis) => Boolean(analysis.result?.confidence_low || analysis.result?.predictions.some((prediction) => prediction.category === 'uncertain'));
const classificationFor = (analysis: Analysis) => {
  const top = topPredictionFor(analysis);
  return top ? `${labelFor(top.category)} · ${Math.round(top.confidence * 100)}%` : statusFor(analysis.status);
};

function CategoryIcon({ category, large = false }: { category?: string; large?: boolean }) {
  const label = category ? labelFor(category) : 'classificação pendente';
  return <span className={`category-icon ${large ? 'category-icon-large' : ''}`} role="img" aria-label={label}>{iconFor(category)}</span>;
}

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [current, setCurrent] = useState<Analysis | null>(null);
  const [selectedHistory, setSelectedHistory] = useState<Analysis | null>(null);
  const [historyClosing, setHistoryClosing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Analysis | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [history, setHistory] = useState<Analysis[]>([]);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingStartedAt, setRecordingStartedAt] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingTimeoutRef = useRef<number | null>(null);

  const closeHistoryModal = useCallback(() => {
    if (!selectedHistory || historyClosing) return;
    setHistoryClosing(true);
    window.setTimeout(() => {
      setSelectedHistory(null);
      setHistoryClosing(false);
    }, 220);
  }, [historyClosing, selectedHistory]);

  const loadHistory = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/analyses?limit=20`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Não foi possível carregar o histórico.');
      setHistory((await response.json()) as Analysis[]);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'API indisponível.');
    }
  }, []);

  useEffect(() => { void loadHistory(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [loadHistory]);

  useEffect(() => {
    if (!recording || !recordingStartedAt) return;
    const timer = window.setInterval(() => setRecordingDuration(Math.floor((Date.now() - recordingStartedAt) / 1000)), 250);
    return () => window.clearInterval(timer);
  }, [recording, recordingStartedAt]);

  useEffect(() => () => {
    if (recordingTimeoutRef.current) window.clearTimeout(recordingTimeoutRef.current);
  }, []);

  useEffect(() => {
    if (!selectedHistory && !deleteTarget) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (deleteTarget) setDeleteTarget(null);
      else closeHistoryModal();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [closeHistoryModal, deleteTarget, selectedHistory]);

  function stopRecording(startedAtOverride?: number) {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;
    if (recordingTimeoutRef.current) {
      window.clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }
    const startedAt = startedAtOverride ?? recordingStartedAt;
    recorder.stop();
    recorderRef.current = null;
    setRecording(false);
    setRecordingStartedAt(null);
    if (startedAt) setRecordingDuration(Math.min(MAX_RECORDING_SECONDS, Math.max(1, Math.floor((Date.now() - startedAt) / 1000))));
    setNotice(null);
  }

  async function toggleRecording() {
    if (busy) return;
    if (recording) {
      stopRecording();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredType = ['audio/webm;codecs=opus', 'audio/webm'].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = preferredType ? new MediaRecorder(stream, { mimeType: preferredType }) : new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => event.data.size && chunks.push(event.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        const extension = blob.type.includes('webm') ? 'webm' : 'audio';
        const file = new File([blob], `gravacao-${Date.now()}.${extension}`, { type: blob.type });
        setSelectedFile(file);
        setCurrent(null);
        setNotice(null);
        stream.getTracks().forEach((track) => track.stop());
        void submitAnalysis(file);
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecordingDuration(0);
      // eslint-disable-next-line react-hooks/purity -- this runs from the user interaction handler.
      const startedAt = Date.now();
      setRecordingStartedAt(startedAt);
      setRecording(true);
      setCurrent(null);
      setNotice(null);
      recordingTimeoutRef.current = window.setTimeout(() => stopRecording(startedAt), MAX_RECORDING_SECONDS * 1000);
    } catch {
      setNotice('Não foi possível acessar o microfone. Verifique a permissão e tente novamente.');
    }
  }

  async function waitForResult(id: string) {
    for (let attempt = 0; attempt < 90; attempt += 1) {
      const response = await fetch(`${API_URL}/analyses/${id}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Não foi possível consultar o processamento.');
      const analysis = (await response.json()) as Analysis;
      setCurrent(analysis);
      if (analysis.status === 'completed' || analysis.status === 'failed') return;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    throw new Error('O processamento demorou mais que o esperado; consulte o histórico.');
  }

  async function submitAnalysis(fileOverride?: File) {
    const file = fileOverride ?? selectedFile;
    if (!file || busy) return;
    setBusy(true);
    setNotice(null);
    setCurrent(null);
    try {
      const contentType = normalizedContentType(file);
      const uploadResponse = await fetch(`${API_URL}/analyses/upload-url`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename: file.name, contentType }) });
      if (!uploadResponse.ok) throw await apiError(uploadResponse, 'A API não gerou a URL de upload.');
      const upload = (await uploadResponse.json()) as { analysisId: string; objectKey: string; uploadUrl: string };
      const putResponse = await fetch(upload.uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: file });
      if (!putResponse.ok) throw new Error('O upload do áudio falhou.');
      const createResponse = await fetch(`${API_URL}/analyses`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ analysisId: upload.analysisId, objectKey: upload.objectKey, originalFilename: file.name, contentType }) });
      if (!createResponse.ok) throw await apiError(createResponse, 'A API não conseguiu enfileirar a análise.');
      await waitForResult(upload.analysisId);
      await loadHistory();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Não foi possível processar o áudio.');
    } finally {
      setBusy(false);
    }
  }

  function requestDelete(id: string) {
    const target = [current, selectedHistory, ...history].find((analysis): analysis is Analysis => analysis?.id === id);
    if (target) setDeleteTarget(target);
  }

  async function deleteAnalysis(id: string) {
    setDeletingId(id);
    const response = await fetch(`${API_URL}/analyses/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      setNotice('Não foi possível excluir a análise.');
      setDeletingId(null);
      return;
    }
    if (current?.id === id) setCurrent(null);
    if (selectedHistory?.id === id) {
      setSelectedHistory(null);
      setHistoryClosing(false);
    }
    setDeleteTarget(null);
    setDeletingId(null);
    await loadHistory();
  }

  const recordingTime = `${String(Math.floor(recordingDuration / 60)).padStart(2, '0')}:${String(recordingDuration % 60).padStart(2, '0')}`;

  return <div className="ninar-shell min-h-screen overflow-x-clip text-[#443b55]">
    <div className="ninar-orb ninar-orb-coral" />
    <div className="ninar-orb ninar-orb-lilac" />
    <main className="relative mx-auto w-full max-w-7xl px-5 py-6 sm:px-8 lg:px-12">
      <header className="app-header flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3"><div className="brand-mark"><span>n</span><span className="brand-sparkle">✦</span></div><div><p className="text-lg font-extrabold tracking-[-0.04em] text-[#443b55]">ninar</p><p className="brand-subtitle text-[10px] font-semibold text-[#9c889d]">um carinho para cada momento</p></div></div>
        <div className="privacy-pill flex items-center gap-2 rounded-full border border-white/80 bg-white/65 px-3.5 py-2 text-xs font-bold text-[#806f82] shadow-sm backdrop-blur"><span className="h-2 w-2 rounded-full bg-[#80c9ac] shadow-[0_0_0_4px_rgba(128,201,172,.16)]" /> ambiente privado</div>
      </header>

      <div className="grid gap-8 pb-12 pt-10 lg:grid-cols-[1.05fr_.95fr] lg:items-start">
        <section>
          <div className="hero-copy mb-7 max-w-xl"><div className="hero-eyebrow mb-4 inline-flex items-center gap-2 rounded-full bg-[#fff0e9] px-3.5 py-2 text-xs font-extrabold uppercase tracking-[0.12em] text-[#c26f68]"><SparkleIcon /> ninar</div><h1 className="max-w-lg text-4xl font-extrabold leading-[1.04] tracking-[-0.055em] text-[#443b55] sm:text-5xl"><span className="desktop-title">Que cuidado pode ajudar agora?</span><span className="mobile-title">Vamos cuidar juntinho?</span></h1><p className="hero-description mt-5 max-w-lg text-base leading-7 text-[#7e7385]"><span className="desktop-description">Grave o chorinho por alguns segundos e veja uma hipótese com percentual de confiança. Uma ajuda carinhosa para observar, nunca substitui orientação médica.</span><span className="mobile-description">Grave o chorinho por alguns segundos e veja hipóteses como fome, sono ou desconforto, com percentuais de confiança.</span></p></div>

          <div className="capture-card"><div className="capture-heading flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-extrabold text-[#443b55]">Grave um áudio curto</p><p className="mt-1 text-xs text-[#9c8c9d]">Fale por alguns segundos, sem pressa.</p></div><span className="rounded-full bg-[#f5f0fa] px-3 py-1.5 text-[11px] font-bold text-[#8d78a4]">privado</span></div>
            <div className="record-stage"><div className={`mic-shell ${recording ? 'is-recording' : ''}`}><button type="button" disabled={busy} aria-label={recording ? 'Parar gravação' : 'Gravar pelo microfone'} onClick={() => void toggleRecording()} className={`mic-button ${recording ? 'is-recording' : ''}`}><MicIcon size={38} /><span className="sr-only">{recording ? 'Parar gravação' : 'Gravar pelo microfone'}</span></button></div><div className="mt-5 text-center"><p className="text-base font-extrabold text-[#443b55]">{recording ? 'Estou ouvindo…' : 'Toque para gravar'}</p><p className="mt-1 text-sm text-[#9c8c9d]">{recording ? `${recordingTime} · toque quando terminar` : `Grave o choro por alguns segundos · máximo ${MAX_RECORDING_SECONDS}s`}</p></div></div>
            {busy && <p className="processing-hint mt-4" role="status"><span className="button-spinner" /> preparando uma resposta…</p>}
            {notice && <p role="alert" className="notice mt-4">{notice}</p>}
          </div>
          {current && <ResultCard analysis={current} onDelete={requestDelete} />}
        </section>

        <aside className="history-card"><div className="flex items-start justify-between gap-3"><div><p className="mb-3 text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#5b9b7d]">histórico</p><h2 className="text-2xl font-extrabold tracking-[-0.04em] text-[#443b55]">Seus momentos de cuidado</h2><p className="mt-1 text-sm text-[#9c8c9d]">Os chorinhos que você já acolheu.</p></div><button type="button" onClick={() => void loadHistory()} className="rounded-full p-2 text-[#8d78a4] transition hover:bg-[#f5f0fa]" aria-label="Atualizar histórico">↻</button></div><div className="mt-7 space-y-3">{history.length === 0 && <p className="empty-history"><span>☁</span> Ainda não há registros por aqui. Grave o primeiro áudio quando quiser.</p>}{history.map((analysis) => <button key={analysis.id} type="button" onClick={() => setSelectedHistory(analysis)} className="history-item"><div className="flex min-w-0 items-center gap-3"><CategoryIcon category={topPredictionFor(analysis)?.category} /><div className="min-w-0"><span className="block truncate text-sm font-bold text-[#51465f]">{classificationFor(analysis)}</span><span className="mt-1 block text-xs text-[#aa9daa]">{formatDate(analysis.createdAt)}</span></div></div></button>)}</div></aside>
      </div>
      {selectedHistory && <div className={`history-modal ${historyClosing ? 'is-closing' : ''}`} role="presentation" onClick={closeHistoryModal}><div className="history-modal-panel" role="dialog" aria-modal="true" aria-labelledby="history-modal-title" onClick={(event) => event.stopPropagation()}><div className="history-modal-header"><div><p className="result-kicker">histórico</p><h2 id="history-modal-title">Um momento de cuidado</h2></div><button type="button" className="history-modal-close" aria-label="Fechar resultado" onClick={closeHistoryModal}>×</button></div><ResultCard analysis={selectedHistory} onDelete={requestDelete} /></div></div>}
      {deleteTarget && <div className="history-modal delete-confirm-overlay" role="presentation" onClick={() => deletingId === null && setDeleteTarget(null)}><div className="delete-confirm-panel" role="dialog" aria-modal="true" aria-labelledby="delete-dialog-title" onClick={(event) => event.stopPropagation()}><div className="delete-confirm-icon" aria-hidden="true">♡</div><p className="result-kicker">um momento de cuidado</p><h2 id="delete-dialog-title">Excluir este registro?</h2><p className="delete-confirm-copy">O áudio e o resultado serão removidos deste histórico.</p><div className="delete-confirm-actions"><button type="button" className="delete-cancel-button" disabled={deletingId !== null} onClick={() => setDeleteTarget(null)}>Manter registro</button><button type="button" className="delete-confirm-button" disabled={deletingId !== null} onClick={() => void deleteAnalysis(deleteTarget.id)}>{deletingId === deleteTarget.id ? 'Excluindo…' : 'Excluir registro'}</button></div></div></div>}
      <footer className="flex flex-wrap justify-between gap-3 border-t border-white/70 pt-5 text-xs font-semibold text-[#a393a2]"><span>feito para acolher · nunca substitui um profissional de saúde</span><span>Next.js · NestJS · IA privada</span></footer>
    </main>
  </div>;
}

function ResultCard({ analysis, onDelete }: { analysis: Analysis; onDelete: (id: string) => void }) {
  const predictions = predictionsFor(analysis);
  const top = topPredictionFor(analysis);
  const topPercent = top ? Math.round(top.confidence * 100) : 0;
  const responseCopy = confidenceIsLow(analysis) ? 'Esta é a melhor hipótese disponível, mas a confiança está baixa. Observe outros sinais do bebê também.' : 'Esta é a hipótese que mais combina com os sinais do áudio.';
  return <section className="result-card mt-7"><div className="flex items-start justify-between gap-4"><div><p className="result-kicker"><SparkleIcon /> resultado</p><p className="mt-2 text-xs font-semibold text-[#a293a2]">Uma leitura experimental para ajudar você a observar.</p></div><button type="button" onClick={() => void onDelete(analysis.id)} className="delete-button">Excluir</button></div>{analysis.status === 'queued' || analysis.status === 'processing' ? <div className="processing-box"><span className="processing-dot" /><div><p className="font-extrabold text-[#5b5067]">{statusFor(analysis.status)}…</p><p className="mt-1 text-sm text-[#9c8c9d]">O cuidador digital está olhando com carinho para o áudio.</p></div></div> : analysis.status === 'failed' ? <p className="notice mt-6">{analysis.errorMessage ?? 'A análise falhou.'}</p> : analysis.result && <><div className="result-highlight mt-6"><div className="confidence-bubble"><div><strong>{topPercent}</strong><span>%</span></div><small>confiança</small></div><div className="min-w-0"><p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#b17e75]">minha melhor hipótese</p><h2 className="mt-2 flex items-center gap-2 text-3xl font-extrabold tracking-[-0.05em] text-[#443b55]"><CategoryIcon category={top?.category} large />{top ? labelFor(top.category) : 'Incerto'}</h2><p className="mt-2 max-w-sm text-sm leading-6 text-[#817587]">{responseCopy}</p></div></div>{confidenceIsLow(analysis) && <p className="confidence-warning mt-4"><span>♡</span> Confiança baixa: o modelo ficou abaixo do limiar de 70%.</p>}<div className="mt-6 space-y-3">{predictions.map((prediction) => <div key={prediction.category}><div className="mb-1.5 flex justify-between text-xs font-bold"><span className="text-[#665a70]">{labelFor(prediction.category)}</span><span className="text-[#9b8c9b]">{Math.round(prediction.confidence * 100)}%</span></div><div className="h-2 overflow-hidden rounded-full bg-[#f1e8e5]"><div className={`h-full rounded-full ${prediction === top ? 'bg-[#e58d80]' : 'bg-[#c8b7d7]'}`} style={{ width: `${Math.max(2, prediction.confidence * 100)}%` }} /></div></div>)}</div><div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 border-t border-[#f1e7e4] pt-4 text-[11px] font-semibold text-[#aa9daa]"><span>Modelo: {analysis.result.model}</span><span>{analysis.result.duration_seconds}s de áudio</span><span>{analysis.result.sample_rate} Hz</span></div></>}</section>;
}
