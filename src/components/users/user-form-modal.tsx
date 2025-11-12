'use client';

import { useState } from 'react';
import { createUserAction, updateUserAction } from '@/lib/actions';
import { getAllowedRoles } from '@/lib/role-utils';
import { Button } from '@/components/common/button';
import { Modal } from '@/components/common/modal';
import { Alert } from '@/components/common/alert';

interface User {
  id: number;
  username: string;
  email: string | null;
  role: string;
  createdAt: Date;
}

interface UserFormModalProps {
  mode: 'create' | 'edit';
  user?: User;
  currentUserRole?: string;
  onClose: () => void;
  onSuccess: (user: User) => void;
}

export default function UserFormModal({
  mode,
  user,
  currentUserRole,
  onClose,
  onSuccess,
}: UserFormModalProps) {
  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail] = useState(user?.email || '');
  const [role, setRole] = useState(user?.role || 'lexicographer');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Determine available role options based on current user's role
  const roleLabels: Record<string, string> = {
    lexicographer: 'Lexicógrafo',
    editor: 'Editor',
    admin: 'Administrador',
    superadmin: 'Super Administrador',
    coordinator: 'Coordinador',
  };

  const allowedRoles = getAllowedRoles(currentUserRole || 'admin');
  const roleOptions = allowedRoles.map((role) => ({
    value: role,
    label: roleLabels[role] || role,
  }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      if (mode === 'create') {
        const result = await createUserAction(username, email, role);

        if (result.success && result.user) {
          onSuccess({
            ...result.user,
            email: result.user.email || null,
            createdAt: new Date(),
          });
        } else {
          setError(result.error || 'Error al crear usuario');
        }
      } else if (user) {
        const result = await updateUserAction(user.id, {
          username: username !== user.username ? username : undefined,
          email: email !== user.email ? email : undefined,
          role: role !== user.role ? role : undefined,
        });

        if (result.success && result.user) {
          onSuccess({
            ...result.user,
            email: result.user.email || null,
            createdAt: user.createdAt,
          });
        } else {
          setError(result.error || 'Error al actualizar usuario');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} className="w-full max-w-md p-6">
      <h2 className="mb-4 text-2xl font-bold">
        {mode === 'create' ? 'Agregar Usuario' : 'Editar Usuario'}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}

        <div>
          <label htmlFor="username" className="mb-1 block text-sm font-medium text-gray-700">
            Nombre de Usuario
          </label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={3}
            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            placeholder="usuario123"
          />
        </div>

        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
            Correo Electrónico
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            placeholder="usuario@example.com"
          />
        </div>

        <div>
          <label htmlFor="role" className="mb-1 block text-sm font-medium text-gray-700">
            Rol
          </label>
          <select
            id="role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            {roleOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {mode === 'create' && (
          <Alert variant="info">
            El usuario recibirá un correo para que puedan establecer su contraseña.
          </Alert>
        )}

        <div className="flex gap-3 pt-4">
          <Button type="submit" loading={isSubmitting} className="flex-1">
            {mode === 'create' ? 'Crear Usuario' : 'Guardar Cambios'}
          </Button>
          <Button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
