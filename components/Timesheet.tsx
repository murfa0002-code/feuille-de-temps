import React, { useMemo } from 'react';
import { Task } from '../types';
import { DAYS_OF_WEEK } from '../constants';
import TrashIcon from './icons/TrashIcon';
import DownloadIcon from './icons/DownloadIcon';

interface TimesheetProps {
  chargeableTasks: Task[];
  nonChargeableTasks: Task[];
  normalHours: number[];
  onTaskHoursChange: (taskId: string, dayIndex: number, hours: number) => void;
  availableChargeableTasks: string[];
  onAddNewChargeableTask: () => void;
  onRemoveTask: (taskId: string) => void;
  onTaskSelectionChange: (taskId: string, newName: string) => void;
  onExport: () => void;
  isReadOnly: boolean;
}

const VerticalLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="absolute left-0 top-0 bottom-0 flex items-center justify-center w-8 -translate-x-full">
        <span className="transform -rotate-90 whitespace-nowrap text-xs font-bold tracking-widest text-gray-500 uppercase">
            {children}
        </span>
    </div>
  )
}

const TaskRow: React.FC<{ task: Task; onTaskHoursChange: (taskId: string, dayIndex: number, hours: number) => void; rowTotal: number; isReadOnly: boolean; }> = ({ task, onTaskHoursChange, rowTotal, isReadOnly }) => {
  const handleHoursChange = (dayIndex: number, value: string) => {
    const hours = parseFloat(value.replace(',', '.')) || 0;
    onTaskHoursChange(task.id, dayIndex, hours);
  };

  return (
    <tr>
      <td className="border border-gray-300 px-3 py-2 text-sm text-gray-800 font-medium">{task.name}</td>
      {task.hours.map((hour, index) => (
        <td key={index} className="border border-gray-300">
          <input
            type="text"
            value={hour === 0 ? '' : String(hour).replace('.', ',')}
            onChange={(e) => handleHoursChange(index, e.target.value)}
            className={`w-full h-full text-center outline-none transition-colors duration-200 px-2 py-2 ${isReadOnly ? 'bg-gray-100 cursor-not-allowed' : 'focus:bg-cyan-50'}`}
            aria-label={`Hours for ${task.name} on day ${index + 1}`}
            disabled={isReadOnly}
          />
        </td>
      ))}
      <td className="border border-gray-300 px-3 py-2 text-center text-sm font-bold bg-gray-100 text-gray-800">
        {rowTotal.toLocaleString('fr-FR')}
      </td>
    </tr>
  );
};


const TotalsRow: React.FC<{ label: string; totals: number[]; isBold?: boolean }> = ({ label, totals, isBold = false }) => {
  const rowClasses = isBold ? "font-bold text-gray-900" : "font-semibold text-gray-700";
  return (
    <tr className="bg-cyan-100/50">
      <td className={`border border-gray-300 px-3 py-2 text-sm ${rowClasses}`}>{label}</td>
      {totals.map((total, index) => (
        <td key={index} className={`border border-gray-300 px-3 py-2 text-center text-sm ${rowClasses}`}>
          {total.toLocaleString('fr-FR')}
        </td>
      ))}
    </tr>
  );
};


