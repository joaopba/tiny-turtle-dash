"use client";

import React, { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface CpsSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCpsSelected: (cpsId: string) => Promise<void>; // Callback para quando um CPS é selecionado
  loading: boolean;
}

const CpsSelectionModal: React.FC<CpsSelectionModalProps> = ({
  isOpen,
  onClose,
  onCpsSelected,
  loading,
}) => {
  const [cpsInput, setCpsInput] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setCpsInput("");
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleCpsSubmit = async () => {
    if (!cpsInput) {
      toast.error("Por favor, insira um número de CPS.");
      return;
    }
    await onCpsSelected(cpsInput);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px] p-6">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <Search className="h-6 w-6 text-primary" /> Selecionar Paciente (CPS)
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="cps-number" className="text-base">Número do CPS</Label>
            <Input
              id="cps-number"
              ref={inputRef}
              value={cpsInput}
              onChange={(e) => setCpsInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  handleCpsSubmit();
                }
              }}
              className="text-lg p-2"
              disabled={loading}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Digite o número do CPS para iniciar a bipagem.
          </p>
        </div>
        <DialogFooter>
          <Button onClick={handleCpsSubmit} disabled={loading} className="w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Selecionar CPS
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CpsSelectionModal;