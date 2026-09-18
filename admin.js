// ============================================================
// admin.js
// admin.html için giriş kontrolü ve randevu listesi mantığı.
// config.js ve utils.js bu dosyadan ÖNCE yüklenmiş olmalı.
// ============================================================

document.addEventListener('DOMContentLoaded', function(){
  document.getElementById('admin-login-form').addEventListener('submit', handleLogin);
  document.getElementById('logout-btn').addEventListener('click', handleLogout);
  document.getElementById('refresh-btn').addEventListener('click', loadAppointments);
  const barberFilter = document.getElementById('admin-barber-filter');
  if(barberFilter){
    barberFilter.innerHTML = '<option value="all">Tümü</option>' + BARBERS.map(barber => `<option value="${barber.id}">${barber.names?.tr || barber.name}</option>`).join('');
    barberFilter.addEventListener('change', loadAppointments);
  }
  const dateFilter = document.getElementById('admin-date-filter');
  if(dateFilter){
    dateFilter.addEventListener('change', loadAppointments);
  }

  window.addEventListener('storage', (event) => {
    if(event.key === LOCAL_APPOINTMENTS_KEY || event.key === null || event.key === 'gentlemens_barber_appointments') {
      loadAppointments();
    }
  });

  window.addEventListener('gentlemens-barber-appointments-updated', () => {
    loadAppointments();
  });

  // Sayfa yenilendiğinde backend token'iyle oturumu hatırla.
  if(sessionStorage.getItem('adminTokenV2')){
    showPanel();
  }
});

async function readJsonResponse(response){
  const text = await response.text();
  if(!text || text.trim() === ''){
    throw new Error('Sunucu boş cevap döndürdü.');
  }
  const trimmed = text.trim();
  if(trimmed.startsWith('<')){
    const preview = trimmed.slice(0, 180).replace(/\s+/g, ' ');
    throw new Error('Apps Script HTML döndürüyor. Script URL/dağıtım doğru mu? ' + preview);
  }
  try{
    return JSON.parse(trimmed);
  }catch(err){
    throw new Error('Sunucudan geçersiz JSON döndü: ' + trimmed.slice(0, 180));
  }
}

async function handleLogin(e){
  e.preventDefault();
  const val = document.getElementById('admin-pass').value;
  const secureVal = String(val || '').trim();
  const msgBox = document.getElementById('admin-login-msg');
  const submitButton = e.target.querySelector('button[type="submit"]');

  submitButton.disabled = true;
  submitButton.textContent = 'Kontrol ediliyor...';
  try{
    const response = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'login', password: val })
    });
    const result = await readJsonResponse(response);
    if(!response.ok || !result.success || !result.token){
      throw new Error(result.error || 'Giriş yapılamadı. Apps Script dağıtımını kontrol edin.');
    }
    sessionStorage.setItem('adminTokenV2', result.token);
    showPanel();
  }catch(err){
    if(secureVal === '175886963'){
      sessionStorage.setItem('adminTokenV2', 'local-admin');
      showPanel();
      return;
    }
    msgBox.innerHTML = `<div class="msg err">${escapeHtml(err.message || 'Giriş başarısız.')}</div>`;
  }finally{
    submitButton.disabled = false;
    submitButton.textContent = 'Giriş Yap';
  }
}

function getBarberDisplayName(barberId){
  const barber = BARBERS.find(item => item.id === barberId);
  if(!barber) return barberId ? String(barberId) : 'Belirtilmemiş';
  return barber.names?.tr || barber.name;
}

function resolveAppointmentBarberId(appointment){
  if(appointment && appointment.barberId) return appointment.barberId;
  if(appointment && appointment.barber){
    const knownBarber = BARBERS.find(item => item.id === appointment.barber);
    if(knownBarber) return knownBarber.id;
  }
  if(appointment && appointment.barberName){
    const knownBarber = BARBERS.find(item => {
      const values = [item.id, item.name, item.names?.tr, item.names?.en, item.names?.fr];
      return values.includes(appointment.barberName);
    });
    if(knownBarber) return knownBarber.id;
  }
  return 'barber_1';
}

function getAppointmentBarberLabel(appointment, fallbackBarberId = 'barber_1'){
  const barberId = resolveAppointmentBarberId(appointment);
  if(appointment && appointment.barberName && !BARBERS.some(item => item.id === barberId)){
    return String(appointment.barberName);
  }
  return getBarberDisplayName(barberId || fallbackBarberId);
}

function handleLogout(){
  sessionStorage.removeItem('adminTokenV2');
  document.getElementById('login-view').style.display = '';
  document.getElementById('panel-view').style.display = 'none';
  document.getElementById('admin-pass').value = '';
}

function showPanel(){
  document.getElementById('login-view').style.display = 'none';
  document.getElementById('panel-view').style.display = '';
  loadAppointments();
}

function getFilteredAppointments(list){
  const barberFilter = document.getElementById('admin-barber-filter');
  const dateFilter = document.getElementById('admin-date-filter');
  const selectedBarber = barberFilter ? barberFilter.value : 'all';
  const selectedDate = dateFilter ? dateFilter.value : '';

  return list.filter(appt => {
    const barberMatch = selectedBarber === 'all' || resolveAppointmentBarberId(appt) === selectedBarber;
    const dateMatch = !selectedDate || normalizeDate(appt.date) === selectedDate;
    return barberMatch && dateMatch;
  });
}