const Timesheet: React.FC<TimesheetProps> = ({ 
    chargeableTasks, nonChargeableTasks, normalHours, onTaskHoursChange,
    availableChargeableTasks, onAddNewChargeableTask, onRemoveTask, onTaskSelectionChange, onExport,
    isReadOnly
}) => {

    const calculateTotals = (
        tasks: Task[]
    ): number[] => {
        const dailyTotals = Array(6).fill(0);
        if (!tasks) return [...dailyTotals, 0];
        tasks.forEach((task: Task) => {
            task.hours.forEach((hour, i) => {
                if(i < 6) dailyTotals[i] += hour;
            })
        });
        const grandTotal = dailyTotals.reduce((a, b) => a + b, 0);
        return [...dailyTotals, grandTotal];
    };

    const chargeableTotals = useMemo(() => calculateTotals(chargeableTasks), [chargeableTasks]);
    const nonChargeableTotals = useMemo(() => calculateTotals(nonChargeableTasks), [nonChargeableTasks]);
    
    const generalTotals = useMemo(() => {
        const totals = chargeableTotals.map((val, i) => val + nonChargeableTotals[i]);
        return totals;
    }, [chargeableTotals, nonChargeableTotals]);
    
    const overtimeTotals = useMemo(() => {
        const dailyOvertime = generalTotals.slice(0, 6).map((total, i) => total - (normalHours[i] || 0) );
        const totalOvertime = dailyOvertime.reduce((a, b) => a + b, 0);
        return [...dailyOvertime, totalOvertime];
    }, [generalTotals, normalHours]);

    const normalHoursWithTotal = [...(normalHours || Array(6).fill(0)), (normalHours || []).reduce((a, b) => a + b, 0)];

    const selectedChargeableTaskNames = useMemo(() => new Set(chargeableTasks.map(t => t.name)), [chargeableTasks]);

    return (
        <div className="overflow-x-auto">
             <div className="flex justify-end mb-4">
                <button
                    onClick={onExport}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 text-sm font-medium"
                >
                    <DownloadIcon className="w-4 h-4" />
                    Exporter en CSV
                </button>
            </div>
            <table className="min-w-full border-collapse border border-gray-400 bg-white">
                <thead>
                    <tr className="bg-cyan-500 text-white">
                        <th className="border border-cyan-600 px-3 py-2 text-left text-sm font-semibold w-1/4"></th>
                        {DAYS_OF_WEEK.map(day => (
                            <th key={day} className="border border-cyan-600 px-3 py-2 text-center text-sm font-semibold w-[10%]">{day}</th>
                        ))}
                        <th className="border border-cyan-600 px-3 py-2 text-center text-sm font-semibold w-[10%]">Total</th>
                    </tr>
                </thead>
                <tbody>
                    <tr className="bg-cyan-200/50">
                        <td colSpan={8} className="px-3 py-1.5 text-sm font-bold text-cyan-800 relative">
                            <VerticalLabel>TACHES</VerticalLabel>
                            Temps chargeable :
                        </td>
                    </tr>
                    {chargeableTasks.map(task => {
                        const rowTotal = task.hours.reduce((sum, h) => sum + h, 0);
                        const handleHoursChange = (dayIndex: number, value: string) => {
                            const hours = parseFloat(value.replace(',', '.')) || 0;
                            onTaskHoursChange(task.id, dayIndex, hours);
                          };

                        return (
                            <tr key={task.id}>
                                <td className="border border-gray-300 px-2 py-1">
                                    <div className="flex items-center gap-2">
                                        <select
                                            value={task.name}
                                            onChange={(e) => onTaskSelectionChange(task.id, e.target.value)}
                                            className={`w-full bg-transparent p-1 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm text-gray-800 font-medium ${isReadOnly ? 'appearance-none cursor-not-allowed' : ''}`}
                                            aria-label={`Select task for row`}
                                            disabled={isReadOnly}
                                        >
                                            <option value="" disabled>-- Choisir une tâche --</option>
                                            {task.name && <option value={task.name}>{task.name}</option>}
                                            {availableChargeableTasks
                                                .filter(name => !selectedChargeableTaskNames.has(name) || name === task.name)
                                                .map(name => <option key={name} value={name}>{name}</option>)}
                                        </select>
                                        <button 
                                          onClick={() => onRemoveTask(task.id)}
                                          className={`p-1 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 flex-shrink-0 ${isReadOnly ? 'text-gray-300 cursor-not-allowed' : 'text-gray-400 hover:text-red-600'}`}
                                          aria-label={`Remove task ${task.name}`}
                                          disabled={isReadOnly}
                                        >
                                          <TrashIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                </td>
                                {task.hours.map((hour, index) => (
                                    <td key={index} className="border border-gray-300">
                                    <input
                                        type="text"
                                        value={hour === 0 ? '' : String(hour).replace('.', ',')}
                                        onChange={(e) => handleHoursChange(index, e.target.value)}
                                        className={`w-full h-full text-center outline-none transition-colors duration-200 px-2 py-2 ${isReadOnly ? 'bg-gray-100 cursor-not-allowed' : 'focus:bg-cyan-50'}`}
                                        aria-label={`Hours for ${task.name || 'selected task'} on day ${index + 1}`}
                                        disabled={isReadOnly}
                                    />
                                    </td>
                                ))}
                                <td className="border border-gray-300 px-3 py-2 text-center text-sm font-bold bg-gray-100 text-gray-800">
                                    {rowTotal.toLocaleString('fr-FR')}
                                </td>
                            </tr>
                        )
                    })}
                    {!isReadOnly && (
                         <tr>
                            <td colSpan={8} className="px-3 py-2 text-left border-t border-gray-300">
                                <button
                                    onClick={onAddNewChargeableTask}
                                    className="text-sm font-semibold text-cyan-700 hover:text-cyan-900 flex items-center gap-1"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                                    </svg>
                                    Ajouter une tâche chargeable
                                </button>
                            </td>
                        </tr>
                    )}
                    <TotalsRow label="Sous-Total (I)" totals={chargeableTotals} isBold />
                    
                    <tr className="bg-cyan-200/50">
                        <td colSpan={8} className="px-3 py-1.5 text-sm font-bold text-cyan-800">Temps non chargeable :</td>
                    </tr>
                    {nonChargeableTasks.map(task => {
                         const rowTotal = task.hours.reduce((sum, h) => sum + h, 0);
                        return <TaskRow key={task.id} task={task} onTaskHoursChange={onTaskHoursChange} rowTotal={rowTotal} isReadOnly={isReadOnly} />;
                    })}
                    <TotalsRow label="Sous-Total (II)" totals={nonChargeableTotals} isBold />

                    <tr className="h-4"><td colSpan={8}></td></tr>

                    <TotalsRow label="TOTAL GENERAL (I) + (II)" totals={generalTotals} isBold />
                    <TotalsRow label="Total Heures Normales" totals={normalHoursWithTotal} />
                    <TotalsRow label="Heures supplémentaires" totals={overtimeTotals} />
                </tbody>
            </table>
        </div>
    );
};

export default Timesheet;
