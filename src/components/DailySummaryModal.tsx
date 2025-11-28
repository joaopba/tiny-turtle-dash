"use client";

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from './ui/button';

interface DailySummaryProps {
  isOpen: boolean;
  onClose: () => void;
  summaryData: { cps_id: number; patient: string; opme_count: number }[];
}

const DailySummaryModal: React.FC<DailySummaryProps> = ({ isOpen, onClose, summaryData }) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Resumo de Atividades do Dia</DialogTitle>
          <DialogDescription>
            Estes são os pacientes (CPS) que tiveram OPMEs bipados hoje. Verifique se as informações foram lançadas no sistema principal.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-72 w-full rounded-md border mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>CPS</TableHead>
                <TableHead>Paciente</TableHead>
                <TableHead className="text-right">OPMEs Bipados</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summaryData.map((item) => (
                <TableRow key={item.cps_id}>
                  <TableCell className="font-medium">{item.cps_id}</TableCell>
                  <TableCell>{item.patient}</TableCell>
                  <TableCell className="text-right">{item.opme_count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
        <div className="flex justify-end mt-4">
          <Button onClick={onClose}>Fechar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DailySummaryModal;