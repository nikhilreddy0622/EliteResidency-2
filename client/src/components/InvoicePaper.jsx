import { forwardRef } from 'react';
import { format } from 'date-fns';
import './invoice.css';

const money = (value) =>
  Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const wholeRupees = (value) => Math.round(Number(value) || 0).toLocaleString('en-IN');

// Company address is stored per invoice. Older invoices only hold the first
// line, so the PIN/state line and the phone / vendor-code line are rebuilt.
const companyLines = (company = {}) => {
  const lines = (company.address || '').split('\n').map((line) => line.trim()).filter(Boolean);
  const text = lines.join(' ');
  if (!/TELANGANA/i.test(text) && company.city) lines.push(company.city);
  if (!/Ph\s*No/i.test(text)) {
    const phone = company.phone ? `Ph No: ${company.phone}` : '';
    const vendor = company.vendorCode ? `VENDOR CODE: ${company.vendorCode}` : '';
    const last = [phone, vendor].filter(Boolean).join(' ');
    if (last) lines.push(last);
  }
  return lines;
};

const partyRegionLine = (party = {}) =>
  [
    party.state ? `${party.state} State` : '',
    party.pinCode ? `Pin Code-${party.pinCode}.` : '',
    party.phone ? `Phone: ${party.phone}` : ''
  ].filter(Boolean).join(', ');

