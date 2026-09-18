// ============================================================
// site.js — index.html için tüm interaktif mantık.
// config.js, icons.js, utils.js, theme.js bu dosyadan ÖNCE yüklenmeli.
// ============================================================

let existingAppointments = [];
const storedLanguage = localStorage.getItem('siteLanguage');
let currentLanguage = storedLanguage === 'fr' || storedLanguage === 'en' ? storedLanguage : 'tr';
let selectedBarberId = localStorage.getItem('selectedBarberId') || 'barber_1';

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

const FR_SERVICES = {
  sac: { name: 'Coupe de cheveux', tag: 'Le plus populaire', desc: 'Coupes modernes et classiques réalisées avec précision à la tondeuse et aux ciseaux.', features: ['Lavage inclus', 'Conseil de style', 'Produit de finition'] },
  sakal: { name: 'Taille de barbe', tag: 'Art classique', desc: 'Rasage au rasoir de sécurité et modelage précis de la barbe.', features: ['Serviette chaude', 'Rasage au rasoir', 'Soin après-rasage'] },
  sac_sakal: { name: 'Cheveux + Barbe', tag: 'Combo', desc: 'Coupe de cheveux et taille de barbe en une seule visite.', features: ['Lavage inclus', 'Rasage et coiffage', 'Gain de temps'] },
  cocuk: { name: 'Coupe enfants', tag: 'Familial', desc: 'Une expérience de coupe patiente et agréable pour les enfants.', features: ['Environnement sûr et confortable', 'Coupe adaptée à leur style'] },
  damat: { name: 'Forfait mariage', tag: 'Journée spéciale', desc: 'Forfait complet de soins et de coiffage pour votre journée spéciale.', features: ['Cheveux + barbe + soin visage', 'Consultation de style détaillée'] },
  cilt: { name: 'Soin visage / peau', tag: 'Rafraîchir', desc: 'Nettoyage en profondeur, vapeur et hydratation pour la peau masculine.', features: ['Nettoyage profond', 'Vapeur', 'Masque hydratant'] },
  fon: { name: 'Séchage & coiffage', tag: 'Rapide', desc: 'Séchage et coiffage professionnels pour chaque jour ou occasion spéciale.', features: ['Application rapide', 'Style durable'] },
  boya: { name: 'Coloration capillaire', tag: 'Rénovation', desc: 'Coloration et toning avec des produits de qualité pour un aspect naturel.', features: ['Produits professionnels', 'Conseil couleur'] }
};

const EN_SERVICES = {
  sac: { name: 'Haircut', tag: 'Most popular', desc: 'Modern and classic cuts tailored precisely with clippers and scissors.', features: ['Wash included', 'Style advice', 'Finishing product'] },
  sakal: { name: 'Beard trim', tag: 'Classic craft', desc: 'Smooth razor shave and precise beard shaping with expert finishing.', features: ['Warm towel', 'Safety razor shave', 'After-shave care'] },
  sac_sakal: { name: 'Hair + Beard', tag: 'Combo', desc: 'Haircut and beard trim in one visit for a complete grooming session.', features: ['Wash included', 'Shave & styling', 'Time-saving'] },
  cocuk: { name: 'Kids cut', tag: 'Family friendly', desc: 'A patient and comfortable cutting experience designed for children.', features: ['Comfortable and safe space', 'Cut tailored to their style'] },
  damat: { name: 'Wedding package', tag: 'Special day', desc: 'Full grooming and styling package prepared for your special day.', features: ['Hair + beard + facial care', 'Detailed style consultation'] },
  cilt: { name: 'Facial / skin care', tag: 'Refresh', desc: 'Deep cleansing, steam treatment and hydration for men’s skin.', features: ['Deep cleansing', 'Steam treatment', 'Hydrating mask'] },
  fon: { name: 'Drying & styling', tag: 'Fast', desc: 'Professional blow-dry and styling for everyday or special occasions.', features: ['Quick application', 'Long-lasting style'] },
  boya: { name: 'Hair coloring', tag: 'Renewal', desc: 'Professional hair coloring and tone work with premium products.', features: ['Professional products', 'Color consultation'] }
};

function localizedService(service){
  if(currentLanguage === 'fr' && FR_SERVICES[service.id]) return { ...service, ...FR_SERVICES[service.id] };
  if(currentLanguage === 'en' && EN_SERVICES[service.id]) return { ...service, ...EN_SERVICES[service.id] };
  return service;
}

