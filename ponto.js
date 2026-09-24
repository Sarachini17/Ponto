/**
 * Ponto Clock Engine & Business Rules Implementation (RF-01, RF-03, RN-01, RN-02, RN-03)
 */
const PontoEngine = {
  pendingPunch: null,

  /**
   * Helper: Parses time string (HH:MM) to total minutes from midnight
   */
  timeStringToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [hours, mins] = timeStr.split(':').map(Number);
    return hours * 60 + mins;
  },

  /**
   * Evaluates business rules RN-01 & RN-02:
   * RN-01: Tolerance of 5 minutes per punch, up to 10 accumulated minutes daily.
   * RN-02: Exceeding 10 accumulated daily tolerance minutes leads to payroll deduction/overtime tracking.
   */
  async evaluateToleranceAndDivergence(employee, eventType, punchDateObj) {
    const punchTimeStr = punchDateObj.toTimeString().substring(0, 5); // "HH:MM"
    const punchMinutes = this.timeStringToMinutes(punchTimeStr);

    let expectedMinutes = punchMinutes;
    if (eventType === 'ENTRADA' && employee.shiftStart) {
      expectedMinutes = this.timeStringToMinutes(employee.shiftStart);
    } else if (eventType === 'SAIDA' && employee.shiftEnd) {
      expectedMinutes = this.timeStringToMinutes(employee.shiftEnd);
    }

    const diffMinutes = Math.abs(punchMinutes - expectedMinutes);

    // Fetch existing punches for today to calculate accumulated tolerance
    const todayStr = punchDateObj.toISOString().split('T')[0];
    const allPunches = await DB.getByIndex('punches', 'employeeId', employee.id);
    const todayPunches = allPunches.filter(p => p.timestamp.startsWith(todayStr));

    let accumulatedDiff = todayPunches.reduce((acc, p) => acc + (p.diffMinutes || 0), 0);
    const newAccumulatedDiff = accumulatedDiff + diffMinutes;

    // Per RN-01: 5min punch tolerance limit, max 10min daily total limit
    const exceedsSinglePunchTolerance = diffMinutes > 5;
    const exceedsDailyAccumulatedTolerance = newAccumulatedDiff > 10;

    const requiresJustification = exceedsSinglePunchTolerance || exceedsDailyAccumulatedTolerance;

    let payrollDeductionMinutes = 0;
    let overtimeMinutes = 0;

    if (requiresJustification && newAccumulatedDiff > 10) {
      // RN-02: Exceeded 10 daily minutes -> full difference counted
      if (punchMinutes < expectedMinutes) {
        payrollDeductionMinutes = diffMinutes; // Lateness / early departure
      } else if (punchMinutes > expectedMinutes) {
        overtimeMinutes = diffMinutes; // Overtime
      }
    }

    return {
      diffMinutes,
      newAccumulatedDiff,
      requiresJustification,
      payrollDeductionMinutes,
      overtimeMinutes
    };
  },

  /**
   * Main entry point to record punch event (RF-01)
   */
  async processPunch(eventType, credentialInput) {
    // 1. Authenticate employee credential (RF-05, RF-06)
    const authResult = await AuthModule.authenticateEmployee(credentialInput);
    if (!authResult.success) {
      return { success: false, message: authResult.message };
    }

    const employee = authResult.employee;
    const authMethod = authResult.authMethod;

    // 2. Capture biometric photo via camera (RF-05)
    const photoBase64 = CameraModule.capturePhoto();

    // 3. Immutability timestamp (RN-03 UTC Timestamp)
    const now = new Date();
    const timestampUtc = now.toISOString();

    // 4. Calculate tolerance & divergence (RN-01, RN-02)
    const toleranceEval = await this.evaluateToleranceAndDivergence(employee, eventType, now);

    const punchRecord = {
      id: 'punch-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      employeeId: employee.id,
      employeeName: employee.name,
      eventType,
      timestamp: timestampUtc, // RN-03 Immutability timestamp UTC
      photo: photoBase64,
      authMethod,
      synced: false,
      diffMinutes: toleranceEval.diffMinutes,
      payrollDeductionMinutes: toleranceEval.payrollDeductionMinutes,
      overtimeMinutes: toleranceEval.overtimeMinutes,
      justification: null
    };

    // If justification required (RF-03), store pending punch and trigger modal
    if (toleranceEval.requiresJustification) {
      this.pendingPunch = { punchRecord, employee };
      this.showJustificationModal(toleranceEval);
      return {
        success: true,
        requiresJustification: true,
        message: 'Marcação excede a tolerância. Preencha a justificativa obrigatória.'
      };
    }

    // Otherwise save immediately and issue receipt
    return await this.finalizePunch(punchRecord, employee);
  },

  /**
   * Finalizes punch creation: saves locally to IndexedDB, sends to Supabase, prints receipt
   */
  async finalizePunch(punchRecord, employee) {
    // RN-03: Immutable record saved to IndexedDB
    await DB.put('punches', punchRecord);

    // RNF-01: Background Sync to Supabase
    SupabaseService.insertPunch(punchRecord).then(res => {
      if (res.success) {
        punchRecord.synced = true;
        DB.put('punches', punchRecord);
      }
    });

    // Check for lates / early departure and log inconsistency if applicable (RF-04)
    if (punchRecord.payrollDeductionMinutes > 0) {
      const inconsistencyRecord = {
        id: 'inc-' + Date.now(),
        employeeId: employee.id,
        employeeName: employee.name,
        type: 'DIVERGENCIA_HORARIO',
        description: `Marcação de ${punchRecord.eventType} com ${punchRecord.payrollDeductionMinutes} minutos de atraso/saída antecipada.`,
        date: punchRecord.timestamp.split('T')[0]
      };
      await DB.put('inconsistencies', inconsistencyRecord);
      SupabaseService.insertInconsistency(inconsistencyRecord);
    }

    // RF-02 / RF-08 / RF-09 Print physical ticket or email digital fallback
    await PrinterModule.printReceipt(punchRecord, employee);

    return {
      success: true,
      requiresJustification: false,
      punchRecord,
      message: `Ponto (${punchRecord.eventType}) registrado com sucesso para ${employee.name}!`
    };
  },

  showJustificationModal(toleranceEval) {
    const modal = document.getElementById('modal-justificativa');
    const msg = document.getElementById('justificativa-message');
    const textarea = document.getElementById('justificativa-text');

    if (!modal) return;

    if (msg) {
      msg.textContent = `A marcação atual possui ${toleranceEval.diffMinutes} minuto(s) de divergência. Justificativa obrigatória (RN-01 / RF-03):`;
    }
    if (textarea) textarea.value = '';

    modal.style.display = 'flex';
  },

  async confirmJustification(justificationText) {
    if (!this.pendingPunch) return;

    const { punchRecord, employee } = this.pendingPunch;
    punchRecord.justification = justificationText;

    const modal = document.getElementById('modal-justificativa');
    if (modal) modal.style.display = 'none';

    const result = await this.finalizePunch(punchRecord, employee);
    this.pendingPunch = null;

    if (window.onPunchCompleted) {
      window.onPunchCompleted(result);
    }
  },

  cancelJustification() {
    this.pendingPunch = null;
    const modal = document.getElementById('modal-justificativa');
    if (modal) modal.style.display = 'none';
  }
};

document.addEventListener('DOMContentLoaded', () => {
  const btnConfirm = document.getElementById('btn-confirm-justificativa');
  const btnCancel = document.getElementById('btn-cancel-justificativa');
  const textarea = document.getElementById('justificativa-text');

  if (btnConfirm) {
    btnConfirm.addEventListener('click', () => {
      const text = textarea ? textarea.value.trim() : '';
      if (!text) {
        alert('Por favor, digite uma justificativa antes de confirmar.');
        return;
      }
      PontoEngine.confirmJustification(text);
    });
  }

  if (btnCancel) {
    btnCancel.addEventListener('click', () => PontoEngine.cancelJustification());
  }
});
