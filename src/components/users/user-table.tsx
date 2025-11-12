'use client';

interface User {
  id: number;
  username: string;
  email: string | null;
  role: string;
  createdAt: Date;
}

interface UserTableProps {
  users: User[];
  currentUserId: string;
  currentUserRole?: string;
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
  onResetPassword: (user: User) => void;
}

const roleLabels: Record<string, string> = {
  admin: 'Administrador',
  superadmin: 'Super Administrador',
  lexicographer: 'Lexicógrafo',
  editor: 'Editor',
  coordinator: 'Coordinador',
};

const roleColors: Record<string, string> = {
  admin: 'bg-blue-100 text-blue-800',
  superadmin: 'bg-purple-100 text-purple-800',
  lexicographer: 'bg-green-100 text-green-800',
  editor: 'bg-yellow-100 text-yellow-800',
};

export default function UserTable({
  users,
  currentUserId,
  currentUserRole,
  onEdit,
  onDelete,
  onResetPassword,
}: UserTableProps) {
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('es-CL', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="overflow-hidden rounded-lg bg-white shadow-md">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                Usuario
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                Rol
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                Fecha de Creación
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                  No hay usuarios registrados
                </td>
              </tr>
            ) : (
              users.map((user) => {
                const isCurrentUser = String(user.id) === currentUserId;
                const canResetOwnPassword =
                  isCurrentUser &&
                  (currentUserRole === 'superadmin' || currentUserRole === 'admin');
                const disableResetPassword = isCurrentUser && !canResetOwnPassword;

                return (
                  <tr key={user.id} className={isCurrentUser ? 'bg-blue-50' : 'hover:bg-gray-50'}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="text-sm font-medium text-gray-900">
                          {user.username}
                          {isCurrentUser && (
                            <span className="ml-2 text-xs text-blue-600">(Tú)</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{user.email || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex rounded-full px-2 text-xs leading-5 font-semibold ${
                          roleColors[user.role] || 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {roleLabels[user.role] || user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium whitespace-nowrap">
                      <button
                        onClick={() => onEdit(user)}
                        className="mr-2 inline-flex items-center justify-center rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-all duration-200 hover:scale-105 hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => onResetPassword(user)}
                        disabled={disableResetPassword}
                        className={`mr-2 inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                          disableResetPassword
                            ? 'cursor-not-allowed bg-gray-300 text-gray-500 opacity-60'
                            : 'bg-orange-600 text-white hover:scale-105 hover:bg-orange-700 focus-visible:outline-orange-600'
                        }`}
                        title={
                          disableResetPassword
                            ? 'No puedes restablecer tu propia contraseña desde aquí'
                            : 'Enviar correo para restablecer contraseña'
                        }
                      >
                        Restablecer
                      </button>
                      <button
                        onClick={() => onDelete(user)}
                        disabled={isCurrentUser}
                        className={`inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                          isCurrentUser
                            ? 'cursor-not-allowed bg-gray-300 text-gray-500 opacity-60'
                            : 'bg-red-600 text-white hover:scale-105 hover:bg-red-700 focus-visible:outline-red-600'
                        }`}
                        title={isCurrentUser ? 'No puedes eliminar tu propia cuenta' : ''}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
