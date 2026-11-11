const round = (value) => Number((Number(value) || 0).toFixed(2));

const formatDate = (value) => new Intl.DateTimeFormat('en-GB', {
  day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC'
}).format(new Date(value));

const stateCode = (details = {}) => String(details.stateCode || '').replace(/\D/g, '').padStart(2, '0').slice(-2) || '36';

const address = (details = {}) => {
  const lines = String(details.address || '').split(/\r?\n|,/).map((line) => line.trim()).filter(Boolean);
  const line1 = lines.shift() || details.city || details.state || 'NOT AVAILABLE';
  // The government bulk-upload schema validates Addr2 when it is supplied.
  // Always send a usable text value instead of null or a one/two-character
  // fragment from an older invoice.
  const line2 = lines.join(', ') || details.city || details.state || 'NOT AVAILABLE';
  return { line1: line1.length >= 3 ? line1 : 'NOT AVAILABLE', line2: line2.length >= 3 ? line2 : 'NOT AVAILABLE' };
};

const pin = (details = {}) => {
  const match = String(details.pinCode || details.city || details.address || '').match(/\b\d{6}\b/);
  return match ? Number(match[0]) : null;
};

const phone = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length >= 6 && digits.length <= 12 ? digits : undefined;
};

const withOptionalPhone = (details, value) => {
  const normalized = phone(value);
  return normalized ? { ...details, Ph: normalized } : details;
};

function buildEInvoice(report) {
  const company = report.companyDetails || {};
  const party = report.partyDetails || {};
  const sellerAddress = address(company);
  const buyerAddress = address(party);
  const cgstRate = Number(report.cgstRate || 0);
  const sgstRate = Number(report.sgstRate || 0);
  const igstRate = Number(report.igstRate || 0);
  const gstRate = round(cgstRate + sgstRate + igstRate);
  const totalAmount = round(report.totalAmount);
  const cgstAmount = round(report.cgstAmount);
  const sgstAmount = round(report.sgstAmount);
  const igstAmount = round(report.igstAmount);

  return {
    Version: '1.1',
    TranDtls: {
      TaxSch: 'GST',
      SupTyp: party.gstin ? 'B2B' : 'B2C',
      IgstOnIntra: igstRate > 0 ? 'Y' : 'N',
      RegRev: report.invoiceType === 'gst_returnable' ? 'Y' : 'N',
      EcmGstin: null
    },
    DocDtls: { Typ: 'INV', No: report.invoiceNumber, Dt: formatDate(report.invoiceDate) },
    SellerDtls: withOptionalPhone({
      Gstin: company.gstin || null, LglNm: company.name || null, TrdNm: company.name || null,
      Addr1: sellerAddress.line1, Addr2: sellerAddress.line2, Loc: company.city || null,
      Pin: pin(company), Stcd: stateCode(company), Em: company.email || null
    }, company.phone),
    BuyerDtls: withOptionalPhone({
      Gstin: party.gstin || null, LglNm: party.name || null, TrdNm: null,
      Pos: stateCode(party), Addr1: buyerAddress.line1, Addr2: buyerAddress.line2,
      Loc: party.state || null, Pin: pin(party), Stcd: stateCode(party), Em: null
    }, party.phone),
    ValDtls: {
      AssVal: totalAmount, IgstVal: igstAmount, CgstVal: cgstAmount, SgstVal: sgstAmount,
      CesVal: 0, StCesVal: 0, Discount: 0, OthChrg: 0, RndOffAmt: 0, TotInvVal: round(report.grandTotal)
    },
    EwbDtls: null,
    ItemList: (report.lineItems || []).map((item, index) => {
      const amount = round(item.amount);
      const itemCgst = round(amount * cgstRate / 100);
      const itemSgst = round(amount * sgstRate / 100);
      const itemIgst = round(amount * igstRate / 100);
      return {
        SlNo: String(index + 1), PrdDesc: item.description, IsServc: 'N', HsnCd: String(item.hsnCode || report.hsnCode || '').replace(/\D/g, ''),
        Qty: Number(item.quantity), Unit: (item.uom || 'OTH').toUpperCase(), UnitPrice: round(item.rate), TotAmt: amount,
        Discount: 0, PreTaxVal: 0, AssAmt: amount, GstRt: gstRate, IgstAmt: itemIgst, CgstAmt: itemCgst, SgstAmt: itemSgst,
        CesRt: 0, CesAmt: 0, CesNonAdvlAmt: 0, StateCesRt: 0, StateCesAmt: 0, StateCesNonAdvlAmt: 0,
        OthChrg: 0, TotItemVal: round(amount + itemCgst + itemSgst + itemIgst)
      };
    })
  };
}

module.exports = { buildEInvoice };
