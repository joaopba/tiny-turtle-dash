"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useSession } from "@/components/SessionContextProvider";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Package, Scan, XCircle, CheckCircle } from "lucide-react";

interface LocalCpsRecord {
  id: string;
  user_id: string;
  cps_id: number;
  patient: string;
  professional: string;
  agreement: string;
  business_unit: string;
  created_at: string;
}

const Dashboard = () => {
  const { session } = useSession();
  const userId = session?.user?.id;

  const [loading, setLoading] = useState(true);
  const [totalCps, setTotalCps] = useState(0);
  const [cpsWithLinkedOpme, setCpsWithLinkedOpme] = useState(0);
  const [cpsWithoutLinkedOpme, setCpsWithoutLinkedOpme] = useState<LocalCpsRecord[]>([]);
  const [totalLinkedOpme, setTotalLinkedOpme] = useState(0);

  const fetchDashboardData = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Total de CPS Registrados
      const { count: totalCpsCount, error: totalCpsError } = await supabase
        .from("local_cps_records")
        .select("id", { count: "exact" })
        .eq("user_id", userId);

      if (totalCpsError) throw totalCpsError;
      setTotalCps(totalCpsCount || 0);

      // CPS com Bipagem e Total de OPMEs Bipados
      const { data: linkedOpmeData, error: linkedOpmeError } = await supabase
        .from("linked_opme")
        .select("cps_id, quantity")
        .eq("user_id", userId);

      if (linkedOpmeError) throw linkedOpmeError;

      const uniqueCpsWithLinkedOpme = new Set(linkedOpmeData.map(item => item.cps_id));
      setCpsWithLinkedOpme(uniqueCpsWithLinkedOpme.size);

      const sumQuantities = linkedOpmeData.reduce((sum, item) => sum + item.quantity, 0);
      setTotalLinkedOpme(sumQuantities);

      // CPS Sem Bipagem
      const { data: allCpsRecords, error: allCpsRecordsError } = await supabase
        .from("local_cps_records")
        .select("*")
        .eq("user_id", userId);

      if (allCpsRecordsError) throw allCpsRecordsError;

      const cpsWithout = (allCpsRecords as LocalCpsRecord[]).filter(
        (record) => !uniqueCpsWithLinkedOpme.has(record.cps_id)
      );
      setCpsWithoutLinkedOpme(cpsWithout);

    } catch (error: any) {
      console.error("Erro ao buscar dados do dashboard:", error.message);
      toast.error("Falha ao carregar dados do dashboard.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Carregando Dashboard...</span>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <h1 className="text-4xl font-extrabold text-center text-foreground mb-8">Visão Geral do Sistema OPME</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de CPS Registrados</CardTitle>
            <Package className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{totalCps}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Registros de pacientes no sistema
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">CPS com Bipagem</CardTitle>
            <CheckCircle className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{cpsWithLinkedOpme}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Pacientes com OPMEs bipados
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">CPS Sem Bipagem</CardTitle>
            <XCircle className="h-5 w-5 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{cpsWithoutLinkedOpme.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Pacientes aguardando bipagem
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de OPMEs Bipados</CardTitle>
            <Scan className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{totalLinkedOpme}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Itens OPME registrados
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-2xl font-semibold">
            <XCircle className="h-6 w-6 text-red-500" /> Pacientes com CPS Sem Bipagem
          </CardTitle>
        </CardHeader>
        <CardContent>
          {cpsWithoutLinkedOpme.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Todos os CPS registrados possuem bipagens!</p>
          ) : (
            <ScrollArea className="h-[350px] w-full rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[100px]">CPS</TableHead>
                    <TableHead>Paciente</TableHead>
                    <TableHead>Profissional</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cpsWithoutLinkedOpme.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">{record.cps_id}</TableCell>
                      <TableCell>{record.patient}</TableCell>
                      <TableCell>{record.professional || "N/A"}</TableCell>
                      <TableCell>{record.business_unit || "N/A"}</TableCell>
                      <TableCell className="text-right">
                        <Link to={`/opme-scanner?cps_id=${record.cps_id}`}>
                          <Button variant="outline" size="sm">
                            Bipar OPME
                          </Button>
                        </Link>
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
  );
};

export default Dashboard;