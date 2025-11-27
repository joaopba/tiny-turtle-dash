"use client";

import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon, Upload, Scan, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import Papa from "papaparse";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  id: string; // Unique ID for each OPME item (e.g., generated UUID)
  opme: string;
  lote: string;
  validade: string;
  referencia: string;
  anvisa: string;
  tuss: string;
  codSimpro: string;
  codigoBarras: string; // This is the key for scanning
}

interface LinkedOpme {
  cpsId: number;
  opmeBarcode: string;
  linkedAt: string; // Timestamp
  opmeDetails?: OpmeItem; // To display details of the linked OPME
}

const OpmeScanner = () => {
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
    // Load OPME inventory from localStorage on component mount
    const storedOpme = localStorage.getItem("opmeInventory");
    if (storedOpme) {
      setOpmeInventory(JSON.parse(storedOpme));
    }
    // Load linked OPME from localStorage on component mount
    const storedLinkedOpme = localStorage.getItem("linkedOpme");
    if (storedLinkedOpme) {
      setLinkedOpme(JSON.parse(storedLinkedOpme));
    }
  }, []);

  useEffect(() => {
    // Filter linked OPME for the selected CPS
    if (selectedCps) {
      const patientLinkedOpme = linkedOpme.filter(
        (item) => item.cpsId === selectedCps.CPS
      );
      // Enrich with OPME details
      const enrichedLinkedOpme = patientLinkedOpme.map((link) => ({
        ...link,
        opmeDetails: opmeInventory.find(
          (opme) => opme.codigoBarras === link.opmeBarcode
        ),
      }));
      setLinkedOpme(enrichedLinkedOpme);
    } else {
      setLinkedOpme([]); // Clear if no CPS is selected
    }
  }, [selectedCps, opmeInventory]); // Re-run when selectedCps or opmeInventory changes

  const fetchCpsRecords = async () => {
    if (!startDate || !endDate || !businessUnit) {
      toast.error("Por favor, selecione a data inicial, final e a unidade de negócio.");
      return;
    }

    setLoadingCps(true);
    setCpsRecords([]);
    setSelectedCps(null);

    const formattedStartDate = format(startDate, "yyyy-MM-dd");
    const formattedEndDate = format(endDate, "yyyy-MM-dd");
    const apiUrl = `https://api-lab.my-world.dev.br/cps/list-cps?start_date=${formattedStartDate}&end_date=${formattedEndDate}&type_cps=INT&type_group=CPS&business_unit=${businessUnit}`;

    try {
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: CpsRecord[] = await response.json();
      setCpsRecords(data);
      toast.success(`Foram encontrados ${data.length} registros de CPS.`);
    } catch (error) {
      console.error("Erro ao buscar registros de CPS:", error);
      toast.error("Falha ao buscar registros de CPS. Verifique a conexão ou os parâmetros.");
    } finally {
      setLoadingCps(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      toast.error("Nenhum arquivo selecionado.");
      return;
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length) {
          console.error("Erros ao analisar o CSV:", results.errors);
          toast.error("Erro ao analisar o arquivo CSV. Verifique o formato.");
          return;
        }
        const parsedData: OpmeItem[] = results.data.map((row: any) => ({
          id: crypto.randomUUID(), // Generate a unique ID
          opme: row.OPME || "",
          lote: row.LOTE || "",
          validade: row.VALIDADE || "",
          referencia: row["REFERÊNCIA."] || "", // Handle column name with dot
          anvisa: row.ANVISA || "",
          tuss: row.TUSS || "",
          codSimpro: row["COD.SIMPRO"] || "", // Handle column name with dot
          codigoBarras: row["código de barras"] || "", // Handle column name with space
        }));

        // Filter out items without a barcode, as it's essential
        const validOpme = parsedData.filter(item => item.codigoBarras);
        if (validOpme.length !== parsedData.length) {
          toast.warning("Alguns itens foram ignorados por não possuírem 'código de barras'.");
        }

        setOpmeInventory(validOpme);
        localStorage.setItem("opmeInventory", JSON.stringify(validOpme));
        toast.success(`Foram carregados ${validOpme.length} itens OPME do arquivo.`);
      },
      error: (error: any) => {
        console.error("Erro ao analisar o arquivo:", error);
        toast.error("Erro ao processar o arquivo. Tente novamente.");
      },
    });
  };

  const handleBarcodeScan = () => {
    if (!selectedCps) {
      toast.error("Por favor, selecione um paciente (CPS) primeiro.");
      return;
    }
    if (!barcodeInput) {
      toast.error("Por favor, insira um código de barras.");
      return;
    }

    const opmeExists = opmeInventory.some(
      (item) => item.codigoBarras === barcodeInput
    );

    if (!opmeExists) {
      toast.error("Código de barras não encontrado no inventário OPME.");
      return;
    }

    const isAlreadyLinked = linkedOpme.some(
      (item) =>
        item.cpsId === selectedCps.CPS && item.opmeBarcode === barcodeInput
    );

    if (isAlreadyLinked) {
      toast.warning("Este OPME já foi bipado para este paciente.");
      setBarcodeInput("");
      return;
    }

    const newLinkedItem: LinkedOpme = {
      cpsId: selectedCps.CPS,
      opmeBarcode: barcodeInput,
      linkedAt: new Date().toISOString(),
    };

    const updatedLinkedOpme = [...linkedOpme, newLinkedItem];
    setLinkedOpme(updatedLinkedOpme);
    localStorage.setItem("linkedOpme", JSON.stringify(updatedLinkedOpme));
    toast.success(`OPME com código ${barcodeInput} bipado para o paciente ${selectedCps.PATIENT}.`);
    setBarcodeInput("");
  };

  const getLinkedOpmeForSelectedCps = () => {
    return linkedOpme
      .filter((item) => item.cpsId === selectedCps?.CPS)
      .map((link) => ({
        ...link,
        opmeDetails: opmeInventory.find(
          (opme) => opme.codigoBarras === link.opmeBarcode
        ),
      }));
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      <h1 className="text-3xl font-bold text-center mb-6">Sistema de Bipagem de OPME</h1>

      {/* OPME Inventory Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" /> Carregar Inventário OPME
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Faça o upload de uma planilha CSV com os dados dos OPME. As colunas esperadas são: OPME, LOTE, VALIDADE, REFERÊNCIA., ANVISA, TUSS, COD.SIMPRO, código de barras.
          </p>
          <Input
            id="opme-file-upload"
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="max-w-md"
          />
          {opmeInventory.length > 0 && (
            <p className="text-sm text-green-600">
              Inventário OPME carregado: {opmeInventory.length} itens.
            </p>
          )}
        </CardContent>
      </Card>

      {/* CPS Record Fetch */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scan className="h-5 w-5" /> Buscar Registros de Cirurgia/Procedimento (CPS)
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          <div className="md:col-span-3 flex justify-end">
            <Button onClick={fetchCpsRecords} disabled={loadingCps}>
              {loadingCps ? "Buscando..." : "Buscar CPS"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Display CPS Records */}
      {cpsRecords.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Registros de CPS Encontrados</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px] w-full rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>CPS</TableHead>
                    <TableHead>Paciente</TableHead>
                    <TableHead>Profissional</TableHead>
                    <TableHead>Convênio</TableHead>
                    <TableHead>Unidade</TableHead>
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
                      <TableCell>{record.AGREEMENT}</TableCell>
                      <TableCell>{record.UNIDADENEGOCIO}</TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedCps(record)}
                        >
                          Selecionar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* OPME Scanning Section */}
      {selectedCps && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" /> Bipar OPME para Paciente: {selectedCps.PATIENT} (CPS: {selectedCps.CPS})
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
              />
              <Button onClick={handleBarcodeScan}>Bipar OPME</Button>
            </div>

            {getLinkedOpmeForSelectedCps().length > 0 ? (
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
                    {getLinkedOpmeForSelectedCps().map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>{item.opmeDetails?.opme || "N/A"}</TableCell>
                        <TableCell>{item.opmeDetails?.lote || "N/A"}</TableCell>
                        <TableCell>{item.opmeDetails?.validade || "N/A"}</TableCell>
                        <TableCell>{item.opmeBarcode}</TableCell>
                        <TableCell>{new Date(item.linkedAt).toLocaleString()}</TableCell>
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