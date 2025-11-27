"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";
import { toast } from "sonner";
import { History, Search } from "lucide-react";
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
  quantity: number; // Adicionado campo de quantidade
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
    if (!userId) return [];
    const { data, error } = await supabase
      .from("opme_inventory")
      .select("*")
      .eq("user_id", userId);

    if (error) {
      console.error("Erro ao buscar inventário OPME:", error);
      toast.error("Falha ao carregar inventário OPME.");
      return [];
    }
    return data as OpmeItem[];
  }, [userId]);

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
            .select("*") // Seleciona todas as colunas, incluindo 'quantity'
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
    record.patient.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Carregando histórico de bipagem...</div>;
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      <h1 className="text-3xl font-bold text-center mb-6">Histórico de Bipagem de OPME</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" /> OPMEs Bipados por Paciente (CPS)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por CPS ou Nome do Paciente..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {filteredCpsRecords.length === 0 ? (
            <p className="text-muted-foreground">Nenhum registro de CPS com OPMEs bipados encontrado para o termo de busca.</p>
          ) : (
            <Accordion type="multiple" className="w-full">
              {filteredCpsRecords.map((cpsRecord) => (
                <AccordionItem key={cpsRecord.id} value={cpsRecord.id}>
                  <AccordionTrigger>
                    <div className="flex justify-between w-full pr-4">
                      <span>
                        CPS: {cpsRecord.cps_id} - Paciente: {cpsRecord.patient}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {new Date(cpsRecord.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="p-4 border rounded-md bg-muted/20">
                      <p className="text-sm mb-2">
                        <strong>Profissional:</strong> {cpsRecord.professional || "N/A"}
                      </p>
                      <p className="text-sm mb-2">
                        <strong>Convênio:</strong> {cpsRecord.agreement || "N/A"}
                      </p>
                      <p className="text-sm mb-4">
                        <strong>Unidade de Negócio:</strong> {cpsRecord.business_unit || "N/A"}
                      </p>

                      <h3 className="text-md font-semibold mb-2">OPMEs Bipados:</h3>
                      {cpsRecord.linkedOpme.length > 0 ? (
                        <ScrollArea className="h-[150px] w-full rounded-md border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>OPME</TableHead>
                                <TableHead>Lote</TableHead>
                                <TableHead>Validade</TableHead>
                                <TableHead>Cód. Barras</TableHead>
                                <TableHead>Quantidade</TableHead> {/* Nova coluna */}
                                <TableHead>Bipado Em</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {cpsRecord.linkedOpme.map((item: LinkedOpme) => (
                                <TableRow key={item.id}>
                                  <TableCell>{item.opmeDetails?.opme || "N/A"}</TableCell>
                                  <TableCell>{item.opmeDetails?.lote || "N/A"}</TableCell>
                                  <TableCell>{item.opmeDetails?.validade || "N/A"}</TableCell>
                                  <TableCell>{item.opme_barcode}</TableCell>
                                  <TableCell>{item.quantity}</TableCell> {/* Exibir quantidade */}
                                  <TableCell>{new Date(item.linked_at).toLocaleString()}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </ScrollArea>
                      ) : (
                        <p className="text-muted-foreground text-sm">Nenhum OPME bipado para este CPS.</p>
                      )}
                    </div>
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