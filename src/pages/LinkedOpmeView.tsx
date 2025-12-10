"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";
import { toast } from "sonner";
import { History, Search, Loader2, Scan, Trash2 } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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
  user_id: string;
  cps_id: number;
  opme_barcode: string;
  linked_at: string;
  quantity: number;
  opmeDetails?: OpmeItem;
}

const LinkedOpmeView = () => {
  const { user, profile } = useSession();
  const [localCpsRecords, setLocalCpsRecords] = useState<(LocalCpsRecord & { linkedOpme: LinkedOpme[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState<string>("");

  const fetchLinkedData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: inventory, error: inventoryError } = await supabase.from("opme_inventory").select("*");
      if (inventoryError) throw inventoryError;

      const { data: distinctCpsData, error: distinctCpsError } = await supabase.from('linked_opme').select('cps_id');
      if (distinctCpsError) throw distinctCpsError;

      const distinctCpsIds = [...new Set(distinctCpsData.map(item => item.cps_id))];
      if (distinctCpsIds.length === 0) {
        setLocalCpsRecords([]);
        setLoading(false);
        return;
      }

      const { data: cpsData, error: cpsError } = await supabase.from("local_cps_records").select("*").in('cps_id', distinctCpsIds).order("created_at", { ascending: false });
      if (cpsError) throw cpsError;

      const { data: allLinkedOpme, error: allLinkedOpmeError } = await supabase.from('linked_opme').select('*').in('cps_id', distinctCpsIds).order("linked_at", { ascending: false });
      if (allLinkedOpmeError) throw allLinkedOpmeError;

      const cpsRecordsWithLinkedOpme = (cpsData as LocalCpsRecord[]).map(cps => {
        const linkedOpmeForCps = allLinkedOpme.filter(link => link.cps_id === cps.cps_id);
        const enrichedLinkedOpme = linkedOpmeForCps.map(link => ({
          ...link,
          opmeDetails: (inventory as OpmeItem[]).find(opme => opme.codigo_barras === link.opme_barcode),
        }));
        return { ...cps, linkedOpme: enrichedLinkedOpme };
      });

      setLocalCpsRecords(cpsRecordsWithLinkedOpme as (LocalCpsRecord & { linkedOpme: LinkedOpme[] })[]);
    } catch (error: any) {
      console.error("Erro ao carregar dados:", error);
      toast.error(`Falha ao carregar dados: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLinkedData();
  }, [fetchLinkedData]);

  const handleDeleteLinkedOpme = async (linkedOpmeId: string) => {
    const { error } = await supabase.from('linked_opme').delete().eq('id', linkedOpmeId);
    if (error) {
      toast.error(`Falha ao excluir bipagem: ${error.message}`);
    } else {
      toast.success("Bipagem excluída com sucesso.");
      fetchLinkedData(); // Recarrega os dados para refletir a exclusão
    }
  };

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
          <CardTitle className="flex items-center gap-3 text-2xl font-semibold"><History className="h-6 w-6 text-primary" /> OPMEs Bipados por Paciente (CPS)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input placeholder="Buscar por CPS, Nome do Paciente, Profissional ou Unidade..." className="pl-10 pr-4 py-2 text-base" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          {filteredCpsRecords.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Nenhum registro de CPS com OPMEs bipados encontrado.</p>
          ) : (
            <Accordion type="multiple" className="w-full space-y-4">
              {filteredCpsRecords.map((cpsRecord) => (
                <AccordionItem key={cpsRecord.id} value={cpsRecord.id} className="border rounded-lg shadow-sm bg-card">
                  <AccordionTrigger className="px-6 py-4 hover:bg-accent/50 transition-colors duration-200 rounded-t-lg">
                    <div className="flex flex-col sm:flex-row justify-between w-full pr-4 text-left">
                      <span className="font-semibold text-lg text-foreground">CPS: {cpsRecord.cps_id} - Paciente: {cpsRecord.patient}</span>
                      <span className="text-sm text-muted-foreground mt-1 sm:mt-0">{new Date(cpsRecord.created_at).toLocaleDateString()}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-6 py-4 border-t bg-muted/20 rounded-b-lg">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 text-sm">
                      <div><strong className="text-foreground">Profissional:</strong> <span className="text-muted-foreground">{cpsRecord.professional || "N/A"}</span></div>
                      <div><strong className="text-foreground">Convênio:</strong> <span className="text-muted-foreground">{cpsRecord.agreement || "N/A"}</span></div>
                      <div className="col-span-full"><strong className="text-foreground">Unidade de Negócio:</strong> <span className="text-muted-foreground">{cpsRecord.business_unit || "N/A"}</span></div>
                    </div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2"><Scan className="h-5 w-5 text-blue-500" /> OPMEs Bipados:</h3>
                    {cpsRecord.linkedOpme.length > 0 ? (
                      <div className="relative w-full overflow-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/50">
                              <TableHead>OPME</TableHead><TableHead>Cód. Barras</TableHead><TableHead>Bipado Em</TableHead><TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {cpsRecord.linkedOpme.map((item: LinkedOpme) => {
                              const isGestor = profile?.role === 'GESTOR';
                              const isOwner = item.user_id === user?.id;
                              const linkedAtDate = new Date(item.linked_at);
                              const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
                              const isWithinOneHour = linkedAtDate > oneHourAgo;
                              const canDelete = isGestor || (isOwner && isWithinOneHour);

                              return (
                                <TableRow key={item.id}>
                                  <TableCell className="font-medium">{item.opmeDetails?.opme || "N/A"}</TableCell>
                                  <TableCell>{item.opme_barcode}</TableCell>
                                  <TableCell>{new Date(item.linked_at).toLocaleString('pt-BR')}</TableCell>
                                  <TableCell className="text-right">
                                    {canDelete && (
                                      <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                          <AlertDialogHeader>
                                            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                                            <AlertDialogDescription>
                                              Tem certeza de que deseja excluir esta bipagem? Esta ação não pode ser desfeita.
                                            </AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter>
                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleDeleteLinkedOpme(item.id)} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
                                          </AlertDialogFooter>
                                        </AlertDialogContent>
                                      </AlertDialog>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
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