const InvoicePaper = forwardRef(function InvoicePaper({ report }, ref) {
  const company = report.companyDetails || {};
  const party = report.partyDetails || {};
  const bank = report.bankDetails || {};
  const items = report.lineItems || [];
  const date = new Date(report.invoiceDate);
  const uoms = [...new Set(items.map((item) => (item.uom || 'NOS').toUpperCase()))];
  const qtyHeader = uoms.length === 1 && uoms[0] === 'NOS' ? "QTY IN No's" : 'QTY';
  const rates = [...new Set(items.map((item) => Number(item.rate)))];
  const totalQty = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const isReverse = report.invoiceType === 'gst_returnable';
  const taxCell = (amount) => (Number(amount) > 0 ? `Rs. ${money(amount)}` : 'NILL');

  return (
    <div ref={ref} className="inv-paper">
      <div className="inv-page">
        {/* Top bars */}
        <div className="inv-grid3 inv-teal inv-bt inv-bl inv-br">
          <div className="inv-cell inv-br">GSTIN.{company.gstin}</div>
          <div className="inv-cell inv-br inv-center">TAX INVOICE</div>
          <div className="inv-cell">PAN NO. {company.panNo}</div>
        </div>
        <div className="inv-grid3 inv-teal inv-bt inv-bl inv-br">
          <div className="inv-cell inv-br">STATE CODE. {company.stateCode}</div>
          <div className="inv-cell inv-br inv-center">DATE. {format(date, 'dd.MM.yyyy')}</div>
          <div className="inv-cell">INVOICE NO. {report.invoiceNumber}</div>
        </div>

        {/* Company header */}
        <div className="inv-box inv-header">
          <div className="inv-company-name">{company.name}</div>
          {companyLines(company).map((line, i) => <div className="inv-company-line" key={i}>{line}</div>)}
        </div>

        <div className="inv-box inv-teal inv-delivery">
          <div>DELIVERY CHALLAN NO.: {report.deliveryChallanNo || ''}</div>
          <div className="inv-center">{report.billType || 'CASH/CREDIT BILL'}</div>
          <div className="inv-right">E-mail : {company.email || 'bfbprasad@gmail.com'}</div>
        </div>

        {/* Party */}
        <div className="inv-box inv-party">
          <div className="inv-party-left">
            <div>NAME OF THE PARTY: {party.name}</div>
            <div className="inv-party-address">PARTY ADDRESS: {party.address}</div>
            <div className="inv-party-region">{partyRegionLine(party)}</div>
            <div className="inv-party-codes">
              <div>HSN CODE : {items[0]?.hsnCode || report.hsnCode || '6815.99.10'}</div>
              <div>PARTY GSTIN: {report.invoiceType === 'non_gst' ? 'NILL' : (party.gstin || 'NILL')}</div>
              <div>PAN NO : {party.panNo || (party.gstin ? party.gstin.substring(2, 12) : '')}</div>
            </div>
          </div>
          <div className="inv-party-right">
            <div className="inv-po">PO. NO. {report.poNumber || ''}</div>
            <div className="inv-codes">
              <span>VENDOR CODE</span><span>:</span><span>{company.vendorCode || '1021036'}</span>
              {report.vehicleNo ? (<><span>VEHICLE NO.</span><span>:</span><span>{report.vehicleNo}</span></>) : null}
            </div>
          </div>
        </div>

        {/* Items — grows to fill the page so the totals always sit at the bottom */}
        <div className="inv-items">
          <table className="inv-table">
            <colgroup>
              <col style={{ width: '7%' }} /><col style={{ width: '43%' }} /><col style={{ width: '16%' }} />
              <col style={{ width: '16%' }} /><col style={{ width: '18%' }} />
            </colgroup>
            <thead>
              <tr>
                <th>S.NO.</th><th>PRODUCT DESCRIPTION</th><th>{qtyHeader}</th><th>RATE in Rs.</th><th>AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td className="inv-desc">{item.description}</td>
                  <td>{Number(item.quantity).toLocaleString('en-IN')}</td>
                  <td>{Number(item.rate).toFixed(2)}</td>
                  <td>Rs. {money(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="inv-items-spacer" />
        </div>

        {/* TOTAL box now starts at the left edge */}
        <div className="inv-totalrow">
          <div className="inv-tr-label">TOTAL</div>
          <div className="inv-tr-qty">{totalQty.toLocaleString('en-IN')}</div>
          <div className="inv-tr-rate">{rates.length === 1 ? rates[0].toFixed(2) : ''}</div>
          <div className="inv-tr-amt">Rs. {money(report.totalAmount)}</div>
        </div>

        <div className="inv-tax">
          <div className={`inv-tax-note ${isReverse ? 'is-reverse' : ''}`}>
            {isReverse ? '"TAX HAS TO PAID UNDER REVERSE CHARGE"' : ''}
          </div>
          <div className="inv-tax-sum">
            <div><span>TOTAL AMOUNT =</span><span>Rs. {money(report.totalAmount)}</span></div>
            <div><span>ADD CGST : {report.cgstRate}%</span><span>{taxCell(report.cgstAmount)}</span></div>
            <div><span>ADD SGST : {report.sgstRate}%</span><span>{taxCell(report.sgstAmount)}</span></div>
            <div><span>ADD IGST : {report.igstRate > 0 ? `${report.igstRate}%` : ''}</span><span>{taxCell(report.igstAmount)}</span></div>
            <div><span>TOTAL</span><span>Rs. {wholeRupees(report.grandTotal)}</span></div>
          </div>
        </div>

        <div className="inv-box inv-words">AMOUNT IN WORDS : {report.amountInWords}</div>

        <div className="inv-box inv-bank">
          <div className="inv-bank-left">
            <div className="inv-underline">BANK DETAILS</div>
            <div>{company.name}</div>
            <div>BANK A/C NO : {bank.accountNo || '22962000000396'}</div>
            <div>RTGS/IFSC CODE : {bank.ifscCode || 'HDFC0002296'}</div>
            <div>{bank.bankName || 'HDFC BANK'}</div>
            <div>{bank.branch || 'BHADRACHALAM -507111'}</div>
          </div>
          <div className="inv-bank-right">
            <div>For, {company.name}</div>
            <div>AUTHORISED SIGNATURE</div>
          </div>
        </div>
        <div className="inv-box inv-note">NOTE: DETAILS SHEET ENCLOSED HERE WITH</div>
      </div>
    </div>
  );
});

export default InvoicePaper;
