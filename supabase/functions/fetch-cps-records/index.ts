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

    const businessUnits = ["43", "47", "48"];

    const fetchPromises = businessUnits.map(unit => {
      const apiUrl = `https://api-lab.my-world.dev.br/cps/list-cps?start_date=${start_date}&end_date=${end_date}&type_cps=INT&type_group=CPS&business_unit=${unit}`;
      return fetch(apiUrl);
    });

    const responses = await Promise.all(fetchPromises);

    for (const response of responses) {
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`External API error for unit ${response.url.split('=').pop()}: ${response.status} - ${errorText}`);
      }
    }

    const jsonDataPromises = responses.map(response => response.json());
    const results = await Promise.all(jsonDataPromises);

    const combinedData = results.flat();

    return new Response(JSON.stringify(combinedData), {
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