function applyLanguage(){
  const french = currentLanguage === 'fr';
  const english = currentLanguage === 'en';
  document.querySelectorAll('#language-select [data-language]').forEach(button => {
    button.classList.toggle('active', button.dataset.language === currentLanguage);
  });
  document.documentElement.lang = currentLanguage;
  document.title = french ? "Gentlemen's Barber — Sultanbeyli" : english ? "Gentlemen's Barber — Sultanbeyli" : "Gentlemen's Barber Kuaför — Sultanbeyli";
  document.querySelector('.nav-links li:nth-child(1) a').textContent = french ? 'Services' : english ? 'Services' : 'Hizmetler';
  document.querySelector('.nav-links li:nth-child(2) a').textContent = french ? 'Tarifs' : english ? 'Prices' : 'Fiyatlar';
  document.querySelector('.nav-links li:nth-child(3) a').textContent = french ? 'À propos' : english ? 'About' : 'Hakkımızda';
  document.querySelector('.nav-links li:nth-child(4) a').textContent = french ? 'Réservation' : english ? 'Booking' : 'Randevu';
  document.querySelector('.nav-links li:nth-child(5) a').textContent = french ? 'Contact' : english ? 'Contact' : 'İletişim';
  document.querySelectorAll('.js-booking-link').forEach(el => el.textContent = french ? 'Réserver' : english ? 'Book Now' : 'Randevu Al');
  document.querySelector('.js-prices-link').textContent = french ? 'Liste des prix' : english ? 'Price List' : 'Fiyat Listesi';
  document.querySelector('.js-hero-eyebrow').textContent = french ? 'Barbier de référence à Sultanbeyli' : english ? 'Top-rated Men’s Grooming Studio in Sultanbeyli' : "Sultanbeyli'nin Tercih Edilen Erkek Kuaförü";
  document.querySelector('.js-hero-title').innerHTML = french ? `<span class="js-shop-name">${SHOP_NAME}</span> — donnez du <span>style</span> à votre look` : english ? `<span class="js-shop-name">${SHOP_NAME}</span> — elevate your <span>style</span>` : `<span class="js-shop-name">${SHOP_NAME}</span> ile <span>tarzınızı</span> yükseltin`;
  document.querySelector('.js-hero-lead').innerHTML = french ? `<span class="js-location">${LOCATION_NAME}</span> est l'endroit idéal pour le style, les soins et la confiance. Des mains expertes, une coupe premium et une réservation pensée pour vous.` : english ? `<span class="js-location">${LOCATION_NAME}</span> is the meeting point for style, grooming and confidence. Book your premium barber experience today.` : `<span class="js-location">${LOCATION_NAME}</span>'de tarzın, bakımın ve özgüvenin buluşma noktası. Uzman ellerle premium berberlik deneyimi için hemen randevunuzu oluşturun.`;
  document.querySelector('.js-service-stat').textContent = french ? 'Services premium' : english ? 'Premium Services' : 'Premium Hizmet';
  document.querySelector('.js-rating-stat').textContent = french ? 'Note Google' : english ? 'Google Rating' : 'Google Puanı';
  document.querySelector('.js-review-stat').textContent = french ? 'Avis' : english ? 'Reviews' : 'Değerlendirme';
  document.querySelector('#hizmetler h2').textContent = french ? 'Nos services premium' : english ? 'Premium Services' : 'Premium Hizmetlerimiz';
  document.querySelector('#fiyatlar h2').textContent = french ? 'Liste des prix' : english ? 'Price List' : 'Fiyat Listesi';
  document.querySelector('#hakkimizda .eyebrow').textContent = french ? 'À propos' : english ? 'About' : 'Hakkımızda';
  document.querySelector('#randevu h2').textContent = french ? 'Renseignez vos informations' : english ? 'Fill in your details' : 'Bilgilerinizi Girin';
  document.querySelector('#iletisim h2').textContent = french ? 'Contactez-nous' : english ? 'Contact Us' : 'Bize Ulaşın';
  const formLabels = document.querySelectorAll('#randevu form label');
  const formLabelSet = french ? ['Nom complet', 'Téléphone', 'Service', 'Coiffeur', 'Date', 'Heure'] : english ? ['Full Name', 'Phone', 'Service', 'Barber', 'Date', 'Time'] : ['Ad Soyad', 'Telefon', 'Hizmet', 'Berber', 'Tarih', 'Saat'];
  formLabelSet.forEach((label, index) => {
    if(formLabels[index]) formLabels[index].textContent = label;
  });
  document.querySelector('#booking-form button').textContent = french ? 'Confirmer la réservation' : english ? 'Confirm Booking' : 'Randevuyu Onayla';
  document.querySelector('.js-maps-link').textContent = french ? 'Voir sur Google Maps' : english ? 'View all reviews on Google' : "Tüm Yorumları Google'da Gör";
  renderWorkingHours();
  renderServiceCards();
  renderPriceList();
  populateFormSelects();
  populateDays();
}

