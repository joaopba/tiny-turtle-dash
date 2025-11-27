"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, Package, PlusCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import Papa from "papaparse";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

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

const OpmeRegistration = () => {
  const { session } = useSession();
  const userId = session?.user?.id;

  const [opmeInventory, setOpmeInventory] = useState<OpmeItem[]>([]);
  const [isAddOpmeDialogOpen, setIsAddOpmeDialogOpen] = useState(false);
  const [loadingInventory, setLoadingInventory] = useState(true);
  const [loadingFileUpload, setLoadingFileUpload] = useState(false);
  const [loadingAddManual, setLoadingAddManual] = useState(false);


  // Form states for adding new OPME
  const [newOpme, setNewOpme] = useState<Omit<OpmeItem, 'id' | 'user_id' | 'created_at'>>({
    opme: "",
    lote: "",
    validade: "",
    referencia: "",
    anvisa: "",
    tuss: "",
    cod_simpro: "",
    codigo_barras: "",
  });

  useEffect(() => {
    console.log("OpmeRegistration - Current userId:", userId);
    if (!userId) {
      toast.error("ID do usuário não disponível. Por favor, faça login novamente.");
    }
  }, [userId]);

  const fetchOpmeInventory = useCallback(async () => {
    if (!userId) {
      console.warn("fetchOpmeInventory (OpmeRegistration): userId is null, skipping fetch.");
      setLoadingInventory(false);
      return;
    }
    setLoadingInventory(true);
    const { data, error } = await supabase
      .from("opme_inventory")
      .select("*")
      .eq("user_id", userId)
      .order("opme", { ascending: true }); // Ordenar para melhor visualização

    if (error) {
      console.error("Erro ao buscar inventário OPME:", error);
      toast.error("Falha ao carregar inventário OPME.");
    } else {
      console.log("OpmeRegistration - Inventário OPME carregado:", data);
      setOpmeInventory(data as OpmeItem[]);
    }
    setLoadingInventory(false);
  }, [userId]);

  useEffect(() => {
    fetchOpmeInventory();
  }, [fetchOpmeInventory]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      toast.error("Nenhum arquivo selecionado.");
      return;
    }

    setLoadingFileUpload(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        if (results.errors.length) {
          console.error("Erros ao analisar o CSV:", results.errors);
          toast.error("Erro ao analisar o arquivo CSV. Verifique o formato.");
          setLoadingFileUpload(false);
          return;
        }
        const parsedData: Omit<OpmeItem, 'id'>[] = results.data.map((row: any) => ({
          opme: row.OPME || "",
          lote: row.LOTE || "",
          validade: row.VALIDADE || "",
          referencia: row["REFERÊNCIA."] || "",
          anvisa: row.ANVISA || "",
          tuss: row.TUSS || "",
          cod_simpro: row["COD.SIMPRO"] || "",
          codigo_barras: row["código de barras"] || "",
        }));

        const validOpme = parsedData.filter(item => item.codigo_barras);
        if (validOpme.length !== parsedData.length) {
          toast.warning("Alguns itens foram ignorados por não possuírem 'código de barras'.");
        }

        if (validOpme.length === 0) {
          toast.error("Nenhum item OPME válido encontrado no arquivo.");
          setLoadingFileUpload(false);
          return;
        }

        const { data, error } = await supabase
          .from("opme_inventory")
          .insert(validOpme.map(item => ({ ...item, user_id: userId })))
          .select();

        if (error) {
          console.error("Erro ao salvar OPME no banco de dados:", error);
          toast.error("Falha ao salvar inventário OPME no banco de dados.");
        } else {
          toast.success(`Foram carregados ${data.length} itens OPME do arquivo para o banco de dados.`);
          fetchOpmeInventory(); // Refresh inventory
        }
        setLoadingFileUpload(false);
      },
      error: (error: any) => {
        console.error("Erro ao analisar o arquivo:", error);
        toast.error("Erro ao processar o arquivo. Tente novamente.");
        setLoadingFileUpload(false);
      },
    });
  };

  const handleAddOpme = async () => {
    if (!userId) {
      toast.error("Você precisa estar logado para adicionar OPME.");
      return;
    }
    if (!newOpme.opme || !newOpme.codigo_barras) {
      toast.error("OPME e Código de Barras são campos obrigatórios.");
      return;
    }

    setLoadingAddManual(true);
    const { data, error } = await supabase
      .from("opme_inventory")
      .insert({ ...newOpme, user_id: userId })
      .select();

    if (error) {
      console.error("Erro ao adicionar OPME:", error);
      toast.error(`Falha ao adicionar OPME: ${error.message}`);
    } else {
      toast.success(`OPME "${newOpme.opme}" adicionado com sucesso.`);
      setNewOpme({
        opme: "", lote: "", validade: "", referencia: "", anvisa: "", tuss: "", cod_simpro: "", codigo_barras: "",
      });
      setIsAddOpmeDialogOpen(false);
      fetchOpmeInventory(); // Refresh inventory
    }
    setLoadingAddManual(false);
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <h1 className="text-4xl font-extrabold text-center text-foreground mb-8">Cadastro e Inventário de OPME</h1>

      {/* OPME Inventory Management */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-2xl font-semibold">
            <Package className="h-6 w-6 text-primary" /> Gerenciar Inventário OPME
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-muted-foreground text-base">
            Carregue ou adicione manualmente itens OPME ao seu inventário.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
            <div className="space-y-2">
              <Label htmlFor="opme-file-upload" className="text-sm font-medium flex items-center gap-2">
                <Upload className="h-4 w-4" /> Carregar via CSV
              </Label>
              <Input
                id="opme-file-upload"
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="max-w-full md:max-w-md"
                disabled={loadingFileUpload}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Colunas esperadas: OPME, LOTE, VALIDADE, REFERÊNCIA., ANVISA, TUSS, COD.SIMPRO, código de barras.
              </p>
              {loadingFileUpload && (
                <div className="flex items-center text-sm text-primary mt-2">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando arquivo...
                </div>
              )}
            </div>
            <div className="flex justify-start md:justify-end">
              <Dialog open={isAddOpmeDialogOpen} onOpenChange={setIsAddOpmeDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="flex items-center gap-2 text-base py-6">
                    <PlusCircle className="h-5 w-5" /> Adicionar OPME Manualmente
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px] p-6">
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-bold">Adicionar Novo OPME</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="opme" className="text-right">OPME</Label>
                      <Input id="opme" value={newOpme.opme} onChange={(e) => setNewOpme({ ...newOpme, opme: e.target.value })} className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="lote" className="text-right">Lote</Label>
                      <Input id="lote" value={newOpme.lote} onChange={(e) => setNewOpme({ ...newOpme, lote: e.target.value })} className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="validade" className="text-right">Validade</Label>
                      <Input id="validade" value={newOpme.validade} onChange={(e) => setNewOpme({ ...newOpme, validade: e.target.value })} className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="referencia" className="text-right">Referência</Label>
                      <Input id="referencia" value={newOpme.referencia} onChange={(e) => setNewOpme({ ...newOpme, referencia: e.target.value })} className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="anvisa" className="text-right">ANVISA</Label>
                      <Input id="anvisa" value={newOpme.anvisa} onChange={(e) => setNewOpme({ ...newOpme, anvisa: e.target.value })} className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="tuss" className="text-right">TUSS</Label>
                      <Input id="tuss" value={newOpme.tuss} onChange={(e) => setNewOpme({ ...newOpme, tuss: e.target.value })} className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="cod_simpro" className="text-right">Cód. Simpro</Label>
                      <Input id="cod_simpro" value={newOpme.cod_simpro} onChange={(e) => setNewOpme({ ...newOpme, cod_simpro: e.target.value })} className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="codigo_barras" className="text-right">Cód. Barras</Label>
                      <Input id="codigo_barras" value={newOpme.codigo_barras} onChange={(e) => setNewOpme({ ...newOpme, codigo_barras: e.target.value })} className="col-span-3" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" onClick={handleAddOpme} disabled={loadingAddManual}>
                      {loadingAddManual ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Adicionar OPME
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          {opmeInventory.length > 0 && (
            <p className="text-sm text-green-600 dark:text-green-400 mt-4">
              Inventário OPME carregado: {opmeInventory.length} itens.
            </p>
          )}
          <h3 className="text-xl font-semibold mt-8 mb-4 flex items-center gap-2">
            <Package className="h-5 w-5" /> Itens no Inventário
          </h3>
          {loadingInventory ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">Carregando inventário...</span>
            </div>
          ) : opmeInventory.length > 0 ? (
            <ScrollArea className="h-[400px] w-full rounded-md border">
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {opmeInventory.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.opme}</TableCell>
                      <TableCell>{item.lote || "N/A"}</TableCell>
                      <TableCell>{item.validade || "N/A"}</TableCell>
                      <TableCell>{item.referencia || "N/A"}</TableCell>
                      <TableCell>{item.anvisa || "N/A"}</TableCell>
                      <TableCell>{item.tuss || "N/A"}</TableCell>
                      <TableCell>{item.cod_simpro || "N/A"}</TableCell>
                      <TableCell>{item.codigo_barras}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          ) : (
            <p className="text-muted-foreground text-center py-4">Nenhum item OPME no inventário ainda. Adicione um manualmente ou carregue via CSV.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OpmeRegistration;