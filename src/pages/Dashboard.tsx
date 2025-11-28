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
import { Loader2, Package, Scan, XCircle, CheckCircle, ArrowRight } from "lucide-react";

interface LocalCpsRecord { id: string; user_id: string; cps_id: number; patient: string; professional: string; agreement: string; business_unit: string; created_at: string; }

const Dashboard = () => {
  const { userId } = useSession();
  const [loading, setLoading] = useState(true);
  const [totalCps, setTotalCps] = useState(0);
  const [cpsWithLinkedOpme, setCpsWithLinkedOpme] = useState(0);
  const [cpsWithoutLinkedOpme, setCpsWithoutLinkedOpme] = useState<LocalCpsRecord[]>([]);
  const [totalLinkedOpme, setTotalLinkedOpme] = useState(0);

  const fetchDashboardData = useCallback(async () => { /* ...código mantido... */ }, [userId]);

  useEffect(() => { fetchDashboardData(); }, [fetchDashboardData]);

  if (loading) { /* ...código mantido... */ }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Cards de estatísticas com hover effect */}
        <Card className="shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total de CPS</CardTitle><Package className="h-5 w-5 text-primary" /></CardHeader>
          <CardContent><div className="text-3xl font-bold">{totalCps}</div></CardContent>
        </Card>
        <Card className="shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">CPS com Bipagem</CardTitle><CheckCircle className="h-5 w-5 text-green-500" /></CardHeader>
          <CardContent><div className="text-3xl font-bold">{cpsWithLinkedOpme}</div></CardContent>
        </Card>
        <Card className="shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">CPS Sem Bipagem</CardTitle><XCircle className="h-5 w-5 text-red-500" /></CardHeader>
          <CardContent><div className="text-3xl font-bold">{cpsWithoutLinkedOpme.length}</div></CardContent>
        </Card>
        <Card className="shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">OPMEs Bipados</CardTitle><Scan className="h-5 w-5 text-blue-500" /></CardHeader>
          <CardContent><div className="text-3xl font-bold">{totalLinkedOpme}</div></CardContent>
        </Card>
      </div>

      <Card className="shadow-lg">
        <CardHeader><CardTitle className="flex items-center gap-3 text-2xl font-semibold"><XCircle className="h-6 w-6 text-red-500" /> Pacientes Aguardando Bipagem</CardTitle></CardHeader>
        <CardContent>
          {cpsWithoutLinkedOpme.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Todos os CPS registrados possuem bipagens!</p>
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
  );
};

export default Dashboard;