document.addEventListener('DOMContentLoaded', function(){
  renderShopInfo();
  const languageSelect = document.getElementById('language-select');
  languageSelect.querySelectorAll('[data-language]').forEach(button => {
    button.addEventListener('click', () => {
      currentLanguage = button.dataset.language;
      localStorage.setItem('siteLanguage', currentLanguage);
      applyLanguage();
    });
  });
  renderWorkingHours();
  renderServiceCards();
  renderPriceList();
  populateFormSelects();
  populateDays();
  fetchAppointmentsForSlots();
  setupScrollReveal();
  applyLanguage();

  document.getElementById('f-day').addEventListener('change', () => {
    updateTimeSlots();
    fetchAppointmentsForSlots();
  });
  document.getElementById('f-month').addEventListener('change', () => { populateDays(); fetchAppointmentsForSlots(); });
  document.getElementById('f-year').addEventListener('change', () => { populateDays(); fetchAppointmentsForSlots(); });
  document.getElementById('f-barber').addEventListener('change', () => {
    selectedBarberId = document.getElementById('f-barber').value || 'barber_1';
    localStorage.setItem('selectedBarberId', selectedBarberId);
    updateTimeSlots();
    fetchAppointmentsForSlots();
  });
  document.getElementById('booking-form').addEventListener('submit', handleBookingSubmit);
});

// ---------- Dükkan bilgilerini (config.js'ten) sayfaya basar ----------
function renderShopInfo(){
  document.querySelectorAll('.js-shop-name').forEach(el => el.textContent = SHOP_NAME);
  document.querySelectorAll('.js-shop-short').forEach(el => el.textContent = SHOP_SHORT);
  document.querySelectorAll('.js-location').forEach(el => el.textContent = LOCATION_NAME);
  document.querySelectorAll('.js-address').forEach(el => el.textContent = ADDRESS);
  document.querySelectorAll('.js-phone').forEach(el => el.textContent = PHONE_DISPLAY);
  document.querySelectorAll('.js-rating').forEach(el => el.textContent = GOOGLE_RATING);
  document.querySelectorAll('.js-rating-count').forEach(el => el.textContent = GOOGLE_RATING_COUNT);
  document.querySelectorAll('.js-service-count').forEach(el => el.textContent = SERVICES.length);

  document.querySelectorAll('.js-logo-icon').forEach(el => el.innerHTML = logoMarkSVG());

  const mapFrame = document.getElementById('map-frame');
  if(mapFrame) mapFrame.src = `https://www.google.com/maps?q=${MAP_LAT},${MAP_LNG}&z=16&output=embed`;

  document.querySelectorAll('.js-whatsapp-link').forEach(el => {
    el.href = `https://wa.me/${WHATSAPP_NUMBER}?text=Merhaba%2C%20randevu%20almak%20istiyorum.`;
  });
  document.querySelectorAll('.js-instagram-link').forEach(el => { el.href = INSTAGRAM_URL; });
  document.querySelectorAll('.js-maps-link').forEach(el => { el.href = MAPS_LINK; });
  document.querySelectorAll('.js-phone-link').forEach(el => { el.href = `tel:+${WHATSAPP_NUMBER}`; });

  document.querySelectorAll('.js-whatsapp-icon').forEach(el => el.innerHTML = whatsappIconSVG());
  document.querySelectorAll('.js-instagram-icon').forEach(el => el.innerHTML = instagramIconSVG());
  document.querySelectorAll('.js-pin-icon').forEach(el => el.innerHTML = pinIconSVG());
  document.querySelectorAll('.js-phone-icon').forEach(el => el.innerHTML = phoneIconSVG());
  document.querySelectorAll('.js-clock-icon').forEach(el => el.innerHTML = clockIconSVG());
}

