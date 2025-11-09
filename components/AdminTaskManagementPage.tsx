import React, { useState } from 'react';
import { ChargeableTask } from '../types';

interface AdminTaskManagementPageProps {
  pendingTasks: ChargeableTask[];
  onApproveTask: (task: ChargeableTask) => void;
  onRejectTask: (taskId: string) => void;
  onRefresh: () => Promise<void>;
}

const RefreshIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0011.664 0l3.181-3.183m-4.991-2.695v4.992h-4.992m0 0l-3.182-3.182a8.25 8.25 0 0111.664 0l3.182 3.182" />
  </svg>
);


const AdminTaskManagementPage: React.FC<AdminTaskManagementPageProps> = ({ 
  pendingTasks, 
  onApproveTask, 
  onRejectTask,
  onRefresh
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await onRefresh();
    setIsRefreshing(false);
  };

  return (
    <section aria-labelledby="admin-task-title">
      <div className="flex justify-between items-center mb-6">
        <h2 id="admin-task-title" className="text-2xl font-bold text-gray-800">
          Tâches en attente d'approbation
        </h2>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 disabled:opacity-50"
          title="Actualiser la liste des tâches"
        >
          <RefreshIcon className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Actualiser
        </button>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-md border border-gray-200">
        {pendingTasks.length === 0 ? (
          <div className="text-center text-gray-500 py-10">
            <svg className="mx-auto h-12 w-12 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">Aucune tâche en attente</h3>
            <p className="mt-1 text-sm text-gray-500">Toutes les soumissions de tâches ont été traitées.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {pendingTasks.map(task => (
              <li key={task.id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between hover:bg-gray-50">
                <div className="flex-1 mb-4 sm:mb-0">
                  <p className="text-md font-semibold text-gray-800">{task.name}</p>
                  <p className="text-sm text-gray-500">
                    Proposé par : <span className="font-medium text-gray-600">{task.profiles?.name || 'Inconnu'}</span>
                  </p>
                   <p className="text-xs text-gray-400 mt-1">
                    Soumis le : {new Date(task.created_at).toLocaleString('fr-FR')}
                  </p>
                </div>
                <div className="flex-shrink-0 flex gap-3">
                  <button
                    onClick={() => onApproveTask(task)}
                    className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                  >
                    Approuver
                  </button>
                  <button
                    onClick={() => onRejectTask(task.id)}
                    className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  >
                    Rejeter
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};

export default AdminTaskManagementPage;
