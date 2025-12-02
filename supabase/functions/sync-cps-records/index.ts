import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to prevent timezone issues with date-only strings
const formatCreatedAt = (createdAt: string | null | undefined): string | null => {
  if (!createdAt) return null;
  // Check if it's a date-only string (e.g., YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(createdAt)) {
    return `${createdAt}T12:00:00`; // Append midday time to avoid timezone shift to previous day
  }
  return createdAt;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("Iniciando a função sync-cps-records (versão otimizada)...");

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { start_date, end_date } = await req.json();
    if (!start_date || !end_date) {
      console.error("Erro: start_date e end_date são obrigatórios.");
      return new Response(JSON.stringify({ error: 'start_date and end_date are required' }), { status: 400, headers: corsHeaders });
    }
    console.log(`Período de busca recebido: ${start_date} a ${end_date}`);

    const businessUnits = ["47", "48"];
    const allUrls = businessUnits.map(unit => 
      `https://api-lab.my-world.dev.br/cps/list-cps?start_date=${start_date}&end_date=${end_date}&type_cps=ALL&type_group=ENDOSCOPIA&business_unit=${unit}`
    );
    
    console.log(`Buscando dados de ${allUrls.length} URLs otimizadas...`);

    const fetchPromises = allUrls.map(url => fetch(url));
    const settledResponses = await Promise.allSettled(fetchPromises);

    const successfulResults: any[] = [];
    settledResponses.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.ok) {
        console.log(`Sucesso ao buscar da URL: ${allUrls[index]}`);
      } else if (result.status === 'fulfilled') {
        console.warn(`Aviso: Falha ao buscar da URL ${allUrls[index]}. Status: ${result.value.status}`);
      } else {
        console.error(`Erro de rede ao buscar da URL ${allUrls[index]}:`, result.reason);
      }
    });

    for (const result of settledResponses) {
      if (result.status === 'fulfilled' && result.value.ok) {
        try {
          const data = await result.value.json();
          if (Array.isArray(data)) successfulResults.push(...data);
        } catch (e) {
          console.error(`Falha ao processar JSON da URL ${result.value.url}:`, e);
        }
      }
    }
    
    console.log(`Total de registros brutos recebidos da API: ${successfulResults.length}`);
    const uniqueData = Array.from(new Map(successfulResults.map(item => [item.CPS, item])).values());
    console.log(`Total de registros únicos a serem salvos: ${uniqueData.length}`);

    if (uniqueData.length === 0) {
      console.log("Nenhum registro novo para sincronizar.");
      return new Response(JSON.stringify({ message: "No new records to sync." }), { status: 200, headers: corsHeaders });
    }

    const recordsToUpsert = uniqueData.map(record => ({
      cps_id: record.CPS,
      patient: record.PATIENT,
      professional: record.PROFESSIONAL,
      agreement: record.AGREEMENT,
      business_unit: record.UNIDADENEGOCIO,
      created_at: formatCreatedAt(record.CREATED_AT),
    }));

    console.log(`Iniciando upsert de ${recordsToUpsert.length} registros...`);
    const { error: upsertError } = await supabaseAdmin
      .from('local_cps_records')
      .upsert(recordsToUpsert, { onConflict: 'cps_id' });

    if (upsertError) {
      console.error("Erro durante o upsert no Supabase:", upsertError);
      throw upsertError;
    }

    console.log(`Sincronização concluída com sucesso! ${uniqueData.length} registros foram salvos.`);
    return new Response(JSON.stringify({ message: `Successfully synced ${uniqueData.length} records.` }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("Erro crítico na função sync-cps-records:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});