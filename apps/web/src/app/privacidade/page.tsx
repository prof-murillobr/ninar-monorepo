import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacidade',
  description: 'Como o Ninar trata áudios e métricas de uso.',
  robots: { index: false, follow: true },
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#fff8f5] px-5 py-10 text-[#443b55] sm:px-8">
      <article className="mx-auto max-w-2xl rounded-3xl border border-white bg-white/80 p-7 shadow-sm sm:p-10">
        <Link className="text-sm font-bold text-[#8d78a4] hover:underline" href="/">← Voltar ao Ninar</Link>
        <h1 className="mt-7 text-3xl font-extrabold tracking-[-0.04em]">Privacidade e métricas</h1>
        <div className="mt-6 space-y-5 text-sm leading-7 text-[#7e7385]">
          <p>Os áudios são enviados somente para realizar a análise solicitada e são removidos após o processamento.</p>
          <p>Usamos métricas agregadas e sem cookies para entender o uso do produto, como visitas, origem de acesso e etapas gerais do fluxo. Não enviamos conteúdo de áudio, nomes de arquivo, identificadores de análise, resultados ou hipóteses de cuidado para a ferramenta de métricas.</p>
          <p>As métricas são hospedadas na nossa própria infraestrutura e respeitam a preferência “Do Not Track” do navegador.</p>
        </div>
      </article>
    </main>
  );
}
