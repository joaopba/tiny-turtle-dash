"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "./SessionContextProvider";
import { useSearchParams } from "react-router-dom";
import { ScrollArea } from "./ui/scroll-area";
import { format, subDays } from "date-fns";

interface CpsRecord { CPS: number; PATIENT: string; PROFESSIONAL: string; AGREEMENT: string; UNIDADENEGOCIO: string; CREATED_AT: string; }
interface CpsSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCpsSelected: (record: CpsRecord) => void;
}

const CpsSelectionModal: React.FC<CpsSelectionModalProps> = ({ isOpen, onClose, onCpsSelected }) => {
  const { user } = useSession();
  const [searchParams] = useSearchParams();
  const [cpsInput, setCpsInput] = useState<string>("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<CpsRecord[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSearch = useCallback(async (cpsToSearch: string) => {
    if (!cpsToSearch || !user?.id) {
      toast.error("Insira um CPS e certifique-se de estar logado.");
      return;
    }

    setIsSearching(true);
    setSearchResults([]);
    const parsedCpsId = parseInt(cpsToSearch, 10);
    if (isNaN(parsedCpsId)) {
      toast.error("Número de CPS inválido.");
      setIsSearching(false);
      return;
    }

    try {
      // 1. Tenta buscar no cache local (rápido)
      toast.info("Buscando em registros locais...");
      const { data: localData, error: localError } = await supabase
        .from('local_cps_records')
        .select('*')
        .eq('user_id', user.id)
        .eq('cps_id', parsedCpsId)
        .single();

      if (localData) {
        toast.success("Paciente encontrado nos registros locais!");
        const record: CpsRecord = {
          CPS: localData.cps_id,
          PATIENT: localData.patient,
          PROFESSIONAL: localData.professional,
          AGREEMENT: localData.agreement,
          UNIDADENEGOCIO: localData.business_unit,
          CREATED_AT: localData.created_at,
        };
        setSearchResults([record]);
        setIsSearching(false);
        return;
      }

      if (localError && localError.code !== 'PGRST116') throw localError;

      // 2. Se não encontrou, busca na API externa (lento)
      toast.info("Não encontrado localmente. Buscando no serviço externo...");
      const today = new Date();
      const thirtyDaysAgo = subDays(today, 30); // Alterado de 5 para 30 dias
      const { data: apiData, error: apiError } = await supabase.functions.invoke('fetch-cps-records', {
        body: {
          start_date: format(thirtyDaysAgo, "yyyy-MM-dd"),
          end_date: format(today, "yyyy-MM-dd"),
          business_unit: "47",
        },
      });

      if (apiError) throw apiError;

      if (apiData && Array.isArray(apiData)) {
        const result = apiData.find((record: CpsRecord) => record.CPS === parsedCpsId);
        if (result) {
          toast.success("Paciente encontrado no serviço externo e salvo localmente!");
          setSearchResults([result]);
          // 3. Salva no cache local para futuras buscas
          await supabase.from('local_cps_records').upsert({
            user_id: user.id,
            cps_id: result.CPS,
            patient: result.PATIENT,
            professional: result.PROFESSIONAL,
            agreement: result.AGREEMENT,
            business_unit: result.UNIDADENEGOCIO,
            created_at: result.CREATED_AT,
          }, { onConflict: 'cps_id, user_id' });
        } else {
          toast.warning("Paciente não encontrado para o período de 30 dias."); // Mensagem atualizada
        }
      } else {
        toast.error("Resposta inesperada do serviço externo.");
      }
    } catch (error: any) {
      console.error("Erro na busca de CPS:", error);
      toast.error(`Falha na busca: ${error.message}`);
    } finally {
      setIsSearching(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (isOpen) {
      const cpsIdFromUrl = searchParams.get('cps_id');
      const initialValue = cpsIdFromUrl || "";
      setCpsInput(initialValue);
      setSearchResults([]);
      if (initialValue) handleSearch(initialValue);
      const timer = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, searchParams, handleSearch]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Buscar e Selecionar Paciente (CPS)</DialogTitle>
          <DialogDescription>Digite o número do CPS para buscar. A busca será feita primeiro nos registros locais e depois no serviço externo.</DialogDescription>
        </DialogHeader>
        <div className="flex items-center space-x-2 pt-4">
          <Input
            ref={inputRef}
            placeholder="Digite o número do CPS..."
            value={cpsInput}
            onChange={(e) => setCpsInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch(cpsInput)}
            disabled={isSearching}
          />
          <Button onClick={() => handleSearch(cpsInput)} disabled={isSearching}>
            {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>
        <div className="mt-4 min-h-[200px]">
          {isSearching ? (
            <div className="flex items-center justify-center h-full"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : searchResults.length > 0 ? (
            <ScrollArea className="h-[200px] border rounded-md">
              <div className="p-2 space-y-2">
                {searchResults.map(record => (
                  <div key={record.CPS} className="flex justify-between items-center p-2 rounded-md hover:bg-accent">
                    <div>
                      <p className="font-semibold">{record.PATIENT}</p>
                      <p className="text-sm text-muted-foreground">CPS: {record.CPS}</p>
                    </div>
                    <Button size="sm" onClick={() => onCpsSelected(record)}>Selecionar</Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
              <AlertCircle className="h-8 w-8 mb-2" />
              <p>Nenhum resultado encontrado.</p>
              <p className="text-xs">Digite um número de CPS e clique em buscar.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CpsSelectionModal;