import React, { useMemo, useState } from 'react';
import { Task, TaskCategory, Profile, TimesheetData } from '../types';
import { DAYS_OF_WEEK } from '../constants';
import DownloadIcon from './icons/DownloadIcon';

interface AnalysisPageProps {
  currentUser: Profile;
  employees: Profile[];
  allTimesheets: TimesheetData[];
  currentTimesheet: TimesheetData;
  onExport: (analysisData: any) => void;
  onExportAdmin: (adminAnalysisData: any[]) => void;
}

const StatCard: React.FC<{ label: string; value: string; subtext?: string; }> = ({ label, value, subtext }) => (
    <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <p className="text-3xl font-bold text-gray-800 mt-1">{value}</p>
        {subtext && <p className="text-xs text-gray-400 mt-2">{subtext}</p>}
    </div>
);

// Helper function to calculate analysis data for a given set of tasks.
const calculateAnalysis = (tasks: Task[], normalHours: number[], selectedDays: number[]) => {
    const sumHours = (taskList: Task[]) => {
        return taskList.reduce((total, task) => {
            const taskHours = task.hours.reduce((taskSum, hour, i) => 
                selectedDays.includes(i) ? taskSum + hour : taskSum, 0);
            return total + taskHours;
        }, 0);
    };
    
    const chargeable = tasks.filter(t => t.category === TaskCategory.CHARGEABLE && t.name);
    const nonChargeable = tasks.filter(t => t.category === TaskCategory.NON_CHARGEABLE);

    const totalChargeableHours = sumHours(chargeable);
    const totalNonChargeableHours = sumHours(nonChargeable);
    const grandTotalHours = totalChargeableHours + totalNonChargeableHours;
    
    const totalNormalHours = normalHours.reduce((sum, hour, i) => 
        selectedDays.includes(i) ? sum + hour : sum, 0);
    const totalOvertime = Math.max(0, grandTotalHours - totalNormalHours);

    const chargeableSummary = chargeable.map(task => {
        const taskTotal = task.hours.reduce((sum, h, i) => selectedDays.includes(i) ? sum + h : sum, 0);
        return {
            name: task.name,
            totalHours: taskTotal,
        };
    }).filter(t => t.totalHours > 0).sort((a, b) => b.totalHours - a.totalHours);

    return {
        totalChargeableHours,
        totalNonChargeableHours,
        grandTotalHours,
        totalOvertime,
        chargeableSummary,
        chargeablePercentage: grandTotalHours > 0 ? (totalChargeableHours / grandTotalHours) * 100 : 0,
    };
};

