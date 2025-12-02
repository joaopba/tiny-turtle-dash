"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Loader2, AlertCircle, RefreshCw } from "lucide-react";
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
  const [isSyncing, setIsSyncing] = useState(false);
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
      const { data, error } = await supabase
        .from('local_cps_records')
        .select('*')
        .eq('cps_id', parsedCpsId);

      if (error) throw error;

      if (data && data.length > 0) {
        toast.success(`${data.length} paciente(s) encontrado(s)!`);
        const records: CpsRecord[] = data.map(d => ({
          CPS: d.cps_id,
          PATIENT: d.patient,
          PROFESSIONAL: d.professional,
          AGREEMENT: d.agreement,
          UNIDADENEGOCIO: d.business_unit,
          CREATED_AT: d.created_at
        }));
        setSearchResults(records);
      } else {
        toast.warning("Paciente não encontrado nos registros sincronizados.");
      }
    } catch (error: any) {
      console.error("Erro na busca de CPS:", error);
      toast.error(`Falha na busca: ${error.message}`);
    } finally {
      setIsSearching(false);
    }
  }, [user?.id]);

  const handleSync = async () => {
    setIsSyncing(true);
    const syncToast = toast.loading("Sincronizando registros dos últimos 3 dias...");

    try {
      const endDate = new Date();
      const startDate = subDays(endDate, 3);

      const { error } = await supabase.functions.invoke('sync-cps-records', {
        body: {
          start_date: format(startDate, 'yyyy-MM-dd'),
          end_date: format(endDate, 'yyyy-MM-dd'),
        },
      });

      if (error) throw error;

      toast.success("Sincronização concluída! Tente buscar o paciente novamente.", {
        id: syncToast,
      });

      if (cpsInput) {
        handleSearch(cpsInput);
      }

    } catch (error: any) {
      console.error("Erro na sincronização manual:", error);
      toast.error(`Falha na sincronização: ${error.message}`, {
        id: syncToast,
      });
    } finally {
      setIsSyncing(false);
    }
  };

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
          <DialogDescription>Digite o número do CPS para buscar ou sincronize os registros mais recentes.</DialogDescription>
        </DialogHeader>
        <div className="flex items-center space-x-2 pt-4">
          <Input ref={inputRef} placeholder="Digite o número do CPS..." value={cpsInput} onChange={(e) => setCpsInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSearch(cpsInput)} disabled={isSearching || isSyncing} />
          <Button onClick={() => handleSearch(cpsInput)} disabled={isSearching || isSyncing}>{isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}</Button>
          <Button variant="outline" onClick={handleSync} disabled={isSearching || isSyncing} title="Sincronizar Registros Recentes">
            {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
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
                    <div><p className="font-semibold">{record.PATIENT}</p><p className="text-sm text-muted-foreground">CPS: {record.CPS}</p></div>
                    <Button size="sm" onClick={() => onCpsSelected(record)}>Selecionar</Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
              <AlertCircle className="h-8 w-8 mb-2" />
              <p>Nenhum resultado encontrado.</p>
              <p className="text-xs">Verifique o número ou clique no botão de sincronização <RefreshCw className="inline h-3 w-3" /> para buscar os registros mais recentes.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CpsSelectionModal;