// ---------- Çalışma saatleri tablosu ----------
function renderWorkingHours(){
  const table = document.getElementById('hours-table');
  if(!table) return;
  const rows = currentLanguage === 'fr' ? [
    { day: 'Lundi – Jeudi', hours: '09:00 – 23:00' },
    { day: 'Vendredi – Samedi', hours: '09:00 – 00:00' },
    { day: 'Dimanche', hours: 'Fermé' }
  ] : currentLanguage === 'en' ? [
    { day: 'Monday – Thursday', hours: '09:00 – 23:00' },
    { day: 'Friday – Saturday', hours: '09:00 – 00:00' },
    { day: 'Sunday', hours: 'Closed' }
  ] : WORKING_HOURS;
  table.innerHTML = rows.map(row => `
    <tr><td>${row.day}</td><td>${row.hours}</td></tr>
  `).join('');
}

// ---------- Hizmetler bölümü: kart görünümü ----------
function renderServiceCards(){
  const grid = document.getElementById('services-grid');
  if(!grid) return;
  grid.innerHTML = SERVICES.map((rawService) => { const s = localizedService(rawService); return `
    <div class="service-card">
      <img class="service-photo" src="${s.img}" alt="${s.name}" loading="lazy">
      <div class="service-card-body">
        <div class="tag">${s.tag}</div>
        <h3>${s.name}</h3>
        <div class="price">${s.price}</div>
        <p>${s.desc}</p>
      </div>
    </div>
  `; }).join('');
}

// ---------- Fiyat listesi bölümü: detaylı kartlar ----------
function renderPriceList(){
  const list = document.getElementById('price-list');
  if(!list) return;
  list.innerHTML = SERVICES.map(rawService => { const s = localizedService(rawService); return `
    <div class="price-item">
      <img class="price-photo" src="${s.img}" alt="${s.name}" loading="lazy">
      <div class="price-item-body">
        <div class="price-item-top">
          <div>
            <div class="tag">${s.tag}</div>
            <h3>${s.name}</h3>
          </div>
          <div class="price">${s.price}</div>
        </div>
        <p>${s.desc}</p>
        <ul class="feature-list">
          ${s.features.map(f => `<li><span class="check">${checkIconSVG()}</span>${f}</li>`).join('')}
        </ul>
      </div>
    </div>
  `; }).join('');
}

// ---------- Form seçim kutularını doldurur ----------
function populateFormSelects(){
  document.getElementById('f-service').innerHTML =
    SERVICES.map(rawService => { const s = localizedService(rawService); return `<option value="${s.id}">${s.name} — ${s.price}</option>`; }).join('');

  const barberSelect = document.getElementById('f-barber');
  if(barberSelect){
    barberSelect.innerHTML = BARBERS.map(barber => `<option value="${barber.id}">${barber.names?.tr || barber.name}</option>`).join('');
    barberSelect.value = selectedBarberId && BARBERS.some(b => b.id === selectedBarberId) ? selectedBarberId : BARBERS[0].id;
    selectedBarberId = barberSelect.value;
    localStorage.setItem('selectedBarberId', selectedBarberId);
  }

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  document.getElementById('f-month').innerHTML =
    MONTHS.map((m,i) => `<option value="${i+1}"${i + 1 === currentMonth ? ' selected' : ''}>${m}</option>`).join('');

  document.getElementById('f-year').innerHTML =
    [currentYear, currentYear + 1].map(y => `<option value="${y}"${y === currentYear ? ' selected' : ''}>${y}</option>`).join('');

  document.getElementById('f-time').innerHTML =
    TIME_SLOTS.map(t => `<option value="${t}">${t}</option>`).join('');
}

// ---------- Seçilen ay/yıla göre gün seçeneklerini üretir ----------
function populateDays(){
  const monthSel = document.getElementById('f-month');
  const yearSel = document.getElementById('f-year');
  const daySel = document.getElementById('f-day');

  const now = new Date();
  const todayYear = now.getFullYear();
  const todayMonth = now.getMonth() + 1;
  const todayDay = now.getDate();

  const month = parseInt(monthSel.value || String(todayMonth), 10);
  const year = parseInt(yearSel.value || String(todayYear), 10);
  const count = daysInMonth(month, year);
  const oldValue = parseInt(daySel.value || '0', 10);

  const days = [];
  for(let d = 1; d <= count; d++){
    const isPastDay =
      year < todayYear ||
      (year === todayYear && month < todayMonth) ||
      (year === todayYear && month === todayMonth && d < todayDay);
    if(!isPastDay) days.push(`<option value="${d}">${d}</option>`);
  }
  daySel.innerHTML = days.join('');

  if(oldValue && Array.from(daySel.options).some(o => Number(o.value) === oldValue)){
    daySel.value = String(oldValue);
  }else if(daySel.options.length){
    daySel.selectedIndex = 0;
  }
  updateTimeSlots();
}

