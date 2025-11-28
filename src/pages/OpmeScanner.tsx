"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Scan, Search, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";
import { useSearchParams } from "react-router-dom";
import OpmeScanModal from "@/components/OpmeScanModal";
import CpsSelectionModal from "@/components/CpsSelectionModal";

interface CpsRecord { CPS: number; PATIENT: string; PROFESSIONAL: string; AGREEMENT: string; UNIDADENEGOCIO: string; CREATED_AT: string; }
interface OpmeItem { id: string; opme: string; lote: string; validade: string; referencia: string; anvisa: string; tuss: string; cod_simpro: string; codigo_barras: string; }
interface LinkedOpme { id: string; cps_id: number; opme_barcode: string; linked_at: string; quantity: number; opmeDetails?: OpmeItem; }
interface OpmeRestriction { id: string; opme_barcode: string; convenio_name: string; rule_type: 'BLOCK' | 'BILLING_ALERT' | 'EXCLUSIVE_ALLOW'; message: string | null; }

const OpmeScanner = () => {
  const { user } = useSession();
  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedCps, setSelectedCps] = useState<CpsRecord | null>(null);
  const [opmeInventory, setOpmeInventory] = useState<OpmeItem[]>([]);
  const [restrictions, setRestrictions] = useState<OpmeRestriction[]>([]);
  const [linkedOpme, setLinkedOpme] = useState<LinkedOpme[]>([]);
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [isCpsSelectionModalOpen, setIsCpsSelectionModalOpen] = useState(false);
  const [initialLoadHandled, setInitialLoadHandled] = useState(false);

  const fetchData = useCallback(async () => {
    // Fetch inventory and restrictions in parallel - REMOVED user.id filter to make it global
    const [inventoryRes, restrictionsRes] = await Promise.all([
      supabase.from("opme_inventory").select("*"),
      supabase.from("opme_restrictions").select("*")
    ]);
    
    if (inventoryRes.error) toast.error("Falha ao carregar inventário OPME.");
    else setOpmeInventory(inventoryRes.data as OpmeItem[]);

    if (restrictionsRes.error) toast.error("Falha ao carregar restrições de convênio.");
    else setRestrictions(restrictionsRes.data as OpmeRestriction[]);
  }, []);

  const fetchLinkedOpme = useCallback(async () => {
    if (!user?.id || !selectedCps) return;
    const { data, error } = await supabase
      .from("linked_opme")
      .select("*")
      .eq("user_id", user.id)
      .eq("cps_id", selectedCps.CPS)
      .order("linked_at", { ascending: false });

    if (error) {
      toast.error("Falha ao buscar OPMEs bipados.");
      return;
    }
    const enrichedData = data.map(link => ({
      ...link,
      opmeDetails: opmeInventory.find(opme => opme.codigo_barras === link.opme_barcode),
    }));
    setLinkedOpme(enrichedData);
  }, [user?.id, selectedCps, opmeInventory]);

  const handleCpsSelected = useCallback(async (record: CpsRecord) => {
    if (!user?.id) return;
    setSelectedCps(record);
    setIsCpsSelectionModalOpen(false);
    setIsScanModalOpen(true);
    setSearchParams(params => {
      params.delete('cps_id');
      return params;
    });
    await supabase.from('local_cps_records').upsert({
      user_id: user.id,
      cps_id: record.CPS,
      patient: record.PATIENT,
      professional: record.PROFESSIONAL,
      agreement: record.AGREEMENT,
      business_unit: record.UNIDADENEGOCIO,
      created_at: record.CREATED_AT,
    }, { onConflict: 'cps_id, user_id' });
  }, [user?.id, setSearchParams]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (user?.id && !initialLoadHandled) {
      const cpsIdFromUrl = searchParams.get('cps_id');
      if (cpsIdFromUrl) {
        setIsCpsSelectionModalOpen(true);
      }
      setInitialLoadHandled(true);
    }
  }, [user?.id, searchParams, initialLoadHandled]);

  useEffect(() => {
    if (selectedCps) {
      fetchLinkedOpme();
    }
  }, [selectedCps, fetchLinkedOpme]);

  const handleChangeCps = () => {
    setIsScanModalOpen(false);
    setSelectedCps(null);
    setIsCpsSelectionModalOpen(true);
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-2xl font-semibold">
            <UserCheck className="h-6 w-6 text-primary" />
            Paciente Selecionado
          </CardTitle>
        </CardHeader>
        <CardContent>
          {selectedCps ? (
            <div className="space-y-4">
              <p><strong>CPS:</strong> {selectedCps.CPS}</p>
              <p><strong>Paciente:</strong> {selectedCps.PATIENT}</p>
              <p><strong>Convênio:</strong> {selectedCps.AGREEMENT}</p>
              <div className="flex gap-4 pt-2">
                <Button onClick={() => setIsScanModalOpen(true)}><Scan className="mr-2 h-4 w-4" /> Bipar OPME</Button>
                <Button variant="outline" onClick={handleChangeCps}><Search className="mr-2 h-4 w-4" /> Trocar Paciente</Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-muted-foreground mb-4">Nenhum paciente selecionado.</p>
              <Button onClick={() => setIsCpsSelectionModalOpen(true)}><Search className="mr-2 h-4 w-4" /> Buscar Paciente (CPS)</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedCps && (
        <Card className="shadow-lg">
          <CardHeader><CardTitle>OPMEs Bipados para {selectedCps.PATIENT}</CardTitle></CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px] w-full rounded-md border">
              <Table>
                <TableHeader><TableRow><TableHead>OPME</TableHead><TableHead>Cód. Barras</TableHead><TableHead className="text-right">Quantidade</TableHead><TableHead>Bipado Em</TableHead></TableRow></TableHeader>
                <TableBody>
                  {linkedOpme.length > 0 ? linkedOpme.map(item => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.opmeDetails?.opme || "N/A"}</TableCell>
                      <TableCell>{item.opme_barcode}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell>{new Date(item.linked_at).toLocaleString()}</TableCell>
                    </TableRow>
                  )) : <TableRow><TableCell colSpan={4} className="text-center">Nenhum OPME bipado para este paciente ainda.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      <CpsSelectionModal isOpen={isCpsSelectionModalOpen} onClose={() => setIsCpsSelectionModalOpen(false)} onCpsSelected={handleCpsSelected} />
      {selectedCps && <OpmeScanModal key={selectedCps.CPS} isOpen={isScanModalOpen} onClose={() => setIsScanModalOpen(false)} selectedCps={selectedCps} opmeInventory={opmeInventory} restrictions={restrictions} userId={user?.id} onScanSuccess={fetchLinkedOpme} onChangeCps={handleChangeCps} />}
    </div>
  );
};

export default OpmeScanner;