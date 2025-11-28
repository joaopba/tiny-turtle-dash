"use client";

import React, { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface CpsRecord { CPS: number; PATIENT: string; }
interface CpsSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCpsSelected: (record: CpsRecord) => void;
  loading: boolean;
}

const CpsSelectionModal: React.FC<CpsSelectionModalProps> = ({ isOpen, onClose, onCpsSelected, loading }) => {
  const [cpsInput, setCpsInput] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleCpsSubmit = async () => {
    if (!cpsInput) {
      toast.error("Por favor, insira um número de CPS.");
      return;
    }
    // A lógica de busca foi movida para a página principal
    // Aqui, apenas simulamos a seleção para o exemplo.
    // A implementação real deve ser feita na página OpmeScanner.
    // onCpsSelected({ CPS: parseInt(cpsInput), PATIENT: "Paciente Encontrado" });
    toast.info("A busca agora é feita na página principal.");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Buscar Paciente (CPS)</DialogTitle>
          <DialogDescription>
            Digite o número do CPS para buscar e selecionar um paciente.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="cps-number" className="text-right">
              CPS
            </Label>
            <Input
              id="cps-number"
              ref={inputRef}
              value={cpsInput}
              onChange={(e) => setCpsInput(e.target.value)}
              className="col-span-3"
              disabled={loading}
              onKeyPress={(e) => e.key === 'Enter' && handleCpsSubmit()}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleCpsSubmit} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
            Buscar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CpsSelectionModal;