const AnalysisPage: React.FC<AnalysisPageProps> = ({ currentUser, employees, allTimesheets, currentTimesheet, onExport, onExportAdmin }) => {
    const { tasks, normal_hours } = currentTimesheet;
    const allDaysIndexes = useMemo(() => DAYS_OF_WEEK.map((_, i) => i), []);
    const [selectedDays, setSelectedDays] = useState<number[]>(allDaysIndexes);

    const adminAnalysisData = useMemo(() => {
        if (currentUser.role !== 'admin') return [];

        const relevantTimesheets = allTimesheets.filter(ts => 
            ts.start_date === currentTimesheet.start_date && 
            ts.end_date === currentTimesheet.end_date
        );

        return employees
            .filter(employee => employee.role !== 'admin')
            .map(employee => {
                const employeeTimesheet = relevantTimesheets.find(ts => ts.employee_id === employee.id);
                if (!employeeTimesheet) return {
                    employeeId: employee.id,
                    employeeName: employee.name,
                    grandTotalHours: 0,
                    chargeablePercentage: 0,
                    totalChargeableHours: 0,
                    totalNonChargeableHours: 0,
                    totalOvertime: 0,
                    chargeableSummary: [],
                };

                const analysis = calculateAnalysis(employeeTimesheet.tasks, employeeTimesheet.normal_hours, allDaysIndexes);
                return {
                    employeeId: employee.id,
                    employeeName: employee.name,
                    ...analysis
                };
            });
    }, [currentUser.role, employees, allTimesheets, currentTimesheet, allDaysIndexes]);
    
    const handleDayToggle = (dayIndex: number) => {
        setSelectedDays(prev => 
            prev.includes(dayIndex) 
                ? prev.filter(i => i !== dayIndex) 
                : [...prev, dayIndex]
        );
    };

    const toggleAllDays = () => {
        if (selectedDays.length === allDaysIndexes.length) {
            setSelectedDays([]);
        } else {
            setSelectedDays(allDaysIndexes);
        }
    };

    const analysisData = useMemo(() => {
        return calculateAnalysis(tasks, normal_hours, selectedDays);
    }, [tasks, normal_hours, selectedDays]);

    const maxHours = Math.max(...analysisData.chargeableSummary.map(t => t.totalHours), 1);
    
    // An admin sees the global view only when viewing their own timesheet.
    // Otherwise, they see the individual analysis for the selected employee.
    const showGlobalAdminView = currentUser.role === 'admin' && currentUser.id === currentTimesheet.employee_id;

    if (showGlobalAdminView) {
        return (
            <section aria-labelledby="admin-analysis-title">
                <h2 id="admin-analysis-title" className="text-2xl font-bold text-gray-800 mb-6">
                    Analyse Globale des Collaborateurs
                </h2>
                <div className="bg-white p-4 rounded-lg shadow-md border border-gray-200 mb-8">
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="text-md font-semibold text-gray-700">Performance pour la période</h3>
                            <p className="text-sm text-gray-500">Du {new Date(currentTimesheet.start_date).toLocaleDateString('fr-FR')} au {new Date(currentTimesheet.end_date).toLocaleDateString('fr-FR')}</p>
                        </div>
                        <button
                            onClick={() => onExportAdmin(adminAnalysisData)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 text-sm font-medium"
                        >
                            <DownloadIcon className="w-4 h-4" />
                            Exporter l'analyse globale
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full bg-white border border-gray-300">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="px-4 py-2 text-left text-sm font-semibold text-gray-600 border-b">Collaborateur</th>
                                <th className="px-4 py-2 text-right text-sm font-semibold text-gray-600 border-b">H. Totales</th>
                                <th className="px-4 py-2 text-right text-sm font-semibold text-gray-600 border-b">H. Chargeables</th>
                                <th className="px-4 py-2 text-right text-sm font-semibold text-gray-600 border-b">Taux Chargeable</th>
                                <th className="px-4 py-2 text-right text-sm font-semibold text-gray-600 border-b">H. Sup.</th>
                            </tr>
                        </thead>
                        <tbody>
                            {adminAnalysisData.map(data => (
                                <tr key={data.employeeId} className="hover:bg-gray-50">
                                    <td className="px-4 py-2 border-b text-sm text-gray-800">{data.employeeName}</td>
                                    <td className="px-4 py-2 border-b text-sm text-gray-800 text-right">{data.grandTotalHours.toLocaleString('fr-FR')}</td>
                                    <td className="px-4 py-2 border-b text-sm text-gray-800 text-right">{data.totalChargeableHours.toLocaleString('fr-FR')}</td>
                                    <td className="px-4 py-2 border-b text-sm text-gray-800 text-right font-medium">{data.chargeablePercentage.toFixed(1)}%</td>
                                    <td className="px-4 py-2 border-b text-sm text-gray-800 text-right">{data.totalOvertime.toLocaleString('fr-FR')}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        )
    }

    const viewedEmployee = employees.find(e => e.id === currentTimesheet.employee_id);
    const viewedEmployeeName = viewedEmployee?.name || 'Collaborateur';

    return (
        <section aria-labelledby="analysis-title">
            <h2 id="analysis-title" className="text-2xl font-bold text-gray-800 mb-6">
                Analyse de Performance: {viewedEmployeeName}
            </h2>

            <div className="bg-white p-4 rounded-lg shadow-md border border-gray-200 mb-8">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-md font-semibold text-gray-700">Filtres et Actions</h3>
                   <button
                        onClick={() => onExport(analysisData)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 text-sm font-medium"
                    >
                        <DownloadIcon className="w-4 h-4" />
                        Exporter
                    </button>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-2 items-center border-t pt-4">
                    {DAYS_OF_WEEK.map((day, index) => (
                        <label key={day} className="flex items-center space-x-2 text-sm text-gray-600 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={selectedDays.includes(index)}
                                onChange={() => handleDayToggle(index)}
                                className="h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                            />
                            <span>{day}</span>
                        </label>
                    ))}
                    <button 
                        onClick={toggleAllDays}
                        className="ml-auto text-sm font-medium text-cyan-700 hover:underline"
                    >
                        {selectedDays.length === allDaysIndexes.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                    </button>
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard label="Heures totales travaillées" value={analysisData.grandTotalHours.toLocaleString('fr-FR')} />
                <StatCard label="Taux d'heures chargeables" value={`${analysisData.chargeablePercentage.toFixed(1)}%`} subtext={`${analysisData.totalChargeableHours.toLocaleString('fr-FR')}h / ${analysisData.grandTotalHours.toLocaleString('fr-FR')}h`} />
                <StatCard label="Heures non chargeables" value={analysisData.totalNonChargeableHours.toLocaleString('fr-FR')} />
                <StatCard label="Heures supplémentaires" value={analysisData.totalOvertime.toLocaleString('fr-FR')} />
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-700 mb-4">Répartition du temps chargeable</h3>
                {analysisData.chargeableSummary.length > 0 ? (
                    <div className="space-y-4">
                        {analysisData.chargeableSummary.map(task => (
                            <div key={task.name} className="grid grid-cols-3 sm:grid-cols-5 gap-4 items-center">
                                <p className="text-sm font-medium text-gray-600 col-span-1 sm:col-span-2 truncate" title={task.name}>{task.name}</p>
                                <div className="col-span-1 sm:col-span-2">
                                    <div className="w-full bg-gray-200 rounded-full h-4">
                                        <div 
                                            className="bg-cyan-500 h-4 rounded-full transition-all duration-500 ease-out" 
                                            style={{ width: `${(task.totalHours / maxHours) * 100}%` }}
                                            role="progressbar"
                                            aria-valuenow={task.totalHours}
                                            aria-valuemin={0}
                                            aria-valuemax={maxHours}
                                            aria-label={`Hours for ${task.name}`}
                                        ></div>
                                    </div>
                                </div>
                                <p className="text-sm font-bold text-gray-800 text-right">{task.totalHours.toLocaleString('fr-FR')}h</p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center text-gray-500 py-8">
                        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V7a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <h3 className="mt-2 text-sm font-medium text-gray-900">Aucune donnée chargeable pour la sélection</h3>
                        <p className="mt-1 text-sm text-gray-500">Ajoutez des heures ou modifiez votre sélection de jours pour voir les résultats.</p>
                    </div>
                )}
            </div>
        </section>
    );
};

export default AnalysisPage;