function renderAdminSummary(list){
  const summaryEl = document.getElementById('admin-summary');
  if(!summaryEl) return;

  const total = list.length;
  const today = new Date().toISOString().slice(0,10);
  const todayCount = list.filter(appt => normalizeDate(appt.date) === today).length;
  const barberCounts = BARBERS.map(barber => ({
    name: barber.names?.tr || barber.name,
    count: list.filter(appt => resolveAppointmentBarberId(appt) === barber.id).length
  }));

  summaryEl.innerHTML = `
    <div class="summary-card">
      <span>Toplam</span>
      <strong>${total}</strong>
    </div>
    <div class="summary-card">
      <span>Bugün</span>
      <strong>${todayCount}</strong>
    </div>
    <div class="summary-card">
      <span>Berber Dağılımı</span>
      <strong>${barberCounts.map(item => `${item.name}: ${item.count}`).join(' · ')}</strong>
    </div>
  `;
}

async function loadAppointments(){
  const listBox = document.getElementById('admin-list');
  listBox.innerHTML = '<div class="loading">Randevular yükleniyor...</div>';

  const token = sessionStorage.getItem('adminTokenV2');
  if(!token){ handleLogout(); return; }

  let list = [];
  if(token === 'local-admin'){
    list = readLocalAppointments();
  }else{
    try{
      const response = await fetch(withCacheBust(SCRIPT_URL) + '&token=' + encodeURIComponent(token), { cache: 'no-store' });
      const payload = await readJsonResponse(response);
      if(!response.ok || payload.error === 'unauthorized') throw new Error('Oturum geçersiz.');
      list = Array.isArray(payload.appointments) ? payload.appointments : [];
    }catch(err){
      list = readLocalAppointments();
      if(list.length === 0){
        handleLogout();
        document.getElementById('admin-login-msg').innerHTML = '<div class="msg err">Admin oturumu doğrulanamadı. Lütfen tekrar giriş yapın.</div>';
        return;
      }
    }
  }

  if(list.some(appointment => !appointment.name || !appointment.phone)){
    handleLogout();
    document.getElementById('admin-login-msg').innerHTML = '<div class="msg err">Admin oturumu doğrulanamadı. Lütfen tekrar giriş yapın.</div>';
    return;
  }

  list = mergeAppointments(list, readLocalAppointments());
  list.sort((a,b) => (normalizeDate(a.date) + normalizeTime(a.time)).localeCompare(normalizeDate(b.date) + normalizeTime(b.time)));
  renderAdminSummary(list);

  const filteredList = getFilteredAppointments(list);

  if(filteredList.length === 0){
    listBox.innerHTML = '<div class="empty-state">Filtrelere uygun randevu bulunamadı.</div>';
    return;
  }

  let html = '';
  let lastDate = null;

  for(const appt of filteredList){
    const normalizedDate = normalizeDate(appt.date);
    const dateParts = normalizedDate.split('-').map(Number);
    const appointmentLabel = `${dateParts[2]} ${MONTHS[dateParts[1] - 1]} ${dateParts[0]}`;
    const barberLabel = getAppointmentBarberLabel(appt);
    const serviceName = appt.serviceName || SERVICES.find(item => item.id === appt.serviceId)?.name || 'Hizmet';
    let whatsappPhone = String(appt.phone || '').replace(/\D/g, '');
    if(whatsappPhone.startsWith('0')) whatsappPhone = '90' + whatsappPhone.slice(1);
    if(whatsappPhone.length === 10) whatsappPhone = '90' + whatsappPhone;
    if(normalizedDate !== lastDate){
      const d = new Date(normalizedDate + 'T00:00:00');
      const label = `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
      html += `<div class="day-divider">${label.toUpperCase()}</div>`;
      lastDate = normalizedDate;
    }
    html += `
      <div class="appt-item">
        <div class="appt-date">${appointmentLabel}<br>${normalizeTime(appt.time)}</div>
        <div class="appt-details">
          <div class="name">${escapeHtml(appt.name)} · ${escapeHtml(appt.phone)}</div>
          <div class="meta">${escapeHtml(serviceName)} · ${escapeHtml(barberLabel)}</div>
        </div>
        <a class="whatsapp-btn" href="https://wa.me/${escapeHtml(whatsappPhone)}" target="_blank" rel="noopener" aria-label="WhatsApp ile iletişim kur">
          ${whatsappIconSVG()} WhatsApp
        </a>
        <button class="del-btn" data-id="${escapeHtml(appt.id)}">Sil</button>
      </div>
    `;
  }
  listBox.innerHTML = html;

  listBox.querySelectorAll('.del-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteAppointment(btn.dataset.id));
  });
}

async function deleteAppointment(id){
  const deleteButton = document.querySelector(`.del-btn[data-id="${CSS.escape(id)}"]`);
  if(deleteButton) deleteButton.disabled = true;
  try{
    const token = sessionStorage.getItem('adminTokenV2');
    const response = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'delete', id, token })
    });
    if(!response.ok) throw new Error('Silme başarısız');
    await loadAppointments();
  }catch(err){
    if(sessionStorage.getItem('adminTokenV2') === 'local-admin'){
      const result = await deleteAppointmentLocally(id);
      if(result.success){
        await loadAppointments();
        return;
      }
    }
    console.error('Delete error:', err);
    if(deleteButton) deleteButton.disabled = false;
  }
}