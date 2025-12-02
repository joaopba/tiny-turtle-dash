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

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { cps_id } = await req.json();
    if (!cps_id) {
      return new Response(JSON.stringify({ error: 'cps_id is required' }), { status: 400, headers: corsHeaders });
    }

    // Busca em um período amplo para aumentar a chance de encontrar o CPS
    const endDate = new Date();
    const startDate = subDays(endDate, 365);
    const formattedStartDate = format(startDate, "yyyy-MM-dd");
    const formattedEndDate = format(endDate, "yyyy-MM-dd");

    const businessUnits = ["47", "48"];
    const fetchPromises = businessUnits.map(unit =>
      fetch(`https://api-lab.my-world.dev.br/cps/list-cps?start_date=${formattedStartDate}&end_date=${formattedEndDate}&type_cps=ALL&type_group=ENDOSCOPIA&business_unit=${unit}&cps_id=${cps_id}`)
    );

    const responses = await Promise.all(fetchPromises);
    let foundRecord = null;

    for (const res of responses) {
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          foundRecord = data[0];
          break; 
        }
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

      const { error: upsertError } = await supabaseAdmin
        .from('local_cps_records')
        .upsert(recordToUpsert, { onConflict: 'cps_id' });

      if (upsertError) throw upsertError;

      return new Response(JSON.stringify({ data: recordToUpsert }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ data: null }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("Erro na função fetch-single-cps:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});