async function fetchAppointmentsForSlots(){
  existingAppointments = await fetchAllAppointments();
  updateTimeSlots();
}

function updateTimeSlots(){
  const daySel = document.getElementById('f-day');
  const monthSel = document.getElementById('f-month');
  const yearSel = document.getElementById('f-year');
  const timeSel = document.getElementById('f-time');
  const barberSel = document.getElementById('f-barber');
  if(!daySel.value || !timeSel) return;

  const day = String(daySel.value).padStart(2,'0');
  const month = String(monthSel.value).padStart(2,'0');
  const year = String(yearSel.value);
  const selectedDateStr = `${year}-${month}-${day}`;
  const selectedBarber = barberSel ? barberSel.value : selectedBarberId;

  const bookedTimes = existingAppointments
    .filter(a => normalizeDate(a.date) === selectedDateStr && (!selectedBarber || a.barberId === selectedBarber || a.barber === selectedBarber))
    .map(a => normalizeTime(a.time))
    .filter(Boolean);

  const html = TIME_SLOTS.map(slot => {
    const slotTime = normalizeTime(slot);
    const [hour, minute] = slotTime.split(':').map(Number);
    const slotDate = new Date(Number(year), Number(month)-1, Number(day), hour, minute, 0, 0);
    const isPast = slotDate.getTime() < Date.now();
    const isBooked = bookedTimes.includes(slotTime);

    if(isBooked) return `<option value="${slot}" disabled style="color:#d15965;">${slot} (${currentLanguage === 'fr' ? 'COMPLET' : 'DOLU'})</option>`;
    if(isPast)   return `<option value="${slot}" disabled style="color:#888;">${slot} (${currentLanguage === 'fr' ? 'PASSÉ' : 'GEÇTİ'})</option>`;
    return `<option value="${slot}">${slot}</option>`;
  }).join('');

  timeSel.innerHTML = html;
  const firstAvailable = Array.from(timeSel.options).find(o => !o.disabled);
  if(firstAvailable) timeSel.value = firstAvailable.value;
}

function isAppointmentAlreadyBooked(dateStr, time, barberId = selectedBarberId){
  const wanted = normalizeTime(time);
  return existingAppointments.some(a =>
    normalizeDate(a.date) === dateStr &&
    normalizeTime(a.time) === wanted &&
    (!barberId || a.barberId === barberId || a.barber === barberId)
  );
}

