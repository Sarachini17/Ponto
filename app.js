/**
 * Main Application Controller & View Orchestrator
 */
document.addEventListener('DOMContentLoaded', () => {
  // Register Service Worker for PWA (RNF-01)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('ServiceWorker registered with scope:', reg.scope))
      .catch(err => console.error('ServiceWorker registration failed:', err));
  }

  // Initialize Lucide Icons
  if (window.lucide) {
    window.lucide.createIcons();
  }

  // Live Clock Updater
  const timeEl = document.getElementById('current-time');
  const dateEl = document.getElementById('current-date');

  function updateClock() {
    const now = new Date();
    if (timeEl) timeEl.textContent = now.toLocaleTimeString('pt-BR');
    if (dateEl) {
      const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
      dateEl.textContent = now.toLocaleDateString('pt-BR', options);
    }
  }

  setInterval(updateClock, 1000);
  updateClock();

  // Navigation Toggle (Ponto View <-> Gestão View)
  const btnToggleView = document.getElementById('btn-toggle-view');
  const viewToggleText = document.getElementById('view-toggle-text');
  const viewPonto = document.getElementById('view-ponto');
  const viewGestao = document.getElementById('view-gestao');

  if (btnToggleView) {
    btnToggleView.addEventListener('click', () => {
      if (viewPonto.style.display !== 'none') {
        viewPonto.style.display = 'none';
        viewGestao.style.display = 'block';
        if (viewToggleText) viewToggleText.textContent = 'Registrador de Ponto';
        GestaoModule.renderInconsistencies();
      } else {
        viewGestao.style.display = 'none';
        viewPonto.style.display = 'block';
        if (viewToggleText) viewToggleText.textContent = 'Painel do Gestor';
      }
    });
  }

  // Handle Event Punch Button Clicks (RF-01)
  const eventButtons = document.querySelectorAll('.btn-event');
  const empInput = document.getElementById('employee-id-input');
  const feedbackBanner = document.getElementById('punch-feedback');

  eventButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      const eventType = btn.getAttribute('data-event');
      const inputVal = empInput ? empInput.value : '';

      if (!inputVal) {
        showFeedback('Por favor, informe seu PIS, CPF, PIN ou aproxime o Cartão RFID.', 'error');
        return;
      }

      showFeedback('Processando registro de ponto e biometria...', 'success');

      const result = await PontoEngine.processPunch(eventType, inputVal);

      if (!result.success) {
        showFeedback(result.message, 'error');
      } else if (!result.requiresJustification) {
        showFeedback(result.message, 'success');
        if (empInput) empInput.value = '';
        renderRecentPunches();
      }
    });
  });

  window.onPunchCompleted = (result) => {
    showFeedback(result.message, 'success');
    if (empInput) empInput.value = '';
    renderRecentPunches();
  };

  function showFeedback(msg, type) {
    if (!feedbackBanner) return;
    feedbackBanner.textContent = msg;
    feedbackBanner.className = `feedback-banner ${type}`;
    feedbackBanner.style.display = 'block';

    setTimeout(() => {
      if (type === 'success' && feedbackBanner) {
        feedbackBanner.style.display = 'none';
      }
    }, 5000);
  }

  // Render recent punches list in Ponto view
  async function renderRecentPunches() {
    const list = document.getElementById('recent-punches-list');
    if (!list) return;

    const punches = await DB.getAll('punches');
    if (punches.length === 0) {
      list.innerHTML = '<li class="empty-list">Nenhuma marcação recente.</li>';
      return;
    }

    list.innerHTML = '';
    // Show latest 5 punches
    punches.slice(-5).reverse().forEach(p => {
      const li = document.createElement('li');
      const timeFormatted = new Date(p.timestamp).toLocaleTimeString('pt-BR');
      li.innerHTML = `
        <span><strong>${p.employeeName}</strong> (${p.eventType})</span>
        <span class="text-muted">${timeFormatted} - ${p.synced ? 'Sincronizado' : 'Local (Offline)'}</span>
      `;
      list.appendChild(li);
    });
  }

  // Initial recent punches render
  setTimeout(() => renderRecentPunches(), 500);
});
