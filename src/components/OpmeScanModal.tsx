"use client";

import React, { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Scan, Loader2, XCircle, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";

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

interface CpsRecord {
  CPS: number;
  PATIENT: string;
}

interface LinkedOpmeSessionItem {
  opme_barcode: string;
  quantity: number;
  opmeDetails?: OpmeItem;
}

interface OpmeScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCps: CpsRecord | null;
  opmeInventory: OpmeItem[];
  userId: string | undefined;
  onScanSuccess: () => void;
  onChangeCps: () => void;
}

const OpmeScanModal: React.FC<OpmeScanModalProps> = ({
  isOpen,
  onClose,
  selectedCps,
  opmeInventory,
  userId,
  onScanSuccess,
  onChangeCps,
}) => {
  const [barcodeInput, setBarcodeInput] = useState<string>("");
  const [loadingScan, setLoadingScan] = useState(false);
  const [currentSessionScans, setCurrentSessionScans] = useState<LinkedOpmeSessionItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setBarcodeInput("");
      setCurrentSessionScans([]); // Limpa as bipagens da sessão anterior
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleBarcodeScan = async () => {
    if (!selectedCps || !barcodeInput || !userId) {
      toast.error("CPS, código de barras e login são necessários.");
      return;
    }

    setLoadingScan(true);

    const opmeDetails = opmeInventory.find(
      (item) => item.codigo_barras === barcodeInput
    );

    if (!opmeDetails) {
      toast.error("Código de barras não encontrado no seu inventário OPME.");
      setLoadingScan(false);
      setBarcodeInput("");
      inputRef.current?.focus();
      return;
    }

    try {
      const { data: existingLinkedItem, error: fetchError } = await supabase
        .from("linked_opme")
        .select("id, quantity")
        .eq("user_id", userId)
        .eq("cps_id", selectedCps.CPS)
        .eq("opme_barcode", barcodeInput)
        .single();

      let newQuantity = 1;
      if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = no rows found, which is fine for new items
        throw new Error(`Falha ao verificar OPME existente: ${fetchError.message}`);
      }

      if (existingLinkedItem) {
        newQuantity = existingLinkedItem.quantity + 1;
        const { error: updateError } = await supabase
          .from("linked_opme")
          .update({ quantity: newQuantity })
          .eq("id", existingLinkedItem.id);

        if (updateError) throw new Error(`Falha ao incrementar quantidade: ${updateError.message}`);
        toast.success(`Quantidade de "${opmeDetails.opme}" atualizada para ${newQuantity}.`);
      } else {
        const { error: insertError } = await supabase
          .from("linked_opme")
          .insert({ cps_id: selectedCps.CPS, opme_barcode: barcodeInput, user_id: userId, quantity: 1 });

        if (insertError) throw new Error(`Falha ao bipar OPME: ${insertError.message}`);
        toast.success(`"${opmeDetails.opme}" bipado com sucesso.`);
      }

      // ATUALIZAÇÃO INSTANTÂNEA DA UI LOCAL
      setCurrentSessionScans(prevScans => {
        const existingScanIndex = prevScans.findIndex(item => item.opme_barcode === barcodeInput);
        if (existingScanIndex > -1) {
          const updatedScans = [...prevScans];
          updatedScans[existingScanIndex].quantity = newQuantity;
          return updatedScans;
        } else {
          return [...prevScans, { opme_barcode: barcodeInput, quantity: newQuantity, opmeDetails }];
        }
      });

      onScanSuccess(); // Atualiza a lista de fundo na página principal
    } catch (error: any) {
      console.error("Erro ao bipar OPME:", error.message);
      toast.error(`Erro ao bipar OPME: ${error.message}`);
    } finally {
      // FLUXO CONTÍNUO: LIMPA E FOCA PARA A PRÓXIMA BIPAGEM
      setBarcodeInput("");
      inputRef.current?.focus();
      setLoadingScan(false);
    }
  };

  const handleClearSessionScans = () => {
    setCurrentSessionScans([]);
    toast.info("Bipagens da sessão atual limpas.");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] p-6">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <Scan className="h-6 w-6 text-primary" /> Bipar OPME
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {selectedCps && (
            <p className="text-sm text-muted-foreground">
              Paciente: <span className="font-semibold text-foreground">{selectedCps.PATIENT}</span> (CPS: {selectedCps.CPS})
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="barcode" className="text-base">Código de Barras</Label>
            <Input
              id="barcode"
              ref={inputRef}
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              onKeyPress={(e) => { if (e.key === "Enter") handleBarcodeScan(); }}
              className="text-lg p-2"
              disabled={loadingScan}
              placeholder="Aguardando bipagem..."
            />
          </div>
          <Button onClick={handleBarcodeScan} disabled={loadingScan} className="w-full">
            {loadingScan ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Bipar Manualmente
          </Button>

          {currentSessionScans.length > 0 && (
            <div className="mt-6 border-t pt-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-semibold">Bipagens nesta sessão</h3>
                <Button variant="ghost" size="sm" onClick={handleClearSessionScans} className="text-red-500 hover:text-red-600">
                  <XCircle className="h-4 w-4 mr-1" /> Limpar
                </Button>
              </div>
              <ScrollArea className="h-[150px] w-full rounded-md border p-2">
                <ul className="space-y-2">
                  {currentSessionScans.map((item) => (
                    <li key={item.opme_barcode} className="flex justify-between items-center text-sm bg-muted/30 p-2 rounded-md">
                      <span className="font-medium truncate pr-2">{item.opmeDetails?.opme || item.opme_barcode}</span>
                      <span className="text-muted-foreground font-bold">Qtd: {item.quantity}</span>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </div>
          )}
        </div>
        <DialogFooter className="flex sm:justify-between items-center mt-4">
          <Button variant="outline" onClick={onChangeCps} className="flex items-center gap-2">
            <Users className="h-4 w-4" /> Mudar Paciente
          </Button>
          <Button onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OpmeScanModal;