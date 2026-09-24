/**
 * Authentication Module for Employee Credential Verification (RF-05, RF-06)
 * Supports PIN, RFID Card, and PIS/CPF input.
 */
const AuthModule = {
  async authenticateEmployee(input) {
    if (!input || !input.trim()) {
      return { success: false, message: 'Informe a credencial (PIS, PIN ou RFID).' };
    }

    const cleanInput = input.trim();
    const employees = await DB.getAll('employees');

    // Find employee by PIS, CPF, PIN, or RFID
    const employee = employees.find(emp =>
      emp.pis === cleanInput ||
      emp.cpf === cleanInput ||
      emp.pin === cleanInput ||
      emp.rfid === cleanInput ||
      emp.id === cleanInput
    );

    if (!employee) {
      return { success: false, message: 'Funcionário não encontrado ou credencial inválida.' };
    }

    // Determine authentication method used
    let authMethod = 'PIS/CPF';
    if (employee.pin === cleanInput) authMethod = 'PIN (Exceção)';
    if (employee.rfid === cleanInput) authMethod = 'RFID Proximidade (Exceção)';

    return {
      success: true,
      employee,
      authMethod
    };
  }
};
