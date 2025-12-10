"use client";

import React, { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Scan, Loader2, XCircle, Users, ShieldAlert, Info, Shuffle, Camera, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import CameraScanner from "./CameraScanner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useSession } from "./SessionContextProvider";
import { sendWhatsappNotification } from "@/lib/whatsapp";

interface OpmeItem { id: string; opme: string; codigo_barras: string; lote: string | null; validade: string | null; referencia: string | null; anvisa: string | null; tuss: string | null; cod_simpro: string | null; }
interface CpsRecord { CPS: number; PATIENT: string; AGREEMENT: string; }
interface OpmeRestriction { opme_barcode: string; convenio_name: string; rule_type: 'BLOCK' | 'BILLING_ALERT' | 'EXCLUSIVE_ALLOW' | 'SUGGEST_REPLACEMENT'; message: string | null; replacement_opme_barcode?: string | null; }
interface LinkedOpme { id: string; user_id: string; opme_barcode: string; linked_at: string; quantity: number; opmeDetails?: OpmeItem; }

interface OpmeScanModalProps {
  isOpen: boolean; onClose: () => void; selectedCps: CpsRecord | null; opmeInventory: OpmeItem[];
  restrictions: OpmeRestriction[]; onScanSuccess: () => void; onChangeCps: () => void; linkedOpme: LinkedOpme[];
}

interface AlertInfo {
  type: 'BLOCK' | 'EXCLUSIVE_ALLOW' | 'SUGGEST_REPLACEMENT';
  title: string;
  description: string;
  icon: React.ReactNode;
  originalOpme?: OpmeItem;
  replacementOpme?: OpmeItem;
}

// Normaliza códigos removendo zeros à esquerda
const normalizeBarcode = (code: string): string => {
  if (!code) return "";
  return code.replace(/^0+/, "") || "0";
};

const OpmeScanModal: React.FC<OpmeScanModalProps> = ({
  isOpen, onClose, selectedCps, opmeInventory, restrictions, onScanSuccess, onChangeCps, linkedOpme
}) => {
  const { user, profile } = useSession();
  const [barcodeInput, setBarcodeInput] = useState<string>("");
  const [loadingScan, setLoadingScan] = useState(false);
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState(false);
  const [alertInfo, setAlertInfo] = useState<AlertInfo | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isOpen) {
      setBarcodeInput("");
      const timer = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const notifyWhatsapp = (opmeDetails: OpmeItem, quantity: number = 1) => {
    if (!selectedCps) return;
    const timestamp = new Date().toLocaleString("pt-BR");
    
    void sendWhatsappNotification({
      opmeName: opmeDetails.opme,
      opmeBarcode: opmeDetails.codigo_barras,
      patientName: selectedCps.PATIENT,
      cpsId: selectedCps.CPS,
      convenioName: selectedCps.AGREEMENT,
      quantity: quantity,
      timestamp,
      lote: opmeDetails.lote,
      validade: opmeDetails.validade,
      referencia: opmeDetails.referencia,
      anvisa: opmeDetails.anvisa,
      tuss: opmeDetails.tuss,
      cod_simpro: opmeDetails.cod_simpro,
    }).catch((error) => {
      console.error("Falha ao enviar notificação via WhatsApp:", error);
      toast.error("Não foi possível enviar o alerta via WhatsApp. Verifique o console para detalhes.");
    });
  };

  const linkOpme = async (barcodeToLink: string) => {
    if (!selectedCps || !user) return;

    const normalizedBarcodeToLink = normalizeBarcode(barcodeToLink);

    try {
      const { data: existingLink, error: selectError } = await supabase
        .from("linked_opme")
        .select("id, quantity")
        .eq("user_id", user.id)
        .eq("cps_id", selectedCps.CPS)
        .eq("opme_barcode", normalizedBarcodeToLink)
        .single();

      if (selectError && selectError.code !== "PGRST116") throw selectError;

      let newQuantity;
      if (existingLink) {
        newQuantity = existingLink.quantity + 1;
        const { error: updateError } = await supabase
          .from("linked_opme")
          .update({ quantity: newQuantity })
          .eq("id", existingLink.id);

        if (updateError) throw updateError;
      } else {
        newQuantity = 1;
        const { error: insertError } = await supabase.from("linked_opme").insert({
          user_id: user.id,
          cps_id: selectedCps.CPS,
          opme_barcode: normalizedBarcodeToLink,
          quantity: newQuantity,
        });
        if (insertError) throw insertError;
      }

      // CHAMA A FUNÇÃO DE SUCESSO AQUI PARA ATUALIZAR A LISTA
      onScanSuccess();
      
      return newQuantity; // Retorna a nova quantidade
    } catch (error: any) {
      toast.error(`Erro ao bipar OPME: ${error.message}`);
      throw error;
    }
  };

  const handleDeleteLinkedOpme = async (linkedOpmeId: string) => {
    const { error } = await supabase.from("linked_opme").delete().eq("id", linkedOpmeId);
    if (error) {
      toast.error(`Falha ao excluir bipagem: ${error.message}`);
    } else {
      toast.success("Bipagem excluída com sucesso.");
      onScanSuccess();
    }
  };

  const handleBarcodeScan = async (codeToScan: string) => {
    if (!selectedCps || !codeToScan || !user) {
      toast.error("CPS, código de barras e login são necessários.");
      return;
    }
    setLoadingScan(true);

    const normalizedScannedCode = normalizeBarcode(codeToScan);

    const opmeDetails = opmeInventory.find((item) =>
      item.codigo_barras && normalizeBarcode(item.codigo_barras) === normalizedScannedCode,
    );

    if (!opmeDetails) {
      toast.error("Código de barras não encontrado no seu inventário OPME.", { duration: 5000 });
      setLoadingScan(false);
      setBarcodeInput("");
      inputRef.current?.focus();
      return;
    }

    const opmeBarcodeToUse = opmeDetails.codigo_barras;
    const patientConvenio = selectedCps.AGREEMENT?.trim().toLowerCase() || "";

    const blockRule = restrictions.find(
      (r) =>
        r.rule_type === "BLOCK" &&
        r.opme_barcode === opmeBarcodeToUse &&
        r.convenio_name.toLowerCase() === patientConvenio,
    );
    if (blockRule) {
      setAlertInfo({
        type: "BLOCK",
        title: "OPME Bloqueado",
        description: `Este item não é permitido para o convênio "${selectedCps.AGREEMENT}". A bipagem foi cancelada.`,
        icon: <ShieldAlert className="h-10 w-10 text-destructive" />,
      });
      setLoadingScan(false);
      setBarcodeInput("");
      return;
    }

    const exclusiveRulesForConvenio = restrictions.filter(
      (r) => r.rule_type === "EXCLUSIVE_ALLOW" && r.convenio_name.toLowerCase() === patientConvenio,
    );
    if (exclusiveRulesForConvenio.length > 0) {
      const isAllowed = exclusiveRulesForConvenio.some((r) => r.opme_barcode === opmeBarcodeToUse);
      if (!isAllowed) {
        setAlertInfo({
          type: "EXCLUSIVE_ALLOW",
          title: "Permissão Negada",
          description: `Apenas OPMEs específicos são permitidos para o convênio "${selectedCps.AGREEMENT}". Este item não está na lista de permissões.`,
          icon: <ShieldAlert className="h-10 w-10 text-destructive" />,
        });
        setLoadingScan(false);
        setBarcodeInput("");
        return;
      }
    }

    const suggestionRule = restrictions.find(
      (r) =>
        r.rule_type === "SUGGEST_REPLACEMENT" &&
        r.opme_barcode === opmeBarcodeToUse &&
        r.convenio_name.toLowerCase() === patientConvenio,
    );
    if (suggestionRule && suggestionRule.replacement_opme_barcode) {
      const replacementOpmeDetails = opmeInventory.find(
        (item) => item.codigo_barras === suggestionRule.replacement_opme_barcode,
      );
      if (replacementOpmeDetails) {
        setAlertInfo({
          type: "SUGGEST_REPLACEMENT",
          title: "Substituição Sugerida",
          description: `Para este convênio, sugere-se usar "${replacementOpmeDetails.opme}" no lugar de "${opmeDetails.opme}". O que você gostaria de fazer?`,
          icon: <Shuffle className="h-10 w-10 text-blue-500" />,
          originalOpme: opmeDetails,
          replacementOpme: replacementOpmeDetails,
        });
        setLoadingScan(false);
        setBarcodeInput("");
        return;
      }
    }

    const alertRule = restrictions.find(
      (r) =>
        r.rule_type === "BILLING_ALERT" &&
        r.opme_barcode === opmeBarcodeToUse &&
        r.convenio_name.toLowerCase() === patientConvenio,
    );
    if (alertRule && alertRule.message) {
      toast.info("Alerta de Faturamento", {
        description: alertRule.message,
        icon: <Info className="h-5 w-5 text-blue-500" />,
        duration: 5000,
      });
    }

    try {
      const newQuantity = await linkOpme(opmeBarcodeToUse);
      notifyWhatsapp(opmeDetails, newQuantity);
    } finally {
      setLoadingScan(false);
      setBarcodeInput("");
      inputRef.current?.focus();
    }
  };

  const handleCameraScanSuccess = (decodedText: string) => {
    toast.success(`Código escaneado: ${decodedText}`);
    setIsCameraScannerOpen(false);
    handleBarcodeScan(decodedText);
  };

  const handleCloseAlert = () => {
    setAlertInfo(null);
    inputRef.current?.focus();
  };

  const handleSuggestionChoice = async (useSuggestion: boolean) => {
    if (!alertInfo) return;
    const chosenOpme = useSuggestion ? alertInfo.replacementOpme : alertInfo.originalOpme;
    if (!chosenOpme) return;

    try {
      const newQuantity = await linkOpme(chosenOpme.codigo_barras);
      if (useSuggestion) {
        toast.success(`"${chosenOpme.opme}" bipado com sucesso!`);
      } else {
        toast.info(`Continuando com "${chosenOpme.opme}".`);
      }
      notifyWhatsapp(chosenOpme, newQuantity);
    } catch (error: any) {
      toast.error(`Erro ao bipar OPME: ${error.message}`);
    } finally {
      handleCloseAlert();
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Bipagem de OPME para: {selectedCps?.PATIENT}</DialogTitle>
          </DialogHeader>
          <div className="grid md:grid-cols-2 gap-6 pt-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="barcode-input">Bipar Código de Barras</Label>
                <div className="flex items-center space-x-2">
                  <Input
                    ref={inputRef}
                    id="barcode-input"
                    placeholder="Aguardando bipagem..."
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleBarcodeScan(barcodeInput)}
                    disabled={loadingScan}
                  />
                  {isMobile ? (
                    <Sheet open={isCameraScannerOpen} onOpenChange={setIsCameraScannerOpen}>
                      <SheetTrigger asChild>
                        <Button variant="outline" size="icon">
                          <Camera className="h-4 w-4" />
                        </Button>
                      </SheetTrigger>
                      <SheetContent side="bottom">
                        <SheetHeader>
                          <SheetTitle>Aponte para o Código de Barras</SheetTitle>
                        </SheetHeader>
                        <div className="py-4">
                          <CameraScanner onScanSuccess={handleCameraScanSuccess} onClose={() => setIsCameraScannerOpen(false)} />
                        </div>
                      </SheetContent>
                    </Sheet>
                  ) : (
                    <Button onClick={() => handleBarcodeScan(barcodeInput)} disabled={loadingScan}>
                      {loadingScan ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scan className="h-4 w-4" />}
                    </Button>
                  )}
                </div>
              </div>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Informações do Paciente</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                  <p><strong>CPS:</strong> {selectedCps?.CPS}</p>
                  <p><strong>Convênio:</strong> {selectedCps?.AGREEMENT}</p>
                </CardContent>
              </Card>
            </div>
            <div className="space-y-2">
              <Label>OPMEs Bipados para este Paciente</Label>
              <ScrollArea className="h-48 w-full rounded-md border p-2">
                {linkedOpme.length > 0 ? linkedOpme.map((item) => {
                  const isGestor = profile?.role === 'GESTOR';
                  const isOwner = item.user_id === user?.id;
                  const linkedAtDate = new Date(item.linked_at);
                  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
                  const isWithinOneHour = linkedAtDate > oneHourAgo;
                  const canDelete = isGestor || (isOwner && isWithinOneHour);

                  return (
                    <div key={item.id} className="flex justify-between items-center p-2 rounded hover:bg-muted">
                      <span className="text-sm font-medium">{item.opmeDetails?.opme || item.opme_barcode}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold bg-primary text-primary-foreground rounded-full px-2 py-0.5">{item.quantity}x</span>
                        {canDelete && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                                <AlertDialogDescription>Tem certeza de que deseja excluir esta bipagem?</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteLinkedOpme(item.id)} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">{new Date(item.linked_at).toLocaleTimeString('pt-BR')}</span>
                    </div>
                  );
                }) : (
                  <p className="text-sm text-muted-foreground text-center pt-4">Nenhum item bipado ainda.</p>
                )}
              </ScrollArea>
            </div>
          </div>
          <DialogFooter className="pt-4">
            <Button variant="outline" onClick={onChangeCps}><Users className="mr-2 h-4 w-4" /> Trocar Paciente</Button>
            <Button onClick={onClose}><XCircle className="mr-2 h-4 w-4" /> Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!alertInfo} onOpenChange={(isOpen) => !isOpen && handleCloseAlert()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex flex-col items-center text-center">
              {alertInfo?.icon}
              <AlertDialogTitle className="mt-4 text-2xl">{alertInfo?.title}</AlertDialogTitle>
              <AlertDialogDescription className="mt-2">{alertInfo?.description}</AlertDialogDescription>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {alertInfo?.type === "SUGGEST_REPLACEMENT" ? (
              <>
                <AlertDialogCancel onClick={() => handleSuggestionChoice(false)}>Usar Original</AlertDialogCancel>
                <AlertDialogAction onClick={() => handleSuggestionChoice(true)}>Usar Sugestão</AlertDialogAction>
              </>
            ) : (
              <AlertDialogAction onClick={handleCloseAlert}>Entendido</AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default OpmeScanModal;