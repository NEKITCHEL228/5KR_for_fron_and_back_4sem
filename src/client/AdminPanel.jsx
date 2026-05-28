import React, { useEffect, useState } from 'react';
import { useAuth } from './AuthContext.jsx';
import { LayoutDashboard, Shield, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';

export const AdminPanel = () => {
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user?.role !== 'owner') {
      navigate('/');
      return;
    }

    const fetchUsers = async () => {
      try {
        const res = await fetch('/api/users', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setUsers(data);
        } else {
          setError('Не удалось загрузить пользователей');
        }
      } catch (e) {
        setError('Сбой сети');
      } finally {
        setIsLoading(false);
      }
    };
    fetchUsers();
  }, [token, user, navigate]);

  const handleRoleChange = async (userId, newRole) => {
    try {
      const res = await fetch(`/api/users/${userId}/role`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ role: newRole })
      });
      if (res.ok) {
        setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
      } else {
        alert('Не удалось изменить роль');
      }
    } catch (e) {
      alert('Сбой сети');
    }
  };

  if (isLoading) return <div className="p-8">Загрузка...</div>;

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 text-blue-600">
                <LayoutDashboard className="w-6 h-6" />
                <span className="text-xl font-bold text-gray-900 tracking-tight">Admin Panel</span>
              </div>
              <nav className="flex items-center gap-4">
                <Link to="/" className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">Перейти к задачам</Link>
              </nav>
            </div>
            
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600 font-medium">{user?.username} ({user?.role})</span>
              <button 
                onClick={logout}
                className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
              >
                Выйти
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow sm:rounded-lg overflow-hidden border border-gray-200">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Пользователи системы</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">Управление ролями и доступом</p>
          </div>
          <div className="border-t border-gray-200">
            {error ? (
              <div className="p-4 text-red-600">{error}</div>
            ) : (
               <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Логин</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Текущая роль</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Изменить роль</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">#{u.id}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{u.username}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          {u.role === 'owner' && <ShieldCheck className="w-4 h-4 text-purple-600" />}
                          {u.role === 'editor' && <Shield className="w-4 h-4 text-blue-600" />}
                          {u.role === 'viewer' && <ShieldAlert className="w-4 h-4 text-gray-400" />}
                          <span className="capitalize">{u.role}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <select
                          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                          disabled={u.id === user.id}
                        >
                          <option value="viewer">Viewer</option>
                          <option value="editor">Editor</option>
                          <option value="owner">Owner</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
