/**
 * HR & Manager Dashboard Implementation (RF-04, RF-07, RN-04)
 * Handles inconsistency notifications, medical certificate allowances, and end-of-day missing punch auditing.
 */
const GestaoModule = {
  async init() {
    await this.loadEmployeesSelect();
    await this.renderInconsistencies();
    await this.renderAtestados();

    const formAtestado = document.getElementById('form-atestado');
    if (formAtestado) {
      formAtestado.addEventListener('submit', (e) => this.handleAtestadoSubmit(e));
    }

    const btnEod = document.getElementById('btn-trigger-eod');
    if (btnEod) {
      btnEod.addEventListener('click', () => this.runEndOfDayAbsenceAudit());
    }
  },

  async loadEmployeesSelect() {
    const select = document.getElementById('atestado-employee');
    if (!select) return;

    const employees = await DB.getAll('employees');
    select.innerHTML = '<option value="">Selecione o funcionário...</option>';

    employees.forEach(emp => {
      const option = document.createElement('option');
      option.value = emp.id;
      option.textContent = `${emp.name} (PIS: ${emp.pis})`;
      select.appendChild(option);
    });
  },

  /**
   * Renders automatic inconsistency notifications (RF-04)
   */
  async renderInconsistencies() {
    const list = document.getElementById('inconsistencies-list');
    if (!list) return;

    const inconsistencies = await DB.getAll('inconsistencies');

    if (inconsistencies.length === 0) {
      list.innerHTML = '<li class="empty-list">Nenhuma inconsistência detectada.</li>';
      return;
    }

    list.innerHTML = '';
    inconsistencies.sort((a, b) => new Date(b.date) - new Date(a.date));

    inconsistencies.forEach(inc => {
      const li = document.createElement('li');
      li.innerHTML = `
        <div>
          <strong>${inc.employeeName || inc.employeeId}</strong> - <span>${inc.type}</span><br>
          <small class="text-muted">${inc.description} (${inc.date})</small>
        </div>
      `;
      list.appendChild(li);
    });
  },

  /**
   * Handles Medical Certificate & Absence Allowance registration (RF-07)
   */
  async handleAtestadoSubmit(e) {
    e.preventDefault();

    const empId = document.getElementById('atestado-employee').value;
    const date = document.getElementById('atestado-date').value;
    const motivo = document.getElementById('atestado-motivo').value;

    if (!empId || !date || !motivo) return;

    const employee = await DB.getById('employees', empId);

    const atestadoRecord = {
      id: 'atestado-' + Date.now(),
      employeeId: empId,
      employeeName: employee ? employee.name : empId,
      date,
      motivo,
      createdAt: new Date().toISOString()
    };

    await DB.put('atestados', atestadoRecord);

    // Clear any unjustified absence or inconsistency for this employee on this date
    const inconsistencies = await DB.getAll('inconsistencies');
    const matchedInc = inconsistencies.find(i => i.employeeId === empId && i.date === date);

    if (matchedInc) {
      await DB.delete('inconsistencies', matchedInc.id);
    }

    alert(`Abono registrado com sucesso para ${employee ? employee.name : empId}!`);
    document.getElementById('form-atestado').reset();

    await this.renderAtestados();
    await this.renderInconsistencies();
  },

  async renderAtestados() {
    const list = document.getElementById('atestados-list');
    if (!list) return;

    const atestados = await DB.getAll('atestados');

    if (atestados.length === 0) {
      list.innerHTML = '<li class="empty-list">Nenhum abono cadastrado.</li>';
      return;
    }

    list.innerHTML = '';
    atestados.forEach(att => {
      const li = document.createElement('li');
      li.innerHTML = `
        <div>
          <strong>${att.employeeName}</strong> - ${att.date}<br>
          <small>${att.motivo}</small>
        </div>
      `;
      list.appendChild(li);
    });
  },

  /**
   * End of Day Absence Auditing (RN-04)
   * Total absence of punches at end of workday automatically registered as 'Falta Injustificada'
   */
  async runEndOfDayAbsenceAudit() {
    const todayStr = new Date().toISOString().split('T')[0];
    const employees = await DB.getAll('employees');
    const punches = await DB.getAll('punches');
    const atestados = await DB.getAll('atestados');
    const inconsistencies = await DB.getAll('inconsistencies');

    let newFaltasCount = 0;

    for (const emp of employees) {
      // Check if employee has any punches today
      const empTodayPunches = punches.filter(p => p.employeeId === emp.id && p.timestamp.startsWith(todayStr));
      
      // Check if employee has registered medical allowance/atestado today
      const hasAtestado = atestados.some(a => a.employeeId === emp.id && a.date === todayStr);

      // Check if already registered
      const alreadyLogged = inconsistencies.some(i => i.employeeId === emp.id && i.date === todayStr && i.type === 'FALTA_INJUSTIFICADA');

      if (empTodayPunches.length === 0 && !hasAtestado && !alreadyLogged) {
        // RN-04: Absence without punches and without medical certificate -> Falta Injustificada
        const faltaRecord = {
          id: 'inc-falta-' + Date.now() + '-' + emp.id,
          employeeId: emp.id,
          employeeName: emp.name,
          type: 'FALTA_INJUSTIFICADA',
          description: 'Ausência total de marcações de ponto ao final do expediente sem justificativa prévia.',
          date: todayStr
        };

        await DB.put('inconsistencies', faltaRecord);
        SupabaseService.insertInconsistency(faltaRecord);
        newFaltasCount++;
      }
    }

    await this.renderInconsistencies();
    alert(`Apuração diária executada com sucesso! ${newFaltasCount} nova(s) Falta(s) Injustificada(s) registrada(s).`);
  }
};

document.addEventListener('DOMContentLoaded', () => GestaoModule.init());
