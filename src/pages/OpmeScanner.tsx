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
import { CalendarIcon, Scan, Search, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import OpmeScanModal from "@/components/OpmeScanModal";
import CpsSelectionModal from "@/components/CpsSelectionModal"; // Importar o novo modal de seleção de CPS

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
  quantity: number;
  opmeDetails?: OpmeItem;
}

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
  const [activeTab, setActiveTab] = useState<string>("bipar");
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [isCpsSelectionModalOpen, setIsCpsSelectionModalOpen] = useState(false); // Novo estado para o modal de seleção de CPS

  useEffect(() => {
    if (!userId) {
      toast.error("ID do usuário não disponível. Por favor, faça login novamente.");
    }
  }, [userId]);

  const fetchOpmeInventory = useCallback(async () => {
    if (!userId) {
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
    if (!userId || !selectedCps) {
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

  const handleSelectCps = useCallback(async (record: CpsRecord) => {
    setSelectedCps(record);
    setActiveTab("bipar");
    setIsCpsSelectionModalOpen(false); // Fecha o modal de seleção de CPS
    setIsScanModalOpen(true); // Abre o modal de bipagem
    if (!userId) {
      toast.error("Você precisa estar logado para selecionar um CPS.");
      return;
    }

    const { data, error } = await supabase
      .from('local_cps_records')
      .upsert({
        user_id: userId,
        cps_id: record.CPS,
        patient: record.PATIENT,
        professional: record.PROFESSIONAL,
        agreement: record.AGREEMENT,
        business_unit: record.UNIDADENEGOCIO,
        created_at: record.CREATED_AT,
      }, { onConflict: 'cps_id, user_id' })
      .select();

    if (error) {
      console.error("Erro ao salvar CPS localmente:", error);
      toast.error("Falha ao salvar detalhes do CPS localmente.");
    } else {
      console.log("CPS salvo/atualizado localmente:", data);
    }
  }, [userId]);

  const fetchCpsRecords = useCallback(async (forceApiFetch = false, specificCpsId?: number, fetchAllLocal = false) => {
    if (!userId) {
      toast.error("ID do usuário não disponível para buscar registros de CPS.");
      return;
    }

    setLoadingCps(true);
    setCpsRecords([]);
    // setSelectedCps(null); // Não resetar selectedCps aqui para não fechar o modal de bipagem se já estiver aberto

    const formattedStartDate = startDate ? format(startDate, "yyyy-MM-dd") : '';
    const formattedEndDate = endDate ? format(endDate, "yyyy-MM-dd") : '';

    try {
      let recordsToProcess: CpsRecord[] = [];

      if (fetchAllLocal) {
        const { data: localData, error: localError } = await supabase
          .from('local_cps_records')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (localError) {
          console.error("Erro ao buscar TODOS registros de CPS locais:", localError);
          toast.error("Falha ao carregar todos os registros de CPS locais.");
          setLoadingCps(false);
          return;
        }
        recordsToProcess = localData.map(record => ({
          CPS: record.cps_id,
          PATIENT: record.patient,
          PROFESSIONAL: record.professional,
          AGREEMENT: record.agreement,
          UNIDADENEGOCIO: record.business_unit,
          CREATED_AT: record.created_at,
          TIPO: '', SITUACAO: '', ATENDANT: '', TREATMENT: null, REGISTRATION: null, A_CID: '', DATA_ALTA: null, DATAENTREGA: null, DATARAT: null, DATA_FECHADO: '', DATA_RECEBIMENTO: null,
        }));
        setCpsRecords(recordsToProcess);
        toast.success(`Foram encontrados ${recordsToProcess.length} registros de CPS locais.`);
        setLoadingCps(false);
        return;
      }

      let query = supabase
        .from('local_cps_records')
        .select('*')
        .eq('user_id', userId);

      if (specificCpsId) {
        query = query.eq('cps_id', specificCpsId);
      } else if (formattedStartDate && formattedEndDate) {
        query = query
          .gte('created_at', `${formattedStartDate}T00:00:00.000Z`)
          .lte('created_at', `${formattedEndDate}T23:59:59.999Z`)
          .eq('business_unit', businessUnit);
      }

      const { data: localData, error: localError } = await query;

      if (localError) {
        console.error("Erro ao buscar registros de CPS locais (com filtros):", localError);
      }

      if (localData && localData.length > 0 && !forceApiFetch) {
        recordsToProcess = localData.map(record => ({
          CPS: record.cps_id,
          PATIENT: record.patient,
          PROFESSIONAL: record.professional,
          AGREEMENT: record.agreement,
          UNIDADENEGOCIO: record.business_unit,
          CREATED_AT: record.created_at,
          TIPO: '', SITUACAO: '', ATENDANT: '', TREATMENT: null, REGISTRATION: null, A_CID: '', DATA_ALTA: null, DATAENTREGA: null, DATARAT: null, DATA_FECHADO: '', DATA_RECEBIMENTO: null,
        }));
        setCpsRecords(recordsToProcess);
        toast.success(`Foram encontrados ${recordsToProcess.length} registros de CPS locais.`);
      }

      if (specificCpsId && (!recordsToProcess.find(r => r.CPS === specificCpsId) || forceApiFetch)) {
        const apiStartDate = formattedStartDate || format(new Date(), "yyyy-MM-dd");
        const apiEndDate = formattedEndDate || format(new Date(), "yyyy-MM-dd");

        const { data, error } = await supabase.functions.invoke('fetch-cps-records', {
          body: {
            start_date: apiStartDate,
            end_date: apiEndDate,
            business_unit: businessUnit,
          },
        });

        if (error) {
          throw new Error(error.message);
        }

        if (data && Array.isArray(data)) {
          const foundInApi = data.find((record: CpsRecord) => record.CPS === specificCpsId);
          if (foundInApi) {
            recordsToProcess = [foundInApi];
            setCpsRecords(recordsToProcess);
            toast.success(`CPS ${specificCpsId} encontrado na API externa.`);

            await supabase
              .from('local_cps_records')
              .upsert({
                user_id: userId,
                cps_id: foundInApi.CPS,
                patient: foundInApi.PATIENT,
                professional: foundInApi.PROFESSIONAL,
                agreement: foundInApi.AGREEMENT,
                business_unit: foundInApi.UNIDADENEGOCIO,
                created_at: foundInApi.CREATED_AT,
              }, { onConflict: 'cps_id, user_id' });
          } else {
            toast.warning(`CPS ${specificCpsId} não encontrado na API externa para o período.`);
          }
        }
      } else if (!specificCpsId && (recordsToProcess.length === 0 || forceApiFetch)) {
        if (!formattedStartDate || !formattedEndDate) {
          toast.error("Por favor, selecione a data inicial e final para buscar na API externa.");
          setLoadingCps(false);
          return;
        }
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

          await supabase
            .from('local_cps_records')
            .upsert(data.map((record: CpsRecord) => ({
              user_id: userId,
              cps_id: record.CPS,
              patient: record.PATIENT,
              professional: record.PROFESSIONAL,
              agreement: record.AGREEMENT,
              business_unit: record.UNIDADENEGOCIO,
              created_at: record.CREATED_AT,
            })), { onConflict: 'cps_id, user_id' });

        } else {
          toast.warning("Nenhum registro de CPS externo encontrado ou formato de dados inesperado.");
        }
      }
    } catch (error: any) {
      console.error("Erro ao buscar registros de CPS:", error.message);
      toast.error(`Falha ao buscar registros de CPS: ${error.message}. Verifique a conexão ou os parâmetros.`);
    } finally {
      setLoadingCps(false);
    }
  }, [startDate, endDate, businessUnit, userId]);

  const handleCpsSearch = useCallback(async (cpsIdToSearch: string) => {
    const parsedCpsId = parseInt(cpsIdToSearch, 10);
    if (isNaN(parsedCpsId)) {
      toast.error("Número de CPS inválido.");
      return;
    }

    setLoadingCps(true);
    try {
      // Tenta buscar no banco de dados local primeiro
      let { data: localCps, error: localError } = await supabase
        .from('local_cps_records')
        .select('*')
        .eq('user_id', userId)
        .eq('cps_id', parsedCpsId)
        .single();

      if (localError && localError.code !== 'PGRST116') { // PGRST116 é "no rows found"
        console.error("Erro ao buscar CPS localmente:", localError);
        // Continua para a API externa se houver erro diferente de "não encontrado"
      }

      if (localCps) {
        handleSelectCps({
          CPS: localCps.cps_id,
          PATIENT: localCps.patient,
          PROFESSIONAL: localCps.professional,
          AGREEMENT: localCps.agreement,
          UNIDADENEGOCIO: localCps.business_unit,
          CREATED_AT: localCps.created_at,
          TIPO: '', SITUACAO: '', ATENDANT: '', TREATMENT: null, REGISTRATION: null, A_CID: '', DATA_ALTA: null, DATAENTREGA: null, DATARAT: null, DATA_FECHADO: '', DATA_RECEBIMENTO: null,
        });
        toast.success(`CPS ${parsedCpsId} encontrado e selecionado.`);
      } else {
        // Se não encontrado localmente, busca na API externa
        const apiStartDate = format(new Date(), "yyyy-MM-dd"); // Usar data atual como fallback
        const apiEndDate = format(new Date(), "yyyy-MM-dd");

        const { data, error } = await supabase.functions.invoke('fetch-cps-records', {
          body: {
            start_date: apiStartDate,
            end_date: apiEndDate,
            business_unit: businessUnit, // Usar a unidade de negócio padrão ou selecionada
          },
        });

        if (error) {
          throw new Error(error.message);
        }

        if (data && Array.isArray(data)) {
          const foundInApi = data.find((record: CpsRecord) => record.CPS === parsedCpsId);
          if (foundInApi) {
            handleSelectCps(foundInApi);
            toast.success(`CPS ${parsedCpsId} encontrado na API externa e selecionado.`);

            // Salva na base de dados local após encontrar na API externa
            await supabase
              .from('local_cps_records')
              .upsert({
                user_id: userId,
                cps_id: foundInApi.CPS,
                patient: foundInApi.PATIENT,
                professional: foundInApi.PROFESSIONAL,
                agreement: foundInApi.AGREEMENT,
                business_unit: foundInApi.UNIDADENEGOCIO,
                created_at: foundInApi.CREATED_AT,
              }, { onConflict: 'cps_id, user_id' });
          } else {
            toast.error(`CPS ${parsedCpsId} não encontrado na API externa para o período.`);
          }
        } else {
          toast.warning("Nenhum registro de CPS externo encontrado ou formato de dados inesperado.");
        }
      }
    } catch (error: any) {
      console.error("Erro ao buscar registros de CPS:", error.message);
      toast.error(`Falha ao buscar registros de CPS: ${error.message}. Verifique a conexão ou os parâmetros.`);
    } finally {
      setLoadingCps(false);
    }
  }, [userId, handleSelectCps, businessUnit]);


  useEffect(() => {
    fetchOpmeInventory();
  }, [fetchOpmeInventory]);

  useEffect(() => {
    if (userId) {
      const today = new Date();
      setStartDate(today);
      setEndDate(today);
    }
  }, [userId]);

  useEffect(() => {
    // Este useEffect continua buscando com filtros de data/unidade por padrão
    if (startDate && endDate && businessUnit && userId) {
      fetchCpsRecords();
    }
  }, [startDate, endDate, businessUnit, userId, fetchCpsRecords]);

  useEffect(() => {
    const cpsIdFromUrl = searchParams.get('cps_id');
    if (cpsIdFromUrl && userId) {
      // Se houver CPS na URL, tenta selecioná-lo e abre o modal de bipagem
      handleCpsSearch(cpsIdFromUrl);
      setSearchParams({}); // Limpa o parâmetro da URL
    } else if (userId && !selectedCps && !isScanModalOpen) {
      // Se não houver CPS selecionado e o modal de bipagem não estiver aberto, abre o modal de seleção de CPS
      setIsCpsSelectionModalOpen(true);
    }
  }, [searchParams, userId, selectedCps, isScanModalOpen, handleCpsSearch, setSearchParams]);

  useEffect(() => {
    fetchLinkedOpme();
  }, [selectedCps, fetchLinkedOpme]);

  const handleChangeCps = () => {
    setIsScanModalOpen(false); // Fecha o modal de bipagem
    setSelectedCps(null); // Limpa o CPS selecionado
    setIsCpsSelectionModalOpen(true); // Abre o modal de seleção de CPS
  };

  if (loadingCps && !selectedCps) { // Mostrar spinner apenas se estiver carregando e nenhum CPS estiver selecionado
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Carregando...</span>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <h1 className="text-4xl font-extrabold text-center text-foreground mb-8">Bipagem de OPME</h1>

      {/* CPS Record Search and Selection by Period */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-2xl font-semibold">
            <Search className="h-6 w-6 text-primary" /> Buscar Paciente (CPS) por Período
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-date" className="text-sm font-medium">Data Inicial</Label>
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
              <Label htmlFor="end-date" className="text-sm font-medium">Data Final</Label>
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
              <Label htmlFor="business-unit" className="text-sm font-medium">Unidade de Negócio</Label>
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
          <div className="flex flex-col sm:flex-row justify-end gap-3">
            <Button onClick={() => fetchCpsRecords(false, undefined, true)} disabled={loadingCps} variant="outline" className="w-full sm:w-auto">
              {loadingCps ? "Buscando Locais..." : "Ver Todos CPS Locais"}
            </Button>
            <Button onClick={() => fetchCpsRecords(true)} disabled={loadingCps} variant="secondary" className="w-full sm:w-auto">
              {loadingCps ? "Atualizando da API..." : "Atualizar da API Externa"}
            </Button>
            <Button onClick={() => fetchCpsRecords(false)} disabled={loadingCps} className="w-full sm:w-auto">
              {loadingCps ? "Buscando..." : "Buscar CPS"}
            </Button>
          </div>

          {loadingCps ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">Carregando registros de CPS...</span>
            </div>
          ) : cpsRecords.length > 0 ? (
            <ScrollArea className="h-[250px] w-full rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[100px]">CPS</TableHead>
                    <TableHead>Paciente</TableHead>
                    <TableHead>Profissional</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cpsRecords.map((record) => (
                    <TableRow
                      key={record.CPS}
                      className={selectedCps?.CPS === record.CPS ? "bg-accent/50" : ""}
                    >
                      <TableCell className="font-medium">{record.CPS}</TableCell>
                      <TableCell>{record.PATIENT}</TableCell>
                      <TableCell>{record.PROFESSIONAL}</TableCell>
                      <TableCell className="text-right">
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
          ) : (
            <p className="text-muted-foreground text-center py-4">Nenhum registro de CPS encontrado para os critérios selecionados.</p>
          )}
        </CardContent>
      </Card>

      {/* OPME Scanning Section with Tabs */}
      {selectedCps && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-2xl font-semibold">
              <Scan className="h-6 w-6 text-primary" /> Gerenciar OPME para Paciente: <span className="text-blue-600 dark:text-blue-400">{selectedCps.PATIENT}</span> (CPS: <span className="text-blue-600 dark:text-blue-400">{selectedCps.CPS}</span>)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 h-10">
                <TabsTrigger value="bipar" className="text-base">Bipar OPME</TabsTrigger>
                <TabsTrigger value="itens-bipados" className="text-base">Itens Bipados</TabsTrigger>
              </TabsList>
              <TabsContent value="bipar" className="mt-6 space-y-4">
                <Button
                  onClick={() => setIsScanModalOpen(true)}
                  className="w-full text-lg py-6"
                  disabled={!selectedCps}
                >
                  <Scan className="h-5 w-5 mr-2" /> Abrir Bipagem de OPME
                </Button>
                <p className="text-sm text-muted-foreground">
                  Clique para abrir o modal de bipagem e registrar OPMEs para o paciente selecionado.
                </p>
              </TabsContent>
              <TabsContent value="itens-bipados" className="mt-6 space-y-4">
                {linkedOpme.length > 0 ? (
                  <ScrollArea className="h-[250px] w-full rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>OPME</TableHead>
                          <TableHead>Lote</TableHead>
                          <TableHead>Validade</TableHead>
                          <TableHead>Referência</TableHead>
                          <TableHead>ANVISA</TableHead>
                          <TableHead>TUSS</TableHead>
                          <TableHead>Cód. Simpro</TableHead>
                          <TableHead>Cód. Barras</TableHead>
                          <TableHead className="text-right">Quantidade</TableHead>
                          <TableHead>Bipado Em</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {linkedOpme.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.opmeDetails?.opme || "N/A"}</TableCell>
                            <TableCell>{item.opmeDetails?.lote || "N/A"}</TableCell>
                            <TableCell>{item.opmeDetails?.validade || "N/A"}</TableCell>
                            <TableCell>{item.opmeDetails?.referencia || "N/A"}</TableCell>
                            <TableCell>{item.opmeDetails?.anvisa || "N/A"}</TableCell>
                            <TableCell>{item.opmeDetails?.tuss || "N/A"}</TableCell>
                            <TableCell>{item.opmeDetails?.cod_simpro || "N/A"}</TableCell>
                            <TableCell>{item.opme_barcode}</TableCell>
                            <TableCell className="text-right">{item.quantity}</TableCell>
                            <TableCell>{new Date(item.linked_at).toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                ) : (
                  <p className="text-muted-foreground text-sm text-center py-4">Nenhum OPME bipado para este paciente ainda.</p>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* O Modal de Seleção de CPS */}
      <CpsSelectionModal
        isOpen={isCpsSelectionModalOpen}
        onClose={() => setIsCpsSelectionModalOpen(false)}
        onCpsSelected={handleCpsSearch}
        loading={loadingCps}
      />

      {/* O Modal de Bipagem */}
      {selectedCps && (
        <OpmeScanModal
          isOpen={isScanModalOpen}
          onClose={() => setIsScanModalOpen(false)}
          selectedCps={selectedCps}
          opmeInventory={opmeInventory}
          userId={userId}
          onScanSuccess={fetchLinkedOpme}
          onChangeCps={handleChangeCps} // Passa a função para mudar o CPS
        />
      )}
    </div>
  );
};

export default OpmeScanner;