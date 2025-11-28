"use client";

import React, { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Scan, Loader2, XCircle, Users, ShieldAlert, Info, Shuffle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";

interface OpmeItem { id: string; opme: string; codigo_barras: string; }
interface CpsRecord { CPS: number; PATIENT: string; AGREEMENT: string; }
interface OpmeRestriction { opme_barcode: string; convenio_name: string; rule_type: 'BLOCK' | 'BILLING_ALERT' | 'EXCLUSIVE_ALLOW' | 'SUGGEST_REPLACEMENT'; message: string | null; replacement_opme_barcode?: string | null; }
interface LinkedOpmeSessionItem { opme_barcode: string; quantity: number; opmeDetails?: OpmeItem; }

interface OpmeScanModalProps {
  isOpen: boolean; onClose: () => void; selectedCps: CpsRecord | null; opmeInventory: OpmeItem[];
  restrictions: OpmeRestriction[]; userId: string | undefined; onScanSuccess: () => void; onChangeCps: () => void;
}

const OpmeScanModal: React.FC<OpmeScanModalProps> = ({
  isOpen, onClose, selectedCps, opmeInventory, restrictions, userId, onScanSuccess, onChangeCps,
}) => {
  const [barcodeInput, setBarcodeInput] = useState<string>("");
  const [loadingScan, setLoadingScan] = useState(false);
  const [currentSessionScans, setCurrentSessionScans] = useState<LinkedOpmeSessionItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setBarcodeInput("");
      setCurrentSessionScans([]);
      const timer = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const linkOpme = async (barcodeToLink: string, opmeDetails: OpmeItem) => {
    if (!selectedCps || !userId) return;
    try {
      const { data: existingLink, error: selectError } = await supabase.from('linked_opme').select('id, quantity').eq('user_id', userId).eq('cps_id', selectedCps.CPS).eq('opme_barcode', barcodeToLink).single();
      if (selectError && selectError.code !== 'PGRST116') throw selectError;

      if (existingLink) {
        const { error: updateError } = await supabase.from('linked_opme').update({ quantity: existingLink.quantity + 1 }).eq('id', existingLink.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from('linked_opme').insert({ user_id: userId, cps_id: selectedCps.CPS, opme_barcode: barcodeToLink, quantity: 1 });
        if (insertError) throw insertError;
      }
      
      setCurrentSessionScans(prev => {
        const existing = prev.find(s => s.opme_barcode === barcodeToLink);
        if (existing) return prev.map(s => s.opme_barcode === barcodeToLink ? { ...s, quantity: s.quantity + 1 } : s);
        return [...prev, { opme_barcode: barcodeToLink, quantity: 1, opmeDetails }];
      });
      onScanSuccess();
    } catch (error: any) {
      toast.error(`Erro ao bipar OPME: ${error.message}`);
    }
  };

  const handleBarcodeScan = async () => {
    if (!selectedCps || !barcodeInput || !userId) {
      toast.error("CPS, código de barras e login são necessários.");
      return;
    }
    setLoadingScan(true);

    const opmeDetails = opmeInventory.find(item => item.codigo_barras === barcodeInput);
    if (!opmeDetails) {
      toast.error("Código de barras não encontrado no seu inventário OPME.", { duration: 5000 });
      setLoadingScan(false);
      setBarcodeInput("");
      inputRef.current?.focus();
      return;
    }

    const patientConvenio = selectedCps.AGREEMENT?.trim().toLowerCase() || '';
    
    // 1. VERIFICAÇÃO DE REGRAS
    const blockRule = restrictions.find(r => r.rule_type === 'BLOCK' && r.opme_barcode === barcodeInput && r.convenio_name.toLowerCase() === patientConvenio);
    if (blockRule) {
      toast.error("OPME Bloqueado", { description: `Este item não é permitido para o convênio "${selectedCps.AGREEMENT}".`, icon: <ShieldAlert className="h-5 w-5 text-destructive" />, duration: 5000 });
      setLoadingScan(false); setBarcodeInput(""); inputRef.current?.focus();
      return; // CORREÇÃO CRÍTICA: Impede a execução de continuar.
    }

    const exclusiveRulesForConvenio = restrictions.filter(r => r.rule_type === 'EXCLUSIVE_ALLOW' && r.convenio_name.toLowerCase() === patientConvenio);
    if (exclusiveRulesForConvenio.length > 0) {
      const isAllowed = exclusiveRulesForConvenio.some(r => r.opme_barcode === barcodeInput);
      if (!isAllowed) {
        toast.error("Permissão Negada", { description: `Apenas OPMEs específicos são permitidos para o convênio "${selectedCps.AGREEMENT}".`, icon: <ShieldAlert className="h-5 w-5 text-destructive" />, duration: 5000 });
        setLoadingScan(false); setBarcodeInput(""); inputRef.current?.focus();
        return;
      }
    }

    const suggestionRule = restrictions.find(r => r.rule_type === 'SUGGEST_REPLACEMENT' && r.opme_barcode === barcodeInput && r.convenio_name.toLowerCase() === patientConvenio);
    if (suggestionRule && suggestionRule.replacement_opme_barcode) {
      const replacementOpmeDetails = opmeInventory.find(item => item.codigo_barras === suggestionRule.replacement_opme_barcode);
      if (replacementOpmeDetails) {
        toast.info("Substituição Sugerida", {
          description: `Para este convênio, sugere-se usar "${replacementOpmeDetails.opme}" no lugar de "${opmeDetails.opme}".`,
          icon: <Shuffle className="h-5 w-5 text-yellow-500" />,
          duration: 10000,
          action: {
            label: "Substituir",
            onClick: () => {
              toast.success(`"${replacementOpmeDetails.opme}" bipado com sucesso!`);
              linkOpme(replacementOpmeDetails.codigo_barras, replacementOpmeDetails);
            },
          },
        });
        setLoadingScan(false); setBarcodeInput(""); inputRef.current?.focus();
        return;
      }
    }

    const alertRule = restrictions.find(r => r.rule_type === 'BILLING_ALERT' && r.opme_barcode === barcodeInput && r.convenio_name.toLowerCase() === patientConvenio);
    if (alertRule && alertRule.message) {
      toast.info("Alerta de Faturamento", { description: alertRule.message, icon: <Info className="h-5 w-5 text-blue-500" />, duration: 5000 });
    }

    // 2. LÓGICA DE BIPAGEM (se nenhuma regra interrompeu)
    await linkOpme(barcodeInput, opmeDetails);
    setLoadingScan(false); setBarcodeInput(""); inputRef.current?.focus();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bipagem de OPME para: {selectedCps?.PATIENT}</DialogTitle>
        </DialogHeader>
        <div className="grid md:grid-cols-2 gap-6 pt-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="barcode-input">Bipar Código de Barras</Label>
              <div className="flex items-center space-x-2">
                <Input ref={inputRef} id="barcode-input" placeholder="Aguardando bipagem..." value={barcodeInput} onChange={(e) => setBarcodeInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleBarcodeScan()} disabled={loadingScan} />
                <Button onClick={handleBarcodeScan} disabled={loadingScan}>{loadingScan ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scan className="h-4 w-4" />}</Button>
              </div>
            </div>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-lg">Informações do Paciente</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-1">
                <p><strong>CPS:</strong> {selectedCps?.CPS}</p>
                <p><strong>Convênio:</strong> {selectedCps?.AGREEMENT}</p>
              </CardContent>
            </Card>
          </div>
          <div className="space-y-2">
            <Label>Bipados Nesta Sessão</Label>
            <ScrollArea className="h-48 w-full rounded-md border p-2">
              {currentSessionScans.length > 0 ? currentSessionScans.map(item => (
                <div key={item.opme_barcode} className="flex justify-between items-center p-2 rounded hover:bg-muted">
                  <span className="text-sm font-medium">{item.opmeDetails?.opme || item.opme_barcode}</span>
                  <span className="text-sm font-bold bg-primary text-primary-foreground rounded-full px-2 py-0.5">{item.quantity}x</span>
                </div>
              )) : <p className="text-sm text-muted-foreground text-center pt-4">Nenhum item bipado ainda.</p>}
            </ScrollArea>
          </div>
        </div>
        <DialogFooter className="pt-4">
          <Button variant="outline" onClick={onChangeCps}><Users className="mr-2 h-4 w-4" /> Trocar Paciente</Button>
          <Button onClick={onClose}><XCircle className="mr-2 h-4 w-4" /> Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OpmeScanModal;