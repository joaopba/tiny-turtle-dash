"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Upload, Package, PlusCircle, Loader2, ShieldX, Trash2, Info, CheckCircle, Download, Shuffle } from "lucide-react";
import { toast } from "sonner";
import Papa from "papaparse";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface OpmeItem {
  id: string; opme: string; lote: string; validade: string; referencia: string; anvisa: string; tuss: string; cod_simpro: string; codigo_barras: string;
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
  const [loadingInventory, setLoadingInventory] = useState(true);
  const [loadingRestrictions, setLoadingRestrictions] = useState(true);
  const [loadingFileUpload, setLoadingFileUpload] = useState(false);
  const [loadingAddManual, setLoadingAddManual] = useState(false);
  const [submittingRestriction, setSubmittingRestriction] = useState(false);

  const [newOpme, setNewOpme] = useState<Omit<OpmeItem, 'id'>>({ opme: "", lote: "", validade: "", referencia: "", anvisa: "", tuss: "", cod_simpro: "", codigo_barras: "" });
  const [newRule, setNewRule] = useState<{ opme_barcode: string; convenio_name: string; type: keyof typeof ruleTypes; message: string; replacement_opme_barcode: string }>({ opme_barcode: "", convenio_name: "", type: "BLOCK", message: "", replacement_opme_barcode: "" });

  const fetchOpmeInventory = useCallback(async () => {
    if (!userId) { setLoadingInventory(false); return; }
    setLoadingInventory(true);
    const { data, error } = await supabase.from("opme_inventory").select("*").eq("user_id", userId).order("opme", { ascending: true });
    if (error) toast.error("Falha ao carregar inventário OPME.");
    else setOpmeInventory(data as OpmeItem[]);
    setLoadingInventory(false);
  }, [userId]);

  const fetchRestrictions = useCallback(async () => {
    if (!userId) { setLoadingRestrictions(false); return; }
    setLoadingRestrictions(true);
    const { data, error } = await supabase.from("opme_restrictions").select("*").eq("user_id", userId);
    if (error) toast.error("Falha ao carregar restrições.");
    else setRestrictions(data as OpmeRestriction[]);
    setLoadingRestrictions(false);
  }, [userId]);

  useEffect(() => {
    fetchOpmeInventory();
    fetchRestrictions();
  }, [fetchOpmeInventory, fetchRestrictions]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || !userId) return;
    setLoadingFileUpload(true);
    Papa.parse(event.target.files[0], {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const opmesToInsert = results.data.map((row: any) => ({ ...row, user_id: userId }));
        const { error } = await supabase.from("opme_inventory").upsert(opmesToInsert, { onConflict: 'codigo_barras, user_id' });
        if (error) toast.error(`Falha no upload: ${error.message}`);
        else {
          toast.success(`${opmesToInsert.length} OPMEs importados/atualizados com sucesso!`);
          fetchOpmeInventory();
        }
        setLoadingFileUpload(false);
      },
      error: (error) => {
        toast.error(`Erro ao processar arquivo: ${error.message}`);
        setLoadingFileUpload(false);
      },
    });
  };

  const handleAddOpme = async () => {
    if (!userId || !newOpme.opme || !newOpme.codigo_barras) {
      toast.error("Nome do OPME e Código de Barras são obrigatórios.");
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
          <CardDescription>Adicione OPMEs individualmente, em massa via arquivo CSV, ou visualize seu inventário atual.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 border rounded-lg bg-muted/50 flex flex-col items-center justify-center text-center">
              <h3 className="font-semibold text-lg mb-2">Importar Inventário (CSV)</h3>
              <p className="text-sm text-muted-foreground mb-4">O arquivo deve conter as colunas: opme, lote, validade, referencia, anvisa, tuss, cod_simpro, codigo_barras.</p>
              <div className="flex gap-2">
                <Button asChild variant="outline">
                  <Label htmlFor="csv-upload" className="cursor-pointer">
                    {loadingFileUpload ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                    {loadingFileUpload ? "Processando..." : "Selecionar Arquivo"}
                  </Label>
                </Button>
                <Button asChild variant="secondary">
                  <a href="/exemplo-opme.csv" download>
                    <Download className="h-4 w-4 mr-2" /> Baixar Exemplo
                  </a>
                </Button>
              </div>
              <Input id="csv-upload" type="file" accept=".csv" className="hidden" onChange={handleFileUpload} disabled={loadingFileUpload} />
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
                <TableHeader><TableRow><TableHead>OPME</TableHead><TableHead>Lote</TableHead><TableHead>Validade</TableHead><TableHead>Cód. Barras</TableHead></TableRow></TableHeader>
                <TableBody>
                  {opmeInventory.map(item => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.opme}</TableCell>
                      <TableCell>{item.lote}</TableCell>
                      <TableCell>{item.validade}</TableCell>
                      <TableCell>{item.codigo_barras}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>}
          </div>
        </CardContent>
      </Card>

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
              <div className="space-y-2"><Label>Selecione o OPME</Label><Select value={newRule.opme_barcode} onValueChange={(v) => setNewRule(p => ({ ...p, opme_barcode: v }))}><SelectTrigger><SelectValue placeholder="Escolha um OPME..." /></SelectTrigger><SelectContent><ScrollArea className="h-[200px]">{opmeInventory.map(item => <SelectItem key={item.id} value={item.codigo_barras}>{item.opme}</SelectItem>)}</ScrollArea></SelectContent></Select></div>
              <div className="space-y-2"><Label>Nome do Convênio (Exato)</Label><Input placeholder="Ex: Unimed" value={newRule.convenio_name} onChange={(e) => setNewRule(p => ({ ...p, convenio_name: e.target.value }))} /></div>
              <Button onClick={handleAddRule} disabled={submittingRestriction}>{submittingRestriction ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />} Adicionar</Button>
            </div>
            {newRule.type === 'BILLING_ALERT' && <div className="space-y-2 pt-2"><Label>Mensagem do Alerta</Label><Textarea placeholder="Ex: Lançar este item aumenta o faturamento." value={newRule.message} onChange={(e) => setNewRule(p => ({ ...p, message: e.target.value }))} /></div>}
            {newRule.type === 'SUGGEST_REPLACEMENT' && <div className="space-y-2 pt-2"><Label>Selecione o OPME Substituto</Label><Select value={newRule.replacement_opme_barcode} onValueChange={(v) => setNewRule(p => ({ ...p, replacement_opme_barcode: v }))}><SelectTrigger><SelectValue placeholder="Escolha o OPME substituto..." /></SelectTrigger><SelectContent><ScrollArea className="h-[200px]">{opmeInventory.map(item => <SelectItem key={item.id} value={item.codigo_barras}>{item.opme}</SelectItem>)}</ScrollArea></SelectContent></Select></div>}
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