async function handleBookingSubmit(e){
  e.preventDefault();
  const msgBox = document.getElementById('form-msg');
  msgBox.innerHTML = '';

  const name = document.getElementById('f-name').value.trim();
  const phone = document.getElementById('f-phone').value.trim();
  const serviceId = document.getElementById('f-service').value;
  const barberId = document.getElementById('f-barber')?.value || selectedBarberId || 'barber_1';
  const day = parseInt(document.getElementById('f-day').value, 10);
  const month = parseInt(document.getElementById('f-month').value, 10);
  const year = parseInt(document.getElementById('f-year').value, 10);
  const time = document.getElementById('f-time').value;

  if(!name || !phone){
    msgBox.innerHTML = '<div class="msg err">Lütfen ad soyad ve telefon bilgisi girin.</div>';
    return;
  }
  const normalizedPhone = phone.replace(/\D/g, '');
  if(normalizedPhone.length < 10){
    msgBox.innerHTML = '<div class="msg err">Lütfen geçerli bir telefon numarası girin.</div>';
    return;
  }
  if(!time){
    msgBox.innerHTML = '<div class="msg err">Lütfen boş bir saat seçin.</div>';
    return;
  }

  const service = SERVICES.find(s => s.id === serviceId);
  const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  const startTime = normalizeTime(time);
  const chosen = new Date(`${dateStr}T${startTime}:00`);

  if(chosen.getTime() < Date.now()){
    msgBox.innerHTML = '<div class="msg err">Geçmiş bir tarih/saat için randevu alınamaz.</div>';
    return;
  }
  if(isAppointmentAlreadyBooked(dateStr, startTime, barberId)){
    updateTimeSlots();
    msgBox.innerHTML = `<div class="msg err">${currentLanguage === 'fr' ? 'Ce créneau est déjà réservé pour ce coiffeur. Veuillez choisir une autre heure.' : 'Bu tarih ve saat bu berber için dolu. Lütfen başka bir saat seçin.'}</div>`;
    return;
  }

  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = currentLanguage === 'fr' ? 'Vérification...' : 'Kontrol Ediliyor...';

  appointmentsFetchFailed = false;
  existingAppointments = await fetchAllAppointments();
  if(appointmentsFetchFailed && !Array.isArray(existingAppointments) || existingAppointments === null){
    existingAppointments = [];
  }
  if(Array.isArray(existingAppointments) && isAppointmentAlreadyBooked(dateStr, startTime, barberId)){
    updateTimeSlots();
    msgBox.innerHTML = `<div class="msg err">${currentLanguage === 'fr' ? 'Ce créneau vient d’être réservé pour ce coiffeur. Veuillez choisir un autre horaire.' : 'Bu tarih ve saat az önce bu berber için alındı. Lütfen başka bir saat seçin.'}</div>`;
    submitBtn.disabled = false;
    submitBtn.textContent = currentLanguage === 'fr' ? 'Confirmer la réservation' : 'Randevuyu Onayla';
    return;
  }

  const appointment = {
    id: 'appt_' + Date.now() + '_' + Math.random().toString(36).slice(2,8),
    name, phone: normalizedPhone,
    serviceId, serviceName: service ? service.name : serviceId,
    barberId,
    barberName: BARBERS.find(item => item.id === barberId)?.names?.tr || BARBERS.find(item => item.id === barberId)?.name || 'Berber',
    date: dateStr,
    time: startTime,
    createdAt: new Date().toISOString()
  };

  submitBtn.textContent = currentLanguage === 'fr' ? 'Enregistrement...' : 'Kaydediliyor...';

  try{
    let localSaveResult = null;
    try{
      const response = await fetch(SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'add', appointment })
      });
      let result = {};
      try{
        result = await readJsonResponse(response);
      }catch(err){
        if(!response.ok) throw new Error('Kayıt başarısız');
        throw err;
      }
      if(!response.ok || result.success === false || result.status === 'error'){
        throw new Error(result.error || 'Kayıt başarısız');
      }
    }catch(err){
      console.warn('Google Apps Script kaydı başarısız, yerel depolama kullanılıyor:', err);
      localSaveResult = await addAppointmentLocally(appointment);
      if(!localSaveResult.success){
        throw err;
      }
    }

    if(!existingAppointments.some(item => item.id === appointment.id)){
      existingAppointments.push(appointment);
    }
    window.dispatchEvent(new CustomEvent('gentlemens-barber-appointments-updated'));
    const displayMonths = MONTHS;
    const barberName = BARBERS.find(item => item.id === barberId)?.names?.tr || BARBERS.find(item => item.id === barberId)?.name || 'Berber';
    const successText = currentLanguage === 'fr' ? `Votre rendez-vous est confirmé ! ${day} ${displayMonths[month-1]} ${year} à ${startTime} avec ${barberName}. Nous avons hâte de vous voir.` : `Randevunuz alındı! ${day} ${displayMonths[month-1]} ${year}, saat ${startTime} — ${barberName} ile sizi bekliyoruz.`;
    msgBox.innerHTML = `<div class="msg ok">${successText}</div>`;
    e.target.reset();
    populateFormSelects();
    populateDays();
    updateTimeSlots();
    fetchAppointmentsForSlots();
  }catch(err){
    console.error('Booking error:', err);
    const errorText = String(err.message || '');
    const isBooked = errorText.toLowerCase().includes('zaten dolu') || errorText.toLowerCase().includes('already booked');
    msgBox.innerHTML = `<div class="msg err">${isBooked ? (currentLanguage === 'fr' ? 'Cette date et cette heure sont déjà prises. Veuillez choisir un autre créneau.' : 'Bu tarih ve saat zaten dolu. Lütfen başka bir saat seçin.') : (currentLanguage === 'fr' ? 'Le rendez-vous n’a pas pu être enregistré. Veuillez réessayer.' : 'Randevu kaydedilemedi. Lütfen tekrar deneyin.')}</div>`;
  }finally{
    submitBtn.disabled = false;
    submitBtn.textContent = currentLanguage === 'fr' ? 'Confirmer la réservation' : 'Randevuyu Onayla';
  }
}

function setupScrollReveal(){
  const items = document.querySelectorAll('.reveal');
  if(!('IntersectionObserver' in window)){
    items.forEach(el => el.classList.add('in-view'));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if(entry.isIntersecting){
        entry.target.classList.add('in-view');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  items.forEach(el => observer.observe(el));
}