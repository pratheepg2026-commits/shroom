// services/csvExporter.ts

const convertToCSV = (data: Record<string, any>[]): string => {
    if (!data || data.length === 0) {
        return '';
    }

    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')]; // Header row

    for (const row of data) {
        const values = headers.map(header => {
            let cell = row[header] === null || row[header] === undefined ? '' : row[header];
            cell = String(cell);
            // Escape quotes by doubling them and wrap in quotes if it contains a comma, quote, or newline
            if (cell.includes('"') || cell.includes(',') || cell.includes('\n') || cell.includes('\r')) {
                cell = `"${cell.replace(/"/g, '""')}"`;
            }
            return cell;
        });
        csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
};

export const exportToCSV = (data: Record<string, any>[], filename: string) => {
    if (!data || data.length === 0) {
        console.error("No data available to export.");
        alert("No data to export.");
        return;
    }
    const csvString = convertToCSV(data);
    const blob = new Blob([`\uFEFF${csvString}`], { type: 'text/csv;charset=utf-8;' }); // \uFEFF for BOM
    const link = document.createElement('a');

    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};
