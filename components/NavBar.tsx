import React from 'react';
import { AppView } from '../types';

interface NavBarProps {
  currentView: AppView;
  setView: (view: AppView) => void;
  userRole: 'admin' | 'employee';
  pendingTaskCount: number;
}

const NavBar: React.FC<NavBarProps> = ({ currentView, setView, userRole, pendingTaskCount }) => {
  const navButtonStyle = "relative px-4 py-2 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500";
  const activeStyle = "bg-cyan-600 text-white shadow-sm";
  const inactiveStyle = "bg-white text-gray-700 hover:bg-gray-100";

  return (
    <nav className="mb-6 p-1.5 bg-gray-200 rounded-lg flex justify-center space-x-2" role="navigation" aria-label="Main navigation">
      <button 
        onClick={() => setView('timesheet')}
        className={`${navButtonStyle} ${currentView === 'timesheet' ? activeStyle : inactiveStyle}`}
        aria-current={currentView === 'timesheet' ? 'page' : undefined}
      >
        Feuille de temps
      </button>
       {userRole === 'admin' && (
        <button 
          onClick={() => setView('detailed_analysis')}
          className={`${navButtonStyle} ${currentView === 'detailed_analysis' ? activeStyle : inactiveStyle}`}
          aria-current={currentView === 'detailed_analysis' ? 'page' : undefined}
        >
          Analyse Détaillée
        </button>
      )}
      <button 
        onClick={() => setView('analysis')}
        className={`${navButtonStyle} ${currentView === 'analysis' ? activeStyle : inactiveStyle}`}
        aria-current={currentView === 'analysis' ? 'page' : undefined}
      >
        Analyse de performance
      </button>
       {userRole === 'admin' && (
         <button 
            onClick={() => setView('admin_tasks')}
            className={`${navButtonStyle} ${currentView === 'admin_tasks' ? activeStyle : inactiveStyle}`}
            aria-current={currentView === 'admin_tasks' ? 'page' : undefined}
        >
            Gestion des Tâches
            {pendingTaskCount > 0 && (
                <span className="absolute -top-2 -right-2 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 bg-red-600 rounded-full">
                    {pendingTaskCount}
                </span>
            )}
        </button>
      )}
    </nav>
  );
};

export default NavBar;