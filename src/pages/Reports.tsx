"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/SessionContextProvider';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import { Calendar as CalendarIcon, Download, FileText, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Papa from 'papaparse';

interface ReportData {
  linked_at: string;
  cps_id: number;
  patient_name: string;
  opme_name: string;
  opme_barcode: string;
  lote: string;
  validade: string;
  referencia: string;
  anvisa: string;
  quantity: number;
}

const Reports = () => {
  const { user } = useSession();
  const [date, setDate] = useState<DateRange | undefined>();
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<ReportData[]>([]);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);

  useEffect(() => {
    const convertImageToBase64 = async (url: string) => {
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          setLogoBase64(reader.result as string);
        };
        reader.readAsDataURL(blob);
      } catch (error) {
        console.error("Erro ao carregar o logo para o PDF:", error);
        toast.warning("Não foi possível carregar o logo no PDF. O relatório será gerado sem ele.");
      }
    };
    // Usando o proxy para evitar erros de CORS
    convertImageToBase64('/logo-proxy/wp-content/themes/ra-v1/images/logo/logo-grupora-endoscopia.png');
  }, []);

  const handleGenerateReport = useCallback(async () => {
    if (!user?.id) {
      toast.error("Você precisa estar logado para gerar relatórios.");
      return;
    }
    if (!date?.from || !date?.to) {
      toast.error("Por favor, selecione um período de início e fim.");
      return;
    }

    setLoading(true);
    setReportData([]);

    // CORREÇÃO: Ajustar as datas para cobrir o dia inteiro
    const startDate = new Date(date.from);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(date.to);
    endDate.setHours(23, 59, 59, 999);

    try {
      const { data, error } = await supabase.rpc('get_opme_report_data', {
        user_uuid: user.id,
        start_date_param: startDate.toISOString(),
        end_date_param: endDate.toISOString(),
      });

      if (error) throw error;

      setReportData(data);
      if (data.length === 0) {
        toast.info("Nenhum dado encontrado para o período selecionado.");
      } else {
        toast.success(`${data.length} registros encontrados.`);
      }
    } catch (error: any) {
      toast.error(`Falha ao gerar relatório: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [user?.id, date]);

  const handleExportCSV = () => {
    if (reportData.length === 0) {
      toast.warning("Não há dados para exportar. Gere um relatório primeiro.");
      return;
    }
    const csv = Papa.unparse(reportData);
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio_opme_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    if (reportData.length === 0) {
      toast.warning("Não há dados para exportar. Gere um relatório primeiro.");
      return;
    }
    const doc = new jsPDF({ orientation: 'landscape' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;

    const reportPeriod = `Período: ${date?.from ? format(date.from, "dd/MM/yyyy") : ''} a ${date?.to ? format(date.to, "dd/MM/yyyy") : ''}`;
    const generationDate = `Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`;

    autoTable(doc, {
      head: [['Data', 'CPS', 'Paciente', 'OPME', 'Cód. Barras', 'Lote', 'Validade', 'Qtd']],
      body: reportData.map(item => [
        item.linked_at,
        item.cps_id,
        item.patient_name,
        item.opme_name,
        item.opme_barcode,
        item.lote || 'N/A',
        item.validade || 'N/A',
        item.quantity,
      ]),
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [22, 163, 74], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      didDrawPage: (data) => {
        // Header
        if (logoBase64) {
          doc.addImage(logoBase64, 'PNG', margin, 10, 40, 10);
        }
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text("Relatório de Bipagem de OPME", pageWidth / 2, 15, { align: 'center' });
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(reportPeriod, pageWidth - margin, 15, { align: 'right' });
        doc.text(generationDate, pageWidth - margin, 20, { align: 'right' });
      },
      margin: { top: 30 },
    });

    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Página ${i} de ${pageCount}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
    }

    doc.save(`relatorio_opme_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  return (
    <div className="space-y-8">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-2xl font-semibold">
            <FileText className="h-6 w-6 text-primary" />
            Gerador de Relatórios
          </CardTitle>
          <CardDescription>
            Selecione um período para gerar e exportar o relatório de bipagens de OPME.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col sm:flex-row items-center gap-4 p-4 border rounded-lg bg-muted/50">
            <div className="grid gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="date"
                    variant={"outline"}
                    className={cn(
                      "w-[300px] justify-start text-left font-normal",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date?.from ? (
                      date.to ? (
                        <>
                          {format(date.from, "dd/MM/y", { locale: ptBR })} -{" "}
                          {format(date.to, "dd/MM/y", { locale: ptBR })}
                        </>
                      ) : (
                        format(date.from, "dd/MM/y", { locale: ptBR })
                      )
                    ) : (
                      <span>Selecione um período</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={date?.from}
                    selected={date}
                    onSelect={setDate}
                    numberOfMonths={2}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <Button onClick={handleGenerateReport} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
              Gerar Relatório
            </Button>
          </div>

          {reportData.length > 0 && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">Pré-visualização do Relatório</h3>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleExportCSV}><Download className="mr-2 h-4 w-4" /> Exportar CSV</Button>
                  <Button variant="outline" onClick={handleExportPDF}><Download className="mr-2 h-4 w-4" /> Exportar PDF</Button>
                </div>
              </div>
              <ScrollArea className="h-[400px] w-full rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data Bipagem</TableHead>
                      <TableHead>CPS</TableHead>
                      <TableHead>Paciente</TableHead>
                      <TableHead>OPME</TableHead>
                      <TableHead>Cód. Barras</TableHead>
                      <TableHead>Qtd</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>{item.linked_at}</TableCell>
                        <TableCell>{item.cps_id}</TableCell>
                        <TableCell>{item.patient_name}</TableCell>
                        <TableCell>{item.opme_name}</TableCell>
                        <TableCell>{item.opme_barcode}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Reports;