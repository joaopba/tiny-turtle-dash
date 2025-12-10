"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Upload, Package, PlusCircle, Loader2, ShieldX, Trash2, Info, CheckCircle, Download, Shuffle, Edit, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import Papa from "papaparse";
import * as XLSX from 'xlsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface OpmeItem {
  id: string; opme: string; lote: string | null; validade: string | null; referencia: string | null; anvisa: string | null; tuss: string | null; cod_simpro: string | null; codigo_barras: string | null;
}

interface OpmeRestriction {
  id: string; opme_barcode: string; convenio_name: string; rule_type: 'BLOCK' | 'BILLING_ALERT' | 'EXCLUSIVE_ALLOW' | 'SUGGEST_REPLACEMENT'; message: string | null; replacement_opme_barcode?: string | null;
}

const ruleTypes = {
  BLOCK: { label: "Bloqueio (Não Permitido)", icon: ShieldX },
  BILLING_ALERT: { label: "Alerta de Faturamento", icon: Info },
  EXCLUSIVE_ALLOW: { label: "Permissão Exclusiva", icon: CheckCircle },
  SUGGEST_REPLACEMENT: { label: "Sugerir Substituição", icon: Shuffle },
};

const OpmeRegistration = () => {
  const { session } = useSession();
  const userId = session?.user?.id;

  const [opmeInventory, setOpmeInventory] = useState<OpmeItem[]>([]);
  const [restrictions, setRestrictions] = useState<OpmeRestriction[]>([]);
  const [isAddOpmeDialogOpen, setIsAddOpmeDialogOpen] = useState(false);
  const [isEditOpmeDialogOpen, setIsEditOpmeDialogOpen] = useState(false);
  const [editingOpme, setEditingOpme] = useState<OpmeItem | null>(null);
  
  const [loadingInventory, setLoadingInventory] = useState(true);
  const [loadingRestrictions, setLoadingRestrictions] = useState(true);
  const [loadingFileUpload, setLoadingFileUpload] = useState(false);
  const [loadingAddManual, setLoadingAddManual] = useState(false);
  const [loadingUpdate, setLoadingUpdate] = useState(false);
  const [submittingRestriction, setSubmittingRestriction] = useState(false);

  const [newOpme, setNewOpme] = useState<Omit<OpmeItem, 'id'>>({ opme: "", lote: "", validade: "", referencia: "", anvisa: "", tuss: "", cod_simpro: "", codigo_barras: "" });
  const [newRule, setNewRule] = useState<{ opme_barcode: string; convenio_name: string; type: keyof typeof ruleTypes; message: string; replacement_opme_barcode: string }>({ opme_barcode: "", convenio_name: "", type: "BLOCK", message: "", replacement_opme_barcode: "" });

  const fetchOpmeInventory = useCallback(async () => {
    setLoadingInventory(true);
    const { data, error } = await supabase
      .from("opme_inventory")
      .select("*")
      .order("opme", { ascending: true });

    if (error) toast.error("Falha ao carregar inventário OPME.");
    else setOpmeInventory(data as OpmeItem[]);
    setLoadingInventory(false);
  }, []);

  const fetchRestrictions = useCallback(async () => {
    setLoadingRestrictions(true);
    const { data, error } = await supabase
      .from("opme_restrictions")
      .select("*");

    if (error) toast.error("Falha ao carregar restrições.");
    else setRestrictions(data as OpmeRestriction[]);
    setLoadingRestrictions(false);
  }, []);

  useEffect(() => {
    if (userId) {
      fetchOpmeInventory();
      fetchRestrictions();
    }
  }, [userId, fetchOpmeInventory, fetchRestrictions]);

  // Helper function to normalize keys from imported files
  const normalizeDataKeys = (data: any[]) => {
    const normalizeHeader = (header: string) => 
      header.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');

    return data.map(row => {
      const newRow: any = {};
      const rowKeys = Object.keys(row);

      for (const inputKey of rowKeys) {
        const normalizedInputKey = normalizeHeader(inputKey);
        const value = row[inputKey];

        if (normalizedInputKey.includes('opme') || normalizedInputKey.includes('nome')) {
          newRow.opme = value;
        } else if (normalizedInputKey.includes('lote')) {
          newRow.lote = value;
        } else if (normalizedInputKey.includes('validade')) {
          newRow.validade = value;
        } else if (normalizedInputKey.includes('referencia')) {
          newRow.referencia = value;
        } else if (normalizedInputKey.includes('anvisa')) {
          newRow.anvisa = value;
        } else if (normalizedInputKey.includes('tuss')) {
          newRow.tuss = value;
        } else if (normalizedInputKey.includes('codsimpro') || normalizedInputKey.includes('simpro')) {
          newRow.cod_simpro = value;
        } else if (normalizedInputKey.includes('codigobarras') || normalizedInputKey.includes('barcode')) {
          newRow.codigo_barras = value;
        }
      }
      return newRow;
    });
  };

  const processAndUploadData = async (data: any[]) => {
    if (!userId) return;
    
    const normalizedData = normalizeDataKeys(data);

    const validOpmes = normalizedData.filter(row => row.opme);
    if (validOpmes.length !== normalizedData.length) {
      toast.warning(`${normalizedData.length - validOpmes.length} linhas foram ignoradas por não terem o nome do OPME.`);
    }

    const allOpmes = validOpmes.map((row: any) => ({
      opme: row.opme,
      lote: row.lote || null,
      validade: row.validade || null,
      referencia: row.referencia || null,
      anvisa: row.anvisa || null,
      tuss: row.tuss || null,
      cod_simpro: row.cod_simpro || null,
      codigo_barras: row.codigo_barras || null,
      user_id: userId,
    }));

    const opmesToUpsert = allOpmes.filter(opme => opme.codigo_barras);
    const opmesToInsert = allOpmes.filter(opme => !opme.codigo_barras);

    if (opmesToUpsert.length === 0 && opmesToInsert.length === 0) {
      toast.error("Nenhum OPME válido para importar.");
      setLoadingFileUpload(false);
      return;
    }

    try {
      const promises = [];
      if (opmesToUpsert.length > 0) {
        promises.push(supabase.from("opme_inventory").upsert(opmesToUpsert, { onConflict: 'codigo_barras, user_id' }));
      }
      if (opmesToInsert.length > 0) {
        promises.push(supabase.from("opme_inventory").insert(opmesToInsert));
      }

      const results = await Promise.all(promises);
      const hasError = results.some(res => res.error);

      if (hasError) {
        const errorMessages = results.map(res => res.error?.message).filter(Boolean).join('; ');
        throw new Error(errorMessages);
      }

      toast.success(`${allOpmes.length} OPMEs importados/atualizados com sucesso!`);
      fetchOpmeInventory();
    } catch (error: any) {
      toast.error(`Falha no upload: ${error.message}`);
    } finally {
      setLoadingFileUpload(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || !userId) return;
    setLoadingFileUpload(true);
    const file = event.target.files[0];
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    const reader = new FileReader();

    if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      reader.readAsArrayBuffer(file);
      reader.onload = (e) => {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet);
        processAndUploadData(json);
      };
    } else if (fileExtension === 'csv') {
      reader.readAsText(file);
      reader.onload = (e) => {
        Papa.parse(e.target?.result as string, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => processAndUploadData(results.data),
          error: (error) => {
            toast.error(`Erro ao processar CSV: ${error.message}`);
            setLoadingFileUpload(false);
          },
        });
      };
    } else {
      toast.error("Formato de arquivo não suportado. Use .xlsx, .xls ou .csv");
      setLoadingFileUpload(false);
    }
  };

  const handleAddOpme = async () => {
    if (!userId || !newOpme.opme) {
      toast.error("Nome do OPME é obrigatório.");
      return;
    }
    setLoadingAddManual(true);
    const { error } = await supabase.from("opme_inventory").insert({ ...newOpme, user_id: userId });
    if (error) toast.error(`Falha ao adicionar OPME: ${error.message}`);
    else {
      toast.success("OPME adicionado com sucesso.");
      setNewOpme({ opme: "", lote: "", validade: "", referencia: "", anvisa: "", tuss: "", cod_simpro: "", codigo_barras: "" });
      setIsAddOpmeDialogOpen(false);
      fetchOpmeInventory();
    }
    setLoadingAddManual(false);
  };

  const handleEditOpme = (opme: OpmeItem) => {
    setEditingOpme(opme);
    setIsEditOpmeDialogOpen(true);
  };

  const handleUpdateOpme = async () => {
    if (!editingOpme || !editingOpme.opme) {
      toast.error("O nome do OPME não pode ficar em branco.");
      return;
    }
    setLoadingUpdate(true);
    const { error } = await supabase
      .from("opme_inventory")
      .update({
        opme: editingOpme.opme,
        lote: editingOpme.lote,
        validade: editingOpme.validade,
        referencia: editingOpme.referencia,
        anvisa: editingOpme.anvisa,
        tuss: editingOpme.tuss,
        cod_simpro: editingOpme.cod_simpro,
        codigo_barras: editingOpme.codigo_barras,
      })
      .eq("id", editingOpme.id);

    if (error) {
      toast.error(`Falha ao atualizar OPME: ${error.message}`);
    } else {
      toast.success("OPME atualizado com sucesso.");
      setIsEditOpmeDialogOpen(false);
      setEditingOpme(null);
      fetchOpmeInventory();
    }
    setLoadingUpdate(false);
  };

  const handleAddRule = async () => {
    if (!userId || !newRule.opme_barcode || !newRule.convenio_name) {
      toast.error("Selecione um OPME e digite o nome do convênio.");
      return;
    }
    if (newRule.type === 'BILLING_ALERT' && !newRule.message) {
      toast.error("A mensagem é obrigatória para Alertas de Faturamento.");
      return;
    }
    if (newRule.type === 'SUGGEST_REPLACEMENT' && !newRule.replacement_opme_barcode) {
      toast.error("É obrigatório selecionar um OPME substituto.");
      return;
    }
    setSubmittingRestriction(true);
    const { error } = await supabase.from("opme_restrictions").insert({
      user_id: userId,
      opme_barcode: newRule.opme_barcode,
      convenio_name: newRule.convenio_name.trim(),
      rule_type: newRule.type,
      message: newRule.type === 'BILLING_ALERT' ? newRule.message : null,
      replacement_opme_barcode: newRule.type === 'SUGGEST_REPLACEMENT' ? newRule.replacement_opme_barcode : null,
    });
    if (error) {
      if (error.code === '23505') toast.error("Esta regra já existe.");
      else toast.error(`Falha ao adicionar regra: ${error.message}`);
    } else {
      toast.success("Regra adicionada com sucesso.");
      setNewRule({ opme_barcode: "", convenio_name: "", type: "BLOCK", message: "", replacement_opme_barcode: "" });
      fetchRestrictions();
    }
    setSubmittingRestriction(false);
  };

  const handleDeleteRestriction = async (restrictionId: string) => {
    const { error } = await supabase.from("opme_restrictions").delete().eq("id", restrictionId);
    if (error) toast.error(`Falha ao remover regra: ${error.message}`);
    else {
      toast.success("Regra removida.");
      fetchRestrictions();
    }
  };

  const getOpmeNameByBarcode = (barcode: string) => opmeInventory.find(item => item.codigo_barras === barcode)?.opme || "OPME Desconhecido";

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <h1 className="text-4xl font-extrabold text-center text-foreground mb-8">Cadastro e Inventário de OPME</h1>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-2xl font-semibold"><Package className="h-6 w-6 text-primary" /> Gerenciamento de Inventário</CardTitle>
          <CardDescription>Adicione OPMEs individualmente, em massa via arquivo Excel ou CSV, ou visualize seu inventário atual.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 border rounded-lg bg-muted/50 flex flex-col items-center justify-center text-center">
              <h3 className="font-semibold text-lg mb-2">Importar Inventário (Excel/CSV)</h3>
              <p className="text-sm text-muted-foreground mb-4">O arquivo deve conter a coluna "opme". Outras colunas como "codigo_barras" são opcionais na importação.</p>
              <div className="flex gap-2">
                <Button asChild variant="outline">
                  <Label htmlFor="file-upload" className="cursor-pointer">
                    {loadingFileUpload ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                    {loadingFileUpload ? "Processando..." : "Selecionar Arquivo"}
                  </Label>
                </Button>
                <Button asChild variant="secondary">
                  <a href="/exemplo-opme.xlsx" download>
                    <Download className="h-4 w-4 mr-2" /> Baixar Exemplo
                  </a>
                </Button>
              </div>
              <Input id="file-upload" type="file" accept=".csv, .xlsx, .xls, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" className="hidden" onChange={handleFileUpload} disabled={loadingFileUpload} />
            </div>
            <div className="p-4 border rounded-lg bg-muted/50 flex flex-col items-center justify-center text-center">
              <h3 className="font-semibold text-lg mb-2">Adicionar Manualmente</h3>
              <p className="text-sm text-muted-foreground mb-4">Cadastre um novo item OPME preenchendo seus detalhes individualmente.</p>
              <Dialog open={isAddOpmeDialogOpen} onOpenChange={setIsAddOpmeDialogOpen}>
                <DialogTrigger asChild><Button><PlusCircle className="h-4 w-4 mr-2" /> Adicionar OPME</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Adicionar Novo OPME</DialogTitle></DialogHeader>
                  <div className="grid gap-4 py-4">
                    {Object.keys(newOpme).map(key => <div key={key}><Label htmlFor={key}>{key.replace('_', ' ')}</Label><Input id={key} value={newOpme[key as keyof typeof newOpme] || ''} onChange={e => setNewOpme(prev => ({ ...prev, [key]: e.target.value }))} /></div>)}
                  </div>
                  <DialogFooter><Button onClick={handleAddOpme} disabled={loadingAddManual}>{loadingAddManual && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Salvar</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          <div>
            <h3 className="text-xl font-semibold mb-4">Inventário Atual</h3>
            {loadingInventory ? <div className="flex items-center justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : 
            <ScrollArea className="h-[300px] w-full rounded-md border">
              <Table>
                <TableHeader><TableRow><TableHead>OPME</TableHead><TableHead>Cód. Barras</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
                <TableBody>
                  {opmeInventory.map(item => (
                    <TableRow key={item.id} className={cn(!item.codigo_barras && "bg-yellow-100/50 dark:bg-yellow-900/20")}>
                      <TableCell className="font-medium">{item.opme}</TableCell>
                      <TableCell className="flex items-center gap-2">
                        {!item.codigo_barras && <AlertTriangle className="h-4 w-4 text-yellow-500" />}
                        {item.codigo_barras || <span className="text-muted-foreground italic">Pendente</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleEditOpme(item)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>}
          </div>
        </CardContent>
      </Card>

      {/* Edit OPME Dialog */}
      <Dialog open={isEditOpmeDialogOpen} onOpenChange={setIsEditOpmeDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar OPME</DialogTitle></DialogHeader>
          {editingOpme && (
            <div className="grid gap-4 py-4">
              {Object.keys(editingOpme).filter(k => k !== 'id').map(key => (
                <div key={key}>
                  <Label htmlFor={`edit-${key}`}>{key.replace('_', ' ')}</Label>
                  <Input id={`edit-${key}`} value={editingOpme[key as keyof typeof editingOpme] || ''} onChange={e => setEditingOpme(prev => prev ? { ...prev, [key]: e.target.value } : null)} />
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button onClick={handleUpdateOpme} disabled={loadingUpdate}>
              {loadingUpdate && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-2xl font-semibold"><ShieldX className="h-6 w-6 text-destructive" /> Parametrização de Convênios</CardTitle>
          <CardDescription>Crie regras para bloquear, permitir ou alertar sobre o uso de OPMEs específicos com determinados convênios.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-4 border rounded-lg bg-muted/50 space-y-4">
            <h3 className="font-semibold text-lg">Adicionar Nova Regra</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
              <div className="space-y-2"><Label>Tipo de Regra</Label><Select value={newRule.type} onValueChange={(v) => setNewRule(p => ({ ...p, type: v as any }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(ruleTypes).map(([key, { label }]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Selecione o OPME</Label><Select value={newRule.opme_barcode} onValueChange={(v) => setNewRule(p => ({ ...p, opme_barcode: v }))}><SelectTrigger><SelectValue placeholder="Escolha um OPME..." /></SelectTrigger><SelectContent><ScrollArea className="h-[200px]">{opmeInventory.filter(item => item.codigo_barras).map(item => <SelectItem key={item.id} value={item.codigo_barras!}>{item.opme}</SelectItem>)}</ScrollArea></SelectContent></Select></div>
              <div className="space-y-2"><Label>Nome do Convênio (Exato)</Label><Input placeholder="Ex: Unimed" value={newRule.convenio_name} onChange={(e) => setNewRule(p => ({ ...p, convenio_name: e.target.value }))} /></div>
              <Button onClick={handleAddRule} disabled={submittingRestriction}>{submittingRestriction ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />} Adicionar</Button>
            </div>
            {newRule.type === 'BILLING_ALERT' && <div className="space-y-2 pt-2"><Label>Mensagem do Alerta</Label><Textarea placeholder="Ex: Lançar este item aumenta o faturamento." value={newRule.message} onChange={(e) => setNewRule(p => ({ ...p, message: e.target.value }))} /></div>}
            {newRule.type === 'SUGGEST_REPLACEMENT' && <div className="space-y-2 pt-2"><Label>Selecione o OPME Substituto</Label><Select value={newRule.replacement_opme_barcode} onValueChange={(v) => setNewRule(p => ({ ...p, replacement_opme_barcode: v }))}><SelectTrigger><SelectValue placeholder="Escolha o OPME substituto..." /></SelectTrigger><SelectContent><ScrollArea className="h-[200px]">{opmeInventory.filter(item => item.codigo_barras).map(item => <SelectItem key={item.id} value={item.codigo_barras!}>{item.opme}</SelectItem>)}</ScrollArea></SelectContent></Select></div>}
          </div>
          <div>
            <h3 className="text-xl font-semibold mb-4">Regras Ativas</h3>
            {loadingRestrictions ? <div className="flex items-center justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : restrictions.length > 0 ? <ScrollArea className="h-[250px] w-full rounded-md border"><Table><TableHeader><TableRow><TableHead>OPME</TableHead><TableHead>Convênio</TableHead><TableHead>Tipo de Regra</TableHead><TableHead>Detalhe</TableHead><TableHead className="text-right">Ação</TableHead></TableRow></TableHeader><TableBody>{restrictions.map(rule => <TableRow key={rule.id}><TableCell className="font-medium">{getOpmeNameByBarcode(rule.opme_barcode)}</TableCell><TableCell>{rule.convenio_name}</TableCell><TableCell><div className="flex items-center gap-2">{React.createElement(ruleTypes[rule.rule_type].icon, { className: "h-4 w-4" })} {ruleTypes[rule.rule_type].label}</div></TableCell><TableCell className="text-sm text-muted-foreground">{rule.message || (rule.replacement_opme_barcode ? `Substituir por: ${getOpmeNameByBarcode(rule.replacement_opme_barcode)}` : "N/A")}</TableCell><TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => handleDeleteRestriction(rule.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell></TableRow>)}</TableBody></Table></ScrollArea> : <p className="text-muted-foreground text-center py-4">Nenhuma regra foi criada ainda.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default OpmeRegistration;