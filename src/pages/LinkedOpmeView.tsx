"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";
import { toast } from "sonner";
import { History, Search, Loader2, Scan } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";

interface LocalCpsRecord {
  id: string;
  user_id: string;
  cps_id: number;
  patient: string;
  professional: string;
  agreement: string;
  business_unit: string;
  created_at: string;
}

interface OpmeItem {
  id: string;
  opme: string;
  lote: string;
  validade: string;
  referencia: string;
  anvisa: string;
  tuss: string;
  cod_simpro: string;
  codigo_barras: string;
}

interface LinkedOpme {
  id: string;
  cps_id: number;
  opme_barcode: string;
  linked_at: string;
  quantity: number;
  opmeDetails?: OpmeItem;
}

const LinkedOpmeView = () => {
  const { session } = useSession();
  const userId = session?.user?.id;

  const [localCpsRecords, setLocalCpsRecords] = useState<(LocalCpsRecord & { linkedOpme: LinkedOpme[] })[]>([]);
  const [opmeInventory, setOpmeInventory] = useState<OpmeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState<string>("");

  useEffect(() => {
    console.log("LinkedOpmeView - Current userId:", userId);
    if (!userId) {
      toast.error("ID do usuário não disponível. Por favor, faça login novamente.");
    }
  }, [userId]);

  const fetchOpmeInventory = useCallback(async () => {
    // REMOVIDO FILTRO DE USUÁRIO PARA BUSCAR INVENTÁRIO GLOBAL
    const { data, error } = await supabase
      .from("opme_inventory")
      .select("*");

    if (error) {
      console.error("Erro ao buscar inventário OPME:", error);
      toast.error("Falha ao carregar inventário OPME.");
      return [];
    }
    return data as OpmeItem[];
  }, []);

  const fetchLinkedData = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      console.warn("fetchLinkedData (LinkedOpmeView): userId is null, skipping fetch.");
      return;
    }

    setLoading(true);
    try {
      const inventory = await fetchOpmeInventory();
      setOpmeInventory(inventory);

      const { data: cpsData, error: cpsError } = await supabase
        .from("local_cps_records")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (cpsError) {
        console.error("Erro ao buscar registros de CPS locais:", cpsError);
        toast.error("Falha ao carregar registros de CPS locais.");
        return;
      }

      const cpsRecordsWithLinkedOpme = await Promise.all(
        (cpsData as LocalCpsRecord[]).map(async (cps) => {
          const { data: linkedOpmeData, error: linkedOpmeError } = await supabase
            .from("linked_opme")
            .select("*")
            .eq("user_id", userId)
            .eq("cps_id", cps.cps_id)
            .order("linked_at", { ascending: false });

          if (linkedOpmeError) {
            console.error(`Erro ao buscar OPME bipado para CPS ${cps.cps_id}:`, linkedOpmeError);
            return { ...cps, linkedOpme: [] };
          }

          const enrichedLinkedOpme = (linkedOpmeData as LinkedOpme[]).map((link) => ({
            ...link,
            opmeDetails: inventory.find(
              (opme) => opme.codigo_barras === link.opme_barcode
            ),
          }));
          return { ...cps, linkedOpme: enrichedLinkedOpme };
        })
      );
      console.log("LinkedOpmeView - Dados vinculados carregados:", cpsRecordsWithLinkedOpme);
      setLocalCpsRecords(cpsRecordsWithLinkedOpme as (LocalCpsRecord & { linkedOpme: LinkedOpme[] })[]);
    } catch (error: any) {
      console.error("Erro ao carregar dados:", error);
      toast.error(`Falha ao carregar dados: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [userId, fetchOpmeInventory]);

  useEffect(() => {
    fetchLinkedData();
  }, [fetchLinkedData]);

  const filteredCpsRecords = localCpsRecords.filter(record =>
    record.cps_id.toString().includes(searchTerm) ||
    record.patient.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.professional?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.business_unit?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Carregando histórico de bipagem...</span>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <h1 className="text-4xl font-extrabold text-center text-foreground mb-8">Histórico de Bipagem de OPME</h1>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-2xl font-semibold">
            <History className="h-6 w-6 text-primary" /> OPMEs Bipados por Paciente (CPS)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Buscar por CPS, Nome do Paciente, Profissional ou Unidade..."
              className="pl-10 pr-4 py-2 text-base"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {filteredCpsRecords.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Nenhum registro de CPS com OPMEs bipados encontrado para o termo de busca.</p>
          ) : (
            <Accordion type="multiple" className="w-full space-y-4">
              {filteredCpsRecords.map((cpsRecord) => (
                <AccordionItem key={cpsRecord.id} value={cpsRecord.id} className="border rounded-lg shadow-sm bg-card">
                  <AccordionTrigger className="px-6 py-4 hover:bg-accent/50 transition-colors duration-200 rounded-t-lg">
                    <div className="flex flex-col sm:flex-row justify-between w-full pr-4 text-left">
                      <span className="font-semibold text-lg text-foreground">
                        CPS: {cpsRecord.cps_id} - Paciente: {cpsRecord.patient}
                      </span>
                      <span className="text-sm text-muted-foreground mt-1 sm:mt-0">
                        {new Date(cpsRecord.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-6 py-4 border-t bg-muted/20 rounded-b-lg">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 text-sm">
                      <div>
                        <strong className="text-foreground">Profissional:</strong> <span className="text-muted-foreground">{cpsRecord.professional || "N/A"}</span>
                      </div>
                      <div>
                        <strong className="text-foreground">Convênio:</strong> <span className="text-muted-foreground">{cpsRecord.agreement || "N/A"}</span>
                      </div>
                      <div className="col-span-full">
                        <strong className="text-foreground">Unidade de Negócio:</strong> <span className="text-muted-foreground">{cpsRecord.business_unit || "N/A"}</span>
                      </div>
                    </div>

                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <Scan className="h-5 w-5 text-blue-500" /> OPMEs Bipados:
                    </h3>
                    {cpsRecord.linkedOpme.length > 0 ? (
                      <div className="relative w-full overflow-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/50">
                              <TableHead>OPME</TableHead>
                              <TableHead>Lote</TableHead>
                              <TableHead>Validade</TableHead>
                              <TableHead>Referência</TableHead>
                              <TableHead>ANVISA</TableHead>
                              <TableHead>TUSS</TableHead>
                              <TableHead>Cód. Simpro</TableHead>
                              <TableHead>Cód. Barras</TableHead>
                              <TableHead className="text-right">Quantidade</TableHead>
                              <TableHead>Bipado Em</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {cpsRecord.linkedOpme.map((item: LinkedOpme) => (
                              <TableRow key={item.id}>
                                <TableCell className="font-medium">{item.opmeDetails?.opme || "N/A"}</TableCell>
                                <TableCell>{item.opmeDetails?.lote || "N/A"}</TableCell>
                                <TableCell>{item.opmeDetails?.validade || "N/A"}</TableCell>
                                <TableCell>{item.opmeDetails?.referencia || "N/A"}</TableCell>
                                <TableCell>{item.opmeDetails?.anvisa || "N/A"}</TableCell>
                                <TableCell>{item.opmeDetails?.tuss || "N/A"}</TableCell>
                                <TableCell>{item.opmeDetails?.cod_simpro || "N/A"}</TableCell>
                                <TableCell>{item.opme_barcode}</TableCell>
                                <TableCell className="text-right">{item.quantity}</TableCell>
                                <TableCell>{new Date(item.linked_at).toLocaleString()}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm text-center py-4">Nenhum OPME bipado para este CPS.</p>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LinkedOpmeView;