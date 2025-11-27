"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon, Scan, Search } from "lucide-react"; // Added Search icon
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";

interface CpsRecord {
  CREATED_AT: string;
  TIPO: string;
  SITUACAO: string;
  ATENDANT: string;
  CPS: number;
  PATIENT: string;
  TREATMENT: string | null;
  UNIDADENEGOCIO: string;
  REGISTRATION: string | null;
  PROFESSIONAL: string;
  AGREEMENT: string;
  A_CID: string;
  DATA_ALTA: string | null;
  DATAENTREGA: string | null;
  DATARAT: string | null;
  DATA_FECHADO: string;
  DATA_RECEBIMENTO: string | null;
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
  cps_id: number;
  opme_barcode: string;
  linked_at: string;
  opmeDetails?: OpmeItem;
}

const OpmeScanner = () => {
  const { session } = useSession();
  const userId = session?.user?.id;

  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [businessUnit, setBusinessUnit] = useState<string>("47");
  const [cpsRecords, setCpsRecords] = useState<CpsRecord[]>([]);
  const [loadingCps, setLoadingCps] = useState(false);
  const [selectedCps, setSelectedCps] = useState<CpsRecord | null>(null);
  const [opmeInventory, setOpmeInventory] = useState<OpmeItem[]>([]);
  const [barcodeInput, setBarcodeInput] = useState<string>("");
  const [linkedOpme, setLinkedOpme] = useState<LinkedOpme[]>([]);

  useEffect(() => {
    console.log("OpmeScanner - Current userId:", userId);
    if (!userId) {
      toast.error("ID do usuário não disponível. Por favor, faça login novamente.");
    }
  }, [userId]);

  const fetchOpmeInventory = useCallback(async () => {
    if (!userId) {
      console.warn("fetchOpmeInventory: userId is null, skipping fetch.");
      return;
    }
    const { data, error } = await supabase
      .from("opme_inventory")
      .select("*")
      .eq("user_id", userId);

    if (error) {
      console.error("Erro ao buscar inventário OPME:", error);
      toast.error("Falha ao carregar inventário OPME.");
    } else {
      setOpmeInventory(data as OpmeItem[]);
    }
  }, [userId]);

  const fetchLinkedOpme = useCallback(async () => {
    if (!userId) {
      console.warn("fetchLinkedOpme: userId is null, skipping fetch.");
      setLinkedOpme([]);
      return;
    }
    if (!selectedCps) {
      setLinkedOpme([]);
      return;
    }

    const { data, error } = await supabase
      .from("linked_opme")
      .select("*")
      .eq("user_id", userId)
      .eq("cps_id", selectedCps.CPS);

    if (error) {
      console.error("Erro ao buscar OPME bipado:", error);
      toast.error("Falha ao carregar OPME bipado para este paciente.");
    } else {
      const enrichedLinkedOpme = data.map((link) => ({
        ...link,
        opmeDetails: opmeInventory.find(
          (opme) => opme.codigo_barras === link.opme_barcode
        ),
      }));
      setLinkedOpme(enrichedLinkedOpme as LinkedOpme[]);
    }
  }, [userId, selectedCps, opmeInventory]);

  useEffect(() => {
    fetchOpmeInventory();
  }, [fetchOpmeInventory]);

  useEffect(() => {
    fetchLinkedOpme();
  }, [fetchLinkedOpme]);

  const handleSelectCps = useCallback(async (record: CpsRecord) => {
    setSelectedCps(record);
    if (!userId) {
      toast.error("Você precisa estar logado para selecionar um CPS.");
      return;
    }

    // Save or update the selected CPS record in local_cps_records table
    const { data, error } = await supabase
      .from('local_cps_records')
      .upsert({
        user_id: userId,
        cps_id: record.CPS,
        patient: record.PATIENT,
        professional: record.PROFESSIONAL,
        agreement: record.AGREEMENT,
        business_unit: record.UNIDADENEGOCIO,
      }, { onConflict: 'cps_id, user_id' }) // Conflict on cps_id and user_id to update existing
      .select();

    if (error) {
      console.error("Erro ao salvar CPS localmente:", error);
      toast.error("Falha ao salvar detalhes do CPS localmente.");
    } else {
      console.log("CPS salvo/atualizado localmente:", data);
    }
  }, [userId]);

  const fetchCpsRecords = async () => {
    if (!startDate || !endDate || !businessUnit) {
      toast.error("Por favor, selecione a data inicial, final e a unidade de negócio.");
      return;
    }
    if (!userId) {
      toast.error("ID do usuário não disponível para buscar registros de CPS.");
      return;
    }

    setLoadingCps(true);
    setCpsRecords([]);
    setSelectedCps(null);

    const formattedStartDate = format(startDate, "yyyy-MM-dd");
    const formattedEndDate = format(endDate, "yyyy-MM-dd");

    try {
      const { data, error } = await supabase.functions.invoke('fetch-cps-records', {
        body: {
          start_date: formattedStartDate,
          end_date: formattedEndDate,
          business_unit: businessUnit,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data && Array.isArray(data)) {
        setCpsRecords(data);
        toast.success(`Foram encontrados ${data.length} registros de CPS.`);
      } else {
        toast.warning("Nenhum registro de CPS encontrado ou formato de dados inesperado.");
      }
    } catch (error: any) {
      console.error("Erro ao buscar registros de CPS:", error.message);
      toast.error(`Falha ao buscar registros de CPS: ${error.message}. Verifique a conexão ou os parâmetros.`);
    } finally {
      setLoadingCps(false);
    }
  };

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

    const opmeExists = opmeInventory.some(
      (item) => item.codigo_barras === barcodeInput
    );

    if (!opmeExists) {
      toast.error("Código de barras não encontrado no inventário OPME.");
      return;
    }

    const newLinkedItem = {
      cps_id: selectedCps.CPS,
      opme_barcode: barcodeInput,
      user_id: userId,
    };

    const { error } = await supabase
      .from("linked_opme")
      .insert(newLinkedItem);

    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        toast.warning("Este OPME já foi bipado para este paciente.");
      } else {
        console.error("Erro ao bipar OPME:", error);
        toast.error(`Falha ao bipar OPME: ${error.message}`);
      }
    } else {
      toast.success(`OPME com código ${barcodeInput} bipado para o paciente ${selectedCps.PATIENT}.`);
      fetchLinkedOpme(); // Refresh linked OPME
    }
    setBarcodeInput("");
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      <h1 className="text-3xl font-bold text-center mb-6">Sistema de Bipagem de OPME</h1>

      {/* CPS Record Search and Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" /> Buscar e Selecionar Paciente (CPS)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-date">Data Inicial</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP") : <span>Selecione a data</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date">Data Final</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP") : <span>Selecione a data</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label htmlFor="business-unit">Unidade de Negócio</Label>
              <Select value={businessUnit} onValueChange={setBusinessUnit}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione a unidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="47">Unidade 47</SelectItem>
                  <SelectItem value="48">Unidade 48</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={fetchCpsRecords} disabled={loadingCps} className="w-full md:w-auto">
              {loadingCps ? "Buscando..." : "Buscar CPS"}
            </Button>
          </div>

          {cpsRecords.length > 0 && (
            <ScrollArea className="h-[200px] w-full rounded-md border mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>CPS</TableHead>
                    <TableHead>Paciente</TableHead>
                    <TableHead>Profissional</TableHead>
                    <TableHead>Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cpsRecords.map((record) => (
                    <TableRow
                      key={record.CPS}
                      className={selectedCps?.CPS === record.CPS ? "bg-accent" : ""}
                    >
                      <TableCell>{record.CPS}</TableCell>
                      <TableCell>{record.PATIENT}</TableCell>
                      <TableCell>{record.PROFESSIONAL}</TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSelectCps(record)}
                        >
                          Selecionar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* OPME Scanning Section */}
      {selectedCps && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scan className="h-5 w-5" /> Bipar OPME para Paciente: {selectedCps.PATIENT} (CPS: {selectedCps.CPS})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Código de Barras do OPME"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    handleBarcodeScan();
                  }
                }}
                autoFocus // Automatically focus on this input
              />
              <Button onClick={handleBarcodeScan}>Bipar OPME</Button>
            </div>

            {linkedOpme.length > 0 ? (
              <ScrollArea className="h-[200px] w-full rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>OPME</TableHead>
                      <TableHead>Lote</TableHead>
                      <TableHead>Validade</TableHead>
                      <TableHead>Cód. Barras</TableHead>
                      <TableHead>Bipado Em</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {linkedOpme.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.opmeDetails?.opme || "N/A"}</TableCell>
                        <TableCell>{item.opmeDetails?.lote || "N/A"}</TableCell>
                        <TableCell>{item.opmeDetails?.validade || "N/A"}</TableCell>
                        <TableCell>{item.opme_barcode}</TableCell>
                        <TableCell>{new Date(item.linked_at).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            ) : (
              <p className="text-muted-foreground">Nenhum OPME bipado para este paciente ainda.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default OpmeScanner;