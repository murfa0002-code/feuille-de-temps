import React from 'react';
import { TimesheetData, Profile } from '../types';
import LogoIcon from './icons/LogoIcon';
import LogoutIcon from './icons/LogoutIcon';

interface HeaderProps {
    currentUser: Profile;
    currentUserEmail: string;
    onLogout: () => void;
    employees: Profile[];
    currentEmployeeId: string;
    onEmployeeChange: (employeeId: string) => void;
    
    employeeTimesheets: TimesheetData[];
    currentTimesheetId: string;
    onSwitchWeek: (timesheetId: string) => void;
    onCreateNewWeek: () => void;

    data: TimesheetData | undefined;
    onHeaderChange: (field: keyof TimesheetData, value: string) => void;
    onTimesheetStatusChange: (newStatus: TimesheetData['status']) => void;
    isReadOnly: boolean;
}

const Header: React.FC<HeaderProps> = ({ 
    currentUser, currentUserEmail, onLogout,
    employees, currentEmployeeId, onEmployeeChange,
    employeeTimesheets, currentTimesheetId, onSwitchWeek, onCreateNewWeek,
    data, onHeaderChange, onTimesheetStatusChange, isReadOnly
}) => {
    
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onHeaderChange(e.target.name as keyof TimesheetData, e.target.value);
    }
    
    const handleEmployeeSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        onEmployeeChange(e.target.value);
    }

    const handleWeekSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        onSwitchWeek(e.target.value);
    }

    const isAdmin = currentUser.role === 'admin';
    
    const getStatusBadge = (status: TimesheetData['status']) => {
        switch (status) {
            case 'submitted':
                return <span className="px-2 py-1 text-xs font-semibold text-yellow-800 bg-yellow-200 rounded-full">En attente</span>;
            case 'approved':
                return <span className="px-2 py-1 text-xs font-semibold text-green-800 bg-green-200 rounded-full">Validée</span>;
            case 'draft':
            default:
                return <span className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-200 rounded-full">Brouillon</span>;
        }
    };
    
    const getStatusEmoji = (status: TimesheetData['status']) => {
        switch (status) {
            case 'submitted': return '🟡';
            case 'approved': return '🟢';
            default: return '⚫';
        }
    };
    
    const getActionButtons = () => {
        if (!data) return null;
        
        // Default to 'draft' if status is missing, ensuring buttons appear for older timesheets.
        const status = data.status || 'draft';

        if (isAdmin) {
             if (status === 'submitted') {
                return (
                    <button 
                        onClick={() => onTimesheetStatusChange('approved')} 
                        className="px-4 py-2 text-sm font-semibold text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    >
                        Approuver
                    </button>
                );
            }
            if (status === 'approved') {
                return (
                    <button 
                        onClick={() => onTimesheetStatusChange('draft')} 
                        className="px-4 py-2 text-sm font-semibold text-gray-800 bg-yellow-400 rounded-md hover:bg-yellow-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-400"
                    >
                        Dévalider (pour modification)
                    </button>
                );
            }
        } else { // Employee view
             if (status === 'draft') {
                return (
                    <button 
                        onClick={() => onTimesheetStatusChange('submitted')}
                        className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                        Soumettre pour validation
                    </button>
                );
            }
        }
        return null;
    }

  return (
    <header className="bg-white p-6 border-b border-gray-200">
      <div className="flex flex-col gap-6">
        {/* --- TOP ROW: Branding, User Info, Logout --- */}
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <LogoIcon className="h-12 w-auto" />
            <h1 className="text-2xl font-bold text-gray-700 ml-3">LGMC- MUTANDIS</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="font-semibold text-gray-800 truncate max-w-[200px]" title={currentUser.name}>{currentUser.name}</p>
              <p className="text-sm text-gray-500 truncate max-w-[200px]" title={currentUserEmail}>{currentUserEmail}</p>
            </div>
            <button
                onClick={onLogout}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500"
                title="Se déconnecter"
            >
                <LogoutIcon className="w-5 h-5" />
                <span className="hidden sm:inline">Déconnexion</span>
            </button>
          </div>
        </div>

        {/* --- MIDDLE ROW: Timesheet Controls --- */}
        <div className="w-full grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4 text-sm">
          
          <div className="col-span-2 sm:col-span-1 flex items-end gap-2">
            {isAdmin ? (
                <div className="flex-grow">
                    <label htmlFor="collaborateur" className="block font-semibold text-gray-600">Collaborateur :</label>
                    <select 
                    id="collaborateur" 
                    name="employeeId"
                    value={currentEmployeeId}
                    onChange={handleEmployeeSelectChange}
                    className="mt-1 block w-full px-2 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-cyan-500 focus:border-cyan-500"
                    >
                        {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                    </select>
                </div>
            ) : (
                 <div className="w-full">
                    <label className="block font-semibold text-gray-600">Collaborateur :</label>
                    <p className="mt-1 block w-full px-2 py-1.5 bg-gray-100 border border-gray-300 rounded-md">{currentUser.name}</p>
                </div>
            )}
          </div>
          
          <div className="col-span-2 sm:col-span-1 flex items-end gap-2">
            <div className="flex-grow">
                <label htmlFor="week" className="block font-semibold text-gray-600">Semaine :</label>
                <select 
                  id="week" 
                  name="week"
                  value={currentTimesheetId}
                  onChange={handleWeekSelectChange}
                  className="mt-1 block w-full px-2 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-cyan-500 focus:border-cyan-500"
                  disabled={!currentEmployeeId || employeeTimesheets.length === 0}
                >
                  {employeeTimesheets.map(ts => (
                      <option key={ts.id} value={ts.id}>
                          {getStatusEmoji(ts.status)} {new Date(ts.start_date).toLocaleDateString('fr-FR')} au {new Date(ts.end_date).toLocaleDateString('fr-FR')}
                      </option>
                  ))}
                   {employeeTimesheets.length === 0 && <option value="" disabled>Aucune feuille de temps</option>}
                </select>
            </div>
            <button 
                onClick={onCreateNewWeek} 
                className="px-3 py-1.5 bg-cyan-600 text-white rounded-md hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 text-nowrap disabled:bg-gray-400"
                title="Créer une nouvelle feuille de temps"
                disabled={!currentEmployeeId}
            >
                Nouvelle Semaine
            </button>
          </div>

          <div className="hidden md:block"></div>
          
          <div>
            <label htmlFor="periode" className="block font-semibold text-gray-600">Période n° :</label>
             <input 
              type="text" 
              id="periode" 
              name="period_number"
              value={data?.period_number || ''}
              onChange={handleInputChange}
              className="mt-1 block w-full px-2 py-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-cyan-500 focus:border-cyan-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              placeholder="Numéro de période"
              disabled={!currentTimesheetId || isReadOnly}
            />
          </div>
          <div>
            <label htmlFor="startDate" className="block font-semibold text-gray-600">Du :</label>
            <input 
              type="date" 
              id="startDate" 
              name="start_date"
              value={data?.start_date || ''}
              onChange={handleInputChange}
              className="mt-1 block w-full px-2 py-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-cyan-500 focus:border-cyan-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              disabled={!currentTimesheetId || isReadOnly}
            />
          </div>
          <div>
            <label htmlFor="endDate" className="block font-semibold text-gray-600">Au :</label>
            <input 
              type="date" 
              id="endDate" 
              name="end_date"
              value={data?.end_date || ''}
              onChange={handleInputChange}
              className="mt-1 block w-full px-2 py-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-cyan-500 focus:border-cyan-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              disabled={!currentTimesheetId || isReadOnly}
            />
          </div>
        </div>
        
        {/* --- BOTTOM ROW: Status and Actions --- */}
        {data && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-gray-600">Statut :</span>
                    {getStatusBadge(data.status)}
                </div>
                <div>
                    {getActionButtons()}
                </div>
            </div>
        )}
      </div>
    </header>
  );
};

export default Header;