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
    const cpsUrls = businessUnits.map(unit => 
      `https://api-lab.my-world.dev.br/cps/list-cps?start_date=${start_date}&end_date=${end_date}&type_cps=INT&type_group=CPS&business_unit=${unit}`
    );
    
    // Adiciona a busca no grupo ENDOSCOPIA
    const endoscopiaUrl = `https://api-lab.my-world.dev.br/cps/list-cps?start_date=${start_date}&end_date=${end_date}&type_cps=ALL&type_group=ENDOSCOPIA`;
    
    const allUrls = [...cpsUrls, endoscopiaUrl];

    const fetchPromises = allUrls.map(url => fetch(url));

    // Usamos allSettled para que uma falha não derrube todas as buscas
    const settledResponses = await Promise.allSettled(fetchPromises);

    const successfulResults = [];
    
    for (const result of settledResponses) {
      if (result.status === 'fulfilled') {
        const response = result.value;
        if (response.ok) {
          try {
            const data = await response.json();
            // Garante que o resultado é um array antes de adicionar
            if (Array.isArray(data)) {
              successfulResults.push(...data);
            }
          } catch (e) {
            console.error(`Failed to parse JSON from ${response.url}:`, e);
          }
        } else {
          // Loga o erro da API externa mas não quebra a função
          const errorText = await response.text();
          const url = response.url;
          const identifier = url.includes('ENDOSCOPIA') ? 'ENDOSCOPIA' : `unit ${url.split('=').pop()}`;
          console.error(`External API error for ${identifier}: ${response.status} - ${errorText}`);
        }
      } else {
        // Loga erros de rede ou outros
        console.error("Fetch promise rejected:", result.reason);
      }
    }

    // Combina e remove duplicados de todos os resultados bem-sucedidos
    const uniqueData = Array.from(new Map(successfulResults.map(item => [item.CPS, item])).values());

    return new Response(JSON.stringify(uniqueData), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("Critical Error in Edge Function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});