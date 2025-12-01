import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { start_date, end_date } = await req.json();

    if (!start_date || !end_date) {
      return new Response(JSON.stringify({ error: 'Missing required parameters: start_date, end_date' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Busca nos centros de custo (CPS)
    const businessUnits = ["43", "47", "48"];
    const fetchPromises = businessUnits.map(unit => {
      const apiUrl = `https://api-lab.my-world.dev.br/cps/list-cps?start_date=${start_date}&end_date=${end_date}&type_cps=INT&type_group=CPS&business_unit=${unit}`;
      return fetch(apiUrl);
    });

    // Adiciona a busca no grupo ENDOSCOPIA
    const endoscopiaApiUrl = `https://api-lab.my-world.dev.br/cps/list-cps?start_date=${start_date}&end_date=${end_date}&type_cps=ALL&type_group=ENDOSCOPIA`;
    fetchPromises.push(fetch(endoscopiaApiUrl));

    const responses = await Promise.all(fetchPromises);

    for (const response of responses) {
      if (!response.ok) {
        const errorText = await response.text();
        const url = response.url;
        const identifier = url.includes('ENDOSCOPIA') ? 'ENDOSCOPIA' : `unit ${url.split('=').pop()}`;
        throw new Error(`External API error for ${identifier}: ${response.status} - ${errorText}`);
      }
    }

    const jsonDataPromises = responses.map(response => response.json());
    const results = await Promise.all(jsonDataPromises);

    // Combina e remove duplicados
    const combinedData = results.flat();
    const uniqueData = Array.from(new Map(combinedData.map(item => [item.CPS, item])).values());

    return new Response(JSON.stringify(uniqueData), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error("Error in Edge Function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});