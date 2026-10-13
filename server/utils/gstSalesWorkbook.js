const ExcelJS = require('exceljs');

const thinBorder = { style: 'thin', color: { argb: 'FF000000' } };
const monthLabel = (date) => new Intl.DateTimeFormat('en-IN', { month: 'long', year: '2-digit', timeZone: 'UTC' }).format(date).toUpperCase().replace(' ', '- ');
const toDate = (value) => new Date(value);
const fmtDate = (value) => new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(toDate(value)).replaceAll('/', '.');

const taxRate = (report) => Number(((Number(report.cgstRate || 0) + Number(report.sgstRate || 0) + Number(report.igstRate || 0)) / 100).toFixed(4));

async function buildGstSalesWorkbook(reports, { month }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'BHARATH ELITE ENTERPRISES';
  workbook.calcProperties.fullCalcOnLoad = true;
  const sheet = workbook.addWorksheet('Sales Invoice', { views: [{ showGridLines: false }] });
  sheet.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  const widths = [13.285, 16.57, 17.285, 36.57, 25.57, 20.14, 13, 75.71, 14.14, 12.71, 11.14, 17.14, 10.14, 16.285, 16.71, 17, 23.71, 12.71, 12.71];
  widths.forEach((width, index) => { sheet.getColumn(index + 1).width = width; });
  sheet.mergeCells('A2:C2');
  sheet.mergeCells('E2:Q2');
  const selectedDate = month ? new Date(`${month}-01T00:00:00Z`) : reports[0]?.invoiceDate || new Date();
  sheet.getCell('A2').value = `${monthLabel(selectedDate)} SALES   `;
  sheet.getCell('D2').value = reports[0]?.companyDetails?.gstin || '36AJVPP5821A1Z2';
  sheet.getRow(2).height = 45.75;
  sheet.getRow(3).height = 83.25;
  const titleStyle = { font: { name: 'Times New Roman', size: 20, bold: true }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } }, alignment: { horizontal: 'center', vertical: 'middle', wrapText: true }, border: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder } };
  sheet.getCell('A2').style = titleStyle;
  sheet.getCell('D2').style = titleStyle;
  const headers = ['Document Type Code', 'Document Date*', 'Document Number*', 'Recipient Billing Name', 'Recipient Billing GSTIN', 'Place of Supply ', 'Is the item a GOOD (G) or SERVICE (S)', 'Item Description', 'HSN or SAC code', 'Quantity', 'Item Unit of Measurement', 'Item Taxable Value*', 'TAX RATE', 'CGST Amount', 'SGST Amount', 'IGST Amount', 'Total Document Value', 'HWPM ASH DETE'];
  const headerFills = ['FFFEF2CB', 'FFD9E2F3', 'FFD9E2F3', 'FFD9EAD3', 'FFD9EAD3', 'FFD9EAD3', 'FFD9E2F3', 'FFD9E2F3', 'FFD9E2F3', 'FFD9E2F3', 'FFD9E2F3', 'FFFCE4D6', 'FFFCE4D6', 'FFFCE4D6', 'FFFCE4D6', 'FFFCE4D6', 'FFFCE4D6', 'FFD9E2F3'];
  headers.forEach((header, index) => {
    const cell = sheet.getCell(3, index + 1);
    cell.value = [2, 3, 12].includes(index + 1)
      ? { richText: [{ text: header.slice(0, -1) }, { text: '*', font: { name: 'Times New Roman', size: 14, bold: true, color: { argb: 'FFFF0000' } } }] }
      : header;
    cell.font = { name: 'Times New Roman', size: 14, bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerFills[index] } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = { left: thinBorder, right: thinBorder, top: thinBorder, bottom: thinBorder };
  });
  let rowIndex = 4;
  reports.forEach((report) => (report.lineItems || []).forEach((item) => {
    const row = sheet.getRow(rowIndex);
    const rate = taxRate(report);
    const b2b = Boolean(report.partyDetails?.gstin);
    const taxable = Number(item.amount || 0);
    const cgst = Number((taxable * rate / 2).toFixed(2));
    const sgst = Number((taxable * rate / 2).toFixed(2));
    const igst = report.igstRate ? Number((taxable * Number(report.igstRate) / 100).toFixed(2)) : 0;
    const values = [b2b ? 'B2B' : 'B2C', fmtDate(report.invoiceDate), report.invoiceNumber, report.partyDetails?.name || '', report.partyDetails?.gstin || '', (report.partyDetails?.state || 'TELANGANA').toUpperCase(), 'S', item.description || '', item.exportHsnCode !== undefined ? item.exportHsnCode : (item.hsnCode || ''), item.exportQuantity !== undefined ? item.exportQuantity : (item.quantity ?? ''), item.uom || 'OTH', taxable, rate, { formula: `L${rowIndex}*M${rowIndex}/2`, result: cgst }, { formula: `L${rowIndex}*M${rowIndex}/2`, result: sgst }, report.igstRate ? { formula: `L${rowIndex}*${Number(report.igstRate) / 100}`, result: igst } : '', { formula: `L${rowIndex}+N${rowIndex}+O${rowIndex}+P${rowIndex}`, result: Number((taxable + cgst + sgst + igst).toFixed(2)) }, report.notes?.includes('Cancelled') ? 'Cancelled' : ''];
    values.forEach((value, column) => { const cell = row.getCell(column + 1); cell.value = value; cell.font = { name: 'Times New Roman', size: 14 }; cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; cell.border = { left: thinBorder, right: thinBorder, top: thinBorder, bottom: thinBorder }; });
    row.getCell(12).numFmt = '0.00'; row.getCell(13).numFmt = '0%'; [14, 15, 16, 17].forEach((column) => { row.getCell(column).numFmt = '0.00'; });
    row.height = 25.5;
    rowIndex += 1;
  }));
  const total = sheet.getRow(rowIndex);
  total.getCell(11).value = 'TOTAL';
  [12, 13, 14, 15, 16, 17].forEach((column) => { const letter = sheet.getColumn(column).letter; const result = reports.reduce((sum, report) => sum + (report.lineItems || []).reduce((lineTotal, item) => lineTotal + (column === 12 ? Number(item.amount || 0) : column === 13 ? taxRate(report) : column === 14 ? Number((Number(item.amount || 0) * taxRate(report) / 2).toFixed(2)) : column === 15 ? Number((Number(item.amount || 0) * taxRate(report) / 2).toFixed(2)) : column === 16 ? Number((Number(item.amount || 0) * Number(report.igstRate || 0) / 100).toFixed(2)) : Number((Number(item.amount || 0) * (1 + taxRate(report))).toFixed(2))), 0), 0); total.getCell(column).value = { formula: `SUM(${letter}4:${letter}${rowIndex - 1})`, result }; total.getCell(column).numFmt = column === 13 ? '0%' : '0.00'; });
  for (let column = 1; column <= 18; column += 1) { const cell = total.getCell(column); cell.font = { name: 'Times New Roman', size: 14, bold: true }; cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; cell.border = { left: thinBorder, right: thinBorder, top: thinBorder, bottom: thinBorder }; }
  const validation = workbook.addWorksheet('Data Validation');
  validation.addRow(['Item_Category', 'Credit Debit', 'Tax Rate']);
  [['G', 'C', 0], ['S', 'D', 0.1], ['NA', '', 0.25], ['', '', 3], ['', '', 5], ['', '', 12], ['', '', 18], ['', '', 28]].forEach((row) => validation.addRow(row));
  return workbook;
}

module.exports = { buildGstSalesWorkbook };
