"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/SessionContextProvider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, PlusCircle, UserPlus } from 'lucide-react';

interface UserProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  user_email: string;
}

const UserManagement = () => {
  const { profile } = useSession();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'GESTOR' | 'OPERADOR'>('OPERADOR');
  const [inviting, setInviting] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    // Precisamos de uma RPC para buscar emails, pois a tabela auth.users não é diretamente acessível
    const { data, error } = await supabase.rpc('get_user_profiles');

    if (error) {
      toast.error(`Erro ao buscar usuários: ${error.message}`);
    } else {
      setUsers(data as UserProfile[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (profile?.role === 'GESTOR') {
      fetchUsers();
    }
  }, [profile, fetchUsers]);

  const handleInviteUser = async () => {
    if (!inviteEmail) {
      toast.error("O e-mail é obrigatório.");
      return;
    }
    setInviting(true);
    try {
      const { error } = await supabase.functions.invoke('invite-user', {
        body: { email: inviteEmail, role: inviteRole },
      });

      if (error) throw error;

      toast.success(`Convite enviado para ${inviteEmail}`);
      setIsInviteDialogOpen(false);
      setInviteEmail('');
      setInviteRole('OPERADOR');
      fetchUsers(); // Atualiza a lista
    } catch (error: any) {
      toast.error(`Falha ao enviar convite: ${error.message}`);
    } finally {
      setInviting(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-8">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Gerenciamento de Usuários</CardTitle>
            <CardDescription>Convide novos usuários e gerencie as permissões de acesso.</CardDescription>
          </div>
          <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button><UserPlus className="mr-2 h-4 w-4" /> Convidar Usuário</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Convidar Novo Usuário</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" type="email" placeholder="nome@exemplo.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Permissão</Label>
                  <Select value={inviteRole} onValueChange={(value: 'GESTOR' | 'OPERADOR') => setInviteRole(value)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OPERADOR">Operador</SelectItem>
                      <SelectItem value="GESTOR">Gestor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleInviteUser} disabled={inviting}>
                  {inviting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Enviar Convite
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>E-mail</TableHead><TableHead>Permissão</TableHead></TableRow></TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.first_name || ''} {user.last_name || ''}</TableCell>
                  <TableCell>{user.user_email}</TableCell>
                  <TableCell>{user.role}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default UserManagement;