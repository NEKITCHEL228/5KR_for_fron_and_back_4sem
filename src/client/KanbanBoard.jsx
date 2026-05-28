import React, { useEffect, useState } from 'react';
import { useAuth } from './AuthContext.jsx';
import { LogOut, Undo2, Redo2, Plus, GripVertical, Trash2, Edit } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Link } from 'react-router-dom';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const COLUMNS = ['Новые', 'В работе', 'Готово'];

export const KanbanBoard = () => {
  const { user, socket, logout } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [error, setError] = useState('');
  
  const [draggedTask, setDraggedTask] = useState(null);
  const [hoveredStatus, setHoveredStatus] = useState(null);

  const [modalMode, setModalMode] = useState(null); // 'add', 'edit', 'delete'
  const [currentTask, setCurrentTask] = useState(null);
  const [taskForm, setTaskForm] = useState({ title: '', description: '', status: 'Новые' });

  const openAddModal = (status = 'Новые') => {
    setTaskForm({ title: '', description: '', status });
    setModalMode('add');
  };

  const openEditModal = (task) => {
    setTaskForm({ title: task.title, description: task.description || '', status: task.status });
    setCurrentTask(task);
    setModalMode('edit');
  };

  const openDeleteModal = (task) => {
    setCurrentTask(task);
    setModalMode('delete');
  };

  const closeModal = () => {
    setModalMode(null);
    setCurrentTask(null);
    setTaskForm({ title: '', description: '', status: 'Новые' });
  };

  const handleSaveTask = (e) => {
    e.preventDefault();
    if (modalMode === 'add') {
      socket?.emit('add_task', taskForm);
    } else if (modalMode === 'edit') {
      socket?.emit('update_task', {
        taskId: currentTask.id,
        title: taskForm.title,
        description: taskForm.description
      });
    }
    closeModal();
  };

  const handleDeleteConfirm = () => {
    socket?.emit('delete_task', { taskId: currentTask.id });
    closeModal();
  };

  useEffect(() => {
    if (!socket) return;
    
    socket.on('initial_state', (remoteTasks) => {
      setTasks(remoteTasks);
      setError('');
    });
    
    socket.on('task_moved', (updatedTask) => {
      setTasks(prev => {
        const idx = prev.findIndex(t => t.id === updatedTask.id);
        if (idx !== -1) {
          const newTasks = [...prev];
          newTasks[idx] = updatedTask;
          return newTasks;
        }
        return [...prev, updatedTask];
      });
      setError('');
    });
    
    socket.on('error', (msg) => {
      setError(msg);
      setTimeout(() => setError(''), 3000);
    });

    return () => {
      socket.off('initial_state');
      socket.off('task_moved');
      socket.off('error');
    };
  }, [socket]);

  const handleUndo = () => socket?.emit('undo');
  const handleRedo = () => socket?.emit('redo');

  const onDragStart = (e, task) => {
    if (user?.role === 'viewer') {
      e.preventDefault();
      return;
    }
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
    const el = e.target;
    e.dataTransfer.setDragImage(el, el.offsetWidth / 2, el.offsetHeight / 2);
  };
  
  const onDragOver = (e, status) => {
    e.preventDefault();
    if (user?.role !== 'viewer') {
      setHoveredStatus(status);
    }
  };

  const onDrop = (e, targetStatus) => {
    e.preventDefault();
    setHoveredStatus(null);
    if (!draggedTask || user?.role === 'viewer') return;
    
    if (draggedTask.status !== targetStatus) {
      const tasksInTargetColumn = tasks.filter(t => t.status === targetStatus);
      const newPos = tasksInTargetColumn.length;
      
      setTasks(prev => prev.map(t => t.id === draggedTask.id ? { ...t, status: targetStatus, pos: newPos } : t));
      
      socket?.emit('move_task', {
        taskId: draggedTask.id,
        newStatus: targetStatus,
        newPos
      });
    }
    setDraggedTask(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold text-gray-900 tracking-tight">Task Manager</h1>
          <span className="px-2.5 py-1 text-xs font-medium bg-blue-50 text-blue-700 rounded-full">
            Role: {user?.role}
          </span>
        </div>
        
        <div className="flex items-center gap-4">
          {error && <span className="text-sm font-medium text-red-600 bg-red-50 px-3 py-1 rounded-md">{error}</span>}
          
          {user?.role === 'owner' && (
            <Link to="/admin" className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors">
              Админ панель
            </Link>
          )}

          {user?.role !== 'viewer' && (
            <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
              <button onClick={handleUndo} className="p-2 hover:bg-white rounded-md text-gray-600 hover:text-gray-900 transition-colors" title="Undo (Command Pattern)">
                <Undo2 className="w-4 h-4" />
              </button>
              <button onClick={handleRedo} className="p-2 hover:bg-white rounded-md text-gray-600 hover:text-gray-900 transition-colors" title="Redo">
                <Redo2 className="w-4 h-4" />
              </button>
            </div>
          )}
          
          <button 
            onClick={logout}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Выйти
          </button>
        </div>
      </header>

      <main className="flex-1 p-6 overflow-x-auto">
        <div className="flex gap-6 h-full min-w-max items-start">
          {COLUMNS.map(status => (
            <div 
              key={status}
              onDragOver={(e) => onDragOver(e, status)}
              onDrop={(e) => onDrop(e, status)}
              onDragLeave={() => setHoveredStatus(null)}
              className={cn(
                "w-80 min-h-[500px] flex flex-col bg-gray-100 rounded-xl p-4 transition-colors",
                hoveredStatus === status && user?.role !== 'viewer' ? "bg-gray-200 border-2 border-dashed border-gray-300" : "border-2 border-transparent"
              )}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-700">{status}</h3>
                <span className="text-xs font-medium text-gray-500 bg-gray-200 px-2.5 py-1 rounded-full">
                  {tasks.filter(t => t.status === status).length}
                </span>
              </div>
              
              <div className="flex flex-col gap-3 flex-1 overflow-y-auto">
                {tasks
                  .filter(t => t.status === status)
                  .sort((a, b) => a.pos - b.pos)
                  .map(task => (
                    <div
                      key={task.id}
                      draggable={user?.role !== 'viewer'}
                      onDragStart={(e) => onDragStart(e, task)}
                      className={cn(
                        "bg-white p-4 rounded-lg shadow-sm border border-gray-200 group relative",
                        user?.role !== 'viewer' ? "cursor-grab active:cursor-grabbing hover:border-gray-300" : "",
                        draggedTask?.id === task.id ? "opacity-50" : "opacity-100"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-gray-900 leading-snug">{task.title}</p>
                          {task.description && <p className="text-xs text-gray-500 mt-1">{task.description}</p>}
                        </div>
                        {user?.role !== 'viewer' && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openEditModal(task)} className="text-gray-400 hover:text-blue-600 p-1">
                              <Edit className="w-4 h-4" />
                            </button>
                            <button onClick={() => openDeleteModal(task)} className="text-gray-400 hover:text-red-600 p-1">
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <button className="text-gray-400 hover:text-gray-600 p-1 cursor-grab active:cursor-grabbing">
                              <GripVertical className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                ))}
                
                {status === 'Новые' && user?.role !== 'viewer' && (
                  <button onClick={() => openAddModal(status)} className="w-full flex items-center justify-center gap-2 py-3 mt-2 text-sm font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors border border-dashed border-gray-300">
                    <Plus className="w-4 h-4" /> Добавить задачу
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Modals */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            {modalMode === 'delete' ? (
              <>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">Удалить задачу?</h2>
                <p className="text-sm text-gray-500 mb-6">Вы уверены, что хотите удалить задачу &quot;{currentTask?.title}&quot;? Это действие нельзя отменить.</p>
                <div className="flex justify-end gap-3">
                  <button onClick={closeModal} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                    Отмена
                  </button>
                  <button onClick={handleDeleteConfirm} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors">
                    Удалить
                  </button>
                </div>
              </>
            ) : (
              <form onSubmit={handleSaveTask}>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">{modalMode === 'add' ? 'Добавить задачу' : 'Редактировать задачу'}</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Название</label>
                    <input 
                      type="text" 
                      required 
                      value={taskForm.title} 
                      onChange={e => setTaskForm({...taskForm, title: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Описание (опционально)</label>
                    <textarea 
                      value={taskForm.description} 
                      onChange={e => setTaskForm({...taskForm, description: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px] resize-none"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                    Отмена
                  </button>
                  <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
                    Сохранить
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
