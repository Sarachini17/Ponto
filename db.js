/**
 * IndexedDB Local Storage Manager for Offline-First PWA (RNF-01)
 */
const DB_NAME = 'PontoEletronicoDB';
const DB_VERSION = 1;

let dbInstance = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      return resolve(dbInstance);
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Punches Store
      if (!db.objectStoreNames.contains('punches')) {
        const punchStore = db.createObjectStore('punches', { keyPath: 'id' });
        punchStore.createIndex('employeeId', 'employeeId', { unique: false });
        punchStore.createIndex('synced', 'synced', { unique: false });
        punchStore.createIndex('timestamp', 'timestamp', { unique: false });
      }

      // Employees Store
      if (!db.objectStoreNames.contains('employees')) {
        const empStore = db.createObjectStore('employees', { keyPath: 'id' });
        empStore.createIndex('pis', 'pis', { unique: true });
        empStore.createIndex('pin', 'pin', { unique: false });
        empStore.createIndex('rfid', 'rfid', { unique: false });
      }

      // Inconsistencies Store
      if (!db.objectStoreNames.contains('inconsistencies')) {
        const incStore = db.createObjectStore('inconsistencies', { keyPath: 'id' });
        incStore.createIndex('employeeId', 'employeeId', { unique: false });
        incStore.createIndex('date', 'date', { unique: false });
      }

      // Medical Certificates / Allowances (Atestados)
      if (!db.objectStoreNames.contains('atestados')) {
        const atestadoStore = db.createObjectStore('atestados', { keyPath: 'id' });
        atestadoStore.createIndex('employeeId', 'employeeId', { unique: false });
      }

      // Sync Queue Store
      if (!db.objectStoreNames.contains('syncQueue')) {
        db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.error('IndexedDB error:', event.target.error);
      reject(event.target.error);
    };
  });
}

// Generic Helper for DB Transactions
async function getStore(storeName, mode = 'readonly') {
  const db = await openDB();
  const tx = db.transaction(storeName, mode);
  return tx.objectStore(storeName);
}

// CRUD Helpers
const DB = {
  async getAll(storeName) {
    const store = await getStore(storeName, 'readonly');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  async getById(storeName, id) {
    const store = await getStore(storeName, 'readonly');
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  async put(storeName, item) {
    const store = await getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(item);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  async delete(storeName, id) {
    const store = await getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  async getByIndex(storeName, indexName, value) {
    const store = await getStore(storeName, 'readonly');
    const index = store.index(indexName);
    return new Promise((resolve, reject) => {
      const request = index.getAll(value);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  // Seed default demo employees if store is empty
  async initSeedData() {
    const employees = await this.getAll('employees');
    if (employees.length === 0) {
      const demoEmployees = [
        {
          id: 'emp-001',
          name: 'Carlos Silva',
          pis: '12345678901',
          cpf: '111.222.333-44',
          pin: '1234',
          rfid: 'RFID-1001',
          companyName: 'Empresa Demo Tecnologia LTDA',
          cnpj: '12.345.678/0001-90',
          address: 'Av. Paulista, 1000 - São Paulo/SP',
          cargo: 'Desenvolvedor Senior',
          turno: '08:00 - 17:00',
          shiftStart: '08:00',
          shiftEnd: '17:00',
          email: 'carlos.silva@empresa.com.br'
        },
        {
          id: 'emp-002',
          name: 'Ana Souza',
          pis: '98765432109',
          cpf: '555.666.777-88',
          pin: '5678',
          rfid: 'RFID-1002',
          companyName: 'Empresa Demo Tecnologia LTDA',
          cnpj: '12.345.678/0001-90',
          address: 'Av. Paulista, 1000 - São Paulo/SP',
          cargo: 'Analista de RH',
          turno: '08:00 - 17:00',
          shiftStart: '08:00',
          shiftEnd: '17:00',
          email: 'ana.souza@empresa.com.br'
        }
      ];

      for (const emp of demoEmployees) {
        await this.put('employees', emp);
      }
      console.log('Seed employees initialized.');
    }
  }
};

// Initialize DB and Seed Data automatically on load
openDB().then(() => DB.initSeedData()).catch(console.error);
