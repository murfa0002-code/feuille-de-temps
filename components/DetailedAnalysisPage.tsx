
import React, { useState, useMemo } from 'react';
import { TimesheetData, Profile, TaskCategory } from '../types';
import DownloadIcon from './icons/DownloadIcon';

interface DetailedAnalysisPageProps {
    allTimesheets: TimesheetData[];
    employees: Profile[];
    availableChargeableTasks: string[];
    onExport: (reportData: any[], headers: string[]) => void;
}

// Helper to add days to a date string, crucial for correct date calculation
const addDays = (dateStr: string, days: number): Date => {
    const date = new Date(`${dateStr}T00:00:00Z`); // Assume UTC to avoid timezone issues
    date.setUTCDate(date.getUTCDate() + days);
    return date;
};

const DetailedAnalysisPage: React.FC<DetailedAnalysisPageProps> = ({
    allTimesheets,
    employees,
    availableChargeableTasks,
    onExport
}) => {
    // Filters State
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
    const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
    const [groupBy, setGroupBy] = useState<'task' | 'employee' | 'day'>('task');
    
    // Results State
    const [reportData, setReportData] = useState<any[] | null>(null);
    const [summary, setSummary] = useState<{ total: number; chargeable: number; nonChargeable: number } | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleGenerateReport = () => {
        if (!startDate || !endDate) {
            setError('Veuillez sélectionner une période de début et de fin.');
            return;
        }
        setError('');
        setIsLoading(true);
        setReportData(null);
        setSummary(null);


        const start = new Date(`${startDate}T00:00:00Z`);
        const end = new Date(`${endDate}T23:59:59Z`);
        
        let filteredData: { date: Date; employeeId: string; taskName: string; category: TaskCategory; hours: number }[] = [];
        let totalChargeable = 0;
        let totalNonChargeable = 0;

        const employeeFilter = new Set(selectedEmployees.length > 0 ? selectedEmployees : employees.map(e => e.id));
        const taskFilter = new Set(selectedTasks);

        allTimesheets.forEach(ts => {
            if (!employeeFilter.has(ts.employee_id)) return;

            const tsStart = new Date(`${ts.start_date}T00:00:00Z`);
            const tsEnd = new Date(`${ts.end_date}T23:59:59Z`);
            
            // Check for week overlap
            if (tsStart > end || tsEnd < start) return;
            
            ts.tasks.forEach(task => {
                if (task.category === TaskCategory.CHARGEABLE && selectedTasks.length > 0 && !taskFilter.has(task.name)) {
                    return;
                }

                task.hours.forEach((h, dayIndex) => {
                    if (h > 0) {
                        const dayDate = addDays(ts.start_date, dayIndex);
                        if (dayDate >= start && dayDate <= end) {
                            filteredData.push({
                                date: dayDate,
                                employeeId: ts.employee_id,
                                taskName: task.name,
                                category: task.category,
                                hours: h
                            });
                            if (task.category === TaskCategory.CHARGEABLE) {
                                totalChargeable += h;
                            } else {
                                totalNonChargeable += h;
                            }
                        }
                    }
                });
            });
        });

        const employeeMap = new Map(employees.map(e => [e.id, e.name]));
        const groupedResult: { [key: string]: any } = {};

        filteredData.forEach(item => {
            const employeeName = employeeMap.get(item.employeeId) || 'Inconnu';
            if (groupBy === 'task') {
                const key = `${item.taskName}__${employeeName}`;
                if (!groupedResult[key]) {
                    groupedResult[key] = { 'Tâche': item.taskName, 'Collaborateur': employeeName, 'Heures Totales': 0 };
                }
                groupedResult[key]['Heures Totales'] += item.hours;
            } else if (groupBy === 'employee') {
                const key = `${employeeName}__${item.taskName}`;
                if (!groupedResult[key]) {
                    groupedResult[key] = { 'Collaborateur': employeeName, 'Tâche': item.taskName, 'Heures Totales': 0 };
                }
                groupedResult[key]['Heures Totales'] += item.hours;
            } else { // day
                const key = `${item.date.toISOString().split('T')[0]}__${employeeName}__${item.taskName}`;
                 if (!groupedResult[key]) {
                    groupedResult[key] = { 
                        'Date': item.date,
                        'Collaborateur': employeeName, 
                        'Tâche': item.taskName,
                        'Heures': 0
                    };
                }
                groupedResult[key]['Heures'] += item.hours;
            }
        });
        
        let finalReportData = Object.values(groupedResult);
        
        if (groupBy === 'day') {
           finalReportData
            .sort((a, b) => a.Date.getTime() - b.Date.getTime() || a.Collaborateur.localeCompare(b.Collaborateur))
            .forEach(item => { item.Date = item.Date.toLocaleDateString('fr-FR'); });
        } else {
            finalReportData.sort((a,b) => (a['Tâche'] || a['Collaborateur']).localeCompare(b['Tâche'] || b['Collaborateur']));
        }

        setReportData(finalReportData);
        setSummary({
            total: totalChargeable + totalNonChargeable,
            chargeable: totalChargeable,
            nonChargeable: totalNonChargeable
        });
        setIsLoading(false);
    };

    const tableHeaders = useMemo(() => {
        if (!reportData) return [];
        if (groupBy === 'task') return ['Tâche', 'Collaborateur', 'Heures Totales'];
        if (groupBy === 'employee') return ['Collaborateur', 'Tâche', 'Heures Totales'];
        if (groupBy === 'day') return ['Date', 'Collaborateur', 'Tâche', 'Heures'];
        return [];
    }, [groupBy, reportData]);


    const renderTable = () => {
        if (isLoading) return <div className="text-center p-10">Génération du rapport...</div>;
        if (!reportData) return <div className="text-center text-gray-500 p-10">Veuillez configurer les filtres et générer un rapport pour voir les données.</div>;
        if (reportData.length === 0) return <div className="text-center text-gray-500 p-10">Aucune donnée trouvée pour les critères sélectionnés.</div>;
        
        return (
             <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-300">
                    <thead className="bg-gray-100">
                        <tr>
                            {tableHeaders.map(header => (
                                <th key={header} className="px-4 py-2 text-left text-sm font-semibold text-gray-600 border-b">{header}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {reportData.map((row, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                                {tableHeaders.map(header => (
                                    <td key={header} className="px-4 py-2 border-b text-sm text-gray-800">
                                        {typeof row[header] === 'number' ? row[header].toLocaleString('fr-FR') : row[header]}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };
    
    return (
        <section aria-labelledby="detailed-analysis-title">
            <h2 id="detailed-analysis-title" className="text-2xl font-bold text-gray-800 mb-6">Analyse Détaillée</h2>

            {/* Filters */}
            <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 mb-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div>
                        <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">Date de début</label>
                        <input type="date" id="startDate" value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-1 block w-full px-2 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-cyan-500 focus:border-cyan-500"/>
                    </div>
                    <div>
                        <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">Date de fin</label>
                        <input type="date" id="endDate" value={endDate} onChange={e => setEndDate(e.target.value)} className="mt-1 block w-full px-2 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-cyan-500 focus:border-cyan-500"/>
                    </div>
                    <div>
                        <label htmlFor="groupBy" className="block text-sm font-medium text-gray-700">Regrouper par</label>
                        <select id="groupBy" value={groupBy} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setGroupBy(e.target.value as 'task' | 'employee' | 'day')} className="mt-1 block w-full px-2 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-cyan-500 focus:border-cyan-500">
                            <option value="task">Tâche</option>
                            <option value="employee">Collaborateur</option>
                            <option value="day">Jour</option>
                        </select>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label htmlFor="employees" className="block text-sm font-medium text-gray-700">Collaborateurs (laisser vide pour tous)</label>
                        <select id="employees" multiple value={selectedEmployees} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedEmployees(Array.from(e.target.selectedOptions, (option: HTMLOptionElement) => option.value))} className="mt-1 block w-full h-32 px-2 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-cyan-500 focus:border-cyan-500">
                            {employees.filter(e => e.role !== 'admin').map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="tasks" className="block text-sm font-medium text-gray-700">Tâches chargeables (laisser vide pour toutes)</label>
                        <select id="tasks" multiple value={selectedTasks} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedTasks(Array.from(e.target.selectedOptions, (option: HTMLOptionElement) => option.value))} className="mt-1 block w-full h-32 px-2 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-cyan-500 focus:border-cyan-500">
                            {availableChargeableTasks.map(task => <option key={task} value={task}>{task}</option>)}
                        </select>
                    </div>
                </div>
                
                {error && <p className="text-sm text-red-600 text-center">{error}</p>}
                
                <div className="flex justify-end pt-4 border-t">
                     <button onClick={handleGenerateReport} disabled={isLoading} className="px-6 py-2 bg-cyan-600 text-white font-semibold rounded-md hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 disabled:bg-gray-400">
                        {isLoading ? 'Chargement...' : 'Générer le rapport'}
                    </button>
                </div>
            </div>

            {summary && reportData && (
                <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 mb-8">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-gray-800">Résultats du Rapport</h3>
                        <button onClick={() => onExport(reportData, tableHeaders)} disabled={reportData.length === 0} className="flex items-center gap-2 px-3 py-1.5 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 text-sm font-medium disabled:bg-gray-400">
                            <DownloadIcon className="w-4 h-4" />
                            Exporter
                        </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                        <div className="bg-gray-100 p-4 rounded-md">
                            <p className="text-sm text-gray-600">Total Heures</p>
                            <p className="text-2xl font-bold text-gray-900">{summary.total.toLocaleString('fr-FR')}</p>
                        </div>
                        <div className="bg-green-100 p-4 rounded-md">
                            <p className="text-sm text-green-700">Total Chargeable</p>
                            <p className="text-2xl font-bold text-green-800">{summary.chargeable.toLocaleString('fr-FR')}</p>
                        </div>
                        <div className="bg-yellow-100 p-4 rounded-md">
                            <p className="text-sm text-yellow-700">Total Non Chargeable</p>
                            <p className="text-2xl font-bold text-yellow-800">{summary.nonChargeable.toLocaleString('fr-FR')}</p>
                        </div>
                    </div>
                </div>
            )}
             
            {renderTable()}

        </section>
    );
};

export default DetailedAnalysisPage;
