import { useParams, useLocation } from "wouter";
import { PainelLayout, PageHeader } from "@/components/painel/layout";
import { useGetVeiculo } from "@workspace/api-client-react";

export default function VeiculoQR() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { data: veiculo, isLoading } = useGetVeiculo(params.id ?? "");

  const qr = veiculo?.qr_code;

  const handleDownload = () => {
    if (!qr?.imagem_qr) return;
    const link = document.createElement("a");
    link.href = qr.imagem_qr;
    link.download = `qr-${veiculo?.marca ?? ""}-${veiculo?.modelo ?? ""}-${veiculo?.ano_fabricacao ?? ""}.png`;
    link.click();
  };

  return (
    <PainelLayout>
      <PageHeader
        title="QR Code do Veículo"
        subtitle={veiculo ? `${veiculo.marca} ${veiculo.modelo} ${veiculo.ano_fabricacao}/${veiculo.ano_modelo}` : "Carregando..."}
        actions={
          <button
            onClick={() => setLocation("/painel/veiculos")}
            className="px-4 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50"
          >
            Voltar
          </button>
        }
      />
      <div className="p-6">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
            {isLoading ? (
              <div className="w-64 h-64 flex items-center justify-center mx-auto bg-gray-50 rounded-xl">
                <p className="text-gray-400">Carregando QR Code...</p>
              </div>
            ) : qr?.imagem_qr ? (
              <>
                <img
                  src={qr.imagem_qr}
                  alt="QR Code"
                  className="w-64 h-64 mx-auto rounded-xl"
                />
                <p className="text-sm text-gray-500 mt-4">
                  Escaneie para conversar com o agente IA sobre este veículo
                </p>
                <div className="mt-2 p-2 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-400 break-all">{qr.url_publica}</p>
                </div>
                <p className="text-xs text-gray-400 mt-1">{qr.total_scans} scans registrados</p>
              </>
            ) : (
              <div className="py-12">
                <p className="text-gray-400">QR Code não disponível</p>
                <p className="text-xs text-gray-300 mt-2">Tente recarregar ou recadastrar o veículo</p>
              </div>
            )}

            <div className="mt-6 flex gap-3 justify-center">
              <button
                onClick={handleDownload}
                disabled={!qr?.imagem_qr}
                className="px-4 py-2 btn-primary text-sm font-semibold rounded-xl disabled:opacity-40"
              >
                ⬇️ Baixar PNG
              </button>
              {qr?.url_publica && (
                <a
                  href={qr.url_publica}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
                >
                  🔗 Abrir Link
                </a>
              )}
            </div>
          </div>

          <div className="mt-4 bg-blue-50 rounded-2xl p-4">
            <p className="text-sm font-medium text-blue-700 mb-1.5">💡 Como usar</p>
            <ul className="text-xs text-blue-600 space-y-1">
              <li>• Imprima e cole no para-brisa ou vitrine do veículo</li>
              <li>• O cliente escaneia com a câmera do celular</li>
              <li>• O agente de voz IA inicia automaticamente</li>
              <li>• Toda conversa é registrada como lead</li>
            </ul>
          </div>
        </div>
      </div>
    </PainelLayout>
  );
}
