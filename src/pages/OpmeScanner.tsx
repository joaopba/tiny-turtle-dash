"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon, Scan, Search, Loader2, ListFilter } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";
import { useSearchParams } from "react-router-dom";
import OpmeScanModal from "@/components/OpmeScanModal";
import CpsSelectionModal from "@/components/CpsSelectionModal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

// Interfaces... (mantidas como antes)
interface CpsRecord { CREATED_AT: string; TIPO: string; SITUACAO: string; ATENDANT: string; CPS: number; PATIENT: string; TREATMENT: string | null; UNIDADENEGOCIO: string; REGISTRATION: string | null; PROFESSIONAL: string; AGREEMENT: string; A_CID: string; DATA_ALTA: string | null; DATAENTREGA: string | null; DATARAT: string | null; DATA_FECHADO: string; DATA_RECEBIMENTO: string | null; }
interface OpmeItem { id: string; opme: string; lote: string; validade: string; referencia: string; anvisa: string; tuss: string; cod_simpro: string; codigo_barras: string; }
interface LinkedOpme { id: string; cps_id: number; opme_barcode: string; linked_at: string; quantity: number; opmeDetails?: OpmeItem; }

const OpmeScanner = () => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const [searchParams, setSearchParams] = useSearchParams();

  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [businessUnit, setBusinessUnit] = useState<string>("47");
  const [cpsRecords, setCpsRecords] = useState<CpsRecord[]>([]);
  const [loadingCps, setLoadingCps] = useState(false);
  const [selectedCps, setSelectedCps] = useState<CpsRecord | null>(null);
  const [opmeInventory, setOpmeInventory] = useState<OpmeItem[]>([]);
  const [linkedOpme, setLinkedOpme] = useState<LinkedOpme[]>([]);
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [isCpsSelectionModalOpen, setIsCpsSelectionModalOpen] = useState(false);

  const fetchOpmeInventory = useCallback(async () => { /* ...código mantido... */ }, [userId]);
  const fetchLinkedOpme = useCallback(async () => { /* ...código mantido... */ }, [userId, selectedCps, opmeInventory]);

  const saveCpsLocally = useCallback(async (record: CpsRecord) => {
    if (!userId) return;
    const { error } = await supabase
      .from('local_cps_records')
      .upsert({ /* ...código mantido... */ }, { onConflict: 'cps_id, user_id' });
    if (error) toast.error("Falha ao salvar detalhes do CPS localmente.");
  }, [userId]);

  const handleSelectCps = (record: CpsRecord) => {
    setSelectedCps(record);
    setIsCpsSelectionModalOpen(false);
  };

  const handleCpsSearch = useCallback(async (cpsIdToSearch: string) => { /* ...código mantido, mas chama handleSelectCps no final... */ }, [userId, businessUnit, handleSelectCps]);
  const fetchCpsRecords = useCallback(async (forceApiFetch = false) => { /* ...código mantido... */ }, [startDate, endDate, businessUnit, userId]);

  useEffect(() => { fetchOpmeInventory(); }, [fetchOpmeInventory]);
  useEffect(() => { fetchLinkedOpme(); }, [selectedCps, fetchLinkedOpme]);

  useEffect(() => {
    const cpsIdFromUrl = searchParams.get('cps_id');
    if (cpsIdFromUrl) {
      handleCpsSearch(cpsIdFromUrl);
      setSearchParams({});
    } else if (!selectedCps) {
      setIsCpsSelectionModalOpen(true);
    }
  }, [userId, searchParams, handleCpsSearch, setSearchParams, selectedCps]);

  useEffect(() => {
    if (selectedCps) {
      saveCpsLocally(selectedCps);
      setIsScanModalOpen(true);
    }
  }, [selectedCps, saveCpsLocally]);

  const handleChangeCps = () => {
    setIsScanModalOpen(false);
    setSelectedCps(null);
    setIsCpsSelectionModalOpen(true);
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Bipagem de OPME</h1>
          <p className="text-muted-foreground">Selecione um paciente para iniciar a bipagem dos materiais.</p>
        </div>
        <Button onClick={() => setIsCpsSelectionModalOpen(true)}>
          <Search className="mr-2 h-4 w-4" />
          Buscar Paciente (CPS)
        </Button>
      </div>

      {selectedCps ? (
        <Card className="shadow-lg animate-in fade-in-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-2xl font-semibold">
              <Scan className="h-6 w-6 text-primary" />
              Paciente Selecionado
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 border rounded-lg bg-muted/50">
              <p className="text-lg font-semibold text-foreground">{selectedCps.PATIENT}</p>
              <p className="text-sm text-muted-foreground">CPS: {selectedCps.CPS}</p>
            </div>
            <Button onClick={() => setIsScanModalOpen(true)} className="w-full text-lg py-6">
              <Scan className="h-5 w-5 mr-2" /> Abrir Bipagem de OPME
            </Button>
            <div className="mt-6">
              <h3 className="text-xl font-semibold mb-4">Itens já Bipados ({linkedOpme.length})</h3>
              {linkedOpme.length > 0 ? (
                <ScrollArea className="h-[250px] w-full rounded-md border">
                  <Table>
                    <TableHeader><TableRow><TableHead>OPME</TableHead><TableHead>Cód. Barras</TableHead><TableHead className="text-right">Qtd</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {linkedOpme.map((item) => (
                        <TableRow key={item.id}><TableCell className="font-medium">{item.opmeDetails?.opme || "N/A"}</TableCell><TableCell>{item.opme_barcode}</TableCell><TableCell className="text-right">{item.quantity}</TableCell></TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              ) : (
                <p className="text-muted-foreground text-sm text-center py-4">Nenhum OPME bipado para este paciente ainda.</p>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-lg text-center py-12">
          <CardContent>
            <Scan size={48} className="mx-auto text-muted-foreground" />
            <h3 className="mt-4 text-xl font-semibold">Nenhum Paciente Selecionado</h3>
            <p className="mt-2 text-muted-foreground">Use o botão "Buscar Paciente" para encontrar e selecionar um CPS.</p>
          </CardContent>
        </Card>
      )}

      <CpsSelectionModal isOpen={isCpsSelectionModalOpen} onClose={() => setIsCpsSelectionModalOpen(false)} onCpsSelected={handleSelectCps} loading={loadingCps} />
      {selectedCps && <OpmeScanModal key={selectedCps.CPS} isOpen={isScanModalOpen} onClose={() => setIsScanModalOpen(false)} selectedCps={selectedCps} opmeInventory={opmeInventory} userId={userId} onScanSuccess={fetchLinkedOpme} onChangeCps={handleChangeCps} />}
    </div>
  );
};

export default OpmeScanner;