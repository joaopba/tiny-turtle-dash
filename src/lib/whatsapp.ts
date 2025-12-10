import { supabase } from "@/integrations/supabase/client";

export interface WhatsappOpmeNotificationData {
  opmeName: string;
  opmeBarcode: string | null | undefined;
  patientName: string;
  cpsId: number | string;
  convenioName?: string | null;
  quantity?: number;
  timestamp: string;
}

export async function sendWhatsappNotification(data: WhatsappOpmeNotificationData) {
  console.log("Iniciando invocação da Edge Function 'send-whatsapp-alert'...");
  const { error } = await supabase.functions.invoke('send-whatsapp-alert', {
    body: data,
  });

  if (error) {
    console.error("Erro na invocação da Edge Function:", error);
    throw new Error(
      `Falha ao invocar Edge Function para WhatsApp: ${error.message}`,
    );
  }
}