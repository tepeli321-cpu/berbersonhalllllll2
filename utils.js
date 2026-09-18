// ============================================================
// utils.js
// Hem site.js hem admin.js tarafından kullanılan küçük, genel
// amaçlı yardımcı fonksiyonlar.
// ============================================================

// Belirtilen ay/yıl için o ayın kaç gün çektiğini döndürür (artık yıl dahil).
function daysInMonth(month, year){
  return new Date(year, month, 0).getDate();
}

function normalizeDate(date){
  if(!date) return '';
  const value = String(date).trim();
  if(/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if(!isoMatch) return value.slice(0,10);

  const utcDate = new Date(Date.UTC(
    Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]),
    Number(isoMatch[4]), Number(isoMatch[5])
  ) + 3 * 60 * 60 * 1000);
  return utcDate.toISOString().slice(0,10);
}

// Google E-Tablosu'ndan gelen saat değerini "HH:MM" formatına indirger.
// "09:00 - 10:00" -> "09:00", "9:00:00" -> "09:00" gibi farklı olası
// biçimleri tek bir standarda çevirir.
function normalizeTime(time){
  if(!time) return '';
  let value = String(time).trim();
  if(/^\d{1,2}:\d{2}$/.test(value)){
    const [hour, minute] = value.split(':').map(Number);
    return String(hour).padStart(2,'0') + ':' + String(minute).padStart(2,'0');
  }
  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if(isoMatch){
    const [, isoYear, , , isoHour, isoMinute] = isoMatch;
    if(isoYear === '1899'){
      const roundedMinutes = Math.round((Number(isoHour) * 60 + Number(isoMinute) + 180) / 60) * 60;
      return String(Math.floor(roundedMinutes / 60) % 24).padStart(2,'0') + ':00';
    }
    return isoHour + ':' + isoMinute;
  }
  if(value.includes(' - ')) value = value.split(' - ')[0].trim();
  if(/^\d{1,2}:\d{2}:\d{2}$/.test(value)) value = value.slice(0,5);
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if(!match) return value;
  return String(parseInt(match[1],10)).padStart(2,'0') + ':' + match[2];
}

// Kullanıcıdan gelen metni HTML olarak basmadan önce güvenli hale getirir
// (ör. isim alanına birisi <script> yazarsa sorun çıkmasın diye).
function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str == null ? '' : str;
  return div.innerHTML;
}

// Google Apps Script GET isteklerinin tarayıcı/operatör tarafından
// önbelleğe alınmasını engellemek için URL'ye rastgele bir parametre ekler.
function withCacheBust(url){
  return url + (url.includes('?') ? '&' : '?') + 't=' + Date.now();
}

let appointmentsRequest = null;
let appointmentsFetchFailed = false;

const LOCAL_APPOINTMENTS_KEY = 'gentlemens_barber_appointments';

function readLocalAppointments(){
  try{
    const value = localStorage.getItem(LOCAL_APPOINTMENTS_KEY);
    if(!value) return [];
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  }catch(err){
    console.warn('Yerel randevular okunamadı:', err);
    return [];
  }
}

function writeLocalAppointments(list){
  try{
    localStorage.setItem(LOCAL_APPOINTMENTS_KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent('gentlemens-barber-appointments-updated'));
    return true;
  }catch(err){
    console.warn('Yerel randevular kaydedilemedi:', err);
    return false;
  }
}

function mergeAppointments(...lists){
  const map = new Map();
  lists.filter(Array.isArray).flat().forEach(item => {
    if(!item) return;
    const key = item.id || `${item.date || ''}|${item.time || ''}|${item.name || ''}|${item.phone || ''}`;
    if(!map.has(key)) map.set(key, item);
  });
  return Array.from(map.values());
}

async function addAppointmentLocally(appointment){
  const list = mergeAppointments(readLocalAppointments(), [appointment]);
  const saved = writeLocalAppointments(list);
  return { success: saved, source: 'local', appointments: list };
}

async function deleteAppointmentLocally(id){
  const next = readLocalAppointments().filter(item => item.id !== id);
  return { success: writeLocalAppointments(next), source: 'local', appointments: next };
}

// Backend'den (Google E-Tablosu) tüm randevuları çeker.
// Hem site.js (müsaitlik kontrolü için) hem admin.js (liste için) kullanır.
// Backend erişilemezse otomatik olarak yerel depolamadan döner.
async function fetchAllAppointments(){
  if(appointmentsRequest) return appointmentsRequest;

  appointmentsRequest = (async () => {
  try{
    const response = await fetch(withCacheBust(SCRIPT_URL), { method: 'GET', cache: 'no-store' });
    if(!response.ok) throw new Error('Randevular alınamadı');
    const result = await response.json();
    const remoteAppointments = Array.isArray(result && result.appointments) ? result.appointments : [];
    const merged = mergeAppointments(remoteAppointments, readLocalAppointments());
    appointmentsFetchFailed = false;
    if(merged.length > 0) writeLocalAppointments(merged);
    return merged;
  }catch(err){
    appointmentsFetchFailed = true;
    const localAppointments = readLocalAppointments();
    if(localAppointments.length > 0){
      console.warn('Google Apps Script erişilemedi; yerel kayıtlar yüklendi.', err);
      return localAppointments;
    }
    console.error('Randevular çekilirken hata:', err);
    return [];
  }finally{
    appointmentsRequest = null;
  }
  })();

  return appointmentsRequest;
}
