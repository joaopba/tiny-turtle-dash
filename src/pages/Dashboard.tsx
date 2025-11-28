"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useSession } from "@/components/SessionContextProvider";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Package, Scan, XCircle, CheckCircle, ArrowRight, PlusCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import DailySummaryModal from "@/components/DailySummaryModal";

interface LocalCpsRecord { id: string; user_id: string; cps_id: number; patient: string; professional: string; agreement: string; business_unit: string; created_at: string; }
interface DailySummaryData { cps_id: number; patient: string; opme_count: number; }

const Dashboard = () => {
  const { user } = useSession();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalCps: 0,
    cpsWithLinkedOpme: 0,
    cpsWithoutLinkedOpmeCount: 0,
    totalLinkedOpme: 0,
  });
  const [cpsWithoutLinkedOpme, setCpsWithoutLinkedOpme] = useState<LocalCpsRecord[]>([]);
  const [dailySummaryData, setDailySummaryData] = useState<DailySummaryData[]>([]);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      // Fetch principal data
      const { data: localCpsData, error: cpsError } = await supabase
        .from("local_cps_records")
        .select("id, cps_id, patient, business_unit")
        .eq("user_id", user.id);
      if (cpsError) throw cpsError;

      const { data: linkedOpmeData, error: opmeError } = await supabase
        .from("linked_opme")
        .select("cps_id, quantity")
        .eq("user_id", user.id);
      if (opmeError) throw opmeError;

      const linkedCpsIds = new Set(linkedOpmeData.map(item => item.cps_id));
      const cpsWithoutOpme = localCpsData.filter(cps => !linkedCpsIds.has(cps.cps_id));
      const totalOpmeCount = linkedOpmeData.reduce((sum, item) => sum + item.quantity, 0);

      setStats({
        totalCps: localCpsData.length,
        cpsWithLinkedOpme: linkedCpsIds.size,
        cpsWithoutLinkedOpmeCount: cpsWithoutOpme.length,
        totalLinkedOpme: totalOpmeCount,
      });
      setCpsWithoutLinkedOpme(cpsWithoutOpme as LocalCpsRecord[]);

      // Fetch daily summary data
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { data: dailyData, error: dailyError } = await supabase.rpc('get_daily_opme_summary', { user_uuid: user.id, since: today.toISOString() });
      
      if (dailyError) throw dailyError;
      
      if (dailyData && dailyData.length > 0) {
        setDailySummaryData(dailyData);
        // Evita reabrir o modal se o usuário já o fechou na sessão atual
        if (!sessionStorage.getItem('dailySummaryShown')) {
          setIsSummaryModalOpen(true);
          sessionStorage.setItem('dailySummaryShown', 'true');
        }
      }

    } catch (error: any) {
      console.error("Erro ao buscar dados do dashboard:", error);
      toast.error(`Falha ao carregar dados do dashboard: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const chartData = [
    { name: 'Com Bipagem', value: stats.cpsWithLinkedOpme, fill: 'hsl(var(--primary))' },
    { name: 'Sem Bipagem', value: stats.cpsWithoutLinkedOpmeCount, fill: 'hsl(var(--destructive))' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <DailySummaryModal 
        isOpen={isSummaryModalOpen}
        onClose={() => setIsSummaryModalOpen(false)}
        summaryData={dailySummaryData}
      />
      <div className="space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Coluna Esquerda: Estatísticas e Ações Rápidas */}
          <div className="lg:col-span-1 space-y-8">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Ações Rápidas</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <Button asChild size="lg"><Link to="/opme-scanner"><Scan className="mr-2 h-5 w-5" /> Iniciar Bipagem</Link></Button>
                <Button asChild size="lg" variant="outline"><Link to="/opme-registration"><PlusCircle className="mr-2 h-5 w-5" /> Cadastrar OPME</Link></Button>
              </CardContent>
            </Card>
            <div className="grid grid-cols-2 gap-4">
              <Card className="shadow-md"><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total de CPS</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats.totalCps}</div></CardContent></Card>
              <Card className="shadow-md"><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">OPMEs Bipados</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats.totalLinkedOpme}</div></CardContent></Card>
            </div>
          </div>

          {/* Coluna Direita: Gráfico */}
          <Card className="lg:col-span-2 shadow-lg">
            <CardHeader>
              <CardTitle>Visão Geral de Bipagens</CardTitle>
              <CardDescription>Distribuição de CPS com e sem bipagem de OPME.</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    cursor={{ fill: 'hsla(var(--accent), 0.5)' }}
                    contentStyle={{
                      background: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 'var(--radius)',
                    }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-xl font-semibold">
              <XCircle className="h-6 w-6 text-destructive" /> Pacientes Aguardando Bipagem
            </CardTitle>
          </CardHeader>
          <CardContent>
            {cpsWithoutLinkedOpme.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">Ótimo trabalho! Todos os pacientes registrados possuem bipagens.</p>
            ) : (
              <ScrollArea className="h-[350px] w-full">
                <Table>
                  <TableHeader><TableRow><TableHead>CPS</TableHead><TableHead>Paciente</TableHead><TableHead>Unidade</TableHead><TableHead className="text-right">Ação</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {cpsWithoutLinkedOpme.map((record) => (
                      <TableRow key={record.id} className="hover:bg-muted/50">
                        <TableCell className="font-medium">{record.cps_id}</TableCell>
                        <TableCell>{record.patient}</TableCell>
                        <TableCell>{record.business_unit || "N/A"}</TableCell>
                        <TableCell className="text-right">
                          <Button asChild variant="default" size="sm">
                            <Link to={`/opme-scanner?cps_id=${record.cps_id}`}>Bipar OPME <ArrowRight className="ml-2 h-4 w-4" /></Link>
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
      </div>
    </>
  );
};

export default Dashboard;