import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Variáveis de configuração da API do WhatsApp
const WHATSAPP_API_URL = "https://apibot.chatconquista.com/v2/api/external/0b50b721-3442-407c-b5b5-231034f3ff01";
const WHATSAPP_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0ZW5hbnRJZCI6MSwicHJvZmlsZSI6ImFkbWluIiwic2Vzc2lvbklkIjoxLCJpYXQiOjE3NjE4MDQ2NjYsImV4cCI6MTgyNDg3NjY2Nn0.xlhKoH-yVWUOlsGK4h9Ukcll05k1P3fT-TGiqW4cU6Q";
const TARGET_NUMBER = "557734208877";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { opmeName, opmeBarcode, patientName, cpsId, convenioName, quantity, timestamp, lote, validade, referencia, anvisa, tuss, cod_simpro } = await req.json();

    if (!opmeName || !patientName || !cpsId) {
      return new Response(JSON.stringify({ error: 'Dados incompletos para notificação.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const cleanedBarcode = opmeBarcode ?? "N/A";
    const cleanedConvenio = convenioName ?? "N/A";
    const cleanedQuantity = quantity ?? 1;

    const body = `🚨 *ALERTA DE BIPAGEM DE OPME* 🚨\n\n` +
                 `*Paciente:* ${patientName}\n` +
                 `*CPS:* ${cpsId}\n` +
                 `*Convênio:* ${cleanedConvenio}\n\n` +
                 `*OPME Bipado:*\n` +
                 `  - Nome: ${opmeName}\n` +
                 `  - Cód. Barras: ${cleanedBarcode}\n` +
                 `  - Quantidade: ${cleanedQuantity}x\n` +
                 `  - Lote: ${lote ?? 'N/A'}\n` +
                 `  - Validade: ${validade ?? 'N/A'}\n` +
                 `  - Referência: ${referencia ?? 'N/A'}\n` +
                 `  - ANVISA: ${anvisa ?? 'N/A'}\n` +
                 `  - TUSS: ${tuss ?? 'N/A'}\n` +
                 `  - SIMPRO: ${cod_simpro ?? 'N/A'}\n\n` +
                 `_Horário: ${timestamp}_`;

    console.log(`Enviando mensagem para ${TARGET_NUMBER}: ${body}`);

    const whatsappResponse = await fetch(WHATSAPP_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      },
      body: JSON.stringify({
        body,
        number: TARGET_NUMBER,
        externalKey: `opme-${cpsId}-${Date.now()}`,
        isClosed: false,
      }),
    });

    if (!whatsappResponse.ok) {
      const errorText = await whatsappResponse.text();
      console.error("Erro da API do WhatsApp:", whatsappResponse.status, errorText);
      throw new Error(`Falha ao enviar alerta via WhatsApp (${whatsappResponse.status}): ${errorText}`);
    }

    return new Response(JSON.stringify({ message: "Notificação enviada com sucesso!" }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("Erro crítico na função send-whatsapp-alert:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});