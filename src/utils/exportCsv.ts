export const exportToCsv = (data: any[], filename: string) => {
  if (!data || data.length === 0) {
    console.warn("No data provided to exportToCsv");
    return;
  }

  // Extract headers
  const headers = Object.keys(data[0]);

  // Build CSV string
  const csvRows = [];
  
  // Header row
  csvRows.push(headers.map(header => `"${header.replace(/"/g, '""')}"`).join(','));

  // Data rows
  for (const row of data) {
    const values = headers.map(header => {
      const val = row[header];
      const strVal = val === null || val === undefined ? '' : String(val);
      // Escape double quotes and wrap in quotes to handle commas
      return `"${strVal.replace(/"/g, '""')}"`;
    });
    csvRows.push(values.join(','));
  }

  const csvString = csvRows.join('\n');

  // Create Blob and download
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.display = 'none';
  
  document.body.appendChild(link);
  link.click();
  
  // Clean up
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};
