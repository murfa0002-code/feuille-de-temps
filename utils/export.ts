import { TimesheetData, Task, TaskCategory } from '../types';

const downloadCSV = (csvContent: string, fileName: string) => {
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' }); // Add BOM for Excel
    const link = document.createElement("a");
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", fileName);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

const formatNumber = (num: number) => String(num).replace('.', ',');

export const exportTimesheetToCSV = (
    timesheet: TimesheetData, 
    chargeableTasks: Task[], 
    nonChargeableTasks: Task[], 
    employeeName: string, 
    days: string[]
) => {
    let csv = `Feuille de temps pour;${employeeName}\n`;
    csv += `Période du;${new Date(timesheet.start_date).toLocaleDateString('fr-FR')};au;${new Date(timesheet.end_date).toLocaleDateString('fr-FR')}\n\n`;

    const headers = ['Tâche', ...days, 'Total'];
    csv += headers.join(';') + '\n';
    
    const calculateRowTotals = (tasks: Task[]) => {
      const dailyTotals = Array(6).fill(0);
      tasks.forEach(task => {
        task.hours.forEach((h, i) => { dailyTotals[i] += h; });
      });
      const grandTotal = dailyTotals.reduce((a, b) => a + b, 0);
      return [...dailyTotals.map(formatNumber), formatNumber(grandTotal)];
    };

    // Chargeable Tasks
    csv += `"${TaskCategory.CHARGEABLE}"\n`;
    chargeableTasks.forEach(task => {
        const total = task.hours.reduce((a, b) => a + b, 0);
        const row = [`"${task.name}"`, ...task.hours.map(formatNumber), formatNumber(total)];
        csv += row.join(';') + '\n';
    });
    csv += ['Sous-Total (I)', ...calculateRowTotals(chargeableTasks)].join(';') + '\n';

    // Non-Chargeable Tasks
    csv += `\n"${TaskCategory.NON_CHARGEABLE}"\n`;
    nonChargeableTasks.forEach(task => {
        const total = task.hours.reduce((a, b) => a + b, 0);
        const row = [`"${task.name}"`, ...task.hours.map(formatNumber), formatNumber(total)];
        csv += row.join(';') + '\n';
    });
    csv += ['Sous-Total (II)', ...calculateRowTotals(nonChargeableTasks)].join(';') + '\n';
    
    // Grand Totals
    const allTasks = [...chargeableTasks, ...nonChargeableTasks];
    const normalHoursWithTotal = [...timesheet.normal_hours, timesheet.normal_hours.reduce((a, b) => a + b, 0)];
    const generalTotals = calculateRowTotals(allTasks);
    const overtime = generalTotals.map((total, i) => parseFloat(total.replace(',', '.')) - normalHoursWithTotal[i]);

    csv += '\n';
    csv += ['TOTAL GENERAL (I) + (II)', ...generalTotals].join(';') + '\n';
    csv += ['Total Heures Normales', ...normalHoursWithTotal.map(formatNumber)].join(';') + '\n';
    csv += ['Heures supplémentaires', ...overtime.map(formatNumber)].join(';') + '\n';

    downloadCSV(csv, `Feuille_de_temps_${employeeName}_${timesheet.start_date}.csv`);
};

export const exportAnalysisToCSV = (analysisData: any, employeeName: string, period: string) => {
    let csv = `Analyse de performance pour;${employeeName}\n`;
    csv += `Période;${period}\n\n`;

    csv += 'Indicateur;Valeur\n';
    csv += `Heures totales travaillées;${formatNumber(analysisData.grandTotalHours)}\n`;
    csv += `Taux d'heures chargeables;${formatNumber(analysisData.chargeablePercentage)}%\n`;
    csv += `Heures chargeables;${formatNumber(analysisData.totalChargeableHours)}\n`;
    csv += `Heures non chargeables;${formatNumber(analysisData.totalNonChargeableHours)}\n`;
    csv += `Heures supplémentaires;${formatNumber(analysisData.totalOvertime)}\n\n`;

    csv += 'Répartition du temps chargeable\n';
    csv += 'Tâche;Heures\n';
    analysisData.chargeableSummary.forEach((task: { name: string, totalHours: number }) => {
        csv += `"${task.name}";${formatNumber(task.totalHours)}\n`;
    });

    downloadCSV(csv, `Analyse_performance_${employeeName}_${period}.csv`);
};

export const exportAdminAnalysisToCSV = (adminAnalysisData: any[], period: string) => {
    let csv = `Analyse globale des collaborateurs\n`;
    csv += `Période;${period}\n\n`;

    const headers = [
        'Collaborateur',
        'Heures totales travaillées',
        "Taux d'heures chargeables (%)",
        'Heures chargeables',
        'Heures non chargeables',
        'Heures supplémentaires'
    ];
    csv += headers.join(';') + '\n';

    adminAnalysisData.forEach(data => {
        const row = [
            `"${data.employeeName}"`,
            formatNumber(data.grandTotalHours),
            data.chargeablePercentage.toFixed(1).replace('.', ','),
            formatNumber(data.totalChargeableHours),
            formatNumber(data.totalNonChargeableHours),
            formatNumber(data.totalOvertime)
        ];
        csv += row.join(';') + '\n';
    });

    downloadCSV(csv, `Analyse_globale_collaborateurs_${period.replace(' au ', '_')}.csv`);
};

export const exportDetailedAnalysisToCSV = (reportData: any[], headers: string[]) => {
    let csv = headers.join(';') + '\n';

    reportData.forEach(row => {
        const values = headers.map(header => {
            // The key for date might be 'Date' but the object property could be different if not careful.
            // Let's assume keys match headers.
            let value = row[header];
            if (typeof value === 'number') {
                value = formatNumber(value);
            }
            // Ensure values with semicolons or quotes are properly escaped
            if (typeof value === 'string' && (value.includes(';') || value.includes('"') || value.includes('\n'))) {
                return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
        });
        csv += values.join(';') + '\n';
    });

    const fileName = `Analyse_Detaillee_${new Date().toISOString().split('T')[0]}.csv`;
    downloadCSV(csv, fileName);
};