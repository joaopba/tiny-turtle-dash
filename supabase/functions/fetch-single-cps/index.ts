import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { format, subDays } from "https://deno.land/std@0.190.0/datetime/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("Iniciando a função fetch-single-cps...");

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { cps_id } = await req.json();
    if (!cps_id) {
      console.error("Erro: cps_id é obrigatório.");
      return new Response(JSON.stringify({ error: 'cps_id is required' }), { status: 400, headers: corsHeaders });
    }
    console.log(`Buscando CPS ID: ${cps_id}`);

    const endDate = new Date();
    const startDate = subDays(endDate, 365);
    const formattedStartDate = format(startDate, "yyyy-MM-dd");
    const formattedEndDate = format(endDate, "yyyy-MM-dd");

    const businessUnits = ["47", "48"];
    const fetchPromises = businessUnits.map(unit =>
      fetch(`https://api-lab.my-world.dev.br/cps/list-cps?start_date=${formattedStartDate}&end_date=${formattedEndDate}&type_cps=ALL&type_group=ENDOSCOPIA&business_unit=${unit}&cps_id=${cps_id}`)
    );

    console.log("Enviando requisições para a API externa...");
    const settledResponses = await Promise.allSettled(fetchPromises);
    let foundRecord = null;

    for (const result of settledResponses) {
      if (result.status === 'fulfilled' && result.value.ok) {
        const data = await result.value.json();
        if (Array.isArray(data) && data.length > 0) {
          console.log(`Registro encontrado na API para CPS ${cps_id}`);
          foundRecord = data[0];
          break; 
        }
      } else if (result.status === 'rejected') {
        console.error("Erro em uma das requisições fetch:", result.reason);
      }
    }

    if (foundRecord) {
      const recordToUpsert = {
        cps_id: foundRecord.CPS,
        patient: foundRecord.PATIENT,
        professional: foundRecord.PROFESSIONAL,
        agreement: foundRecord.AGREEMENT,
        business_unit: foundRecord.UNIDADENEGOCIO,
        created_at: foundRecord.CREATED_AT,
      };

      console.log(`Fazendo upsert do registro para CPS ${cps_id} no Supabase...`);
      const { error: upsertError } = await supabaseAdmin
        .from('local_cps_records')
        .upsert(recordToUpsert, { onConflict: 'cps_id' });

      if (upsertError) {
        console.error("Erro durante o upsert no Supabase:", upsertError);
        throw upsertError;
      }

      console.log("Upsert concluído com sucesso.");
      return new Response(JSON.stringify({ data: recordToUpsert }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Nenhum registro encontrado para CPS ${cps_id} na API externa.`);
    return new Response(JSON.stringify({ data: null }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("Erro crítico na função fetch-single-cps:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});