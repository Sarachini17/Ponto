/**
 * Thermal Printer Interface, Hardware Status Monitor & Email Receipt Fallback (RF-02, RF-08, RF-09)
 */
const PrinterModule = {
  // Simulated hardware status state: 'operational' | 'no_paper' | 'hardware_defect'
  hardwareStatus: 'operational',

  setHardwareStatus(status) {
    this.hardwareStatus = status;
    this.updatePrinterUI();
  },

  updatePrinterUI() {
    const badge = document.getElementById('printer-status');
    const text = document.getElementById('printer-text');
    if (!badge || !text) return;

    if (this.hardwareStatus === 'operational') {
      badge.className = 'status-badge printer-ok';
      text.textContent = 'Impressora Operacional';
    } else if (this.hardwareStatus === 'no_paper') {
      badge.className = 'status-badge printer-error';
      text.textContent = 'Sem Papel';
    } else {
      badge.className = 'status-badge printer-error';
      text.textContent = 'Defeito na Impressora';
    }
  },

  /**
   * Generates thermal ticket receipt content according to RF-02
   */
  generateReceiptText(punchRecord, employee) {
    const localDate = new Date(punchRecord.timestamp).toLocaleString('pt-BR');
    return `
========================================
 COMPROVANTE DE REGISTRO DE PONTO
========================================
Razão Social: ${employee.companyName || 'Empresa Demo LTDA'}
CNPJ: ${employee.cnpj || '12.345.678/0001-90'}
Endereço: ${employee.address || 'Av. Paulista, 1000 - SP'}
----------------------------------------
Colaborador: ${employee.name}
PIS: ${employee.pis}
Cargo: ${employee.cargo}
Turno: ${employee.turno}
----------------------------------------
Evento: ${punchRecord.eventType}
Data/Hora Local: ${localDate}
Timestamp UTC: ${punchRecord.timestamp}
Autenticação: ${punchRecord.authMethod}
ID do Registro: ${punchRecord.id}
========================================
`.trim();
  },

  /**
   * Attempts physical printing (RF-02) or fallback to digital e-mail receipt (RF-08, RF-09)
   */
  async printReceipt(punchRecord, employee) {
    const receiptText = this.generateReceiptText(punchRecord, employee);

    if (this.hardwareStatus === 'operational') {
      console.log('%c[IMPRESSORA TÉRMICA - TICKET FÍSICO IMPORE100]', 'color: #16a34a; font-weight: bold;', '\n' + receiptText);
      return { success: true, method: 'physical', ticketText: receiptText };
    } else {
      // Hardware failure or out of paper (RF-08 & RF-09)
      console.warn(`Printer unavailable (${this.hardwareStatus}). Triggering digital receipt fallback via e-mail.`);
      this.showHardwareAlertModal(this.hardwareStatus, employee.email || employee.name);
      await this.sendDigitalEmailReceipt(punchRecord, employee, receiptText);
      return { success: true, method: 'digital_email', ticketText: receiptText };
    }
  },

  async sendDigitalEmailReceipt(punchRecord, employee, receiptText) {
    console.log(`[E-MAIL DISPATCH (RF-09)] Sending digital receipt to: ${employee.email || 'funcionario@empresa.com.br'}`);
    console.log('E-mail Content:\n' + receiptText);
    return true;
  },

  showHardwareAlertModal(status, recipientEmail) {
    const modal = document.getElementById('modal-hardware-alert');
    const title = document.getElementById('hardware-alert-title');
    const msg = document.getElementById('hardware-alert-message');

    if (!modal) return;

    if (status === 'no_paper') {
      if (title) title.textContent = 'Impressora Sem Papel';
      if (msg) msg.textContent = `A impressora térmica está sem papel. O comprovante foi enviado para o e-mail: ${recipientEmail}`;
    } else {
      if (title) title.textContent = 'Falha no Hardware da Impressora';
      if (msg) msg.textContent = `Falha na impressora térmica. O comprovante digital foi enviado para o e-mail: ${recipientEmail}`;
    }

    modal.style.display = 'flex';
  }
};

document.addEventListener('DOMContentLoaded', () => {
  PrinterModule.updatePrinterUI();
  const closeBtn = document.getElementById('btn-close-hardware-alert');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      const modal = document.getElementById('modal-hardware-alert');
      if (modal) modal.style.display = 'none';
    });
  }
});
