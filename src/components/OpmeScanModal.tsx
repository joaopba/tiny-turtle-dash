"use client";

import React, { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Scan, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

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
  // Outras propriedades do CpsRecord que você usa
}

interface OpmeScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCps: CpsRecord | null;
  opmeInventory: OpmeItem[];
  userId: string | undefined;
  onScanSuccess: () => void;
}

const OpmeScanModal: React.FC<OpmeScanModalProps> = ({
  isOpen,
  onClose,
  selectedCps,
  opmeInventory,
  userId,
  onScanSuccess,
}) => {
  const [barcodeInput, setBarcodeInput] = useState<string>("");
  const [loadingScan, setLoadingScan] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setBarcodeInput(""); // Limpa o input ao abrir o modal
      // Foca no input após um pequeno delay para garantir que o modal esteja totalmente aberto
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleBarcodeScan = async () => {
    if (!selectedCps) {
      toast.error("Por favor, selecione um paciente (CPS) primeiro.");
      return;
    }
    if (!barcodeInput) {
      toast.error("Por favor, insira um código de barras.");
      return;
    }
    if (!userId) {
      toast.error("Você precisa estar logado para bipar OPME.");
      return;
    }

    setLoadingScan(true);

    const opmeExists = opmeInventory.some(
      (item) => item.codigo_barras === barcodeInput
    );

    if (!opmeExists) {
      toast.error("Código de barras não encontrado no inventário OPME.");
      setLoadingScan(false);
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

      if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 é "no rows found"
        throw new Error(`Falha ao verificar OPME existente: ${fetchError.message}`);
      }

      if (existingLinkedItem) {
        const newQuantity = existingLinkedItem.quantity + 1;
        const { error: updateError } = await supabase
          .from("linked_opme")
          .update({ quantity: newQuantity })
          .eq("id", existingLinkedItem.id);

        if (updateError) {
          throw new Error(`Falha ao incrementar quantidade: ${updateError.message}`);
        }
        toast.success(`Quantidade do OPME ${barcodeInput} para o paciente ${selectedCps.PATIENT} incrementada para ${newQuantity}.`);
      } else {
        const newLinkedItem = {
          cps_id: selectedCps.CPS,
          opme_barcode: barcodeInput,
          user_id: userId,
          quantity: 1,
        };

        const { error: insertError } = await supabase
          .from("linked_opme")
          .insert(newLinkedItem);

        if (insertError) {
          throw new Error(`Falha ao bipar OPME: ${insertError.message}`);
        }
        toast.success(`OPME com código ${barcodeInput} bipado para o paciente ${selectedCps.PATIENT}.`);
      }

      setBarcodeInput(""); // Limpa o input após o sucesso
      onScanSuccess(); // Notifica o componente pai para atualizar a lista de itens bipados
      inputRef.current?.focus(); // Mantém o foco para continuar bipando
    } catch (error: any) {
      console.error("Erro ao bipar OPME:", error.message);
      toast.error(`Erro ao bipar OPME: ${error.message}`);
    } finally {
      setLoadingScan(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] p-6">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <Scan className="h-6 w-6 text-primary" /> Bipar OPME
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {selectedCps && (
            <p className="text-sm text-muted-foreground">
              Paciente selecionado: <span className="font-semibold text-foreground">{selectedCps.PATIENT}</span> (CPS: {selectedCps.CPS})
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="barcode" className="text-base">Código de Barras do OPME</Label>
            <Input
              id="barcode"
              ref={inputRef}
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  handleBarcodeScan();
                }
              }}
              className="text-lg p-2"
              disabled={loadingScan}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Digite ou escaneie o código de barras. Pressione Enter para bipar.
          </p>
        </div>
        <DialogFooter>
          <Button onClick={handleBarcodeScan} disabled={loadingScan} className="w-full">
            {loadingScan ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Bipar OPME
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OpmeScanModal;