const WHATSAPP_API_URL =
  "https://apibot.chatconquista.com/v2/api/external/0b50b721-3442-407c-b5b5-231034f3ff01";
const WHATSAPP_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0ZW5hbnRJZCI6MSwicHJvZmlsZSI6ImFkbWluIiwic2Vzc2lvbklkIjoxLCJpYXQiOjE3NjE4MDQ2NjYsImV4cCI6MTgyNDg3NjY2Nn0.xlhKoH-yVWUOlsGK4h9Ukcll05k1P3fT-TGiqW4cU6Q";
const TARGET_NUMBER = "557734208877";

export interface WhatsappOpmeNotificationData {
  opmeName: string;
  opmeBarcode: string | null | undefined;
  patientName: string;
  cpsId: number | string;
  convenioName?: string | null;
  quantity?: number;
  timestamp: string;
}

export async function sendWhatsappNotification({
  opmeName,
  opmeBarcode,
  patientName,
  cpsId,
  convenioName,
  quantity = 1,
  timestamp,
}: WhatsappOpmeNotificationData) {
  const cleanedBarcode = opmeBarcode ?? "não informado";
  const body = `OPME bipado: ${opmeName} (Cód. Barras: ${cleanedBarcode}). Paciente: ${patientName} (CPS ${cpsId}). Convênio: ${convenioName ?? "N/A"}. Quantidade: ${quantity}. Horário: ${timestamp}.`;

  const response = await fetch(WHATSAPP_API_URL, {
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

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Falha ao enviar alerta via WhatsApp (${response.status}): ${errorText}`,
    );
  }
}