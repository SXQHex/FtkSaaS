/* FtkSaaS tasarım v2: kabuk, gezinme ve örnek etkileşimler. Veri yok, API yok; hepsi kurgusal. */
(function () {
  var P = {
    layout: '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
    calendar: '<path d="M8 2v4M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    package: '<path d="m7.5 4.27 9 5.15M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/>',
    card: '<rect width="20" height="14" x="2" y="5" rx="2"/><path d="M2 10h20"/>',
    wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
    chart: '<path d="M3 3v18h18"/><path d="M18 17V9M13 17V5M8 17v-3"/>',
    building: '<rect width="16" height="20" x="4" y="2" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01"/>',
    sliders: '<path d="M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    right: '<path d="m9 18 6-6-6-6"/>',
    updown: '<path d="m7 15 5 5 5-5M7 9l5-5 5 5"/>',
    panel: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/>',
    plus: '<path d="M5 12h14M12 5v14"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
    monitor: '<rect width="20" height="14" x="2" y="3" rx="2"/><path d="M8 21h8M12 17v4"/>',
    help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>'
  };
  Object.assign(P, {
    arrowleft: '<path d="m12 19-7-7 7-7M19 12H5"/>',
    filetext: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
    clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    pencil: '<path d="M21.17 6.81a1 1 0 0 0-3.99-3.99L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z"/>',
    ban: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
    play: '<polygon points="6 3 20 12 6 21 6 3"/>',
    userplus: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    chevleft: '<path d="m15 18-6-6 6-6"/>',
    lock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-10 5L2 7"/>',
    merge: '<path d="m8 6 4-4 4 4"/><path d="M12 2v10.3a4 4 0 0 1-1.17 2.83L4 22"/><path d="m20 22-5-5"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    sparkle: '<polygon points="12 2 15.1 8.6 22 9.3 16.8 14 18.2 21 12 17.5 5.8 21 7.2 14 2 9.3 8.9 8.6 12 2"/>',
    zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>'
  });
  function ic(n, c) {
    return '<svg class="ic ' + (c || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[n] || '') + '</svg>';
  }
  function swap(root) {
    (root || document).querySelectorAll('i[data-i]').forEach(function (el) {
      el.outerHTML = ic(el.getAttribute('data-i'), el.className);
    });
  }

  var groups = [
    { g: 'Genel', items: [['genel-bakis', 'Genel bakış', 'layout'], ['program', 'Ders programı', 'calendar'], ['etkinlikler', 'Etkinlikler', 'sparkle'], ['uyeler', 'Üyeler', 'users'], ['adaylar', 'Adaylar', 'target', 4], ['otomasyon', 'Otomasyon', 'zap', 1], ['gelen-kutusu', 'Gelen kutusu', 'inbox', 3], ['talepler', 'Talepler', 'clock', 3]] },
    { g: 'Satış', items: [['paketler', 'Paketler', 'package'], ['finans', 'Finans', 'card'], ['hakedis', 'Hakediş', 'wallet'], ['raporlar', 'Raporlar', 'chart']] },
    { g: 'Stüdyo', items: [['studyo', 'Stüdyo', 'building'], ['belgeler', 'Belgeler', 'filetext'], ['denetim', 'Denetim', 'shield', 3], ['ayarlar', 'Ayarlar', 'sliders']] }
  ];
  var titles = { durum: 'Durum', durumlar: 'Durum ekranları', hesap: 'Hesabım', etkinlik: 'Etkinlik detayı', seans: 'Seans detayı', uye: 'Üye profili', 'uye-birlestir': 'Kişileri birleştir', 'uye-hesaplar': 'Davetler ve hesaplar' };
  groups.forEach(function (g) { g.items.forEach(function (i) { titles[i[0]] = i[1]; }); });

  var sidebar = document.getElementById('sidebar');
  sidebar.innerHTML =
    '<button type="button" class="studio" aria-label="Stüdyo seç"><span class="logo">ÖD</span><span class="studio-txt"><b>Örnek Dans Stüdyosu</b><small>Merkez şube</small></span>' + ic('updown') + '</button>' +
    '<nav class="sb-nav" aria-label="Ana menü">' +
    groups.map(function (g) {
      return '<div class="sb-group"><p class="sb-label">' + g.g + '</p>' +
        g.items.map(function (i) {
          return '<a class="sb-item" href="#' + i[0] + '" data-route="' + i[0] + '" title="' + i[1] + '">' + ic(i[2]) + '<span>' + i[1] + '</span>' + (i[3] ? '<em class="count" style="font-style:normal">' + i[3] + '</em>' : '') + '</a>';
        }).join('') + '</div>';
    }).join('') +
    '</nav>' +
    '<div class="sb-foot"><a class="sb-item" href="#yardim" data-route="yardim" title="Yardım">' + ic('help') + '<span>Yardım</span></a>' +
    '<a class="user" href="#hesap" data-route="hesap" title="Hesabım"><span class="avatar">AY</span><span class="studio-txt"><b>Ayşe Yılmaz</b><small>Stüdyo yöneticisi</small></span>' + ic('updown') + '</a></div>';

  document.getElementById('topbar').innerHTML =
    '<button type="button" class="btn ghost icon sm" id="sb-toggle" aria-label="Menüyü daralt veya aç">' + ic('panel') + '</button>' +
    '<span class="sep-v" aria-hidden="true"></span>' +
    '<nav class="crumbs" aria-label="Konum"><span class="muted">Stüdyo yönetimi</span>' + ic('right') + '<b id="crumb">Genel bakış</b></nav>' +
    '<div class="top-actions"><button type="button" class="btn outline sm search" aria-label="Sayfalarda ara">' + ic('search') + '<span>Ara…</span><kbd class="kbd">Ctrl K</kbd></button>' +
    '<button type="button" class="btn ghost icon sm" id="theme-btn" aria-label="Temayı değiştir">' + ic('moon') + '</button>' +
    '<button type="button" class="btn ghost icon sm" aria-label="Bildirimler">' + ic('bell') + '</button></div>';
  swap();

  /* Gezinme */
  var views = Array.prototype.slice.call(document.querySelectorAll('.view'));
  function route() {
    var name = (location.hash || '#genel-bakis').slice(1);
    var view = views.filter(function (v) { return v.getAttribute('data-view') === name; })[0];
    var ph = document.querySelector('[data-view="taslak"]');
    views.forEach(function (v) { v.hidden = true; });
    if (view) view.hidden = false;
    else if (window.__stateShow) window.__stateShow('404', name);
    else { ph.hidden = false; document.getElementById('ph-title').textContent = titles[name] || 'Yardım'; }
    document.querySelectorAll('[data-route]').forEach(function (a) {
      if (a.getAttribute('data-route') === ({ seans: 'program', etkinlik: 'etkinlikler', uye: 'uyeler', 'uye-birlestir': 'uyeler', 'uye-hesaplar': 'uyeler' }[name] || name)) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    document.getElementById('crumb').textContent = titles[name] || (view ? 'Yardım' : 'Sayfa bulunamadı');
    document.body.classList.remove('sb-open');
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);
  route();

  /* Menü daralt / mobil aç */
  document.getElementById('sb-toggle').addEventListener('click', function () {
    if (window.matchMedia('(max-width: 900px)').matches) document.body.classList.toggle('sb-open');
    else { document.body.classList.toggle('sb-collapsed'); try { localStorage.setItem('v2-sb', document.body.classList.contains('sb-collapsed') ? '1' : ''); } catch (e) {} }
  });
  document.getElementById('scrim').addEventListener('click', function () { document.body.classList.remove('sb-open'); });
  try { if (localStorage.getItem('v2-sb')) document.body.classList.add('sb-collapsed'); } catch (e) {}

  /* Tema */
  var root = document.documentElement;
  function effective() {
    var t = root.getAttribute('data-theme');
    return t || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }
  function setTheme(mode) {
    if (mode === 'system') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', mode);
    try { localStorage.setItem('v2-theme', mode); } catch (e) {}
    document.querySelectorAll('[data-theme-set]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-theme-set') === mode)); });
    var btn = document.getElementById('theme-btn');
    btn.innerHTML = ic(effective() === 'dark' ? 'sun' : 'moon');
  }
  document.getElementById('theme-btn').addEventListener('click', function () { setTheme(effective() === 'dark' ? 'light' : 'dark'); });
  document.querySelectorAll('[data-theme-set]').forEach(function (b) { b.addEventListener('click', function () { setTheme(b.getAttribute('data-theme-set')); }); });
  var saved = 'system'; try { saved = localStorage.getItem('v2-theme') || 'system'; } catch (e) {}
  setTheme(saved);

  /* Görünüm tercihleri: bu cihazda, anında */
  (function () {
    var r = document.documentElement, ids = ['f-tz', 'f-hb', 'f-ol', 'f-kn'];
    function put(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
    function apply() { r.style.zoom = document.getElementById('f-ol').value === '100' ? '' : String(+document.getElementById('f-ol').value / 100); if (document.getElementById('f-kn').value === 'high') r.setAttribute('data-contrast', 'high'); else r.removeAttribute('data-contrast'); }
    ids.forEach(function (id) { try { var v = localStorage.getItem('v2-' + id); if (v) document.getElementById(id).value = v; } catch (e) {} });
    apply();
    ids.forEach(function (id) { document.getElementById(id).addEventListener('change', function () { put('v2-' + id, this.value); apply(); toast('Görünüm tercihi uygulandı'); }); });
    document.getElementById('f-dil').addEventListener('change', function () { if (this.value !== 'Türkçe') { this.value = 'Türkçe'; toast('English henüz yok, Türkçe kalır'); } });
  })();

  /* Hesap sekmeleri */
  var tabs = document.querySelectorAll('[data-tab]');
  tabs.forEach(function (t) {
    t.addEventListener('click', function () {
      tabs.forEach(function (x) { x.setAttribute('aria-selected', String(x === t)); });
      document.querySelectorAll('[data-panel]').forEach(function (p) { p.hidden = p.getAttribute('data-panel') !== t.getAttribute('data-tab'); });
    });
  });

  /* Profil formu: tek kaydet çubuğu, değişiklik olunca açılır */
  var form = document.getElementById('profile-form');
  var save = document.getElementById('save');
  var cancel = document.getElementById('cancel');
  var status = document.getElementById('save-status');
  var fields = Array.prototype.slice.call(form.querySelectorAll('input:not([readonly])'));
  var base = fields.map(function (f) { return f.value; });
  function dirty() { return fields.some(function (f, i) { return f.value !== base[i]; }); }
  function sync() {
    var d = dirty();
    save.disabled = !d; cancel.disabled = !d;
    status.textContent = d ? 'Kaydedilmemiş değişiklikler var' : 'Tüm değişiklikler kaydedildi';
    status.classList.toggle('dirty', d);
  }
  form.addEventListener('input', sync);
  form.addEventListener('submit', function (e) { e.preventDefault(); base = fields.map(function (f) { return f.value; }); sync(); status.textContent = 'Profil kaydedildi'; });
  cancel.addEventListener('click', function () { fields.forEach(function (f, i) { f.value = base[i]; }); sync(); });
  sync();

  /* ---------- Seans detayı (kurgusal veri) ---------- */
  var $ = function (id) { return document.getElementById(id); };
  var people = [
    ['Cem D.', 'CD', 'Erkek', 'Aylık sınırsız', 'active'],
    ['Selin A.', 'SA', 'Kadın', '8 derslik paket, 5 hak kaldı', 'active'],
    ['Burak K.', 'BK', 'Erkek', '12 derslik paket, 9 hak kaldı', 'active'],
    ['Merve T.', 'MT', 'Kadın', 'Aylık sınırsız', 'active'],
    ['Onur Ç.', 'OÇ', 'Erkek', '8 derslik paket, 2 hak kaldı', 'active'],
    ['Derya S.', 'DS', 'Kadın', '12 derslik paket, 7 hak kaldı', 'active'],
    ['Ece M.', 'EM', 'Kadın', 'Aylık sınırsız', 'active'],
    ['Nehir G.', 'NG', 'Kadın', '12 derslik paket, 10 hak kaldı', 'active'],
    ['Tolga Y.', 'TY', 'Erkek', '8 derslik paket, 6 hak kaldı', 'cancelled']
  ];
  var mark = {}, started = false, closed = false;
  function attBadge(name) {
    if (!started) return '<span class="badge soft">Başlamadı</span>';
    var s = mark[name];
    if (s === 'attended') return '<span class="badge ok">' + ic('check') + 'Geldi</span>';
    if (s === 'no_show') return '<span class="badge bad">Gelmedi</span>';
    return '<span class="badge soft">İşaretlenmedi</span>';
  }
  function renderPeople() {
    var q = $('p-search').value.trim().toLocaleLowerCase('tr');
    $('p-body').innerHTML = people.filter(function (p) { return p[0].toLocaleLowerCase('tr').indexOf(q) > -1; }).map(function (p) {
      var off = p[4] === 'cancelled';
      return '<tr' + (off ? ' class="off"' : '') + '><td><span class="who"><span class="avatar sm">' + p[1] + '</span>' + p[0] + '</span></td><td>' + p[2] + '</td><td class="muted">' + p[3] + '</td><td>' +
        (off ? '<span class="badge soft">İptal edildi</span>' : '<span class="badge">Kesin</span>' + (p[5] === 'over' ? ' <span class="badge soft">Kontenjan aşımı</span>' : '')) + '</td><td>' + (off ? '<span class="muted">-</span>' : attBadge(p[0])) + '</td></tr>';
    }).join('') || '<tr><td colspan="5" class="muted" style="padding:24px 0">Aramana uygun üye yok.</td></tr>';
  }
  function renderAtt() {
    var act = people.filter(function (p) { return p[4] === 'active'; });
    $('att-list').innerHTML = act.map(function (p) {
      var s = mark[p[0]], dis = (!started || (closed && !fixing)) ? ' disabled' : '';
      return '<li><span class="who"><span class="avatar sm">' + p[1] + '</span>' + p[0] + '</span><div class="seg sm" role="group" aria-label="' + p[0] + ' yoklama">' +
        '<button type="button" class="ok" data-m="attended" data-n="' + p[0] + '" aria-pressed="' + (s === 'attended') + '"' + dis + '>Geldi</button>' +
        '<button type="button" class="no" data-m="no_show" data-n="' + p[0] + '" aria-pressed="' + (s === 'no_show') + '"' + dis + '>Gelmedi</button></div></li>';
    }).join('');
    var a = 0, n = 0;
    act.forEach(function (p) { if (mark[p[0]] === 'attended') a++; else if (mark[p[0]] === 'no_show') n++; });
    $('att-sum').textContent = 'Geldi ' + a + ', gelmedi ' + n + ', işaretlenmemiş ' + (act.length - a - n);
    $('att-close').disabled = !(started && !closed && a + n === act.length);
    $('att-close').hidden = closed;
    $('att-edit').hidden = !closed || fixing;
    $('att-cancel').hidden = $('att-save').hidden = !fixing;
    $('att-fix').hidden = !fixing;
    if (fixing) {
      var ch = act.filter(function (q) { return mark[q[0]] !== snap[q[0]]; }).length;
      $('att-eff').textContent = ch ? ch + ' işaret değişecek. Hak kullanımı yeniden hesaplanır, önceki kayıt geçmişte kalır.' : 'Değişiklik yok.';
      $('att-save').disabled = !(ch && $('att-why').value.trim());
      $('att-hint').textContent = 'Kapalı yoklamayı yalnızca yönetici düzeltebilir.';
    } else if (closed) $('att-hint').textContent = fixed ? 'Yoklama düzeltildi, kayıt geçmişe işlendi.' : 'Hatalı ya da eksik yoklamayı yönetici düzeltebilir.';
  }
  var fixing = false, fixed = false, snap = {};
  function refresh() { renderPeople(); renderAtt(); syncSeats(); }
  $('att-edit').addEventListener('click', function () { fixing = true; snap = JSON.parse(JSON.stringify(mark)); $('att-why').value = ''; refresh(); });
  $('att-cancel').addEventListener('click', function () { mark = snap; fixing = false; refresh(); });
  $('att-why').addEventListener('input', renderAtt);
  $('att-save').addEventListener('click', function () {
    if ($('att-save').disabled) return;
    fixing = false; fixed = true; $('att-badge').textContent = 'Yoklama düzeltildi';
    $('att-note').textContent = 'Yoklama 14:52\'de düzeltildi. Gerekçe: ' + $('att-why').value.trim();
    refresh(); toast('Yoklama düzeltildi');
  });
  $('p-search').addEventListener('input', renderPeople);
  $('att-list').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-m]'); if (!b || b.disabled) return;
    mark[b.getAttribute('data-n')] = b.getAttribute('data-m'); refresh();
  });
  var SV = document.querySelector('[data-view="seans"]');
  function pick(name) {
    SV.querySelectorAll('[data-stab]').forEach(function (t) { t.setAttribute('aria-selected', String(t.getAttribute('data-stab') === name)); });
    SV.querySelectorAll('[data-spanel]').forEach(function (p) { p.hidden = p.getAttribute('data-spanel') !== name; });
  }
  SV.querySelectorAll('[data-stab]').forEach(function (t) { t.addEventListener('click', function () { pick(t.getAttribute('data-stab')); }); });
  $('att-start').addEventListener('click', function () {
    started = true; $('att-start').disabled = true;
    $('att-note').textContent = 'Yoklama 14:31\'de başladı.';
    $('att-badge').textContent = 'Yoklama başladı';
    pick('yoklama'); refresh();
  });
  $('att-close').addEventListener('click', function () {
    closed = true; $('att-badge').textContent = 'Yoklama kapandı'; $('att-note').textContent = 'Yoklama kapatıldı.'; refresh(); if (SHARED.hkClose) SHARED.hkClose(); toast('Yoklama kapatıldı');
  });

  var SHARED = {};
  SHARED.attApi = {
    names: function () { return people.filter(function (p) { return p[4] === 'active'; }).map(function (p) { return p[0]; }); },
    getMark: function (n) { return mark[n]; },
    setMark: function (n, v) { if (!started || closed) return; mark[n] = v; refresh(); },
    started: function () { return started; }, closed: function () { return closed; },
    start: function (t) { started = true; $('att-start').disabled = true; $('att-note').textContent = 'Yoklama ' + t + '\'de başladı (eğitmen).'; $('att-badge').textContent = 'Yoklama başladı'; refresh(); },
    close: function () { closed = true; $('att-badge').textContent = 'Yoklama kapandı'; $('att-note').textContent = 'Yoklama eğitmen tarafından kapatıldı.'; refresh(); if (SHARED.hkClose) SHARED.hkClose(); }
  };
  var toastTimer;
  function toast(msg) {
    var t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2600);
  }


  /* ---------- Yönetici rezervasyonu: katılımcı ekle, kontenjan aşımı ---------- */
  var CAP = { 'Erkek': 3, 'Kadın': 9 }, TOTAL = 12, HOLD = { 'Erkek': 0, 'Kadın': 0 };
  var CAND = [
    { n: 'Tolga Yıldız', s: 'Tolga Y.', a: 'TY', cat: 'Erkek', hak: '8 derslik paket, 6 hak kaldı', block: [] },
    { n: 'Kerem Zorlu', s: 'Kerem Z.', a: 'KZ', cat: 'Erkek', hak: '8 derslik paket, 4 hak kaldı', block: ['Açık borç ₺450. Tahsilat al ya da negatif limit tanımla.'] },
    { n: 'Aylin Polat', s: 'Aylin P.', a: 'AP', cat: 'Kadın', hak: '8 derslik paket, hak yok', block: ['Üye pasif.'] },
    { n: 'Emre Vural', s: 'Emre V.', a: 'EV', cat: 'Erkek', hak: 'Aylık sınırsız, süresi doldu', block: ['Hak süresi 30 Eki\'de doldu.'] }
  ];
  function actives() { return people.filter(function (q) { return q[4] === 'active'; }); }
  function catN(c) { return actives().filter(function (q) { return q[2] === c; }).length + (HOLD[c] || 0); }
  function syncSeats() {
    var A = actives().length, held = Math.min(A, TOTAL), box = document.querySelector('.seats'); if (!box) return;
    box.innerHTML = ''; for (var k = 0; k < TOTAL; k++) { var el = document.createElement('i'); el.className = k < held ? 'held' : 'free'; box.appendChild(el); }
    box.setAttribute('aria-label', TOTAL + ' yerden ' + held + '\'i ayrılmış');
    $('seat-big').innerHTML = A + '<span class="muted"> / ' + TOTAL + '</span>';
    $('seat-free').textContent = (A > TOTAL ? (A - TOTAL) + ' kişi kontenjan üstünde' : A === TOTAL ? 'Dolu' : (TOTAL - A) + ' yer boş') + ((HOLD.Erkek || HOLD['Kadın']) ? ', 1 yer teklif için tutuluyor' : '');
    $('seat-lg').innerHTML = '<span><i class="sw held"></i>Ayrılan ' + A + '</span><span><i class="sw free"></i>Boş ' + Math.max(0, TOTAL - A) + '</span>';
    [['Erkek', 'ce'], ['Kadın', 'cf']].forEach(function (c) {
      var n = catN(c[0]), cap = CAP[c[0]];
      $(c[1] + '-t').textContent = n + ' / ' + cap; $(c[1] + '-t').style.color = n > cap ? 'var(--destructive)' : '';
      $(c[1] + '-b').style.width = Math.min(100, Math.round(n / cap * 100)) + '%';
    });
    $('n-active').textContent = A; $('p-count').textContent = A + ' kesin, ' + people.filter(function (q) { return q[4] === 'cancelled'; }).length + ' iptal';
  }
  var apSheet = $('ap-sheet'), apScrim = $('ap-scrim'), apOp = null;
  function apSel() { var r = $('ap-list').querySelector('input:checked'); return r ? CAND.filter(function (c) { return c.n === r.value; })[0] : null; }
  function apOver(c) {
    var o = []; if (actives().length + 1 > TOTAL) o.push('Toplam kontenjan ' + (actives().length + 1) + ' / ' + TOTAL + ' olur');
    if (catN(c.cat) + 1 > CAP[c.cat]) o.push(c.cat + ' kategorisi ' + (catN(c.cat) + 1) + ' / ' + CAP[c.cat] + ' olur'); return o;
  }
  function apBlocks(c) { var b = c.block.slice(), fzn = SHARED.frozen ? SHARED.frozen(c.n) : null; if (fzn) { var MM = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'], fx = function (x) { return +x.slice(8) + ' ' + MM[+x.slice(5, 7) - 1]; }; b.push('Hak donduruldu (' + fx(fzn.from) + ' - ' + fx(fzn.to) + '). Dondurmayı bitirmeden rezervasyon yapılamaz.'); } d = SHARED.pendingDocs ? SHARED.pendingDocs(c.n, 'Rezervasyon') : []; if (d.length) b.push('Belge kabul bekliyor: ' + d.join(', ') + '. Üye kendisi kabul eder.'); return b; }
  function apDraw() {
    $('ap-list').innerHTML = '<legend class="label">Üye</legend>' + CAND.filter(function (c) { return !actives().some(function (q) { return q[0] === c.s; }); }).map(function (c) {
      var b = apBlocks(c);
      return '<label class="opt' + (b.length ? ' ap-off' : '') + '"><input type="radio" name="ap" value="' + c.n + '"' + (b.length ? ' disabled' : '') + '><span><b>' + c.n + '</b><small>' + c.cat + ' · ' + c.hak + '</small>' + (b.length ? '<small style="color:var(--destructive)">' + b[0] + '</small>' : '') + '</span></label>';
    }).join('');
  }
  function apUpd() {
    var c = apSel(), ok = false, eff = $('ap-eff'), ov = $('ap-ov');
    if (!c) { eff.hidden = true; ov.hidden = true; $('ap-ok').disabled = true; return; }
    var o = apOver(c), A = actives().length + 1;
    eff.hidden = false; eff.querySelector('ul').innerHTML =
      '<li><span class="row-l"><span>Hak</span><b class="tnum">1 ders ayrılır</b></span><span class="ch">Yoklama kapanınca tüketilir.</span></li>' +
      '<li><span class="row-l"><span>Toplam</span><b class="tnum' + (A > TOTAL ? ' debt' : '') + '">' + A + ' / ' + TOTAL + '</b></span></li>' +
      '<li><span class="row-l"><span>' + c.cat + '</span><b class="tnum' + (catN(c.cat) + 1 > CAP[c.cat] ? ' debt' : '') + '">' + (catN(c.cat) + 1) + ' / ' + CAP[c.cat] + '</b></span>' + (o.length ? '<span class="ch">Kontenjan aşılıyor. Yalnızca yönetici yetkisiyle ve açık onayla eklenebilir.</span>' : '') + '</li>';
    ov.hidden = !o.length;
    ok = !o.length || ($('ap-ovc').checked && !!$('ap-why').value.trim());
    $('ap-ok').disabled = !ok;
  }
  function apOpen() { apOp = document.activeElement; apDraw(); $('ap-ovc').checked = false; $('ap-why').value = ''; apUpd(); apSheet.hidden = false; apScrim.hidden = false; $('ap-x').focus(); }
  function apClose() { apSheet.hidden = true; apScrim.hidden = true; if (apOp) apOp.focus(); }
  $('ap-open').addEventListener('click', apOpen);
  $('ap-x').addEventListener('click', apClose); $('ap-cancel').addEventListener('click', apClose); apScrim.addEventListener('click', apClose);
  $('ap-form').addEventListener('input', apUpd); $('ap-form').addEventListener('change', apUpd); $('ap-form').addEventListener('submit', function (e) { e.preventDefault(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !apSheet.hidden) apClose(); });
  $('ap-ok').addEventListener('click', function () {
    var c = apSel(); if (!c || $('ap-ok').disabled) return; var over = apOver(c).length > 0;
    var row = people.filter(function (q) { return q[0] === c.s; })[0], hk = c.hak.replace(/(\d+) hak kaldı/, function (m, n) { return (+n - 1) + ' hak kaldı'; });
    if (row) { row[4] = 'active'; row[3] = hk; row[5] = over ? 'over' : ''; } else people.push([c.s, c.a, c.cat, hk, 'active', over ? 'over' : '']);
    apClose(); refresh(); toast(over ? 'Kontenjan aşılarak eklendi' : 'Rezervasyon oluşturuldu');
  });
  refresh();

  /* ---------- Bekleme listesi ve süreli yer teklifi (kurgusal veri; Erkek kategorisi dolu) ---------- */
  var WL = [
    { id: 1, n: 'Kerem Zorlu', s: 'Kerem Z.', a: 'KZ', cat: 'Erkek', hak: '8 derslik paket, 4 hak kaldı', bad: 'Açık borç ₺450', at: '3 Kas 12:05', st: 'wait' },
    { id: 2, n: 'Baran Yücel', s: 'Baran Y.', a: 'BY', cat: 'Erkek', hak: '12 derslik paket, 11 hak kaldı', bad: '', at: '3 Kas 14:18', st: 'wait' },
    { id: 3, n: 'Yiğit Arslan', s: 'Yiğit A.', a: 'YA', cat: 'Erkek', hak: 'Aylık sınırsız', bad: '', at: '3 Kas 18:42', st: 'wait' },
    { id: 4, n: 'Emre Vural', s: 'Emre V.', a: 'EV', cat: 'Erkek', hak: 'Aylık sınırsız', bad: '', at: '2 Kas 20:10', st: 'exp', rt: 1, res: '3 Kas 10:31', note: 'Teklif 30 dk içinde yanıtlanmadı' },
    { id: 5, n: 'Alp Demir', s: 'Alp D.', a: 'AD', cat: 'Erkek', hak: '8 derslik paket, 3 hak kaldı', bad: '', at: '2 Kas 21:35', st: 'rej', rt: 2, res: '3 Kas 10:44', note: 'Üye teklifi reddetti' },
    { id: 6, n: 'Cem Demir', s: 'Cem D.', a: 'CD', cat: 'Erkek', hak: 'Aylık sınırsız', bad: '', at: '3 Kas 08:15', st: 'acc', rt: 3, res: '3 Kas 10:52', note: 'Rezervasyon oluştu' }
  ];
  var wlSeq = 7, rtSeq = 4, nowMin = 21, wlMsg = '', wlTimer = null, wlRm = 0;
  var WLC = [
    { n: 'Tolga Yıldız', s: 'Tolga Y.', a: 'TY', cat: 'Erkek', hak: '8 derslik paket, 6 hak kaldı', bad: '', hard: '' },
    { n: 'Emre Vural', s: 'Emre V.', a: 'EV', cat: 'Erkek', hak: 'Aylık sınırsız, süresi doldu', bad: 'Hak süresi doldu', hard: '' },
    { n: 'Seda Kurt', s: 'Seda K.', a: 'SK', cat: 'Kadın', hak: '12 derslik paket, 8 hak kaldı', bad: '', hard: 'Kadın kategorisinde 4 yer var. Doğrudan rezervasyon oluştur.' },
    { n: 'Aylin Polat', s: 'Aylin P.', a: 'AP', cat: 'Kadın', hak: '8 derslik paket, hak yok', bad: '', hard: 'Üye pasif.' }
  ];
  function wlOn() { var c = $('ay-bekleme'); return c ? c.checked : true; }
  function wlDur() { var s = $('ay-teklif'); return s ? +s.value : 30; }
  function clk(m) { return '14:' + ('0' + m).slice(-2); }
  function wlOfferE() { return WL.filter(function (e) { return e.st === 'offer'; })[0] || null; }
  function wlQ() { return WL.filter(function (e) { return e.st === 'wait' || e.st === 'offer'; }); }
  function mmss(s) { return ('0' + Math.floor(s / 60)).slice(-2) + ':' + ('0' + (s % 60)).slice(-2); }
  function wlFinish(e, st, note) { e.st = st; e.rt = rtSeq++; e.res = '4 Kas ' + clk(Math.min(nowMin, 59)); e.note = note; }
  function wlIssue() {
    var rem = Math.min(wlDur(), 30 - nowMin), skipped = [];
    if (rem <= 0) { HOLD.Erkek = 0; return 'Seans başladı, yeni teklif verilmez. Boşalan yer açık kaldı.'; }
    var q = WL.filter(function (e) { return e.st === 'wait'; });
    for (var i = 0; i < q.length; i++) {
      if (q[i].bad) { skipped.push(q[i].s + ' atlandı (' + q[i].bad.toLocaleLowerCase('tr') + ')'); continue; }
      var e = q[i]; e.st = 'offer'; e.left = rem * 60; e.offAt = clk(nowMin); e.untilM = nowMin + rem; e.until = clk(nowMin + rem); HOLD.Erkek = 1;
      return 'Teklif ' + e.s + ' için gönderildi (' + e.offAt + '). ' + (rem < wlDur() ? 'Seans ' + clk(30) + ' başlıyor, bu yüzden süre ' + rem + ' dk ile sınırlı. ' : '') + 'Son yanıt ' + e.until + ', gelmezse sıradakine geçer.' + (skipped.length ? ' ' + skipped.join(', ') + '.' : '');
    }
    HOLD.Erkek = 0; return 'Sırada teklif verilebilecek uygun üye yok.' + (skipped.length ? ' ' + skipped.join(', ') + '.' : '') + ' Yer açık kaldı.';
  }
  function wlRow(e, i) {
    var st = e.st === 'offer'
      ? '<span class="badge">Teklif verildi</span><small class="tnum" style="display:block;margin-top:2px;color:var(--muted-foreground)">Kalan <b data-cd="' + e.id + '" style="font-weight:500;color:var(--foreground)">' + mmss(e.left) + '</b> · son yanıt ' + e.until + '</small>'
      : '<span class="badge soft">Bekliyor</span>' + (e.bad ? '<small style="display:block;margin-top:2px;color:var(--destructive)">Teklif verilmez: ' + e.bad + '</small>' : '');
    return '<tr><td class="tnum">' + (i + 1) + '</td><td><span class="who"><span class="avatar sm">' + e.a + '</span><span class="nm"><span>' + e.n + '</span><small>' + e.cat + ' · ' + e.hak + '</small></span></span></td><td class="muted tnum">' + e.at + '</td><td>' + st + '</td><td class="act"><button type="button" class="btn ghost sm" data-wlrm="' + e.id + '">Çıkar</button></td></tr>';
  }
  var WLB = { acc: ['ok', 'Kabul etti'], rej: ['bad', 'Reddetti'], exp: ['soft', 'Süresi doldu'], out: ['soft', 'Çıkarıldı'] };
  function wlRender() {
    var on = wlOn(), q = wlQ(), o = wlOfferE();
    $('wl-off').hidden = on; $('wl-on').hidden = !on; $('wl-add').disabled = !on;
    $('n-wl').textContent = q.length;
    $('wl-s').textContent = on ? q.length + ' kişi sırada' + (o ? ', 1 açık teklif' : '') : 'Kapalı';
    $('wl-q').innerHTML = q.map(wlRow).join('') || '<tr><td colspan="5" class="muted" style="padding:24px 0">Sırada kimse yok.</td></tr>';
    var h = WL.filter(function (e) { return e.st !== 'wait' && e.st !== 'offer'; }).sort(function (a, b) { return b.rt - a.rt; });
    $('wl-h').innerHTML = h.map(function (e) { var b = WLB[e.st]; return '<tr><td><span class="who"><span class="avatar sm">' + e.a + '</span>' + e.s + '</span></td><td><span class="badge ' + b[0] + '">' + b[1] + '</span></td><td class="muted tnum">' + e.res + '</td><td class="muted">' + e.note + '</td></tr>'; }).join('') || '<tr><td colspan="4" class="muted" style="padding:16px 0">Henüz sonuçlanan teklif yok.</td></tr>';
    $('wl-banner').textContent = wlMsg || (o ? 'Teklif ' + o.s + ' için açık. Son yanıt ' + o.until + ', yanıt gelmezse sıradakine geçer.' : 'Şu an açık teklif yok. Erkek kategorisi ' + catN('Erkek') + ' / ' + CAP.Erkek + ' dolu. Yer açılınca sıradaki uygun üyeye süreli teklif gider.');
    var can = !o && HOLD.Erkek === 0 && nowMin < 30 && people.some(function (p) { return p[4] === 'active' && p[2] === 'Erkek'; });
    $('wl-d-open').disabled = !can; ['acc', 'rej', 'exp'].forEach(function (k) { $('wl-d-' + k).disabled = !o; });
    $('wl-hint').textContent = 'Teklif süresi ' + wlDur() + ' dk, seans başlayınca biter. Ayarlar > Rezervasyon\'dan değiştirilir.';
    refresh();
  }
  function wlTick() {
    var o = wlOfferE(); if (!o) return;
    o.left = Math.max(0, o.left - 1); var el = document.querySelector('[data-cd="' + o.id + '"]'); if (el) el.textContent = mmss(o.left);
    if (o.left === 0) { wlFinish(o, 'exp', 'Teklif süresi doldu'); nowMin = o.untilM; wlMsg = wlIssue(); wlRender(); }
  }
  wlTimer = setInterval(wlTick, 1000);
  $('wl-d-open').addEventListener('click', function () {
    var p = people.filter(function (q) { return q[4] === 'active' && q[2] === 'Erkek'; })[0]; if (!p) return;
    p[4] = 'cancelled'; wlMsg = p[0] + ' rezervasyonunu iptal etti, Erkek kategorisinde bir yer açıldı. ' + wlIssue(); wlRender(); toast('Yer açıldı, teklif gönderildi');
  });
  $('wl-d-acc').addEventListener('click', function () {
    var o = wlOfferE(); if (!o) return;
    var hk = o.hak.replace(/(\d+) hak kaldı/, function (m, n) { return (+n - 1) + ' hak kaldı'; });
    var ex = people.filter(function (q) { return q[0] === o.s; })[0]; if (ex) { ex[4] = 'active'; ex[3] = hk; } else people.push([o.s, o.a, o.cat, hk, 'active', '']);
    HOLD.Erkek = 0; wlFinish(o, 'acc', 'Rezervasyon oluştu, 1 ders ayrıldı'); wlMsg = o.s + ' teklifi kabul etti. Rezervasyon oluştu, kategori yeniden dolu.'; wlRender(); toast(o.s + ' yeri kabul etti');
  });
  $('wl-d-rej').addEventListener('click', function () {
    var o = wlOfferE(); if (!o) return; nowMin += 3; wlFinish(o, 'rej', 'Üye teklifi reddetti'); wlMsg = o.s + ' teklifi reddetti. ' + wlIssue(); wlRender();
  });
  $('wl-d-exp').addEventListener('click', function () {
    var o = wlOfferE(); if (!o) return; nowMin = o.untilM; wlFinish(o, 'exp', 'Teklif süresi doldu'); wlMsg = o.s + ' için süre doldu. ' + wlIssue(); wlRender();
  });
  /* Elle ekle */
  var wlSh = $('wl-sheet'), wlSc = $('wl-scrim'), wlOp = null;
  function wlCand() { return WLC.filter(function (c) { return !wlQ().some(function (e) { return e.n === c.n; }) && !actives().some(function (q) { return q[0] === c.s; }); }); }
  function wlSel() { var r = $('wl-list').querySelector('input:checked'); return r ? WLC.filter(function (c) { return c.n === r.value; })[0] : null; }
  function wlUpd() {
    var c = wlSel(), eff = $('wl-eff'); if (!c) { eff.hidden = true; $('wl-ok').disabled = true; return; }
    eff.hidden = false;
    eff.querySelector('ul').innerHTML = '<li><span class="row-l"><span>Sıra</span><b class="tnum">' + (wlQ().length + 1) + '. sıra</b></span><span class="ch">Sıra giriş zamanına göre belirlenir, öne alınamaz.</span></li>' +
      '<li><span class="row-l"><span>Hak</span><b>Ayrılmaz</b></span><span class="ch">Teklif kabul edilince 1 ders ayrılır, yoklama kapanınca tüketilir.</span></li>' +
      (c.bad ? '<li><span class="row-l"><span>Uyarı</span><b style="color:var(--destructive)">' + c.bad + '</b></span><span class="ch">Sıraya girer ama çözülene kadar teklif verilmez, sistem sıradakine geçer.</span></li>' : '');
    $('wl-ok').disabled = false;
  }
  function wlOpen() {
    wlOp = document.activeElement;
    $('wl-list').innerHTML = '<legend class="label">Üye</legend>' + wlCand().map(function (c) {
      return '<label class="opt' + (c.hard ? ' ap-off' : '') + '"><input type="radio" name="wlc" value="' + c.n + '"' + (c.hard ? ' disabled' : '') + '><span><b>' + c.n + '</b><small>' + c.cat + ' · ' + c.hak + '</small>' + (c.hard ? '<small style="color:var(--destructive)">' + c.hard + '</small>' : '') + '</span></label>';
    }).join('');
    wlUpd(); wlSh.hidden = false; wlSc.hidden = false; $('wl-x').focus();
  }
  function wlClose() { wlSh.hidden = true; wlSc.hidden = true; if (wlOp) wlOp.focus(); }
  $('wl-add').addEventListener('click', wlOpen); $('wl-x').addEventListener('click', wlClose); $('wl-cancel').addEventListener('click', wlClose); wlSc.addEventListener('click', wlClose);
  $('wl-form').addEventListener('change', wlUpd); $('wl-form').addEventListener('submit', function (e) { e.preventDefault(); });
  $('wl-ok').addEventListener('click', function () {
    var c = wlSel(); if (!c || $('wl-ok').disabled) return;
    WL.push({ id: wlSeq++, n: c.n, s: c.s, a: c.a, cat: c.cat, hak: c.hak, bad: c.bad, at: '4 Kas 14:20', st: 'wait' });
    wlClose(); wlMsg = ''; wlRender(); toast(c.s + ' bekleme listesine eklendi');
  });
  /* Çıkar */
  var wlDl = $('wl-dlg'), wlDs = $('wl-dscrim');
  function wlDClose() { wlDl.hidden = true; wlDs.hidden = true; wlRm = 0; }
  $('wl-q').addEventListener('click', function (e) {
    var b = e.target.closest('[data-wlrm]'); if (!b) return; wlRm = +b.getAttribute('data-wlrm');
    var x = WL.filter(function (q) { return q.id === wlRm; })[0], q = wlQ(), idx = q.indexOf(x);
    $('wl-db').innerHTML = '<b style="font-weight:500;color:var(--foreground)">' + x.n + '</b> bekleme listesinden çıkar. ' + (x.st === 'offer' ? 'Açık yer teklifi iptal olur, yer sıradaki uygun üyeye geçer.' : (q.length - 1 - idx > 0 ? 'Arkasındaki ' + (q.length - 1 - idx) + ' üye bir sıra yukarı çıkar.' : 'Arkasında bekleyen yok.')) + ' Üyenin rezervasyonu ve hakları değişmez.';
    wlDl.hidden = false; wlDs.hidden = false; $('wl-dok').focus();
  });
  $('wl-dcancel').addEventListener('click', wlDClose); wlDs.addEventListener('click', wlDClose);
  $('wl-dok').addEventListener('click', function () {
    var x = WL.filter(function (q) { return q.id === wlRm; })[0]; if (!x) return; var was = x.st === 'offer';
    wlFinish(x, 'out', 'Yönetici çıkardı'); wlDClose(); wlMsg = x.s + ' listeden çıkarıldı.'; if (was) { HOLD.Erkek = 0; wlMsg += ' ' + wlIssue(); } wlRender(); toast(x.s + ' sıradan çıkarıldı');
  });
  document.addEventListener('keydown', function (e) { if (e.key !== 'Escape') return; if (!wlDl.hidden) wlDClose(); else if (!wlSh.hidden) wlClose(); });
  ['ay-bekleme', 'ay-teklif'].forEach(function (id) { var el = $(id); if (el) el.addEventListener('change', wlRender); });
  SHARED.wl = { render: wlRender, queue: wlQ };
  wlRender();

  /* Düzenleme çekmecesi: form, önizleme, uygula */
  var sheet = $('sheet'), sscrim = $('sheet-scrim'), opener = null;
  function step(n) {
    $('step1').hidden = n !== 1; $('foot1').hidden = n !== 1; $('step2').hidden = n !== 2; $('foot2').hidden = n !== 2;
    $('sheet-title').textContent = n === 1 ? 'Seansı düzenle' : 'Değişiklik önizlemesi';
  }
  function openSheet() { opener = document.activeElement; step(1); sheet.hidden = false; sscrim.hidden = false; $('e-bas').focus(); }
  function closeSheet() { sheet.hidden = true; sscrim.hidden = true; if (opener) opener.focus(); }
  $('edit-open').addEventListener('click', openSheet);
  $('sheet-x').addEventListener('click', closeSheet);
  $('e-cancel').addEventListener('click', closeSheet);
  sscrim.addEventListener('click', closeSheet);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !sheet.hidden) closeSheet(); });
  $('e-cat').addEventListener('change', function () { $('e-cats').hidden = !$('e-cat').checked; });
  function sumCats() { $('e-top').value = (+$('e-m').value || 0) + (+$('e-f').value || 0); }
  $('e-m').addEventListener('input', sumCats); $('e-f').addEventListener('input', sumCats);
  $('e-preview').addEventListener('click', function () {
    var future = document.querySelector('input[name="scope"]:checked').value === 'future';
    var days = future ? ['4 Kasım, Çarşamba', '11 Kasım, Çarşamba', '18 Kasım, Çarşamba'] : ['4 Kasım, Çarşamba'];
    var lines = [];
    if ($('e-bas').value !== '14:30' || $('e-bit').value !== '15:30') lines.push('Saat: 14:30 - 15:30 → ' + $('e-bas').value + ' - ' + $('e-bit').value);
    if ($('e-top').value !== '12') lines.push('Kontenjan: 12 → ' + $('e-top').value);
    if (!lines.length) lines.push('Değişiklik yok');
    $('aff-title').textContent = 'Değişecek seanslar (' + days.length + ')';
    $('aff-list').innerHTML = days.map(function (d) { return '<li><b style="font-weight:500">' + d + '</b>' + lines.map(function (l) { return '<span class="ch tnum">' + l + '</span>'; }).join('') + '</li>'; }).join('');
    step(2);
  });
  $('e-back').addEventListener('click', function () { step(1); });
  $('e-apply').addEventListener('click', function () { closeSheet(); toast('Değişiklikler kaydedildi'); });

  /* ---------- Üyeler (kurgusal veri) ---------- */
  var stu = [
    { id: 1, n: 'Cem Demir', a: 'CD', on: true, k: 't', until: '30 Kas', next: 'Çar 14:30', debt: 0, pkg: 'Aylık sınırsız', per: '1 - 30 Kasım' },
    { id: 2, n: 'Selin Aksoy', a: 'SA', on: true, k: 'c', tot: 8, av: 5, rs: 1, cn: 2, next: 'Çar 14:30', debt: 0, pkg: '8 derslik paket', per: '1 Eki - 31 Ara' },
    { id: 3, n: 'Burak Kaya', a: 'BK', on: true, k: 'c', tot: 12, av: 9, rs: 1, cn: 2, next: 'Çar 14:30', debt: 0, pkg: '12 derslik paket', per: '15 Eki - 15 Oca' },
    { id: 4, n: 'Merve Tan', a: 'MT', on: true, k: 't', until: '30 Kas', next: 'Sal 19:00', debt: 0, pkg: 'Aylık sınırsız', per: '1 - 30 Kasım' },
    { id: 5, n: 'Onur Çelik', a: 'OÇ', on: true, k: 'c', tot: 8, av: 2, rs: 1, cn: 5, next: 'Çar 14:30', debt: 0, pkg: '8 derslik paket', per: '20 Eyl - 20 Ara' },
    { id: 6, n: 'Derya Sönmez', a: 'DS', on: true, k: 'c', tot: 12, av: 7, rs: 1, cn: 4, next: 'Çar 18:30', debt: 0, pkg: '12 derslik paket', per: '5 Eki - 5 Oca' },
    { id: 7, n: 'Ece Mutlu', a: 'EM', on: true, k: 't', until: '15 Ara', next: 'Çar 14:30', debt: 0, pkg: 'Aylık sınırsız', per: '15 Kas - 15 Ara' },
    { id: 8, n: 'Kerem Zorlu', a: 'KZ', on: true, k: 'c', tot: 8, av: 4, rs: 0, cn: 4, next: '', debt: 450, pkg: '8 derslik paket', per: '1 Eki - 31 Ara' },
    { id: 9, n: 'Nehir Gür', a: 'NG', on: true, k: 'c', tot: 12, av: 10, rs: 2, cn: 0, next: 'Sal 19:00', debt: 0, pkg: '12 derslik paket', per: '30 Eki - 30 Oca' },
    { id: 10, n: 'Aylin Polat', a: 'AP', on: false, k: 'c', tot: 8, av: 0, rs: 0, cn: 8, next: '', debt: 0, pkg: '8 derslik paket', per: '1 Haz - 1 Eyl' },
    { id: 11, n: 'Emre Vural', a: 'EV', on: false, k: 't', until: '30 Eki', next: '', debt: 0, pkg: 'Aylık sınırsız', per: '1 - 30 Ekim', ended: true },
    { id: 12, n: 'Tolga Yıldız', a: 'TY', on: true, k: 'c', tot: 8, av: 6, rs: 0, cn: 2, next: '', debt: 0, pkg: '8 derslik paket', per: '12 Eki - 12 Oca' }
  ];
  var DAY = { Pzt: '9 Kas', Sal: '10 Kas', 'Çar': '4 Kas' };
  var TL = function (n) { return '₺' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); };
  stu.forEach(function (s) {
    var f = s.n.split(' ');
    s.mail = (f[0] + '.' + f[1]).toLowerCase().replace(/ç/g, 'c').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ı/g, 'i').replace(/ü/g, 'u').replace(/ğ/g, 'g') + '@ornek.test';
    s.tel = '+90 532 000 00 ' + (s.id < 10 ? '0' + s.id : s.id); s.verified = s.id % 4 !== 0;
    s.joined = ['12 Eyl 2025', '3 Mar 2026', '20 Haz 2025'][s.id % 3];
    s.start = s.k === 't' ? '1 ' + s.per.split(' ').pop() : s.per.split(' - ')[0];
    s.price = s.k === 'c' ? s.tot * 150 : 1500;
    s.rez = [];
    if (s.next) { var p = s.next.split(' '); s.rez.push({ d: p[0] + ', ' + DAY[p[0]] + ' ' + p[1], c: 'Arjantin tango teknik', r: 'up', y: 'wait' }); }
    s.rez.push({ d: 'Pzt, 26 Eki 18:30', c: 'Bachata başlangıç', r: 'done', y: 'att' });
    s.rez.push({ d: 'Pzt, 19 Eki 14:30', c: 'Arjantin tango teknik', r: 'done', y: 'att' });
    s.rez.push({ d: 'Çar, 14 Eki 19:00', c: 'Salsa orta', r: 'done', y: s.id % 4 === 0 ? 'no' : 'att' });
    s.rez.push({ d: 'Pzt, 12 Eki 14:30', c: 'Arjantin tango teknik', r: 'cancelled', y: '' });
    s.rez.push({ d: 'Pzt, 5 Eki 18:30', c: 'Bachata başlangıç', r: 'done', y: 'att' });
    s.pay = [{ d: s.start, t: 'Paket satışı', m: s.pkg, a: s.price }];
    if (s.price - s.debt > 0) s.pay.unshift({ d: s.start, t: 'Tahsilat', m: 'Nakit', a: -(s.price - s.debt) });
    s.past = s.id % 3 === 0 ? [{ n: '8 derslik paket', per: '1 Haz - 1 Eyl', note: '8 / 8 kullanıldı' }] : [];
  });
  var fil = 'all', sel = 2;
  function hakCell(s) {
    if (s.k === 't') return '<span class="' + (s.ended ? 'muted' : '') + '">' + (s.ended ? 'Süresi doldu' : 'Süreli, ' + s.until + '\'e kadar') + '</span>';
    return '<span class="minibar tnum"><span class="bar"><i style="width:' + Math.round(s.av / s.tot * 100) + '%"></i></span>' + s.av + ' / ' + s.tot + (s.av <= 2 && s.on ? ' <span class="badge" style="margin-left:4px">Az kaldı</span>' : '') + '</span>';
  }
  function badgeOn(s) { return s.on ? '<span class="badge">Aktif</span>' : '<span class="badge soft">Pasif</span>'; }
  function renderList() {
    var q = $('st-search').value.trim().toLocaleLowerCase('tr');
    var rows = stu.filter(function (s) { return (fil === 'all' || (fil === 'on') === s.on) && s.n.toLocaleLowerCase('tr').indexOf(q) > -1; });
    $('st-body').innerHTML = rows.map(function (s) {
      return '<tr tabindex="0" data-id="' + s.id + '" aria-selected="' + (sel === s.id) + '"><td><span class="who"><span class="avatar sm">' + s.a + '</span><span class="nm"><span>' + s.n + '</span><small>' + s.mail + '</small></span></span></td>' +
        '<td>' + badgeOn(s) + '</td><td>' + hakCell(s) + '</td><td class="tnum ' + (s.next ? '' : 'muted') + '">' + (s.next || '-') + '</td><td class="tnum">' + (s.debt ? '<span class="debt">' + TL(s.debt) + '</span>' : '<span class="muted">-</span>') + '</td></tr>';
    }).join('') || '<tr><td colspan="5" class="muted" style="padding:32px 0;text-align:center">Aramana uygun üye yok.</td></tr>';
    $('st-count').textContent = rows.length + ' üye gösteriliyor, ' + stu.filter(function (s) { return s.on; }).length + ' / 100 aktif';
  }
  function cur() { return stu.filter(function (x) { return x.id === sel; })[0] || stu[1]; }
  function dock() {
    var s = cur(), d = $('dock');
    d.innerHTML = '<div class="card-c"><div class="who-l"><span class="avatar lg">' + s.a + '</span><div><h2>' + s.n + '</h2><div class="badges" style="margin-top:4px">' + badgeOn(s) + '</div></div></div>' +
      '<dl><dt>Hak</dt><dd>' + s.pkg + (s.k === 'c' ? ', ' + s.av + ' hak kaldı' : '') + '</dd><dt>Sıradaki</dt><dd class="tnum">' + (s.next || '-') + '</dd><dt>Borç</dt><dd class="tnum">' + (s.debt ? '<span class="debt">' + TL(s.debt) + '</span>' : '-') + '</dd><dt>E-posta</dt><dd>' + s.mail + '</dd></dl></div>' +
      '<div class="card-f"><button type="button" class="btn outline sm" data-act="alloc">Hak tahsis et</button><a class="btn sm" href="#uye">Profili aç</a></div>';
  }
  function select(id) { sel = id; renderList(); dock(); }
  SHARED.selectMember = select;
  $('st-body').addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-id]'); if (!tr) return;
    select(+tr.getAttribute('data-id'));
    if (window.matchMedia('(max-width: 1180px)').matches) location.hash = 'uye';
  });
  $('st-body').addEventListener('keydown', function (e) {
    var tr = e.target.closest('tr[data-id]'); if (!tr || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault(); select(+tr.getAttribute('data-id')); var r = document.querySelector('tr[data-id="' + sel + '"]'); if (r) r.focus();
  });
  $('st-search').addEventListener('input', renderList);
  $('st-filter').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-f]'); if (!b) return; fil = b.getAttribute('data-f');
    $('st-filter').querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); renderList();
  });
  renderList(); dock();

  /* ---------- Üye profili ---------- */
  var RB = { up: '<span class="badge">Kesin</span>', done: '<span class="badge soft">Tamamlandı</span>', cancelled: '<span class="badge soft">İptal edildi</span>' };
  var YB = { att: '<span class="badge ok">Geldi</span>', no: '<span class="badge bad">Gelmedi</span>', wait: '<span class="badge soft">Bekliyor</span>', '': '<span class="muted">-</span>' };
  var rf = 'all';
  function kpi(l, v, sub, cls) { return '<div class="kpi card"><span class="l">' + l + '</span><b class="tnum ' + (cls || '') + '">' + v + '</b><span class="sub">' + sub + '</span></div>'; }
  function rezRows(s) {
    return s.rez.filter(function (r) { return rf === 'all' || (rf === 'up') === (r.r === 'up'); }).map(function (r) {
      var hak = s.k === 't' ? '<span class="muted">-</span>' : r.r === 'cancelled' ? '<span class="muted">İade +1</span>' : r.r === 'up' ? '<span class="muted">Ayrıldı</span>' : '-1';
      return '<tr><td><span class="nm"><span>' + r.c + '</span><small class="tnum">' + r.d + '</small></span></td><td>' + RB[r.r] + '</td><td>' + YB[r.y] + '</td><td class="tnum">' + hak + '</td><td class="act">' + (r.r === 'up' ? '<button type="button" class="btn ghost sm" data-act="rcancel">İptal et</button>' : '') + '</td></tr>';
    }).join('') || '<tr><td colspan="5" class="muted" style="text-align:center;padding:28px 0">Kayıt yok.</td></tr>';
  }
  function profile() {
    var s = cur();
    $('pf-head').innerHTML = '<div class="pf-head"><span class="avatar">' + s.a + '</span><div class="grow"><h1>' + s.n + '</h1><div class="badges">' + badgeOn(s) + '<span class="badge soft">Üye: ' + s.joined + '</span></div></div>' +
      '<div class="page-actions">' + (s.on ? '<button type="button" class="btn" data-act="alloc"><i data-i="plus"></i>Paket / hak tahsis et</button><button type="button" class="btn outline" data-act="collect"><i data-i="card"></i>Tahsilat al</button><button type="button" class="btn ghost" id="pf-off">Pasifleştir</button>' : '<button type="button" class="btn" id="pf-on">Üyeyi etkinleştir</button>') + '</div></div>';
    var done = s.rez.filter(function (r) { return r.r === 'done'; }), att = done.filter(function (r) { return r.y === 'att'; }).length;
    $('pf-kpi').innerHTML =
      kpi('Kullanılabilir hak', s.k === 'c' ? s.av + '<small> / ' + s.tot + '</small>' : s.ended ? '0' : 'Sınırsız', fzState(s) === 'active' ? 'Donduruldu, ' + fdI(s.fz.to) + '\'e kadar' : s.k === 'c' ? s.cn + ' ders kullanıldı' : s.ended ? (s.term ? 'Sonlandırıldı' : 'Süre doldu') : s.until + '\'e kadar') +
      kpi('Yaklaşan rezervasyon', String(s.rez.filter(function (r) { return r.r === 'up'; }).length), s.next ? 'Sıradaki: ' + s.next : 'Rezervasyon yok') +
      kpi('Açık borç', s.debt ? TL(s.debt) : '₺0', s.debt ? 'Tahsilat bekliyor' : 'Borç yok', s.debt ? 'debt' : '') +
      kpi('Son 90 gün yoklama', att + '<small> / ' + done.length + '</small>', att + ' geldi, ' + (done.length - att) + ' gelmedi');
    /* Haklar */
    var ent, fz = fzState(s), live = s.on && !s.ended && !s.term && (s.k === 't' || s.av > 0);
    var bdg = s.term ? '<span class="badge soft">Sonlandırıldı</span>' : fz === 'active' ? '<span class="badge">Donduruldu</span>' : fz === 'plan' ? '<span class="badge soft">Dondurma planlı</span>' : '';
    var acts = '';
    if (live) acts = fz ? '<button type="button" class="btn ghost sm" data-act="unfreeze">' + (fz === 'plan' ? 'Dondurmayı iptal et' : 'Dondurmayı bitir') + '</button>' : (frzRule(s).on ? '<button type="button" class="btn ghost sm" data-act="freeze">Dondur</button>' : '') + '<button type="button" class="btn ghost sm" data-act="extend">Süreyi uzat</button>' + (s.k === 'c' ? '<button type="button" class="btn ghost sm" data-act="adjust">Hakkı düzelt</button>' : '');
    if (live) acts += '<button type="button" class="btn ghost sm" data-act="terminate" style="color:var(--destructive)">Sonlandır</button>';
    var fzNote = s.fz ? '<p class="note" style="margin:8px 0 0"><i data-i="lock"></i><span class="tnum">' + (fz === 'plan' ? 'Dondurma planlı: ' : 'Donduruldu: ') + fdI(s.fz.from) + ' - ' + fdI(s.fz.to) + ' (' + s.fz.days + ' gün). Bu sürede rezervasyon yapılamaz. Bitiş ' + s.fz.days + ' gün uzatıldı.</span></p>' : '';
    var crNote = s.cr ? '<p class="note" style="margin:8px 0 0"><i data-i="card"></i><span class="tnum">Alacak ' + TL(s.cr) + '. İade ya da mahsup Finans > Alacaklar üzerinden yapılır.</span></p>' : '';
    if (s.k === 'c') {
      var w = function (n) { return (n / s.tot * 100) + '%'; }, open = live;
      ent = '<div class="ent"><div class="ent-h"><div><b>' + s.pkg + '</b><span class="muted tnum"> · ' + s.per + '</span></div><div class="ent-r">' + (bdg || '<span class="badge ' + (open ? 'ok' : 'soft') + '">' + (open ? 'Etkin' : 'Kapandı') + '</span>') + '</div></div>' + (acts ? '<div class="ent-acts">' + acts + '</div>' : '') +
        '<div class="split-bar" role="img" aria-label="' + s.av + ' kullanılabilir, ' + s.rs + ' ayrılmış, ' + s.cn + ' kullanılmış"><i class="av" style="width:' + w(s.av) + '"></i><i class="rs" style="width:' + w(s.rs) + '"></i><i class="cn" style="width:' + w(s.cn) + '"></i></div>' +
        '<div class="ent-n tnum"><span><b>' + s.av + '</b> kullanılabilir</span><span><b>' + s.rs + '</b> ayrılmış</span><span><b>' + s.cn + '</b> kullanılmış</span></div>' + fzNote + crNote + '</div>';
    } else {
      ent = '<div class="ent"><div class="ent-h"><div><b>' + s.pkg + '</b><span class="muted tnum"> · ' + s.per + '</span></div><div class="ent-r">' + (bdg || '<span class="badge ' + (s.ended ? 'soft' : 'ok') + '">' + (s.ended ? 'Süresi doldu' : 'Etkin') + '</span>') + '</div></div>' + (acts ? '<div class="ent-acts">' + acts + '</div>' : '') + '<div class="ent-n"><span>Ders sayısı sınırı yok</span></div>' + fzNote + crNote + '</div>';
    }
    $('pf-haklar').innerHTML = '<div class="pn-h"><h2>Mevcut haklar</h2>' + (s.on ? '<span style="display:flex;gap:8px"><button type="button" class="btn outline sm" data-act="renew">Paketi yenile</button>' + (live && !fz ? '<button type="button" class="btn outline sm" data-act="change">Paketi değiştir</button>' : '') + '</span>' : '') + '</div><div class="pn-b">' + ent + '</div>' + negCard(s) + ledgerCard(s) +
      (s.past.length ? '<div class="pn-h"><h2>Geçmiş haklar</h2></div><ul class="lines">' + s.past.map(function (p) { return '<li><div><b style="font-weight:500">' + p.n + '</b><p class="s tnum">' + p.per + '</p></div><span class="muted">' + p.note + '</span></li>'; }).join('') + '</ul>' : '');
    /* Rezervasyon ve yoklama */
    $('pf-rez').innerHTML = '<div class="pn-h"><h2>Rezervasyon ve yoklama geçmişi</h2><div class="seg sm" role="group" aria-label="Filtre" id="rf"><button type="button" data-rf="all" aria-pressed="' + (rf === 'all') + '">Tümü</button><button type="button" data-rf="up" aria-pressed="' + (rf === 'up') + '">Yaklaşan</button><button type="button" data-rf="past" aria-pressed="' + (rf === 'past') + '">Geçmiş</button></div></div>' +
      '<div class="table-wrap" style="padding:0 20px 8px"><table class="list static"><thead><tr><th>Ders</th><th>Rezervasyon</th><th>Yoklama</th><th>Hak</th><th></th></tr></thead><tbody>' + rezRows(s) + '</tbody></table></div>';
    /* Ödemeler */
    $('pf-odeme').innerHTML = '<div class="pn-h"><h2>Ödeme kayıtları</h2>' + (s.on ? '<button type="button" class="btn outline sm" data-act="collect">Tahsilat al</button>' : '') + '</div>' +
      '<div class="table-wrap" style="padding:0 20px 8px"><table class="list static"><thead><tr><th>Tarih</th><th>İşlem</th><th>Yöntem / kalem</th><th class="r">Tutar</th></tr></thead><tbody>' +
      s.pay.map(function (p) { return '<tr><td class="tnum">' + p.d + '</td><td>' + p.t + '</td><td class="muted">' + p.m + '</td><td class="r tnum ' + (p.a < 0 ? 'pos' : '') + '">' + (p.a < 0 ? '-' : '') + TL(Math.abs(p.a)) + '</td></tr>'; }).join('') +
      '</tbody><tfoot><tr><td colspan="3">Açık borç</td><td class="r tnum">' + (s.debt ? '<span class="debt">' + TL(s.debt) + '</span>' : '₺0') + '</td></tr></tfoot></table></div>';
    /* Yan: bilgi amaçlı kişi bilgileri */
    $('pf-side').innerHTML = '<div class="card"><div class="card-h"><h2>Kişi bilgileri</h2></div><div class="card-c">' +
      '<div class="cv"><div><span class="k">E-posta</span>' + s.mail + '</div><span class="badge ' + (s.verified ? 'ok' : 'soft') + '">' + (s.verified ? 'Doğrulandı' : 'Doğrulanmadı') + '</span></div>' +
      '<div class="cv"><div><span class="k">Telefon</span><span class="tnum">' + s.tel + '</span></div><span class="badge soft">Doğrulanmadı</span></div>' +
      '<p class="note"><i data-i="lock"></i>Bu bilgileri yalnızca üyenin kendisi değiştirebilir.</p></div></div>';
    swap($('pf-head')); swap($('pf-side'));
  }
  function panelRerender() { profile(); renderList(); dock(); }
  SHARED.refreshMembers = function () { panelRerender(); };
  SHARED.stu = function () { return stu; };
  document.querySelectorAll('[data-ptab]').forEach(function (t) {
    t.addEventListener('click', function () {
      document.querySelectorAll('[data-ptab]').forEach(function (x) { x.setAttribute('aria-selected', String(x === t)); });
      document.querySelectorAll('[data-ppanel]').forEach(function (p) { p.hidden = p.getAttribute('data-ppanel') !== t.getAttribute('data-ptab'); });
    });
  });
  window.addEventListener('hashchange', function () { if (location.hash === '#uye') profile(); });
  if (location.hash === '#uye') profile();

  /* ---------- Üye davet çekmecesi ---------- */
  var sh2 = $('sheet2'), sc2 = $('sheet2-scrim'), op2 = null;
  function closeS2() { sh2.hidden = true; sc2.hidden = true; if (op2) op2.focus(); }
  $('st-add').addEventListener('click', function () { op2 = document.activeElement; $('s-eposta').value = ''; sh2.hidden = false; sc2.hidden = false; $('s-eposta').focus(); });
  $('s2-x').addEventListener('click', closeS2); $('s2-cancel').addEventListener('click', closeS2); sc2.addEventListener('click', closeS2);
  $('s2-save').addEventListener('click', function () { if (!$('s-eposta').value.trim()) { toast('E-posta zorunlu'); return; } closeS2(); toast('Davet gönderildi'); });

  /* ---------- İşlem çekmecesi: satış, yenileme, süre uzatma, hak düzeltme, negatif limit, tahsilat ---------- */
  var sh3 = $('sheet3'), sc3 = $('sheet3-scrim'), op3 = null, mode = '', PK = [
    { id: 'p8', n: '8 derslik paket', p: 1200, c: 8, days: 90, d: '3 ay geçerli' },
    { id: 'p12', n: '12 derslik paket', p: 1800, c: 12, days: 90, d: '3 ay geçerli' },
    { id: 'pt', n: 'Aylık sınırsız', p: 1500, c: 0, days: 30, d: '30 gün, ders sayısı sınırsız' }
  ], MN = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'], TODAY_ISO = '2026-11-04';
  function fmt(dt) { return dt.getDate() + ' ' + MN[dt.getMonth()] + ' ' + dt.getFullYear(); }
  function short(dt) { return dt.getDate() + ' ' + MN[dt.getMonth()]; }
  function pEnd(str) {
    var m = /(\d{1,2})\s+([^\s\d]+)\s*$/.exec(str || ''); if (!m) return null;
    var mi = MN.indexOf(m[2].slice(0, 3)); if (mi < 0) return null;
    return new Date(mi <= 4 ? 2027 : 2026, mi, +m[1]);
  }
  function addDays(dt, n) { var d = new Date(dt); d.setDate(d.getDate() + n); return d; }
  function pkOf(s) { return PK.filter(function (p) { return p.n === s.pkg; })[0] || PK[0]; }
  function escH(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
  function pI(x) { return new Date(x + 'T00:00:00'); }
  function dI(dt) { return dt.getFullYear() + '-' + ('0' + (dt.getMonth() + 1)).slice(-2) + '-' + ('0' + dt.getDate()).slice(-2); }
  function fdI(x) { return short(pI(x)); }
  function fzState(s) { return !s.fz ? '' : s.fz.from <= TODAY_ISO ? 'active' : 'plan'; }
  function upRez(s) { return s.rez.filter(function (r) { return r.r === 'up'; }); }
  function rezIn(s, a, b) { return upRez(s).filter(function (r) { var m = /(\d{1,2})\s+Kas/.exec(r.d); if (!m) return false; var x = '2026-11-' + ('0' + m[1]).slice(-2); return x >= a && x <= b; }); }
  function unusedOf(s) {
    var cp = pkOf(s);
    if (s.k === 'c') return { v: Math.round(s.av * (cp.p / (cp.c || 1))), t: s.av + ' kullanılabilir ders × ' + TL(Math.round(cp.p / (cp.c || 1))) };
    var en = pEnd(s.until), n = en ? Math.max(0, Math.round((en - pI(TODAY_ISO)) / 864e5)) : 0;
    return { v: Math.round(cp.p * Math.min(n, 30) / 30), t: n + ' gün kalan süre' };
  }
  SHARED.frozen = function (name) { var m = stu.filter(function (x) { return x.n === name; })[0]; return m && fzState(m) === 'active' ? m.fz : null; };
  function negOf(s) { if (!s.neg) { var k = pkOf(s); s.neg = { lim: 0, used: 0, unit: (SHARED.pkgNv && SHARED.pkgNv(s.pkg)) || Math.round(k.p / (k.c || 1)) }; } return s.neg; }
  function frzRule(s) { return SHARED.pkgFreeze ? SHARED.pkgFreeze(s.pkg) : { on: true, max: 30 }; }
  function ledgerOf(s) {
    if (!s.led) { s.led = [{ d: (s.per || '').split(' - ')[0], t: 'Paket tahsisi: ' + s.pkg, n: '+' + s.tot }]; if (s.cn > 0) s.led.unshift({ d: 'Toplam', t: 'Yoklaması kapanan dersler', n: '-' + s.cn }); }
    return s.led;
  }
  function negCard(s) {
    if (s.k !== 'c' || s.term) return ''; var n = negOf(s);
    return '<div class="pn-h"><h2>Negatif limit</h2>' + (s.on ? '<button type="button" class="btn ghost sm" data-act="neg">Düzenle</button>' : '') + '</div><div class="pn-b"><div class="ent-n tnum"><span><b>' + n.lim + '</b> ders limit' + (n.lim ? '' : ', kapalı') + '</span><span><b>' + n.used + '</b> kullanıldı</span><span><b>' + TL(n.unit) + '</b> ders değeri</span></div></div>';
  }
  function ledgerCard(s) {
    if (s.k !== 'c') return '';
    return '<div class="pn-h"><h2>Hak hareketleri</h2></div><ul class="lines">' + ledgerOf(s).map(function (x) { return '<li><div><b style="font-weight:500">' + escH(x.t) + '</b><p class="s tnum">' + x.d + '</p></div><span class="tnum">' + x.n + '</span></li>'; }).join('') + '</ul>';
  }
  function effList(rows) { return rows.map(function (r) { return '<li><span class="row-l"><span>' + r[0] + '</span><b class="tnum">' + r[1] + '</b></span>' + (r[2] ? '<span class="ch">' + r[2] + '</span>' : '') + '</li>'; }).join(''); }
  var EFF = '<div><p class="sub">Etki</p><ul class="aff" id="s3-eff"></ul></div><p class="note" id="s3-err" style="color:var(--destructive)" hidden></p>';
  function whyField() { return '<div class="field"><label class="label" for="s3-why">Gerekçe<span class="hint">Zorunlu</span></label><textarea class="input" id="s3-why" rows="2" placeholder="Örn. Telafi dersi"></textarea><span class="hint">Kayıt geçmişe düşer.</span></div>'; }
  function closeS3() { sh3.hidden = true; sc3.hidden = true; if (op3) op3.focus(); }
  function saleBody(m) {
    var s = cur(), cp = pkOf(s);
    return '<fieldset class="scope"><legend class="label">Paket</legend>' + PK.map(function (p) { var chk = m === 'renew' ? p.id === cp.id : p.id === 'p8'; return '<label class="opt"><input type="radio" name="pk" value="' + p.id + '"' + (chk ? ' checked' : '') + '><span><b>' + p.n + '</b><small>' + TL(p.p) + ' · ' + p.d + '</small></span></label>'; }).join('') + '</fieldset>' +
      (m === 'renew' ? '<div class="field"><span class="label">Başlangıç</span><div class="seg" role="group" aria-label="Başlangıç" id="s3-when"><button type="button" aria-pressed="true" data-w="after">Mevcut hakkın bitiminden sonra</button><button type="button" aria-pressed="false" data-w="now">Bugün</button></div></div>'
        : '<div class="field"><label class="label" for="s3-start">Başlangıç<span class="hint">Geçmiş ya da ileri tarih seçebilirsin</span></label><input class="input tnum" id="s3-start" type="date" value="' + TODAY_ISO + '"></div>') +
      '<fieldset class="scope"><legend class="label">Ödeme</legend><label class="opt"><input type="radio" name="pay" value="now" checked><span><b>Şimdi tahsil et</b><small>Tahsilat kaydı oluşturulur</small></span></label><label class="opt"><input type="radio" name="pay" value="debt"><span><b>Borç olarak kaydet</b><small>Tutar açık borca eklenir</small></span></label></fieldset>' + EFF;
  }
  function openS3(m) {
    var s = cur(); mode = m; op3 = document.activeElement; var b = $('s3-body');
    if (s.k === 'c') ledgerOf(s);
    if (m === 'alloc' || m === 'renew') {
      $('s3-title').textContent = m === 'alloc' ? 'Paket / hak tahsis et' : 'Paketi yenile'; $('s3-sub').textContent = m === 'alloc' ? s.n + ' için yeni hak oluştur.' : s.n + ' · mevcut: ' + s.pkg; $('s3-ok').textContent = m === 'alloc' ? 'Tahsis et' : 'Yenile';
      b.innerHTML = saleBody(m);
    } else if (m === 'freeze') {
      $('s3-title').textContent = 'Hakkı dondur'; $('s3-sub').textContent = s.n + ' · ' + s.pkg + ', bitiş ' + (s.k === 't' ? s.until : (s.per || '').split(' - ')[1]); $('s3-ok').textContent = 'Dondur';
      b.innerHTML = '<div class="form-grid two-col"><div class="field"><label class="label" for="s3-f1">Başlangıç</label><input class="input tnum" id="s3-f1" type="date" min="' + TODAY_ISO + '" value="' + TODAY_ISO + '"></div><div class="field"><label class="label" for="s3-f2">Bitiş<span class="hint">Dahil</span></label><input class="input tnum" id="s3-f2" type="date" min="' + TODAY_ISO + '" value="' + dI(addDays(pI(TODAY_ISO), 13)) + '"></div></div>' +
        '<fieldset class="scope"><legend class="label">Aralıktaki rezervasyonlar</legend><label class="opt"><input type="radio" name="rz" value="cancel" checked><span><b>İptal et</b><small>Hak iade edilir, üyeye bildirim gider</small></span></label><label class="opt"><input type="radio" name="rz" value="keep"><span><b>Kesin kalsın</b><small>Hak ayrılmış kalır, üye kendisi iptal eder</small></span></label></fieldset>' + whyField() + '<span class="hint">En fazla ' + frzRule(s).max + ' gün (paket kuralı). Dondurma süreyi, dondurulan gün kadar uzatır.</span>' + EFF;
    } else if (m === 'unfreeze') {
      var pl = fzState(s) === 'plan';
      $('s3-title').textContent = pl ? 'Dondurmayı iptal et' : 'Dondurmayı bitir'; $('s3-sub').textContent = s.n + ' · ' + fdI(s.fz.from) + ' - ' + fdI(s.fz.to) + ' (' + s.fz.days + ' gün)'; $('s3-ok').textContent = pl ? 'Dondurmayı iptal et' : 'Dondurmayı bitir';
      b.innerHTML = EFF;
    } else if (m === 'change') {
      $('s3-title').textContent = 'Paketi değiştir'; $('s3-sub').textContent = s.n + ' · mevcut: ' + s.pkg; $('s3-ok').textContent = 'Paketi değiştir';
      b.innerHTML = '<fieldset class="scope"><legend class="label">Yeni paket</legend>' + PK.filter(function (p) { return p.n !== s.pkg; }).map(function (p, i) { return '<label class="opt"><input type="radio" name="pk" value="' + p.id + '"' + (i === 0 ? ' checked' : '') + '><span><b>' + p.n + '</b><small>' + TL(p.p) + ' · ' + p.d + '</small></span></label>'; }).join('') + '</fieldset>' +
        '<fieldset class="scope" id="ch-pay"><legend class="label">Fark ödemesi</legend><label class="opt"><input type="radio" name="pay" value="now" checked><span><b>Şimdi tahsil et</b><small>Tahsilat kaydı oluşturulur</small></span></label><label class="opt"><input type="radio" name="pay" value="debt"><span><b>Borç olarak kaydet</b><small>Tutar açık borca eklenir</small></span></label></fieldset>' + whyField() + EFF;
    } else if (m === 'terminate') {
      $('s3-title').textContent = 'Hakkı sonlandır'; $('s3-sub').textContent = s.n + ' · ' + s.pkg; $('s3-ok').textContent = 'Hakkı sonlandır';
      b.innerHTML = '<fieldset class="scope"><legend class="label">Kalan değer</legend><label class="opt"><input type="radio" name="tv" value="credit" checked><span><b>Alacak olarak yaz</b><small>İade ya da mahsup sonra yapılır</small></span></label><label class="opt"><input type="radio" name="tv" value="void"><span><b>Yazma</b><small>Kalan değer için iade yok</small></span></label></fieldset>' + whyField() +
        '<label class="opt" id="tm-ck-w"><input type="checkbox" id="tm-ck"><span><b>Yaklaşan rezervasyonlar iptal olur</b><small>Bunu onaylıyorum</small></span></label>' + EFF;
    } else if (m === 'collect') {
      $('s3-title').textContent = 'Tahsilat al'; $('s3-sub').textContent = s.n + (s.debt ? ' · açık borç ' + TL(s.debt) : ' · açık borç yok'); $('s3-ok').textContent = 'Tahsilatı kaydet';
      b.innerHTML = '<div class="field"><label class="label" for="s3-amt">Tutar (₺)</label><input class="input tnum" id="s3-amt" inputmode="numeric" value="' + (s.debt || '') + '"></div>' +
        '<div class="field"><span class="label">Yöntem</span><div class="seg" role="group" aria-label="Yöntem" id="s3-m"><button type="button" aria-pressed="true">Nakit</button><button type="button" aria-pressed="false">Kart</button><button type="button" aria-pressed="false">Havale</button></div></div>' +
        '<div class="field"><label class="label" for="s3-note">Not<span class="hint">İsteğe bağlı</span></label><input class="input" id="s3-note"></div>';
    } else if (m === 'extend') {
      $('s3-title').textContent = 'Süreyi uzat'; $('s3-sub').textContent = s.n + ' · ' + s.pkg + ', bitiş ' + (s.k === 't' ? s.until : (s.per || '').split(' - ')[1]); $('s3-ok').textContent = 'Süreyi uzat';
      b.innerHTML = '<div class="field"><label class="label" for="s3-days">Uzatma<span class="hint">gün, en çok 90</span></label><input class="input tnum" id="s3-days" inputmode="numeric" value="14" style="max-width:6rem"></div>' + whyField() + EFF;
    } else if (m === 'neg') {
      var n = negOf(s);
      $('s3-title').textContent = 'Negatif limit'; $('s3-sub').textContent = s.n + ' · hakkı bitince ek rezervasyon izni'; $('s3-ok').textContent = 'Limiti kaydet';
      b.innerHTML = '<div class="form-grid two-col"><div class="field"><label class="label" for="s3-lim">Limit<span class="hint">ders, 0 kapalı</span></label><input class="input tnum" id="s3-lim" inputmode="numeric" value="' + n.lim + '"></div>' +
        '<div class="field"><label class="label" for="s3-unit">Ders değeri<span class="hint">₺</span></label><input class="input tnum" id="s3-unit" inputmode="numeric" value="' + n.unit + '"></div></div>' + whyField() + '<span class="hint">Üst sınırı organizasyon politikası belirler.</span>' + EFF;
    } else {
      $('s3-title').textContent = 'Hakkı düzelt'; $('s3-sub').textContent = s.n + ' · ' + s.pkg + ', şu an ' + s.av + ' hak'; $('s3-ok').textContent = 'Düzeltmeyi kaydet';
      b.innerHTML = '<div class="field"><span class="label">İşlem</span><div class="seg" role="group" aria-label="İşlem" id="s3-m"><button type="button" aria-pressed="true">Hak ekle</button><button type="button" aria-pressed="false">Hak çıkar</button></div></div>' +
        '<div class="field"><label class="label" for="s3-n">Ders sayısı</label><input class="input tnum" id="s3-n" inputmode="numeric" value="1" style="max-width:6rem"></div>' + whyField() + EFF;
    }
    $('s3-ok').className = 'btn' + (m === 'terminate' ? ' danger' : '');
    sh3.hidden = false; sc3.hidden = false;
    if (m === 'collect') $('s3-ok').disabled = false; else upd();
    var f = b.querySelector('input:not([type=radio]),textarea'); if (f) f.focus();
  }
  function upd() {
    var s = cur(), b = $('s3-body'), rows = [], block = '', ok = true;
    var chk = function (n) { var e = b.querySelector('input[name="' + n + '"]:checked'); return e ? e.value : ''; };
    var why = function () { return !!$('s3-why').value.trim(); };
    if (mode === 'alloc' || mode === 'renew') {
      var p = PK.filter(function (x) { return x.id === chk('pk'); })[0], pay = chk('pay'), up = s.rez.filter(function (r) { return r.r === 'up'; }).length, geç = '';
      if (mode === 'alloc') {
        var st = new Date($('s3-start').value + 'T00:00:00');
        if (isNaN(st)) { ok = false; geç = 'Başlangıç tarihini seç.'; }
        else { geç = fmt(st) + ' - ' + fmt(addDays(st, p.days)); }
        rows.push(['Hak', p.c ? '+' + p.c + ' ders' : 'Sınırsız', geç]);
        if (!isNaN(st)) { var td = new Date(TODAY_ISO + 'T00:00:00'); if (st < td) rows.push(['Başlangıç', 'Geçmişte', 'Geçerlilik buna göre kısalır.']); else if (st > td) rows.push(['Başlangıç', 'İleride', 'Hak o tarihe kadar kullanılamaz.']); }
      } else {
        var after = $('s3-when').querySelector('[aria-pressed="true"]').getAttribute('data-w') === 'after';
        rows.push(['Hak', p.c ? '+' + p.c + ' ders' : 'Sınırsız', (after ? 'Mevcut hakkın bitiminden başlar, ' : 'Bugünden başlar, ') + p.d + '.']);
      }
      rows.push(['Ödeme', pay === 'debt' ? '+' + TL(p.p) + ' borç' : TL(p.p) + ' tahsilat', pay === 'debt' ? 'Açık borç ' + TL(s.debt) + ' → ' + TL(s.debt + p.p) : 'Tahsilat kaydı oluşur, açık borç değişmez.']);
      rows.push(['Rezervasyon', up + ' kesin', 'Mevcut rezervasyonlar aynen kalır.']);
      var miss = SHARED.pendingDocs ? SHARED.pendingDocs(s.n, 'Satış') : [];
      if (miss.length) { ok = false; rows.push(['Kabul bekleyen belge', String(miss.length), miss.join(', ') + '. Üye kendisi kabul edene kadar satış tamamlanamaz.']); block = 'Satış tamamlanamıyor: ' + miss.length + ' belgenin kabulü bekleniyor. Durumu <a href="#belgeler" style="text-decoration:underline">Belgeler</a> sayfasında izleyebilirsin.'; }
      else rows.push(['Gerekli belgeler', 'Tamam', 'Üye satış için gereken belgeleri kabul etmiş.']);
    } else if (mode === 'freeze') {
      var f1 = $('s3-f1').value, f2 = $('s3-f2').value, fok = !!f1 && !!f2 && f2 >= f1 && f1 >= TODAY_ISO, fdays = fok ? Math.round((pI(f2) - pI(f1)) / 864e5) + 1 : 0, pol = chk('rz');
      if (!f1 || !f2) block = 'Başlangıç ve bitiş tarihini seç.'; else if (f2 < f1) block = 'Bitiş başlangıçtan önce olamaz.'; else if (f1 < TODAY_ISO) block = 'Başlangıç geçmişte olamaz.'; else if (fdays > frzRule(s).max) { fok = false; block = 'Bu paket en fazla ' + frzRule(s).max + ' gün dondurmaya izin veriyor.'; }
      var en0 = pEnd(s.k === 't' ? s.until : (s.per || '').split(' - ')[1]), hit = fok ? rezIn(s, f1, f2) : [];
      rows.push(['Dondurma', fok ? fdays + ' gün' : '-', fok ? fdI(f1) + ' - ' + fdI(f2) + '. Bu sürede rezervasyon yapılamaz.' : '']);
      rows.push(['Bitiş', en0 && fok ? fmt(en0) + ' → ' + fmt(addDays(en0, fdays)) : '-', 'Süre dondurulan gün kadar uzar.']);
      rows.push(['Rezervasyon', hit.length + ' etkilenir', hit.length ? (pol === 'cancel' ? 'İptal edilir, hak iade edilir, üyeye bildirim gider.' : 'Kesin kalır, hak ayrılmış kalır.') : 'Bu aralıkta rezervasyon yok.']);
      if (s.k === 'c') rows.push(['Hak', s.av + ' kullanılabilir', 'Dondurma süresince değişmez.']);
      ok = fok && fdays <= frzRule(s).max && why();
    } else if (mode === 'unfreeze') {
      var plan = fzState(s) === 'plan', usedD = plan ? 0 : Math.round((pI(TODAY_ISO) - pI(s.fz.from)) / 864e5) + 1, back = s.fz.days - usedD, en1 = pEnd(s.k === 't' ? s.until : (s.per || '').split(' - ')[1]);
      rows.push(['Dondurma', plan ? 'İptal' : usedD + ' / ' + s.fz.days + ' gün', plan ? 'Başlamadan kaldırılır.' : 'Bugün biter, hak yeniden kullanılabilir.']);
      rows.push(['Bitiş', en1 ? fmt(en1) + ' → ' + fmt(addDays(en1, -back)) : '-', back ? 'Kullanılmayan ' + back + ' gün geri alınır.' : 'Değişmez.']);
      ok = true;
    } else if (mode === 'change') {
      var np = PK.filter(function (x) { return x.id === chk('pk'); })[0], un = unusedOf(s), fark = np.p - un.v, payc = chk('pay'), upn = upRez(s).length;
      rows.push(['Paket', s.pkg + ' → ' + np.n, 'Eski paket bugün kapanır, geçmiş haklara düşer.']);
      rows.push(['Kalan değer', TL(un.v), un.t + '.']);
      rows.push([fark > 0 ? 'Ödenecek fark' : 'Alacak', TL(Math.abs(fark)), fark > 0 ? (payc === 'debt' ? 'Açık borç ' + TL(s.debt) + ' → ' + TL(s.debt + fark) : 'Tahsilat kaydı oluşur.') : fark < 0 ? 'Alacak olarak yazılır, iade ya da mahsup sonra yapılır.' : 'Fark yok.']);
      rows.push(['Yeni hak', np.c ? np.c + ' ders' : 'Sınırsız', np.d + '.']);
      rows.push(['Rezervasyon', upn + ' kesin', 'Aynen kalır, yeni hakka bağlanır.']);
      $('ch-pay').hidden = fark <= 0;
      var missC = SHARED.pendingDocs ? SHARED.pendingDocs(s.n, 'Satış') : [];
      ok = why();
      if (missC.length) { ok = false; rows.push(['Kabul bekleyen belge', String(missC.length), missC.join(', ') + '.']); block = 'Paket değişimi tamamlanamıyor: ' + missC.length + ' belgenin kabulü bekleniyor. Durumu <a href="#belgeler" style="text-decoration:underline">Belgeler</a> sayfasında izleyebilirsin.'; }
    } else if (mode === 'terminate') {
      var u2 = unusedOf(s), upt = upRez(s).length, tv = chk('tv');
      rows.push(['Hak', s.k === 'c' ? s.av + ' ders kapanır' : 'Süre bugün biter', 'Geri alınamaz. Gerekirse yeni paket tahsis edilir.']);
      rows.push(['Kalan değer', TL(u2.v), tv === 'credit' ? 'Alacak olarak yazılır, iade ya da mahsup sonra yapılır.' : 'Yazılmaz, iade yok.']);
      rows.push(['Rezervasyon', upt + ' iptal olur', upt ? 'Üyeye bildirim gider.' : 'Yaklaşan rezervasyon yok.']);
      if (s.debt) rows.push(['Açık borç', TL(s.debt), 'Silinmez, tahsilat beklemeye devam eder.']);
      $('tm-ck-w').hidden = !upt; ok = why() && (!upt || $('tm-ck').checked);
    } else if (mode === 'extend') {
      var dd = Math.round(+$('s3-days').value), en = pEnd(s.k === 't' ? s.until : (s.per || '').split(' - ')[1]), dok = dd > 0 && dd <= 90;
      rows.push(['Bitiş', en && dok ? fmt(en) + ' → ' + fmt(addDays(en, dd)) : '-', 'Ders sayısı ve diğer koşullar değişmez.']);
      ok = dok && why(); if (!dok) block = 'Uzatma 1 ile 90 gün arasında olmalı.';
    } else if (mode === 'neg') {
      var n = negOf(s), lim = Math.round(+$('s3-lim').value), unit = Math.round(+$('s3-unit').value);
      var lok = lim >= 0 && lim <= 3 && unit > 0 && lim >= n.used;
      rows.push(['Negatif limit', n.lim + ' → ' + (lim >= 0 ? lim : '-') + ' ders', lim > 0 ? 'Hakkı bitince en fazla ' + lim + ' ders daha rezerve edebilir.' : 'Negatif rezervasyon kapalı olur.']);
      rows.push(['Ders değeri', TL(n.unit) + ' → ' + TL(unit > 0 ? unit : 0), 'Kullanılan negatif ders bu değerle izlenir.']);
      ok = lok && why() && (lim !== n.lim || unit !== n.unit);
      if (lim < 0 || lim > 3) block = 'Limit 0 ile 3 ders arasında olmalı (örnek üst sınır).'; else if (lim < n.used) block = 'Kullanılan negatif ders (' + n.used + ') limitin üstünde.';
    } else if (mode === 'adjust') {
      var c = Math.round(+$('s3-n').value), add = $('s3-m').querySelector('[aria-pressed="true"]').textContent === 'Hak ekle', aft = s.av + (add ? c : -c);
      rows.push(['Kullanılabilir hak', s.av + ' → ' + (c > 0 ? aft : '-'), 'Toplam hak ' + s.tot + ' → ' + (c > 0 ? s.tot + (add ? c : -c) : '-')]);
      ok = c > 0 && why() && aft >= 0; if (c > 0 && aft < 0) block = 'Çıkarılacak hak kullanılabilir haktan fazla olamaz.';
    }
    $('s3-eff').innerHTML = effList(rows);
    var er = $('s3-err'); er.hidden = !block; er.innerHTML = block;
    $('s3-ok').disabled = !ok;
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-act]'); if (!a) return; var t = a.getAttribute('data-act');
    if (t === 'alloc' || t === 'collect' || t === 'adjust' || t === 'renew' || t === 'extend' || t === 'neg' || t === 'freeze' || t === 'unfreeze' || t === 'change' || t === 'terminate') openS3(t);
    if (t === 'rcancel') toast('Rezervasyon iptal edildi, hak iade edilir');
    var rfb = e.target.closest('[data-rf]'); if (rfb) { rf = rfb.getAttribute('data-rf'); profile(); document.querySelector('[data-ptab="rez"]').click(); }
  });
  document.addEventListener('click', function (e) {
    var rfb = e.target.closest('[data-rf]'); if (rfb) { rf = rfb.getAttribute('data-rf'); profile(); document.querySelector('[data-ptab="rez"]').click(); }
    var mb = e.target.closest('#s3-m button, #s3-when button'); if (mb) { mb.parentNode.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === mb)); }); if (mode !== 'collect') upd(); }
  });
  $('s3-body').addEventListener('input', function () { if (mode !== 'collect') upd(); });
  $('s3-body').addEventListener('change', function () { if (mode !== 'collect') upd(); });
  $('s3-x').addEventListener('click', closeS3); $('s3-cancel').addEventListener('click', closeS3); sc3.addEventListener('click', closeS3);
  $('s3-ok').addEventListener('click', function () {
    var s = cur(); if ($('s3-ok').disabled) return;
    if (mode === 'collect') {
      var v = Math.round(+$('s3-amt').value); if (!(v > 0)) { toast('Geçerli bir tutar gir'); return; }
      var m = $('s3-m').querySelector('[aria-pressed="true"]').textContent;
      s.pay.unshift({ d: '4 Kas', t: 'Tahsilat', m: m, a: -v }); s.debt = Math.max(0, s.debt - v); closeS3(); panelRerender(); toast('Tahsilat kaydedildi');
    } else if (mode === 'alloc' || mode === 'renew') {
      var b = $('s3-body'), p = PK.filter(function (x) { return x.id === b.querySelector('input[name="pk"]:checked').value; })[0], pay = b.querySelector('input[name="pay"]:checked').value, led = ledgerOf(s);
      var st = mode === 'alloc' ? new Date($('s3-start').value + 'T00:00:00') : new Date(TODAY_ISO + 'T00:00:00'), en = addDays(st, p.days);
      if (p.c) {
        if (s.k === 'c') { var was = s.av; s.tot += p.c; s.av += p.c; if (was <= 0) { s.pkg = p.n; s.per = short(st) + ' - ' + short(en); } }
        else { s.past.unshift({ n: s.pkg, per: s.per, note: 'Süresi doldu' }); s.k = 'c'; s.pkg = p.n; s.tot = p.c; s.av = p.c; s.rs = 0; s.cn = 0; s.per = short(st) + ' - ' + short(en); delete s.until; s.ended = false; }
        led.unshift({ d: '4 Kas', t: (mode === 'renew' ? 'Yenileme: ' : 'Paket tahsisi: ') + p.n, n: '+' + p.c });
      } else {
        var base = s.k === 't' && !s.ended && mode === 'renew' ? pEnd(s.until) || st : st;
        s.k = 't'; s.pkg = p.n; s.ended = false; s.until = short(addDays(base, p.days)); s.per = short(st) + ' - ' + short(addDays(base, p.days));
      }
      s.pay.unshift({ d: '4 Kas', t: mode === 'renew' ? 'Yenileme' : 'Satış', m: p.n, a: p.p });
      if (pay === 'now') s.pay.unshift({ d: '4 Kas', t: 'Tahsilat', m: 'Nakit', a: -p.p }); else s.debt += p.p;
      closeS3(); panelRerender(); toast(mode === 'renew' ? 'Paket yenilendi' : 'Hak tahsis edildi');
    } else if (mode === 'freeze') {
      var g1 = $('s3-f1').value, g2 = $('s3-f2').value, gd = Math.round((pI(g2) - pI(g1)) / 864e5) + 1, gp = $('s3-body').querySelector('input[name="rz"]:checked').value, gw = $('s3-why').value.trim();
      var ge = pEnd(s.k === 't' ? s.until : s.per.split(' - ')[1]), gn = gp === 'cancel' ? rezIn(s, g1, g2) : [];
      s.fz = { from: g1, to: g2, days: gd, why: gw };
      if (ge) { var gx = addDays(ge, gd); if (s.k === 't') s.until = short(gx); s.per = s.per.split(' - ')[0] + ' - ' + short(gx); }
      gn.forEach(function (r) { r.r = 'cancelled'; r.y = ''; if (s.k === 'c') { s.rs = Math.max(0, s.rs - 1); s.av += 1; } });
      if (gn.length && s.next && gn.some(function (r) { return r.d.indexOf(s.next.split(' ')[1]) > -1; })) s.next = '';
      if (s.k === 'c') ledgerOf(s).unshift({ d: '4 Kas', t: 'Dondurma: ' + gw, n: '+' + gd + ' gün' });
      closeS3(); panelRerender(); toast(g1 > TODAY_ISO ? 'Dondurma planlandı' : 'Hak donduruldu');
    } else if (mode === 'unfreeze') {
      var pl2 = fzState(s) === 'plan', us = pl2 ? 0 : Math.round((pI(TODAY_ISO) - pI(s.fz.from)) / 864e5) + 1, bk = s.fz.days - us, ge2 = pEnd(s.k === 't' ? s.until : s.per.split(' - ')[1]);
      if (ge2 && bk) { var gx2 = addDays(ge2, -bk); if (s.k === 't') s.until = short(gx2); s.per = s.per.split(' - ')[0] + ' - ' + short(gx2); }
      if (s.k === 'c') ledgerOf(s).unshift({ d: '4 Kas', t: pl2 ? 'Dondurma iptal edildi' : 'Dondurma bitti (' + us + ' gün)', n: bk ? '-' + bk + ' gün' : '0 gün' });
      s.fz = null; closeS3(); panelRerender(); toast(pl2 ? 'Dondurma iptal edildi' : 'Dondurma bitti');
    } else if (mode === 'change') {
      var cb = $('s3-body'), cn = PK.filter(function (x) { return x.id === cb.querySelector('input[name="pk"]:checked').value; })[0], cu = unusedOf(s), cf = cn.p - cu.v, cpay = cb.querySelector('input[name="pay"]:checked').value, cw = $('s3-why').value.trim(), old = s.pkg;
      var cs = new Date(TODAY_ISO + 'T00:00:00'), ce = addDays(cs, cn.days);
      s.past.unshift({ n: old, per: s.per, note: 'Paket değiştirildi' });
      if (cn.c) { s.k = 'c'; s.pkg = cn.n; s.tot = cn.c; s.rs = Math.min(s.rs || 0, cn.c); s.av = cn.c - s.rs; s.cn = 0; s.per = short(cs) + ' - ' + short(ce); delete s.until; s.led = [{ d: '4 Kas', t: 'Paket değişimi: ' + old + ' → ' + cn.n + ' (' + cw + ')', n: '+' + cn.c }]; delete s.neg; }
      else { s.k = 't'; s.pkg = cn.n; s.until = short(ce); s.per = short(cs) + ' - ' + short(ce); delete s.tot; delete s.av; delete s.led; }
      s.ended = false; s.term = false; s.price = cn.p;
      if (cf > 0) { s.pay.unshift({ d: '4 Kas', t: 'Paket değişimi', m: cn.n, a: cf }); if (cpay === 'now') s.pay.unshift({ d: '4 Kas', t: 'Tahsilat', m: 'Nakit', a: -cf }); else s.debt += cf; }
      else if (cf < 0) s.cr = (s.cr || 0) - cf;
      closeS3(); panelRerender(); toast('Paket değiştirildi');
    } else if (mode === 'terminate') {
      var tb = $('s3-body'), tcr = tb.querySelector('input[name="tv"]:checked').value, tw = $('s3-why').value.trim(), tu = unusedOf(s);
      s.past.unshift({ n: s.pkg, per: s.per, note: 'Sonlandırıldı' });
      if (s.k === 'c') { ledgerOf(s).unshift({ d: '4 Kas', t: 'Sonlandırma: ' + tw, n: '-' + s.av }); s.av = 0; s.rs = 0; } else s.ended = true;
      s.term = true; s.fz = null;
      upRez(s).forEach(function (r) { r.r = 'cancelled'; r.y = ''; }); s.next = '';
      if (tcr === 'credit' && tu.v) s.cr = (s.cr || 0) + tu.v;
      closeS3(); panelRerender(); toast('Hak sonlandırıldı');
    } else if (mode === 'extend') {
      var dd = Math.round(+$('s3-days').value), en2 = pEnd(s.k === 't' ? s.until : s.per.split(' - ')[1]);
      if (en2) { var ne = addDays(en2, dd); if (s.k === 't') s.until = short(ne); s.per = s.per.split(' - ')[0] + ' - ' + short(ne); }
      if (s.k === 'c') ledgerOf(s).unshift({ d: '4 Kas', t: 'Süre uzatma: ' + $('s3-why').value.trim(), n: '+' + dd + ' gün' });
      closeS3(); panelRerender(); toast('Süre uzatıldı');
    } else if (mode === 'neg') {
      var ng = negOf(s); ng.lim = Math.round(+$('s3-lim').value); ng.unit = Math.round(+$('s3-unit').value); closeS3(); panelRerender(); toast('Negatif limit kaydedildi');
    } else {
      var c = Math.round(+$('s3-n').value), add = $('s3-m').querySelector('[aria-pressed="true"]').textContent === 'Hak ekle', sg = add ? 1 : -1;
      s.av += sg * c; s.tot += sg * c; ledgerOf(s).unshift({ d: '4 Kas', t: 'Hak düzeltme: ' + $('s3-why').value.trim(), n: (add ? '+' : '-') + c });
      closeS3(); panelRerender(); toast('Hak düzeltmesi kaydedildi');
    }
  });

  /* ---------- Pasifleştirme diyaloğu: gerekçe zorunlu ---------- */
  var dlg = $('dlg'), dsc = $('dlg-scrim');
  function closeDlg() { dlg.hidden = true; dsc.hidden = true; }
  document.addEventListener('click', function (e) {
    if (e.target.closest('#pf-off')) { $('dlg-sub').textContent = cur().n + ' artık yeni rezervasyon yapamaz.'; $('dlg-neden').value = ''; $('dlg-ok').disabled = true; dlg.hidden = false; dsc.hidden = false; $('dlg-neden').focus(); }
    if (e.target.closest('#pf-on')) { cur().on = true; panelRerender(); toast('Üye etkinleştirildi'); }
  });
  $('dlg-neden').addEventListener('input', function () { $('dlg-ok').disabled = !$('dlg-neden').value.trim(); });
  $('dlg-cancel').addEventListener('click', closeDlg); dsc.addEventListener('click', closeDlg);
  $('dlg-ok').addEventListener('click', function () { cur().on = false; closeDlg(); panelRerender(); toast('Üye pasifleştirildi'); });
  document.addEventListener('keydown', function (e) { if (e.key !== 'Escape') return; if (!dlg.hidden) closeDlg(); else if (!sh3.hidden) closeS3(); else if (!sh2.hidden) closeS2(); });

  /* ---------- Ders programı: sürükle-bırak (kurgusal veri) ---------- */
  (function () {
    var H0 = 8, H1 = 22, PX = 56 / 60, SNAP = 15;
    var TODAY = new Date(2026, 10, 4), NOW = 14 * 60 + 20;
    var DN = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'], MN = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    var ROOMS = { 'Salon A': 16, 'Salon B': 12, 'Stüdyo C': 2 };
    var S = [
      { id: 'a', d: 0, s: 14 * 60 + 30, l: 60, t: 'Arjantin tango teknik', r: 'Salon A', h: 7, c: 12 },
      { id: 'b', d: 0, s: 18 * 60 + 30, l: 60, t: 'Bachata başlangıç', r: 'Salon B', h: 9, c: 12 },
      { id: 'c', d: 1, s: 10 * 60, l: 60, t: 'Pilates mat', r: 'Salon B', h: 6, c: 10 },
      { id: 'd', d: 1, s: 19 * 60, l: 60, t: 'Salsa orta', r: 'Salon A', h: 10, c: 12, grp: ['Merve Tan', 'Nehir Gür'] },
      { id: 'e', d: 2, s: 12 * 60 + 30, l: 45, t: 'Özel ders · Selin Aksoy', r: 'Stüdyo C', h: 1, c: 1, p: 1 },
      { id: 'f', d: 2, s: 14 * 60 + 30, l: 60, t: 'Arjantin tango teknik', r: 'Salon A', h: 8, c: 12 },
      { id: 'g', d: 2, s: 18 * 60 + 30, l: 60, t: 'Bachata başlangıç', r: 'Salon B', h: 9, c: 12 },
      { id: 'h', d: 2, s: 19 * 60, l: 90, t: 'Salsa başlangıç', r: 'Salon A', h: 5, c: 14 },
      { id: 'i', d: 3, s: 10 * 60, l: 60, t: 'Pilates mat', r: 'Salon B', h: 4, c: 10 },
      { id: 'j', d: 3, s: 18 * 60, l: 60, t: 'Salsa başlangıç', r: 'Salon A', h: 8, c: 14, grp: ['Selin Aksoy', 'Burak Kaya'] },
      { id: 'k', d: 4, s: 18 * 60, l: 60, t: 'Salsa orta', r: 'Salon A', h: 0, c: 12, x: 1 },
      { id: 'l', d: 4, s: 19 * 60, l: 60, t: 'Bachata orta', r: 'Salon B', h: 12, c: 12, grp: ['Derya Sönmez'] },
      { id: 'm', d: 5, s: 11 * 60, l: 120, t: 'Hafta sonu atölyesi', r: 'Salon A', h: 14, c: 16 },
      { id: 'n', d: 5, s: 15 * 60, l: 45, t: 'Özel ders · Burak Kaya', r: 'Stüdyo C', h: 1, c: 1, p: 1 }
    ];
    SHARED.cal = S;
    SHARED.calAll = function () { var wk = mon(TODAY); return S.filter(function (x) { return live(x, wk); }).map(function (x) { return { s: ovrS(x, wk), x: isX(x, wk) }; }); };
    function isoD(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
    var coachF = '', view = 'week', anchor = new Date(TODAY), room = '', pending = {}, saved = {}, ovr = {};
    var $c = document.getElementById('cal'), $sc = document.getElementById('cal-scroll'), first = true;
    function mon(d) { var x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); x.setHours(0, 0, 0, 0); return x; }
    function addD(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
    function hm(m) { return ('0' + Math.floor(m / 60)).slice(-2) + ':' + ('0' + (m % 60)).slice(-2); }
    function same(a, b) { return a.toDateString() === b.toDateString(); }
    function key(s, wk) { return s.id + '@' + wk.getTime(); }
    function eff(s, wk) { var k = key(s, wk); return pending[k] || saved[k] || { d: s.d, s: s.s, l: s.l }; }
    function isPast(day, e) { return day < TODAY && !same(day, TODAY) || (same(day, TODAY) && e.s + e.l <= NOW); }
    function ovrS(s, wk) { var o = ovr[key(s, wk)]; return o ? Object.assign({}, s, o) : s; }
    function live(s, wk) { var t = wk.getTime(); return (!s.from || t >= s.from) && (!s.until || t <= s.until) && (!s.once || t === s.once); }
    function isX(s, wk) { return !!(s.x || (s.xs && s.xs[wk.getTime()])); }
    function items(wk) {
      return S.filter(function (s) { return live(s, wk); }).map(function (s) { var e = eff(s, wk), day = addD(wk, e.d); return { s: ovrS(s, wk), x: isX(s, wk), e: e, day: day, k: key(s, wk), past: isPast(addD(wk, s.d), { s: s.s, l: s.l }), draft: !!pending[key(s, wk)] }; })
        .filter(function (o) { return !room || o.s.r === room; })
        .filter(function (o) { return !coachF || SHARED.coachOf(o.s) === coachF; });
    }
    function conflicts(wk) {
      var all = S.filter(function (s) { return live(s, wk); }).map(function (s) { var e = eff(s, wk); return { k: key(s, wk), d: e.d, a: e.s, b: e.s + e.l, r: ovrS(s, wk).r, x: isX(s, wk), t: s.t }; }).filter(function (o) { return !o.x; }), bad = {}, msgs = [];
      for (var i = 0; i < all.length; i++) for (var j = i + 1; j < all.length; j++) {
        var p = all[i], q = all[j];
        if (p.d === q.d && p.r === q.r && p.a < q.b && q.a < p.b) { bad[p.k] = bad[q.k] = 1; msgs.push(p.r + ', ' + DN[p.d] + ' ' + hm(Math.max(p.a, q.a)) + ': ' + p.t + ' ile ' + q.t + ' çakışıyor'); }
      }
      return { bad: bad, msgs: msgs };
    }
    function lanes(list) {
      list.sort(function (a, b) { return a.e.s - b.e.s; });
      var cols = [], out = [];
      list.forEach(function (o) {
        var c = 0; while (cols[c] && cols[c] > o.e.s) c++; cols[c] = o.e.s + o.e.l; o.lane = c;
      });
      list.forEach(function (o) {
        var n = 1; list.forEach(function (p) { if (p !== o && p.e.s < o.e.s + o.e.l && o.e.s < p.e.s + p.e.l) n = Math.max(n, p.lane + 1, o.lane + 1); });
        o.n = n;
      });
      return list;
    }
    function evHtml(o, bad) {
      var s = o.s, top = (o.e.s - H0 * 60) * PX, h = o.e.l * PX - 2, w = 100 / o.n;
      var cls = 'ev' + (o.past ? ' past' : '') + (o.x ? ' cx' : '') + (s.p ? ' priv' : '') + (!s.once ? ' ser' : '') + (o.draft ? ' draft' : '') + (bad[o.k] ? ' bad' : '');
      var full = s.h >= s.c, short = o.e.l < 45;
      var cs = SHARED.coachOf ? SHARED.coachOf(s) : '', na = cs && SHARED.sdIssue && !o.x && !o.past ? SHARED.sdIssue(SHARED.coachFull(cs), isoD(o.day), o.e.s, o.e.l, s.r) : '';
      if (na) cls += ' na';
      return '<div class="' + cls + '" tabindex="0" role="button" data-k="' + o.k + '" data-id="' + s.id + '" style="top:' + top + 'px;height:' + h + 'px;left:calc(' + (o.lane * w) + '% + 2px);width:calc(' + w + '% - 4px)" aria-label="' + s.t + ', ' + DN[o.e.d] + ' ' + hm(o.e.s) + ' - ' + hm(o.e.s + o.e.l) + ', ' + s.r + (o.draft ? ', taslak' : '') + '">' +
        '<span class="tm">' + hm(o.e.s) + ' - ' + hm(o.e.s + o.e.l) + (o.x ? ' · İptal' : '') + '</span><span class="tt">' + s.t + '</span>' +
        (short ? '' : '<span class="mt">' + s.r + (o.x ? '' : ' · <span class="bar"><i style="width:' + Math.round(s.h / s.c * 100) + '%"></i></span>' + s.h + '/' + s.c) + (full && !o.x ? ' <span class="badge" style="padding:0 6px">Dolu</span>' : '') + '</span>') +
        '<span class="co" title="' + (cs ? cs + (na ? ': ' + na : '') : '') + '">' + (cs && cs !== '-' ? cs.split(' ').map(function (w) { return w[0]; }).join('') : '') + '</span><span class="rz" data-rz="1"></span></div>';
    }
    function naHtml(d, day) {
      var nm = SHARED.coachFull ? SHARED.coachFull(coachF) : '', iso = isoD(day), lv = SHARED.sdLeave ? SHARED.sdLeave(nm, iso) : '', w = SHARED.sdWin ? SHARED.sdWin(nm, d) : undefined, H = (H1 - H0) * 56;
      if (lv) return '<div class="cal-na" style="top:0;height:' + H + 'px"><span>İzinli: ' + lv + '</span></div>';
      if (w === undefined) return '';
      if (w === null) return '<div class="cal-na" style="top:0;height:' + H + 'px"><span>Uygun değil</span></div>';
      var a = Math.max(0, (w[0] - H0 * 60) * PX), b = Math.min(H, (w[1] - H0 * 60) * PX);
      return (a > 0 ? '<div class="cal-na" style="top:0;height:' + a + 'px"></div>' : '') + (b < H ? '<div class="cal-na" style="top:' + b + 'px;height:' + (H - b) + 'px"></div>' : '');
    }
    function csHtml(list, wk) {
      var el = document.getElementById('cal-cs'); if (!coachF) { el.hidden = true; return; }
      var nm = SHARED.coachFull(coachF), live2 = list.filter(function (o) { return !o.x; }), mins = live2.reduce(function (a, o) { return a + o.e.l; }, 0);
      var bad = live2.filter(function (o) { return SHARED.sdIssue && !o.past && SHARED.sdIssue(nm, isoD(o.day), o.e.s, o.e.l, o.s.r); }).length;
      el.hidden = false; el.innerHTML = '<span><b>' + nm + '</b></span><span class="tnum">Bu hafta <b>' + live2.length + '</b> seans, <b>' + Math.floor(mins / 60) + ' sa' + (mins % 60 ? ' ' + (mins % 60) + ' dk' : '') + '</b></span>' + (bad ? '<span class="bad tnum">' + bad + ' seans uygunluk, izin ya da kapanış dışında</span>' : '<span>Uygunluk ve izinlerle çakışma yok</span>');
    }
    SHARED.calCoaches = function () {
      var sel = document.getElementById('cal-coach'), keep = sel.value;
      sel.innerHTML = '<option value="">Tüm eğitmenler</option>' + SHARED.sd.IN.filter(function (e) { return e.on; }).map(function (e) { var p = e.n.split(' '), sh = p[0] + ' ' + p[1][0] + '.'; return '<option value="' + sh + '"' + (sh === keep ? ' selected' : '') + '>' + sh + '</option>'; }).join('');
    };
    function render() {
      var wk = mon(anchor), days = view === 'week' ? [0, 1, 2, 3, 4, 5, 6] : [(anchor.getDay() + 6) % 7], hrs = H1 - H0;
      var list = items(wk), cf = conflicts(wk), html = '';
      $c.style.setProperty('--n', days.length); $c.style.setProperty('--hrs', hrs);
      html += '<div class="cal-h"></div>' + days.map(function (d) { var dd = addD(wk, d); return '<div class="cal-h' + (same(dd, TODAY) ? ' is-today' : '') + '">' + DN[d] + '<br><b>' + dd.getDate() + '</b></div>'; }).join('');
      var ax = ''; for (var h = H0 + 1; h < H1; h++) ax += '<span style="top:' + ((h - H0) * 56) + 'px">' + ('0' + h).slice(-2) + ':00</span>';
      html += '<div class="cal-axis" aria-hidden="true">' + ax + '</div>';
      days.forEach(function (d) {
        var dd = addD(wk, d), mine = lanes(list.filter(function (o) { return o.e.d === d; }));
        html += '<div class="cal-col' + (d > 4 ? ' off' : '') + '" data-d="' + d + '">' + (coachF ? naHtml(d, dd) : '') + mine.map(function (o) { return evHtml(o, cf.bad); }).join('') + (same(dd, TODAY) ? '<div class="cal-now" style="top:' + ((NOW - H0 * 60) * PX) + 'px"></div>' : '') + '</div>';
      });
      $c.innerHTML = html; csHtml(list, wk);
      var a = addD(wk, 6), e = addD(wk, 0), dl = anchor;
      document.getElementById('cal-range').textContent = view === 'week' ? (e.getMonth() === a.getMonth() ? e.getDate() + ' - ' + a.getDate() + ' ' + MN[a.getMonth()] : e.getDate() + ' ' + MN[e.getMonth()] + ' - ' + a.getDate() + ' ' + MN[a.getMonth()]) + ' ' + a.getFullYear() : dl.getDate() + ' ' + MN[dl.getMonth()] + ' ' + dl.getFullYear() + ', ' + DN[(dl.getDay() + 6) % 7];
      /* kaydet çubuğu */
      var n = Object.keys(pending).length, sb = document.getElementById('savebar'), bad = cf.msgs.length;
      sb.hidden = !n; sb.classList.toggle('err', !!bad);
      var aff = 0; Object.keys(pending).forEach(function (k) { var s = S.filter(function (x) { return x.id === k.split('@')[0]; })[0]; aff += s.h; });
      document.getElementById('sb-msg').textContent = bad ? cf.msgs[0] : n + ' seans değişti, ' + aff + ' üye etkilenecek';
      document.getElementById('sb-save').disabled = !!bad;
      if (first) { $sc.scrollTop = (9 - H0) * 56 - 8; first = false; }
    }
    /* sürükle / yeniden boyutlandır */
    var drag = null;
    function colAt(x) {
      var cols = [].slice.call($c.querySelectorAll('.cal-col')), best = cols[0];
      cols.forEach(function (c) { var r = c.getBoundingClientRect(); if (x >= r.left) best = c; }); return best;
    }
    function snap(m) { return Math.round(m / SNAP) * SNAP; }
    $c.addEventListener('pointerdown', function (e) {
      var el = e.target.closest('.ev'); if (!el || e.button) return;
      if (el.classList.contains('past') || el.classList.contains('cx')) { return; }
      var wk = mon(anchor), id = el.getAttribute('data-id'), s = S.filter(function (x) { return x.id === id; })[0], ef = eff(s, wk), r = el.getBoundingClientRect();
      drag = { el: el, s: s, wk: wk, ef: ef, x0: e.clientX, y0: e.clientY, ox: e.clientX - r.left, oy: e.clientY - r.top, on: false, rz: !!e.target.closest('.rz'), target: null, lastY: e.clientY };
      e.preventDefault();
    });
    $c.addEventListener('click', function (e) {
      var el = e.target.closest('.ev.past, .ev.cx'); if (el) SHARED.openOcc(el);
    });
    window.addEventListener('pointermove', function (e) {
      if (!drag) return;
      if (!drag.on) { if (Math.abs(e.clientX - drag.x0) + Math.abs(e.clientY - drag.y0) < 5) return; drag.on = true; document.body.style.cursor = drag.rz ? 'ns-resize' : 'grabbing'; if (!drag.rz) { var g = drag.el.cloneNode(true); g.className += ' ev-ghost'; g.style.cssText = 'width:' + drag.el.offsetWidth + 'px;height:' + drag.el.offsetHeight + 'px'; document.body.appendChild(g); drag.g = g; drag.el.classList.add('lift'); } }
      drag.lastY = e.clientY; drag.lx = e.clientX; place();
    });
    function place() {
      var e = { clientX: drag.lx, clientY: drag.lastY };
      if (drag.rz) {
        var col = drag.el.parentNode, top = col.getBoundingClientRect().top;
        var end = snap((e.clientY - top) / PX + H0 * 60), l = Math.max(30, Math.min(end - drag.ef.s, H1 * 60 - drag.ef.s));
        drag.target = { d: drag.ef.d, s: drag.ef.s, l: l }; drag.el.style.height = (l * PX - 2) + 'px'; drag.el.firstChild.textContent = hm(drag.ef.s) + ' - ' + hm(drag.ef.s + l); return;
      }
      drag.g.style.left = (e.clientX - drag.ox) + 'px'; drag.g.style.top = (e.clientY - drag.oy) + 'px';
      var c = view === 'week' ? colAt(e.clientX) : $c.querySelector('.cal-col'), r = c.getBoundingClientRect(), d = +c.getAttribute('data-d');
      var s0 = Math.max(H0 * 60, Math.min(snap((e.clientY - drag.oy - r.top) / PX + H0 * 60), H1 * 60 - drag.ef.l));
      var ok = !isPast(addD(drag.wk, d), { s: s0, l: drag.ef.l }) && !isPast(addD(drag.wk, d), { s: s0, l: 0 }) && !(same(addD(drag.wk, d), TODAY) && s0 < NOW);
      drag.target = { d: d, s: s0, l: drag.ef.l, ok: ok };
      var dp = $c.querySelector('.drop'); if (!dp) { dp = document.createElement('div'); dp.className = 'drop'; dp.innerHTML = '<span></span>'; }
      c.appendChild(dp); dp.style.top = ((s0 - H0 * 60) * PX) + 'px'; dp.style.height = (drag.ef.l * PX - 2) + 'px'; dp.classList.toggle('no', !ok);
      dp.firstChild.textContent = ok ? DN[d] + ' ' + hm(s0) + ' - ' + hm(s0 + drag.ef.l) : 'Geçmişe taşınamaz';
    }
    var tick = setInterval(function () {
      if (!drag || !drag.on) return; var r = $sc.getBoundingClientRect();
      if (drag.lastY < r.top + 48) { $sc.scrollTop -= 14; place(); } else if (drag.lastY > r.bottom - 32) { $sc.scrollTop += 14; place(); }
    }, 30);
    function commit(t) {
      var k = key(drag.s, drag.wk), o = { d: drag.s.d, s: drag.s.s, l: drag.s.l }, b = saved[k] || o;
      if (t.d === b.d && t.s === b.s && t.l === b.l) delete pending[k]; else pending[k] = { d: t.d, s: t.s, l: t.l };
    }
    window.addEventListener('pointerup', function () {
      if (!drag) return; var d = drag; drag = null; document.body.style.cursor = '';
      if (d.g) d.g.remove();
      if (!d.on) { SHARED.openOcc(d.el); return; }
      var t = d.target; drag = d; if (t && (d.rz || t.ok)) commit(t); drag = null;
      if (t && !d.rz && !t.ok) toast('Geçmiş bir zamana taşınamaz');
      render();
    });
    window.addEventListener('keydown', function (e) { if (e.key === 'Escape' && drag) { if (drag.g) drag.g.remove(); drag = null; document.body.style.cursor = ''; render(); } });
    /* klavye ile taşıma */
    $c.addEventListener('keydown', function (e) {
      var el = e.target.closest('.ev'); if (!el) return;
      if (e.key === 'Enter' && !e.shiftKey) { SHARED.openOcc(el); return; }
      if (!e.shiftKey || el.classList.contains('past') || el.classList.contains('cx') || e.key.indexOf('Arrow') !== 0) return;
      e.preventDefault();
      var wk = mon(anchor), s = S.filter(function (x) { return x.id === el.getAttribute('data-id'); })[0], ef = eff(s, wk), t = { d: ef.d, s: ef.s, l: ef.l };
      if (e.key === 'ArrowUp') t.s -= SNAP; if (e.key === 'ArrowDown') t.s += SNAP; if (view === 'week') { if (e.key === 'ArrowLeft') t.d--; if (e.key === 'ArrowRight') t.d++; }
      if (t.d < 0 || t.d > 6 || t.s < H0 * 60 || t.s + t.l > H1 * 60 || isPast(addD(wk, t.d), { s: t.s, l: t.l })) { toast('Buraya taşınamaz'); return; }
      drag = { s: s, wk: wk }; commit(t); drag = null; render();
      var n = $c.querySelector('[data-k="' + key(s, wk) + '"]'); if (n) n.focus();
    });
    /* araç çubuğu */
    function shift(n) { anchor = addD(anchor, view === 'week' ? 7 * n : n); render(); }
    document.getElementById('cal-prev').addEventListener('click', function () { shift(-1); });
    document.getElementById('cal-next').addEventListener('click', function () { shift(1); });
    document.getElementById('cal-today').addEventListener('click', function () { anchor = new Date(TODAY); render(); });
    document.getElementById('cal-room').addEventListener('change', function (e) { room = e.target.value; render(); });
    document.getElementById('cal-coach').addEventListener('change', function (e) { coachF = e.target.value; render(); });
    document.getElementById('cal-view').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-v]'); if (!b) return; view = b.getAttribute('data-v');
      this.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); render();
    });
    /* ---------- Seans ekle (tek seans, haftalık seri) ve seans iptali + telafi ---------- */
    (function () {
      const g = (id) => document.getElementById(id);
      const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
      const TY = [
        { n: 'Salsa başlangıç', r: 'Salon A', c: 'Elif K.', l: 90, cap: 14 }, { n: 'Salsa orta', r: 'Salon A', c: 'Kaan S.', l: 60, cap: 12 },
        { n: 'Bachata başlangıç', r: 'Salon B', c: 'Mert A.', l: 60, cap: 12 }, { n: 'Bachata orta', r: 'Salon B', c: 'Kaan S.', l: 60, cap: 12 },
        { n: 'Arjantin tango teknik', r: 'Salon A', c: 'Elif K.', l: 60, cap: 12 }, { n: 'Pilates mat', r: 'Salon B', c: 'Ceren B.', l: 60, cap: 10 },
        { n: 'Özel ders', r: 'Stüdyo C', c: 'Deniz Y.', l: 45, cap: 1 }
      ];
      const DAY = 864e5;
      const dOf = (v) => new Date(v + 'T00:00:00');
      const idx = (d) => (d.getDay() + 6) % 7;
      const lab = (d) => DN[idx(d)] + ' ' + d.getDate() + ' ' + MN[d.getMonth()].slice(0, 3);
      const mins = (v) => { const p = (v || '').split(':'); return p.length === 2 ? +p[0] * 60 + +p[1] : NaN; };
      let seq = 0, mode = 'series', opener = null;
      function live2(s, wk) { return live(s, wk) && !isX(s, wk); }
      /* Bir gün, saat ve salon için çakışma ve kural denetimi; hata metni döner */
      function check(date, st, len, room, coach, type) {
        if (isNaN(st) || isNaN(date)) return 'Tarih ve saati gir.';
        if (st < H0 * 60 || st + len > H1 * 60) return 'Seans 08:00 - 22:00 arasında olmalı.';
        if (date < TODAY || (same(date, TODAY) && st <= NOW)) return lab(date) + ' geçmişte kaldı.';
        if (type === 'Özel ders' && (st < 600 || st + len > 1080)) return coach + ' bu saatte uygun değil (uygunluk 10:00 - 18:00).';
        const wk = mon(date), d = idx(date);
        const rOf = (o) => (ovr[key(o, wk)] || {}).r || o.r;
        const hit = S.filter((o) => { if (!live2(o, wk)) return false; const e = eff(o, wk); return e.d === d && rOf(o) === room && e.s < st + len && st < e.s + e.l; })[0];
        if (hit) return room + ', ' + lab(date) + ' ' + hm(eff(hit, wk).s) + ': ' + hit.t + ' ile çakışıyor.';
        return '';
      }
      function ty() { return TY.filter((t) => t.n === g('sa-type').value)[0]; }
      function gen() {
        const t = ty(), st = mins(g('sa-time').value), len = +g('sa-len').value, room = g('sa-room').value, start = dOf(g('sa-date').value), out = [];
        if (isNaN(start)) return { list: [], err: 'İlk seans tarihini seç.' };
        if (mode === 'one') out.push({ date: start, d: idx(start) });
        else {
          const n = +g('sa-weeks').value, days = Array.prototype.slice.call(g('sa-days').querySelectorAll('[aria-pressed="true"]')).map((b) => +b.getAttribute('data-d'));
          if (!days.length) return { list: [], err: 'En az bir gün seç.' };
          days.forEach((d) => { const first = addD(start, (d - idx(start) + 7) % 7); for (let k = 0; k < n; k++) out.push({ date: addD(first, 7 * k), d: d }); });
          out.sort((a, b) => a.date - b.date);
        }
        let err = '';
        out.forEach((o) => { o.err = check(o.date, st, len, room, t.c, t.n); if (o.err && !err) err = o.err; });
        const cap = +g('sa-cap').value, max = ROOMS[room];
        if (!err && (!cap || cap < 1)) err = 'Kontenjan en az 1 olmalı.';
        if (!err && cap > max) err = room + ' oda sınırı ' + max + '. Kontenjan bunu aşamaz.';
        return { list: out, err: err, st: st, len: len, room: room, cap: cap, t: t };
      }
      function paint() {
        const t = ty(), r = gen(), st = r.st, len = +g('sa-len').value;
        g('sa-coach').innerHTML = '<option>' + t.c + '</option>';
        g('sa-cap-h').textContent = 'Oda sınırı ' + ROOMS[g('sa-room').value];
        g('sa-weeks-w').hidden = mode === 'one'; g('sa-days-w').hidden = mode === 'one';
        g('sa-date-l').textContent = mode === 'one' ? 'Tarih' : 'İlk seans';
        g('sa-mode-h').textContent = mode === 'one' ? 'Programda yalnız bir kez görünür.' : 'Her hafta aynı gün ve saatte açılan sabit grup.';
        g('sa-title').textContent = mode === 'one' ? 'Tek seans ekle' : 'Seri oluştur';
        const n = r.list.length;
        g('sa-prev-t').textContent = 'Oluşacak seanslar (' + n + ')';
        const show = r.list.slice(0, 5).map((o) => '<li><span class="row-l"><span class="tnum">' + lab(o.date) + ', ' + hm(st) + ' - ' + hm(st + len) + '</span><b class="' + (o.err ? 'debt' : 'muted') + '" style="font-weight:500">' + (o.err ? 'Çakışıyor' : g('sa-room').value) + '</b></span></li>').join('');
        g('sa-prev').innerHTML = (show || '<li class="muted">Henüz seans yok.</li>') + (n > 5 ? '<li class="muted">ve ' + (n - 5) + ' seans daha</li>' : '');
        const bad = r.list.filter((o) => o.err).length;
        const eb = g('sa-err'); eb.hidden = !r.err; eb.querySelector('span').textContent = r.err + (bad > 1 ? ' Toplam ' + bad + ' seansta sorun var.' : '');
        g('sa-ok').disabled = !!r.err || !n; g('sa-ok').textContent = mode === 'one' ? 'Seansı oluştur' : 'Seriyi oluştur (' + n + ' seans)';
      }
      function openA() {
        opener = document.activeElement; mode = 'series';
        g('sa-type').innerHTML = TY.map((t) => '<option>' + t.n + '</option>').join(''); g('sa-type').value = 'Pilates mat';
        g('sa-days').innerHTML = DN.map((d, i) => '<button type="button" data-d="' + i + '" aria-pressed="' + (i === 3) + '">' + d + '</button>').join('');
        g('sa-mode').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.getAttribute('data-m') === mode)));
        fillType(); g('sa-sheet').hidden = false; g('sa-scrim').hidden = false; g('sa-type').focus();
      }
      function fillType() { const t = ty(); g('sa-room').value = t.r; g('sa-len').value = String(t.l); g('sa-cap').value = t.cap; paint(); }
      function closeA() { g('sa-sheet').hidden = true; g('sa-scrim').hidden = true; if (opener && document.contains(opener)) opener.focus(); }
      g('sa-type').addEventListener('change', fillType);
      g('sa-form').addEventListener('input', paint); g('sa-form').addEventListener('change', paint);
      g('sa-mode').addEventListener('click', (e) => { const b = e.target.closest('button[data-m]'); if (!b) return; mode = b.getAttribute('data-m'); g('sa-mode').querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); paint(); });
      g('sa-days').addEventListener('click', (e) => { const b = e.target.closest('button[data-d]'); if (!b) return; b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true')); paint(); });
      g('sa-ok').addEventListener('click', () => {
        const r = gen(); if (r.err || !r.list.length) return;
        const t = r.t, n = mode === 'one' ? 1 : +g('sa-weeks').value, byDay = {};
        r.list.forEach((o) => { (byDay[o.d] = byDay[o.d] || []).push(o); });
        Object.keys(byDay).forEach((d) => {
          const first = byDay[d][0].date, base = { id: 'n' + (++seq), d: +d, s: r.st, l: r.len, t: t.n, r: r.room, h: 0, c: r.cap, p: t.n === 'Özel ders' ? 1 : 0, coach: t.c };
          if (mode === 'one') base.once = mon(first).getTime(); else { base.first = mon(first).getTime(); base.total = n; base.from = mon(first).getTime(); base.until = addD(mon(first), 7 * (n - 1)).getTime(); }
          S.push(base);
        });
        anchor = new Date(r.list[0].date); closeA(); render();
        toast(mode === 'one' ? 'Seans oluşturuldu: ' + lab(r.list[0].date) + ' ' + hm(r.st) : 'Seri oluşturuldu: ' + r.list.length + ' seans, ' + t.n);
      });
      g('sa-x').addEventListener('click', closeA); g('sa-cancel').addEventListener('click', closeA); g('sa-scrim').addEventListener('click', closeA);
      g('cal-add').addEventListener('click', openA);

      /* ----- Seans iptali ve telafi (Seans detayı) ----- */
      let done = false;
      const sess = () => S.filter((x) => x.id === 'f')[0];
      const WK = mon(new Date(2026, 10, 4));
      function members() { return stu.filter((s) => s.on && s.next === 'Çar 14:30'); }
      function effect() {
        const tel = g('sc-tel').checked, mv = tel && g('sc-move').querySelector('input:checked').value === 'move';
        const d = dOf(g('sc-date').value), st = mins(g('sc-time').value);
        let err = '';
        if (tel) err = check(d, st, 60, g('sc-room').value, 'Elif K.', 'Arjantin tango teknik');
        const closed = /kapandı/i.test(g('att-badge').textContent);
        g('sc-tel-w').hidden = !tel; g('sc-block').hidden = !closed;
        const rows = [
          ['Seans', 'İptal edildi', 'Programda üstü çizili görünür, kaydı silinmez.'],
          ['Rezervasyonlar', mv ? '8 kayıt telafiye taşınır' : '8 kayıt iptal edilir', mv ? 'Hak ayrılmış kalır, üye isterse iptal eder.' : 'Ayrılmış haklar iade edilir (süreli haklarda değişiklik yok).'],
          ['Telafi', tel && !err ? lab(d) + ', ' + hm(st) + ' - ' + hm(st + 60) : tel ? 'Planlanamıyor' : 'Yok', tel ? (err || 'Aynı ders, ' + g('sc-room').value + ', Elif K.') : 'Üyeler yeni bir seansa kendisi kayıt olur.'],
          ['Bildirim', g('sc-notify').checked ? '8 üyeye e-posta' : 'Gönderilmez', g('sc-notify').checked ? 'Neden ve telafi bilgisi yazılır.' : 'Üyeler seansın iptalini kendisi görür.']
        ];
        g('sc-eff').innerHTML = rows.map((x) => '<li><span class="row-l"><span>' + x[0] + '</span><b class="tnum">' + esc(x[1]) + '</b></span><span class="ch">' + esc(x[2]) + '</span></li>').join('');
        const eb = g('sc-err'); eb.hidden = !err; eb.querySelector('span').textContent = err;
        g('sc-ok').disabled = !!err || closed || !g('sc-why').value || done;
      }
      let scOpener = null;
      function openC() { scOpener = document.activeElement; g('sc-why').value = ''; g('sc-note').value = ''; effect(); g('sc-sheet').hidden = false; g('sc-scrim').hidden = false; g('sc-why').focus(); }
      function closeC() { g('sc-sheet').hidden = true; g('sc-scrim').hidden = true; if (scOpener && document.contains(scOpener)) scOpener.focus(); }
      g('sc-open').addEventListener('click', openC);
      g('sc-form').addEventListener('input', effect); g('sc-form').addEventListener('change', effect);
      g('sc-x').addEventListener('click', closeC); g('sc-cancel').addEventListener('click', closeC); g('sc-scrim').addEventListener('click', closeC);
      g('sc-ok').addEventListener('click', () => {
        if (g('sc-ok').disabled) return;
        const tel = g('sc-tel').checked, mv = tel && g('sc-move').querySelector('input:checked').value === 'move', d = dOf(g('sc-date').value), st = mins(g('sc-time').value), why = g('sc-why').value;
        const f = sess(); f.xs = f.xs || {}; f.xs[WK.getTime()] = 1;
        if (tel) S.push({ id: 'n' + (++seq), once: mon(d).getTime(), d: idx(d), s: st, l: 60, t: 'Arjantin tango teknik · Telafi', r: g('sc-room').value, h: mv ? 8 : 0, c: 12, coach: 'Elif K.' });
        members().forEach((s) => {
          const r = s.rez.filter((x) => x.r === 'up' && x.c === 'Arjantin tango teknik')[0]; if (!r) return;
          if (mv) { r.d = DN[idx(d)] + ', ' + d.getDate() + ' ' + MN[d.getMonth()].slice(0, 3) + ' ' + hm(st); s.next = DN[idx(d)] + ' ' + hm(st); }
          else { r.r = 'cancelled'; r.y = ''; s.next = ''; if (s.k === 'c') { s.rs = Math.max(0, s.rs - 1); s.av += 1; } }
        });
        done = true; closeC();
        /* Seans detayı */
        const v = document.querySelector('[data-view="seans"]');
        const b = v.querySelector('.badges .badge'); b.textContent = 'İptal edildi'; b.className = 'badge bad';
        ['att-start', 'edit-open', 'ap-open', 'sc-open', 'att-badge', 'wl-add', 'wl-demo'].forEach((id) => { const el = g(id); if (el) el.hidden = true; });
        const note = document.createElement('div'); note.className = 'card'; note.setAttribute('data-sc-note', '1'); note.style.marginBottom = '16px';
        note.innerHTML = '<div class="card-c"><div class="ib-sent" style="border:0;padding:0"><i data-i="ban" style="color:var(--destructive)"></i><div><b style="font-weight:500">Seans iptal edildi: ' + esc(why) + '</b><p class="muted">' + (mv ? '8 rezervasyon ' + lab(d) + ' ' + hm(st) + ' telafi seansına taşındı.' : tel ? '8 rezervasyon iptal edildi, haklar iade edildi. Telafi: ' + lab(d) + ' ' + hm(st) + '.' : '8 rezervasyon iptal edildi, haklar iade edildi.') + (g('sc-notify').checked ? ' Üyelere bildirim gönderildi.' : '') + '</p><p style="margin-top:8px"><a class="btn outline sm" href="#program" data-goto="' + d.getTime() + '">Programda gör</a></p></div></div></div>';
        v.querySelector('.page-head').after(note); swap(note);
        const sl = document.querySelector('[data-view="genel-bakis"] .slot.next');
        if (sl) { sl.querySelector('h3').style.textDecoration = 'line-through'; const bd = sl.querySelector('.badge'); bd.textContent = 'İptal edildi'; bd.className = 'badge soft'; }
        anchor = new Date(TODAY); render(); renderList(); dock(); if (location.hash === '#uye') profile();
        toast('Seans iptal edildi' + (tel ? ', telafi planlandı' : ''));
      });
      document.addEventListener('click', (e) => { const a = e.target.closest('[data-goto]'); if (a) { anchor = new Date(+a.getAttribute('data-goto')); setTimeout(render, 0); } });
      document.addEventListener('keydown', (e) => { if (e.key !== 'Escape') return; if (!g('sc-sheet').hidden) closeC(); else if (!g('sa-sheet').hidden) closeA(); });
    })();
    /* kaydet / geri al */
    var mvd = document.getElementById('mv-dlg'), mvs = document.getElementById('mv-scrim');
    function closeMv() { mvd.hidden = true; mvs.hidden = true; }
    document.getElementById('sb-undo').addEventListener('click', function () { pending = {}; render(); toast('Değişiklikler geri alındı'); });
    document.getElementById('sb-save').addEventListener('click', function () {
      var wk = mon(anchor), aff = 0;
      document.getElementById('mv-list').innerHTML = Object.keys(pending).map(function (k) {
        var s = S.filter(function (x) { return x.id === k.split('@')[0]; })[0], p = pending[k], o = saved[k] || { d: s.d, s: s.s, l: s.l }; aff += s.h;
        return '<li><div><b style="font-weight:500">' + s.t + '</b><p class="s">' + s.r + ' · ' + s.h + ' üye</p></div><span class="tnum" style="text-align:right">' + DN[o.d] + ' ' + hm(o.s) + '<span class="arrow"> → </span>' + DN[p.d] + ' ' + hm(p.s) + (p.l !== o.l ? '<br><span class="muted">Süre ' + o.l + ' → ' + p.l + ' dk</span>' : '') + '</span></li>';
      }).join('');
      document.getElementById('mv-aff').textContent = aff + ' üyenin rezervasyonu etkilenir';
      mvd.hidden = false; mvs.hidden = false; document.getElementById('mv-ok').focus();
    });
    document.getElementById('mv-cancel').addEventListener('click', closeMv); mvs.addEventListener('click', closeMv);
    document.getElementById('mv-ok').addEventListener('click', function () {
      var n = Object.keys(pending).length, nt = document.getElementById('mv-notify').checked;
      Object.keys(pending).forEach(function (k) { saved[k] = pending[k]; }); pending = {}; closeMv(); render();
      toast(n + ' seans kaydedildi' + (nt ? ', üyelere bildirim gönderildi' : ''));
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !mvd.hidden) closeMv(); });
    /* ---------- Seans özeti: seri içinde tek seans değiştirme, kapsam seçimi, seri iptali ---------- */
    (function () {
      const g = (id) => document.getElementById(id);
      const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
      const DMS = 864e5, WK0 = mon(new Date(2026, 10, 4));
      const dOf = (v) => new Date(v + 'T00:00:00');
      const idx = (d) => (d.getDay() + 6) % 7;
      const lab = (d) => DN[idx(d)] + ' ' + d.getDate() + ' ' + MN[d.getMonth()].slice(0, 3);
      const mins = (v) => { const p = (v || '').split(':'); return p.length === 2 ? +p[0] * 60 + +p[1] : NaN; };
      const rOf = (s, wk) => (ovr[key(s, wk)] || {}).r || s.r;
      const cOf = (s, wk) => (ovr[key(s, wk)] || {}).c || s.c;
      const COACH = { 'Salsa başlangıç': 'Elif K.', 'Salsa orta': 'Kaan S.', 'Bachata başlangıç': 'Mert A.', 'Bachata orta': 'Kaan S.', 'Arjantin tango teknik': 'Elif K.', 'Pilates mat': 'Ceren B.', 'Hafta sonu atölyesi': 'Mert A.' };
      const coachOf = (s) => s.coach || COACH[s.t.replace(/ · Telafi$/, '')] || (s.p ? 'Deniz Y.' : '-');
      SHARED.coachOf = coachOf;
      const SH = (n) => { const p = n.split(' '); return p[0] + ' ' + p[1][0] + '.'; };
      const coAt = (s, wk) => coachOf(ovrS(s, wk));
      const isoOf = (d) => d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
      const typeBase = (t) => t.replace(/ · Telafi$/, '');
      const grpOf = (s) => s.grp || (s.grp = []);
      const stuOf = (n) => stu.filter((x) => x.n === n)[0];
      const RO_N = 4;
      let cur = null, step = 'view', opener = null, seq2 = 0;

      /* ----- Ortak: etkilenen haftalar ve çakışma denetimi ----- */
      function weeksOf(s, wk, scope) {
        if (scope === 'one' || s.once) return [wk];
        const end = s.until != null ? s.until : wk.getTime() + 11 * 7 * DMS, out = [];
        for (let t = wk.getTime(); t <= end; t += 7 * DMS) out.push(new Date(t));
        return out;
      }
      function clash(s, wk, scope, ch) {
        for (const w of weeksOf(s, wk, scope)) {
          const day = addD(w, ch.d);
          if (isPast(day, { s: ch.s, l: ch.l })) return lab(day) + ' geçmişte kaldı.';
          for (const o of S) {
            if (o === s || !live(o, w) || isX(o, w)) continue;
            const e = eff(o, w);
            if (e.d === ch.d && rOf(o, w) === ch.r && e.s < ch.s + ch.l && ch.s < e.s + e.l) return ch.r + ', ' + lab(day) + ' ' + hm(Math.max(e.s, ch.s)) + ': ' + o.t + ' ile çakışıyor.';
          }
        }
        return '';
      }
      function rekey(obj, oldId, newId, t) {
        Object.keys(obj).forEach((k) => { const p = k.split('@'); if (p[0] === oldId && +p[1] >= t) { obj[newId + '@' + p[1]] = obj[k]; delete obj[k]; } });
      }
      /* Değişikliği uygula: yalnız bu seans ya da bu ve sonraki seanslar (seri bölünür) */
      function applyChange(s, wk, ch, scope) {
        const t = wk.getTime(), k = key(s, wk);
        if (s.once) { s.d = ch.d; s.s = ch.s; s.l = ch.l; s.r = ch.r; s.c = ch.c; if (ch.coach) s.coach = ch.coach; delete pending[k]; delete saved[k]; return; }
        if (scope === 'one') { saved[k] = { d: ch.d, s: ch.s, l: ch.l }; delete pending[k]; ovr[k] = Object.assign({}, ovr[k], { r: ch.r, c: ch.c }); return; }
        if (s.from != null && t <= s.from) { s.d = ch.d; s.s = ch.s; s.l = ch.l; s.r = ch.r; s.c = ch.c; if (ch.coach) s.coach = ch.coach; delete pending[k]; delete saved[k]; delete ovr[k]; return; }
        const nid = 'o' + (++seq2), clone = Object.assign({}, s, { id: nid, from: t, d: ch.d, s: ch.s, l: ch.l, r: ch.r, c: ch.c, coach: ch.coach || s.coach, grp: (s.grp || []).slice(), xs: {} });
        Object.keys(s.xs || {}).forEach((x) => { if (+x >= t) { clone.xs[x] = 1; delete s.xs[x]; } });
        [saved, pending, ovr].forEach((o) => rekey(o, s.id, nid, t));
        delete saved[nid + '@' + t]; delete pending[nid + '@' + t]; delete ovr[nid + '@' + t];
        s.until = t - 7 * DMS; S.push(clone);
      }
      function endSeries(s, wk) {
        const t = wk.getTime(); s.until = t - 7 * DMS;
        if (s.total && s.first != null) s.total = Math.max(0, Math.round((t - s.first) / (7 * DMS)));
        if (s.from != null && s.until < s.from) S.splice(S.indexOf(s), 1);
      }
      function seriesText(s, wk) {
        if (s.once) return 'Tek seans';
        if (s.total && s.first != null) return 'Haftalık seri · ' + (Math.round((wk.getTime() - s.first) / (7 * DMS)) + 1) + ' / ' + (s.total);
        return 'Haftalık seri · süresiz';
      }

      /* ----- Seans özeti çekmecesi ----- */
      const sheet = g('oc-sheet'), scrim = g('oc-scrim');
      const TLAB = { view: 'Seans', edit: 'Seansı düzenle', cancel: 'Seansı iptal et', coach: 'Eğitmeni değiştir', ro: 'Sabit grup' };
      function openOcc(el) {
        const s = S.filter((x) => x.id === el.getAttribute('data-id'))[0]; if (!s) return;
        const wk = mon(anchor);
        if (s.id === 'f' && wk.getTime() === WK0.getTime()) { location.hash = 'seans'; return; }
        const e = eff(s, wk), day = addD(wk, e.d);
        cur = { s: s, wk: wk, e: e, day: day, x: isX(s, wk), past: isPast(day, { s: e.s, l: e.l }) };
        opener = document.activeElement; step = 'view'; paint(); sheet.hidden = false; scrim.hidden = false; g('oc-x').focus();
      }
      SHARED.openOcc = openOcc;
      function close() { sheet.hidden = true; scrim.hidden = true; if (opener && document.contains(opener)) opener.focus(); }
      function foot(html) { g('oc-foot').innerHTML = html; }
      function paint() {
        const { s, wk, e, day } = cur, room = rOf(s, wk), cap = cOf(s, wk);
        ['view', 'edit', 'cancel', 'coach', 'ro'].forEach((p) => { g('oc-p-' + p).hidden = p !== step; });
        g('oc-title').textContent = step === 'view' ? s.t : TLAB[step];
        g('oc-sub').textContent = (step === 'view' ? '' : s.t + ' · ') + lab(day) + ', ' + hm(e.s) + ' - ' + hm(e.s + e.l) + ' · ' + room;
        if (step === 'view') {
          g('oc-badges').innerHTML = (cur.x ? '<span class="badge bad">İptal edildi</span>' : cur.past ? '<span class="badge soft">Geçmiş</span>' : '<span class="badge">Planlandı</span>') + '<span class="badge soft">' + esc(seriesText(s, wk)) + '</span>';
          const rows = [['Kontenjan', s.h + ' / ' + cap, cap - s.h > 0 ? (cap - s.h) + ' yer boş' : 'Dolu'], ['Eğitmen', coAt(s, wk), 'Dersi veren'], ['Salon', room, 'Oda sınırı ' + ROOMS[room]]];
          if (!s.once) rows.push(['Seri', 'Her ' + DN[e.d] + ' ' + hm(e.s), s.until != null ? 'Son seans ' + lab(addD(new Date(s.until), e.d)) : 'Bitiş tarihi yok']);
          g('oc-facts').innerHTML = rows.map((x) => '<li><span class="row-l"><span>' + x[0] + '</span><b class="tnum">' + esc(x[1]) + '</b></span><span class="ch">' + esc(x[2]) + '</span></li>').join('');
          g('oc-vnote').textContent = cur.x ? 'Bu seans iptal edildi, kaydı silinmedi.' : cur.past ? 'Geçmiş seans değiştirilemez.' : s.once ? 'Tek seans. Düzenleme yalnız bu seansı etkiler.' : 'Yalnız bu seansı ya da bu seanstan sonraki seansları değiştirebilirsin.';
          const pend = !!pending[key(s, wk)], ro = !s.once && !s.p && !cur.x && !cur.past;
          g('oc-roster').hidden = !ro;
          if (ro) {
            const gl = grpOf(s);
            g('oc-ro-ul').innerHTML = gl.length ? gl.map((n) => '<li><div class="ro-l"><span>' + esc(n) + '</span><button type="button" class="btn ghost sm" data-ro-rm="' + esc(n) + '">Çıkar</button></div><span class="ch">Her hafta otomatik rezervasyon</span></li>').join('') : '<li><span class="ch">Sabit grup üyesi yok. Üye atarsan her hafta bu seansa otomatik yer ayrılır.</span></li>';
            g('oc-ro-add').disabled = s.h >= cap; g('oc-ro-add').title = s.h >= cap ? 'Kontenjan dolu' : '';
          }
          if (pend && !cur.x && !cur.past) g('oc-vnote').textContent = 'Bu seansta kaydedilmemiş bir taşıma var. Eğitmeni değiştirmeden önce kaydet ya da geri al.';
          foot(cur.x || cur.past ? '<button type="button" class="btn outline" id="oc-close">Kapat</button>' : '<button type="button" class="btn ghost" id="oc-cancel-go" style="margin-right:auto;color:var(--destructive)">İptal et</button><button type="button" class="btn outline" id="oc-co-go"' + (pend ? ' disabled' : '') + '>Eğitmeni değiştir</button><button type="button" class="btn" id="oc-edit-go">Düzenle</button>');
        } else if (step === 'edit') {
          g('oc-d').innerHTML = DN.map((d, i) => '<option value="' + i + '"' + (i === e.d ? ' selected' : '') + '>' + d + '</option>').join('');
          g('oc-s').value = hm(e.s);
          g('oc-l').innerHTML = [30, 45, 60, 75, 90, 120].map((v) => '<option value="' + v + '"' + (v === e.l ? ' selected' : '') + '>' + v + ' dk</option>').join('');
          g('oc-r').innerHTML = Object.keys(ROOMS).map((r) => '<option' + (r === room ? ' selected' : '') + '>' + r + '</option>').join('');
          g('oc-c').value = cap; g('oc-notify').checked = true;
          g('oc-scope-w').hidden = !!s.once; g('oc-scope').querySelector('input[value="one"]').checked = true;
          g('oc-sc-h').textContent = 'Seri bu seanstan itibaren yeni gün, saat ve salonla devam eder. Önceki seanslar değişmez.';
          foot('<button type="button" class="btn outline" id="oc-back">Geri</button><button type="button" class="btn" id="oc-save" disabled>Değişikliği kaydet</button>'); editEff();
        } else if (step === 'coach') {
          const curN = SH(FULLN(coAt(s, wk))) , names = SHARED.sd.IN.filter((x) => x.on && SH(x.n) !== coAt(s, wk));
          g('oc-co').innerHTML = names.map((x) => '<option value="' + esc(x.n) + '">' + esc(x.n) + (x.d.indexOf((typeOfT(s.t) || {}).n) > -1 ? '' : ' (dersi vermiyor)') + '</option>').join('');
          g('oc-co-h').textContent = 'Şu an: ' + FULLN(coAt(s, wk)) + '. Yalnız aktif eğitmenler listelenir.';
          g('oc-cw').value = ''; g('oc-conotify').checked = true; g('oc-cs-w').hidden = !!s.once; g('oc-cs').querySelector('input[value="one"]').checked = true;
          foot('<button type="button" class="btn outline" id="oc-back">Geri</button><button type="button" class="btn" id="oc-co-save" disabled>Eğitmeni değiştir</button>'); coEff();
        } else if (step === 'ro') {
          roPaint();
        } else {
          g('oc-why').value = ''; g('oc-cnote').value = ''; g('oc-cnotify').checked = true; g('oc-tel').checked = false;
          g('oc-cscope-w').hidden = !!s.once; g('oc-cscope').querySelector('input[value="one"]').checked = true;
          g('oc-td').value = '2026-11-' + (day.getDate() + 3 > 30 ? '30' : ('0' + (day.getDate() + 3)).slice(-2)); g('oc-tt').value = hm(e.s);
          g('oc-tr').innerHTML = Object.keys(ROOMS).map((r) => '<option' + (r === room ? ' selected' : '') + '>' + r + '</option>').join('');
          foot('<button type="button" class="btn outline" id="oc-back">Geri</button><button type="button" class="btn danger" id="oc-cok" disabled>Seansı iptal et</button>'); cancelEff();
        }
        swap(sheet);
      }
      const FULLN = (sh) => SHARED.coachFull(sh);
      const typeOfT = (t) => SHARED.sd.TYPES.filter((x) => typeBase(t).indexOf(x.n) === 0)[0];
      /* Eğitmen değiştirme */
      function coEff() {
        const { s, wk, e, day } = cur, scope = s.once ? 'one' : sc('oc-cs'), nm = g('oc-co').value, why = g('oc-cw').value, curN = FULLN(coAt(s, wk));
        let err = '';
        if (!nm) err = 'Bu dersi verebilecek başka aktif eğitmen yok.';
        else if (!SHARED.sdTeaches(nm, s.t)) err = nm.split(' ')[0] + ' bu dersi vermiyor. Stüdyo > Eğitmenler bölümünde ders listesine ekle.';
        const ws = nm ? weeksOf(s, wk, scope).slice(0, 12) : [];
        if (!err) for (const w of ws) {
          const d2 = addD(w, e.d), iso = isoOf(d2), room = rOf(s, w);
          if (isPast(d2, { s: e.s, l: e.l })) continue;
          const m = SHARED.sdIssue(nm, iso, e.s, e.l, room); if (m) { err = lab(d2) + ': ' + m; break; }
          for (const o of S) {
            if (o === s || !live(o, w) || isX(o, w) || coAt(o, w) !== SH(nm)) continue;
            const ee = eff(o, w); if (ee.d === e.d && ee.s < e.s + e.l && e.s < ee.s + ee.l) { err = lab(d2) + ' ' + hm(Math.max(ee.s, e.s)) + ': ' + nm.split(' ')[0] + ' aynı saatte ' + o.t + ' veriyor.'; break; }
          }
          if (err) break;
        }
        const n = weeksOf(s, wk, scope).length;
        const rows = [['Eğitmen', SH(curN) + ' → ' + (nm ? SH(nm) : '-'), scope === 'one' ? lab(day) + ' seansı için.' : s.until != null ? 'Bu seanstan itibaren ' + n + ' seans.' : 'Bu seanstan itibaren tüm haftalar. Seri iki parçaya ayrılır.'],
          ['Uygunluk', err ? 'Sorun var' : 'Uygun', err ? 'Aşağıdaki uyarıyı gider.' : 'Uygunluk, izin ve çakışma kontrol edildi.'],
          ['Program', 'Değişmez', 'Gün, saat, salon ve ' + s.h + ' rezervasyon aynı kalır.'],
          ['Bildirim', g('oc-conotify').checked ? s.h + ' üyeye e-posta' : 'Gönderilmez', g('oc-conotify').checked ? 'Yeni eğitmen adı iletilir.' : 'Üyeler değişikliği kendisi görür.']];
        g('oc-coeff').innerHTML = rows.map((x) => '<li><span class="row-l"><span>' + x[0] + '</span><b class="tnum">' + esc(x[1]) + '</b></span><span class="ch">' + esc(x[2]) + '</span></li>').join('');
        const eb = g('oc-coerr'); eb.hidden = !err; eb.querySelector('span').textContent = err;
        g('oc-co-save').disabled = !!err || !why; return { nm: nm, scope: scope, why: why };
      }
      g('oc-p-coach').addEventListener('input', () => coEff()); g('oc-p-coach').addEventListener('change', () => coEff());
      function setCoach(s, wk, sh, scope) {
        const t = wk.getTime();
        if (s.once) { s.coach = sh; return; }
        if (scope === 'one') { const k = key(s, wk); ovr[k] = Object.assign({}, ovr[k], { coach: sh }); return; }
        Object.keys(ovr).forEach((k) => { const p = k.split('@'); if (p[0] === s.id && +p[1] >= t && ovr[k].coach) delete ovr[k].coach; });
        applyChange(s, wk, { d: s.d, s: s.s, l: s.l, r: s.r, c: s.c, coach: sh }, 'fol');
      }
      /* Sabit grup */
      const roBlocks = (m, s) => {
        const b = [], nm = m.n;
        if (!m.on) b.push('Üye pasif.'); if (m.term || m.ended) b.push('Hakkı kapanmış.');
        if (grpOf(s).indexOf(nm) > -1) b.push('Zaten bu grupta.');
        if (m.debt > 0) b.push('Açık borç ₺' + m.debt + '.');
        const fz = SHARED.frozen ? SHARED.frozen(nm) : null; if (fz) b.push('Hak donduruldu.');
        const d = SHARED.pendingDocs ? SHARED.pendingDocs(nm, 'Rezervasyon') : []; if (d.length) b.push('Belge kabul bekliyor: ' + d.join(', ') + '.');
        if (m.k === 'c' && m.av < RO_N) b.push('Hak yetmiyor: ' + RO_N + ' seans için ' + m.av + ' hak var.');
        return b;
      };
      function roPaint() {
        const { s, wk, e, day } = cur, ro = cur.ro, add = ro.mode === 'add', cap = cOf(s, wk);
        g('oc-title').textContent = add ? 'Sabit gruba üye ekle' : 'Gruptan çıkar';
        g('oc-ro-list').hidden = !add; g('oc-ro-why-w').hidden = add; g('oc-ro-why').value = '';
        if (add) g('oc-ro-list').innerHTML = '<legend class="label">Üye</legend>' + stu.map((m) => { const b = roBlocks(m, s); return '<label class="opt" style="' + (b.length ? 'opacity:.6' : '') + '"><input type="radio" name="oc-ro" value="' + esc(m.n) + '"' + (b.length ? ' disabled' : '') + '><span><b>' + esc(m.n) + '</b><small>' + (m.k === 'c' ? m.pkg + ', ' + m.av + ' hak' : m.pkg) + (b.length ? ' · ' + esc(b[0]) : '') + '</small></span></label>'; }).join('');
        foot('<button type="button" class="btn outline" id="oc-back">Geri</button><button type="button" class="' + (add ? 'btn' : 'btn danger') + '" id="oc-ro-save" disabled>' + (add ? 'Sabit gruba ekle' : 'Gruptan çıkar') + '</button>'); roEff();
      }
      function roEff() {
        const { s, wk, e, day } = cur, ro = cur.ro, add = ro.mode === 'add', cap = cOf(s, wk); let nm = ro.name, err = '', rows = [], ok = false;
        if (add) { const r = document.querySelector('input[name="oc-ro"]:checked'); nm = r ? r.value : ''; if (s.h >= cap) err = 'Kontenjan dolu (' + s.h + ' / ' + cap + ').'; }
        const m = nm ? stuOf(nm) : null;
        if (add) {
          if (m) { rows = [['Sabit grup', m.n, 'Her ' + DN[e.d] + ' ' + hm(e.s) + ' seansına bu seanstan itibaren otomatik yer ayrılır.'], ['Rezervasyon', RO_N + ' seans', 'Önümüzdeki ' + RO_N + ' haftanın seansı için rezervasyon açılır, sonrası haftalık yenilenir.'], ['Hak', m.k === 'c' ? RO_N + ' ders ayrılır' : 'Sınırsız', m.k === 'c' ? 'Kullanılabilir hak ' + m.av + ' → ' + (m.av - RO_N) + '.' : 'Süreli hak, ders sayısı düşmez.'], ['Kontenjan', (s.h + 1) + ' / ' + cap, 'Bu seans ve sonraki seanslar.']]; ok = !err; }
          else rows = [['Sabit grup', '-', 'Eklenecek üyeyi seç.']];
        } else {
          rows = [['Sabit grup', nm, 'Yaklaşan ' + RO_N + ' seanstaki rezervasyonu iptal edilir.'], ['Hak', m && m.k === 'c' ? RO_N + ' ders iade' : 'Değişmez', 'Ayrılmış haklar üyeye geri döner.'], ['Kontenjan', (s.h - 1) + ' / ' + cap, 'Boşalan yer rezervasyona açılır.']]; ok = !!g('oc-ro-why').value;
        }
        rows.push(['Bildirim', g('oc-ro-notify').checked ? '1 üyeye e-posta' : 'Gönderilmez', '']);
        g('oc-ro-eff').innerHTML = rows.map((x) => '<li><span class="row-l"><span>' + x[0] + '</span><b class="tnum">' + esc(x[1]) + '</b></span>' + (x[2] ? '<span class="ch">' + esc(x[2]) + '</span>' : '') + '</li>').join('');
        const eb = g('oc-ro-err'); eb.hidden = !err; eb.querySelector('span').textContent = err;
        g('oc-ro-save').disabled = !ok || !!err; return { nm: nm, m: m };
      }
      g('oc-p-ro').addEventListener('input', () => roEff()); g('oc-p-ro').addEventListener('change', () => roEff());
      g('oc-p-view').addEventListener('click', (ev) => {
        const a = ev.target.closest('#oc-ro-add'), r = ev.target.closest('[data-ro-rm]');
        if (a && !a.disabled) { cur.ro = { mode: 'add' }; step = 'ro'; paint(); }
        else if (r) { cur.ro = { mode: 'rm', name: r.getAttribute('data-ro-rm') }; step = 'ro'; paint(); }
      });
      /* Düzenleme etkisi */
      const sc = (name) => { const r = document.querySelector('input[name="' + name + '"]:checked'); return r ? r.value : 'one'; };
      function chOf() { return { d: +g('oc-d').value, s: mins(g('oc-s').value), l: +g('oc-l').value, r: g('oc-r').value, c: +g('oc-c').value }; }
      function editEff() {
        const { s, wk, e, day } = cur, ch = chOf(), scope = s.once ? 'one' : sc('oc-sc'), room = rOf(s, wk), cap = cOf(s, wk);
        const changed = ch.d !== e.d || ch.s !== e.s || ch.l !== e.l || ch.r !== room || ch.c !== cap;
        let err = '';
        if (isNaN(ch.s) || ch.s < H0 * 60 || ch.s + ch.l > H1 * 60) err = 'Seans 08:00 - 22:00 arasında olmalı.';
        else if (!ch.c || ch.c < s.h) err = 'Kontenjan ayrılmış ' + s.h + ' yerin altına inemez.';
        else if (ch.c > ROOMS[ch.r]) err = ch.r + ' oda sınırı ' + ROOMS[ch.r] + '. Kontenjan bunu aşamaz.';
        else if (changed) err = clash(s, wk, scope, ch);
        const ws = weeksOf(s, wk, scope), last = ws[ws.length - 1];
        const span = scope === 'one' ? lab(day) + ' (1 seans)' : s.until != null ? lab(addD(wk, ch.d)) + ' ve sonrası, ' + ws.length + ' seans' : 'Bu seans ve sonraki tüm haftalar';
        const rows = [['Kapsam', span, scope === 'one' ? 'Seri aynı kalır, yalnız bu seans farklı olur.' : 'Seri iki parçaya ayrılır, bu seanstan sonrası yeni değerleri alır.'],
          ['Yeni zaman', DN[ch.d] + ' ' + (isNaN(ch.s) ? '-' : hm(ch.s) + ' - ' + hm(ch.s + ch.l)) + ' · ' + ch.r, changed ? 'Önceki: ' + DN[e.d] + ' ' + hm(e.s) + ' - ' + hm(e.s + e.l) + ' · ' + room : 'Henüz değişiklik yok.'],
          ['Üyeler', s.h + ' rezervasyon', scope === 'one' ? 'Bu seanstaki rezervasyonlar yeni saate taşınır.' : 'Bu ve sonraki seanslardaki rezervasyonlar yeni saate taşınır.']];
        g('oc-eff').innerHTML = rows.map((x) => '<li><span class="row-l"><span>' + x[0] + '</span><b class="tnum">' + esc(x[1]) + '</b></span><span class="ch">' + esc(x[2]) + '</span></li>').join('');
        const eb = g('oc-err'); eb.hidden = !err; eb.querySelector('span').textContent = err;
        g('oc-save').disabled = !changed || !!err; return { ch: ch, scope: scope, last: last };
      }
      function cancelEff() {
        const { s, wk, e, day } = cur, scope = s.once ? 'one' : sc('oc-csc'), tel = g('oc-tel').checked && scope === 'one';
        g('oc-tel-w').hidden = !tel; g('oc-tel-sw').hidden = scope !== 'one';
        let err = '';
        const td = dOf(g('oc-td').value), tt = mins(g('oc-tt').value);
        if (tel) err = isNaN(td) || isNaN(tt) ? 'Telafi tarihini ve saatini gir.' : tt < H0 * 60 || tt + e.l > H1 * 60 ? 'Telafi 08:00 - 22:00 arasında olmalı.' : clash(Object.assign({}, s, { id: '_tel' }), mon(td), 'one', { d: idx(td), s: tt, l: e.l, r: g('oc-tr').value });
        const ws = weeksOf(s, wk, scope);
        const rows = scope === 'one'
          ? [['Seans', 'İptal edilir', lab(day) + ' seansı programda üstü çizili kalır. Seri devam eder.'], ['Rezervasyonlar', s.h + ' kayıt', tel ? 'Telafi seansına taşınır, hak ayrılmış kalır.' : 'İptal edilir, ayrılmış haklar iade edilir.']]
          : [['Seri', 'Bu seanstan itibaren biter', s.until != null ? ws.length + ' seans iptal edilir.' : 'Sonraki tüm haftalar iptal edilir. Önceki seanslar kalır.'], ['Rezervasyonlar', s.h + ' + sonrakiler', 'İptal edilir, ayrılmış haklar iade edilir.']];
        if (tel) rows.push(['Telafi', isNaN(td) ? '-' : lab(td) + ', ' + hm(tt) + ' - ' + hm(tt + e.l), err || g('oc-tr').value + ', ' + coachOf(s)]);
        rows.push(['Bildirim', g('oc-cnotify').checked ? s.h + ' üyeye e-posta' : 'Gönderilmez', g('oc-cnotify').checked ? 'Neden ve varsa telafi bilgisi yazılır.' : 'Üyeler iptali kendisi görür.']);
        g('oc-ceff').innerHTML = rows.map((x) => '<li><span class="row-l"><span>' + x[0] + '</span><b class="tnum">' + esc(x[1]) + '</b></span><span class="ch">' + esc(x[2]) + '</span></li>').join('');
        const eb = g('oc-cerr'); eb.hidden = !err; eb.querySelector('span').textContent = err;
        g('oc-cok').textContent = scope === 'one' ? 'Seansı iptal et' : 'Seriyi bu seanstan itibaren bitir';
        g('oc-cok').disabled = !!err || !g('oc-why').value;
      }
      g('oc-p-edit').addEventListener('input', () => editEff()); g('oc-p-edit').addEventListener('change', () => editEff());
      g('oc-p-cancel').addEventListener('input', cancelEff); g('oc-p-cancel').addEventListener('change', cancelEff);
      g('oc-foot').addEventListener('click', (ev) => {
        const b = ev.target.closest('button'); if (!b || b.disabled) return; const id = b.id, { s, wk, e, day } = cur;
        if (id === 'oc-close') close();
        else if (id === 'oc-edit-go') { step = 'edit'; paint(); g('oc-s').focus(); }
        else if (id === 'oc-cancel-go') { step = 'cancel'; paint(); g('oc-why').focus(); }
        else if (id === 'oc-co-go') { step = 'coach'; paint(); g('oc-co').focus(); }
        else if (id === 'oc-co-save') {
          const r = coEff(); if (g('oc-co-save').disabled) return;
          setCoach(s, wk, SH(r.nm), r.scope); close(); render(); SHARED.sdRefresh && SHARED.sdRefresh();
          toast('Eğitmen ' + SH(r.nm) + ' oldu' + (r.scope === 'one' ? ', yalnız ' + lab(day) + ' seansı' : ', bu ve sonraki seanslar') + (g('oc-conotify').checked ? ', üyelere bildirim gönderildi' : ''));
        } else if (id === 'oc-ro-save') {
          const r = roEff(); if (g('oc-ro-save').disabled) return; const gl = grpOf(s), m = r.m, ty = typeBase(s.t);
          if (cur.ro.mode === 'add') {
            gl.push(m.n); s.h++;
            if (m.k === 'c') { m.rs += RO_N; m.av -= RO_N; }
            m.rez.unshift({ d: DN[e.d] + ', ' + day.getDate() + ' ' + MN[day.getMonth()].slice(0, 3) + ' ' + hm(e.s), c: ty, r: 'up', y: 'wait' }); if (!m.next) m.next = DN[e.d] + ' ' + hm(e.s);
            toast(m.n + ' sabit gruba eklendi, ' + RO_N + ' seans için yer ayrıldı');
          } else {
            const nm = cur.ro.name, mm = stuOf(nm); gl.splice(gl.indexOf(nm), 1); s.h = Math.max(0, s.h - 1);
            if (mm) { mm.rez.forEach((x) => { if (x.r === 'up' && x.c === ty) { x.r = 'cancelled'; x.y = ''; if (mm.k === 'c') { mm.rs = Math.max(0, mm.rs - 1); mm.av += 1; } } }); }
            toast(nm + ' gruptan çıkarıldı, haklar iade edildi');
          }
          SHARED.refreshMembers && SHARED.refreshMembers(); step = 'view'; paint(); render();
        }
        else if (id === 'oc-back') { step = 'view'; paint(); }
        else if (id === 'oc-save') {
          const r = editEff(); if (g('oc-save').disabled) return;
          applyChange(s, wk, r.ch, r.scope); anchor = new Date(addD(wk, r.ch.d)); close(); render();
          toast((r.scope === 'one' ? 'Yalnız ' + lab(day) + ' seansı değişti' : 'Bu ve sonraki seanslar güncellendi') + (g('oc-notify').checked ? ', üyelere bildirim gönderildi' : ''));
        } else if (id === 'oc-cok') {
          const scope = s.once ? 'one' : sc('oc-csc'), tel = g('oc-tel').checked && scope === 'one', why = g('oc-why').value;
          if (scope === 'one') {
            s.xs = s.xs || {}; s.xs[wk.getTime()] = 1;
            if (tel) { const td = dOf(g('oc-td').value); S.push({ id: 'o' + (++seq2), once: mon(td).getTime(), d: idx(td), s: mins(g('oc-tt').value), l: e.l, t: s.t.replace(/ · Telafi$/, '') + ' · Telafi', r: g('oc-tr').value, h: s.h, c: cOf(s, wk), p: s.p, coach: coachOf(s) }); }
          } else endSeries(s, wk);
          close(); render();
          toast(scope === 'one' ? lab(day) + ' seansı iptal edildi' + (tel ? ', telafi planlandı' : '') : 'Seri ' + lab(day) + ' seansından itibaren bitirildi');
        }
      });
      g('oc-x').addEventListener('click', close); scrim.addEventListener('click', close);
      document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && !sheet.hidden) close(); });

      /* ----- Sürükle-bırak kaydı: kapsam sorusu ----- */
      const mvList = g('mv-list'), mvOk = g('mv-ok'), mvd = g('mv-dlg');
      const w = document.createElement('div'); w.id = 'mv-scope-w'; w.style.cssText = 'display:grid;gap:8px;margin-top:12px';
      w.innerHTML = '<fieldset class="scope" id="mv-scope"><legend class="label">Değişiklik kapsamı</legend><label class="opt"><input type="radio" name="mv-sc" value="one" checked><span><b>Yalnız bu hafta</b><small>Seriyi bozmaz, yalnız bu seansı taşır</small></span></label><label class="opt"><input type="radio" name="mv-sc" value="fol"><span><b>Bu ve sonraki haftalar</b><small>Seri bu seanstan itibaren yeni gün ve saatte devam eder</small></span></label></fieldset><p class="mg-warn" id="mv-err" hidden><i data-i="ban"></i><span></span></p>';
      mvList.after(w); swap(w);
      const recurring = () => Object.keys(pending).filter((k) => { const s = S.filter((x) => x.id === k.split('@')[0])[0]; return s && !s.once; });
      function mvCheck() {
        const fol = sc('mv-sc') === 'fol' && recurring().length; let err = '';
        if (fol) recurring().some((k) => { const s = S.filter((x) => x.id === k.split('@')[0])[0], wk = new Date(+k.split('@')[1]), p = pending[k]; err = clash(s, wk, 'fol', { d: p.d, s: p.s, l: p.l, r: rOf(s, wk) }); return !!err; });
        mvd.querySelector('.card-h p').textContent = fol ? 'Bu seanstan sonraki haftalar da değişir.' : 'Yalnızca bu haftanın seansları değişir.'; const eb = g('mv-err'); eb.hidden = !err; eb.querySelector('span').textContent = err; mvOk.disabled = !!err;
      }
      g('sb-save').addEventListener('click', () => { w.hidden = !recurring().length; w.querySelector('input[value="one"]').checked = true; mvCheck(); });
      w.addEventListener('change', mvCheck);
      mvOk.addEventListener('click', (ev) => {
        if (sc('mv-sc') !== 'fol' || !recurring().length) return;
        ev.stopImmediatePropagation();
        const n = Object.keys(pending).length, nt = g('mv-notify').checked;
        Object.keys(pending).forEach((k) => {
          const s = S.filter((x) => x.id === k.split('@')[0])[0], wk = new Date(+k.split('@')[1]), p = pending[k];
          if (s.once) saved[k] = p; else { const cp = { d: p.d, s: p.s, l: p.l, r: rOf(s, wk), c: cOf(s, wk) }; delete pending[k]; applyChange(s, wk, cp, 'fol'); }
        });
        Object.keys(pending).forEach((k) => { saved[k] = pending[k]; }); pending = {}; closeMv(); render();
        toast(n + ' seans kaydedildi, bu ve sonraki haftalar güncellendi' + (nt ? ', üyelere bildirim gönderildi' : ''));
      }, true);
    })();
    window.addEventListener('hashchange', function () { if (location.hash === '#program') { first = true; render(); } });
    render();
  })();

  /* ---------- Paketler (kurgusal veri) ---------- */
  (function () {
    P.archive = '<rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4"/>';
    function V(d, note, ch) { return { d: d, note: note, ch: ch || [] }; }
    var PKS = [
      { id: 1, n: '8 derslik paket', t: 'c', ders: 8, gun: 90, fiyat: 1200, kap: ['Grup dersleri'], on: true, arc: false, act: 4, sold: 3, q: 'none', qn: 0, frz: true, frzd: 30, nv: 150, hist: [V('10 Eki', 'Dondurma izni açıldı', ['Dondurma: kapalı → en fazla 30 gün']), V('1 Eyl', 'İlk yayın')] },
      { id: 2, n: '12 derslik paket', t: 'c', ders: 12, gun: 90, fiyat: 1800, kap: ['Grup dersleri'], on: true, arc: false, act: 3, sold: 2, q: 'none', qn: 0, frz: true, frzd: 30, nv: 150, hist: [V('1 Eyl', 'İlk yayın')] },
      { id: 3, n: 'Aylık sınırsız', t: 't', ders: 0, gun: 30, fiyat: 1500, kap: ['Grup dersleri', 'Atölye ve etkinlik'], on: true, arc: false, act: 3, sold: 3, q: 'none', qn: 0, frz: true, frzd: 14, nv: 0, hist: [V('1 Eyl', 'İlk yayın')] },
      { id: 4, n: 'Deneme dersi', t: 'c', ders: 1, gun: 14, fiyat: 200, kap: ['Grup dersleri'], on: true, arc: false, act: 0, sold: 2, q: 'none', qn: 0, frz: false, frzd: 0, nv: 200, hist: [V('1 Eyl', 'İlk yayın')] },
      { id: 5, n: 'Özel ders, 4 seans', t: 'c', ders: 4, gun: 60, fiyat: 2400, kap: ['Özel ders'], on: false, arc: false, act: 0, sold: 0, q: 'week', qn: 1, frz: true, frzd: 30, nv: 600, hist: [V('1 Eyl', 'İlk yayın')] },
      { id: 6, n: 'Yaz 10 derslik', t: 'c', ders: 10, gun: 75, fiyat: 1400, kap: ['Grup dersleri'], on: false, arc: true, act: 0, sold: 0, q: 'none', qn: 0, frz: false, frzd: 0, nv: 140, hist: [V('1 Haz', 'İlk yayın')] }
    ];
    PKS.forEach(function (p) { p.ver = p.hist.length; p.hist.forEach(function (h, i) { h.v = p.hist.length - i; }); });
    var SALES = [
      { p: 1, u: 'Tolga Yıldız', d: '12 Eki', a: 1200, v: 2 }, { p: 1, u: 'Selin Aksoy', d: '1 Eki', a: 1200, v: 1 }, { p: 1, u: 'Kerem Zorlu', d: '1 Eki', a: 1200, v: 1 },
      { p: 2, u: 'Nehir Gür', d: '30 Eki', a: 1800, v: 1 }, { p: 2, u: 'Burak Kaya', d: '15 Eki', a: 1800, v: 1 }, { p: 2, u: 'Derya Sönmez', d: '5 Eki', a: 1800, v: 1 },
      { p: 3, u: 'Ece Mutlu', d: '2 Kas', a: 1500, v: 1 }, { p: 3, u: 'Cem Demir', d: '1 Kas', a: 1500, v: 1 }, { p: 3, u: 'Merve Tan', d: '1 Kas', a: 1500, v: 1 }
    ];
    var nextId = 7, fil = 'all', editing = null, kind = 'c', baseSig = '', stage = 1;
    var money = function (n) { return '₺' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); };
    var $$ = function (id) { return document.getElementById(id); };
    var short = { 'Grup dersleri': 'Grup', 'Özel ders': 'Özel', 'Atölye ve etkinlik': 'Atölye' };
    var QN = { none: 'Yok', week: 'Haftalık', month: 'Aylık' };
    SHARED.pkgFreeze = function (name) { var p = PKS.filter(function (x) { return x.n === name; })[0]; return p ? { on: p.frz, max: p.frzd } : { on: true, max: 30 }; };
    SHARED.pkgNv = function (name) { var p = PKS.filter(function (x) { return x.n === name; })[0]; return p && p.t === 'c' ? p.nv : 0; };

    function status(p) { return p.arc ? 'arc' : p.on ? 'on' : 'off'; }
    function qTxt(p) { return p.q === 'none' ? '' : (p.q === 'week' ? 'Haftada' : 'Ayda') + ' en fazla ' + p.qn + ' ders'; }
    function kpis() {
      var live = PKS.filter(function (p) { return !p.arc; }), on = live.filter(function (p) { return p.on; });
      var sold = PKS.reduce(function (a, p) { return a + p.sold; }, 0);
      var rev = PKS.reduce(function (a, p) { return a + p.sold * p.fiyat; }, 0);
      var act = PKS.reduce(function (a, p) { return a + p.act; }, 0);
      function k(l, v, s) { return '<div class="kpi card"><span class="l">' + l + '</span><b class="tnum">' + v + '</b><span class="sub">' + s + '</span></div>'; }
      $$('pk-kpi').innerHTML = k('Satışta', on.length + '<small> / ' + live.length + '</small>', 'paket') +
        k('Son 30 gün satış', String(sold), 'adet paket') + k('Son 30 gün ciro', money(rev), 'brüt tutar') + k('Aktif hak sahibi', String(act), 'üye');
    }
    function render() {
      var q = $$('pk-search').value.trim().toLocaleLowerCase('tr');
      var rows = PKS.filter(function (p) {
        return (fil === 'all' ? !p.arc : status(p) === fil) && p.n.toLocaleLowerCase('tr').indexOf(q) > -1;
      });
      $$('pk-body').innerHTML = rows.map(function (p) {
        var type = p.t === 'c' ? p.ders + ' ders' : 'Sınırsız ders';
        return '<tr tabindex="0" class="' + (p.arc ? 'arc' : '') + '" data-id="' + p.id + '"><td><span class="nm"><span>' + p.n + '</span><small>' + (p.t === 'c' ? 'Ders sayılı' : 'Süreli') + ' · v' + p.ver + (p.arc ? ' · Arşivde' : '') + (p.draft ? ' · Taslak var' : '') + '</small></span></td>' +
          '<td><span class="pk-sc">' + p.kap.map(function (c) { return '<span class="badge soft">' + short[c] + '</span>'; }).join('') + '</span></td>' +
          '<td class="tnum">' + type + '<span class="pk-sub-p">' + p.gun + ' gün' + (p.q !== 'none' ? ' · ' + qTxt(p) : '') + (p.frz ? '' : ' · Dondurma yok') + '</span></td>' +
          '<td class="r tnum">' + money(p.fiyat) + (p.t === 'c' ? '<span class="pk-sub-p">' + money(Math.round(p.fiyat / p.ders)) + ' / ders</span>' : '') + '</td>' +
          '<td class="r tnum">' + (p.act || '<span class="muted">-</span>') + '</td>' +
          '<td>' + (p.arc ? '<span class="badge soft">Arşiv</span>' : '<input type="checkbox" class="switch" role="switch" data-sw="' + p.id + '" aria-label="' + p.n + ' satışta"' + (p.on ? ' checked' : '') + '>') + '</td></tr>';
      }).join('') || '<tr><td colspan="6" class="muted" style="padding:32px 0;text-align:center">Bu filtreye uygun paket yok.</td></tr>';
      var live = PKS.filter(function (p) { return !p.arc; }).length;
      $$('pk-count').textContent = rows.length + ' paket gösteriliyor, ' + live + ' etkin paket';
      kpis();
    }

    /* Çekmece */
    var sheet = $$('pk-sheet'), scrim = $$('pk-scrim'), opener = null;
    function num(id) { return Math.round(+$$(id).value.replace(/\D/g, '')) || 0; }
    function checked() { return Array.prototype.slice.call($$('pk-kapsam').querySelectorAll('input:checked')).map(function (i) { return i.value; }); }
    function collect() { return { n: $$('pk-ad').value.trim(), t: kind, ders: kind === 'c' ? num('pk-ders') : 0, gun: num('pk-gun'), fiyat: num('pk-fiyat'), kap: checked(), on: $$('pk-on').checked, q: $$('pk-q').value, qn: $$('pk-q').value === 'none' ? 0 : num('pk-qn'), frz: $$('pk-frz').checked, frzd: $$('pk-frz').checked ? num('pk-frzd') : 0, nv: kind === 'c' ? num('pk-nv') : 0 }; }
    var COMM = ['t', 'ders', 'gun', 'fiyat', 'kap', 'q', 'qn', 'frz', 'frzd', 'nv'];
    function sigOf(d) { return [d.n, d.t, d.ders, d.gun, d.fiyat, d.kap.join('|'), d.on, d.q, d.qn, d.frz, d.frzd, d.nv].join('~'); }
    function sig() { return sigOf(collect()); }
    function diff(p, d) {
      var o = [];
      if (p.fiyat !== d.fiyat) o.push('Fiyat: ' + money(p.fiyat) + ' → ' + money(d.fiyat));
      if (p.t !== d.t) o.push('Tür: ' + (p.t === 'c' ? 'Ders sayılı' : 'Süreli') + ' → ' + (d.t === 'c' ? 'Ders sayılı' : 'Süreli'));
      if (p.ders !== d.ders) o.push('Ders sayısı: ' + (p.ders || 'Sınırsız') + ' → ' + (d.ders || 'Sınırsız'));
      if (p.gun !== d.gun) o.push('Geçerlilik: ' + p.gun + ' → ' + d.gun + ' gün');
      if (p.kap.join('|') !== d.kap.join('|')) o.push('Kapsam: ' + p.kap.map(function (c) { return short[c]; }).join(', ') + ' → ' + d.kap.map(function (c) { return short[c]; }).join(', '));
      if (p.q !== d.q || p.qn !== d.qn) o.push('Kullanım sınırı: ' + (qTxt(p) || 'yok') + ' → ' + (qTxt(d) || 'yok'));
      if (p.frz !== d.frz || p.frzd !== d.frzd) o.push('Dondurma: ' + (p.frz ? 'en fazla ' + p.frzd + ' gün' : 'kapalı') + ' → ' + (d.frz ? 'en fazla ' + d.frzd + ' gün' : 'kapalı'));
      if (p.nv !== d.nv) o.push('Negatif ders değeri: ' + money(p.nv) + ' → ' + money(d.nv));
      return o;
    }
    function commChanged() { if (!editing) return false; var d = collect(); return COMM.some(function (k) { return JSON.stringify(editing[k]) !== JSON.stringify(d[k]); }); }
    function setKind(k) {
      kind = k;
      $$('pk-tur').querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-t') === k)); });
      $$('pk-f-ders').hidden = k !== 'c'; $$('pk-f-birim').hidden = k !== 'c'; $$('pk-f-nv').hidden = k !== 'c';
    }
    function problem() {
      var d = collect();
      if (!d.n) return ''; if (!(d.fiyat > 0) || !(d.gun > 0) || (d.t === 'c' && !(d.ders > 0))) return ''; if (!d.kap.length) return 'En az bir kapsam seç.';
      if (d.q !== 'none' && !(d.qn > 0)) return 'Kullanım sınırı için ders sayısını yaz.';
      if (d.frz && !(d.frzd > 0 && d.frzd <= 90)) return 'Dondurma süresi 1 ile 90 gün arasında olmalı.';
      if (d.t === 'c' && !(d.nv > 0)) return 'Negatif limit için ders değeri yaz.';
      return null;
    }
    function sync() {
      var pr = problem(), er = $$('pk-err');
      $$('pk-birim').value = kind === 'c' && num('pk-ders') ? money(Math.round(num('pk-fiyat') / num('pk-ders'))) : '-';
      $$('pk-qn-w').hidden = $$('pk-q').value === 'none'; $$('pk-frzd-w').hidden = !$$('pk-frz').checked;
      er.hidden = !pr; er.querySelector('span').textContent = pr || '';
      var ch = editing && sig() !== baseSig, cm = commChanged();
      $$('pk-save').textContent = !editing ? 'Paketi ekle' : cm ? 'Sürümü hazırla' : 'Değişiklikleri kaydet';
      $$('pk-save').disabled = pr !== null || (editing && !ch && !editing.draft);
    }
    function fill(d) {
      $$('pk-ad').value = d.n; setKind(d.t); $$('pk-ders').value = d.ders || '8'; $$('pk-gun').value = d.gun; $$('pk-fiyat').value = d.fiyat || '';
      $$('pk-kapsam').querySelectorAll('input').forEach(function (i) { i.checked = d.kap.indexOf(i.value) > -1; });
      $$('pk-on').checked = d.on; $$('pk-q').value = d.q; $$('pk-qn').value = d.qn || 1; $$('pk-frz').checked = d.frz; $$('pk-frzd').value = d.frzd || 30; $$('pk-nv').value = d.nv || '';
    }
    function view(st) {
      stage = st; $$('pk-form').hidden = st !== 1; $$('pk-pub').hidden = st !== 2; $$('pk-f1').hidden = st !== 1; $$('pk-f2').hidden = st !== 2;
      $$('pk-title').textContent = st === 2 ? 'Yeni sürümü yayınla' : (editing ? editing.n : 'Yeni paket');
      $$('pk-sub').textContent = st === 2 ? editing.n + ' · v' + editing.ver + ' → v' + (editing.ver + 1) : editing ? (editing.act ? editing.act + ' üyenin aktif hakkı var. Mevcut haklar değişmez.' : 'Henüz aktif hak sahibi yok.') : 'Üyelere satışta görünecek paketi tanımla.';
    }
    function verHtml(p) {
      return '<li><div class="row-l"><span><b>v' + p.ver + '</b> · yayında</span><span class="tnum muted">' + p.hist[0].d + '</span></div><span class="ch">' + esc(p.hist[0].note || '-') + '</span></li>' + p.hist.slice(1, 3).map(function (h) { return '<li><div class="row-l"><span>v' + h.v + '</span><span class="tnum muted">' + h.d + '</span></div><span class="ch">' + esc(h.note || '-') + (h.ch.length ? ': ' + esc(h.ch.join('; ')) : '') + '</span></li>'; }).join('');
    }
    function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
    function salesHtml(p) {
      var l = SALES.filter(function (x) { return x.p === p.id; });
      return l.length ? l.map(function (x) { return '<li><div class="row-l"><span>' + esc(x.u) + '</span><span class="tnum">' + money(x.a) + '</span></div><span class="ch tnum">' + x.d + ' · v' + x.v + '</span></li>'; }).join('') : '<li><span class="ch">Bu pakette satış kaydı yok.</span></li>';
    }
    function openSheet(p) {
      opener = document.activeElement; editing = p || null;
      $$('pk-save').textContent = p ? 'Değişiklikleri kaydet' : 'Paketi ekle';
      fill(p ? (p.draft || p) : { n: '', t: 'c', ders: 8, gun: 90, fiyat: 0, kap: ['Grup dersleri'], on: true, q: 'none', qn: 0, frz: true, frzd: 30, nv: 0 });
      $$('pk-on').disabled = !!(p && p.arc);
      $$('pk-info').hidden = !p; $$('pk-arc').hidden = !p; $$('pk-hist').hidden = !p;
      $$('pk-draft').hidden = !(p && p.draft);
      if (p) { $$('pk-ver').innerHTML = verHtml(p); $$('pk-sales').innerHTML = salesHtml(p); }
      $$('pk-arc-t').textContent = p && p.arc ? 'Arşivden çıkar' : 'Arşivle';
      $$('pk-arc').style.color = p && p.arc ? 'var(--foreground)' : '';
      baseSig = p ? sigOf(p) : ''; view(1); sync();
      sheet.hidden = false; scrim.hidden = false; $$('pk-ad').focus();
    }
    function closeSheet() { sheet.hidden = true; scrim.hidden = true; if (opener) opener.focus(); }

    $$('pk-add').addEventListener('click', function () { openSheet(null); });
    $$('pk-x').addEventListener('click', closeSheet); $$('pk-cancel').addEventListener('click', closeSheet); scrim.addEventListener('click', closeSheet);
    $$('pk-form').addEventListener('input', sync); $$('pk-form').addEventListener('change', sync);
    $$('pk-form').addEventListener('submit', function (e) { e.preventDefault(); });
    $$('pk-tur').addEventListener('click', function (e) { var b = e.target.closest('button[data-t]'); if (!b) return; setKind(b.getAttribute('data-t')); sync(); });
    $$('pk-draft-x').addEventListener('click', function () { editing.draft = null; fill(editing); $$('pk-draft').hidden = true; baseSig = sigOf(editing); sync(); render(); toast('Taslak silindi'); });
    $$('pk-save').addEventListener('click', function () {
      if ($$('pk-save').disabled || problem() !== null) return;
      var d = collect();
      if (!editing) { d.id = nextId++; d.arc = false; d.act = 0; d.sold = 0; d.ver = 1; d.hist = [{ v: 1, d: '4 Kas', note: 'İlk yayın', ch: [] }]; PKS.unshift(d); toast('Paket eklendi'); closeSheet(); render(); return; }
      if (commChanged()) { prepPub(d); view(2); return; }
      editing.n = d.n; editing.on = d.on; closeSheet(); render(); toast('Paket güncellendi');
    });
    /* Sürüm yayını: etki -> onay -> yayın */
    var pubD = null;
    function prepPub(d) {
      pubD = d; var ch = diff(editing, d), p = editing;
      $$('pk-pub-ch').innerHTML = ch.map(function (c) { return '<li><span class="ch" style="color:var(--foreground)">' + esc(c) + '</span></li>'; }).join('');
      var rows = [['Yeni sürüm', 'v' + p.ver + ' → v' + (p.ver + 1), 'Bundan sonraki satışlar v' + (p.ver + 1) + ' ile yapılır.'], ['Mevcut haklar', p.act + ' üye', p.act ? 'Eski sürümle (v' + p.ver + ') sürer, değişmez.' : 'Aktif hak yok, etkilenen üye yok.']];
      if (ch.some(function (c) { return c.indexOf('Dondurma') === 0; })) rows.push(['Dondurma', 'Yalnız yeni satışlar', 'Dondurulmuş ya da dondurma planlı haklar aynen kalır.']);
      if (ch.some(function (c) { return c.indexOf('Kullanım') === 0; })) rows.push(['Kullanım sınırı', 'Yeni haklarda', 'Mevcut haklarda eski sınır geçerli.']);
      if (ch.some(function (c) { return c.indexOf('Negatif') === 0; })) rows.push(['Negatif ders değeri', 'Yeni kullanımda', 'Kullanılmış negatif dersler eski değerle kalır.']);
      $$('pk-pub-eff').innerHTML = rows.map(function (r) { return '<li><span class="row-l"><span>' + r[0] + '</span><b class="tnum">' + r[1] + '</b></span><span class="ch">' + r[2] + '</span></li>'; }).join('');
      $$('pk-pub-ok').checked = false; $$('pk-pub-note').value = ''; $$('pk-go').disabled = true;
    }
    $$('pk-pub-ok').addEventListener('change', function () { $$('pk-go').disabled = !$$('pk-pub-ok').checked; });
    $$('pk-back').addEventListener('click', function () { view(1); sync(); });
    $$('pk-draftsave').addEventListener('click', function () { editing.draft = pubD; closeSheet(); render(); toast('Taslak saklandı, satışta v' + editing.ver + ' sürüyor'); });
    $$('pk-go').addEventListener('click', function () {
      if ($$('pk-go').disabled) return; var p = editing, ch = diff(p, pubD);
      Object.assign(p, pubD, { on: pubD.on }); p.ver++; p.draft = null;
      p.hist.unshift({ v: p.ver, d: '4 Kas', note: $$('pk-pub-note').value.trim(), ch: ch });
      closeSheet(); render(); toast(p.n + ' v' + p.ver + ' yayınlandı');
    });

    /* Arşivle diyaloğu */
    var dlg = $$('pk-dlg'), dsc = $$('pk-dscrim');
    function closeDlg() { dlg.hidden = true; dsc.hidden = true; }
    $$('pk-arc').addEventListener('click', function () {
      if (!editing) return;
      if (editing.arc) { editing.arc = false; closeSheet(); render(); toast('Paket arşivden çıkarıldı, satışa kapalı'); return; }
      $$('pk-dlg-title').textContent = 'Paketi arşivle';
      $$('pk-dlg-sub').textContent = editing.n + ' satıştan kalkar' + (editing.act ? '. ' + editing.act + ' üyenin mevcut hakları sürer.' : '.');
      dlg.hidden = false; dsc.hidden = false; $$('pk-dlg-ok').focus();
    });
    $$('pk-dlg-cancel').addEventListener('click', closeDlg); dsc.addEventListener('click', closeDlg);
    $$('pk-dlg-ok').addEventListener('click', function () { editing.arc = true; editing.on = false; closeDlg(); closeSheet(); render(); toast('Paket arşivlendi'); });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (!dlg.hidden) closeDlg(); else if (!sheet.hidden) closeSheet();
    });

    /* Liste */
    $$('pk-body').addEventListener('click', function (e) {
      var sw = e.target.closest('[data-sw]');
      if (sw) {
        var p = PKS.filter(function (x) { return x.id === +sw.getAttribute('data-sw'); })[0];
        p.on = sw.checked; render(); toast(p.on ? p.n + ' satışa açıldı' : p.n + ' satışa kapatıldı'); return;
      }
      var tr = e.target.closest('tr[data-id]'); if (!tr) return;
      openSheet(PKS.filter(function (x) { return x.id === +tr.getAttribute('data-id'); })[0]);
    });
    $$('pk-body').addEventListener('keydown', function (e) {
      if (e.target.closest('[data-sw]')) return;
      var tr = e.target.closest('tr[data-id]'); if (!tr || (e.key !== 'Enter' && e.key !== ' ')) return;
      e.preventDefault(); openSheet(PKS.filter(function (x) { return x.id === +tr.getAttribute('data-id'); })[0]);
    });
    $$('pk-search').addEventListener('input', render);
    $$('pk-filter').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-f]'); if (!b) return; fil = b.getAttribute('data-f');
      $$('pk-filter').querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); render();
    });
    render(); swap($$('pk-sheet')); swap(document.querySelector('[data-view="paketler"]'));
  })();

  /* ---------- Finans (kurgusal veri, Üyeler'deki paketlerle tutarlı) ---------- */
  (function () {
    var $$ = function (id) { return document.getElementById(id); };
    var money = function (n) { return '₺' + String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); };
    var MON = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
    var TODAY = new Date(2026, 10, 4);
    function dl(n) { var d = new Date(2026, 9, 1 + n); return d.getDate() + ' ' + MON[d.getMonth()]; }
    function isNov(n) { return new Date(2026, 9, 1 + n).getMonth() === 10; }
    var M = {
      cem: 'Cem Demir', selin: 'Selin Aksoy', burak: 'Burak Kaya', merve: 'Merve Tan', derya: 'Derya Sönmez', ece: 'Ece Mutlu',
      kerem: 'Kerem Zorlu', nehir: 'Nehir Gür', tolga: 'Tolga Yıldız', emre: 'Emre Vural'
    };
    var R = [], rid = 1;
    function sale(n, u, item, a) { R.push({ id: rid++, n: n, u: u, k: 's', m: item, a: a, void: false }); }
    function pay(n, u, method, a) { R.push({ id: rid++, n: n, u: u, k: 't', m: method, a: a, void: false, why: '' }); }
    sale(4, 'derya', '12 derslik paket', 1800); pay(4, 'derya', 'Kart', 1800);
    sale(11, 'tolga', '8 derslik paket', 1200); pay(11, 'tolga', 'Nakit', 1200);
    sale(14, 'burak', '12 derslik paket', 1800); pay(14, 'burak', 'Kart', 1800);
    sale(0, 'selin', '8 derslik paket', 1200); pay(0, 'selin', 'Nakit', 1200);
    sale(0, 'kerem', '8 derslik paket', 1200); pay(0, 'kerem', 'Nakit', 750);
    sale(0, 'emre', 'Aylık sınırsız', 1500); pay(0, 'emre', 'Havale', 1500);
    sale(29, 'nehir', '12 derslik paket', 1800); pay(29, 'nehir', 'Kart', 1800);
    sale(31, 'cem', 'Aylık sınırsız', 1500); pay(31, 'cem', 'Kart', 1500);
    sale(31, 'merve', 'Aylık sınırsız', 1500); pay(31, 'merve', 'Havale', 1500);
    sale(32, 'ece', 'Aylık sınırsız', 1500); pay(32, 'ece', 'Nakit', 1500);
    R.push({ id: rid++, n: 20, u: 'kerem', k: 'r', m: 'İade: Salsa atölyesi', a: 300, void: false, sign: '-' });
    var N0 = R.length;
    R.sort(function (a, b) { return b.n - a.n || b.id - a.id; });

    var fil = 'all', cur = null, voiding = null;
    var DD = {}, CC = { kerem: 300 };
    var REM = { derya: [7, 12, 1], tolga: [6, 8, 0], burak: [9, 12, 1], selin: [5, 8, 1], kerem: [4, 8, 0], emre: [0, 30, 0], nehir: [10, 12, 2], cem: [27, 30, 0], merve: [27, 30, 1], ece: [11, 30, 0] };
    function base(u) { return R.reduce(function (s, r) { return r.u !== u || r.void || (r.k !== 's' && r.k !== 't') ? s : s + (r.k === 's' ? r.a : -r.a); }, 0); }
    function net(u) { return base(u) + (DD[u] || 0); }
    function debtOf(u) { return Math.max(0, net(u)); }
    function creditOf(u) { return Math.max(0, -net(u)) + (CC[u] || 0); }
    function debtors() { return Object.keys(M).map(function (u) { return { u: u, d: debtOf(u) }; }).filter(function (x) { return x.d > 0; }); }
    function creditors() { return Object.keys(M).map(function (u) { return { u: u, c: creditOf(u) }; }).filter(function (x) { return x.c > 0; }); }

    function kpis() {
      var nov = R.filter(function (r) { return !r.void && isNov(r.n); });
      var s = nov.filter(function (r) { return r.k === 's'; }).reduce(function (a, r) { return a + r.a; }, 0) - nov.filter(function (r) { return r.k === 'r'; }).reduce(function (a, r) { return a + r.a; }, 0);
      var t = nov.filter(function (r) { return r.k === 't'; }).reduce(function (a, r) { return a + r.a; }, 0);
      var ds = debtors(), cs = creditors(), tot = ds.reduce(function (a, x) { return a + x.d; }, 0);
      function k(l, v, sub, c) { return '<div class="kpi card"><span class="l">' + l + '</span><b class="tnum ' + (c || '') + '">' + v + '</b><span class="sub">' + sub + '</span></div>'; }
      $$('fn-kpi').innerHTML = k('Kasım satış', money(s), 'Paket ve etkinlik, iade düşülmüş') + k('Kasım tahsilat', money(t), 'Alınan ödeme', 'pos-n') +
        k('Açık borç', money(tot), ds.length + ' üyede, tahsilat bekliyor', tot ? 'debt' : '') + k('Üye alacağı', money(cs.reduce(function (a, x) { return a + x.c; }, 0)), cs.length + ' üyeye iade ya da mahsup');
      $$('fn-pill').textContent = ds.length; $$('fn-apill').textContent = cs.length;
    }
    function render() {
      var q = $$('fn-search').value.trim().toLocaleLowerCase('tr'), me = $$('fn-method').value;
      var rows = R.filter(function (r) {
        return (fil === 'all' || (fil === 'o' ? r.k !== 's' && r.k !== 't' : r.k === fil)) && M[r.u].toLocaleLowerCase('tr').indexOf(q) > -1 && (!me || (r.k === 't' && r.m === me));
      });
      var KN = { s: 'Satış', t: 'Tahsilat', r: 'Satış iadesi', c: 'Nakit iade', m: 'Mahsup', d: 'Borç düzeltme' };
      $$('fn-body').innerHTML = rows.map(function (r) {
        var tah = r.k === 't', sgn = tah ? '+' : r.k === 's' || r.k === 'm' ? '' : (r.sign || ''), act = '';
        if (r.k === 's' && !r.void && !r.refunded && !r.ev) act = '<button type="button" class="btn ghost sm" data-refund="' + r.id + '">İade</button>';
        if (tah && !r.void) act = '<button type="button" class="btn ghost sm" data-corr="' + r.id + '">Düzelt</button><button type="button" class="btn ghost sm" data-void="' + r.id + '">İptal et</button>';
        return '<tr class="' + (r.void ? 'void' : '') + '"><td class="tnum">' + dl(r.n) + '</td><td>' + M[r.u] + '</td><td>' + KN[r.k] + (r.void ? ' <span class="badge soft" title="' + (r.why || '').replace(/"/g, '&quot;') + '">İptal edildi</span>' : '') + (r.refunded ? ' <span class="badge soft">İade edildi</span>' : '') + (r.corr ? ' <span class="badge soft" title="' + r.corr + '">Düzeltildi</span>' : '') + '</td>' +
          '<td class="muted">' + r.m + (r.note ? ' · ' + r.note : '') + '</td><td class="r tnum amt ' + (tah && !r.void ? 'pos' : '') + '">' + sgn + money(r.a) + '</td>' +
          '<td class="act">' + act + '</td></tr>';
      }).join('') || '<tr><td colspan="6" class="muted" style="padding:32px 0;text-align:center">Bu filtreye uygun kayıt yok.</td></tr>';
      $$('fn-count').textContent = rows.length + ' kayıt gösteriliyor';
      var ds = debtors().sort(function (a, b) { return b.d - a.d; });
      $$('fn-debt').innerHTML = ds.map(function (x) {
        var last = R.filter(function (r) { return r.u === x.u && r.k === 's' && !r.void; })[0];
        return '<tr><td>' + M[x.u] + '</td><td class="muted tnum">' + (last ? last.m + ' · ' + dl(last.n) : '-') + '</td><td class="r tnum"><span class="debt">' + money(x.d) + '</span></td><td class="act"><button type="button" class="btn outline sm" data-collect="' + x.u + '">Tahsilat al</button> <button type="button" class="btn ghost sm" data-adj="' + x.u + '">Borç düzelt</button></td></tr>';
      }).join('') || '<tr><td colspan="4" class="muted" style="padding:32px 0;text-align:center">Açık borç yok.</td></tr>';
      $$('fn-dsum').textContent = ds.length ? ds.length + ' üyede toplam ' + money(ds.reduce(function (a, x) { return a + x.d; }, 0)) + ' açık borç' : 'Tüm üyelerin borcu kapalı';
      var cs = creditors().sort(function (a, b) { return b.c - a.c; });
      $$('fn-cred').innerHTML = cs.map(function (x) {
        var d = debtOf(x.u);
        return '<tr><td>' + M[x.u] + '</td><td class="r tnum pos">' + money(x.c) + '</td><td class="tnum">' + (d ? '<span class="debt">' + money(d) + '</span>' : '<span class="muted">-</span>') + '</td><td class="act"><button type="button" class="btn outline sm" data-cb="' + x.u + '">Nakit iade</button> <button type="button" class="btn outline sm" data-off="' + x.u + '"' + (d ? '' : ' disabled title="Mahsup edilecek borç yok"') + '>Borca mahsup</button></td></tr>';
      }).join('') || '<tr><td colspan="4" class="muted" style="padding:32px 0;text-align:center">Üye alacağı yok.</td></tr>';
      $$('fn-csum').textContent = cs.length ? cs.length + ' üyede toplam ' + money(cs.reduce(function (a, x) { return a + x.c; }, 0)) + ' alacak' : 'Alacak yok';
      kpis();
    }

    /* Etkinlik köprüsü: etkinlik kaydı ödemesi Finans ve üye kaydına yazılır */
    function keyOf(name) { var k = Object.keys(M).filter(function (x) { return M[x] === name; })[0]; if (!k) { k = 'x' + Object.keys(M).length; M[k] = name; } return k; }
    function sortR() { var so = R.slice().sort(function (a, b) { return b.n - a.n || b.id - a.id; }); R.length = 0; so.forEach(function (r) { R.push(r); }); }
    SHARED.finEvent = function (o) {
      var u = keyOf(o.n), n = o.day == null ? Math.round((TODAY - new Date(2026, 9, 1)) / 864e5) : o.day, m = SHARED.stu().filter(function (x) { return x.n === o.n; })[0], lab = 'Etkinlik: ' + o.title, dstr = new Date(2026, 9, 1 + n).getDate() + ' ' + MON[new Date(2026, 9, 1 + n).getMonth()];
      if (o.how === 'paid' || o.how === 'due') {
        R.push({ id: rid++, n: n, u: u, k: 's', m: lab, a: o.a, void: false, ev: o.title });
        if (o.how === 'paid') { R.push({ id: rid++, n: n, u: u, k: 't', m: o.m || 'Havale', a: o.a, void: false, why: '', note: o.title, ev: o.title }); if (m) m.pay.unshift({ d: dstr, t: 'Etkinlik ödemesi', m: o.title + ' · ' + (o.m || 'Havale'), a: o.a }); }
        else if (m) m.debt = (m.debt || 0) + o.a;
      } else if (o.how === 'cancel-paid') {
        CC[u] = (CC[u] || 0) + o.a; R.push({ id: rid++, n: n, u: u, k: 'r', m: 'İade: ' + o.title, a: o.a, void: false, sign: '-', note: 'Etkinlik kaydı iptali, alacak', ev: o.title });
        if (m) m.cr = (m.cr || 0) + o.a;
      } else if (o.how === 'cancel-due') {
        R.forEach(function (r) { if (r.u === u && r.ev === o.title && r.k === 's' && !r.void) { r.void = true; r.why = 'Etkinlik kaydı iptal edildi'; } });
        if (m) m.debt = Math.max(0, (m.debt || 0) - o.a);
      }
      sortR(); if (SHARED.refreshMembers) SHARED.refreshMembers(); if ($$('fn-body')) render();
    };

    /* Tahsilat çekmecesi */
    var sheet = $$('fn-sheet'), scrim = $$('fn-scrim'), opener = null;
    function amt() { return Math.round(+$$('fn-amt').value.replace(/\D/g, '')) || 0; }
    function hint() { var d = debtOf($$('fn-uye').value); $$('fn-debt-hint').textContent = d > 0 ? 'Açık borç ' + money(d) : 'Açık borç yok, tutar peşin ödeme olarak kaydedilir'; }
    function open(u) {
      opener = document.activeElement;
      $$('fn-uye').innerHTML = Object.keys(M).map(function (k) { var d = debtOf(k); return '<option value="' + k + '">' + M[k] + (d > 0 ? ' · borç ' + money(d) : '') + '</option>'; }).join('');
      var ds = debtors(); $$('fn-uye').value = u || (ds[0] ? ds[0].u : 'cem');
      $$('fn-amt').value = debtOf($$('fn-uye').value) > 0 ? debtOf($$('fn-uye').value) : ''; $$('fn-note').value = '';
      $$('fn-m').querySelectorAll('button').forEach(function (b, i) { b.setAttribute('aria-pressed', String(i === 0)); });
      hint(); $$('fn-save').disabled = !amt(); sheet.hidden = false; scrim.hidden = false; $$('fn-amt').focus();
    }
    function close() { sheet.hidden = true; scrim.hidden = true; if (opener) opener.focus(); }
    $$('fn-add').addEventListener('click', function () { open(null); });
    $$('fn-x').addEventListener('click', close); $$('fn-cancel').addEventListener('click', close); scrim.addEventListener('click', close);
    $$('fn-form').addEventListener('submit', function (e) { e.preventDefault(); });
    $$('fn-uye').addEventListener('change', function () { var d = debtOf($$('fn-uye').value); $$('fn-amt').value = d > 0 ? d : ''; hint(); $$('fn-save').disabled = !amt(); });
    $$('fn-amt').addEventListener('input', function () { $$('fn-save').disabled = !amt(); });
    $$('fn-m').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) this.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); });
    $$('fn-save').addEventListener('click', function () {
      if (!amt()) return;
      var u = $$('fn-uye').value, m = $$('fn-m').querySelector('[aria-pressed="true"]').textContent, nt = $$('fn-note').value.trim();
      var n = Math.round((TODAY - new Date(2026, 9, 1)) / 864e5);
      R.unshift({ id: rid++, n: n, u: u, k: 't', m: m, a: amt(), void: false, why: '', note: nt });
      var sorted = R.slice().sort(function (a, b) { return b.n - a.n || b.id - a.id; }); R.length = 0; sorted.forEach(function (r) { R.push(r); });
      close(); render(); toast(money(amt()) + ' tahsilat kaydedildi, ' + M[u]);
    });


    /* İade, düzeltme, mahsup çekmecesi */
    var fx = null, fxs = $$('fx-sheet'), fxsc = $$('fx-scrim'), fxop = null;
    function eff(rows) { return '<div><p class="sub">Etki</p><ul class="aff" id="fx-eff">' + rows.map(function (r) { return '<li><span class="row-l"><span>' + r[0] + '</span><b class="tnum">' + r[1] + '</b></span>' + (r[2] ? '<span class="ch">' + r[2] + '</span>' : '') + '</li>'; }).join('') + '</ul></div>'; }
    function why() { return '<div class="field"><label class="label" for="fx-why">Gerekçe<span class="hint">Zorunlu</span></label><textarea class="input" id="fx-why" rows="2" placeholder="Örn. Üye paketi bıraktı"></textarea><span class="hint">Kayıt silinmez, hareket geçmişine düşer.</span></div>'; }
    function fxMethod(list) { return '<div class="field"><span class="label">Yöntem</span><div class="seg" role="group" aria-label="Yöntem" id="fx-m">' + list.map(function (m, i) { return '<button type="button" aria-pressed="' + (i === 0) + '">' + m + '</button>'; }).join('') + '</div></div>'; }
    function refundable(r) { var v = REM[r.u] || [0, 1, 0]; return Math.round(r.a * v[0] / v[1]); }
    function openFx(mode, ctx) {
      fxop = document.activeElement; fx = { mode: mode, ctx: ctx }; var b = $$('fx-body'), ok = $$('fx-ok');
      if (mode === 'refund') {
        var r = ctx, mx = refundable(r), v = REM[r.u] || [0, 1, 0];
        $$('fx-title').textContent = 'Satışı iade et'; $$('fx-sub').textContent = M[r.u] + ' · ' + r.m + ', ' + dl(r.n) + ', ' + money(r.a); ok.textContent = 'İadeyi uygula';
        b.innerHTML = '<div class="field"><label class="label" for="fx-amt">İade tutarı<span class="hint">en çok ' + money(mx) + ', kullanılmayan hak oranında</span></label><input class="input tnum" id="fx-amt" inputmode="numeric" value="' + mx + '" style="max-width:9rem"></div>' + why() + '<div id="fx-e"></div><p class="note" id="fx-err" style="color:var(--destructive)" hidden></p>';
      } else if (mode === 'corr') {
        var t = ctx; $$('fx-title').textContent = 'Tahsilatı düzelt'; $$('fx-sub').textContent = M[t.u] + ' · ' + dl(t.n) + ', ' + t.m + ', ' + money(t.a); ok.textContent = 'Düzeltmeyi uygula';
        b.innerHTML = '<div class="field"><label class="label" for="fx-amt">Doğru tutar<span class="hint">₺</span></label><input class="input tnum" id="fx-amt" inputmode="numeric" value="' + t.a + '" style="max-width:9rem"></div>' + fxMethod(['Nakit', 'Kart', 'Havale']) + why() + '<div id="fx-e"></div><p class="note" id="fx-err" style="color:var(--destructive)" hidden></p>';
        b.querySelectorAll('#fx-m button').forEach(function (x) { x.setAttribute('aria-pressed', String(x.textContent === t.m)); });
      } else if (mode === 'cb') {
        var c = creditOf(ctx); $$('fx-title').textContent = 'Nakit iade'; $$('fx-sub').textContent = M[ctx] + ' · alacak ' + money(c); ok.textContent = 'İadeyi kaydet';
        b.innerHTML = '<div class="field"><label class="label" for="fx-amt">Tutar<span class="hint">en çok ' + money(c) + '</span></label><input class="input tnum" id="fx-amt" inputmode="numeric" value="' + c + '" style="max-width:9rem"></div>' + fxMethod(['Nakit', 'Havale']) + why() + '<div id="fx-e"></div><p class="note" id="fx-err" style="color:var(--destructive)" hidden></p>';
      } else if (mode === 'off') {
        var mo = Math.min(creditOf(ctx), debtOf(ctx)); $$('fx-title').textContent = 'Borca mahsup'; $$('fx-sub').textContent = M[ctx] + ' · alacak ' + money(creditOf(ctx)) + ', borç ' + money(debtOf(ctx)); ok.textContent = 'Mahsup et';
        b.innerHTML = '<div class="field"><label class="label" for="fx-amt">Tutar<span class="hint">en çok ' + money(mo) + '</span></label><input class="input tnum" id="fx-amt" inputmode="numeric" value="' + mo + '" style="max-width:9rem"></div><div class="field"><label class="label" for="fx-note">Not<span class="hint">İsteğe bağlı</span></label><input class="input" id="fx-note"></div><div id="fx-e"></div><p class="note" id="fx-err" style="color:var(--destructive)" hidden></p>';
      } else {
        $$('fx-title').textContent = 'Borcu düzelt'; $$('fx-sub').textContent = M[ctx] + ' · açık borç ' + money(debtOf(ctx)); ok.textContent = 'Düzeltmeyi kaydet';
        b.innerHTML = '<div class="field"><span class="label">İşlem</span><div class="seg" role="group" aria-label="İşlem" id="fx-m"><button type="button" aria-pressed="true">Borcu azalt</button><button type="button" aria-pressed="false">Borcu artır</button></div></div><div class="field"><label class="label" for="fx-amt">Tutar<span class="hint">₺</span></label><input class="input tnum" id="fx-amt" inputmode="numeric" value="" style="max-width:9rem"></div>' + why() + '<div id="fx-e"></div><p class="note" id="fx-err" style="color:var(--destructive)" hidden></p>';
      }
      fxs.hidden = false; fxsc.hidden = false; updFx(); (b.querySelector('#fx-amt') || b.querySelector('textarea')).focus();
    }
    function fxv() { return Math.round(+($$('fx-amt').value || '0').replace(/\D/g, '')) || 0; }
    function fxm() { var e = $$('fx-m'); return e ? e.querySelector('[aria-pressed="true"]').textContent : ''; }
    function updFx() {
      var m = fx.mode, c = fx.ctx, v = fxv(), rows = [], ok = v > 0, err = '', w = $$('fx-why') ? !!$$('fx-why').value.trim() : true;
      if (m === 'refund') {
        var mx = refundable(c), u = c.u, D = debtOf(u), C = creditOf(u), dd = Math.min(D, v), nc = C + v - dd, rm = REM[u];
        if (v > mx) { ok = false; err = 'İade tutarı en çok ' + money(mx) + ' olabilir.'; }
        rows = [['İade tutarı', money(v), 'Kullanılmayan hak oranı ' + rm[0] + '/' + rm[1] + ' üzerinden.'], ['Açık borç', money(D) + ' → ' + money(D - dd), dd ? 'İade önce açık borçtan düşer.' : ''], ['Üye alacağı', money(C) + ' → ' + money(nc), nc > C ? 'Kalan tutar alacak olur, nakit iade ya da mahsup edilebilir.' : ''], ['Hak', rm[0] ? rm[0] + (rm[1] >= 30 ? ' günlük süre' : ' ders') + ' kapanır' : 'Kalan hak yok', rm[2] ? rm[2] + ' yaklaşan rezervasyon iptal edilir.' : 'Yaklaşan rezervasyon yok.']];
        ok = ok && w;
      } else if (m === 'corr') {
        var u2 = c.u, D0 = debtOf(u2), C0 = creditOf(u2), old = c.a; c.a = v || old; var D1 = debtOf(u2), C1 = creditOf(u2); c.a = old;
        rows = [['Tahsilat', money(old) + ' → ' + money(v), fxm() !== c.m ? 'Yöntem: ' + c.m + ' → ' + fxm() : 'Yöntem aynı.'], ['Açık borç', money(D0) + ' → ' + money(D1)], ['Üye alacağı', money(C0) + ' → ' + money(C1), C1 > C0 ? 'Fazla tutar alacak olarak kalır.' : '']];
        ok = ok && w && (v !== c.a || fxm() !== c.m);
      } else if (m === 'cb') {
        var Cc = creditOf(c); if (v > Cc) { ok = false; err = 'Alacak ' + money(Cc) + ', daha fazlası iade edilemez.'; }
        rows = [['İade', money(v), fxm() + ' ile ödenir.'], ['Üye alacağı', money(Cc) + ' → ' + money(Math.max(0, Cc - v))]]; ok = ok && w;
      } else if (m === 'off') {
        var mo = Math.min(creditOf(c), debtOf(c)); if (v > mo) { ok = false; err = 'En çok ' + money(mo) + ' mahsup edilebilir.'; }
        rows = [['Mahsup', money(v)], ['Açık borç', money(debtOf(c)) + ' → ' + money(Math.max(0, debtOf(c) - v))], ['Üye alacağı', money(creditOf(c)) + ' → ' + money(Math.max(0, creditOf(c) - v)), 'Nakit hareketi oluşmaz.']];
      } else {
        var Dd = debtOf(c), dec = fxm() === 'Borcu azalt'; if (dec && v > Dd) { ok = false; err = 'Borç ' + money(Dd) + ', daha fazlası düşülemez.'; }
        rows = [['Açık borç', money(Dd) + ' → ' + money(dec ? Math.max(0, Dd - v) : Dd + v), dec ? 'Tahsilat değil, borç kaydı düzeltilir.' : 'Gerekçeli ek borç kaydı.']]; ok = ok && w;
      }
      $$('fx-e').innerHTML = eff(rows); var er = $$('fx-err'); er.hidden = !err; er.textContent = err; $$('fx-ok').disabled = !ok;
    }
    function closeFx() { fxs.hidden = true; fxsc.hidden = true; fx = null; if (fxop) fxop.focus(); }
    function addRec(u, k, m, a, sign, note) { var n = Math.round((TODAY - new Date(2026, 9, 1)) / 864e5); R.push({ id: rid++, n: n, u: u, k: k, m: m, a: a, void: false, sign: sign, note: note }); R.sort(function (a, b) { return b.n - a.n || b.id - a.id; }); }
    $$('fx-body').addEventListener('input', function () { if (fx) updFx(); });
    $$('fx-body').addEventListener('click', function (e) { var bt = e.target.closest('#fx-m button'); if (bt) { bt.parentNode.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === bt)); }); updFx(); } });
    $$('fx-x').addEventListener('click', closeFx); $$('fx-cancel').addEventListener('click', closeFx); fxsc.addEventListener('click', closeFx);
    $$('fx-ok').addEventListener('click', function () {
      if (!fx || $$('fx-ok').disabled) return; var m = fx.mode, c = fx.ctx, v = fxv(), wy = $$('fx-why') ? $$('fx-why').value.trim() : '', msg;
      if (m === 'refund') {
        var u = c.u, D = debtOf(u), dd = Math.min(D, v); DD[u] = (DD[u] || 0) - dd; CC[u] = (CC[u] || 0) + (v - dd); c.refunded = true;
        addRec(u, 'r', 'İade: ' + c.m, v, '-', wy); msg = money(v) + ' iade uygulandı, ' + M[u];
      } else if (m === 'corr') {
        var old = c.a; c.corr = money(old) + ' → ' + money(v) + ' · ' + wy; c.a = v; c.m = fxm(); msg = 'Tahsilat düzeltildi, ' + M[c.u];
      } else if (m === 'cb') {
        var x = Math.min(CC[c] || 0, v); CC[c] = (CC[c] || 0) - x; DD[c] = (DD[c] || 0) + (v - x);
        addRec(c, 'c', 'Alacak iadesi · ' + fxm(), v, '-', wy); msg = money(v) + ' nakit iade kaydedildi';
      } else if (m === 'off') {
        CC[c] = (CC[c] || 0) - v; DD[c] = (DD[c] || 0) - v; addRec(c, 'm', 'Alacak borca mahsup', v, '', ($$('fx-note').value || '').trim()); msg = money(v) + ' borca mahsup edildi';
      } else {
        var dec = fxm() === 'Borcu azalt'; DD[c] = (DD[c] || 0) + (dec ? -v : v); addRec(c, 'd', dec ? 'Borç azaltıldı' : 'Borç artırıldı', v, dec ? '-' : '+', wy); msg = 'Borç düzeltmesi kaydedildi';
      }
      closeFx(); render(); toast(msg);
    });

    /* İptal diyaloğu: gerekçe zorunlu */
    var dlg = $$('fn-dlg'), dsc = $$('fn-dscrim');
    function closeDlg() { dlg.hidden = true; dsc.hidden = true; voiding = null; }
    $$('fn-why').addEventListener('input', function () { $$('fn-dlg-ok').disabled = !$$('fn-why').value.trim(); });
    $$('fn-dlg-cancel').addEventListener('click', closeDlg); dsc.addEventListener('click', closeDlg);
    $$('fn-dlg-ok').addEventListener('click', function () {
      if (!voiding) return; voiding.void = true; voiding.why = $$('fn-why').value.trim(); var r = voiding; closeDlg(); render();
      toast('Tahsilat iptal edildi, ' + money(r.a) + ' ' + M[r.u] + ' borcuna eklendi');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (!dlg.hidden) closeDlg(); else if (fx) closeFx(); else if (!sheet.hidden) close();
    });

    /* Liste ve sekmeler */
    document.querySelector('[data-view="finans"]').addEventListener('click', function (e) {
      var v = e.target.closest('[data-void]'), c = e.target.closest('[data-collect]'), t = e.target.closest('[data-ftab]');
      var byId = function (a) { return R.filter(function (r) { return r.id === +a; })[0]; };
      var q1 = e.target.closest('[data-refund]'), q2 = e.target.closest('[data-corr]'), q3 = e.target.closest('[data-cb]'), q4 = e.target.closest('[data-off]'), q5 = e.target.closest('[data-adj]');
      if (q1) openFx('refund', byId(q1.getAttribute('data-refund')));
      if (q2) openFx('corr', byId(q2.getAttribute('data-corr')));
      if (q3) openFx('cb', q3.getAttribute('data-cb'));
      if (q4 && !q4.disabled) openFx('off', q4.getAttribute('data-off'));
      if (q5) openFx('adj', q5.getAttribute('data-adj'));
      if (v) {
        voiding = R.filter(function (r) { return r.id === +v.getAttribute('data-void'); })[0];
        $$('fn-dlg-sub').textContent = M[voiding.u] + ', ' + dl(voiding.n) + ', ' + voiding.m + ', ' + money(voiding.a);
        $$('fn-why').value = ''; $$('fn-dlg-ok').disabled = true; dlg.hidden = false; dsc.hidden = false; $$('fn-why').focus();
      }
      if (c) open(c.getAttribute('data-collect'));
      if (t) {
        document.querySelectorAll('[data-ftab]').forEach(function (x) { x.setAttribute('aria-selected', String(x === t)); });
        document.querySelectorAll('[data-fpanel]').forEach(function (p) { p.hidden = p.getAttribute('data-fpanel') !== t.getAttribute('data-ftab'); });
      }
    });
    $$('fn-search').addEventListener('input', render); $$('fn-method').addEventListener('change', render);
    $$('fn-filter').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-f]'); if (!b) return; fil = b.getAttribute('data-f');
      $$('fn-filter').querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); render();
    });
    render(); swap($$('fn-sheet')); swap($$('fx-sheet')); swap(document.querySelector('[data-view="finans"]'));
  })();

  /* ---------- Gelen kutusu (kurgusal veri, Üyeler ve Finans ile tutarlı) ---------- */
  (function () {
    var $$ = function (id) { return document.getElementById(id); };
    var view = document.querySelector('[data-view="gelen-kutusu"]');
    var IT = [
      { id: 11, kind: 'Uyarı', title: 'Otomasyon kısmen tamamlandı: Yaklaşan dersi olmayan üyeye mesaj', time: '08:02', read: false, todo: true, done: false,
        body: 'Segmentteki 2 üyeden 1\'ine e-posta kabul edildi. Kerem Zorlu için e-posta sağlayıcısı geçici olarak yanıt vermedi. İş durdu, başarılı satır tekrar gönderilmez. Son işlerden yeniden deneyebilirsin.',
        ctx: [['Otomasyon', 'Yaklaşan dersi olmayan üyeye mesaj'], ['İş durumu', 'Kısmen tamamlandı'], ['E-posta kabulü', '1 / 2'], ['Yeniden deneme', 'Kullanılabilir']], acts: [['Son işleri aç', '#otomasyon']] },
      { id: 8, kind: 'Talep', title: 'Selin Aksoy özel ders talebi gönderdi', time: '10:05', read: false, todo: true, done: false,
        body: 'Selin Aksoy Cum 6 Kasım 16:00 - 17:00 için Deniz Y. ile bire bir ders istiyor. Talep onaylanana kadar kesin rezervasyon değildir.',
        ctx: [['Üye', 'Selin Aksoy'], ['İstenen zaman', 'Cum 6 Kas, 16:00 - 17:00'], ['Eğitmen', 'Deniz Y.'], ['Hak', '8 derslik paket, 5 hak kaldı']], acts: [['Talepleri aç', '#talepler']] },
      { id: 1, kind: 'İptal', title: 'Onur Çelik rezervasyonunu iptal etti', time: '19:12', read: false, todo: false, done: false,
        body: 'Onur Çelik, Pzt 9 Kasım 14:30 Arjantin tango teknik dersindeki yerini iptal etti. Ders başlamadan 5 gün önce iptal edildiği için hakkı iade edildi. Seansta 1 yer boşaldı.',
        ctx: [['Üye', 'Onur Çelik'], ['Seans', 'Arjantin tango teknik, Çar 14:30'], ['Kontenjan', '8 / 12'], ['Hak', 'İade edildi, 2 hak kullanılabilir']], acts: [['Seansı aç', '#seans']] },
      { id: 2, kind: 'Mesaj', title: 'Merve Tan', time: '17:48', read: false, todo: true, done: false, reply: true, sent: '',
        body: 'Merhaba, bu hafta Salı 19:00 dersine 15 dakika geç katılacağım. Kapıyı açık bırakabilir misiniz?',
        ctx: [['Üye', 'Merve Tan'], ['Hak', 'Aylık sınırsız, 30 Kasım\'a kadar'], ['Sıradaki ders', 'Sal 19:00']], acts: [] },
      { id: 3, kind: 'Uyarı', title: 'Kerem Zorlu için açık borç', time: '09:00', read: false, todo: true, done: false,
        body: '8 derslik paketin ₺450 tutarındaki kalanı 1 Ekim\'den beri tahsil edilmedi. Üyenin 4 hakkı duruyor.',
        ctx: [['Üye', 'Kerem Zorlu'], ['Paket', '8 derslik paket'], ['Açık borç', '₺450'], ['Hak', '4 kaldı']], acts: [['Finansa git', '#finans']] },
      { id: 4, kind: 'Uyarı', title: 'Bachata orta dolu', time: 'Dün', read: false, todo: true, done: false,
        body: 'Cum 6 Kasım 19:00 Bachata orta seansı 12 / 12 doldu. Bekleme listesinde kimse yok. Kontenjanı artırmak ya da ikinci bir seans eklemek isteyebilirsin.',
        ctx: [['Seans', 'Bachata orta, Cum 19:00'], ['Salon', 'Salon B, oda sınırı 12'], ['Kontenjan', '12 / 12']], acts: [['Programı aç', '#program']] },
      { id: 5, kind: 'Uyarı', title: 'Onur Çelik\'in hakkı azaldı', time: 'Dün', read: true, todo: true, done: false,
        body: '8 derslik paketten 2 hak kaldı, 1 hak bir rezervasyona ayrılmış durumda. Hak bitince üye yeni rezervasyon yapamaz.',
        ctx: [['Üye', 'Onur Çelik'], ['Paket', '8 derslik paket, 20 Aralık\'a kadar'], ['Kullanılabilir', '2 hak']], acts: [['Üyelere git', '#uyeler']] },
      { id: 6, kind: 'Bilgi', title: 'Ece Mutlu daveti kabul etti', time: '2 Kas', read: true, todo: false, done: false,
        body: 'Ece Mutlu davetini kabul etti ve profilini tamamladı. Üye aktif, aylık sınırsız hakkı 15 Kasım\'da başlayacak.',
        ctx: [['Üye', 'Ece Mutlu'], ['Durum', 'Aktif'], ['Aktif üye', '10 / 100']], acts: [['Üyelere git', '#uyeler']] },
      { id: 7, kind: 'Bilgi', title: 'Cuma Salsa orta seansı iptal edildi', time: '30 Eki', read: true, todo: false, done: false,
        body: 'Cum 6 Kasım 18:00 Salsa orta seansı iptal edildi. Rezervasyonu olan üye yoktu, bildirim gönderilmedi.',
        ctx: [['Seans', 'Salsa orta, Cum 18:00'], ['Etkilenen üye', '0']], acts: [['Programı aç', '#program']] },
      { id: 9, kind: 'Bilgi', title: 'Yer teklifi kabul edildi: Cem Demir', time: '3 Kas', read: true, todo: false, done: false,
        body: 'Tolga Yıldız\'ın bıraktığı yer bekleme listesinden verildi. Emre Vural\'ın teklifi süresi doldu, Alp Demir reddetti, Cem Demir 3 Kasım 10:52\'de kabul etti.',
        ctx: [['Seans', 'Arjantin tango teknik, Çar 14:30'], ['Kategori', 'Erkek, 3 / 3'], ['Teklif sırası', 'Emre V., Alp D., Cem D.']], acts: [['Seansı aç', '#seans']] },
      { id: 10, kind: 'Uyarı', title: 'Bekleme listesinde teklif verilemeyen üye', time: '3 Kas', read: true, todo: true, done: false,
        body: 'Kerem Zorlu tango seansında sırada ama açık borcu var. Borç kapanana kadar teklif verilmez, yer açılınca sıradaki uygun üyeye geçilir.',
        ctx: [['Üye', 'Kerem Zorlu'], ['Sıra', '1. sıra'], ['Açık borç', '₺450']], acts: [['Finansa git', '#finans'], ['Seansı aç', '#seans']] }
    ];
    var fil = 'all', sel = 1;
    function byId(id) { return IT.filter(function (x) { return x.id === id; })[0]; }
    function unread() { return IT.filter(function (x) { return !x.read; }).length; }
    function counts() {
      var n = unread(), c = document.querySelector('[data-route="gelen-kutusu"] .count');
      if (c) { c.textContent = n; c.hidden = !n; }
    }
    function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
    function list() {
      var q = $$('ib-search').value.trim().toLocaleLowerCase('tr');
      var rows = IT.filter(function (x) {
        return (fil === 'all' || (fil === 'unread' && !x.read) || (fil === 'todo' && x.todo && !x.done)) && (x.title + ' ' + x.body).toLocaleLowerCase('tr').indexOf(q) > -1;
      });
      $$('ib-rows').innerHTML = rows.map(function (x) {
        var pv = x.reply ? x.body : x.body.split('. ')[0].replace(/\.$/, '');
        return '<button type="button" class="ib-row ' + (x.read ? 'read' : '') + '" data-id="' + x.id + '" aria-selected="' + (sel === x.id) + '"><span class="ib-dot" aria-hidden="true"></span>' +
          '<span><span class="ib-t">' + esc(x.title) + (x.read ? '' : '<span class="sr-only"> (okunmadı)</span>') + '</span><span class="ib-p">' + esc(pv) + '</span></span>' +
          '<span class="ib-meta"><span class="tnum">' + x.time + '</span>' + (x.todo && !x.done ? '<span class="badge">İşlem bekliyor</span>' : x.done ? '<span class="badge soft">Tamamlandı</span>' : '<span class="badge soft">' + x.kind + '</span>') + '</span></button>';
      }).join('') || '<p class="muted" style="padding:32px 20px;text-align:center">Bu süzgece uygun ileti yok.</p>';
      $$('ib-count').textContent = rows.length + ' ileti gösteriliyor, ' + unread() + ' okunmamış';
      counts();
    }
    function detail() {
      var x = byId(sel), d = $$('ib-detail');
      if (!x) { d.innerHTML = '<div class="card-c muted" style="padding:32px 20px;text-align:center">Okumak için bir ileti seç.</div>'; return; }
      var badges = '<span class="badge soft">' + x.kind + '</span>' + (x.todo ? (x.done ? '<span class="badge ok"><i data-i="check"></i>Tamamlandı</span>' : '<span class="badge">İşlem bekliyor</span>') : '');
      d.innerHTML = '<div class="card-h"><button type="button" class="back ib-back" id="ib-back"><i data-i="arrowleft"></i>Gelen kutusu</button><h2>' + esc(x.title) + '</h2><p class="tnum">' + x.time + '</p><div class="badges">' + badges + '</div></div>' +
        '<div class="card-c ib-body"><p class="ib-text ' + (x.reply ? 'ib-quote' : '') + '">' + esc(x.body) + '</p>' +
        '<dl class="kv" style="margin:0;grid-template-columns:7rem 1fr">' + x.ctx.map(function (c) { return '<dt>' + c[0] + '</dt><dd>' + esc(c[1]) + '</dd>'; }).join('') + '</dl>' +
        (x.reply ? (x.sent ? '<div class="ib-sent"><i data-i="check"></i><div><b style="font-weight:500">Yanıtladın</b><p class="muted">' + esc(x.sent) + '</p></div></div>' :
          '<div class="field"><label class="label" for="ib-reply">Yanıt<span class="hint">Üyeye e-postayla gider</span></label><textarea class="input" id="ib-reply" rows="3" placeholder="Yanıtını yaz"></textarea></div>') : '') + '</div>' +
        '<div class="card-f"><div style="display:flex;gap:8px;flex-wrap:wrap">' + x.acts.map(function (a) { return '<a class="btn outline sm" href="' + a[1] + '">' + a[0] + '</a>'; }).join('') +
        (x.todo && !x.done && !x.reply ? '<button type="button" class="btn sm" id="ib-done">İşlem tamamlandı</button>' : '') +
        (x.reply && !x.sent ? '<button type="button" class="btn sm" id="ib-send" disabled>Yanıtla</button>' : '') + '</div>' +
        '<button type="button" class="btn ghost sm" id="ib-unread">' + (x.read ? 'Okunmadı yap' : 'Okundu yap') + '</button></div>';
      swap(d);
    }
    function open(id, narrow) {
      sel = id; var x = byId(id); x.read = true; list(); detail();
      if (narrow) { view.classList.add('ib-open'); window.scrollTo(0, 0); }
    }
    $$('ib-rows').addEventListener('click', function (e) {
      var r = e.target.closest('.ib-row'); if (r) open(+r.getAttribute('data-id'), window.matchMedia('(max-width: 1180px)').matches);
    });
    $$('ib-detail').addEventListener('click', function (e) {
      var x = byId(sel); if (!x) return;
      if (e.target.closest('#ib-back')) { view.classList.remove('ib-open'); return; }
      if (e.target.closest('#ib-done')) { x.done = true; list(); detail(); toast('İşlem tamamlandı olarak işaretlendi'); }
      if (e.target.closest('#ib-send')) { var t = $$('ib-reply').value.trim(); if (!t) return; x.sent = t; x.done = true; list(); detail(); toast('Yanıt gönderildi, ' + x.title); }
      if (e.target.closest('#ib-unread')) { x.read = !x.read; list(); detail(); toast(x.read ? 'Okundu olarak işaretlendi' : 'Okunmadı olarak işaretlendi'); }
    });
    $$('ib-detail').addEventListener('input', function (e) { if (e.target.id === 'ib-reply') $$('ib-send').disabled = !e.target.value.trim(); });
    $$('ib-all').addEventListener('click', function () { IT.forEach(function (x) { x.read = true; }); list(); detail(); toast('Tüm iletiler okundu olarak işaretlendi'); });
    $$('ib-search').addEventListener('input', list);
    $$('ib-filter').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-f]'); if (!b) return; fil = b.getAttribute('data-f');
      $$('ib-filter').querySelectorAll('button').forEach(function (z) { z.setAttribute('aria-pressed', String(z === b)); }); list();
    });
    window.addEventListener('hashchange', function () { if (location.hash !== '#gelen-kutusu') view.classList.remove('ib-open'); });
    SHARED.ibDone = function (id) { var x = byId(id); if (x) { x.done = true; x.read = true; list(); detail(); } };
    byId(sel).read = true; list(); detail(); swap(view);
  })();

  /* ---------- Ayarlar (kurgusal veri; salonlar takvimle, üye sayısı Üyeler ile tutarlı) ---------- */
  (function () {
    var $$ = function (id) { return document.getElementById(id); };
    var view = document.querySelector('[data-view="ayarlar"]');

    /* Bölümler */
    var tabs = view.querySelectorAll('[data-stab]');
    tabs.forEach(function (t) {
      t.addEventListener('click', function () {
        tabs.forEach(function (x) { x.setAttribute('aria-selected', String(x === t)); });
        view.querySelectorAll('[data-spanel]').forEach(function (p) { p.hidden = p.getAttribute('data-spanel') !== t.getAttribute('data-stab'); });
      });
    });

    /* Tek kaydet çubuğu: değişiklik olunca açılır */
    function snap(form) {
      return Array.prototype.map.call(form.querySelectorAll('input:not([readonly]),select'), function (f) { return f.type === 'checkbox' ? String(f.checked) : f.value; });
    }
    var SECN = { 'ay-yayin': 'Yayın', 'ay-genel': 'Genel', 'ay-marka': 'Genel', 'ay-kural': 'Rezervasyon', 'ay-salon': 'Salonlar', 'ay-hat': 'Bildirimler' };
    function diffOf(form, a, b) {
      var out = [];
      form.querySelectorAll('input:not([readonly]),select').forEach(function (f, i) {
        if (a[i] === b[i]) return;
        var lab = f.id ? form.querySelector('label[for="' + f.id + '"]') : null, name = lab ? lab.childNodes[0].textContent.trim() : (f.getAttribute('aria-label') || f.id || 'Alan');
        function show(v) { if (f.type === 'checkbox') return v === 'true' ? 'Açık' : 'Kapalı'; if (f.tagName === 'SELECT') { var o = Array.prototype.filter.call(f.options, function (x) { return x.value === v; })[0]; return o ? o.text : v; } return v === '' ? 'boş' : v; }
        out.push(name + ': ' + show(a[i]) + ' → ' + show(b[i]));
      });
      return out;
    }
    function bind(form, check, msg, after) {
      var save = form.querySelector('[data-save]'), cancel = form.querySelector('[data-cancel]'), st = form.querySelector('[data-st]');
      var base = snap(form);
      function sync() {
        var d = snap(form).join('\u0001') !== base.join('\u0001'), ok = !check || check();
        save.disabled = !d || !ok; cancel.disabled = !d;
        st.textContent = !d ? 'Tüm değişiklikler kaydedildi' : ok ? 'Kaydedilmemiş değişiklikler var' : 'Değişiklikleri kaydetmeden önce hataları düzelt';
        st.classList.toggle('dirty', d);
      }
      form.addEventListener('input', sync); form.addEventListener('change', sync);
      form.addEventListener('submit', function (e) { e.preventDefault(); if (save.disabled) return; var nb = snap(form), dl = diffOf(form, base, nb); base = nb; sync(); if (after) after(); var rs = SHARED.resetNote ? SHARED.resetNote() : false; if (SHARED.hist) SHARED.hist(SECN[form.id] || 'Genel', (rs ? ['Varsayılana sıfırlandı'] : []).concat(dl)); toast(rs ? 'Varsayılana sıfırlandı' : msg); });
      cancel.addEventListener('click', function () {
        form.querySelectorAll('input:not([readonly]),select').forEach(function (f, i) { if (f.type === 'checkbox') f.checked = base[i] === 'true'; else f.value = base[i]; });
        sync();
      });
      sync(); return sync;
    }
    bind($$('ay-genel'), function () { return $$('ay-ad').value.trim() && /^\S+@\S+\.\S+$/.test($$('ay-posta').value.trim()); }, 'Stüdyo bilgileri kaydedildi', function () {
      var n = document.querySelector('.studio-txt b'); if (n) n.textContent = $$('ay-ad').value.trim();
      var s = document.querySelector('.studio-txt small'); if (s) s.textContent = $$('ay-sube').value.trim();
    });
    bind($$('ay-kural'), null, 'Rezervasyon kuralları kaydedildi');

    /* Yayın: herkese açık sayfa ayarları. Önizleme yalnızca kayıtlı ayarları gösterir */
    var PUBV = 2;
    function pubRead() { return { on: $$('ay-py-on').checked, slug: $$('ay-py-slug').value.trim(), ders: $$('ay-py-ders').checked, etk: $$('ay-py-etk').checked, egt: $$('ay-py-egt').checked, yer: $$('ay-py-yer').value, form: $$('ay-py-form').checked, cons: $$('ay-py-cons').value.trim(), ver: PUBV }; }
    var PUBC = pubRead();
    SHARED.pubCfg = function () { return PUBC; };
    function pubOk() {
      var s = $$('ay-py-slug').value.trim(), okS = /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s) && s.length >= 3 && s.length <= 40, c = $$('ay-py-cons').value.trim(), okC = !$$('ay-py-form').checked || c.length >= 20;
      $$('ay-py-slug-h').textContent = okS ? 'Küçük harf, rakam ve tire, 3-40 karakter.' : 'Adres küçük harf, rakam ve tireden oluşmalı, 3-40 karakter.'; $$('ay-py-slug-h').style.color = okS ? '' : 'var(--destructive)';
      $$('ay-py-cons-h').textContent = okC ? 'Cümle değişince form sürümü artar. Eski başvurular kendi sürümüyle kalır.' : 'Başvuru formu açıkken onay cümlesi en az 20 karakter olmalı.'; $$('ay-py-cons-h').style.color = okC ? '' : 'var(--destructive)';
      $$('ay-py-ver').textContent = 'Form sürüm ' + (c !== PUBC.cons ? PUBV + 1 + ' (kayıtta)' : PUBV);
      return okS && okC;
    }
    bind($$('ay-yayin'), pubOk, 'Yayın ayarları kaydedildi', function () { var n = pubRead(); if (n.cons !== PUBC.cons) PUBV++; n.ver = PUBV; PUBC = n; $$('ay-py-ver').textContent = 'Form sürüm ' + PUBV; if (SHARED.pubRender) SHARED.pubRender(); });
    $$('ay-py-pv').addEventListener('click', function () { SHARED.roleTo('pub'); });
    $$('ay-py-cp').addEventListener('click', function () {
      var u = 'ftksaas.example/s/' + PUBC.slug;
      function sel() { toast('Adres: ' + u); }
      try { navigator.clipboard.writeText('https://' + u).then(function () { toast('Bağlantı kopyalandı'); }, sel); } catch (e) { sel(); }
    });


    /* Salonlar: oda sınırı, gelecek seans kontenjanının altına inemez */
    var ROOMS = [
      { n: 'Salon A', cap: 16, use: 16, on: true, info: 'Grup dersleri' },
      { n: 'Salon B', cap: 12, use: 12, on: true, info: 'Grup dersleri' },
      { n: 'Stüdyo C', cap: 2, use: 1, on: true, info: 'Özel ders odası' }
    ];
    $$('ay-rooms').innerHTML = ROOMS.map(function (r, i) {
      return '<tr><td><span class="nm"><span>' + r.n + '</span><small>' + r.info + '</small></span></td>' +
        '<td><input class="input tnum" id="ay-cap-' + i + '" data-min="' + r.use + '" value="' + r.cap + '" inputmode="numeric" aria-label="' + r.n + ' oda sınırı" style="width:5rem;height:32px"><span class="hint" id="ay-cap-h-' + i + '" style="display:block"></span></td>' +
        '<td class="muted tnum">En yüksek kontenjan ' + r.use + '</td>' +
        '<td><input type="checkbox" class="switch" id="ay-on-' + i + '" role="switch" aria-label="' + r.n + ' açık"' + (r.on ? ' checked' : '') + '></td></tr>';
    }).join('');
    function roomsOk() {
      var ok = true;
      ROOMS.forEach(function (r, i) {
        var v = +$$('ay-cap-' + i).value.replace(/\D/g, ''), h = $$('ay-cap-h-' + i), bad = !(v >= r.use && v <= 50);
        h.textContent = bad ? (v < r.use ? 'En az ' + r.use : 'En fazla 50') : ''; h.style.color = bad ? 'var(--destructive)' : '';
        $$('ay-cap-' + i).setAttribute('aria-invalid', String(bad)); if (bad) ok = false;
      });
      return ok;
    }
    bind($$('ay-salon'), roomsOk, 'Salon ayarları kaydedildi');

    /* Bildirimler: anında uygulanır */
    var NT = [
      ['Yeni rezervasyon ve iptaller', 'Üyeler rezervasyon yaptığında ya da iptal ettiğinde.', true],
      ['Dolan seanslar', 'Bir seansın kontenjanı dolduğunda.', true],
      ['Açık borç uyarıları', 'Bir üyenin borcu 30 günü geçtiğinde.', true],
      ['Üye mesajları', 'Üyeler stüdyoya mesaj gönderdiğinde.', true],
      ['Günlük özet', 'Her sabah 08:00\'de günün programı.', false]
    ];
    $$('ay-notif').innerHTML = NT.map(function (n, i) {
      return '<div class="row"><div><p class="t"><label for="ay-n-' + i + '">' + n[0] + '</label></p><p class="d">' + n[1] + '</p></div><input type="checkbox" class="switch" id="ay-n-' + i + '" role="switch"' + (n[2] ? ' checked' : '') + '></div>';
    }).join('');
    $$('ay-notif').addEventListener('change', function (e) {
      var i = +e.target.id.split('-')[2]; toast(NT[i][0] + (e.target.checked ? ' açıldı' : ' kapatıldı'));
    });

    /* Hatırlatmalar (A6): tek kaydet çubuğu, gece aşan sessiz saat, kanal durumu */
    var REM = { mail: true, app: true, qon: true, qa: '22:00', qb: '08:00' };
    SHARED.rem = REM;
    var RM = [
      ['ders', 'Yaklaşan ders', 'Rezervasyonu olan üyeye ders öncesinde.', [['2', '2 saat önce'], ['12', '12 saat önce'], ['24', '24 saat önce']], '12'],
      ['paket', 'Paket bitişi', 'Süreli ya da dönemli hak bitmeden önce.', [['3', '3 gün önce'], ['7', '7 gün önce'], ['14', '14 gün önce']], '7'],
      ['vade', 'Vade ve açık borç', 'Ödeme vadesi yaklaşan ya da geçen üyeye.', [['0', 'Vade günü'], ['3', 'Vadeden 3 gün önce'], ['-3', 'Vadeden 3 gün sonra']], '3'],
      ['etkinlik', 'Etkinlik', 'Kayıtlı olunan atölye ve etkinlikten önce.', [['24', '24 saat önce'], ['72', '3 gün önce']], '24']
    ];
    $$('ay-hat-rows').innerHTML = RM.map(function (r) {
      return '<div class="row"><div><p class="t"><label for="ay-h-' + r[0] + '">' + r[1] + '</label></p><p class="d">' + r[2] + '</p></div>' +
        '<div style="display:flex;align-items:center;gap:12px"><select class="select" id="ay-h-' + r[0] + '-n" aria-label="' + r[1] + ' zamanı" style="width:auto;height:32px">' +
        r[3].map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === r[4] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>' +
        '<input type="checkbox" class="switch" id="ay-h-' + r[0] + '" role="switch" checked></div></div>';
    }).join('');
    var CHN = [['c-mail', 'E-posta', 'Üyenin kayıtlı adresine.', true, true], ['c-app', 'Uygulama içi', 'Üye panelindeki bildirim kutusu.', true, true], ['c-sms', 'SMS', 'Bu sürümde sunulmuyor.', false, false], ['c-wa', 'WhatsApp', 'Bağlı hesap yok.', false, false]];
    $$('ay-hat-ch').innerHTML = CHN.map(function (c) {
      return '<div class="row"><div><p class="t"><label for="ay-' + c[0] + '">' + c[1] + '</label></p><p class="d">' + c[2] + '</p></div><div style="display:flex;align-items:center;gap:12px"><span class="badge ' + (c[3] ? 'soft' : '') + '">' + (c[3] ? 'Kullanılabilir' : 'Kullanılamıyor') + '</span>' +
        '<input type="checkbox" class="switch" id="ay-' + c[0] + '" role="switch"' + (c[4] ? ' checked' : '') + (c[3] ? '' : ' disabled') + '></div></div>';
    }).join('');
    function mins(t) { var p = (t || '0:0').split(':'); return (+p[0]) * 60 + (+p[1]); }
    function inQ(m, a, b) { if (a === b) return false; return a < b ? m >= a && m < b : m >= a || m < b; }
    function fmtAbs(x) { var d = Math.floor(x / 1440), m = x - d * 1440; return (4 + d) + ' Kas ' + String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }
    function hv(k) { return $$('ay-h-' + k).checked; }
    function hatPaint() {
      RM.forEach(function (r) { $$('ay-h-' + r[0] + '-n').disabled = !hv(r[0]); });
      var q = $$('ay-q-on').checked, a = $$('ay-q-a').value, b = $$('ay-q-b').value;
      $$('ay-q-a').disabled = !q; $$('ay-q-b').disabled = !q;
      $$('ay-q-n').textContent = !q ? 'Sessiz saat kapalı, hatırlatmalar planlanan saatte gider.' : (!a || !b || a === b) ? 'Başlangıç ve bitiş farklı olmalı.' :
        a < b ? a + ' - ' + b + ' arası hatırlatma gitmez, ' + b + ' olunca gönderilir.' : a + ' ile ertesi gün ' + b + ' arası hatırlatma gitmez (geceyi aşar), ' + b + ' olunca gönderilir.';
      var now = 14 * 60 + 20, lead = +$$('ay-h-ders-n').value;
      $$('ay-hat-pv').innerHTML = ['08:30', '14:30', '19:00'].map(function (t) {
        var ls = 1440 + mins(t), res;
        if (!hv('ders')) res = '<span class="muted">Hatırlatma kapalı</span>';
        else {
          var send = ls - lead * 60;
          if (send < now) res = '<span class="muted">Zamanı geçti, gönderilmez</span>';
          else if (q && a && b && a !== b && inQ(send % 1440, mins(a), mins(b))) {
            var d0 = Math.floor(send / 1440) * 1440, cand = d0 + mins(b); if (cand <= send) cand += 1440;
            res = cand >= ls ? '<span class="muted">Gönderilmez, ders başlamış olur</span>' : '<span class="badge soft">Ertelendi</span> ' + fmtAbs(cand) + ' <span class="muted">(sessiz saat)</span>';
          } else res = '<span class="badge ok">Planlandı</span> ' + fmtAbs(send);
        }
        return '<tr><td class="tnum">' + t + '</td><td class="tnum">' + res + '</td></tr>';
      }).join('');
    }
    function hatOk() {
      var any = RM.some(function (r) { return hv(r[0]); }), e = '';
      if (any && !$$('ay-c-mail').checked && !$$('ay-c-app').checked) e = 'Hatırlatma açıkken e-posta ya da uygulama içi kanallardan en az biri açık olmalı.';
      else if ($$('ay-q-on').checked && (!$$('ay-q-a').value || !$$('ay-q-b').value)) e = 'Sessiz saat başlangıcını ve bitişini gir.';
      else if ($$('ay-q-on').checked && $$('ay-q-a').value === $$('ay-q-b').value) e = 'Sessiz saat başlangıcı ve bitişi aynı olamaz.';
      var w = $$('ay-hat-err'); w.hidden = !e; w.querySelector('span').textContent = e; return !e;
    }
    bind($$('ay-hat'), function () { hatPaint(); return hatOk(); }, 'Hatırlatma ayarları kaydedildi', function () {
      REM.mail = $$('ay-c-mail').checked; REM.app = $$('ay-c-app').checked; REM.qon = $$('ay-q-on').checked; REM.qa = $$('ay-q-a').value; REM.qb = $$('ay-q-b').value;
      if (SHARED.otRefresh) SHARED.otRefresh();
    });
    hatPaint();

    /* Ekip ve yetkiler (A7): kişiler, roller, izin matrisi, rol kaldırma önizlemesi */
    var PM = ['Üyeleri ve profilleri görüntüle', 'Üye haklarını düzenle (dondur, düzelt, paket değiştir)', 'Rezervasyon ve yoklama', 'Program ve etkinlik düzenleme', 'Finans: tahsilat ve iade', 'Hakediş', 'Adaylar ve takip', 'Otomasyon ve hatırlatma', 'Raporlar', 'Stüdyo ayarları', 'Ekip ve roller', 'Plan ve abonelik'];
    var NOPS = 10, ADMIN_LIMIT = 3;
    var TEAM = [
      { id: 1, n: 'Ayşe Yılmaz', m: 'ayse.yilmaz@ornek.test', own: true, my: true, st: false, type: 'Resepsiyon', inv: false, perm: [], work: ['1 otomasyon sorumluluğu (Hak azalınca takip görevi)', '2 açık takip görevi'] },
      { id: 2, n: 'Mehmet Kara', m: 'mehmet.kara@ornek.test', own: false, my: true, st: false, type: 'Resepsiyon', inv: false, perm: [], work: ['2 bekleyen özel ders talebi', '3 açık takip görevi'] },
      { id: 3, n: 'Zeynep Arı', m: 'zeynep.ari@ornek.test', own: false, my: false, st: true, type: 'Resepsiyon', inv: false, perm: [1, 0, 1, 0, 1, 0, 1, 0, 0, 0], work: ['1 açık takip görevi'] },
      { id: 4, n: 'Can Eren', m: 'can.eren@ornek.test', own: false, my: false, st: true, type: 'Operasyon', inv: true, perm: [1, 0, 1, 1, 0, 0, 0, 0, 0, 0], work: [] }
    ];
    var tid = 5, tmCur = null, tmFn = null;
    function tOf(id) { return TEAM.filter(function (p) { return p.id === id; })[0]; }
    function eff(p, i) { return i >= NOPS ? p.own : p.my ? true : p.st ? !!p.perm[i] : false; }
    function admins(except) { return TEAM.filter(function (p) { return p.id !== except && (p.own || p.my); }).length; }
    function eh(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
    function roleBadges(p) { return (p.own ? '<span class="badge solid">Sahip</span> ' : '') + (p.my ? '<span class="badge">Merkez yöneticisi</span> ' : '') + (p.st ? '<span class="badge soft">Personel · ' + p.type + '</span>' : ''); }
    function roleShort(p) { return p.own && p.my ? 'Sahip, M. yöneticisi' : p.my ? 'M. yöneticisi' : p.st ? 'Personel · ' + p.type : 'Yalnız Sahip'; }
    function planAdm() { var n = admins(0), el = $$('ay-pl-adm'), b = $$('ay-pl-adm-b'); if (el) { el.textContent = n + ' / ' + ADMIN_LIMIT; b.style.width = Math.round(n / ADMIN_LIMIT * 100) + '%'; } }
    function peopleRender() {
      $$('tm-body').innerHTML = TEAM.map(function (p) {
        return '<tr><td><b style="font-weight:500">' + eh(p.n) + '</b><span class="muted" style="display:block;font-size:12px">' + eh(p.m) + '</span></td><td>' + roleBadges(p) + '</td><td>' + (p.inv ? '<span class="badge soft">Davet bekliyor</span>' : '<span class="badge ok">Aktif</span>') + '</td>' +
          '<td class="r" style="white-space:nowrap">' + (p.own && !p.my ? '<button type="button" class="btn outline sm" data-tmself="' + p.id + '">Merkez yöneticisi rolünü üstlen</button> ' : '') + '<button type="button" class="btn outline sm" data-tmedit="' + p.id + '">Düzenle</button></td></tr>';
      }).join('');
      $$('tm-n').textContent = TEAM.length; planAdm(); permRender(); swap($$('tm-body'));
    }
    /* İzin matrisi: kendi tek kaydet çubuğu */
    var izBase = '';
    function izSnap() { return Array.prototype.map.call($$('ay-izin').querySelectorAll('input[type=checkbox]'), function (c) { return c.checked ? '1' : '0'; }).join(''); }
    function permRender() {
      var h = '<thead><tr><th>İzin</th>' + TEAM.map(function (p) { return '<th style="text-align:center">' + eh(p.n.split(' ')[0]) + '<span class="muted" style="display:block;font-weight:400;font-size:12px">' + eh(roleShort(p)) + '</span></th>'; }).join('') + '</tr></thead>';
      var b = '<tbody>' + PM.map(function (nm, i) {
        return '<tr><td>' + eh(nm) + (i >= NOPS ? '<span class="muted" style="display:block;font-size:12px">Yalnız Sahip</span>' : '') + '</td>' + TEAM.map(function (p) {
          var on = eff(p, i);
          if (i < NOPS && p.st && !p.my) return '<td style="text-align:center"><input type="checkbox" class="switch" id="ay-pm-' + p.id + '-' + i + '" role="switch" aria-label="' + eh(p.n + ': ' + nm) + '"' + (on ? ' checked' : '') + '></td>';
          var why = p.my ? 'Merkez yöneticisi rolünden gelir' : i >= NOPS ? (on ? 'Sahip rolünden gelir' : 'Yalnız Sahip') : p.own ? 'Sahip rolü tek başına bu yetkiyi vermez' : 'Rol yok';
          return '<td style="text-align:center" title="' + why + '">' + (on ? '<i data-i="check"></i><span class="sr-only">Var, ' + why + '</span>' : '<span class="muted" aria-label="Yok, ' + why + '">–</span>') + '</td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody>';
      $$('tm-perm').innerHTML = h + b; izBase = izSnap(); izSync(); swap($$('tm-perm'));
    }
    var DEPS = [[1, 0], [4, 0], [3, 2]];
    function izSync() {
      var e = '';
      TEAM.forEach(function (p) {
        if (e || !p.st || p.my) return;
        DEPS.forEach(function (d) { if (!e && $$('ay-pm-' + p.id + '-' + d[0]).checked && !$$('ay-pm-' + p.id + '-' + d[1]).checked) e = p.n + ': "' + PM[d[0]] + '" için "' + PM[d[1]] + '" de açık olmalı.'; });
      });
      var dirty = izSnap() !== izBase, w = $$('tm-perr'); w.hidden = !e; w.querySelector('span').textContent = e;
      $$('tm-psave').disabled = !dirty || !!e; $$('tm-pcancel').disabled = !dirty;
      $$('tm-pst').textContent = !dirty ? 'Tüm değişiklikler kaydedildi' : e ? 'Değişiklikleri kaydetmeden önce hataları düzelt' : 'Kaydedilmemiş değişiklikler var'; $$('tm-pst').classList.toggle('dirty', dirty);
    }
    $$('ay-izin').addEventListener('change', izSync);
    $$('ay-izin').addEventListener('submit', function (e) {
      e.preventDefault(); if ($$('tm-psave').disabled) return;
      TEAM.forEach(function (p) { if (p.st && !p.my) for (var i = 0; i < NOPS; i++) p.perm[i] = $$('ay-pm-' + p.id + '-' + i).checked ? 1 : 0; });
      izBase = izSnap(); izSync(); hist('Ekip', ['İzin matrisi güncellendi']); toast('İzinler kaydedildi');
    });
    $$('tm-pcancel').addEventListener('click', function () {
      var b = izBase.split(''); Array.prototype.forEach.call($$('ay-izin').querySelectorAll('input[type=checkbox]'), function (c, i) { c.checked = b[i] === '1'; }); izSync();
    });
    $$('tm-tabs').addEventListener('click', function (e) {
      var b = e.target.closest('[data-tm]'); if (!b) return; var t = b.getAttribute('data-tm');
      $$('tm-tabs').querySelectorAll('[data-tm]').forEach(function (x) { x.setAttribute('aria-selected', String(x === b)); });
      view.querySelectorAll('[data-tmp]').forEach(function (p) { p.hidden = p.getAttribute('data-tmp') !== t; });
    });
    /* Ortak onay kutusu */
    function tmDlg(o) {
      $$('tm-dt').textContent = o.t; $$('tm-db').innerHTML = o.b; var ok = $$('tm-dok'); ok.hidden = !o.ok; ok.textContent = o.ok || ''; ok.disabled = !!o.dis; ok.className = 'btn' + (o.danger ? ' danger' : '');
      $$('tm-dcancel').textContent = o.ok ? 'Vazgeç' : 'Kapat'; tmFn = o.fn; $$('tm-dlg').hidden = false; $$('tm-dscrim').hidden = false; swap($$('tm-dlg')); (o.ok && !o.dis ? ok : $$('tm-dcancel')).focus();
    }
    function tmDlgClose() { $$('tm-dlg').hidden = true; $$('tm-dscrim').hidden = true; tmFn = null; }
    $$('tm-dcancel').addEventListener('click', tmDlgClose); $$('tm-dscrim').addEventListener('click', tmDlgClose);
    $$('tm-dok').addEventListener('click', function () { var f = tmFn; tmDlgClose(); if (f) f(); });
    /* Kişi çekmecesi */
    var tmOp = null;
    function tmOpen(p) {
      tmOp = document.activeElement; tmCur = p ? p.id : null;
      $$('tm-title').textContent = p ? 'Rolleri düzenle' : 'Kişi davet et'; $$('tm-sub').textContent = p ? p.n : 'Davet kabul edilene kadar erişim açılmaz.';
      $$('tm-n2').value = p ? p.n : ''; $$('tm-m').value = p ? p.m : ''; $$('tm-n2').readOnly = !!p; $$('tm-m').readOnly = !!p; $$('tm-m-h').textContent = p ? 'Kişi bilgisini yalnız kişinin kendisi düzenler.' : '';
      $$('tm-r-own-w').hidden = !(p && p.own); $$('tm-r-own').checked = !!(p && p.own); $$('tm-r-my').checked = !!(p && p.my); $$('tm-r-st').checked = !!(p && p.st); $$('tm-st').value = p ? p.type : 'Resepsiyon';
      $$('tm-del').hidden = !(p && p.inv); tmCheck(); $$('tm-sheet').hidden = false; $$('tm-scrim').hidden = false; (p ? $$('tm-r-my') : $$('tm-n2')).focus(); swap($$('tm-sheet'));
    }
    function tmClose() { $$('tm-sheet').hidden = true; $$('tm-scrim').hidden = true; if (tmOp) tmOp.focus(); }
    function tmDiff() {
      var p = tOf(tmCur), my = $$('tm-r-my').checked, st = $$('tm-r-st').checked, add = [], rem = [];
      if (!p) { if (my) add.push('Merkez yöneticisi'); if (st) add.push('Personel'); return { add: add, rem: rem, my: my, st: st }; }
      if (my && !p.my) add.push('Merkez yöneticisi'); if (!my && p.my) rem.push('Merkez yöneticisi');
      if (st && !p.st) add.push('Personel'); if (!st && p.st) rem.push('Personel');
      return { add: add, rem: rem, my: my, st: st, type: $$('tm-st').value };
    }
    function tmCheck() {
      var p = tOf(tmCur), d = tmDiff(), e = '', n = $$('tm-n2').value.trim(), m = $$('tm-m').value.trim().toLocaleLowerCase('tr');
      $$('tm-st-w').hidden = !d.st;
      if (!p) { if (!n) e = 'Ad soyad gerekli.'; else if (!/^\S+@\S+\.\S+$/.test(m)) e = 'Geçerli bir e-posta gir.'; else if (TEAM.some(function (x) { return x.m.toLocaleLowerCase('tr') === m; })) e = 'Bu e-posta zaten ekipte.'; }
      if (!e && !d.my && !d.st && !p) e = 'En az bir rol seç.';
      if (!e && d.my && !(p && (p.own || p.my)) && admins(p ? p.id : 0) + 1 > ADMIN_LIMIT) e = 'Plan sınırı: yönetici hesabı ' + admins(0) + ' / ' + ADMIN_LIMIT + '. Yeni Merkez yöneticisi için planı yükselt ya da bir yönetici hesabını kaldır.';
      var w = $$('tm-err'); w.hidden = !e; w.querySelector('span').textContent = e;
      var changed = !p || d.add.length || d.rem.length || (p.st && d.st && d.type !== p.type);
      $$('tm-save').disabled = !!e || !changed; $$('tm-save').textContent = !p ? 'Davet gönder' : d.rem.length ? 'Önizlemeye geç' : 'Kaydet';
      var eff2 = [];
      if (!p) eff2.push('Davet e-postası gider, kişi kabul edene kadar erişimi yoktur.');
      if (d.add.length) eff2.push('Eklenecek: ' + d.add.join(', ') + '.');
      if (d.rem.length) eff2.push('Kaldırılacak: ' + d.rem.join(', ') + '. Kaybedilecek yetkiler ve açık işler bir sonraki adımda görünür.');
      if (d.my) eff2.push('Merkez yöneticisi merkezin tüm operasyon ve finans işlerini yapar.');
      if (d.st && !d.my) eff2.push('Personel izinleri İzinler sekmesinden ayarlanır, yeni personelde yalnız görüntüleme ve rezervasyon açıktır.');
      if (p && !p.own && !d.my && !d.st) eff2.push('Hiç rol kalmayacak: kişi ekipten çıkarılır.');
      if (p && p.own && !d.my) eff2.push('Sahip rolü tek başına finans ya da merkez yetkisi vermez.');
      if (!eff2.length) eff2.push('Değişiklik yok.');
      $$('tm-eff').innerHTML = eff2.map(function (x) { return '<li><span class="ch" style="color:var(--foreground)">' + eh(x) + '</span></li>'; }).join('');
    }
    $$('tm-form').addEventListener('input', tmCheck); $$('tm-form').addEventListener('change', tmCheck); $$('tm-form').addEventListener('submit', function (e) { e.preventDefault(); });
    function apply(p, d) { p.my = d.my; p.st = d.st; if (d.st) p.type = d.type; if (d.st && !p.perm.length) p.perm = [1, 0, 1, 0, 0, 0, 0, 0, 0, 0]; }
    function removePreview(p, d) {
      var np = { id: p.id, own: p.own, my: d.my, st: d.st, perm: p.perm }, gone = !np.own && !np.my && !np.st;
      var lost = [], i; for (i = 0; i < PM.length; i++) if (eff(p, i) && !eff(np, i)) lost.push(PM[i]);
      var others = TEAM.filter(function (x) { return x.id !== p.id && x.my; }), needHand = p.work.length && (!np.my && (p.my || gone));
      if (p.my && !d.my && !others.length) { tmDlg({ t: 'Rol kaldırılamaz', b: '<p class="muted">' + eh(p.n) + ' bu merkezin son Merkez yöneticisi. Önce başka bir kişiye bu rolü ver.</p>' }); return; }
      var body = '<p class="muted">' + eh(p.n) + ': ' + d.rem.join(', ') + ' rolü kaldırılacak.</p>' +
        '<p class="sub" style="margin:0">Kaybedilecek yetkiler (' + lost.length + ')</p><ul class="aff">' + (lost.length ? lost.map(function (x) { return '<li><span class="ch" style="color:var(--foreground)">' + eh(x) + '</span></li>'; }).join('') : '<li><span class="ch">Yetki kaybı yok.</span></li>') + '</ul>' +
        '<p class="sub" style="margin:0">Açık işler (' + p.work.length + ')</p><ul class="aff">' + (p.work.length ? p.work.map(function (x) { return '<li><span class="ch" style="color:var(--foreground)">' + eh(x) + '</span></li>'; }).join('') : '<li><span class="ch">Açık iş yok.</span></li>') + '</ul>' +
        (needHand ? '<div class="field"><label class="label" for="tm-hand">Açık işleri devret<span class="hint">Zorunlu</span></label><select class="select" id="tm-hand">' + others.map(function (x) { return '<option value="' + x.id + '">' + eh(x.n) + '</option>'; }).join('') + '</select></div>' : '') +
        (gone ? '<p class="note" style="margin:0"><i data-i="lock"></i><span>Başka rolü kalmadığı için ekipten çıkarılır, oturumları kapatılır. Yaptığı işlemler kayıtta kalır.</span></p>' : '');
      tmDlg({ t: 'Rol kaldırma önizlemesi', b: body, ok: 'Rolü kaldır', danger: true, fn: function () {
        var h = needHand ? tOf(+$$('tm-hand').value) : null;
        if (h) { h.work = h.work.concat(p.work.map(function (x) { return x + ' (devralındı: ' + p.n.split(' ')[0] + ')'; })); p.work = []; }
        if (gone) TEAM.splice(TEAM.indexOf(p), 1); else apply(p, d);
        hist('Ekip', [p.n + (gone ? ' ekipten çıkarıldı' : ': ' + d.rem.join(', ') + ' rolü kaldırıldı')]); tmClose(); peopleRender(); toast(gone ? p.n + ' ekipten çıkarıldı' : d.rem.join(', ') + ' rolü kaldırıldı' + (h ? ', açık işler ' + h.n + ' kişisine devredildi' : ''));
      } });
      if (needHand) { /* devir seçimi zorunlu: ilk seçenek varsayılan */ }
    }
    $$('tm-save').addEventListener('click', function () {
      if ($$('tm-save').disabled) return; var p = tOf(tmCur), d = tmDiff();
      if (!p) {
        TEAM.push({ id: tid++, n: $$('tm-n2').value.trim(), m: $$('tm-m').value.trim(), own: false, my: d.my, st: d.st, type: d.type || 'Resepsiyon', inv: true, perm: d.st ? [1, 0, 1, 0, 0, 0, 0, 0, 0, 0] : [], work: [] });
        tmClose(); peopleRender(); hist('Ekip', [$$('tm-n2').value.trim() + ' davet edildi']); toast('Davet gönderildi'); return;
      }
      if (d.rem.length) { removePreview(p, d); return; }
      apply(p, d); tmClose(); peopleRender(); hist('Ekip', [p.n + ' rolleri güncellendi']); toast('Roller kaydedildi');
    });
    $$('tm-del').addEventListener('click', function () {
      var p = tOf(tmCur); tmDlg({ t: 'Daveti geri çek', b: '<p class="muted">' + eh(p.n) + ' kişisine gönderilen davet geçersiz olur. Henüz erişimi olmadığı için yetki ya da açık iş etkilenmez.</p>', ok: 'Daveti geri çek', danger: true, fn: function () { TEAM.splice(TEAM.indexOf(p), 1); tmClose(); peopleRender(); toast('Davet geri çekildi'); } });
    });
    $$('tm-x').addEventListener('click', tmClose); $$('tm-cancel').addEventListener('click', tmClose); $$('tm-scrim').addEventListener('click', tmClose);
    $$('tm-add').addEventListener('click', function () { tmOpen(null); });
    $$('tm-body').addEventListener('click', function (e) {
      var b = e.target.closest('[data-tmedit]'), s = e.target.closest('[data-tmself]');
      if (b) tmOpen(tOf(+b.getAttribute('data-tmedit')));
      else if (s) { var p = tOf(+s.getAttribute('data-tmself')); p.my = true; peopleRender(); toast('Merkez yöneticisi rolü üstlenildi'); }
    });
    peopleRender();

    /* Ayarlar S12 (A8): marka, politikalar, şablonlar, değişiklik geçmişi, varsayılana sıfırlama */
    var HCLK = 30;
    var HIST = [
      { at: '3 Kas 17:40', by: 'Ayşe Y.', sec: 'Rezervasyon', lines: ['Ücretsiz iptal süresi: 4 saat önce → 2 saat önce'] },
      { at: '28 Eki 11:05', by: 'Ayşe Y.', sec: 'Salonlar', lines: ['Salon B oda sınırı: 14 → 12'] },
      { at: '20 Eki 09:12', by: 'Ayşe Y.', sec: 'Genel', lines: ['Telefon: +90 212 000 00 01 → +90 212 000 00 00'] },
      { at: '15 Eki 16:30', by: 'Mehmet K.', sec: 'Bildirimler', lines: ['Günlük özet: Açık → Kapalı'] }
    ];
    var HSEC = ['Genel', 'Rezervasyon', 'Politikalar', 'Salonlar', 'Bildirimler', 'Şablonlar', 'Yayın', 'Ekip', 'Plan'];
    function hist(sec, lines) { HIST.unshift({ at: '4 Kas 14:' + (HCLK++), by: 'Ayşe Y.', sec: sec, lines: lines && lines.length ? lines : ['Değişiklik kaydedildi'] }); histRender(); }
    function histRender() {
      var f = $$('hs-f').value, rows = HIST.filter(function (h) { return !f || h.sec === f; });
      $$('hs-body').innerHTML = rows.map(function (h) { return '<tr><td class="tnum" style="white-space:nowrap">' + h.at + '</td><td>' + eh(h.by) + '</td><td><span class="badge soft">' + h.sec + '</span></td><td>' + h.lines.map(function (l) { return '<span style="display:block">' + eh(l) + '</span>'; }).join('') + '</td></tr>'; }).join('') || '<tr><td colspan="4" class="muted">Bu bölümde kayıt yok.</td></tr>';
      $$('hs-cnt').textContent = rows.length + ' kayıt';
    }
    $$('hs-f').innerHTML = '<option value="">Tüm bölümler</option>' + HSEC.map(function (s) { return '<option>' + s + '</option>'; }).join('');
    $$('hs-f').addEventListener('change', histRender);
    SHARED.hist = hist; SHARED.histAll = function () { return HIST; };

    /* Marka */
    var MK = [['Grafit', 'oklch(0.27 0 0)', 0.27], ['Mavi', 'oklch(0.55 0.2 260)', 0.55], ['Yeşil', 'oklch(0.6 0.15 155)', 0.6], ['Kırmızı', 'oklch(0.58 0.22 27)', 0.58], ['Turuncu', 'oklch(0.78 0.16 60)', 0.78], ['Mor', 'oklch(0.52 0.22 300)', 0.52]];
    var mkLogo = '', mkSaved = '', mkErr = '';
    function mkSel() { return MK.filter(function (m) { return m[0] === $$('ay-mk-col').value; })[0] || MK[0]; }
    function mkPaint() {
      var c = mkSel(), dark = c[2] > 0.65, txt = dark ? 'oklch(0.2 0 0)' : 'oklch(0.98 0 0)', nm = $$('ay-ad').value.trim() || 'Stüdyo';
      $$('ay-mk-sw').innerHTML = MK.map(function (m) { return '<button type="button" role="radio" aria-checked="' + (m === c) + '" aria-label="' + m[0] + '" data-mk="' + m[0] + '" style="width:32px;height:32px;border-radius:999px;border:2px solid ' + (m === c ? 'var(--foreground)' : 'var(--border)') + ';background:' + m[1] + ';cursor:pointer;box-shadow:inset 0 0 0 2px var(--background)"></button>'; }).join('');
      $$('ay-mk-ch').textContent = c[0] + (dark ? ', düğme yazısı koyu seçilir' : ', düğme yazısı beyaz') + ' (okunabilir kontrast)';
      var logo = mkLogo ? '<img src="' + mkLogo + '" alt="" style="width:28px;height:28px;border-radius:6px;object-fit:cover;background:#fff">' : '<span style="width:28px;height:28px;border-radius:6px;background:' + txt + ';color:' + c[1] + ';display:grid;place-items:center;font-size:12px;font-weight:600">' + eh(nm.split(' ').map(function (w) { return w[0]; }).slice(0, 2).join('').toLocaleUpperCase('tr')) + '</span>';
      $$('ay-mk-pv').innerHTML = '<div style="border:1px solid var(--border);border-radius:10px;overflow:hidden"><div style="background:' + c[1] + ';color:' + txt + ';padding:12px 14px;display:flex;align-items:center;gap:10px">' + logo + '<b style="font-weight:600">' + eh(nm) + '</b></div><div style="padding:14px;display:grid;gap:10px"><span class="muted" style="font-size:13px">Üye sayfası ve e-posta başlığı böyle görünür.</span><span style="justify-self:start;background:' + c[1] + ';color:' + txt + ';padding:6px 12px;border-radius:8px;font-weight:500;font-size:13px">Rezervasyon yap</span></div></div>';
      $$('ay-mk-fn').textContent = $$('ay-mk-ln').value; $$('ay-mk-lx').hidden = !$$('ay-mk-ln').value;
      var w = $$('ay-mk-err'); w.hidden = !mkErr; w.querySelector('span').textContent = mkErr;
    }
    $$('ay-mk-sw').addEventListener('click', function (e) { var b = e.target.closest('[data-mk]'); if (!b) return; $$('ay-mk-col').value = b.getAttribute('data-mk'); $$('ay-mk-col').dispatchEvent(new Event('change', { bubbles: true })); });
    $$('ay-mk-file').addEventListener('change', function () {
      var f = this.files[0]; mkErr = ''; if (!f) return;
      if (['image/png', 'image/svg+xml', 'image/webp'].indexOf(f.type) < 0) mkErr = 'Logo PNG, SVG ya da WebP olmalı.';
      else if (f.size > 1048576) mkErr = 'Logo en fazla 1 MB olabilir.';
      if (mkErr) { this.value = ''; mkPaint(); $$('ay-marka').dispatchEvent(new Event('change', { bubbles: true })); return; }
      var r = new FileReader(); r.onload = function () { mkLogo = r.result; $$('ay-mk-ln').value = f.name; $$('ay-mk-ln').dispatchEvent(new Event('change', { bubbles: true })); mkPaint(); }; r.readAsDataURL(f);
    });
    $$('ay-mk-lx').addEventListener('click', function () { mkLogo = ''; mkErr = ''; $$('ay-mk-file').value = ''; $$('ay-mk-ln').value = ''; $$('ay-mk-ln').dispatchEvent(new Event('change', { bubbles: true })); mkPaint(); });
    $$('ay-genel').addEventListener('input', mkPaint);
    bind($$('ay-marka'), function () { return !mkErr; }, 'Marka kaydedildi', function () { mkSaved = mkLogo; });
    $$('ay-marka').querySelector('[data-cancel]').addEventListener('click', function () { mkErr = ''; mkLogo = $$('ay-mk-ln').value ? mkSaved : ''; mkPaint(); });
    mkPaint();

    /* Varsayılana sıfırlama (settings_reset_preview/apply): Rezervasyon */
    var KF = $$('ay-kural'), KDEF = snap(KF), resetFlag = false;
    $$('ay-reset').addEventListener('click', function () {
      var cur = snap(KF), lines = diffOf(KF, cur, KDEF);
      if (!lines.length) { tmDlg({ t: 'Varsayılana sıfırla', b: '<p class="muted">Rezervasyon kuralları zaten varsayılan değerlerde.</p>' }); return; }
      tmDlg({ t: 'Rezervasyon kurallarını sıfırla', b: '<p class="muted">Şu alanlar varsayılana döner. Mevcut rezervasyonlar etkilenmez, yalnız sonraki işlemlere uygulanır.</p><ul class="aff">' + lines.map(function (l) { return '<li><span class="ch" style="color:var(--foreground)">' + eh(l) + '</span></li>'; }).join('') + '</ul>', ok: lines.length + ' alanı sıfırla', danger: true, fn: function () {
        KF.querySelectorAll('input:not([readonly]),select').forEach(function (f, i) { if (f.type === 'checkbox') f.checked = KDEF[i] === 'true'; else f.value = KDEF[i]; });
        KF.dispatchEvent(new Event('change', { bubbles: true })); resetFlag = true; KF.dispatchEvent(new Event('submit', { cancelable: true }));
      } });
    });
    SHARED.resetNote = function () { var r = resetFlag; resetFlag = false; return r; };

    /* Politikalar (policy_publish): sürümlü yayın */
    var YN = [['1', 'Evet'], ['0', 'Hayır']];
    var POL = [
      { id: 'uyg', n: 'Uygunluk politikası', f: [['bos', 'Paketsiz üye derse katılabilir', YN], ['den', 'Deneme dersi kişi başı bir kez', YN], ['bor', 'Açık borçlu üyenin yeni rezervasyonu', [['block', 'Engellenir'], ['warn', 'Uyarıyla izin verilir'], ['allow', 'İzin verilir']]]], v: { bos: '0', den: '1', bor: 'warn' }, ver: 2, since: '1 Eki', h: [{ v: 2, at: '1 Eki', by: 'Ayşe Y.', ch: 'Açık borçlu üye: Engellenir → Uyarıyla izin verilir' }, { v: 1, at: '12 Eyl', by: 'Ayşe Y.', ch: 'İlk yayın' }] },
      { id: 'kat', n: 'Katılım politikası', f: [['gec', 'Ders başladıktan sonra katılım', [['0', 'Kabul edilmez'], ['10', '10 dakikaya kadar'], ['15', '15 dakikaya kadar'], ['99', 'Sınırsız']]], ['gel', 'Gelmedi işareti', [['bitis', 'Ders bitince'], ['15', 'Başlangıçtan 15 dakika sonra']]]], v: { gec: '10', gel: 'bitis' }, ver: 1, since: '12 Eyl', h: [{ v: 1, at: '12 Eyl', by: 'Ayşe Y.', ch: 'İlk yayın' }] },
      { id: 'neg', n: 'Negatif limit politikası', f: [['izin', 'Negatif hakka izin', YN], ['max', 'En fazla eksi hak', [['1', '1 hak'], ['2', '2 hak'], ['3', '3 hak']]]], v: { izin: '1', max: '1' }, ver: 3, since: '20 Eki', h: [{ v: 3, at: '20 Eki', by: 'Mehmet K.', ch: 'En fazla eksi hak: 2 hak → 1 hak' }, { v: 2, at: '2 Eki', by: 'Ayşe Y.', ch: 'Negatif hakka izin: Hayır → Evet' }, { v: 1, at: '12 Eyl', by: 'Ayşe Y.', ch: 'İlk yayın' }] },
      { id: 'tah', n: 'Tahsilat yöntemi politikası', f: [['nak', 'Nakit kabul edilir', YN], ['hav', 'Havale/EFT kabul edilir', YN], ['pos', 'POS ile kart kabul edilir', YN], ['vad', 'Taksit vadesi', [['0', 'Peşin'], ['7', '7 gün'], ['14', '14 gün'], ['30', '30 gün']]]], v: { nak: '1', hav: '1', pos: '0', vad: '0' }, ver: 1, since: '12 Eyl', h: [{ v: 1, at: '12 Eyl', by: 'Ayşe Y.', ch: 'İlk yayın' }] }
    ];
    function pText(p, k, val) { var f = p.f.filter(function (x) { return x[0] === k; })[0]; var o = f[2].filter(function (x) { return x[0] === val; })[0]; return o ? o[1] : val; }
    function pSum(p) { return p.f.map(function (f) { return f[1] + ': ' + pText(p, f[0], p.v[f[0]]); }).join(' · '); }
    function poRender() {
      $$('po-body').innerHTML = POL.map(function (p) { return '<tr><td><b style="font-weight:500">' + p.n + '</b></td><td class="tnum">v' + p.ver + '<span class="muted" style="display:block;font-size:12px">' + p.since + ' tarihinden beri</span></td><td class="muted" style="font-size:13px;max-width:28rem">' + eh(pSum(p)) + '</td><td class="r"><button type="button" class="btn outline sm" data-po="' + p.id + '">Yeni sürüm</button></td></tr>'; }).join('');
    }
    var poCur = null, poVal = null, poOp = null;
    function poDiff() { return poCur.f.filter(function (f) { return poVal[f[0]] !== poCur.v[f[0]]; }).map(function (f) { return f[1] + ': ' + pText(poCur, f[0], poCur.v[f[0]]) + ' → ' + pText(poCur, f[0], poVal[f[0]]); }); }
    function poPaint() {
      var d = poDiff();
      $$('po-eff').innerHTML = (d.length ? d.map(function (l) { return '<li><span class="ch" style="color:var(--foreground)">' + eh(l) + '</span></li>'; }).join('') + '<li><span class="ch">v' + (poCur.ver + 1) + ' hemen yürürlüğe girer. Mevcut rezervasyon ve satışlar önceki sürümle devam eder.</span></li>' : '<li><span class="ch">Değişiklik yok.</span></li>');
      $$('po-pub').disabled = !d.length;
    }
    function poOpen(id) {
      poOp = document.activeElement; poCur = POL.filter(function (p) { return p.id === id; })[0]; poVal = {}; Object.keys(poCur.v).forEach(function (k) { poVal[k] = poCur.v[k]; });
      $$('po-title').textContent = poCur.n; $$('po-sub').textContent = 'Yürürlükteki: v' + poCur.ver;
      $$('po-fields').innerHTML = poCur.f.map(function (f) { return '<div class="field"><label class="label" for="po-f-' + f[0] + '">' + f[1] + '</label><select class="select" id="po-f-' + f[0] + '" data-k="' + f[0] + '">' + f[2].map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === poVal[f[0]] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div>'; }).join('');
      $$('po-hist').innerHTML = poCur.h.map(function (h) { return '<li><div class="row-l"><span>v' + h.v + ' · ' + eh(h.ch) + '</span><span class="tnum muted">' + h.at + ', ' + eh(h.by) + '</span></div></li>'; }).join('');
      poPaint(); $$('po-sheet').hidden = false; $$('po-scrim').hidden = false; $$('po-fields').querySelector('select').focus(); swap($$('po-sheet'));
    }
    function poClose() { $$('po-sheet').hidden = true; $$('po-scrim').hidden = true; if (poOp) poOp.focus(); }
    $$('po-fields').addEventListener('change', function (e) { var k = e.target.getAttribute('data-k'); if (k) { poVal[k] = e.target.value; poPaint(); } });
    $$('po-form').addEventListener('submit', function (e) { e.preventDefault(); });
    $$('po-pub').addEventListener('click', function () {
      if ($$('po-pub').disabled) return; var d = poDiff();
      tmDlg({ t: poCur.n + ': v' + (poCur.ver + 1) + ' yayınlansın mı', b: '<ul class="aff">' + d.map(function (l) { return '<li><span class="ch" style="color:var(--foreground)">' + eh(l) + '</span></li>'; }).join('') + '</ul><p class="note" style="margin:0"><i data-i="lock"></i><span>Önceki sürüm geçmişte kalır. Mevcut rezervasyon ve satışlar etkilenmez.</span></p>', ok: 'Yayınla', fn: function () {
        poCur.ver++; poCur.since = '4 Kas'; poCur.h.unshift({ v: poCur.ver, at: '4 Kas', by: 'Ayşe Y.', ch: d.join('; ') }); Object.keys(poVal).forEach(function (k) { poCur.v[k] = poVal[k]; });
        hist('Politikalar', [poCur.n + ' v' + poCur.ver + ' yayınlandı'].concat(d)); poClose(); poRender(); toast(poCur.n + ' v' + poCur.ver + ' yayınlandı');
      } });
    });
    $$('po-x').addEventListener('click', poClose); $$('po-cancel').addEventListener('click', poClose); $$('po-scrim').addEventListener('click', poClose);
    $$('po-body').addEventListener('click', function (e) { var b = e.target.closest('[data-po]'); if (b) poOpen(b.getAttribute('data-po')); });
    poRender();

    /* Şablonlar */
    var VARS = ['uye_adi', 'ders_adi', 'tarih', 'saat', 'kalan_hak', 'borc', 'bitis_tarihi', 'teklif_suresi', 'studyo_adi'];
    var SAMPLE = { uye_adi: 'Cem Demir', ders_adi: 'Salsa orta', tarih: 'Çar 4 Kas', saat: '19:00', kalan_hak: '2', borc: '₺450', bitis_tarihi: '30 Kasım', teklif_suresi: '15 dakika', studyo_adi: 'Örnek Dans Stüdyosu' };
    var TPLS = [
      { n: 'Paket bitiş hatırlatması', kind: 'Hatırlatma', must: false, on: true, s: 'Paketin {bitis_tarihi} tarihinde bitiyor', b: 'Merhaba {uye_adi}, paketin {bitis_tarihi} tarihinde sona erecek. Yenilemek için {studyo_adi} ekibine yazabilirsin.', req: [] },
      { n: 'Hak azaldı bildirimi', kind: 'Hatırlatma', must: false, on: true, s: 'Kalan hakkın: {kalan_hak}', b: 'Merhaba {uye_adi}, paketinde {kalan_hak} ders hakkın kaldı. Yeni dersler için paketini yenileyebilirsin.', req: [] },
      { n: 'Ders planı hatırlatması', kind: 'Hatırlatma', must: false, on: true, s: 'Bu hafta derse gelmeyi unutma', b: 'Merhaba {uye_adi}, bu hafta için yaklaşan bir rezervasyonun yok. {studyo_adi} programına göz atabilirsin.', req: [] },
      { n: 'Borç hatırlatması', kind: 'Hatırlatma', must: false, on: true, s: 'Açık bakiye hatırlatması', b: 'Merhaba {uye_adi}, {borc} tutarında açık bakiyen görünüyor. Ödeme için {studyo_adi} ekibiyle görüşebilirsin.', req: ['borc'] },
      { n: 'Yer teklifi', kind: 'İşlemsel', must: true, on: true, s: '{ders_adi} için yer açıldı', b: 'Merhaba {uye_adi}, {ders_adi} dersinde ({tarih} {saat}) yer açıldı. Teklif {teklif_suresi} geçerli, süre dolunca sıradaki üyeye geçer.', req: ['teklif_suresi'] },
      { n: 'Rezervasyon onayı', kind: 'İşlemsel', must: true, on: true, s: 'Rezervasyonun onaylandı', b: 'Merhaba {uye_adi}, {ders_adi} dersi için {tarih} {saat} rezervasyonun onaylandı.', req: ['ders_adi', 'tarih'] }
    ];
    SHARED.tpl = function () { return TPLS.filter(function (t) { return t.kind === 'Hatırlatma' && t.on; }).map(function (t) { return t.n; }); };
    SHARED.tplArchived = function (n) { var t = TPLS.filter(function (x) { return x.n === n; })[0]; return !!t && !t.on; };
    function tUse(n) { return SHARED.otUse ? SHARED.otUse(n) : []; }
    function tpRender() {
      $$('tp-body').innerHTML = TPLS.map(function (t) {
        var u = tUse(t.n); return '<tr><td><b style="font-weight:500">' + t.n + '</b></td><td>' + t.kind + (t.must ? '<span class="muted" style="display:block;font-size:12px">Zorunlu, kapatılamaz</span>' : '') + '</td><td>' + (t.on ? '<span class="badge ok">Yayında</span>' : '<span class="badge soft">Arşivde</span>') + '</td><td>' + (u.length ? eh(u.join(', ')) : '<span class="muted">Kullanılmıyor</span>') + '</td><td class="r"><button type="button" class="btn outline sm" data-tp="' + eh(t.n) + '">Düzenle</button></td></tr>';
      }).join('');
    }
    SHARED.tpRefresh = tpRender;
    var tpCur = null, tpOp = null;
    function tpRender2(txt) { return txt.replace(/\{(\w+)\}/g, function (m, k) { return SAMPLE[k] != null ? SAMPLE[k] : m; }); }
    function tpOpen(n) {
      tpOp = document.activeElement; tpCur = TPLS.filter(function (t) { return t.n === n; })[0];
      $$('tp-title').textContent = tpCur.n; $$('tp-sub').textContent = tpCur.kind + (tpCur.must ? ', zorunlu işlem bildirimi' : '') + ' · ' + (tpCur.on ? 'Yayında' : 'Arşivde');
      $$('tp-s').value = tpCur.s; $$('tp-b').value = tpCur.b;
      $$('tp-vars').innerHTML = '<span class="muted" style="font-size:12px;align-self:center">Değişken ekle:</span>' + VARS.map(function (v) { return '<button type="button" class="btn outline sm" data-v="' + v + '" style="height:26px;padding:0 8px;font-size:12px">{' + v + '}</button>'; }).join('');
      $$('tp-arch').textContent = tpCur.on ? 'Arşivle' : 'Yayına al'; $$('tp-arch').disabled = tpCur.must; $$('tp-arch').title = tpCur.must ? 'Zorunlu işlem şablonu arşivlenemez' : '';
      tpCheck(); $$('tp-sheet').hidden = false; $$('tp-scrim').hidden = false; $$('tp-s').focus(); swap($$('tp-sheet'));
    }
    function tpClose() { $$('tp-sheet').hidden = true; $$('tp-scrim').hidden = true; if (tpOp) tpOp.focus(); }
    function tpCheck() {
      var s = $$('tp-s').value.trim(), b = $$('tp-b').value.trim(), e = '', all = (s + ' ' + b).match(/\{[^}]*\}/g) || [];
      var bad = all.filter(function (x) { return VARS.indexOf(x.slice(1, -1)) < 0; });
      if (!s) e = 'Konu gerekli.'; else if (b.length < 10) e = 'Metin en az 10 karakter olmalı.';
      else if (bad.length) e = 'Bilinmeyen değişken: ' + bad[0] + '. Aşağıdaki listeden seç.';
      else { var miss = tpCur.req.filter(function (r) { return (s + ' ' + b).indexOf('{' + r + '}') < 0; }); if (miss.length) e = 'Bu şablonda {' + miss[0] + '} bulunmalı.'; }
      var w = $$('tp-err'); w.hidden = !e; w.querySelector('span').textContent = e;
      $$('tp-save').disabled = !!e || (s === tpCur.s && b === tpCur.b);
      $$('tp-pvs').textContent = tpRender2(s); $$('tp-pvb').textContent = tpRender2(b);
    }
    $$('tp-form').addEventListener('input', tpCheck); $$('tp-form').addEventListener('submit', function (e) { e.preventDefault(); });
    $$('tp-vars').addEventListener('click', function (e) { var bt = e.target.closest('[data-v]'); if (!bt) return; var t = $$('tp-b'), p = t.selectionStart == null ? t.value.length : t.selectionStart, ins = '{' + bt.getAttribute('data-v') + '}'; t.value = t.value.slice(0, p) + ins + t.value.slice(t.selectionEnd == null ? p : t.selectionEnd); t.focus(); t.selectionStart = t.selectionEnd = p + ins.length; tpCheck(); });
    $$('tp-save').addEventListener('click', function () { if ($$('tp-save').disabled) return; tpCur.s = $$('tp-s').value.trim(); tpCur.b = $$('tp-b').value.trim(); hist('Şablonlar', [tpCur.n + ' metni güncellendi']); tpClose(); tpRender(); toast('Şablon kaydedildi'); });
    $$('tp-arch').addEventListener('click', function () {
      if ($$('tp-arch').disabled) return; var u = tUse(tpCur.n);
      if (tpCur.on && u.length) { tmDlg({ t: 'Arşivlenemez', b: '<p class="muted">Bu şablonu kullanan otomasyon var: ' + eh(u.join(', ')) + '. Önce otomasyondaki şablonu değiştir.</p>' }); return; }
      tmDlg({ t: tpCur.on ? 'Şablonu arşivle' : 'Şablonu yayına al', b: '<p class="muted">' + eh(tpCur.n) + (tpCur.on ? ' arşive alınır, yeni otomasyonlarda seçilemez.' : ' yeniden seçilebilir olur.') + '</p>', ok: tpCur.on ? 'Arşivle' : 'Yayına al', danger: tpCur.on, fn: function () { tpCur.on = !tpCur.on; hist('Şablonlar', [tpCur.n + (tpCur.on ? ' yayına alındı' : ' arşive alındı')]); tpClose(); tpRender(); toast(tpCur.on ? 'Şablon yayında' : 'Şablon arşivlendi'); } });
    });
    $$('tp-x').addEventListener('click', tpClose); $$('tp-cancel').addEventListener('click', tpClose); $$('tp-scrim').addEventListener('click', tpClose);
    $$('tp-body').addEventListener('click', function (e) { var b = e.target.closest('[data-tp]'); if (b) tpOpen(b.getAttribute('data-tp')); });
    tpRender(); histRender();

    /* Abonelik: plan değiştir, kart, fatura, iptal */
    var PLS = { baslangic: { n: 'Başlangıç', p: 490, mem: 30, sal: 2, adm: 1 }, studyo: { n: 'Stüdyo', p: 990, mem: 100, sal: 5, adm: 3 }, isletme: { n: 'İşletme', p: 1990, mem: 500, sal: 15, adm: 10 } };
    var PO = ['baslangic', 'studyo', 'isletme'], SUB = { cur: 'studyo', pend: null, cancel: false, card: 'Visa •••• 4242', exp: '08/28' }, USE = { mem: 10, sal: 3 }, plCur = null, plOp = null;
    var INV = [['1 Kas', 990], ['1 Eki', 990], ['1 Eyl', 990]];
    function tl(n) { return '₺' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
    function plRender() {
      var P = PLS[SUB.cur], nx = SUB.pend ? PLS[SUB.pend] : P;
      $$('ay-pl-badge').textContent = P.n; $$('ay-pl-mem').textContent = USE.mem + ' / ' + P.mem; $$('ay-pl-mem-b').style.width = Math.round(USE.mem / P.mem * 100) + '%';
      $$('ay-pl-sal').textContent = USE.sal + ' / ' + P.sal; $$('ay-pl-sal-b').style.width = Math.round(USE.sal / P.sal * 100) + '%'; ADMIN_LIMIT = P.adm; planAdm();
      $$('ay-pl-st').textContent = SUB.cancel ? 'Abonelik 30 Kas\'ta sona erer, sonraki fatura yok.' : 'Sonraki fatura: 1 Aralık, ' + tl(nx.p);
      var note = '';
      if (SUB.cancel) note = '<div class="mnote warn"><span><b>Abonelik dönem sonunda sona eriyor.</b><br><span class="muted">30 Kas\'a kadar her şey çalışır. Sonrasında panel salt okunur olur.</span></span><button type="button" class="btn outline sm" id="ay-pl-undo">İptali geri al</button></div>';
      else if (SUB.pend) note = '<div class="mnote"><span><b>' + nx.n + ' planına geçiş planlandı.</b><br><span class="muted">1 Aralık\'ta geçer, o güne kadar ' + P.n + ' limitleri geçerli.</span></span><button type="button" class="btn outline sm" id="ay-pl-undo">Geçişi iptal et</button></div>';
      $$('ay-pl-note').innerHTML = note; if ($$('ay-pl-undo')) $$('ay-pl-undo').onclick = function () { var c = SUB.cancel; SUB.pend = null; SUB.cancel = false; plRender(); hist('Plan', [c ? 'Abonelik iptali geri alındı' : 'Planlanan geçiş iptal edildi']); toast('Geri alındı'); };
      $$('ay-pl-cs').textContent = SUB.cancel ? 'İptal edildi, 30 Kas\'ta sona erer.' : 'Abonelik etkin.'; $$('ay-pl-cancel').hidden = SUB.cancel;
      $$('ay-pl-card').textContent = SUB.card; $$('ay-pl-card-d').textContent = 'Son kullanma ' + SUB.exp + ' · Sonraki fatura bu karttan alınır.';
      $$('ay-pl-inv').innerHTML = '<ul class="lines" style="padding:0">' + INV.map(function (v, i) { return '<li><div><b style="font-weight:500">' + v[0] + ' 2026 faturası</b><p class="s">' + PLS.studyo.n + ' planı · Ödendi</p></div><span style="display:flex;align-items:center;gap:12px"><span class="tnum">' + tl(v[1]) + '</span><button type="button" class="btn ghost sm" data-inv="' + i + '">İndir</button></span></li>'; }).join('') + '</ul>';
    }
    function plOpen(o) { plCur = o; plOp = document.activeElement; $$('pl-t').textContent = o.t; $$('pl-sub').textContent = o.sub || ''; $$('pl-b').innerHTML = o.body; $$('pl-ok').textContent = o.ok; $$('pl-ok').className = 'btn' + (o.danger ? ' danger' : ''); $$('pl-sheet').hidden = $$('pl-scrim').hidden = false; swap($$('pl-sheet')); if (o.chk) o.chk(); else $$('pl-ok').disabled = false; ($$('pl-sheet').querySelector('input,select') || $$('pl-ok')).focus(); }
    function plClose() { $$('pl-sheet').hidden = $$('pl-scrim').hidden = true; plCur = null; if (plOp && plOp.focus && document.contains(plOp)) plOp.focus(); }
    $$('pl-x').addEventListener('click', plClose); $$('pl-cancel').addEventListener('click', plClose); $$('pl-scrim').addEventListener('click', plClose);
    $$('pl-ok').addEventListener('click', function () { if (!$$('pl-ok').disabled && plCur) plCur.onOk(); });
    $$('pl-sheet').addEventListener('input', function () { if (plCur && plCur.chk) plCur.chk(); }); $$('pl-sheet').addEventListener('change', function () { if (plCur && plCur.chk) plCur.chk(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$$('pl-sheet').hidden) plClose(); });
    function plWhy(k) { var q = PLS[k], r = []; if (USE.mem > q.mem) r.push('üye ' + USE.mem + ' > ' + q.mem); if (USE.sal > q.sal) r.push('salon ' + USE.sal + ' > ' + q.sal); if (admins(0) > q.adm) r.push('yönetici ' + admins(0) + ' > ' + q.adm); return r.length ? 'Kullanımın limiti aşıyor: ' + r.join(', ') + '.' : ''; }
    function plEff(k) {
      var P = PLS[SUB.cur], q = PLS[k], up = q.p > P.p, rows;
      if (k === (SUB.pend || SUB.cur)) return '<p class="muted">Bu zaten ' + (SUB.pend ? 'planlanan' : 'mevcut') + ' planın.</p>';
      if (up) { var d = Math.round((q.p - P.p) * 27 / 30); rows = [['Geçiş', 'Hemen', 'Yeni limitler bugünden geçerli.'], ['Bu dönem farkı', tl(d), 'Kalan 27 gün için orantılı, mevcut karttan alınır.'], ['Sonraki fatura', tl(q.p), '1 Aralık']]; }
      else rows = [['Geçiş', '1 Aralık', 'O güne kadar ' + P.n + ' limitleri geçerli.'], ['Sonraki fatura', tl(q.p), 'İade yok, bu dönem ücreti değişmez.']];
      return '<ul class="aff">' + rows.map(function (r) { return '<li><span class="row-l"><span>' + r[0] + '</span><b class="tnum">' + r[1] + '</b></span><span class="ch">' + r[2] + '</span></li>'; }).join('') + '</ul>';
    }
    $$('ay-plan').addEventListener('click', function () {
      var tgt = SUB.pend || SUB.cur;
      var body = '<div class="field"><div class="scope" role="radiogroup" aria-label="Plan seç">' + PO.map(function (k) { var q = PLS[k], w = k === SUB.cur ? '' : plWhy(k); return '<label class="opt' + (w ? ' ap-off' : '') + '"><input type="radio" name="pl-p" value="' + k + '"' + (k === tgt ? ' checked' : '') + (w ? ' disabled' : '') + '><span><b>' + q.n + ' · ' + tl(q.p) + '/ay' + (k === SUB.cur ? ' (mevcut)' : '') + '</b><small>' + (w || q.mem + ' üye · ' + q.sal + ' salon · ' + q.adm + ' yönetici') + '</small></span></label>'; }).join('') + '</div></div><div id="pl-eff"></div>';
      plOpen({ t: 'Planı değiştir', sub: 'Yükseltme hemen, düşürme dönem sonunda geçer', body: body, ok: 'Planı değiştir', chk: function () { var r = $$('pl-b').querySelector('input[name="pl-p"]:checked'); $$('pl-eff').innerHTML = r ? plEff(r.value) : ''; $$('pl-ok').disabled = !r || r.value === (SUB.pend || SUB.cur); },
        onOk: function () { var k = $$('pl-b').querySelector('input[name="pl-p"]:checked').value, q = PLS[k], P = PLS[SUB.cur];
          if (q.p > P.p) { SUB.cur = k; SUB.pend = null; hist('Plan', ['Plan: ' + P.n + ' → ' + q.n, 'Hemen geçti']); } else if (k === SUB.cur) { SUB.pend = null; hist('Plan', ['Planlanan geçiş iptal edildi']); } else { SUB.pend = k; hist('Plan', ['Plan geçişi planlandı: ' + P.n + ' → ' + q.n, '1 Aralık']); }
          plClose(); plRender(); toast(SUB.pend ? 'Geçiş 1 Aralık için planlandı' : 'Plan güncellendi'); } });
    });
    $$('ay-pl-cardb').addEventListener('click', function () {
      plOpen({ t: 'Kartı güncelle', sub: 'Kart bilgisi bu tasarımda kaydedilmez', ok: 'Kartı kaydet', body: '<div class="field"><label class="label" for="pc-n">Kart numarası</label><input class="input" id="pc-n" inputmode="numeric" autocomplete="cc-number" placeholder="0000 0000 0000 0000"><span class="hint" id="pc-nh"></span></div><div class="form-grid" style="grid-template-columns:repeat(2,minmax(0,1fr))"><div class="field"><label class="label" for="pc-e">Son kullanma</label><input class="input" id="pc-e" inputmode="numeric" autocomplete="cc-exp" placeholder="AA/YY"></div><div class="field"><label class="label" for="pc-c">CVC</label><input class="input" id="pc-c" inputmode="numeric" autocomplete="cc-csc" maxlength="4"></div></div>',
        chk: function () { var n = $$('pc-n').value.replace(/\s/g, ''), e = $$('pc-e').value.trim(), c = $$('pc-c').value.trim(); var okN = /^\d{15,16}$/.test(n), m = /^(0[1-9]|1[0-2])\/(\d\d)$/.exec(e), okE = !!m && +m[2] >= 26, okC = /^\d{3,4}$/.test(c); $$('pc-nh').textContent = n && !okN ? '15 veya 16 haneli kart numarası yaz.' : ''; $$('pl-ok').disabled = !(okN && okE && okC); },
        onOk: function () { var n = $$('pc-n').value.replace(/\s/g, ''); SUB.card = (n[0] === '5' ? 'Mastercard' : 'Visa') + ' •••• ' + n.slice(-4); SUB.exp = $$('pc-e').value.trim(); plClose(); plRender(); hist('Plan', ['Ödeme kartı güncellendi: ' + SUB.card]); toast('Kart güncellendi'); } });
    });
    $$('ay-pl-cancel').addEventListener('click', function () {
      plOpen({ t: 'Aboneliği iptal et', sub: 'İptal dönem sonunda geçerli olur', ok: 'Aboneliği iptal et', danger: true, body: '<ul class="aff"><li><span class="row-l"><span>Kullanım</span><b class="tnum">30 Kas\'a kadar</b></span><span class="ch">Üyeler ve yönetim çalışmaya devam eder.</span></li><li><span class="row-l"><span>Sonraki fatura</span><b class="tnum">Yok</b></span><span class="ch">İade yapılmaz.</span></li><li><span class="row-l"><span>Veriler</span><b class="tnum">Saklanır</b></span><span class="ch">Sona erince panel salt okunur olur, istediğin zaman yeniden başlatabilirsin.</span></li></ul><div class="field" style="margin-top:12px"><label class="label" for="pc-w">İptal nedeni<span class="hint">İsteğe bağlı</span></label><select class="select" id="pc-w"><option>Seçmek istemiyorum</option><option>Çok pahalı</option><option>Kullanmıyorum</option><option>Başka bir araca geçiyorum</option></select></div>',
        onOk: function () { SUB.cancel = true; plClose(); plRender(); hist('Plan', ['Abonelik iptal edildi', '30 Kas\'ta sona erer']); toast('Abonelik dönem sonunda sona erecek'); } });
    });
    $$('ay-pl-inv').addEventListener('click', function (e) { var b = e.target.closest('[data-inv]'); if (b) toast(INV[+b.getAttribute('data-inv')][0] + ' faturası indirilecek (PDF, tasarımda dosya yok)'); });
    plRender();
    swap(view);
  })();

  /* ---------- Otomasyon (A6): segment, otomasyon, son işler. Kurgusal veri; üyeler Üyeler ile aynı kaynaktan ---------- */
  (function () {
    var $$ = function (id) { return document.getElementById(id); };
    var view = document.querySelector('[data-view="otomasyon"]');
    var esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); };
    var stu = SHARED.stu(), REM = SHARED.rem;
    var MAILOFF = { 2: true };
    var MON = { oca: 1, 'şub': 2, mar: 3, nis: 4, may: 5, haz: 6, tem: 7, 'ağu': 8, eyl: 9, eki: 10, kas: 11, ara: 12 };
    function endDays(s) {
      var e = (s.per.split(' - ')[1] || '').split(' '), m = MON[(e[1] || '').slice(0, 3).toLocaleLowerCase('tr')] || 12, y = m <= 2 ? 2027 : 2026;
      return Math.round((Date.UTC(y, m - 1, +e[0]) - Date.UTC(2026, 10, 4)) / 86400000);
    }
    var CONDS = {
      low: { t: 'Kalan hak', u: 'hak veya daha az', v: 2, num: true, test: function (s, v) { return s.k === 'c' && s.av <= v; } },
      ending: { t: 'Paketin bitişine', u: 'gün veya daha az kaldı', v: 30, num: true, test: function (s, v) { var d = endDays(s); return d >= 0 && d <= v; } },
      debt: { t: 'Açık borcu var', test: function (s) { return s.debt > 0; } },
      nonext: { t: 'Yaklaşan rezervasyonu yok', test: function (s) { return !s.next; } },
      kind: { t: 'Hak türü', opts: [['c', 'Ders sayılı'], ['t', 'Süreli']], v: 'c', test: function (s, v) { return s.k === v; } }
    };
    function cText(c) { var d = CONDS[c.k]; return d.num ? d.t + ' ' + c.v + ' ' + d.u : d.opts ? d.t + ': ' + d.opts.filter(function (o) { return o[0] === c.v; })[0][1] : d.t; }
    function match(cs) { return stu.filter(function (s) { return s.on && cs.every(function (c) { return CONDS[c.k].test(s, c.v); }); }); }
    var SEG = [
      { id: 1, n: 'Hakkı azalanlar', c: [{ k: 'low', v: 2 }] },
      { id: 2, n: 'Paketi 30 gün içinde bitecekler', c: [{ k: 'ending', v: 30 }] },
      { id: 3, n: 'Açık borcu olanlar', c: [{ k: 'debt' }] },
      { id: 4, n: 'Yaklaşan dersi olmayanlar', c: [{ k: 'nonext' }] },
      { id: 5, n: 'Ders sayılı, hakkı az', c: [{ k: 'kind', v: 'c' }, { k: 'low', v: 6 }] }
    ];
    var TPL0 = ['Paket bitiş hatırlatması', 'Hak azaldı bildirimi', 'Ders planı hatırlatması', 'Borç hatırlatması'];
    function tplList() { return SHARED.tpl ? SHARED.tpl() : TPL0; }
    SHARED.otUse = function (n) { return AUTO.filter(function (a) { return a.act === 'mail' && a.tpl === n; }).map(function (a) { return a.n; }); };
    var TRIG = { enter: 'Segmente girdiğinde', weekly: 'Segmentteyken, haftada en çok bir kez' };
    var AUTO = [
      { id: 1, n: 'Paket bitişi hatırlatması', seg: 2, trig: 'weekly', act: 'mail', tpl: 'Paket bitiş hatırlatması', on: true, sent: { 1: 4, 4: 4 } },
      { id: 2, n: 'Hak azalınca takip görevi', seg: 1, trig: 'enter', act: 'task', own: 'Ayşe Y.', tx: 'Paket yenilemesi için ara', on: true, sent: { 5: 4 } },
      { id: 3, n: 'Borç hatırlatması', seg: 3, trig: 'weekly', act: 'mail', tpl: 'Borç hatırlatması', on: false, sent: {} },
      { id: 4, n: 'Yaklaşan dersi olmayan üyeye mesaj', seg: 4, trig: 'weekly', act: 'mail', tpl: 'Ders planı hatırlatması', on: true, sent: { 12: 4 } }
    ];
    var JOBS = [
      { id: 3, a: 4, at: '4 Kas 08:02', by: 'Zamanlanmış', st: 'partial', m: { acc: 1, del: 1, of: 2 }, retry: true, hist: [],
        lines: [{ n: 'Tolga Yıldız', s: 'ok', t: 'E-posta kabul edildi, teslim edildi' }, { n: 'Kerem Zorlu', s: 'fail', t: 'E-posta sağlayıcısı geçici olarak yanıt vermedi, yeniden denenebilir' }] },
      { id: 1, a: 1, at: '4 Kas 08:00', by: 'Zamanlanmış', st: 'done', m: { acc: 2, del: 1, of: 2 }, retry: false, hist: [],
        lines: [{ n: 'Cem Demir', s: 'ok', t: 'E-posta kabul edildi, teslim edildi' }, { n: 'Merve Tan', s: 'ok', t: 'E-posta kabul edildi, teslim bekleniyor' }] },
      { id: 2, a: 2, at: '4 Kas 08:00', by: 'Zamanlanmış', st: 'done', m: null, retry: false, hist: [], lines: [{ n: 'Onur Çelik', s: 'ok', t: 'Takip görevi oluşturuldu, sorumlu Ayşe Y.' }] },
      { id: 4, a: 3, at: '1 Kas 09:15', by: 'Ayşe Y., elle', st: 'failed', m: { acc: 0, del: 0, of: 1 }, retry: false, hist: [], lines: [{ n: 'Kerem Zorlu', s: 'fail', t: 'İş başlamadan durdu, şablon arşivlenmişti. Yeniden denenemez, otomasyonu düzeltip elle çalıştır.' }] }
    ];
    var jid = 10, tick = 21, tab = 'auto', sgCur = null, auCur = null;
    function segOf(id) { return SEG.filter(function (x) { return x.id === id; })[0]; }
    function autoOf(id) { return AUTO.filter(function (x) { return x.id === id; })[0]; }
    function jobOf(id) { return JOBS.filter(function (x) { return x.id === id; })[0]; }
    function usedBy(sid) { return AUTO.filter(function (a) { return a.seg === sid; }); }
    function lastJob(a) { return JOBS.filter(function (j) { return j.a === a.id; })[0]; }
    function retryN() { return JOBS.filter(function (j) { return j.retry; }).length; }
    var STB = { done: ['ok', 'Tamamlandı'], partial: ['', 'Kısmen tamamlandı'], failed: ['bad', 'Başarısız'], wait: ['soft', 'Beklemede'] };
    function stBadge(j) { var b = STB[j.st]; return '<span class="badge ' + b[0] + '">' + b[1] + '</span>'; }
    function whenText(a) { var s = segOf(a.seg); return '<b style="font-weight:500">' + esc(s ? s.n : 'Segment silinmiş') + '</b><span class="muted" style="display:block;font-size:12px">' + TRIG[a.trig] + '</span>'; }
    function whatText(a) { return a.act === 'mail' ? 'E-posta: ' + esc(a.tpl) : a.act === 'task' ? 'Görev: ' + esc(a.tx) + ' (' + esc(a.own) + ')' : 'Gelen kutusu uyarısı: ' + esc(a.tx); }

    function side() { var c = document.querySelector('[data-route="otomasyon"] .count'); if (c) { var n = retryN(); c.textContent = n; c.hidden = !n; } }
    function banner() {
      var n = retryN(), b = $$('ot-banner');
      b.innerHTML = n ? '<p class="mg-warn" style="margin-bottom:16px"><i data-i="ban"></i><span>' + n + ' iş yeniden denenebilir. Başarılı olanlar tekrar gönderilmez. <button type="button" class="btn outline sm" data-jump="jobs" style="margin-left:8px">Son işlere git</button></span></p>' : '';
      swap(b);
    }
    function render() {
      $$('ot-auto').innerHTML = AUTO.map(function (a) {
        var j = lastJob(a);
        return '<tr><td><b style="font-weight:500">' + esc(a.n) + '</b></td><td>' + whenText(a) + '</td><td>' + whatText(a) + '</td><td>' + (j ? '<span class="tnum muted" style="display:block;font-size:12px">' + j.at + '</span>' + stBadge(j) : '<span class="muted">Henüz çalışmadı</span>') + '</td>' +
          '<td class="r" style="white-space:nowrap"><button type="button" class="btn outline sm" data-au="' + a.id + '">Düzenle</button> <button type="button" class="btn outline sm" data-run="' + a.id + '">Şimdi çalıştır</button></td>' +
          '<td><input type="checkbox" class="switch" role="switch" data-asw="' + a.id + '" aria-label="' + esc(a.n) + ' açık"' + (a.on ? ' checked' : '') + '></td></tr>';
      }).join('');
      $$('ot-auto-c').textContent = AUTO.length + ' otomasyon, ' + AUTO.filter(function (a) { return a.on; }).length + ' açık';
      $$('ot-seg').innerHTML = SEG.map(function (s) {
        var u = usedBy(s.id);
        return '<tr><td><b style="font-weight:500">' + esc(s.n) + '</b></td><td>' + s.c.map(function (c) { return '<span class="badge soft" style="margin:0 4px 4px 0">' + esc(cText(c)) + '</span>'; }).join('') + '</td><td class="r tnum">' + match(s.c).length + '</td>' +
          '<td>' + (u.length ? u.map(function (a) { return esc(a.n); }).join(', ') : '<span class="muted">Kullanılmıyor</span>') + '</td><td class="r"><button type="button" class="btn outline sm" data-sg="' + s.id + '">Düzenle</button></td></tr>';
      }).join('');
      $$('ot-jobs').innerHTML = JOBS.map(function (j) {
        var a = autoOf(j.a), m = j.m;
        return '<tr><td class="tnum">' + j.at + '</td><td>' + esc(a ? a.n : '') + '</td><td>' + esc(j.by) + '</td><td>' + stBadge(j) + (j.retry ? '<span class="badge soft" style="margin-left:4px">Yeniden denenebilir</span>' : '') + '</td><td class="r tnum">' + j.lines.length + '</td>' +
          '<td class="r tnum">' + (m ? m.acc + ' / ' + m.of : '–') + '</td><td class="r tnum">' + (m ? m.del + ' / ' + m.acc + (m.del < m.acc ? '<span class="muted" style="display:block;font-size:12px">teslim bekleniyor</span>' : '') : '–') + '</td>' +
          '<td class="r"><button type="button" class="btn outline sm" data-jb="' + j.id + '">Ayrıntı</button></td></tr>';
      }).join('');
      $$('ot-n-auto').textContent = AUTO.length; $$('ot-n-seg').textContent = SEG.length;
      var rn = retryN(); $$('ot-n-jobs').hidden = !rn; $$('ot-n-jobs').textContent = rn;
      banner(); side(); swap(view);
    }
    SHARED.otRefresh = render;
    function setTab(t) {
      tab = t;
      view.querySelectorAll('[data-ot]').forEach(function (b) { b.setAttribute('aria-selected', String(b.getAttribute('data-ot') === t)); });
      view.querySelectorAll('[data-op]').forEach(function (p) { p.hidden = p.getAttribute('data-op') !== t; });
      var add = $$('ot-add'); add.hidden = t === 'jobs'; add.querySelector('span').textContent = t === 'seg' ? 'Segment ekle' : 'Otomasyon ekle';
    }
    $$('ot-tabs').addEventListener('click', function (e) { var b = e.target.closest('[data-ot]'); if (b) setTab(b.getAttribute('data-ot')); });

    /* Ortak onay iletişim kutusu */
    var dlgFn = null;
    function dlg(o) {
      $$('od-t').textContent = o.t; $$('od-b').innerHTML = o.b;
      var ok = $$('od-ok'); ok.hidden = !o.ok; ok.textContent = o.ok || ''; ok.disabled = !!o.dis; ok.className = 'btn' + (o.danger ? ' danger' : '');
      $$('od-cancel').textContent = o.ok ? 'Vazgeç' : 'Kapat'; dlgFn = o.fn;
      $$('od-dlg').hidden = false; $$('od-scrim').hidden = false; swap($$('od-dlg')); (o.ok && !o.dis ? ok : $$('od-cancel')).focus();
    }
    function dlgClose() { $$('od-dlg').hidden = true; $$('od-scrim').hidden = true; dlgFn = null; }
    $$('od-cancel').addEventListener('click', dlgClose); $$('od-scrim').addEventListener('click', dlgClose);
    $$('od-ok').addEventListener('click', function () { var f = dlgFn; dlgClose(); if (f) f(); });
    function rowsHtml(items) { return '<ul class="aff">' + items.map(function (i) { return '<li><div class="row-l"><span>' + esc(i[0]) + '</span><span class="' + (i[2] ? '' : 'muted') + ' tnum">' + esc(i[1]) + '</span></div></li>'; }).join('') + '</ul>'; }

    /* Elle çalıştırma: önizleme, sonra onay (automation_run) */
    function inQuietNow() {
      if (!REM.qon || !REM.qa || !REM.qb || REM.qa === REM.qb) return false;
      var m = 14 * 60 + 20, a = +REM.qa.slice(0, 2) * 60 + +REM.qa.slice(3), b = +REM.qb.slice(0, 2) * 60 + +REM.qb.slice(3);
      return a < b ? m >= a && m < b : m >= a || m < b;
    }
    function pendingRetry(a, s) { return JOBS.some(function (j) { return j.a === a.id && j.retry && j.lines.some(function (l) { return l.n === s.n && l.s === 'fail'; }); }); }
    function plan(a) {
      var seg = segOf(a.seg), ms = seg ? match(seg.c) : [], el = [], sk = [];
      ms.forEach(function (s) {
        var why = '';
        if (a.act === 'mail' && MAILOFF[s.id]) why = 'E-posta bildirim izni yok';
        else if (a.act === 'mail' && pendingRetry(a, s)) why = 'Yeniden denenecek iş bekliyor';
        else if (a.sent[s.id] != null && 4 - a.sent[s.id] < 7) why = 'Son 7 günde işlendi';
        if (why) sk.push([s, why]); else el.push(s);
      });
      return { el: el, sk: sk, ms: ms, seg: seg };
    }
    function runPrev(a) {
      var p = plan(a), items = [];
      if (!p.seg) { dlg({ t: 'Çalıştırılamaz', b: '<p class="muted">Bu otomasyonun segmenti silinmiş. Düzenleyip bir segment seç.</p>' }); return; }
      if (a.act === 'mail' && !REM.mail) { dlg({ t: 'Çalıştırılamaz', b: '<p class="muted">E-posta kanalı kapalı. Ayarlar > Bildirimler bölümünden aç.</p>' }); return; }
      if (a.act === 'mail' && SHARED.tplArchived && SHARED.tplArchived(a.tpl)) { dlg({ t: 'Çalıştırılamaz', b: '<p class="muted">' + esc(a.tpl) + ' şablonu arşivde. Otomasyonda başka bir şablon seç ya da şablonu Ayarlar > Şablonlar bölümünden yayına al.</p>' }); return; }
      p.el.forEach(function (s) { items.push([s.n, a.act === 'mail' ? 'E-posta gönderilecek' : a.act === 'task' ? 'Görev açılacak' : 'Uyarı düşecek', true]); });
      p.sk.forEach(function (x) { items.push([x[0].n, 'Atlanacak: ' + x[1], false]); });
      var q = a.act === 'mail' && inQuietNow(), body = '<p class="muted">' + esc(a.n) + ' · ' + esc(p.seg.n) + ' · şu an ' + p.ms.length + ' üye eşleşiyor.</p>' + (items.length ? rowsHtml(items) : '<p class="muted">Segmentte şu an eşleşen üye yok.</p>') +
        (q ? '<p class="note" style="margin:0"><i data-i="clock"></i><span>Sessiz saatteyiz. E-postalar ' + esc(REM.qb) + ' olunca gönderilecek, iş Beklemede görünür.</span></p>' : '') +
        '<p class="note" style="margin:0"><i data-i="lock"></i><span>Aynı üyeye 7 gün içinde ikinci kez işlem yapılmaz. Tekrar gönderim tek sonuç üretir.</span></p>';
      dlg({ t: 'Şimdi çalıştır', b: body, ok: p.el.length ? p.el.length + ' üye için çalıştır' : 'Yeni üye yok', dis: !p.el.length, fn: function () { runApply(a, p, q); } });
    }
    function runApply(a, p, q) {
      var at = '4 Kas 14:' + (tick++), lines = [];
      p.el.forEach(function (s) { a.sent[s.id] = 4; lines.push({ n: s.n, s: 'ok', t: a.act === 'mail' ? (q ? 'E-posta sırada, gönderim ' + REM.qb : 'E-posta kabul edildi, teslim bekleniyor') : a.act === 'task' ? 'Takip görevi oluşturuldu, sorumlu ' + a.own : 'Gelen kutusu uyarısı oluşturuldu' }); });
      p.sk.forEach(function (x) { lines.push({ n: x[0].n, s: 'skip', t: 'Atlandı: ' + x[1] }); });
      JOBS.unshift({ id: jid++, a: a.id, at: at, by: 'Ayşe Y., elle', st: q ? 'wait' : 'done', m: a.act === 'mail' ? { acc: q ? 0 : p.el.length, del: 0, of: p.el.length } : null, retry: false, hist: [], lines: lines });
      render(); toast(a.n + ' çalıştırıldı, ' + p.el.length + ' üye');
    }
    /* Yeniden dene: yalnız retry_available */
    function retryPrev(j) {
      var a = autoOf(j.a) || { n: 'Silinmiş otomasyon', sent: {} }, bad = j.lines.filter(function (l) { return l.s === 'fail'; }), good = j.lines.filter(function (l) { return l.s === 'ok'; });
      var items = bad.map(function (l) { return [l.n, 'Yeniden denenecek', true]; }).concat(good.map(function (l) { return [l.n, 'Tekrar gönderilmez', false]; }));
      dlg({ t: 'Başarısız satırları yeniden dene', b: '<p class="muted">' + esc(a.n) + ' · ' + j.at + '</p>' + rowsHtml(items), ok: bad.length + ' satırı yeniden dene', fn: function () {
        var at = '4 Kas 14:' + (tick++);
        bad.forEach(function (l) { l.s = 'ok'; l.t = 'E-posta kabul edildi, teslim bekleniyor (yeniden deneme ' + at + ')'; var s = stu.filter(function (x) { return x.n === l.n; })[0]; if (s) a.sent[s.id] = 4; });
        j.m.acc += bad.length; j.st = 'done'; j.retry = false; j.hist.push(at + ' yeniden deneme, ' + bad.length + ' satır');
        if (SHARED.ibDone) SHARED.ibDone(11); render(); toast('Yeniden deneme tamamlandı, ' + bad.length + ' satır');
      } });
    }
    function jobDetail(j) {
      var a = autoOf(j.a), ICON = { ok: 'Başarılı', fail: 'Hata', skip: 'Atlandı' };
      var body = '<p class="muted">' + esc(a ? a.n : '') + ' · ' + j.at + ' · ' + esc(j.by) + '</p>' + rowsHtml(j.lines.map(function (l) { return [l.n, ICON[l.s] + ': ' + l.t, l.s === 'fail']; })) +
        (j.hist.length ? '<p class="sub" style="margin:0">Geçmiş</p><ul class="aff">' + j.hist.map(function (h) { return '<li><span class="ch tnum">' + esc(h) + '</span></li>'; }).join('') + '</ul>' : '');
      dlg({ t: 'İş ayrıntısı', b: body, ok: j.retry ? 'Başarısız satırları yeniden dene' : '', fn: j.retry ? function () { retryPrev(j); } : null });
    }

    /* Anahtar: anında uygulanır */
    $$('ot-auto').addEventListener('change', function (e) {
      var sw = e.target.closest('[data-asw]'); if (!sw) return; var a = autoOf(+sw.getAttribute('data-asw'));
      if (sw.checked) {
        if (!segOf(a.seg)) { sw.checked = false; toast('Segment silinmiş, önce düzenle'); return; }
        if (a.act === 'mail' && !REM.mail) { sw.checked = false; toast('E-posta kanalı kapalı, Ayarlar > Bildirimler\'den aç'); return; }
      }
      a.on = sw.checked; render(); toast(a.n + (a.on ? ' açıldı' : ' kapatıldı'));
    });
    view.addEventListener('click', function (e) {
      var t;
      if ((t = e.target.closest('[data-au]'))) auOpen(autoOf(+t.getAttribute('data-au')));
      else if ((t = e.target.closest('[data-run]'))) runPrev(autoOf(+t.getAttribute('data-run')));
      else if ((t = e.target.closest('[data-sg]'))) sgOpen(segOf(+t.getAttribute('data-sg')));
      else if ((t = e.target.closest('[data-jb]'))) jobDetail(jobOf(+t.getAttribute('data-jb')));
      else if ((t = e.target.closest('[data-jump]'))) setTab(t.getAttribute('data-jump'));
    });
    $$('ot-add').addEventListener('click', function () { if (tab === 'seg') sgOpen(null); else auOpen(null); });

    /* Segment çekmecesi (segment_save) */
    var sgOp = null;
    function sgEls() { return { sh: $$('sg-sheet'), sc: $$('sg-scrim') }; }
    function sgOpen(s) {
      sgOp = document.activeElement;
      sgCur = s ? { id: s.id, n: s.n, c: s.c.map(function (c) { return { k: c.k, v: c.v }; }) } : { id: null, n: '', c: [] };
      $$('sg-title').textContent = s ? 'Segmenti düzenle' : 'Segment ekle'; $$('sg-sub').textContent = s ? s.n : 'Koşulları seç, eşleşen üyeleri anında gör.';
      $$('sg-n').value = sgCur.n; $$('sg-del').hidden = !s; sgPaint();
      var e = sgEls(); e.sh.hidden = false; e.sc.hidden = false; $$('sg-n').focus();
    }
    function sgClose() { var e = sgEls(); e.sh.hidden = true; e.sc.hidden = true; if (sgOp) sgOp.focus(); }
    function sgPaint() {
      $$('sg-conds').innerHTML = sgCur.c.map(function (c, i) {
        var d = CONDS[c.k];
        return '<div style="display:flex;gap:8px;align-items:center"><span style="flex:1">' + d.t + '</span>' +
          (d.num ? '<input class="input tnum" style="width:4.5rem;height:32px" data-cv="' + i + '" value="' + c.v + '" inputmode="numeric" aria-label="' + d.t + ' değeri"><span class="muted" style="flex:1.4;font-size:13px">' + d.u + '</span>' :
            d.opts ? '<select class="select" style="width:auto;height:32px" data-cv="' + i + '" aria-label="' + d.t + '">' + d.opts.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === c.v ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select><span style="flex:1"></span>' : '<span style="flex:2"></span>') +
          '<button type="button" class="btn ghost icon sm" data-cx="' + i + '" aria-label="Koşulu kaldır"><i data-i="x"></i></button></div>';
      }).join('') || '<p class="muted" style="margin:0;font-size:13px">Henüz koşul yok.</p>';
      var have = sgCur.c.map(function (c) { return c.k; });
      $$('sg-add').innerHTML = '<option value="">Koşul ekle</option>' + Object.keys(CONDS).filter(function (k) { return have.indexOf(k) < 0; }).map(function (k) { return '<option value="' + k + '">' + CONDS[k].t + '</option>'; }).join('');
      sgCheck(); swap($$('sg-sheet'));
    }
    function sgValid() { return sgCur.c.every(function (c) { return !CONDS[c.k].num || (/^\d+$/.test(String(c.v)) && +c.v >= 1 && +c.v <= 365); }); }
    function sgCheck() {
      var n = sgCur.n.trim(), e = '';
      if (!n) e = 'Segment adı gerekli.';
      else if (SEG.some(function (s) { return s.id !== sgCur.id && s.n.toLocaleLowerCase('tr') === n.toLocaleLowerCase('tr'); })) e = 'Bu adla başka bir segment var.';
      else if (!sgCur.c.length) e = 'En az bir koşul ekle. Koşulsuz segment tüm aktif üyeleri kapsar.';
      else if (!sgValid()) e = 'Sayısal koşullar 1 ile 365 arasında olmalı.';
      var w = $$('sg-err'); w.hidden = !e; w.querySelector('span').textContent = e; $$('sg-save').disabled = !!e;
      var ms = sgValid() ? match(sgCur.c) : [];
      $$('sg-res').innerHTML = '<li><div class="row-l"><span><b style="font-weight:500">' + ms.length + ' üye</b></span><span class="muted">yalnız aktif üyeler</span></div>' + (ms.length ? '<span class="ch">' + ms.map(function (s) { return esc(s.n) + (MAILOFF[s.id] ? ' (e-posta izni yok)' : ''); }).join(', ') + '</span>' : '<span class="ch">Şu an eşleşen üye yok, segment yine de kaydedilebilir.</span>') + '</li>';
      var u = sgCur.id ? usedBy(sgCur.id) : []; $$('sg-del').disabled = !!u.length; $$('sg-del').title = u.length ? 'Kullanan otomasyon: ' + u.map(function (a) { return a.n; }).join(', ') : '';
    }
    $$('sg-n').addEventListener('input', function () { sgCur.n = this.value; sgCheck(); });
    $$('sg-add').addEventListener('change', function () { var k = this.value; if (!k) return; var d = CONDS[k], c = { k: k }; if (d.v != null) c.v = d.v; sgCur.c.push(c); sgPaint(); });
    $$('sg-conds').addEventListener('input', function (e) { var i = e.target.getAttribute('data-cv'); if (i == null) return; sgCur.c[+i].v = CONDS[sgCur.c[+i].k].num ? e.target.value.trim() : e.target.value; sgCheck(); });
    $$('sg-conds').addEventListener('click', function (e) { var b = e.target.closest('[data-cx]'); if (!b) return; sgCur.c.splice(+b.getAttribute('data-cx'), 1); sgPaint(); });
    $$('sg-save').addEventListener('click', function () {
      if ($$('sg-save').disabled) return;
      var o = { id: sgCur.id || (Math.max.apply(null, SEG.map(function (s) { return s.id; })) + 1), n: sgCur.n.trim(), c: sgCur.c.map(function (c) { return CONDS[c.k].num ? { k: c.k, v: +c.v } : c; }) };
      if (sgCur.id) SEG[SEG.indexOf(segOf(sgCur.id))] = o; else SEG.push(o);
      sgClose(); render(); toast('Segment kaydedildi, ' + match(o.c).length + ' üye eşleşiyor');
    });
    $$('sg-del').addEventListener('click', function () {
      if ($$('sg-del').disabled) return; var s = segOf(sgCur.id);
      dlg({ t: 'Segmenti sil', b: '<p class="muted">' + esc(s.n) + ' silinecek. Kullanan otomasyon yok, üyelere ve geçmiş işlere dokunulmaz.</p>', ok: 'Segmenti sil', danger: true, fn: function () { SEG.splice(SEG.indexOf(s), 1); sgClose(); render(); toast('Segment silindi'); } });
    });
    $$('sg-x').addEventListener('click', sgClose); $$('sg-cancel').addEventListener('click', sgClose); $$('sg-scrim').addEventListener('click', sgClose);

    /* Otomasyon çekmecesi (automation_save) */
    var auOp = null;
    function auOpen(a) {
      auOp = document.activeElement;
      auCur = a ? { id: a.id } : { id: null };
      $$('au-title').textContent = a ? 'Otomasyonu düzenle' : 'Otomasyon ekle'; $$('au-sub').textContent = a ? a.n : 'Yeni otomasyon kapalı başlar, istersen açarsın.';
      $$('au-s').innerHTML = SEG.map(function (s) { return '<option value="' + s.id + '">' + esc(s.n) + '</option>'; }).join('') + (a && !segOf(a.seg) ? '<option value="">Silinmiş segment</option>' : '');
      $$('au-tpl').innerHTML = tplList().map(function (t) { return '<option>' + t + '</option>'; }).join('');
      var d = a || { n: '', seg: SEG[0].id, trig: 'weekly', act: 'mail', tpl: tplList()[0], own: 'Ayşe Y.', tx: '', on: false };
      $$('au-n').value = d.n; $$('au-s').value = d.seg == null || !segOf(d.seg) ? '' : d.seg; $$('au-t').value = d.trig; $$('au-a').value = d.act; $$('au-tpl').value = d.tpl || tplList()[0]; $$('au-own').value = d.own || 'Ayşe Y.'; $$('au-tx').value = d.tx || ''; $$('au-on').checked = !!d.on;
      $$('au-del').hidden = !a; auCheck(); $$('au-sheet').hidden = false; $$('au-scrim').hidden = false; $$('au-n').focus(); swap($$('au-sheet'));
    }
    function auClose() { $$('au-sheet').hidden = true; $$('au-scrim').hidden = true; if (auOp) auOp.focus(); }
    function auCheck() {
      var act = $$('au-a').value, n = $$('au-n').value.trim(), sid = +$$('au-s').value, e = '';
      $$('au-tpl-w').hidden = act !== 'mail'; $$('au-own-w').hidden = act !== 'task'; $$('au-tx-w').hidden = act === 'mail'; $$('au-tx-l').textContent = act === 'task' ? 'Görev metni' : 'Uyarı başlığı';
      if (!n) e = 'Otomasyon adı gerekli.';
      else if (AUTO.some(function (a) { return a.id !== auCur.id && a.n.toLocaleLowerCase('tr') === n.toLocaleLowerCase('tr'); })) e = 'Bu adla başka bir otomasyon var.';
      else if (!segOf(sid)) e = 'Bir segment seç.';
      else if (act !== 'mail' && !$$('au-tx').value.trim()) e = act === 'task' ? 'Görev metni gerekli.' : 'Uyarı başlığı gerekli.';
      else if (act === 'mail' && $$('au-on').checked && !REM.mail) e = 'E-posta kanalı kapalı. Ayarlar > Bildirimler bölümünden aç ya da bu otomasyonu kapalı kaydet.';
      var w = $$('au-err'); w.hidden = !e; w.querySelector('span').textContent = e; $$('au-save').disabled = !!e;
      var seg = segOf(sid), cnt = seg ? match(seg.c).length : 0, eff = [];
      eff.push('Segment şu an ' + cnt + ' üye eşleşiyor.');
      if (act === 'mail') { eff.push('E-posta yalnızca bildirim izni olan üyeye gider, izni olmayan atlanır.'); eff.push('Sessiz saatte gönderim saat ' + (REM.qon ? REM.qb : 'sınırsız') + (REM.qon ? ' olunca yapılır.' : ', sessiz saat kapalı.')); }
      else if (act === 'task') eff.push('Yönetici görevi ' + $$('au-own').value + ' için açılır, üyeye mesaj gitmez.');
      else eff.push('Gelen kutusunda İşlem bekliyor uyarısı oluşur, üyeye mesaj gitmez.');
      eff.push('Aynı üyeye 7 gün içinde en çok bir kez işlem yapılır.'); eff.push('Hata olursa iş durur, otomatik yeniden deneme yok. Denenebilir işleri sen yeniden dersin.');
      $$('au-eff').innerHTML = eff.map(function (x) { return '<li><span class="ch" style="color:var(--foreground)">' + esc(x) + '</span></li>'; }).join('');
    }
    $$('au-form').addEventListener('input', auCheck); $$('au-form').addEventListener('change', auCheck); $$('au-form').addEventListener('submit', function (e) { e.preventDefault(); });
    $$('au-save').addEventListener('click', function () {
      if ($$('au-save').disabled) return; var act = $$('au-a').value;
      var o = { n: $$('au-n').value.trim(), seg: +$$('au-s').value, trig: $$('au-t').value, act: act, on: $$('au-on').checked };
      if (act === 'mail') o.tpl = $$('au-tpl').value; else { o.tx = $$('au-tx').value.trim(); if (act === 'task') o.own = $$('au-own').value; }
      if (auCur.id) { var a = autoOf(auCur.id); o.id = a.id; o.sent = a.sent; AUTO[AUTO.indexOf(a)] = o; } else { o.id = Math.max.apply(null, AUTO.map(function (x) { return x.id; })) + 1; o.sent = {}; AUTO.push(o); }
      auClose(); render(); toast('Otomasyon kaydedildi' + (o.on ? ', açık' : ', kapalı'));
    });
    $$('au-del').addEventListener('click', function () {
      var a = autoOf(auCur.id);
      dlg({ t: 'Otomasyonu sil', b: '<p class="muted">' + esc(a.n) + ' silinecek. Geçmiş işler kayıtta kalır.</p>', ok: 'Otomasyonu sil', danger: true, fn: function () { AUTO.splice(AUTO.indexOf(a), 1); auClose(); render(); toast('Otomasyon silindi'); } });
    });
    $$('au-x').addEventListener('click', auClose); $$('au-cancel').addEventListener('click', auClose); $$('au-scrim').addEventListener('click', auClose);

    setTab('auto'); render(); if (SHARED.tpRefresh) SHARED.tpRefresh();
  })();

  /* ---------- Eğitmen rol görünümü (kurgusal veri; Elif K. olarak giriş). Yönetim kabuğunda sadeleştirilmiş görünüm ---------- */
  (function () {
    var $$ = function (id) { return document.getElementById(id); };
    var ME = 'Elif K.', TODAY = new Date(2026, 10, 4), NOW = 14 * 60 + 20, STUDIO_OFF = -180;
    var DN = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'], DL = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'], MN = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
    var ALLOWED = ['egt-bugun', 'egt-program', 'egt-seans', 'egt-hakedis', 'hesap', 'yardim'];
    var role = 'admin', cur = null, from = 'egt-bugun', wkOff = 0, ehTab = 'lines';
    var ST = {};
    function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
    function iso(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
    function addD(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
    function mon(d) { var x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); x.setHours(0, 0, 0, 0); return x; }
    function pad(n) { return ('0' + n).slice(-2); }
    function hm(m) { return pad(Math.floor(m / 60)) + ':' + pad(m % 60); }
    function pm(t) { var p = (t || '').split(':'); return p.length === 2 && p[0] !== '' ? +p[0] * 60 + +p[1] : NaN; }
    function fd(d) { return d.getDate() + ' ' + MN[d.getMonth()]; }
    function money(n) { return (n < 0 ? '-' : '') + '₺' + String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
    function isToday(d) { return iso(d) === iso(TODAY); }

    /* Saat dilimi: kayıtlar hep stüdyo saatiyle tutulur, cihaz saati yalnız gösterimdir */
    function devMode() { var s = $$('f-tz'); return s && s.value === 'device'; }
    function devOff(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12).getTimezoneOffset(); }
    function shown(mins, d) {
      if (!devMode()) return hm(mins);
      var utc = mins + STUDIO_OFF, loc = utc - devOff(d), day = Math.floor(loc / 1440), t = ((loc % 1440) + 1440) % 1440;
      return hm(t) + (day > 0 ? ' (+1)' : day < 0 ? ' (-1)' : '');
    }
    function tzNote(d0, d1) {
      if (!devMode()) return '<p class="status" style="margin-bottom:12px">Saatler stüdyo saatiyle gösterilir (UTC+3).</p>';
      var o = devOff(d0), msg = '', cut = (-o) / 60;
      msg = 'Saatler cihaz saatinle gösteriliyor (UTC' + (cut >= 0 ? '+' : '') + cut + '). Yoklama ve hakediş kayıtları her zaman stüdyo saatiyle tutulur.';
      if (d1 && devOff(d1) !== o) msg += ' Bu hafta cihaz saat diliminde saat değişikliği var: ' + DN[0] + ' ile ' + DN[6] + ' arasında aynı seans farklı saatte görünebilir.';
      return '<p class="note" role="status" style="margin-bottom:12px">' + msg + '</p>';
    }

    /* Seanslar */
    function mine() { return SHARED.cal.filter(function (x) { return !x.once && !x.from && SHARED.coachOf(x) === ME; }); }
    function sessOn(date) { var idx = (date.getDay() + 6) % 7; return mine().filter(function (x) { return x.d === idx; }).sort(function (a, b) { return a.s - b.s; }); }
    function keyOf(s, d) { return s.id + '|' + iso(d); }
    function names(s) {
      var pool = (SHARED.stu ? SHARED.stu() : []).filter(function (x) { return x.on; }).map(function (x) { return x.n; }), out = (s.grp || []).slice();
      for (var i = 0; i < pool.length && out.length < s.h; i++) { var n = pool[(i + s.id.charCodeAt(0)) % pool.length]; if (out.indexOf(n) < 0) out.push(n); }
      return out.slice(0, s.h);
    }
    /* Durum nesnesi: bugünkü "f" seansı yönetici yoklamasıyla aynı kaydı kullanır */
    function S(s, d) {
      var k = keyOf(s, d), api = SHARED.attApi, shared = isToday(d) && s.id === 'f' && api, past = d < TODAY && !isToday(d);
      if (!ST[k]) {
        ST[k] = { act: '', why: '', marks: {}, started: past, closed: past, req: '', nm: names(s) };
        if (past) ST[k].nm.forEach(function (n, i) { ST[k].marks[n] = i === 2 ? 'no_show' : 'attended'; }); 
      }
      var o = ST[k];
      return {
        k: k, o: o,
        names: function () { return shared ? api.names() : o.nm; },
        mark: function (n) { return shared ? api.getMark(n) : o.marks[n]; },
        set: function (n, v) { if (shared) api.setMark(n, v); else o.marks[n] = v; },
        started: function () { return shared ? api.started() : o.started; },
        closed: function () { return shared ? api.closed() : o.closed; },
        start: function (t) { if (shared) api.start(t); else o.started = true; },
        close: function (att) { if (shared) api.close(); else { o.closed = true; if (SHARED.hkAdd) SHARED.hkAdd(ME, iso(d), s.t, s.l, att); } }
      };
    }
    function stateOf(s, d) {
      var x = S(s, d);
      if (x.closed()) return 'closed';
      if (x.started()) return 'live';
      if (d > TODAY && !isToday(d)) return 'future';
      if (isToday(d)) { if (NOW < s.s - 15) return 'early'; if (NOW > s.s + s.l) return 'late'; return 'ready'; }
      return 'closed';
    }
    var BD = { closed: ['badge soft', 'Yoklama kapandı'], live: ['badge solid', 'Yoklama açık'], future: ['badge soft', 'Planlandı'], early: ['badge soft', 'Planlandı'], late: ['badge', 'Yoklama bekliyor'], ready: ['badge', 'Yoklama açılabilir'] };
    function badge(st) { return '<span class="' + BD[st][0] + '">' + BD[st][1] + '</span>'; }
    function pend(d) { return sessOn(d).filter(function (s) { var st = stateOf(s, d); return st === 'ready' || st === 'late' || st === 'live'; }).length; }

    /* Bugün */
    function slot(s, d, nextId) {
      var st = stateOf(s, d), open = st === 'ready' || st === 'late' || st === 'live', act = open ? 'Yoklama' : st === 'closed' ? 'Görüntüle' : 'Aç';
      return '<li class="slot' + (st === 'closed' ? ' done' : '') + (s.id === nextId ? ' next' : '') + '"><div class="time"><b class="tnum">' + shown(s.s, d) + '</b><span class="tnum">' + s.l + ' dk</span></div><div><h3>' + esc(s.t) + '</h3><p class="meta">' + esc(s.r) + ' · ' + s.h + ' üye' + (isToday(d) ? '' : ' · ' + DL[(d.getDay() + 6) % 7]) + '</p></div><div class="slot-end">' + badge(st) + '<button type="button" class="btn ' + (open ? '' : 'outline') + ' sm" data-open="' + s.id + '" data-date="' + iso(d) + '">' + act + '</button></div></li>';
    }
    function renderToday() {
      var d = TODAY, today = sessOn(d), wk = mon(d), all = [];
      for (var i = 0; i < 7; i++) { sessOn(addD(wk, i)).forEach(function (s) { all.push([s, addD(wk, i)]); }); }
      var nxt = today.filter(function (s) { var st = stateOf(s, d); return st !== 'closed'; })[0];
      var hrs = all.reduce(function (a, x) { return a + x[0].l; }, 0) / 60, lines = SHARED.hkOf ? SHARED.hkOf(ME) : null;
      var kas = lines ? lines.rows.filter(function (r) { return r.x.d.indexOf('2026-11') === 0; }).reduce(function (a, r) { return a + r.x.amt; }, 0) : 0;
      function kpi(l, v, sub) { return '<div class="kpi card"><span class="l">' + l + '</span><b class="tnum">' + v + '</b><span class="sub">' + sub + '</span></div>'; }
      $$('eb-kpi').innerHTML = kpi('Bugün', today.length + ' seans', hm(today[0] ? today[0].s : 0) + ' ile ' + hm(today.length ? today[today.length - 1].s + today[today.length - 1].l : 0)) + kpi('Yoklama bekleyen', pend(d), pend(d) ? 'Seansı aç ve işaretle' : 'Bekleyen yok') + kpi('Bu hafta', all.length + ' seans', String(hrs).replace('.', ',') + ' saat') + kpi('Kasım hakedişim', money(kas), 'Kapanan seanslar');
      $$('eb-tz').innerHTML = tzNote(wk, addD(wk, 6));
      $$('eb-list').innerHTML = today.map(function (s) { return slot(s, d, nxt && nxt.id); }).join('') || '<li class="slot empty"><span class="muted">Bugün seansın yok.</span></li>';
      var later = all.filter(function (x) { return x[1] > d; });
      $$('eb-next').innerHTML = later.map(function (x) { return slot(x[0], x[1], ''); }).join('') || '<li class="slot empty"><span class="muted">Bu hafta başka seansın yok.</span></li>';
      swap($$('eb-list'));
    }

    /* Programım */
    function renderProg() {
      var wk = addD(mon(TODAY), wkOff * 7), end = addD(wk, 6), n = 0, mins = 0, h = '';
      $$('ep-range').textContent = fd(wk) + ' - ' + fd(end) + ' ' + end.getFullYear();
      $$('ep-tz').innerHTML = tzNote(wk, end);
      for (var i = 0; i < 7; i++) {
        var d = addD(wk, i), ss = sessOn(d);
        h += '<p class="sb-label tnum" style="padding:8px 20px 4px' + (i ? ';border-top:1px solid var(--border);margin-top:4px' : '') + '">' + DL[i] + ', ' + fd(d) + (isToday(d) ? ' · bugün' : '') + '</p>';
        if (!ss.length) h += '<p class="muted" style="padding:0 20px 8px">Seans yok</p>';
        ss.forEach(function (s) { n++; mins += s.l; h += '<ul class="timeline" style="margin:0">' + slot(s, d, '') + '</ul>'; });
      }
      $$('ep-sum').textContent = n + ' seans, ' + String(mins / 60).replace('.', ',') + ' saat';
      $$('ep-body').innerHTML = h; swap($$('ep-body'));
    }
    $$('ep-prev').addEventListener('click', function () { wkOff--; renderProg(); });
    $$('ep-next').addEventListener('click', function () { wkOff++; renderProg(); });
    $$('ep-today').addEventListener('click', function () { wkOff = 0; renderProg(); });

    /* Seans yoklaması */
    function actDiff(s) { var v = pm($$('es-act').value); return isNaN(v) ? null : v - s.s; }
    function renderSeans() {
      if (!cur) { var t = sessOn(TODAY)[0]; cur = { s: t, d: TODAY }; }
      var s = cur.s, d = cur.d, x = S(s, d), st = stateOf(s, d), o = x.o;
      $$('es-back').querySelector('span').textContent = from === 'egt-program' ? 'Programım' : 'Bugün'; $$('es-back').setAttribute('href', '#' + from);
      $$('es-title').textContent = s.t;
      $$('es-badges').innerHTML = badge(st) + '<span class="badge soft">' + (s.grp ? 'Sabit grup' : 'Grup dersi') + '</span>' + (o.req ? '<span class="badge">Düzeltme talebi gönderildi</span>' : '');
      var ct = (d < TODAY || isToday(d) && NOW > s.s + s.l) ? '' : '';
      $$('es-facts').innerHTML = '<div><span class="k">Tarih</span><b>' + fd(d) + ', ' + DL[(d.getDay() + 6) % 7] + '</b></div><div><span class="k">Saat</span><b class="tnum">' + shown(s.s, d) + ' - ' + shown(s.s + s.l, d) + '</b></div><div><span class="k">Süre</span><b class="tnum">' + s.l + ' dk</b></div><div><span class="k">Salon</span><b>' + esc(s.r) + '</b></div>';
      $$('es-tz').innerHTML = devMode() ? tzNote(d, d) : '';
      var started = x.started(), closed = x.closed();
      $$('es-start').hidden = started; $$('es-live').hidden = !started;
      $$('es-plan').value = hm(s.s);
      if (!started) {
        if (!$$('es-act').value || $$('es-act').getAttribute('data-k') !== x.k) { $$('es-act').value = hm(s.s); $$('es-act').setAttribute('data-k', x.k); $$('es-why').value = ''; }
        var df = actDiff(s), late = df !== null && Math.abs(df) >= 5, err = '';
        if (df === null) err = 'Fiilî başlangıç saatini yaz.'; else if (st === 'future') err = 'Yoklama seans gününde açılır (' + fd(d) + ').'; else if (st === 'early') err = 'Yoklama ' + hm(s.s - 15) + '\'te açılır. Planlanan başlangıçtan 15 dakika önce başlayabilirsin.'; else if (pm($$('es-act').value) > s.s + s.l) err = 'Fiilî başlangıç seans bitişinden (' + hm(s.s + s.l) + ') sonra olamaz.'; else if (pm($$('es-act').value) < s.s - 15) err = 'Fiilî başlangıç planlanandan 15 dakikadan fazla erken olamaz.';
        $$('es-why-w').hidden = !late;
        var msg = err || (st === 'late' ? 'Seans bitti ama yoklama açılmadı. Gerçek başlangıcı yazıp gerekçeyi ekle.' : '');
        $$('es-sh').hidden = !msg; $$('es-sh').textContent = msg;
        $$('es-go').disabled = !!err || (late && !$$('es-why').value.trim());
        $$('es-sub').textContent = st === 'closed' ? '' : 'Fiilî başlangıcı yaz, yoklamayı başlat. Planlanandan 5 dakika veya daha fazla farklıysa gerekçe zorunlu.';
        $$('es-act').disabled = $$('es-why').disabled = !(st === 'ready' || st === 'late');
        return;
      }
      var nm = x.names(), a = 0, n = 0;
      nm.forEach(function (p) { var m = x.mark(p); if (m === 'attended') a++; else if (m === 'no_show') n++; });
      var miss = nm.length - a - n;
      $$('es-sub').textContent = closed ? 'Yoklama kapandı. Düzeltmeyi yalnızca yönetici yapar.' : (o.act ? 'Fiilî başlangıç ' + o.act + (o.why ? ' · ' + esc(o.why) : '') : 'Yoklama açık.');
      $$('es-sum').textContent = 'Geldi ' + a + ', gelmedi ' + n + ', işaretlenmemiş ' + miss;
      $$('es-draft').hidden = closed;
      $$('es-list').innerHTML = nm.map(function (p) {
        var m = x.mark(p), dis = closed ? ' disabled' : '', ini = p.split(' ').map(function (w) { return w[0]; }).join('').slice(0, 2);
        return '<li><span class="who"><span class="avatar sm">' + ini + '</span>' + esc(p) + '</span><div class="seg sm" role="group" aria-label="' + esc(p) + ' yoklama"><button type="button" class="ok" data-m="attended" data-n="' + esc(p) + '" aria-pressed="' + (m === 'attended') + '"' + dis + '>Geldi</button><button type="button" class="no" data-m="no_show" data-n="' + esc(p) + '" aria-pressed="' + (m === 'no_show') + '"' + dis + '>Gelmedi</button></div></li>';
      }).join('');
      $$('es-ae').hidden = !(!closed && miss > 0); $$('es-ae').textContent = miss + ' üye işaretlenmedi. Yoklamayı kapatmak için hepsini işaretle. İşaretlerin taslak olarak saklanır, sayfadan çıksan da kaybolmaz.';
      $$('es-close').hidden = closed; $$('es-close').disabled = miss > 0 || !nm.length;
      $$('es-fix').hidden = !closed || !!o.req; 
      $$('es-hint').textContent = closed ? (o.req ? 'Düzeltme talebin yöneticide: ' + o.req : 'Hatalı işaret varsa gerekçeyle düzeltme iste.') : 'Kapatınca hak tüketimi uygulanır ve hakediş satırı oluşur.';
    }
    $$('es-act').addEventListener('input', renderSeans); $$('es-why').addEventListener('input', renderSeans);
    $$('es-go').addEventListener('click', function () {
      if ($$('es-go').disabled) return; var x = S(cur.s, cur.d); x.o.act = $$('es-act').value; x.o.why = $$('es-why-w').hidden ? '' : $$('es-why').value.trim();
      x.start(x.o.act); renderSeans(); toast('Yoklama başladı, fiilî başlangıç ' + x.o.act + ' kaydedildi');
    });
    $$('es-list').addEventListener('click', function (e) { var b = e.target.closest('button[data-m]'); if (!b || b.disabled) return; S(cur.s, cur.d).set(b.getAttribute('data-n'), b.getAttribute('data-m')); renderSeans(); });

    /* Onay penceresi */
    var dl = $$('egt-dlg'), sc = $$('egt-scrim'), dMode = '';
    function dOpen(mode) {
      var s = cur.s, x = S(s, cur.d), nm = x.names(), a = nm.filter(function (p) { return x.mark(p) === 'attended'; }).length, n = nm.length - a, c = SHARED.hkCalc ? SHARED.hkCalc(ME, s.l, a) : null;
      dMode = mode; $$('egt-dwhy').value = ''; $$('egt-dwhy-w').hidden = mode !== 'fix';
      if (mode === 'close') {
        $$('egt-dt').textContent = 'Yoklamayı kapat'; $$('egt-dok').textContent = 'Kapat';
        $$('egt-db').innerHTML = '<ul class="aff"><li><b>Yoklama</b><span class="ch">' + a + ' geldi, ' + n + ' gelmedi. Kapanınca işaretleri yalnızca yönetici düzeltir.</span></li><li><b>Üye hakları</b><span class="ch">Hak tüketimi stüdyo politikasına göre uygulanır.</span></li><li><b>Hakedişin</b><span class="ch">' + (c ? money(c.amt) + ', ' + esc(c.basis) : 'Anlaşmana göre') + ' satırı Hakedişim sayfasına eklenir.</span></li></ul>';
        $$('egt-dok').disabled = false;
      } else {
        $$('egt-dt').textContent = 'Düzeltme iste'; $$('egt-dok').textContent = 'Yöneticiye gönder';
        $$('egt-db').innerHTML = '<p class="muted">Kapalı yoklamayı yalnızca yönetici değiştirir. Hangi üyenin işaretinin neden yanlış olduğunu yaz, yönetici incelediğinde hak ve hakediş yeniden hesaplanır.</p>'; $$('egt-dok').disabled = true;
      }
      dl.hidden = sc.hidden = false; (mode === 'fix' ? $$('egt-dwhy') : $$('egt-dok')).focus();
    }
    function dClose() { dl.hidden = sc.hidden = true; }
    $$('egt-dwhy').addEventListener('input', function () { if (dMode === 'fix') $$('egt-dok').disabled = !$$('egt-dwhy').value.trim(); });
    $$('egt-dcancel').addEventListener('click', dClose); sc.addEventListener('click', dClose);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !dl.hidden) dClose(); });
    $$('egt-dok').addEventListener('click', function () {
      if ($$('egt-dok').disabled) return; var x = S(cur.s, cur.d);
      if (dMode === 'close') { var att = x.names().filter(function (p) { return x.mark(p) === 'attended'; }).length; dClose(); x.close(att); renderSeans(); toast('Yoklama kapatıldı, hakedişin eklendi'); }
      else { x.o.req = $$('egt-dwhy').value.trim(); dClose(); renderSeans(); toast('Düzeltme talebi yöneticiye gönderildi'); }
    });
    $$('es-close').addEventListener('click', function () { if (!$$('es-close').disabled) dOpen('close'); });
    $$('es-fix').addEventListener('click', function () { dOpen('fix'); });

    /* Hakedişim */
    function renderHk() {
      var per = $$('eh-per').value, H = SHARED.hkOf(ME);
      var rows = H.rows.filter(function (r) { return per === 'all' || r.x.d.indexOf(per) === 0; }).sort(function (a, b) { return a.x.d < b.x.d ? 1 : a.x.d > b.x.d ? -1 : b.x.id - a.x.id; });
      var pays = H.pays.filter(function (p) { return per === 'all' || p.d.indexOf(per) === 0; }).sort(function (a, b) { return a.d < b.d ? 1 : a.d > b.d ? -1 : b.id - a.id; });
      var tot = rows.reduce(function (a, r) { return a + r.x.amt; }, 0), pd = rows.reduce(function (a, r) { return a + r.paid; }, 0);
      function kpi(l, v, sub, c) { return '<div class="kpi card"><span class="l">' + l + '</span><b class="tnum"' + (c ? ' style="color:' + c + '"' : '') + '>' + v + '</b><span class="sub">' + sub + '</span></div>'; }
      $$('eh-kpi').innerHTML = kpi('Toplam hakediş', money(tot), rows.length + ' kapanan seans') + kpi('Ödenen', money(pd), 'Ödemeler satırlara sırayla uygulanır') + kpi('Kalan', money(tot - pd), tot - pd ? 'Ödeme bekliyor' : 'Borç yok', tot - pd ? 'var(--destructive)' : '');
      var g = H.agr; $$('eh-agr').innerHTML = g ? '<div class="row" style="padding:0"><div><p class="t">Geçerli anlaşman</p><p class="d">' + H.rate + ' · v' + g.v + ', ' + g.from.split('-').reverse().slice(0, 2).join('.') + ' tarihinden beri. Ücret değişikliği yeni sürüm olarak yöneticide yayınlanır, eski seanslar eski ücretle kalır.</p></div></div>' : '';
      $$('eh-lines').innerHTML = '<table class="list static"><thead><tr><th>Tarih</th><th>Seans</th><th>Hesap</th><th class="r">Tutar</th><th>Durum</th></tr></thead><tbody>' + (rows.map(function (r) {
        var x = r.x, st = r.paid >= x.amt ? '<span class="badge ok">Ödendi</span>' : r.paid > 0 ? '<span class="badge">Kısmi</span>' : '<span class="badge soft">Bekliyor</span>', d = x.d.split('-');
        return '<tr><td class="tnum">' + (+d[2]) + ' ' + MN[+d[1] - 1] + (x.live ? ' <span class="badge solid">Yeni</span>' : '') + '</td><td><span class="nm"><span>' + esc(x.t) + '</span><small class="tnum">' + x.l + ' dk · ' + x.att + ' katılımcı</small></span></td><td class="muted">' + esc(x.basis) + ' · v' + x.v + '</td><td class="r tnum">' + money(x.amt) + '</td><td>' + st + '</td></tr>';
      }).join('') || '<tr><td colspan="5" class="muted" style="padding:32px 0;text-align:center">Bu dönemde hakediş satırı yok.</td></tr>') + '</tbody></table>';
      $$('eh-pays').innerHTML = '<table class="list static"><thead><tr><th>Tarih</th><th>İşlem</th><th>Yöntem</th><th class="r">Tutar</th></tr></thead><tbody>' + (pays.map(function (p) {
        var d = p.d.split('-'); return '<tr><td class="tnum">' + (+d[2]) + ' ' + MN[+d[1] - 1] + '</td><td>' + (p.kind === 'c' ? 'Düzeltme' : 'Ödeme') + (p.note ? '<span class="muted"> · ' + esc(p.note) + '</span>' : '') + '</td><td class="muted">' + esc(p.m) + '</td><td class="r tnum">' + money(p.amt) + '</td></tr>';
      }).join('') || '<tr><td colspan="4" class="muted" style="padding:32px 0;text-align:center">Bu dönemde ödeme yok.</td></tr>') + '</tbody></table>';
      $$('eh-lines').hidden = ehTab !== 'lines'; $$('eh-pays').hidden = ehTab !== 'pays';
      document.querySelectorAll('[data-eh]').forEach(function (b) { b.setAttribute('aria-selected', String(b.getAttribute('data-eh') === ehTab)); });
    }
    $$('eh-per').addEventListener('change', renderHk);
    document.querySelectorAll('[data-eh]').forEach(function (b) { b.addEventListener('click', function () { ehTab = b.getAttribute('data-eh'); renderHk(); }); });

    /* Açma bağlantıları */
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-open][data-date]'); if (!b) return;
      var p = b.getAttribute('data-date').split('-'), d = new Date(+p[0], +p[1] - 1, +p[2]), s = mine().filter(function (x) { return x.id === b.getAttribute('data-open'); })[0];
      if (!s) return; cur = { s: s, d: d }; from = location.hash === '#egt-program' ? 'egt-program' : 'egt-bugun'; $$('es-act').removeAttribute('data-k'); location.hash = '#egt-seans';
    });

    /* Rol değiştirme: eğitmen menüsü ayrı katman, yönetici menüsü olduğu gibi kalır */
    var sbEl = $$('sidebar'), nav = sbEl.querySelector('.sb-nav'), foot = sbEl.querySelector('.sb-foot');
    var eNav = document.createElement('nav'); eNav.className = 'sb-nav'; eNav.setAttribute('aria-label', 'Eğitmen menüsü'); eNav.hidden = true;
    eNav.innerHTML = '<div class="sb-group"><p class="sb-label">Çalışma</p>' + [['egt-bugun', 'Bugün', 'layout'], ['egt-program', 'Programım', 'calendar'], ['egt-hakedis', 'Hakedişim', 'wallet']].map(function (i) { return '<a class="sb-item" href="#' + i[0] + '" data-route="' + i[0] + '" title="' + i[1] + '">' + ic(i[2]) + '<span>' + i[1] + '</span>' + (i[0] === 'egt-bugun' ? '<em class="count" id="egt-cnt" style="font-style:normal"></em>' : '') + '</a>'; }).join('') + '</div>';
    var eFoot = document.createElement('div'); eFoot.className = 'sb-foot'; eFoot.hidden = true;
    eFoot.innerHTML = '<a class="sb-item" href="#yardim" data-route="yardim" title="Yardım">' + ic('help') + '<span>Yardım</span></a><a class="user" href="#hesap" data-route="hesap" title="Hesabım"><span class="avatar">EK</span><span class="studio-txt"><b>Elif Kara</b><small>Eğitmen</small></span>' + ic('updown') + '</a>';
    nav.after(eNav); foot.after(eFoot);
    var sw = document.createElement('div'); sw.className = 'seg sm'; sw.id = 'role-sw'; sw.setAttribute('role', 'group'); sw.setAttribute('aria-label', 'Rol görünümü (tasarım önizlemesi)');
    sw.innerHTML = '<button type="button" data-role="admin" aria-pressed="true">Yönetici</button><button type="button" data-role="egt" aria-pressed="false">Eğitmen</button>';
    var ta = document.querySelector('#topbar .top-actions'); ta.insertBefore(sw, ta.firstChild);
    function cnt() { var c = $$('egt-cnt'), n = pend(TODAY); if (c) { c.textContent = n; c.hidden = !n; } }
    function setRole(r) {
      role = r; document.body.classList.toggle('role-egt', r === 'egt'); document.body.classList.toggle('role-uye', r === 'uye');
      nav.hidden = foot.hidden = r !== 'admin'; eNav.hidden = eFoot.hidden = r !== 'egt';
      document.querySelector('.app').hidden = r === 'uye' || r === 'pub' || r === 'auth'; $$('mshell').hidden = r !== 'uye'; $$('pubshell').hidden = r !== 'pub'; $$('authshell').hidden = r !== 'auth'; document.body.classList.toggle('role-pub', r === 'pub'); document.body.classList.toggle('role-auth', r === 'auth');
      document.querySelectorAll('[data-role]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-role') === r)); });
      var cr = document.querySelector('#topbar .crumbs .muted'); if (cr) cr.textContent = r === 'egt' ? 'Eğitmen paneli' : 'Stüdyo yönetimi';
      var lg = sbEl.querySelector('.studio .studio-txt small'); if (lg) lg.textContent = r === 'egt' ? 'Eğitmen paneli' : 'Merkez şube';
      cnt();
    }
    function roleTo(r) {
      if (r === role) return; setRole(r); var h = r === 'egt' ? '#egt-bugun' : r === 'uye' ? '#m-dersler' : r === 'pub' ? '#p-takvim' : r === 'auth' ? '#a-giris' : '#genel-bakis';
      if (location.hash === h) window.dispatchEvent(new Event('hashchange')); else location.hash = h;
      toast(r === 'egt' ? 'Eğitmen görünümü: Elif Kara' : r === 'uye' ? 'Üye görünümü: Selin Aksoy' : r === 'pub' ? 'Ziyaretçi önizlemesi' : r === 'auth' ? 'Çıkış yapıldı' : 'Yönetici görünümü');
    }
    SHARED.roleTo = roleTo;
    sw.addEventListener('click', function (e) { var b = e.target.closest('button[data-role]'); if (b) roleTo(b.getAttribute('data-role')); });
    titles['egt-bugun'] = 'Bugün'; titles['egt-program'] = 'Programım'; titles['egt-seans'] = 'Seans yoklaması'; titles['egt-hakedis'] = 'Hakedişim';
    function after() {
      var name = (location.hash || '#genel-bakis').slice(1);
      if (name.indexOf('a-') === 0 && role !== 'auth') { setRole('auth'); window.dispatchEvent(new Event('hashchange')); return; }
      if (role === 'auth') { if (name.indexOf('a-') !== 0) { location.hash = '#a-giris'; return; } SHARED.authRender(name); return; }
      if (name.indexOf('p-') === 0 && role !== 'pub') { setRole('pub'); window.dispatchEvent(new Event('hashchange')); return; }
      if (role === 'pub') { if (name.indexOf('p-') !== 0) { location.hash = '#p-takvim'; return; } SHARED.pubRender(); return; }
      if (name.indexOf('m-') === 0 && role !== 'uye') { setRole('uye'); window.dispatchEvent(new Event('hashchange')); return; }
      if (role === 'uye') { if (name.indexOf('m-') !== 0) { location.hash = '#m-dersler'; return; } SHARED.memberRender(); return; }
      if (name.indexOf('egt-') === 0 && role !== 'egt') { setRole('egt'); window.dispatchEvent(new Event('hashchange')); return; }
      if (role === 'egt' && ALLOWED.indexOf(name) < 0) { if (name !== 'durumlar') { window.__stateShow('403', name); return; } }
      if (role !== 'egt') return;
      if (name === 'egt-seans') document.querySelectorAll('[data-route]').forEach(function (a) { if (a.getAttribute('data-route') === from) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
      if (name === 'egt-bugun') renderToday(); else if (name === 'egt-program') renderProg(); else if (name === 'egt-seans') renderSeans(); else if (name === 'egt-hakedis') renderHk();
      cnt();
    }
    window.addEventListener('hashchange', after);
    var tzs = $$('f-tz'); if (tzs) tzs.addEventListener('change', function () { if (role === 'egt') after(); });
    swap($$('egt-dlg')); swap(document.querySelector('[data-view="egt-bugun"]')); swap(document.querySelector('[data-view="egt-program"]')); swap(document.querySelector('[data-view="egt-seans"]')); swap(document.querySelector('[data-view="egt-hakedis"]'));
    after();
  })();

  /* ---------- Üye paneli: ayrı kabuk (kurgusal veri; Selin Aksoy olarak giriş). Hak, rezervasyon ve borç yönetim verisiyle aynı kayıt ---------- */
  (function () {
    var $$ = function (id) { return document.getElementById(id); };
    var ME = 'Selin Aksoy', TODAY = new Date(2026, 10, 4), NOW = 14 * 60 + 20;
    var DN = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'], DL = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'], MN = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
    function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
    function pad(n) { return ('0' + n).slice(-2); }
    function hm(m) { return pad(Math.floor(m / 60)) + ':' + pad(m % 60); }
    function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
    function addD(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
    function mon(d) { var x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); x.setHours(0, 0, 0, 0); return x; }
    function fd(d) { return d.getDate() + ' ' + MN[d.getMonth()]; }
    function dow(d) { return (d.getDay() + 6) % 7; }
    function pd(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
    function money(n) { return '₺' + String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
    function me() { return SHARED.stu().filter(function (x) { return x.n === ME; })[0]; }
    function pol() { return { open: +$$('ay-acilis').value, free: +$$('ay-iptal').value, gec: $$('ay-gec').checked, wl: $$('ay-bekleme').checked, offer: +$$('ay-teklif').value }; }
    var nowTs = TODAY.getTime() + NOW * 60000;
    function startTs(s, d) { return d.getTime() + s.s * 60000; }
    function minsTo(s, d) { return Math.round((startTs(s, d) - nowTs) / 60000); }
    function when(s, d) { return (iso(d) === iso(TODAY) ? 'Bugün' : DL[dow(d)] + ', ' + fd(d)) + ' ' + hm(s.s); }
    function rezD(s, d) { return DN[dow(d)] + ', ' + fd(d) + ' ' + hm(s.s); }

    /* Seanslar ve kayıtlar */
    function sess() { return SHARED.cal.filter(function (x) { return !x.once && !x.from && !x.p; }); }
    function sessOn(d) { var i = dow(d); return sess().filter(function (x) { return x.d === i; }).sort(function (a, b) { return a.s - b.s; }); }
    function byId(id) { return sess().filter(function (x) { return x.id === id; })[0]; }
    function key(s, d) { return s.id + '|' + iso(d); }
    function isGrp(s) { return !!s.grp && s.grp.indexOf(ME) > -1; }
    var BK = {}, GX = {}, DEL = {}, WL = {}, BASEQ = { l: 2 };
    BK[key(byId('f'), TODAY)] = { ent: '8 derslik paket', via: 'seed' };
    function booked(s, d) { var k = key(s, d); return !!BK[k] || (isGrp(s) && !GX[k] && d >= TODAY); }
    function taken(s, d) { return s.h + (DEL[key(s, d)] || 0); }
    function left(s, d) { return s.c - taken(s, d); }
    function nowOffer() { var o = null; Object.keys(WL).forEach(function (k) { if (WL[k].offer) o = k; }); return o; }
    function parseKey(k) { var p = k.split('|'); return { s: byId(p[0]), d: pd(p[1]) }; }

    /* Hak ve kapılar */
    function ents() {
      var s = me(), fz = SHARED.frozen ? SHARED.frozen(ME) : null, out = [], why = '';
      if (!s.on) why = 'Hesabın pasif.'; else if (fz) why = 'Hakkın donduruldu.'; else if (s.term || s.ended) why = 'Hak sonlandırıldı.'; else if (s.k === 'c' && s.av <= 0) why = 'Kullanılabilir hakkın kalmadı.'; else if (s.debt > 0) why = 'Açık borcun var (' + money(s.debt) + ').';
      out.push({ id: 'cur', n: s.pkg, sub: s.k === 'c' ? s.av + ' hak kaldı' : 'Süreli, ' + s.until + '\'e kadar', ok: !why, why: why });
      (s.past || []).forEach(function (p, i) { out.push({ id: 'p' + i, n: p.n, sub: p.per, ok: false, why: p.note || 'Süresi doldu' }); });
      return out;
    }
    function docsPend() { return SHARED.pendingDocs ? SHARED.pendingDocs(ME, 'Rezervasyon') : []; }
    function gate() {
      var e = ents()[0], dp = docsPend();
      if (dp.length) return { code: 'doc', msg: 'Rezervasyon için belge kabulü gerekiyor: ' + dp.join(', ') + '.' };
      if (!e.ok) return { code: 'ent', msg: e.why };
      return null;
    }
    function status(s, d) {
      var k = key(s, d), ms = minsTo(s, d), p = pol();
      if (s.x) return 'cancelled';
      if (ms <= 0) return booked(s, d) && iso(d) === iso(TODAY) ? 'started' : 'past';
      if (booked(s, d)) return 'booked';
      if (WL[k]) return WL[k].offer ? 'offer' : 'wait';
      if ((d - TODAY) / 864e5 > p.open) return 'closed';
      if (left(s, d) <= 0) return p.wl ? 'full' : 'fullno';
      return gate() ? 'blocked' : 'open';
    }
    function freeCancel(s, d) { return minsTo(s, d) >= pol().free * 60; }
    function freeUntil(s, d) { var t = new Date(startTs(s, d) - pol().free * 3600000); return (iso(t) === iso(TODAY) ? 'bugün ' : fd(t) + ' ') + pad(t.getHours()) + ':' + pad(t.getMinutes()); }

    /* Kartlar */
    var sel = iso(TODAY), wkOff = 0, nav = false;
    function badge(st, s, d) {
      var m = { booked: ['badge solid', 'Kayıtlısın'], started: ['badge solid', 'Ders başladı'], wait: ['badge', 'Bekleme listesi #' + (WL[key(s, d)] || {}).pos], offer: ['badge solid', 'Yer teklifi'], full: ['badge soft', 'Dolu'], fullno: ['badge soft', 'Dolu'], cancelled: ['badge soft', 'İptal edildi'], past: ['badge soft', 'Geçti'], closed: ['badge soft', 'Henüz açılmadı'], blocked: ['badge soft', 'Kapalı'], open: null }[st];
      return m ? '<span class="' + m[0] + '">' + m[1] + '</span>' : '';
    }
    function btn(st, s, d) {
      var a = 'data-s="' + s.id + '" data-d="' + iso(d) + '"';
      if (st === 'open') return '<button type="button" class="btn sm" data-a="book" ' + a + '>Kayıt ol</button>';
      if (st === 'booked') return '<button type="button" class="btn outline sm" data-a="cancel" ' + a + '>İptal et</button>';
      if (st === 'full') return '<button type="button" class="btn outline sm" data-a="wjoin" ' + a + '>Sıraya gir</button>';
      if (st === 'wait') return '<button type="button" class="btn outline sm" data-a="wleave" ' + a + '>Sıradan çık</button>';
      if (st === 'offer') return '<button type="button" class="btn sm" data-a="offer" ' + a + '>Teklifi gör</button>';
      if (st === 'blocked') { var g = gate(); return '<button type="button" class="btn outline sm" ' + (g.code === 'doc' ? 'data-a="docs"' : 'disabled') + '>' + (g.code === 'doc' ? 'Belgeyi kabul et' : 'Kayıt ol') + '</button>'; }
      return '';
    }
    function card(s, d, mini) {
      var st = status(s, d), l = left(s, d), g = st === 'blocked' ? gate() : null;
      var seat = st === 'cancelled' || st === 'past' || st === 'started' ? '' : l <= 0 ? '<span class="mseat full">Dolu</span>' : '<span class="mseat">' + l + ' yer kaldı</span>';
      return '<li class="slot' + (st === 'past' || st === 'cancelled' ? ' done' : '') + (st === 'booked' || st === 'offer' ? ' next' : '') + '"><div class="time"><b class="tnum">' + hm(s.s) + '</b><span class="tnum">' + s.l + ' dk</span></div><div><h3>' + esc(s.t) + (isGrp(s) ? ' <span class="badge soft" style="margin-left:4px">Sabit grup</span>' : '') + '</h3><p class="meta">' + (mini ? DL[dow(d)] + ', ' + fd(d) + ' · ' : '') + esc(SHARED.coachOf(s)) + ' · ' + esc(s.r) + (seat ? ' · ' : '') + seat + '</p>' + (g ? '<span class="hint-s">' + esc(g.msg) + '</span>' : '') + (st === 'closed' ? '<span class="hint-s">Rezervasyon ' + pol().open + ' gün önce açılır.</span>' : '') + '</div><div class="slot-end">' + badge(st, s, d) + btn(st, s, d) + '</div></li>';
    }

    /* Dersler */
    function notes() {
      var s = me(), h = '', o = nowOffer(), g = gate(), up = upcoming()[0];
      if (o) { var q = parseKey(o); h += '<div class="mnote hi"><p><b>Yer açıldı:</b> ' + esc(q.s.t) + ', ' + when(q.s, q.d) + '. <span class="tnum" data-offt>' + mmss(WL[o].offer.left) + '</span> içinde yanıtla.</p><button type="button" class="btn sm" data-a="offer" data-s="' + q.s.id + '" data-d="' + iso(q.d) + '">Teklifi gör</button></div>'; }
      if (up) h += '<div class="mnote"><p><b>Sıradaki dersin:</b> ' + esc(up.s.t) + ', ' + when(up.s, up.d) + (minsTo(up.s, up.d) > 0 && minsTo(up.s, up.d) < 180 ? ' (' + minsTo(up.s, up.d) + ' dk sonra)' : '') + '.</p><a class="btn outline sm" href="#m-rez">Rezervasyonlarım</a></div>';
      if (g) h += '<div class="mnote warn"><p><b>Kayıt kapalı:</b> ' + esc(g.msg) + '</p>' + (g.code === 'doc' ? '<a class="btn outline sm" href="#m-hesap">Belgeler</a>' : g.code === 'ent' && s.debt > 0 ? '' : '') + '</div>';
      else if (s.k === 'c' && s.av <= 2) h += '<div class="mnote"><p><b>Hakkın azalıyor:</b> ' + s.av + ' ders kaldı. Yeni paket için stüdyoya yaz.</p><a class="btn outline sm" href="#m-haklarim">Haklarım</a></div>';
      $$('md-notes').innerHTML = h;
    }
    function renderDers() {
      var wk = addD(mon(TODAY), wkOff * 7), p = pol(), days = '';
      if (!nav) { sel = iso(wkOff === 0 ? TODAY : wk); }
      if (iso(pd(sel)) < iso(wk) || pd(sel) > addD(wk, 6)) sel = iso(wk);
      $$('md-range').textContent = fd(wk) + ' - ' + fd(addD(wk, 6)) + ' ' + addD(wk, 6).getFullYear();
      $$('md-sub').textContent = 'Kayıt olmak için hak seç, iptal süresini gör.';
      for (var i = 0; i < 7; i++) { var d = addD(wk, i), n = sessOn(d).length; days += '<button type="button" class="mday' + (iso(d) === iso(TODAY) ? ' is-today' : '') + '" data-day="' + iso(d) + '" aria-pressed="' + (iso(d) === sel) + '" aria-label="' + DL[i] + ' ' + fd(d) + ', ' + n + ' ders"><small>' + DN[i] + '</small><b class="tnum">' + d.getDate() + '</b>' + (n ? '<i></i>' : '<i style="opacity:0"></i>') + '</button>'; }
      $$('md-days').innerHTML = days;
      var cd = pd(sel), ss = sessOn(cd);
      $$('md-list').innerHTML = ss.map(function (s) { return card(s, cd, false); }).join('') || '<li class="slot empty"><span class="muted">Bu gün ders yok.</span></li>';
      $$('md-pol').textContent = 'Ücretsiz iptal: dersten ' + p.free + ' saat öncesine kadar. ' + (p.gec ? 'Sonrasında iptalde hak düşer.' : 'Sonrasında da hak iade edilir.') + ' Rezervasyon ' + p.open + ' gün önce açılır.';
      notes(); swap($$('md-days')); swap($$('md-notes'));
    }
    $$('md-days').addEventListener('click', function (e) { var b = e.target.closest('[data-day]'); if (b) { sel = b.getAttribute('data-day'); nav = true; renderDers(); } });
    $$('md-prev').addEventListener('click', function () { wkOff--; nav = false; renderDers(); });
    $$('md-next').addEventListener('click', function () { wkOff++; nav = false; renderDers(); });
    $$('md-today').addEventListener('click', function () { wkOff = 0; nav = false; renderDers(); });

    /* Rezervasyonlarım */
    function upcoming() {
      var out = [];
      for (var i = 0; i < 21; i++) { var d = addD(TODAY, i); sessOn(d).forEach(function (s) { if (booked(s, d) && minsTo(s, d) > -s.l) out.push({ s: s, d: d, t: startTs(s, d) }); }); }
      return out.sort(function (a, b) { return a.t - b.t; });
    }
    function renderRez() {
      var up = upcoming();
      $$('mr-up').innerHTML = up.map(function (x) {
        var fc = freeCancel(x.s, x.d), ms = minsTo(x.s, x.d), started = ms <= 0, b = BK[key(x.s, x.d)];
        return '<li class="slot"><div class="time"><b class="tnum">' + hm(x.s.s) + '</b><span class="tnum">' + x.s.l + ' dk</span></div><div><h3>' + esc(x.s.t) + '</h3><p class="meta">' + (iso(x.d) === iso(TODAY) ? 'Bugün' : DL[dow(x.d)] + ', ' + fd(x.d)) + ' · ' + esc(SHARED.coachOf(x.s)) + ' · ' + esc(x.s.r) + '</p><span class="hint-s">' + (isGrp(x.s) && !b ? 'Sabit grup, hak ayrılmaz' : (b ? b.ent + ' · ' : '') + (started ? 'Ders başladı' : fc ? 'Ücretsiz iptal: ' + freeUntil(x.s, x.d) + '\'e kadar' : 'Ücretsiz iptal süresi geçti' + (pol().gec ? ', iptalde hak düşer' : ''))) + '</span></div><div class="slot-end">' + (started ? '<span class="badge solid">Başladı</span>' : '<button type="button" class="btn outline sm" data-a="cancel" data-s="' + x.s.id + '" data-d="' + iso(x.d) + '">İptal et</button>') + '</div></li>';
      }).join('') || '<li class="slot empty"><span class="muted">Yaklaşan rezervasyonun yok. <a href="#m-dersler" style="text-decoration:underline">Derslere göz at</a></span></li>';
      var w = Object.keys(WL).sort();
      $$('mr-wl').innerHTML = w.map(function (k) {
        var q = parseKey(k), e = WL[k];
        return '<li class="slot' + (e.offer ? ' next' : '') + '"><div class="time"><b class="tnum">' + hm(q.s.s) + '</b><span class="tnum">' + q.s.l + ' dk</span></div><div><h3>' + esc(q.s.t) + '</h3><p class="meta">' + DL[dow(q.d)] + ', ' + fd(q.d) + ' · ' + esc(q.s.r) + '</p><span class="hint-s">' + (e.offer ? 'Yer açıldı, <span class="tnum" data-offt>' + mmss(e.offer.left) + '</span> içinde yanıtla.' : 'Sıran: #' + e.pos + '. Yer açılınca ' + pol().offer + ' dk içinde yanıtlaman gerekir.') + '</span></div><div class="slot-end">' + (e.offer ? '<button type="button" class="btn sm" data-a="offer" data-s="' + q.s.id + '" data-d="' + iso(q.d) + '">Teklifi gör</button>' : '<button type="button" class="btn outline sm" data-a="wdemo" data-s="' + q.s.id + '" data-d="' + iso(q.d) + '" title="Tasarım önizlemesi: sıra sana gelsin">Yer açıldı (önizleme)</button><button type="button" class="btn ghost sm" data-a="wleave" data-s="' + q.s.id + '" data-d="' + iso(q.d) + '">Sıradan çık</button>') + '</div></li>';
      }).join('') || '<li class="slot empty"><span class="muted">Bekleme listesinde değilsin. Dolu derslerde "Sıraya gir" görünür.</span></li>';
      var s = me(), rows = s.rez.filter(function (r) { return r.r !== 'up'; });
      $$('mr-past').innerHTML = '<table class="list static"><thead><tr><th>Tarih</th><th>Ders</th><th>Durum</th></tr></thead><tbody>' + rows.map(function (r) { return '<tr><td class="tnum">' + esc(r.d) + '</td><td>' + esc(r.c) + '</td><td>' + (r.r === 'cancelled' ? '<span class="badge soft">İptal edildi</span>' : r.y === 'no' ? '<span class="badge bad">Gelmedi</span>' : '<span class="badge ok">Katıldın</span>') + '</td></tr>'; }).join('') + '</tbody></table>';
      var c = $$('m-cnt'), n = Object.keys(WL).filter(function (k) { return WL[k].offer; }).length; c.textContent = n; c.hidden = !n;
      swap($$('mr-up'));
    }

    /* Haklarım */
    function renderHak() {
      var s = me(), e = ents()[0], fz = SHARED.frozen ? SHARED.frozen(ME) : null, tot = s.k === 'c' ? s.tot : 0, h = '';
      var led = s.led ? s.led : [{ d: (s.per || '').split(' - ')[0], t: 'Paket tahsisi: ' + s.pkg, n: '+' + s.tot }].concat(s.cn > 0 ? [{ d: 'Toplam', t: 'Yoklaması kapanan dersler', n: '-' + s.cn }] : []);
      h += '<div class="card"><div class="card-h"><h2>' + esc(s.pkg) + '</h2><p>' + esc(s.per) + (fz ? ' · <span class="badge">Donduruldu</span>' : '') + '</p></div><div class="card-c">' + (s.k === 'c' ?
        '<div class="mkpi"><div class="kpi card"><span class="l">Kullanılabilir</span><b class="tnum">' + s.av + '<small> / ' + s.tot + '</small></b><span class="sub">Yeni rezervasyon için</span></div><div class="kpi card"><span class="l">Ayrılmış</span><b class="tnum">' + s.rs + '</b><span class="sub">Yaklaşan derslerin</span></div><div class="kpi card"><span class="l">Kullanılan</span><b class="tnum">' + s.cn + '</b><span class="sub">Yoklaması kapanan</span></div></div><div class="split-bar" style="margin-top:16px" aria-hidden="true"><i class="cn" style="width:' + (s.cn / s.tot * 100) + '%"></i><i class="rs" style="width:' + (s.rs / s.tot * 100) + '%"></i><i class="av" style="width:' + (s.av / s.tot * 100) + '%"></i></div>' :
        '<p>Süreli hak, <b>' + esc(s.until) + '</b> tarihine kadar sınırsız rezervasyon.</p>') + (e.ok ? '' : '<p class="note" style="margin-top:12px">' + esc(e.why) + ' Yeni rezervasyon yapamazsın.</p>') + '</div></div>';
      if (s.k === 'c') h += '<div class="card"><div class="card-h"><h2>Hak hareketleri</h2></div><ul class="lines" style="padding-top:8px">' + led.map(function (x) { return '<li><div><b style="font-weight:500">' + esc(x.t) + '</b><p class="s tnum">' + esc(x.d) + '</p></div><span class="tnum">' + esc(x.n) + '</span></li>'; }).join('') + '</ul></div>';
      var bal = s.debt > 0 ? '<span class="debt">' + money(s.debt) + ' borç</span>' : s.cr > 0 ? '<b style="color:var(--success)">' + money(s.cr) + ' alacak</b>' : '<b>Borcun yok</b>';
      h += '<div class="card"><div class="card-h"><h2>Ödemelerim</h2><p>Ödemeyi stüdyoda yaparsın, kayıt burada görünür.</p></div><div class="card-c"><div class="sumrow" style="border-top:0;padding-top:0"><span>Bakiye</span>' + bal + '</div><div class="table-wrap"><table class="list static" style="margin-top:8px"><thead><tr><th>Tarih</th><th>İşlem</th><th class="r">Tutar</th></tr></thead><tbody>' + s.pay.map(function (p) { return '<tr><td class="tnum">' + esc(p.d) + '</td><td>' + esc(p.t) + '<span class="muted"> · ' + esc(p.m) + '</span></td><td class="r tnum' + (p.a < 0 ? ' pos' : '') + '">' + (p.a < 0 ? '-' : '') + money(p.a) + '</td></tr>'; }).join('') + '</tbody></table></div></div></div>';
      var pv = (s.past || []);
      if (pv.length) h += '<div class="card"><div class="card-h"><h2>Önceki paketler</h2></div><ul class="lines" style="padding-top:8px">' + pv.map(function (p) { return '<li><div><b style="font-weight:500">' + esc(p.n) + '</b><p class="s tnum">' + esc(p.per) + '</p></div><span class="muted">' + esc(p.note) + '</span></li>'; }).join('') + '</ul></div>';
      $$('mh-body').innerHTML = h;
    }

    /* Özel ders */
    var REQ = [
      { id: 1, d: '2026-11-06', s: 16 * 60, l: 60, c: 'Deniz Y.', st: 'wait', at: '3 Kas 19:40', note: '' },
      { id: 2, d: '2026-11-09', s: 17 * 60, l: 60, c: 'Deniz Y.', st: 'alt', at: '2 Kas 11:10', note: '', alt: { d: '2026-11-09', s: 17 * 60 + 30 } },
      { id: 3, d: '2026-10-21', s: 12 * 60 + 30, l: 45, c: 'Deniz Y.', st: 'ok', at: '18 Eki 10:05', note: '' }
    ], rid = 4;
    var RS = { wait: ['badge', 'Yanıt bekliyor'], alt: ['badge solid', 'Alternatif önerildi'], ok: ['badge ok', 'Onaylandı'], no: ['badge soft', 'Reddedildi'], wd: ['badge soft', 'Geri çekildi'] };
    function reqRow(r) {
      var d = pd(r.d), ad = r.alt ? pd(r.alt.d) : null, acts = '';
      if (r.st === 'wait') acts = '<button type="button" class="btn outline sm" data-a="rwd" data-r="' + r.id + '">Geri çek</button>';
      if (r.st === 'alt') acts = '<button type="button" class="btn sm" data-a="racc" data-r="' + r.id + '">Alternatifi kabul et</button><button type="button" class="btn outline sm" data-a="rrej" data-r="' + r.id + '">Reddet</button>';
      return '<li class="slot"><div class="time"><b class="tnum">' + hm(r.s) + '</b><span class="tnum">' + r.l + ' dk</span></div><div><h3>Özel ders · ' + esc(r.c) + '</h3><p class="meta">' + DL[dow(d)] + ', ' + fd(d) + ' · Stüdyo C' + (r.note ? ' · ' + esc(r.note) : '') + '</p>' + (r.st === 'alt' ? '<span class="hint-s">Stüdyo öneriyor: <b>' + DL[dow(ad)] + ', ' + fd(ad) + ' ' + hm(r.alt.s) + '</b>. Eski saatin serbest kalır.</span>' : '<span class="hint-s">Gönderildi: ' + esc(r.at) + '</span>') + '</div><div class="slot-end"><span class="' + RS[r.st][0] + '">' + RS[r.st][1] + '</span>' + acts + '</div></li>';
    }
    function renderOzel() { $$('mo-list').innerHTML = REQ.slice().sort(function (a, b) { return a.d < b.d ? 1 : -1; }).map(reqRow).join('') || '<li class="slot empty"><span class="muted">Henüz talebin yok.</span></li>'; }

    /* Hesabım */
    var prof = { tel: '', mail: '', pend: '' }, NP = { r1: true, r2: true, low: true, ann: false };
    function renderHesap() {
      var s = me(); if (!prof.base) { prof.base = { tel: s.tel, mail: s.mail }; prof.tel = s.tel; prof.mail = s.mail; }
      $$('mk-ad').value = s.n; if (document.activeElement !== $$('mk-tel')) $$('mk-tel').value = prof.tel; if (document.activeElement !== $$('mk-mail')) $$('mk-mail').value = prof.mail;
      $$('mk-mail-b').innerHTML = prof.pend ? '<span class="badge">Doğrulama bekliyor</span>' : s.verified ? '<span class="badge ok">Doğrulandı</span>' : '<span class="badge soft">Doğrulanmadı</span>';
      $$('mk-mail-h').textContent = prof.pend ? prof.pend + ' adresine doğrulama bağlantısı gönderildi. Doğrulayana kadar ' + s.mail + ' kullanılır.' : '';
      mkCheck();
      var dl = SHARED.docsOf ? SHARED.docsOf(ME) : [];
      $$('mk-docs').innerHTML = '<ul class="lines" style="padding:0">' + dl.map(function (d) {
        var ok = d.s === 'ok';
        return '<li><div><b style="font-weight:500">' + esc(d.n) + ' v' + d.v + '</b><p class="s">' + esc(d.need.join(' ve ')) + ' için gerekli</p></div><span style="display:flex;align-items:center;gap:8px">' + (ok ? '<span class="badge ok">' + ic('check') + 'Kabul edildi</span>' : '<span class="badge">' + (d.s === 'old' ? 'Yeniden kabul gerekli' : 'Kabul bekliyor') + '</span><button type="button" class="btn sm" data-a="doc" data-doc="' + d.id + '">Oku ve kabul et</button>') + '</span></li>';
      }).join('') + '</ul>';
      var T = [['r1', 'Ders hatırlatması, e-posta', 'Rezervasyonlu dersten önce.'], ['r2', 'Ders hatırlatması, uygulama', 'Rezervasyonlu dersten önce.'], ['low', 'Hakkın azalınca uyar', 'Kalan ders 2 veya daha az olunca.'], ['ann', 'Stüdyo duyuruları', 'Yeni dönem, etkinlik, tatil.']];
      $$('mk-notif').innerHTML = T.map(function (t) { return '<div class="row"><div><p class="t"><label for="mn-' + t[0] + '">' + t[1] + '</label></p><p class="d">' + t[2] + '</p></div><input type="checkbox" class="switch" id="mn-' + t[0] + '" role="switch" data-np="' + t[0] + '"' + (NP[t[0]] ? ' checked' : '') + '></div>'; }).join('') + '<div class="row"><div><p class="t">Yer teklifi ve iptal bildirimleri</p><p class="d">Zorunlu işlem bildirimleridir, kapatılamaz.</p></div><input type="checkbox" class="switch" role="switch" checked disabled aria-label="Zorunlu bildirimler"></div>';
      renderIcs(); swap($$('mk-docs'));
    }
    function mkCheck() {
      var dirty = $$('mk-tel').value.trim() !== prof.tel || $$('mk-mail').value.trim() !== prof.mail;
      var okT = /^[+0-9 ()-]{10,}$/.test($$('mk-tel').value.trim()), okM = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test($$('mk-mail').value.trim());
      $$('mk-tel-h').textContent = dirty && !okT ? 'Geçerli bir telefon yaz.' : ''; $$('mk-mail-h').textContent = dirty && !okM ? 'Geçerli bir e-posta yaz.' : $$('mk-mail-h').textContent;
      $$('mk-st').textContent = dirty ? 'Kaydedilmemiş değişiklik var.' : 'Değişiklik yok.'; $$('mk-st').className = 'status' + (dirty ? ' dirty' : '');
      $$('mk-undo').disabled = !dirty; $$('mk-save').disabled = !(dirty && okT && okM);
    }
    $$('mk-form').addEventListener('input', mkCheck); $$('mk-form').addEventListener('submit', function (e) { e.preventDefault(); });
    $$('mk-undo').addEventListener('click', function () { $$('mk-tel').value = prof.tel; $$('mk-mail').value = prof.mail; renderHesap(); });
    $$('mk-save').addEventListener('click', function () {
      if ($$('mk-save').disabled) return; var s = me(), nm = $$('mk-mail').value.trim(), nt = $$('mk-tel').value.trim();
      if (nt !== prof.tel) { s.tel = nt; prof.tel = nt; }
      if (nm !== prof.mail) { prof.pend = nm; prof.mail = nm; }
      SHARED.refreshMembers(); renderHesap(); toast(prof.pend ? 'Kaydedildi, e-postanı doğrula' : 'Bilgilerin kaydedildi');
    });
    /* Takvim bağlantısı (ICS): oluştur / yenile / iptal */
    var ICS = { on: false, tok: '', at: '', n: 0 };
    function icsTok() { ICS.n++; var a = 'k7m2xq9ta4vh8rzc3wnj5bpd6ygf'; var t = ''; for (var i = 0; i < 24; i++) t += a[(i * 7 + ICS.n * 13 + i * i * 3) % a.length]; return t; }
    function icsUrl() { return 'https://ftksaas.example/takvim/' + ICS.tok + '.ics'; }
    function renderIcs() {
      var n = upcoming().length, h;
      if (!ICS.on) h = '<p class="muted" style="margin:0 0 12px">Bağlantı yok. Oluşturunca takvim uygulaman yaklaşan rezervasyonlarını kendisi günceller.</p><div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn" id="ics-new">Bağlantı oluştur</button></div>';
      else h = '<div class="mnote" style="margin:0 0 12px"><span><b>Bağlantı etkin</b><br><span class="muted">' + esc(ICS.at) + ' tarihinde oluşturuldu · …' + ICS.tok.slice(-4) + ' · Şu an ' + n + ' yaklaşan rezervasyon</span></span><span class="badge ok">Etkin</span></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn outline" id="ics-rot">Bağlantıyı yenile</button><button type="button" class="btn outline" id="ics-off">Bağlantıyı kapat</button></div>';
      $$('mk-ics').innerHTML = h + '<p class="hint" style="margin:12px 0 0">Bağlantıyı bilen herkes rezervasyon saatlerini görür, kimseyle paylaşma. Takvim uygulamaları genelde birkaç saatte bir yeniler, değişiklikler anında görünmeyebilir.</p>';
      if ($$('ics-new')) $$('ics-new').onclick = function () { icsMake(false); };
      if ($$('ics-rot')) $$('ics-rot').onclick = icsRotate;
      if ($$('ics-off')) $$('ics-off').onclick = icsOff;
    }
    function icsShow(ttl) {
      var u = icsUrl();
      openSheet({ t: ttl, sub: 'Bu bağlantıyı yalnızca şimdi tam görürsün', okTxt: 'Kopyala', noTxt: 'Kapat',
        body: '<div class="field"><label class="label" for="ics-u">Takvim bağlantısı</label><input class="input" id="ics-u" readonly value="' + esc(u) + '"></div><ul class="aff"><li><span class="row-l"><span>Google Takvim</span></span><span class="ch">Diğer takvimler > URL ile ekle</span></li><li><span class="row-l"><span>Apple Takvim</span></span><span class="ch">Dosya > Yeni takvim aboneliği</span></li><li><span class="row-l"><span>Outlook</span></span><span class="ch">Takvim ekle > İnternetten abone ol</span></li></ul>',
        onOk: function () { var done = function () { toast('Bağlantı kopyalandı'); }, sel = function () { $$('ics-u').select(); toast('Bağlantıyı seçtim, kopyala'); }; try { navigator.clipboard.writeText(u).then(done, sel); } catch (e) { sel(); } } });
    }
    function icsMake(rot) { ICS.on = true; ICS.tok = icsTok(); ICS.at = fd(TODAY); renderIcs(); icsShow(rot ? 'Yeni takvim bağlantın hazır' : 'Takvim bağlantın hazır'); }
    function icsRotate() { openSheet({ t: 'Bağlantıyı yenile', sub: 'Eski bağlantı hemen çalışmaz olur', okTxt: 'Yenile', danger: true, body: aff([['Eski bağlantı', 'Kapanır', 'Takvimlerin güncellenmeyi bırakır.'], ['Yeni bağlantı', 'Oluşur', 'Takvim uygulamalarına yeniden eklemen gerekir.']]), onOk: function () { icsMake(true); } }); }
    function icsOff() { openSheet({ t: 'Bağlantıyı kapat', sub: 'Takvimlerin güncellenmeyi bırakır', okTxt: 'Kapat', danger: true, body: aff([['Bağlantı', 'Silinir', 'Daha sonra yenisini oluşturabilirsin.'], ['Takvimdeki dersler', 'Kalır', 'Uygulamandan elle silebilirsin.']]), onOk: function () { ICS.on = false; ICS.tok = ''; closeSheet(); renderIcs(); toast('Takvim bağlantısı kapatıldı'); } }); }
    $$('mk-notif').addEventListener('change', function (e) { var c = e.target.closest('[data-np]'); if (!c) return; NP[c.getAttribute('data-np')] = c.checked; toast('Tercih kaydedildi'); });

    /* Çekmece */
    var sh = $$('m-sheet'), sc = $$('m-scrim'), cur = null, op = null;
    function mmss(s) { return pad(Math.floor(s / 60)) + ':' + pad(s % 60); }
    function aff(rows) { return '<ul class="aff">' + rows.map(function (r) { return '<li><span class="row-l"><span>' + r[0] + '</span><b class="tnum">' + r[1] + '</b></span>' + (r[2] ? '<span class="ch">' + r[2] + '</span>' : '') + '</li>'; }).join('') + '</ul>'; }
    function openSheet(o) { cur = o; op = document.activeElement; $$('m-sh-t').textContent = o.t; $$('m-sh-sub').textContent = o.sub || ''; $$('m-sh-b').innerHTML = o.body; $$('m-sh-ok').textContent = o.okTxt; $$('m-sh-ok').className = 'btn' + (o.danger ? ' danger' : ''); $$('m-sh-cancel').textContent = o.noTxt || 'Vazgeç'; $$('m-sh-cancel').hidden = false; sh.hidden = sc.hidden = false; swap(sh); if (o.chk) o.chk(); else $$('m-sh-ok').disabled = false; (sh.querySelector('input,textarea,select') || $$('m-sh-ok')).focus(); }
    function closeSheet() { sh.hidden = sc.hidden = true; cur = null; if (op && op.focus && document.contains(op)) op.focus(); }
    $$('m-sh-x').addEventListener('click', closeSheet); $$('m-sh-cancel').addEventListener('click', function () { if (cur && cur.onNo) cur.onNo(); closeSheet(); }); sc.addEventListener('click', closeSheet);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !sh.hidden) closeSheet(); });
    sh.addEventListener('input', function () { if (cur && cur.chk) cur.chk(); }); sh.addEventListener('change', function () { if (cur && cur.chk) cur.chk(); });
    $$('m-sh-ok').addEventListener('click', function () { if ($$('m-sh-ok').disabled || !cur) return; var f = cur.onOk; f(); });

    /* Rezervasyon oluştur / iptal et */
    function syncAdmin() { var s = me(), u = upcoming().filter(function (x) { return BK[key(x.s, x.d)] || true; })[0]; s.next = u ? DN[dow(u.d)] + ' ' + hm(u.s.s) : ''; if (SHARED.refreshMembers) SHARED.refreshMembers(); }
    function doBook(s, d, ent) {
      var m = me(), k = key(s, d); BK[k] = { ent: ent, via: 'self' }; DEL[k] = (DEL[k] || 0) + 1; delete WL[k];
      if (m.k === 'c') { m.av--; m.rs++; }
      m.rez.unshift({ d: rezD(s, d), c: s.t, r: 'up', y: 'wait' }); syncAdmin();
    }
    function doCancel(s, d) {
      var m = me(), k = key(s, d), free = freeCancel(s, d), p = pol(), self = !!BK[k], hakIade = free || !p.gec;
      delete BK[k]; if (isGrp(s) && !self) GX[k] = 1; DEL[k] = (DEL[k] || 0) - 1;
      var r = m.rez.filter(function (x) { return x.r === 'up' && x.c === s.t && x.d === rezD(s, d); })[0]; if (r) r.r = 'cancelled';
      if (self && m.k === 'c') { m.rs--; if (hakIade) m.av++; else { m.cn++; if (m.led) m.led.unshift({ d: fd(TODAY), t: 'Geç iptal: ' + s.t, n: '-1' }); } }
      syncAdmin(); return hakIade;
    }
    function bookSheet(s, d) {
      var E = ents(), fc = freeCancel(s, d), p = pol(), ms = minsTo(s, d);
      var body = '<div class="field"><span class="label">Hangi hakkınla?</span><div class="scope" role="radiogroup" aria-label="Hak seç">' + E.map(function (e, i) { return '<label class="opt' + (e.ok ? '' : ' ap-off') + '"><input type="radio" name="mb-e" value="' + e.id + '"' + (e.ok ? (i === 0 ? ' checked' : '') : ' disabled') + '><span><b>' + esc(e.n) + '</b><small>' + esc(e.ok ? e.sub : e.why) + '</small></span></label>'; }).join('') + '</div></div>' +
        aff([['Ders', esc(s.t), when(s, d) + ' · ' + esc(SHARED.coachOf(s)) + ' · ' + esc(s.r)], ['Hak', me().k === 'c' ? '1 ders ayrılır' : 'Sınırsız', me().k === 'c' ? 'Yoklama kapanınca kullanılır. Kalan: ' + (me().av - 1) + ' ders.' : ''], ['Ücretsiz iptal', fc ? freeUntil(s, d) + '\'e kadar' : 'Süre geçti', fc ? '' : 'Bu derste iptal edersen ' + (p.gec ? 'hakkın düşer.' : 'hak iade edilir.')]]);
      openSheet({ t: 'Rezervasyon oluştur', sub: s.t + ', ' + when(s, d), body: body, okTxt: 'Kayıt ol', onOk: function () { var e = $$('m-sh-b').querySelector('input[name="mb-e"]:checked'); if (!e) return; doBook(s, d, ents()[0].n); closeSheet(); render(); toast('Rezervasyonun oluşturuldu'); } });
    }
    function cancelSheet(s, d) {
      var fc = freeCancel(s, d), p = pol(), k = key(s, d), self = !!BK[k], iade = fc || !p.gec, grp = isGrp(s) && !self, wq = BASEQ[s.id] || 0;
      var rows = grp ? [['Katılım', 'Bu hafta iptal', 'Sabit grup üyeliğin sürer, yalnızca ' + fd(d) + ' dersine katılmayacaksın.']] : [['Hak', iade ? '1 ders iade' : '1 ders düşer', fc ? 'Ücretsiz iptal süresi içindesin.' : 'Ücretsiz iptal süresi geçti (' + p.free + ' saat). ' + (p.gec ? 'Stüdyo politikası gereği hak kullanılmış sayılır.' : 'Politika gereği hak yine de iade edilir.')]];
      rows.push(['Yer', '1 yer boşalır', wq || WL[k] ? 'Bekleme listesindeki ilk üyeye süreli teklif gider.' : 'Başka üyeler kayıt olabilir.']);
      openSheet({ t: 'Rezervasyonu iptal et', sub: s.t + ', ' + when(s, d), body: aff(rows) + (fc ? '' : '<p class="note" role="alert">Bu iptal hakkını etkiler. Emin değilsen vazgeç.</p>'), okTxt: 'Rezervasyonu iptal et', danger: true, noTxt: 'Vazgeç', onOk: function () { var r = doCancel(s, d); closeSheet(); render(); toast(grp ? 'Bu haftaki katılımın iptal edildi' : r ? 'İptal edildi, hakkın iade edildi' : 'İptal edildi, hakkın düştü'); } });
    }
    function joinSheet(s, d) {
      var k = key(s, d), pos = (BASEQ[s.id] || 0) + 1;
      openSheet({ t: 'Bekleme listesine gir', sub: s.t + ', ' + when(s, d), body: aff([['Sıran', '#' + pos, 'Yer açılırsa sırayla teklif gider.'], ['Teklif süresi', pol().offer + ' dk', 'Süre içinde yanıtlamazsan sıra bir sonrakine geçer. Seans başlayınca teklif biter.'], ['Hak', 'Şimdilik ayrılmaz', 'Teklifi kabul edince 1 ders ayrılır.']]), okTxt: 'Sıraya gir', onOk: function () { WL[k] = { pos: pos, offer: null }; closeSheet(); render(); toast('Sıradasın: #' + pos); } });
    }
    var tick = null;
    function startTick() { if (tick) return; tick = setInterval(function () { var k = nowOffer(); if (!k) { clearInterval(tick); tick = null; return; } var e = WL[k]; e.offer.left--; document.querySelectorAll('[data-offt]').forEach(function (n) { n.textContent = mmss(Math.max(0, e.offer.left)); }); if (e.offer.left <= 0) { var q = parseKey(k); delete WL[k]; if (cur && cur.offerKey === k) closeSheet(); render(); toast('Teklif süresi doldu, sıran bir sonrakine geçti'); } }, 1000); }
    function offerSheet(s, d) {
      var k = key(s, d), e = WL[k]; if (!e || !e.offer) return;
      openSheet({ t: 'Yer teklifi', sub: s.t + ', ' + when(s, d), offerKey: k, body: '<p class="note" style="margin:0" role="status">Kalan süre: <b class="tnum" data-offt>' + mmss(e.offer.left) + '</b>. Süre dolarsa teklif sıradakine geçer.</p>' + aff([['Ders', esc(s.t), when(s, d) + ' · ' + esc(s.r)], ['Hak', me().k === 'c' ? '1 ders ayrılır' : 'Sınırsız', 'Kabul edersen rezervasyonun hemen oluşur.']]), okTxt: 'Yeri kabul et', noTxt: 'Reddet', onNo: function () { delete WL[k]; render(); toast('Teklifi reddettin, sıran silindi'); }, onOk: function () { doBook(s, d, ents()[0].n); closeSheet(); render(); toast('Yer senin, rezervasyonun oluştu'); } });
      $$('m-sh-x').focus();
    }
    function leaveSheet(s, d) { var k = key(s, d); openSheet({ t: 'Sıradan çık', sub: s.t + ', ' + when(s, d), body: aff([['Sıran', '#' + WL[k].pos, 'Çıkarsan sırayı kaybedersin, tekrar girersen en sona düşersin.']]), okTxt: 'Sıradan çık', danger: true, onOk: function () { delete WL[k]; closeSheet(); render(); toast('Sıradan çıktın'); } }); }

    /* Özel ders talebi */
    function coachesP() { return (SHARED.sd ? SHARED.sd.IN : []).filter(function (e) { return e.on && e.d.indexOf('Özel ders') > -1; }); }
    function reqSheet() {
      var cs = coachesP(), max = pol().open, mn = iso(TODAY), mx = iso(addD(TODAY, max));
      var body = '<div class="form-grid two-col"><div class="field wide"><label class="label" for="mq-c">Eğitmen</label><select class="select" id="mq-c">' + cs.map(function (e) { return '<option value="' + esc(e.n) + '">' + esc(e.n) + '</option>'; }).join('') + '</select></div><div class="field"><label class="label" for="mq-d">Tarih</label><input class="input" id="mq-d" type="date" min="' + mn + '" max="' + mx + '"></div><div class="field"><label class="label" for="mq-t">Başlangıç</label><input class="input tnum" id="mq-t" type="time" step="900" value="16:00"></div><div class="field wide"><span class="label">Süre</span><div class="seg" id="mq-l" role="group" aria-label="Süre"><button type="button" data-l="45" aria-pressed="true">45 dk</button><button type="button" data-l="60" aria-pressed="false">60 dk</button></div></div><div class="field wide"><label class="label" for="mq-n">Not<span class="hint">İsteğe bağlı</span></label><textarea class="input" id="mq-n" rows="2" placeholder="Örn. düğün dansı için hazırlık"></textarea></div></div><p class="note" id="mq-e" role="alert" hidden style="color:var(--destructive)"></p>' + aff([['Hak', 'Onaylanınca 1 ders', 'Paketine göre kullanılır. Talep göndermek hakkını ayırmaz.']]);
      openSheet({ t: 'Özel ders talebi', sub: 'Stüdyo C. Uygun değilse alternatif öneririz.', body: body, okTxt: 'Talebi gönder', chk: reqChk, onOk: function () {
        var d = $$('mq-d').value, l = +$$('mq-l').querySelector('[aria-pressed="true"]').getAttribute('data-l'), c = $$('mq-c').value;
        REQ.unshift({ id: rid++, d: d, s: pm($$('mq-t').value), l: l, c: c.split(' ')[0] + ' ' + c.split(' ')[1][0] + '.', st: 'wait', at: fd(TODAY) + ' ' + hm(NOW), note: $$('mq-n').value.trim() }); closeSheet(); renderOzel(); toast('Talebin gönderildi');
      } });
      $$('mq-l').addEventListener('click', function (e) { var b = e.target.closest('button[data-l]'); if (!b) return; $$('mq-l').querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); reqChk(); });
    }
    function pm(t) { var p = (t || '').split(':'); return p.length === 2 && p[0] !== '' ? +p[0] * 60 + +p[1] : NaN; }
    function reqChk() {
      var dv = $$('mq-d').value, t = pm($$('mq-t').value), l = +$$('mq-l').querySelector('[aria-pressed="true"]').getAttribute('data-l'), c = $$('mq-c').value, err = '';
      if (dv && !isNaN(t)) {
        var d = pd(dv), w = SHARED.sdWin ? SHARED.sdWin(c, dow(d)) : undefined, ts = d.getTime() + t * 60000;
        if (ts <= nowTs) err = 'Geçmiş bir saat seçtin.';
        else if (w === null) err = c.split(' ')[0] + ' ' + DL[dow(d)] + ' günü çalışmıyor.';
        else if (w && (t < w[0] || t + l > w[1])) err = c.split(' ')[0] + ' bu gün yalnızca ' + hm(w[0]) + ' - ' + hm(w[1]) + ' arası uygun.';
        else { var cl = sessOn(d).filter(function (s) { return booked(s, d) && t < s.s + s.l && t + l > s.s; })[0]; if (cl) err = 'Bu saatte "' + cl.t + '" dersin var.'; else if (REQ.some(function (r) { return r.d === dv && (r.st === 'wait' || r.st === 'alt') && t < r.s + r.l && t + l > r.s; })) err = 'Bu saatte bekleyen bir talebin var.'; }
      }
      $$('mq-e').hidden = !err; $$('mq-e').textContent = err; $$('m-sh-ok').disabled = !(dv && !isNaN(t) && !err);
    }
    $$('mo-new').addEventListener('click', reqSheet);
    function docSheet(id) {
      var d = (SHARED.docsOf ? SHARED.docsOf(ME) : []).filter(function (x) { return x.id === id; })[0]; if (!d) return;
      openSheet({ t: d.n, sub: 'Sürüm ' + d.v + (d.date ? ', yayın ' + d.date : ''), body: '<div class="card-c" style="border:1px solid var(--border);border-radius:10px;max-height:14rem;overflow:auto"><p class="muted">Bu belge ' + esc(d.need.join(' ve ').toLocaleLowerCase('tr')) + ' için gereklidir. Tam metin stüdyo tarafından yayınlanan sürümdür; tasarım önizlemesinde özet gösterilir.</p></div><label class="opt"><input type="checkbox" id="md-ok"><span><b>Okudum ve kabul ediyorum</b><small>Kabulün sürüm ve zaman bilgisiyle kaydedilir.</small></span></label>', okTxt: 'Kabul et', chk: function () { $$('m-sh-ok').disabled = !$$('md-ok').checked; }, onOk: function () { SHARED.docAccept(ME, id); closeSheet(); render(); toast('Belge kabul edildi'); } });
    }

    /* Tıklama yönlendirme */
    document.addEventListener('click', function (e) {
      var b = e.target.closest('#mshell [data-a]'); if (!b) return; var a = b.getAttribute('data-a');
      var s = b.getAttribute('data-s') ? byId(b.getAttribute('data-s')) : null, d = b.getAttribute('data-d') ? pd(b.getAttribute('data-d')) : null;
      if (a === 'book') bookSheet(s, d); else if (a === 'cancel') cancelSheet(s, d); else if (a === 'wjoin') joinSheet(s, d); else if (a === 'wleave') leaveSheet(s, d); else if (a === 'offer') offerSheet(s, d);
      else if (a === 'docs') location.hash = '#m-hesap';
      else if (a === 'doc') docSheet(+b.getAttribute('data-doc'));
      else if (a === 'wdemo') { var k = key(s, d), ms = minsTo(s, d), mins = Math.min(pol().offer, ms); if (mins <= 0) { toast('Ders başladı, teklif verilmez'); return; } WL[k].offer = { left: mins * 60 }; startTick(); render(); toast('Yer açıldı, ' + mins + ' dk içinde yanıtla'); }
      else if (a === 'rwd' || a === 'racc' || a === 'rrej') reqAct(a, +b.getAttribute('data-r'));
    });
    function reqAct(a, id) {
      var r = REQ.filter(function (x) { return x.id === id; })[0]; if (!r) return; var d = pd(r.d);
      if (a === 'rwd') openSheet({ t: 'Talebi geri çek', sub: DL[dow(d)] + ', ' + fd(d) + ' ' + hm(r.s), body: aff([['Talep', 'Geri çekilir', 'Stüdyo yanıtlamadan önce geri çekebilirsin. Hakkın etkilenmez.']]), okTxt: 'Geri çek', danger: true, onOk: function () { r.st = 'wd'; closeSheet(); renderOzel(); toast('Talebin geri çekildi'); } });
      else if (a === 'racc') { var ad = pd(r.alt.d); openSheet({ t: 'Alternatifi kabul et', sub: DL[dow(ad)] + ', ' + fd(ad) + ' ' + hm(r.alt.s), body: aff([['Yeni saat', hm(r.alt.s) + ' - ' + hm(r.alt.s + r.l), 'Önceki isteğin (' + hm(r.s) + ') iptal olur.'], ['Hak', 'Onayla ayrılır', 'Kabul ettiğinde 1 ders ayrılır.']]), okTxt: 'Kabul et', onOk: function () { r.d = r.alt.d; r.s = r.alt.s; r.alt = null; r.st = 'ok'; closeSheet(); renderOzel(); toast('Özel dersin onaylandı'); } }); }
      else openSheet({ t: 'Alternatifi reddet', sub: DL[dow(d)] + ', ' + fd(d) + ' ' + hm(r.s), body: aff([['Talep', 'Kapanır', 'Alternatifi reddedince bu talep kapanır, yeni talep açabilirsin.']]), okTxt: 'Reddet', danger: true, onOk: function () { r.st = 'no'; r.alt = null; r.note = 'Alternatifi reddettin'; closeSheet(); renderOzel(); toast('Alternatif reddedildi'); } });
    }

    /* Render ve rota */
    function render() {
      var name = (location.hash || '').slice(1);
      if (name === 'm-dersler') renderDers(); else if (name === 'm-rez') renderRez(); else if (name === 'm-haklarim') renderHak(); else if (name === 'm-ozel') renderOzel(); else if (name === 'm-hesap') renderHesap();
      renderCnt();
    }
    function renderCnt() { var c = $$('m-cnt'), n = Object.keys(WL).filter(function (k) { return WL[k].offer; }).length; if (c) { c.textContent = n; c.hidden = !n; } }
    SHARED.memberRender = render;
    $$('m-theme').addEventListener('click', function () { $$('theme-btn').click(); $$('m-theme').innerHTML = ic(document.documentElement.getAttribute('data-theme') === 'dark' ? 'sun' : 'moon'); });
    $$('m-role').addEventListener('click', function (e) { var b = e.target.closest('button[data-role]'); if (b && SHARED.roleTo) SHARED.roleTo(b.getAttribute('data-role')); });
    var ex = $$('role-sw'); if (ex) { var ub = document.createElement('button'); ub.type = 'button'; ub.setAttribute('data-role', 'uye'); ub.setAttribute('aria-pressed', 'false'); ub.textContent = 'Üye'; ex.appendChild(ub); }
    swap($$('mshell')); swap($$('m-sheet'));
  })();

  /* ---------- Herkese açık sayfa (kurgusal veri). Yönetimden önizlenir, başvurular Adaylar > Başvurular'a düşer ---------- */
  (function () {
    var $$ = function (id) { return document.getElementById(id); };
    var TODAY = new Date(2026, 10, 4), NOW = 14 * 60 + 20;
    var DN = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'], DL = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'], MN = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
    function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
    function pad(n) { return ('0' + n).slice(-2); }
    function hm(m) { return pad(Math.floor(m / 60)) + ':' + pad(m % 60); }
    function addD(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
    function dow(d) { return (d.getDay() + 6) % 7; }
    function fd(d) { return d.getDate() + ' ' + MN[d.getMonth()]; }
    function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
    function money(n) { return '₺' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
    function cfg() { return SHARED.pubCfg(); }
    function sess() { return SHARED.cal.filter(function (x) { return !x.once && !x.from && !x.p; }); }
    var done = false;

    function head() {
      $$('pb-name').textContent = $$('ay-ad').value.trim(); var n = $$('ay-ad').value.trim().split(' '); $$('pb-logo').textContent = (n[0][0] + (n[1] ? n[1][0] : '')).toLocaleUpperCase('tr');
      $$('pb-sub').textContent = $$('ay-sube').value.trim() + ' · ' + $$('ay-tel').value.trim();
    }
    function takvim() {
      var c = cfg(), fil = $$('pt-fil').value, h = '', any = false, types = [];
      sess().forEach(function (s) { if (types.indexOf(s.t) < 0) types.push(s.t); });
      if ($$('pt-fil').options.length === 1) types.sort().forEach(function (t) { var o = document.createElement('option'); o.value = o.textContent = t; $$('pt-fil').appendChild(o); });
      $$('pt-fil-w').hidden = !c.ders;
      $$('pt-p').textContent = $$('ay-adres').value.trim();
      if (c.ders) {
        for (var i = 0; i < 14; i++) {
          var d = addD(TODAY, i), ss = sess().filter(function (s) { return s.d === dow(d) && (!fil || s.t === fil) && (i > 0 || s.s + s.l > NOW); }).sort(function (a, b) { return a.s - b.s; });
          if (!ss.length) continue; any = true;
          h += '<p class="pday">' + (i === 0 ? 'Bugün' : DL[dow(d)]) + ', ' + fd(d) + '</p><div class="card"><ul class="timeline">' + ss.map(function (s) {
            var l = s.c - s.h, b = s.x ? '<span class="badge soft">İptal edildi</span>' : l <= 0 ? '<span class="badge soft">Dolu</span>' : '<span class="badge">' + (c.yer === 'sayi' ? l + ' yer' : 'Müsait') + '</span>';
            return '<li class="slot' + (s.x ? ' done' : '') + '"><div class="time"><b class="tnum">' + hm(s.s) + '</b><span class="tnum">' + s.l + ' dk</span></div><div><h3>' + esc(s.t) + '</h3><p class="meta">' + esc(s.r) + (c.egt ? ' · ' + esc(SHARED.coachFull(SHARED.coachOf(s))) : '') + '</p></div><div class="slot-end">' + b + '</div></li>';
          }).join('') + '</ul></div>';
        }
        if (!any) h = '<div class="card card-c"><p class="muted">' + (fil ? 'Bu ders için yakında seans yok.' : 'Önümüzdeki iki hafta için ders yok.') + '</p></div>';
      }
      $$('pt-days').innerHTML = h;
      var ev = c.etk && SHARED.ev ? SHARED.ev.E.filter(function (e) { return e.st === 'pub' && e.d >= iso(TODAY); }).sort(function (a, b) { return a.d < b.d ? -1 : 1; }) : [];
      $$('pt-ev').innerHTML = ev.length ? '<p class="pday">Etkinlikler ve atölyeler</p><div class="card">' + ev.map(function (e) {
        var p = e.d.split('-'), dd = new Date(+p[0], +p[1] - 1, +p[2]), l = e.cap - e.reg.length;
        return '<div class="pev"><h3>' + esc(e.t) + '</h3><p class="meta muted">' + DL[dow(dd)] + ', ' + fd(dd) + ' · ' + esc(e.s) + ' - ' + esc(e.e) + ' · ' + esc(e.room) + '</p><p><span class="badge">' + (e.fee ? money(e.fee) : 'Ücretsiz') + '</span> <span class="badge soft">' + (l <= 0 ? 'Dolu' : c.yer === 'sayi' ? l + ' yer' : 'Müsait') + '</span></p></div>';
      }).join('') + '</div>' : '';
      if (!c.ders && !ev.length) $$('pt-days').innerHTML = '<div class="card card-c"><p class="muted">Şu an yayınlanan bir içerik yok. Başvuru bırakabilirsin.</p></div>';
      $$('pt-cta').hidden = !c.form;
    }
    function err(id, m) { $$(id).textContent = m || ''; }
    function basvuru() {
      var c = cfg(); $$('pf-form').hidden = !c.form || done; $$('pf-done').hidden = !done; $$('pf-closed').hidden = c.form;
      $$('pf-closed-p').textContent = 'Bize ' + $$('ay-tel').value.trim() + ' numarasından ya da ' + $$('ay-posta').value.trim() + ' adresinden ulaşabilirsin.';
      $$('pf-c-t').textContent = c.cons; $$('pf-gc').textContent = $$('pf-g').value.length + ' / 500';
    }
    function validate() {
      var n = $$('pf-n').value.trim(), m = $$('pf-m').value.trim(), t = $$('pf-t').value.trim(), ok = true;
      err('pf-n-e', n.length < 3 || n.indexOf(' ') < 0 ? 'Adını ve soyadını yaz.' : ''); if ($$('pf-n-e').textContent) ok = false;
      var mOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m), tOk = t.replace(/\D/g, '').length >= 10;
      err('pf-m-e', m && !mOk ? 'E-posta adresi geçerli görünmüyor.' : ''); err('pf-t-e', t && !tOk ? 'Telefon numarası eksik görünüyor.' : '');
      if ((m && !mOk) || (t && !tOk)) ok = false;
      if (!m && !t) { err('pf-m-e', 'E-posta veya telefon yaz.'); ok = false; }
      err('pf-c-e', $$('pf-c').checked ? '' : 'Devam etmek için onay gerekli.'); if (!$$('pf-c').checked) ok = false;
      return ok;
    }
    $$('pf-g').addEventListener('input', function () { $$('pf-gc').textContent = $$('pf-g').value.length + ' / 500'; });
    $$('pf-form').addEventListener('submit', function (e) {
      e.preventDefault(); if (!validate()) { $$('pf-st').textContent = 'Eksik alanları düzeltip tekrar dene.'; return; }
      $$('pf-ok').disabled = true; var c = cfg(), r = 'ok', n = $$('pf-n').value.trim();
      if (!$$('pf-w').value) r = SHARED.appAdd({ n: n, mail: $$('pf-m').value.trim(), tel: $$('pf-t').value.trim(), int: $$('pf-i').value, msg: $$('pf-g').value.trim() || '(mesaj yok)', at: fd(TODAY) + ' ' + hm(NOW), cons: 'İletişim izni verildi', consAt: fd(TODAY) + ' ' + hm(NOW) + ' · form sürüm ' + c.ver });
      done = true; $$('pf-ok').disabled = false;
      $$('pf-done-h').textContent = r === 'dup' ? 'Başvurun zaten bizde' : 'Başvurun alındı';
      $$('pf-done-p').textContent = r === 'dup' ? 'Bu iletişim bilgisiyle bekleyen bir başvurun var, tekrar kaydetmedik. Stüdyo seninle iletişime geçecek.' : 'Teşekkürler ' + n.split(' ')[0] + '. Stüdyo ' + ($$('pf-m').value.trim() ? $$('pf-m').value.trim() : $$('pf-t').value.trim()) + ' üzerinden seninle iletişime geçecek.';
      basvuru(); $$('pf-done').querySelector('h2').setAttribute('tabindex', '-1'); $$('pf-done').querySelector('h2').focus();
    });
    $$('pf-again').addEventListener('click', function () { done = false; ['pf-n', 'pf-m', 'pf-t', 'pf-g', 'pf-w'].forEach(function (i) { $$(i).value = ''; }); $$('pf-c').checked = false; ['pf-n-e', 'pf-m-e', 'pf-t-e', 'pf-c-e'].forEach(function (i) { err(i); }); $$('pf-st').textContent = 'Gönderince başvurun stüdyoya iletilir.'; basvuru(); $$('pf-n').focus(); });
    $$('pt-fil').addEventListener('change', takvim);
    function render() {
      var name = (location.hash || '').slice(1), c = cfg(), pv = document.querySelector('[data-view="p-kapali"]');
      head(); document.querySelectorAll('#pubshell .view').forEach(function (v) { v.hidden = v.getAttribute('data-view') !== (c.on ? name : 'p-kapali'); });
      if (!c.on) { $$('pk-p').textContent = 'Ders programı ve başvuru formu geçici olarak kapalı. ' + $$('ay-posta').value.trim() + ' adresinden bize ulaşabilirsin.'; $$('pubshell').querySelectorAll('.mnav a').forEach(function (a) { a.removeAttribute('aria-current'); }); return; }
      if (name === 'p-takvim') takvim(); else if (name === 'p-basvuru') basvuru();
    }
    SHARED.pubRender = render;
    $$('pv-back').addEventListener('click', function () { SHARED.roleTo('admin'); location.hash = '#ayarlar'; });
    swap($$('pubshell'));
  })();

  /* ---------- Raporlar (kurgusal veri; son 30 gün Paketler ile aynı: 10 paket, ₺12.100) ---------- */
  (function () {
    var $$ = function (id) { return document.getElementById(id); };
    var money = function (n) { return '₺' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); };
    var MON = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
    var PRICE = { '8 derslik paket': 1200, '12 derslik paket': 1800, 'Aylık sınırsız': 1500, 'Deneme dersi': 200 };
    var D = {
      30: {
        label: 'Son 30 gün', weeks: [2400, 3100, 3300, 3300],
        pk: { '8 derslik paket': 3, '12 derslik paket': 2, 'Aylık sınırsız': 3, 'Deneme dersi': 2 },
        cls: [['Salsa orta', 8, 83, 91], ['Bachata başlangıç', 8, 75, 88], ['Arjantin tango teknik', 8, 72, 94], ['Salsa başlangıç', 12, 71, 86], ['Bachata orta', 8, 68, 90], ['Pilates mat', 8, 60, 89]]
      },
      90: {
        label: 'Son 90 gün', weeks: [2400, 2700, 2100, 3000, 2400, 2700, 2400, 2500, 2500, 2400, 3100, 3300, 3300],
        pk: { '8 derslik paket': 9, '12 derslik paket': 6, 'Aylık sınırsız': 8, 'Deneme dersi': 6 },
        cls: [['Salsa orta', 25, 80, 90], ['Bachata başlangıç', 25, 72, 87], ['Arjantin tango teknik', 26, 69, 93], ['Salsa başlangıç', 38, 70, 85], ['Bachata orta', 24, 64, 89], ['Pilates mat', 26, 58, 88]]
      }
    };
    var cur = 30, TODAYD = new Date(2026, 10, 4), CX = { d1: '2026-10-01', d2: '2026-11-04' };
    function pdt(v) { var a = v.split('-'); return new Date(+a[0], +a[1] - 1, +a[2]); }
    function dd(d) { return d.getDate() + ' ' + MON[d.getMonth()]; }
    function cxDays() { return Math.round((pdt(CX.d2) - pdt(CX.d1)) / 86400000) + 1; }
    function cxErr() { if (!CX.d1 || !CX.d2) return 'İki tarihi de seç.'; if (pdt(CX.d2) < pdt(CX.d1)) return 'Bitiş başlangıçtan önce olamaz.'; if (pdt(CX.d2) > TODAYD) return 'Bitiş bugünden sonra olamaz.'; if (cxDays() > 366) return 'En fazla 366 gün seçebilirsin.'; return ''; }
    function customData() {
      var n = cxDays(), f = n / 90, b = D[90], w = Math.max(1, Math.ceil(n / 7)), weeks = [], i, pk = {}, cls = b.cls.map(function (c) { return [c[0], Math.max(1, Math.round(c[1] * f)), c[2], c[3]]; });
      for (i = 0; i < w; i++) weeks.push(b.weeks[(b.weeks.length - 1 - i % b.weeks.length)]); weeks.reverse();
      Object.keys(b.pk).forEach(function (k) { pk[k] = Math.max(1, Math.round(b.pk[k] * f)); });
      return { label: dd(pdt(CX.d1)) + ' - ' + dd(pdt(CX.d2)), weeks: weeks, pk: pk, cls: cls };
    }
    function curD() { return cur === 'x' ? customData() : D[cur]; }
    SHARED.rpPeriod = function () { return cur === 'x' ? { label: customData().label, days: cxDays() } : { label: D[cur].label, days: cur }; };
    function weekLabels(n) {
      var out = [], last = new Date(2026, 10, 2);
      for (var i = n - 1; i >= 0; i--) { var d = new Date(last); d.setDate(d.getDate() - 7 * i); out.push(d.getDate() + ' ' + MON[d.getMonth()]); }
      return out;
    }
    function chart(vals) {
      var W = 640, H = 240, L = 52, R = 8, T = 16, B = 28, n = vals.length;
      var max = Math.ceil(Math.max.apply(null, vals) / 1000) * 1000, step = max / 4, pw = W - L - R, ph = H - T - B, slot = pw / n, bw = Math.min(40, slot * 0.6);
      var labels = weekLabels(n), s = '<svg class="rp-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Haftalık ciro, ' + vals.map(function (v, i) { return labels[i] + ' haftası ' + money(v); }).join(', ') + '">';
      for (var k = 0; k <= 4; k++) {
        var y = T + ph - (ph * k / 4);
        s += '<line class="ch-g" x1="' + L + '" x2="' + (W - R) + '" y1="' + y + '" y2="' + y + '"/><text class="ch-t" x="' + (L - 8) + '" y="' + (y + 4) + '" text-anchor="end">' + money(step * k) + '</text>';
      }
      vals.forEach(function (v, i) {
        var h = ph * v / max, x = L + slot * i + (slot - bw) / 2, y = T + ph - h;
        s += '<rect class="ch-b" x="' + x + '" y="' + y + '" width="' + bw + '" height="' + h + '" rx="3"><title>' + labels[i] + ' haftası: ' + money(v) + '</title></rect>';
        if (n <= 6) s += '<text class="ch-v" x="' + (x + bw / 2) + '" y="' + (y - 6) + '" text-anchor="middle">' + money(v) + '</text>';
        if ((n - 1 - i) % (n > 6 ? 2 : 1) === 0) s += '<text class="ch-t" x="' + (x + bw / 2) + '" y="' + (H - 8) + '" text-anchor="middle">' + labels[i] + '</text>';
      });
      return s + '</svg>';
    }
    function render() {
      if (cur === 'x' && cxErr()) { $$('rp-dh').textContent = cxErr(); $$('rp-dh').className = 'status dirty'; return; }
      $$('rp-dh').textContent = cxDays() + ' gün'; $$('rp-dh').className = 'status';
      var d = curD(), rev = d.weeks.reduce(function (a, b) { return a + b; }, 0);
      var names = Object.keys(d.pk), cnt = names.reduce(function (a, k) { return a + d.pk[k]; }, 0);
      var pkRev = names.reduce(function (a, k) { return a + d.pk[k] * PRICE[k]; }, 0);
      var ses = d.cls.reduce(function (a, c) { return a + c[1]; }, 0);
      var occ = Math.round(d.cls.reduce(function (a, c) { return a + c[1] * c[2]; }, 0) / ses);
      var att = Math.round(d.cls.reduce(function (a, c) { return a + c[1] * c[3]; }, 0) / ses);
      function k(l, v, s) { return '<div class="kpi card"><span class="l">' + l + '</span><b class="tnum">' + v + '</b><span class="sub">' + s + '</span></div>'; }
      $$('rp-kpi').innerHTML = k('Ciro', money(rev), d.label + ', brüt') + k('Satılan paket', String(cnt), 'adet') + k('Ortalama doluluk', '%' + occ, ses + ' seans') + k('Gelen oranı', '%' + att, 'Yoklaması kapanan seanslar');
      $$('rp-sub').textContent = d.label + ' için satış, doluluk ve yoklama özeti.';
      $$('rp-chart').innerHTML = chart(d.weeks);
      $$('rp-pk-sub').textContent = cnt + ' paket, ' + money(pkRev);
      var top = Math.max.apply(null, names.map(function (k) { return d.pk[k] * PRICE[k]; }));
      $$('rp-pk').innerHTML = names.map(function (k) {
        var r = d.pk[k] * PRICE[k];
        return '<div><div class="rp-bar-h"><b>' + k + '</b><span>' + d.pk[k] + ' adet · ' + money(r) + '</span></div><div class="rp-bar-t" role="img" aria-label="' + k + ' ' + money(r) + '"><i style="width:' + Math.round(r / top * 100) + '%"></i></div></div>';
      }).join('');
      renderTab(d, rev, pkRev);
      $$('rp-body').innerHTML = d.cls.slice().sort(function (a, b) { return b[2] - a[2]; }).map(function (c) {
        return '<tr><td>' + c[0] + '</td><td class="r tnum">' + c[1] + '</td><td><span class="minibar tnum"><span class="bar"><i style="width:' + c[2] + '%"></i></span>%' + c[2] + '</span></td><td class="r tnum">%' + c[3] + '</td></tr>';
      }).join('');
    }
    $$('rp-range').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-r]'); if (!b) return; var v = b.getAttribute('data-r'); cur = v === 'x' ? 'x' : +v; $$('rp-custom').hidden = cur !== 'x';
      $$('rp-range').querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); render();
    });
    ['rp-d1', 'rp-d2'].forEach(function (id) { $$(id).addEventListener('input', function () { CX.d1 = $$('rp-d1').value; CX.d2 = $$('rp-d2').value; render(); }); });
    var RT = 'ozet', BY = 'uye', TLm = function (n) { return money(n); };
    $$('rp-tabs').addEventListener('click', function (e) { var b = e.target.closest('[data-rt]'); if (!b) return; RT = b.getAttribute('data-rt'); showTab(); });
    function showTab() { $$('rp-tabs').querySelectorAll('[data-rt]').forEach(function (x) { x.setAttribute('aria-selected', String(x.getAttribute('data-rt') === RT)); }); ['ozet', 'tahsilat', 'egitmen', 'islem'].forEach(function (k) { $$('rp-p-' + k).hidden = k !== RT; }); $$('rp-range').parentNode.style.visibility = RT === 'islem' ? 'hidden' : ''; if (RT === 'islem') jobsRender(); }
    $$('rt-by').addEventListener('click', function (e) { var b = e.target.closest('[data-b]'); if (!b) return; BY = b.getAttribute('data-b'); $$('rt-by').querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); render(); });
    var EG = [['Elif Kara', 17, 7250, 5450], ['Mert Aydın', 14, 4200, 4200], ['Ceren Bulut', 9, 2700, 1350], ['Kaan Sezer', 12, 3600, 3600]];
    function renderTab(d, rev, pkRev) {
      var stu = SHARED.stu(), f = (cur === 'x' ? cxDays() : cur) / 30, debtors = stu.filter(function (x) { return x.debt > 0; }).sort(function (a, b) { return b.debt - a.debt; });
      var debt = debtors.reduce(function (a, x) { return a + x.debt; }, 0), cr = stu.reduce(function (a, x) { return a + (x.cr || 0); }, 0), col = Math.round(rev * 0.86);
      function k(l, v, s2, c) { return '<div class="kpi card"><span class="l">' + l + '</span><b class="tnum">' + v + '</b><span class="sub">' + s2 + '</span></div>'; }
      $$('rt-kpi').innerHTML = k('Tahsil edilen', money(col), d.label) + k('Açık borç', money(debt), debtors.length + ' üye') + k('Alacak', money(cr), 'İade veya mahsup bekliyor') + k('Tahsilat oranı', '%' + Math.round(col / (col + debt) * 100), 'Tahsil / (tahsil + borç)');
      var h, rows;
      if (BY === 'uye') { $$('rt-sub').textContent = 'Açık borcu olan üyeler, en yüksekten.'; h = '<tr><th>Üye</th><th>Hak</th><th>Son ödeme</th><th class="r">Açık borç</th></tr>'; rows = debtors.length ? debtors.map(function (x) { return '<tr><td>' + x.n + '</td><td class="muted">' + (x.pkg || '-') + '</td><td class="tnum muted">' + (x.pay && x.pay[0] ? x.pay[0].d : '-') + '</td><td class="r tnum">' + money(x.debt) + '</td></tr>'; }).join('') : '<tr><td colspan="4" class="muted">Açık borcu olan üye yok.</td></tr>'; }
      else if (BY === 'egt') { $$('rt-sub').textContent = 'Seans katılımından doğan ciro, eğitmene göre.'; h = '<tr><th>Eğitmen</th><th class="r">Seans</th><th class="r">Katılım</th><th class="r">Ciro payı</th></tr>'; rows = EG.map(function (e, i) { return '<tr><td>' + e[0] + '</td><td class="r tnum">' + Math.round(e[1] * f) + '</td><td class="r tnum">' + Math.round(e[1] * f * (9 - i)) + '</td><td class="r tnum">' + money(Math.round(rev * [0.34, 0.28, 0.2, 0.18][i])) + '</td></tr>'; }).join(''); }
      else { $$('rt-sub').textContent = 'Satılan paketler ve brüt tutar.'; h = '<tr><th>Paket</th><th class="r">Adet</th><th class="r">Brüt tutar</th></tr>'; rows = Object.keys(d.pk).map(function (n) { return '<tr><td>' + n + '</td><td class="r tnum">' + d.pk[n] + '</td><td class="r tnum">' + money(d.pk[n] * PRICE[n]) + '</td></tr>'; }).join(''); }
      $$('rt-h').innerHTML = h; $$('rt-body').innerHTML = rows;
      var hk = EG.reduce(function (a, e) { return a + e[2]; }, 0), pd = EG.reduce(function (a, e) { return a + e[3]; }, 0);
      $$('re-kpi').innerHTML = k('Toplam hakediş', money(hk), '4 eğitmen') + k('Ödenen', money(pd), 'Ödeme kayıtları') + k('Kalan', money(hk - pd), 'Ödeme bekliyor') + k('Ders başı ortalama', money(Math.round(hk / EG.reduce(function (a, e) { return a + e[1]; }, 0))), 'Kapanan seans');
      $$('re-body').innerHTML = EG.map(function (e) { return '<tr><td>' + e[0] + '</td><td class="r tnum">' + e[1] + '</td><td class="r tnum">' + money(e[2]) + '</td><td class="r tnum">' + money(e[3]) + '</td><td class="r tnum">' + (e[2] - e[3] ? money(e[2] - e[3]) : '-') + '</td></tr>'; }).join('');
      var fn = [['Yeni aday', 24], ['Deneme dersi', 11], ['Üye oldu', 6]], src = [['Instagram', 9], ['Tavsiye', 7], ['Web formu', 5], ['Yoldan geçen', 3]];
      $$('re-crm').innerHTML = '<div class="rp-bars">' + fn.map(function (x) { return '<div><div class="rp-bar-h"><b>' + x[0] + '</b><span>' + x[1] + ' kişi</span></div><div class="rp-bar-t" role="img" aria-label="' + x[0] + ' ' + x[1] + '"><i style="width:' + Math.round(x[1] / 24 * 100) + '%"></i></div></div>'; }).join('') + '</div><p class="status" style="margin:12px 0 0">Dönüşüm %25. Kaynaklar: ' + src.map(function (x) { return x[0] + ' ' + x[1]; }).join(', ') + '.</p>';
    }
    /* Dışa aktarma işleri (report_export_start / report_file_get) */
    var JOBS = [], JID = 0, IMPS = [], io = null, ioOp = null;
    var REPS = { ozet: 'Satış ve doluluk özeti', tahsilat: 'Tahsilat ve borç', uye: 'Borçlu üye listesi', hakedis: 'Eğitmen hakedişi', crm: 'Aday hunisi' };
    function jobsRender() {
      $$('ri-exp').innerHTML = JOBS.length ? '<ul class="lines" style="padding:0">' + JOBS.map(function (j) {
        var st = j.st === 'run' ? '<span style="display:flex;align-items:center;gap:8px"><span class="bar" style="width:96px"><i style="width:' + j.p + '%"></i></span><span class="tnum muted">%' + j.p + '</span></span>' : j.st === 'ok' ? '<span style="display:flex;align-items:center;gap:8px"><span class="badge ok">Hazır</span><button type="button" class="btn ghost sm" data-jdl="' + j.id + '">İndir</button></span>' : '<span style="display:flex;align-items:center;gap:8px"><span class="badge bad">Başarısız</span><button type="button" class="btn ghost sm" data-jre="' + j.id + '">Yeniden dene</button></span>';
        return '<li><div><b style="font-weight:500">' + j.n + '</b><p class="s tnum">' + j.r + ' · CSV' + (j.pii ? ' · Kişi bilgisi içerir' : '') + (j.st === 'err' ? ' · Zaman aşımı, işlem tamamlanmadı' : j.st === 'ok' ? ' · ' + j.rows + ' satır · 24 saat geçerli' : ' · Hazırlanıyor') + '</p></div>' + st + '</li>';
      }).join('') + '</ul>' : '<p class="muted" style="margin:0">Henüz dışa aktarma yok. Raporlar sayfasında "Dışa aktar" ile başlat.</p>';
      $$('ri-imp').innerHTML = IMPS.length ? '<ul class="lines" style="padding:0">' + IMPS.map(function (m, i) { return '<li><div><b style="font-weight:500">' + m.file + '</b><p class="s tnum">' + m.at + ' · ' + m.ok + ' aktarıldı, ' + m.skip + ' atlandı</p></div><button type="button" class="btn ghost sm" data-irows="' + i + '">Satırları gör</button></li>'; }).join('') + '</ul>' : '<p class="muted" style="margin:0">Henüz içe aktarma yok.</p>';
      var run = JOBS.filter(function (j) { return j.st === 'run'; }).length; $$('rp-jn').hidden = !run; $$('rp-jn').textContent = run;
    }
    function jobStep(j) {
      if (j.st !== 'run') return;
      j.p = Math.min(100, j.p + 18 + (j.id * 7) % 13);
      if (j.fail && !j.retried && j.p >= 60) { j.st = 'err'; j.p = 60; jobsRender(); toast('Dışa aktarma tamamlanamadı, yeniden deneyebilirsin'); return; }
      if (j.p >= 100) { j.st = 'ok'; j.p = 100; jobsRender(); toast(j.n + ' hazır'); return; }
      jobsRender(); setTimeout(function () { jobStep(j); }, 450);
    }
    function jobStart(o) { var j = { id: ++JID, n: o.n, r: o.r, pii: o.pii, rows: o.rows, st: 'run', p: 0, fail: o.fail, retried: false }; JOBS.unshift(j); RT = 'islem'; showTab(); setTimeout(function () { jobStep(j); }, 450); return j; }
    $$('ri-exp').addEventListener('click', function (e) {
      var d = e.target.closest('[data-jdl]'), r = e.target.closest('[data-jre]');
      if (d) { var j = JOBS.filter(function (x) { return x.id === +d.getAttribute('data-jdl'); })[0]; toast(j.n + ' indirilecek (CSV, tasarımda dosya yok)'); }
      if (r) { var k2 = JOBS.filter(function (x) { return x.id === +r.getAttribute('data-jre'); })[0]; k2.st = 'run'; k2.p = 0; k2.retried = true; jobsRender(); setTimeout(function () { jobStep(k2); }, 450); }
    });
    /* Ortak çekmece */
    function ioOpen(o) { io = o; ioOp = document.activeElement; $$('io-t').textContent = o.t; $$('io-sub').textContent = o.sub || ''; $$('io-b').innerHTML = o.body; $$('io-ok').textContent = o.ok || ''; $$('io-ok').hidden = !o.ok; $$('io-ok').className = 'btn'; $$('io-cancel').textContent = o.no || 'Vazgeç'; $$('io-sheet').hidden = $$('io-scrim').hidden = false; swap($$('io-sheet')); if (o.chk) o.chk(); else $$('io-ok').disabled = false; ($$('io-sheet').querySelector('input,select') || $$('io-ok')).focus(); }
    function ioClose() { $$('io-sheet').hidden = $$('io-scrim').hidden = true; io = null; if (ioOp && ioOp.focus && document.contains(ioOp)) ioOp.focus(); }
    $$('io-x').addEventListener('click', ioClose); $$('io-cancel').addEventListener('click', ioClose); $$('io-scrim').addEventListener('click', ioClose);
    $$('io-ok').addEventListener('click', function () { if (!$$('io-ok').disabled && io && io.onOk) io.onOk(); });
    $$('io-sheet').addEventListener('input', function () { if (io && io.chk) io.chk(); }); $$('io-sheet').addEventListener('change', function () { if (io && io.chk) io.chk(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$$('io-sheet').hidden) ioClose(); });
    /* Dışa aktar */
    $$('rp-exp').addEventListener('click', function () {
      if (cur === 'x' && cxErr()) { toast(cxErr()); return; }
      var P = SHARED.rpPeriod(), def = RT === 'tahsilat' ? 'tahsilat' : RT === 'egitmen' ? 'hakedis' : 'ozet', long = P.days > 180;
      ioOpen({ t: 'Raporu dışa aktar', sub: P.label + ' · CSV', ok: 'Dışa aktarmayı başlat',
        body: '<div class="field"><label class="label" for="ex-r">Rapor</label><select class="select" id="ex-r">' + Object.keys(REPS).map(function (k) { return '<option value="' + k + '"' + (k === def ? ' selected' : '') + '>' + REPS[k] + '</option>'; }).join('') + '</select></div><div id="ex-eff"></div>',
        chk: function () { var k = $$('ex-r').value, pii = k === 'uye'; $$('ex-eff').innerHTML = '<ul class="aff"><li><span class="row-l"><span>Dönem</span><b class="tnum">' + P.days + ' gün</b></span><span class="ch">' + P.label + '</span></li><li><span class="row-l"><span>Dosya</span><b class="tnum">CSV</b></span><span class="ch">UTF-8, noktalı virgül ayraçlı, Excel\'de açılır.</span></li><li><span class="row-l"><span>Hazırlık</span><b class="tnum">' + (long ? 'Uzun sürebilir' : 'Birkaç saniye') + '</b></span><span class="ch">Dosyalar sekmesinden izlersin, sayfadan ayrılabilirsin.</span></li></ul>' + (pii ? '<p class="note" role="note"><i data-i="lock"></i><span>Bu dosya üyelerin adı ve borç bilgisini içerir. 24 saat sonra silinir, güvenli sakla.</span></p>' : ''); swap($$('ex-eff')); $$('io-ok').disabled = false; },
        onOk: function () { var k = $$('ex-r').value; jobStart({ n: REPS[k], r: P.label, pii: k === 'uye', rows: k === 'uye' ? SHARED.stu().filter(function (x) { return x.debt > 0; }).length : 6 + (P.days > 90 ? 6 : 0), fail: long }); ioClose(); toast('Dışa aktarma başlatıldı'); } });
    });
    /* İçe aktar sihirbazı (import_upload_prepare / preview / apply / rows_list) */
    var SAMPLE = 'Ad Soyad;E-posta;Telefon\nBurcu Yalçın;burcu.yalcin@ornek.test;0532 111 22 33\nSelin Aksoy;selin.aksoy@ornek.test;0532 000 00 02\nTolga Eren;tolga.eren@ornek.test;\nDeniz Kaya;deniz.kaya@@ornek.test;0533 444 55 66\nÖykü Tan;oyku.tan@ornek.test;12\nTolga Eren;tolga.eren@ornek.test;0535 222 33 44\nMelis Arda;melis.arda@ornek.test;0536 333 44 55\n;;0537 000 11 22\nCan Polat;can.polat@ornek.test;0538 555 66 77\nEce Sönmez;ece.sonmez@ornek.test;0539 666 77 88\nBarış Akın;baris.akin;0530 777 88 99\nNil Duman;nil.duman@ornek.test;0531 888 99 00';
    var IMPMAIL = {}, ST = { ok: ['ok', 'Aktarılır'], warn: ['', 'Uyarı'], dup: ['soft', 'Zaten kayıtlı'], err: ['bad', 'Hatalı'], lim: ['bad', 'Plan limiti'] };
    function csvParse(t, name) {
      var lines = t.replace(/^﻿/, '').split(/\r?\n/).filter(function (l) { return l.trim() !== ''; }); if (lines.length < 2) return { e: 'Dosyada başlık satırından sonra satır yok.' };
      var sep = lines[0].indexOf(';') > -1 ? ';' : ',', hd = lines[0].split(sep).map(function (x) { return x.trim().toLocaleLowerCase('tr'); });
      var ci = hd.map(function (x) { return /e-?posta|mail/.test(x) ? 'm' : /telefon|gsm/.test(x) ? 't' : /ad/.test(x) ? 'n' : ''; });
      if (ci.indexOf('m') < 0) return { e: 'E-posta sütunu bulunamadı. Başlık satırında "E-posta" olmalı.' };
      if (lines.length - 1 > 500) return { e: 'En fazla 500 satır içe aktarılır. Dosyada ' + (lines.length - 1) + ' satır var.' };
      var existing = {}; SHARED.stu().forEach(function (x) { if (x.mail) existing[x.mail.toLowerCase()] = 1; }); var seen = {}, room = 100 - SHARED.stu().filter(function (x) { return x.on; }).length, rows = [];
      lines.slice(1).forEach(function (l, i) {
        var c = l.split(sep), r = { i: i + 2, n: '', m: '', t: '', st: 'ok', why: '' }; ci.forEach(function (k, j) { if (k && c[j] !== undefined) r[k] = c[j].trim(); });
        var ml = r.m.toLowerCase();
        if (!r.m) { r.st = 'err'; r.why = 'E-posta boş.'; } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.m)) { r.st = 'err'; r.why = 'E-posta geçerli değil.'; }
        else if (existing[ml] || IMPMAIL[ml]) { r.st = 'dup'; r.why = 'Bu e-posta ile üye ya da davet var.'; } else if (seen[ml]) { r.st = 'dup'; r.why = 'Dosyada ' + seen[ml] + '. satırla aynı.'; }
        else if (room <= 0) { r.st = 'lim'; r.why = 'Aktif üye limiti (100) doldu.'; } else { seen[ml] = r.i; room--; if (r.t && !/^[+0-9 ()-]{10,}$/.test(r.t)) { r.st = 'warn'; r.t = ''; r.why = 'Telefon geçersiz, boş aktarılır.'; } }
        rows.push(r);
      });
      return { rows: rows, file: name };
    }
    function cnt(rows, k) { return rows.filter(function (r) { return r.st === k; }).length; }
    function impStart() { ioOpen({ t: 'Üyeleri içe aktar', sub: 'Adım 1 / 3 · Dosya', no: 'Vazgeç', body: '<p class="muted" style="margin-top:0">CSV dosyası, ilk satır başlık. Zorunlu sütun <b>E-posta</b>, isteğe bağlı <b>Ad Soyad</b> ve <b>Telefon</b>. En fazla 500 satır.</p><div class="field"><label class="label" for="im-f">CSV dosyası</label><input class="input" type="file" id="im-f" accept=".csv,text/csv"></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn outline sm" id="im-s">Örnek dosyayı kullan</button><button type="button" class="btn ghost sm" id="im-t">Şablonu indir</button></div><p class="note" id="im-e" role="alert" hidden style="margin-top:12px"></p><ul class="aff" style="margin-top:12px"><li><span class="row-l"><span>Davet</span></span><span class="ch">Aktarılan kişiler davet e-postasıyla gelir, adını ve telefonunu kendileri tamamlar.</span></li><li><span class="row-l"><span>Tekrar</span></span><span class="ch">Aynı e-posta ile üye ya da davet varsa o satır atlanır.</span></li></ul>',
      onOk: null, ok: '', chk: function () {} }); $$('io-ok').hidden = true;
      function go(t, n) { var r = csvParse(t, n); if (r.e) { $$('im-e').textContent = r.e; $$('im-e').hidden = false; return; } impPreview(r); }
      $$('im-s').onclick = function () { go(SAMPLE, 'uyeler-ornek.csv'); }; $$('im-t').onclick = function () { toast('Şablon indirilecek (Ad Soyad;E-posta;Telefon)'); };
      $$('im-f').onchange = function () { var f = this.files[0]; if (!f) return; if (f.size > 1048576) { $$('im-e').textContent = 'Dosya 1 MB sınırını aşıyor.'; $$('im-e').hidden = false; return; } var rd = new FileReader(); rd.onload = function () { go(String(rd.result), f.name); }; rd.readAsText(f); };
    }
    function impTable(rows, flt) {
      var v = rows.filter(function (r) { return !flt || (flt === 'sorun' ? r.st !== 'ok' : r.st === flt); });
      return '<div class="table-wrap" style="overflow:visible"><table class="list static" style="table-layout:fixed;width:100%;min-width:0"><colgroup><col style="width:3.2rem"><col style="width:48%"><col></colgroup><thead><tr><th>Satır</th><th>Kişi</th><th>Durum</th></tr></thead><tbody>' + (v.length ? v.slice(0, 50).map(function (r) { var b = ST[r.st]; return '<tr><td class="tnum">' + r.i + '</td><td style="overflow-wrap:anywhere">' + (r.n ? '<b style="font-weight:500">' + r.n + '</b><br>' : '') + (r.m || '<span class="muted">E-posta yok</span>') + '</td><td style="white-space:normal"><span class="badge ' + b[0] + '">' + b[1] + '</span>' + (r.why ? '<div class="muted" style="font-size:12px;margin-top:4px">' + r.why + '</div>' : '') + '</td></tr>'; }).join('') + (v.length > 50 ? '<tr><td colspan="3" class="muted">...ve ' + (v.length - 50) + ' satır daha</td></tr>' : '') : '<tr><td colspan="3" class="muted">Bu filtrede satır yok.</td></tr>') + '</tbody></table></div>';
    }
    function impPreview(R) {
      var rows = R.rows, ok = cnt(rows, 'ok') + cnt(rows, 'warn'), skip = rows.length - ok, flt = '';
      function draw() {
        $$('io-b').innerHTML = '<div class="kpis" style="grid-template-columns:repeat(3,minmax(0,1fr));margin-bottom:12px"><div class="kpi card"><span class="l">Aktarılır</span><b class="tnum">' + ok + '</b></div><div class="kpi card"><span class="l">Atlanır</span><b class="tnum">' + skip + '</b></div><div class="kpi card"><span class="l">Uyarı</span><b class="tnum">' + cnt(rows, 'warn') + '</b></div></div><div class="seg sm" role="group" aria-label="Satır filtresi" id="im-flt" style="margin-bottom:12px">' + [['', 'Tümü'], ['sorun', 'Sorunlu'], ['err', 'Hatalı'], ['dup', 'Tekrar']].map(function (x) { return '<button type="button" data-f="' + x[0] + '" aria-pressed="' + (flt === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div>' + impTable(rows, flt) + (skip ? '<label class="opt" style="margin-top:12px"><input type="checkbox" id="im-ack"><span><b>' + skip + ' satırın atlanacağını biliyorum</b><small>Atlanan satırlar içe aktarılmaz, listesini sonra indirebilirsin.</small></span></label>' : '');
        $$('im-flt').onclick = function (e) { var b = e.target.closest('[data-f]'); if (!b) return; flt = b.getAttribute('data-f'); draw(); }; if ($$('im-ack')) $$('im-ack').onchange = function () { io.chk(); }; io.chk();
      }
      io.ok = ''; $$('io-t').textContent = 'Önizleme'; $$('io-sub').textContent = 'Adım 2 / 3 · ' + R.file + ' · ' + rows.length + ' satır'; $$('io-ok').hidden = false; $$('io-ok').textContent = ok + ' üyeyi içe aktar';
      io.chk = function () { $$('io-ok').disabled = !ok || ($$('im-ack') ? !$$('im-ack').checked : false); };
      io.onOk = function () { impApply(R, ok, skip); }; draw();
    }
    function impApply(R, ok, skip) {
      $$('io-ok').disabled = true; $$('io-t').textContent = 'İçe aktarılıyor'; $$('io-sub').textContent = 'Adım 3 / 3'; $$('io-cancel').hidden = true; var p = 0;
      $$('io-b').innerHTML = '<p class="muted" style="margin-top:0">Satırlar işleniyor. Bu pencereyi kapatsan da iş sürer.</p><div class="bar"><i id="im-b" style="width:0"></i></div><p class="status tnum" id="im-p" style="margin-top:8px">%0</p>';
      (function tick() { p = Math.min(100, p + 25); $$('im-b').style.width = p + '%'; $$('im-p').textContent = '%' + p; if (p < 100) { setTimeout(tick, 300); return; }
        R.rows.forEach(function (r) { if (r.st === 'ok' || r.st === 'warn') IMPMAIL[r.m.toLowerCase()] = 1; });
        var rec = { file: R.file, at: '4 Kas 14:20', ok: ok, skip: skip, rows: R.rows }; IMPS.unshift(rec); jobsRender(); if (SHARED.hist) { /* Ayarlar geçmişine yazılmaz: denetim ekranına kalır */ }
        $$('io-t').textContent = 'İçe aktarma tamamlandı'; $$('io-sub').textContent = R.file; $$('io-cancel').hidden = false; $$('io-cancel').textContent = 'Kapat'; $$('io-ok').hidden = false; $$('io-ok').textContent = 'Satırları gör'; $$('io-ok').disabled = false;
        $$('io-b').innerHTML = '<ul class="aff"><li><span class="row-l"><span>Aktarılan</span><b class="tnum">' + ok + '</b></span><span class="ch">Davet e-postası gönderildi. Kişiler hesabını kendisi tamamlar.</span></li><li><span class="row-l"><span>Atlanan</span><b class="tnum">' + skip + '</b></span><span class="ch">' + (skip ? 'Hatalı, tekrar ya da limit nedeniyle.' : 'Yok.') + '</span></li></ul>' + (skip ? '<button type="button" class="btn outline sm" id="im-dl" style="margin-top:12px">Atlanan satırları indir</button>' : '');
        if ($$('im-dl')) $$('im-dl').onclick = function () { toast('Atlanan ' + skip + ' satır CSV olarak indirilecek'); }; io.onOk = function () { impRows(rec); };
      })();
    }
    function impRows(rec) {
      var flt = ''; function draw() { $$('io-b').innerHTML = '<div class="seg sm" role="group" aria-label="Satır filtresi" id="im-flt" style="margin-bottom:12px">' + [['', 'Tümü'], ['ok', 'Aktarılan'], ['sorun', 'Sorunlu']].map(function (x) { return '<button type="button" data-f="' + x[0] + '" aria-pressed="' + (flt === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div>' + impTable(rec.rows, flt); $$('im-flt').onclick = function (e) { var b = e.target.closest('[data-f]'); if (!b) return; flt = b.getAttribute('data-f'); draw(); }; }
      $$('io-t').textContent = 'İçe aktarılan satırlar'; $$('io-sub').textContent = rec.file + ' · ' + rec.at; $$('io-ok').hidden = true; $$('io-cancel').hidden = false; $$('io-cancel').textContent = 'Kapat'; io.onOk = null; draw();
    }
    $$('st-imp').addEventListener('click', impStart);
    $$('ri-imp').addEventListener('click', function (e) { var b = e.target.closest('[data-irows]'); if (!b) return; ioOpen({ t: '', body: '', ok: '' }); impRows(IMPS[+b.getAttribute('data-irows')]); });
    render(); showTab();
  })();

  /* ---------- Giriş ve hesap (S01): kurgusal hesaplar, gerçek kimlik doğrulama yok ---------- */
  (function () {
    var $$ = function (id) { return document.getElementById(id); };
    var ACC = { 'ayse@ornek.test': { pw: 'Parola123!', role: 'admin', n: 'Ayşe Yılmaz', ver: true, mfa: false }, 'elif.kara@ornek.test': { pw: 'Parola123!', role: 'egt', n: 'Elif Kara', ver: true, mfa: false }, 'selin.aksoy@ornek.test': { pw: 'Parola123!', role: 'uye', n: 'Selin Aksoy', ver: true, mfa: false }, 'yeni@ornek.test': { pw: 'Parola123!', role: 'admin', n: 'Yeni Kullanıcı', ver: false, mfa: false } };
    var CUR = 'ayse@ornek.test', FAIL = {}, MFAF = 0, PEND = null, VMAIL = '', RESET = null, RC = [], RCUSED = {}, CLK = 31, flash = '';
    var SEC = [['Giriş', 'Chrome, Windows', '4 Kas 08:12'], ['Parola değişti', 'Chrome, Windows', '4 Ağu 10:40'], ['Giriş', 'Safari, iPhone', '4 Kas 12:20'], ['Oturum açıldı, yeni cihaz', 'Firefox, macOS', '23 Eki 09:05']];
    function secAdd(t, dev) { SEC.unshift([t, dev || 'Chrome, Windows', '4 Kas 14:' + String(20 + CLK++ % 40).padStart(2, '0')]); secRender(); }
    SHARED.secAll = function () { return SEC; };
    function secRender() { $$('ac-hist').innerHTML = '<ul class="lines" style="padding:0">' + SEC.slice(0, 8).map(function (x) { return '<li><div><b style="font-weight:500">' + x[0] + '</b><p class="s">' + x[1] + ' · IP 88.231.•••.12</p></div><span class="muted tnum">' + x[2] + '</span></li>'; }).join('') + '</ul>'; }
    function mailOk(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
    function rules(inp, ul) { var v = $$(inp).value, ok = { len: v.length >= 10, let: /[A-Za-z]/.test(v) && /\d/.test(v) }; $$(ul).querySelectorAll('li').forEach(function (li) { li.setAttribute('data-ok', ok[li.getAttribute('data-r')] ? '1' : '0'); }); return ok.len && ok.let; }
    function msg(id, t) { var e = $$(id); e.textContent = t || ''; e.hidden = !t; }
    function go(h) { location.hash = '#' + h; }
    function done(email) {
      var a = ACC[email]; CUR = email; FAIL[email] = 0; MFAF = 0; PEND = null; secAdd('Giriş', 'Chrome, Windows'); $$('ax-lp').value = '';
      toast('Hoş geldin, ' + a.n.split(' ')[0]); SHARED.roleTo(a.role);
    }
    /* Giriş */
    $$('ax-lf').addEventListener('submit', function (e) {
      e.preventDefault(); var em = $$('ax-le').value.trim().toLowerCase(), pw = $$('ax-lp').value; msg('ax-lerr', ''); msg('ax-le-h', ''); msg('ax-lp-h', '');
      var bad = false; if (!mailOk(em)) { msg('ax-le-h', 'Geçerli bir e-posta yaz.'); bad = true; } if (!pw) { msg('ax-lp-h', 'Parolanı yaz.'); bad = true; } if (bad) return;
      if ((FAIL[em] || 0) >= 5) { msg('ax-lerr', 'Çok fazla hatalı deneme. 15 dakika sonra tekrar dene ya da parolanı sıfırla.'); return; }
      var a = ACC[em]; if (!a || a.pw !== pw) { FAIL[em] = (FAIL[em] || 0) + 1; msg('ax-lerr', 'E-posta ya da parola hatalı.'); $$('ax-lp').select(); return; }
      if (!a.ver) { VMAIL = em; go('a-dogrula'); return; }
      if (a.mfa) { PEND = em; MFAF = 0; go('a-mfa'); return; }
      done(em);
    });
    $$('ax-goog').addEventListener('click', function () { toast('Google ile giriş önizlemede yok. Hesap bağlıysa buradan devam eder.'); });
    /* Kayıt */
    $$('ax-sp').addEventListener('input', function () { rules('ax-sp', 'ax-sr'); });
    $$('ax-sf').addEventListener('submit', function (e) {
      e.preventDefault(); var n = $$('ax-sn').value.trim(), em = $$('ax-se').value.trim().toLowerCase(), bad = false;
      msg('ax-sn-h', n.indexOf(' ') < 1 ? 'Adını ve soyadını yaz.' : ''); msg('ax-se-h', mailOk(em) ? '' : 'Geçerli bir e-posta yaz.'); msg('ax-sc-h', $$('ax-sc').checked ? '' : 'Devam etmek için onay gerekli.');
      if (n.indexOf(' ') < 1 || !mailOk(em) || !$$('ax-sc').checked || !rules('ax-sp', 'ax-sr')) { if (!rules('ax-sp', 'ax-sr')) $$('ax-sp').focus(); return; }
      if (!ACC[em]) ACC[em] = { pw: $$('ax-sp').value, role: 'admin', n: n, ver: false, mfa: false };
      VMAIL = em; $$('ax-sp').value = ''; go('a-dogrula');
    });
    /* E-posta doğrulama (hesap var olsa da olmasa da aynı sonuç) */
    var tm = null;
    function vState() {
      clearInterval(tm); $$('ax-v1').hidden = false; $$('ax-v2').hidden = true; $$('ax-v-p').textContent = (VMAIL || 'yeni@ornek.test') + ' adresine doğrulama bağlantısı gönderdik. Gelmediyse istenmeyenler klasörüne de bak.';
      var left = 20; $$('ax-vre').disabled = true; $$('ax-vst').textContent = 'Yeniden göndermek için ' + left + ' sn bekle.';
      tm = setInterval(function () { left--; if (left <= 0) { clearInterval(tm); $$('ax-vre').disabled = false; $$('ax-vst').textContent = ''; } else $$('ax-vst').textContent = 'Yeniden göndermek için ' + left + ' sn bekle.'; }, 1000);
    }
    $$('ax-vre').addEventListener('click', function () { toast('Doğrulama bağlantısı yeniden gönderildi'); vState(); });
    $$('ax-vopen').addEventListener('click', function () { var a = ACC[VMAIL]; if (a) a.ver = true; clearInterval(tm); $$('ax-v1').hidden = true; $$('ax-v2').hidden = false; });
    /* Parola kurtarma */
    $$('ax-pf').addEventListener('submit', function (e) {
      e.preventDefault(); var em = $$('ax-pe').value.trim().toLowerCase(); if (!mailOk(em)) { msg('ax-pe-h', 'Geçerli bir e-posta yaz.'); return; } msg('ax-pe-h', '');
      RESET = ACC[em] ? em : null; $$('ax-p1').hidden = true; $$('ax-p2').hidden = false; $$('ax-p2-p').textContent = em + ' kayıtlıysa sıfırlama bağlantısı gönderdik. Bağlantı 30 dakika geçerlidir.';
    });
    $$('ax-popen').addEventListener('click', function () { if (!RESET) { toast('Bu adres kayıtlı değil, e-posta gitmedi (önizleme)'); return; } go('a-yeni-parola'); });
    $$('ax-np').addEventListener('input', function () { rules('ax-np', 'ax-nr'); });
    $$('ax-nf').addEventListener('submit', function (e) {
      e.preventDefault(); var ok = rules('ax-np', 'ax-nr'), same = $$('ax-np').value === $$('ax-np2').value; msg('ax-np2-h', same ? '' : 'Parolalar aynı olmalı.'); if (!ok || !same || !RESET) return;
      ACC[RESET].pw = $$('ax-np').value; FAIL[RESET] = 0; CUR = RESET; secAdd('Parola sıfırlandı', 'Chrome, Windows'); $$('ax-np').value = $$('ax-np2').value = ''; flash = 'Parolan güncellendi, diğer oturumlar kapatıldı. Yeni parolayla giriş yap.'; RESET = null; go('a-giris');
    });
    /* İki adımlı doğrulama (giriş) */
    var rcMode = false;
    $$('ax-mrc').addEventListener('click', function () { rcMode = !rcMode; $$('ax-mc').value = ''; $$('ax-mc').maxLength = rcMode ? 9 : 6; $$('ax-mc-l').textContent = rcMode ? 'Kurtarma kodu' : 'Doğrulama kodu'; $$('ax-mrc').textContent = rcMode ? 'Uygulama kodu kullan' : 'Kurtarma kodu kullan'; $$('ax-m-p').textContent = rcMode ? 'Kurtarma kodlarından birini yaz. Her kod bir kez çalışır.' : 'Doğrulama uygulamandaki 6 haneli kodu yaz.'; msg('ax-mc-h', ''); });
    $$('ax-mf').addEventListener('submit', function (e) {
      e.preventDefault(); var v = $$('ax-mc').value.trim().toUpperCase(); if (!PEND) { go('a-giris'); return; }
      var okc = rcMode ? ((RC.indexOf(v) > -1 || v === 'ABCD-1234') && !RCUSED[v]) : v === '123456';
      if (okc) { if (rcMode) { RCUSED[v] = 1; toast('Kurtarma kodu kullanıldı, yenisini oluşturmayı düşün'); } done(PEND); return; }
      MFAF++; if (MFAF >= 5) { PEND = null; flash = 'Çok fazla hatalı kod. Yeniden giriş yap.'; go('a-giris'); return; } msg('ax-mc-h', 'Kod geçersiz ya da süresi doldu.');
    });
    /* Davet kabulü */
    $$('ax-dp').addEventListener('input', function () { rules('ax-dp', 'ax-dr'); });
    $$('ax-df').addEventListener('submit', function (e) {
      e.preventDefault(); var n = $$('ax-dn').value.trim(); msg('ax-dn-h', n.indexOf(' ') < 1 ? 'Adını ve soyadını yaz.' : ''); msg('ax-dc-h', $$('ax-dc').checked ? '' : 'Devam etmek için onay gerekli.');
      if (n.indexOf(' ') < 1 || !$$('ax-dc').checked || !rules('ax-dp', 'ax-dr')) return;
      ACC['elif.kara@ornek.test'].pw = $$('ax-dp').value; $$('ax-dp').value = ''; flash = 'Davet kabul edildi. elif.kara@ornek.test ile giriş yap.'; go('a-giris');
    });
    $$('ax-dnew').addEventListener('click', function () { toast('Stüdyo yöneticisine yeni davet isteği gitti'); });
    $$('ax-back').addEventListener('click', function () { SHARED.roleTo('admin'); });
    SHARED.authRender = function (name) {
      document.querySelectorAll('#authshell .view').forEach(function (v) { v.hidden = v.getAttribute('data-view') !== name; });
      if (name === 'a-giris') { msg('ax-lerr', ''); $$('ax-flash').hidden = !flash; $$('ax-flash').textContent = flash; flash = ''; }
      if (name === 'a-dogrula') vState();
      if (name === 'a-parola') { $$('ax-p1').hidden = false; $$('ax-p2').hidden = true; }
      if (name === 'a-mfa') { rcMode = false; $$('ax-mc').value = ''; $$('ax-mc').maxLength = 6; $$('ax-mc-l').textContent = 'Doğrulama kodu'; $$('ax-mrc').textContent = 'Kurtarma kodu kullan'; $$('ax-m-p').textContent = 'Doğrulama uygulamandaki 6 haneli kodu yaz.'; msg('ax-mc-h', ''); if (!PEND) { go('a-giris'); return; } }
      if (name === 'a-yeni-parola' && !RESET) { go('a-parola'); return; }
      swap($$('authshell'));
    };
    /* Çekmece */
    var ax = null, axOp = null;
    function axOpen(o) { ax = o; axOp = document.activeElement; $$('ax-t').textContent = o.t; $$('ax-sub').textContent = o.sub || ''; $$('ax-b').innerHTML = o.body; $$('ax-ok').textContent = o.ok; $$('ax-ok').className = 'btn' + (o.danger ? ' danger' : ''); $$('ax-ok').hidden = !o.ok; $$('ax-cancel').hidden = false; $$('ax-cancel').textContent = o.no || 'Vazgeç'; $$('ax-sheet').hidden = $$('ax-scrim').hidden = false; swap($$('ax-sheet')); if (o.chk) o.chk(); else $$('ax-ok').disabled = false; ($$('ax-sheet').querySelector('input') || $$('ax-ok')).focus(); }
    function axClose() { $$('ax-sheet').hidden = $$('ax-scrim').hidden = true; ax = null; if (axOp && axOp.focus && document.contains(axOp)) axOp.focus(); }
    $$('ax-x').addEventListener('click', axClose); $$('ax-cancel').addEventListener('click', axClose); $$('ax-scrim').addEventListener('click', axClose);
    $$('ax-ok').addEventListener('click', function () { if (!$$('ax-ok').disabled && ax && ax.onOk) ax.onOk(); });
    $$('ax-sheet').addEventListener('input', function () { if (ax && ax.chk) ax.chk(); }); $$('ax-sheet').addEventListener('change', function () { if (ax && ax.chk) ax.chk(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$$('ax-sheet').hidden) axClose(); });
    function fld(id, l, t, ac) { return '<div class="field"><label class="label" for="' + id + '">' + l + '</label><input class="input" id="' + id + '" type="' + (t || 'text') + '"' + (ac ? ' autocomplete="' + ac + '"' : '') + '><span class="hint ax-err" id="' + id + '-h"></span></div>'; }
    function rulesHtml(id) { return '<ul class="ax-rules" id="' + id + '"><li data-r="len">En az 10 karakter</li><li data-r="let">Harf ve rakam içerir</li></ul>'; }
    /* Hesabım: parola */
    $$('ac-pw').addEventListener('click', function () {
      axOpen({ t: 'Parolayı değiştir', sub: 'Değişince diğer cihazlardaki oturumlar kapanır', ok: 'Parolayı değiştir', body: fld('ap-c', 'Mevcut parola', 'password', 'current-password') + fld('ap-n', 'Yeni parola', 'password', 'new-password') + rulesHtml('ap-r') + fld('ap-n2', 'Yeni parola tekrar', 'password', 'new-password'),
        chk: function () { var a = $$('ap-c').value, ok = rules('ap-n', 'ap-r'), same = $$('ap-n').value === $$('ap-n2').value; $$('ap-n2-h').textContent = $$('ap-n2').value && !same ? 'Parolalar aynı olmalı.' : ''; $$('ap-c-h').textContent = ''; $$('ax-ok').disabled = !(a && ok && same); },
        onOk: function () { if ($$('ap-c').value !== ACC[CUR].pw) { $$('ap-c-h').textContent = 'Mevcut parola hatalı.'; return; } ACC[CUR].pw = $$('ap-n').value; document.querySelectorAll('tr[data-sess]').forEach(function (r) { r.remove(); }); axClose(); secAdd('Parola değişti'); toast('Parolan değişti, diğer oturumlar kapatıldı'); } });
    });
    /* Hesabım: iki adımlı doğrulama */
    function mfaRender() { var on = ACC[CUR].mfa; $$('ac-mfa-b').textContent = on ? 'Açık' : 'Kapalı'; $$('ac-mfa-b').className = 'badge ' + (on ? 'ok' : 'soft'); $$('ac-mfa').textContent = on ? 'Kapat' : 'Kur'; }
    function qr() { var s = '', i, j; for (i = 0; i < 17; i++) for (j = 0; j < 17; j++) { var f = (i < 5 && j < 5) || (i < 5 && j > 11) || (i > 11 && j < 5); if (f ? (i % 4 === 0 || j % 4 === 0 || (i === 2 && j % 4 === 2) || (i % 4 === 2 && j === 2)) : ((i * 7 + j * 13 + i * j) % 5 < 2)) s += '<rect x="' + j + '" y="' + i + '" width="1" height="1"/>'; } return '<svg class="ax-qr" viewBox="0 0 17 17" role="img" aria-label="Kurulum için QR kodu (önizlemede örnek)" fill="#111">' + s + '</svg>'; }
    $$('ac-mfa').addEventListener('click', function () {
      if (ACC[CUR].mfa) { axOpen({ t: 'İki adımı kapat', sub: 'Hesabın yalnız parolayla korunur', ok: 'İki adımı kapat', danger: true, body: '<p class="note" role="alert"><i data-i="lock"></i><span>Kapatınca girişte kod sorulmaz. Kurtarma kodların geçersiz olur.</span></p>' + fld('am-p', 'Parolanı yaz', 'password', 'current-password'), chk: function () { $$('ax-ok').disabled = !$$('am-p').value; $$('am-p-h').textContent = ''; }, onOk: function () { if ($$('am-p').value !== ACC[CUR].pw) { $$('am-p-h').textContent = 'Parola hatalı.'; return; } ACC[CUR].mfa = false; RC = []; axClose(); mfaRender(); secAdd('İki adım kapatıldı'); toast('İki adımlı doğrulama kapatıldı'); } }); return; }
      var key = 'JBSW Y3DP EHPK 3PXP';
      axOpen({ t: 'İki adımlı doğrulamayı kur', sub: 'Adım 1 / 2 · Uygulamayı bağla', ok: 'Kodu doğrula', body: '<div style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start">' + qr() + '<div style="flex:1;min-width:10rem"><p class="muted" style="margin:0 0 8px">Doğrulama uygulamasıyla QR kodu tara ya da anahtarı elle gir.</p><code class="tnum" style="display:block;padding:8px;border:1px solid var(--border);border-radius:6px;word-break:break-all">' + key + '</code></div></div><div style="margin-top:16px">' + fld('am-c', 'Uygulamadaki 6 haneli kod', 'text', 'one-time-code') + '</div>',
        chk: function () { $$('am-c-h').textContent = ''; $$('ax-ok').disabled = !/^\d{6}$/.test($$('am-c').value.trim()); },
        onOk: function () { if ($$('am-c').value.trim() !== '123456') { $$('am-c-h').textContent = 'Kod geçersiz. Önizleme kodu 123456.'; return; }
          RC = ['K4M9-2XQ7', 'T8VH-5RZC', 'W3NJ-6BPD', 'Y7GF-1LSA', 'C2QX-9MTE', 'H5RB-4KWN', 'P6DZ-8JVU', 'F1SA-3YGH']; ACC[CUR].mfa = true; mfaRender(); secAdd('İki adım açıldı');
          $$('ax-t').textContent = 'Kurtarma kodların'; $$('ax-sub').textContent = 'Adım 2 / 2 · Telefonunu kaybedersen bu kodlarla girersin'; $$('ax-ok').textContent = 'Bitir'; $$('ax-cancel').hidden = true;
          $$('ax-b').innerHTML = '<div class="ax-codes" id="am-codes">' + RC.map(function (c) { return '<span>' + c + '</span>'; }).join('') + '</div><div style="display:flex;gap:8px;margin:12px 0"><button type="button" class="btn outline sm" id="am-cp">Kopyala</button></div><label class="opt"><input type="checkbox" id="am-ack"><span><b>Kodları güvenli bir yere kaydettim</b><small>Her kod bir kez çalışır, bu ekran bir daha gösterilmez.</small></span></label>';
          $$('ax-ok').disabled = true; ax.chk = function () { $$('ax-ok').disabled = !$$('am-ack').checked; }; ax.onOk = function () { $$('ax-cancel').hidden = false; axClose(); toast('İki adımlı doğrulama açıldı'); };
          $$('am-cp').onclick = function () { try { navigator.clipboard.writeText(RC.join('\n')).then(function () { toast('Kodlar kopyalandı'); }, function () { toast('Kopyalanamadı, kodları elle yaz'); }); } catch (er) { toast('Kopyalanamadı, kodları elle yaz'); } }; } });
    });
    /* Hesabı sil: yönetici (stüdyo sahibi) engeli */
    $$('ac-del').addEventListener('click', function () {
      axOpen({ t: 'Hesabı sil', sub: 'Önce etkileri görürsün', ok: '', no: 'Kapat', body: '<ul class="aff"><li><span class="row-l"><span>Stüdyo sahipliği</span><b class="tnum">Engel</b></span><span class="ch">Stüdyonun tek sahibisin. Silmek için önce sahipliği başka bir yöneticiye devret ya da stüdyoyu kapat.</span></li><li><span class="row-l"><span>Kişisel bilgilerin</span><b class="tnum">Silinir</b></span><span class="ch">Ad, e-posta, telefon, fotoğraf.</span></li><li><span class="row-l"><span>Yaptığın işlemler</span><b class="tnum">Kalır</b></span><span class="ch">Denetim kayıtlarında "Silinmiş kullanıcı" olarak görünür.</span></li></ul><p class="note" role="note"><i data-i="lock"></i><span>Sahiplik devri ve stüdyo kapatma Ayarlar > Ekip ve Faz C kapsamındadır.</span></p>' });
    });
    /* Hesabım: oturumlar, çıkış */
    document.addEventListener('click', function (e) { var b = e.target.closest('[data-kill]'); if (!b) return; var r = b.closest('tr'); secAdd('Oturum kapatıldı: ' + r.getAttribute('data-sess')); r.remove(); toast('Oturum kapatıldı'); });
    function out() { secAdd('Çıkış'); PEND = null; SHARED.roleTo('auth'); }
    $$('ac-out').addEventListener('click', out); $$('mk-out').addEventListener('click', out);
    /* Üye: hesabı sil (account_delete_preview/apply) */
    $$('mk-del').addEventListener('click', function () {
      var s = SHARED.stu().filter(function (x) { return x.n === 'Selin Aksoy'; })[0] || {}, up = (s.rez || []).filter(function (r) { return r.r === 'up'; }).length, debt = s.debt || 0, blocked = debt > 0;
      axOpen({ t: 'Hesabı sil', sub: 'Önce etkileri görürsün', ok: blocked ? '' : 'Hesabı sil', danger: true, no: blocked ? 'Kapat' : 'Vazgeç',
        body: '<ul class="aff">' + (blocked ? '<li><span class="row-l"><span>Açık borç</span><b class="tnum">₺' + debt + '</b></span><span class="ch">Önce stüdyoyla borcunu kapat.</span></li>' : '') + '<li><span class="row-l"><span>Yaklaşan rezervasyon</span><b class="tnum">' + up + '</b></span><span class="ch">' + (up ? 'Hepsi iptal olur, haklar iade edilir.' : 'Yok.') + '</span></li><li><span class="row-l"><span>Kalan hak</span><b class="tnum">' + (s.k === 'c' ? s.av + ' ders' : 'Süreli') + '</b></span><span class="ch">Silinince kullanılamaz, iade edilmez.</span></li><li><span class="row-l"><span>Kişisel bilgilerin</span><b class="tnum">Silinir</b></span><span class="ch">Mali kayıtlar stüdyoda yasal süre boyunca kalır.</span></li></ul>' + (blocked ? '' : '<div style="margin-top:12px">' + fld('ad-t', 'Onaylamak için SİL yaz', 'text') + fld('ad-p', 'Parolan', 'password', 'current-password') + '</div>'),
        chk: function () { if ($$('ad-t')) { $$('ad-t-h').textContent = ''; $$('ad-p-h').textContent = ''; $$('ax-ok').disabled = !($$('ad-t').value.trim().toLocaleUpperCase('tr') === 'SİL' && $$('ad-p').value); } },
        onOk: function () { if ($$('ad-p').value !== ACC['selin.aksoy@ornek.test'].pw) { $$('ad-p-h').textContent = 'Parola hatalı.'; return; } axClose(); SHARED.roleTo('auth'); go('a-silindi'); toast('Hesap silindi (önizlemede kayıt silinmez)'); } });
    });
    mfaRender(); secRender();
  })();

  /* ---------- Denetim ve işlem durumu (S11/F33; kurgusal veri) ---------- */
  (function () {
    var $$ = function (id) { return document.getElementById(id); };
    var MO = { Oca: 1, Şub: 2, Mar: 3, Nis: 4, May: 5, Haz: 6, Tem: 7, Ağu: 8, Eyl: 9, Eki: 10, Kas: 11, Ara: 12 };
    function key(at) { var m = /(\d+) (\S+) (\d+):(\d+)/.exec(at); return ((MO[m[2]] * 31 + +m[1]) * 24 + +m[3]) * 60 + +m[4]; }
    var NOW = key('4 Kas 14:20'), DAY = 24 * 60, AID = 5000;
    var A = [
      ['4 Kas 13:58', 'Ayşe Y.', 'Finans', 'Tahsilat kaydedildi', 'Burak Kaya · ₺1.800', 'ok', 'Yöntem: kart', ''],
      ['4 Kas 12:40', 'Ayşe Y.', 'Yoklama', 'Yoklama düzeltildi', 'Salsa orta, 3 Kas · Derya Sönmez', 'ok', 'Gelmedi → Geldi · Gerekçe: Yanlış işaretlendi', ''],
      ['4 Kas 11:15', 'Elif K.', 'Hakediş', 'Hakediş ödemesi kaydı denendi', 'Elif Kara · ₺1.800', 'denied', 'Eğitmen rolünde bu işlem yok', ''],
      ['4 Kas 10:02', 'Mehmet K.', 'Ekip', 'Rol atandı', 'Merve Tan · Resepsiyon', 'ok', 'Rol yok → Resepsiyon', ''],
      ['3 Kas 18:22', 'Sistem', 'Otomasyon', 'Toplu bildirim gönderildi', 'Yeni dönem duyurusu · 42 alıcı', 'fail', '38 gönderildi, 4 iletilemedi (geçersiz adres)', 'OP-2040'],
      ['3 Kas 16:05', 'Ayşe Y.', 'Belgeler', 'Belge sürümü yayınlandı', 'Sağlık ve sorumluluk beyanı v2', 'ok', 'Tüm üyelerden yeniden kabul istendi', ''],
      ['3 Kas 15:30', 'Ayşe Y.', 'Üyeler', 'Hak düzeltildi', 'Onur Çelik · 8 derslik paket', 'ok', 'Kalan ders: 1 → 2 · Gerekçe: Telafi', ''],
      ['2 Kas 19:44', 'Ayşe Y.', 'Finans', 'İade yapıldı', 'Mert Aydın · ₺450', 'fail', 'Kart sağlayıcısı işlemi reddetti', 'OP-2035'],
      ['2 Kas 14:10', 'Ayşe Y.', 'Üyeler', 'Dondurma uygulandı', 'Nehir Gür · 5 gün', 'ok', 'Bitiş 10 Kas, hak süresi 5 gün uzadı', ''],
      ['1 Kas 09:30', 'Ayşe Y.', 'Paketler', 'Paket sürümü yayınlandı', '12 derslik paket v3', 'ok', 'Fiyat ₺1.700 → ₺1.800 (yeni satışlar)', 'OP-2036'],
      ['30 Eki 17:20', 'Sistem', 'Hakediş', 'Hakediş ödemesi düzeltmesi', 'Ceren Bulut · ₺1.350', 'fail', 'Sağlayıcı yanıt vermedi, otomatik yeniden deneme', 'OP-2039'],
      ['27 Eki 13:00', 'Ayşe Y.', 'Etkinlikler', 'Etkinlik yayınlandı', 'Tango Milonga Atölyesi', 'ok', 'Kontenjan 20, ücret ₺450', ''],
      ['21 Eki 10:15', 'Mehmet K.', 'Üyeler', 'Üye pasifleştirildi', 'Aylin Polat', 'ok', 'Gerekçe: Taşındı', ''],
      ['12 Eki 16:48', 'Ayşe Y.', 'Seans', 'Seans taşındı', 'Bachata orta · 14 Eki 19:00 → 20:00', 'ok', '9 üyeye bildirim gitti', '']
    ];
    function all() {
      var out = A.map(function (a) { return { k: key(a[0]), at: a[0], by: a[1], mod: a[2], act: a[3], obj: a[4], res: a[5], d: a[6], op: a[7], id: 'AU-' + (4000 + key(a[0]) % 997) }; });
      (SHARED.histAll ? SHARED.histAll() : []).forEach(function (h, i) { out.push({ k: key(h.at), at: h.at, by: h.by, mod: 'Ayarlar', act: 'Ayar değişti', obj: h.sec, res: 'ok', d: h.lines.join('\n'), op: '', id: 'AU-' + (3000 + i) }); });
      (SHARED.secAll ? SHARED.secAll() : []).forEach(function (x, i) { out.push({ k: key(x[2]), at: x[2], by: 'Ayşe Y.', mod: 'Güvenlik', act: x[0], obj: 'Hesap', res: 'ok', d: x[1], op: '', id: 'AU-' + (2000 + i) }); });
      (EXTRA || []).forEach(function (x) { out.push(x); });
      return out.sort(function (a, b) { return b.k - a.k; });
    }
    var EXTRA = [], PER = 30, LIM = 12, SHOW = LIM;
    function auditAdd(mod, act, obj, res, d, op) { var m = 20 + (AID++ % 40); EXTRA.push({ k: NOW + (AID % 7), at: '4 Kas 14:' + m, by: 'Ayşe Y.', mod: mod, act: act, obj: obj, res: res, d: d || '', op: op || '', id: 'AU-' + AID }); }
    var RES = { ok: ['ok', 'Başarılı'], fail: ['bad', 'Başarısız'], denied: ['', 'Reddedildi'] };
    var OPS = [
      { id: 'OP-2041', n: 'Seans taşıma: Salsa orta, 6 Kas 18:00 → 19:00', st: 'preview', left: 11 * 60, note: '12 üyeye bildirim gider, çakışma yok.' },
      { id: 'OP-2040', n: 'Toplu bildirim: Yeni dönem duyurusu', st: 'partial', done: 38, total: 42, retry: true, note: '4 alıcıya iletilemedi (geçersiz adres).' },
      { id: 'OP-2039', n: 'Hakediş ödemesi düzeltmesi: Ceren Bulut', st: 'retry_wait', next: '14:35', att: 2, max: 5, note: 'Sağlayıcı yanıt vermedi. Sistem kendisi yeniden deneyecek, senin yapacağın bir şey yok.' },
      { id: 'OP-2038', n: 'Üye içe aktarma: uyeler-ornek.csv', st: 'failed', retry: true, note: 'Dosya okunamadı, zaman aşımı.' },
      { id: 'OP-2037', n: 'Dışa aktarma: Eğitmen hakedişi', st: 'running', p: 35 },
      { id: 'OP-2035', n: 'İade: Mert Aydın · ₺450', st: 'failed', retry: false, note: 'Kart sağlayıcısı reddetti. İşlem tekrarlanamaz, Finans > İade ile yenisini başlat.' },
      { id: 'OP-2036', n: 'Paket sürümü yayını: 12 derslik paket v3', st: 'done', note: 'Yeni satışlar v3 ile yapılır, eski satışlar etkilenmedi.' }
    ];
    var SL = { preview: ['', 'Onay bekliyor'], running: ['', 'Çalışıyor'], partial: ['bad', 'Kısmen tamamlandı'], retry_wait: ['', 'Yeniden denenecek'], failed: ['bad', 'Başarısız'], done: ['ok', 'Tamamlandı'], expired: ['soft', 'Onay süresi doldu'] };
    function attn() { return OPS.filter(function (o) { return o.st === 'partial' || o.st === 'expired' || (o.st === 'failed' && o.retry) || o.st === 'preview'; }).length; }
    function side() { var c = document.querySelector('[data-route="denetim"] .count'); if (c) { var n = attn(); c.textContent = n; c.hidden = !n; } var b = $$('dn-n'); if (b) { b.textContent = attn(); b.hidden = !attn(); } }
    var TAB = 'kayit', F = { q: '', mod: '', res: '', per: 30 };
    function modOpts() { var m = {}; all().forEach(function (x) { m[x.mod] = 1; }); $$('dn-mod').innerHTML = '<option value="">Tüm modüller</option>' + Object.keys(m).sort().map(function (k) { return '<option' + (F.mod === k ? ' selected' : '') + '>' + k + '</option>'; }).join(''); }
    function renderLog() {
      var rows = all().filter(function (x) { return (!F.mod || x.mod === F.mod) && (!F.res || x.res === F.res) && (!F.per || NOW - x.k <= F.per * DAY) && (!F.q || (x.by + ' ' + x.act + ' ' + x.obj + ' ' + x.mod).toLocaleLowerCase('tr').indexOf(F.q) > -1); });
      $$('dn-body').innerHTML = rows.length ? rows.slice(0, SHOW).map(function (x) { var r = RES[x.res]; return '<tr data-au="' + x.id + '" tabindex="0" style="cursor:pointer"><td class="tnum muted" style="white-space:nowrap">' + x.at + '</td><td>' + x.by + '</td><td>' + x.act + '</td><td class="muted">' + x.obj + '</td><td><span class="badge ' + r[0] + '">' + r[1] + '</span></td></tr>'; }).join('') : '<tr><td colspan="5" class="muted">Bu filtreye uyan kayıt yok.</td></tr>';
      $$('dn-st').textContent = rows.length + ' kayıttan ' + Math.min(SHOW, rows.length) + ' tanesi gösteriliyor.'; $$('dn-more').hidden = rows.length <= SHOW;
    }
    $$('dn-q').addEventListener('input', function () { F.q = this.value.trim().toLocaleLowerCase('tr'); SHOW = LIM; renderLog(); });
    $$('dn-mod').addEventListener('change', function () { F.mod = this.value; SHOW = LIM; renderLog(); }); $$('dn-res').addEventListener('change', function () { F.res = this.value; SHOW = LIM; renderLog(); });
    $$('dn-per').addEventListener('click', function (e) { var b = e.target.closest('[data-p]'); if (!b) return; F.per = +b.getAttribute('data-p'); $$('dn-per').querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); SHOW = LIM; renderLog(); });
    $$('dn-more').addEventListener('click', function () { SHOW += LIM; renderLog(); });
    /* Çekmece */
    var dn = null, dnOp = null;
    function dOpen(o) { dn = o; dnOp = document.activeElement; $$('dn-t').textContent = o.t; $$('dn-sub').textContent = o.sub || ''; $$('dn-b').innerHTML = o.body; $$('dn-ok').hidden = !o.ok; $$('dn-ok').textContent = o.ok || ''; $$('dn-ok').className = 'btn' + (o.danger ? ' danger' : ''); $$('dn-ok').disabled = false; $$('dn-sheet').hidden = $$('dn-scrim').hidden = false; swap($$('dn-sheet')); $$('dn-ok').hidden ? $$('dn-cancel').focus() : $$('dn-ok').focus(); }
    function dClose() { $$('dn-sheet').hidden = $$('dn-scrim').hidden = true; dn = null; if (dnOp && dnOp.focus && document.contains(dnOp)) dnOp.focus(); }
    $$('dn-x').addEventListener('click', dClose); $$('dn-cancel').addEventListener('click', dClose); $$('dn-scrim').addEventListener('click', dClose);
    $$('dn-ok').addEventListener('click', function () { if (!$$('dn-ok').disabled && dn && dn.onOk) dn.onOk(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$$('dn-sheet').hidden) dClose(); });
    function kv(rows) { return '<dl class="kv" style="margin:0;grid-template-columns:7rem 1fr">' + rows.map(function (r) { return '<dt>' + r[0] + '</dt><dd>' + r[1] + '</dd>'; }).join('') + '</dl>'; }
    function openAudit(id) {
      var x = all().filter(function (y) { return y.id === id; })[0]; if (!x) return; var r = RES[x.res];
      dOpen({ t: x.act, sub: x.obj, body: kv([['Kayıt', x.id], ['Zaman', x.at + ' (Europe/Istanbul)'], ['Kişi', x.by], ['Modül', x.mod], ['Sonuç', '<span class="badge ' + r[0] + '">' + r[1] + '</span>'], ['Cihaz', x.by === 'Sistem' ? 'Sistem işi' : 'Chrome, Windows · IP 88.231.•••.12']]) + '<div class="pn-h" style="margin:16px 0 8px"><h2>Ayrıntı</h2></div><div class="note" style="white-space:pre-line">' + (x.d || 'Ek ayrıntı yok.') + '</div>' + (x.op ? '<p style="margin:12px 0 0"><button type="button" class="btn outline sm" id="dn-goop" data-op="' + x.op + '">İşlem durumunu aç (' + x.op + ')</button></p>' : '') + '<p class="status" style="margin-top:12px"><i data-i="lock"></i> Bu kayıt değiştirilemez ve silinemez. 2 yıl saklanır.</p>' });
      if ($$('dn-goop')) $$('dn-goop').onclick = function () { dClose(); tab('islem'); var el = document.querySelector('[data-opid="' + this.getAttribute('data-op') + '"]'); if (el) el.scrollIntoView({ block: 'center' }); };
    }
    $$('dn-body').addEventListener('click', function (e) { var t = e.target.closest('[data-au]'); if (t) openAudit(t.getAttribute('data-au')); });
    $$('dn-body').addEventListener('keydown', function (e) { if (e.key === 'Enter') { var t = e.target.closest('[data-au]'); if (t) openAudit(t.getAttribute('data-au')); } });
    /* İşlemler */
    function fmt(sec) { return String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0'); }
    function renderOps() {
      function k(l, v, s2) { return '<div class="kpi card"><span class="l">' + l + '</span><b class="tnum">' + v + '</b><span class="sub">' + s2 + '</span></div>'; }
      var c = function (st) { return OPS.filter(function (o) { return o.st === st; }).length; };
      $$('dn-kpi').innerHTML = k('Dikkat gerektiren', attn(), 'Onay, kısmi ya da yeniden denenebilir') + k('Çalışıyor', c('running'), 'İlerleme canlı') + k('Yeniden denenecek', c('retry_wait'), 'Sistem kendisi dener') + k('Tamamlanan', c('done'), 'Bu liste');
      $$('dn-ops').innerHTML = '<ul class="lines" style="padding:0">' + OPS.map(function (o) {
        var s2 = SL[o.st], mid = '', act = '';
        if (o.st === 'running') mid = '<div style="display:flex;align-items:center;gap:8px;margin-top:6px"><span class="bar" style="width:160px"><i style="width:' + o.p + '%"></i></span><span class="tnum muted">%' + o.p + '</span></div>';
        if (o.st === 'partial') mid = '<div style="display:flex;align-items:center;gap:8px;margin-top:6px"><span class="bar" style="width:160px"><i style="width:' + Math.round(o.done / o.total * 100) + '%"></i></span><span class="tnum muted">' + o.done + ' / ' + o.total + '</span></div>';
        if (o.st === 'retry_wait') mid = '<p class="s tnum" style="margin:6px 0 0">Sonraki deneme ' + o.next + ' · ' + o.att + ' / ' + o.max + '</p>';
        if (o.st === 'preview') mid = '<p class="s tnum" style="margin:6px 0 0">Önizleme ' + fmt(o.left) + ' sonra geçersiz olur.</p>';
        if (o.st === 'preview') act = '<button type="button" class="btn outline sm" data-oa="pv" data-id="' + o.id + '">Önizlemeyi aç</button>';
        if (o.st === 'expired') act = '<button type="button" class="btn outline sm" data-oa="renew" data-id="' + o.id + '">Önizlemeyi yenile</button>';
        if ((o.st === 'partial' || o.st === 'failed') && o.retry) act = '<button type="button" class="btn outline sm" data-oa="retry" data-id="' + o.id + '">' + (o.st === 'partial' ? 'Başarısızları yeniden dene' : 'Yeniden dene') + '</button>';
        return '<li data-opid="' + o.id + '"><div><b style="font-weight:500">' + o.n + '</b><p class="s">' + o.id + (o.note ? ' · ' + o.note : '') + '</p>' + mid + '</div><span style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end"><span class="badge ' + s2[0] + '">' + s2[1] + '</span>' + act + '</span></li>';
      }).join('') + '</ul>'; swap($$('dn-ops')); side();
    }
    function get(id) { return OPS.filter(function (o) { return o.id === id; })[0]; }
    function startRun(o, label) { o.st = 'running'; o.p = 0; o.run = label; renderOps(); }
    $$('dn-ops').addEventListener('click', function (e) {
      var b = e.target.closest('[data-oa]'); if (!b || b.disabled) return; var o = get(b.getAttribute('data-id')), a = b.getAttribute('data-oa');
      if (a === 'pv') dOpen({ t: 'Önizleme', sub: o.id + ' · ' + fmt(o.left) + ' sonra geçersiz', ok: 'Uygula', body: '<ul class="aff"><li><span class="row-l"><span>Seans</span><b class="tnum">Salsa orta</b></span><span class="ch">6 Kas 18:00 → 19:00, Salon A</span></li><li><span class="row-l"><span>Bildirim</span><b class="tnum">12 üye</b></span><span class="ch">Değişiklik e-postası gider.</span></li><li><span class="row-l"><span>Çakışma</span><b class="tnum">Yok</b></span><span class="ch">Salon A ve Elif Kara o saatte uygun.</span></li></ul><p class="note" role="note"><span>Uygula düğmesine bir kez bas. Tekrar gönderim aynı sonucu verir, işlem ikinci kez yapılmaz.</span></p>', onOk: function () { $$('dn-ok').disabled = true; dClose(); o.n = 'Seans taşıma: Salsa orta, 6 Kas 19:00'; o.run = 'seans'; startRun(o); toast('İşlem başladı'); } });
      if (a === 'renew') { o.st = 'preview'; o.left = 15 * 60; renderOps(); toast('Önizleme yenilendi, 15 dk geçerli'); }
      if (a === 'retry') { b.disabled = true; o.retry = false; o.run = 'retry'; if (o.st === 'partial') { o.done = o.done; } startRun(o); toast('Yeniden deneme başladı'); }
    });
    var tick = setInterval(function () {
      var v = document.querySelector('[data-view="denetim"]'), vis = v && !v.hidden && TAB === 'islem', ch = false;
      OPS.forEach(function (o) {
        if (o.st === 'running') { o.p = Math.min(100, o.p + 9 + (o.id.charCodeAt(5) % 5)); ch = true; if (o.p >= 100) { var wasRetry = o.run === 'retry', wasPartial = o.total && o.done < o.total; o.st = 'done'; if (o.total) o.done = o.total; o.note = wasPartial ? 'Kalan alıcılara gönderildi.' : o.run === 'seans' ? 'Seans taşındı, 12 üyeye bildirim gitti.' : o.id === 'OP-2038' ? '7 üye içe aktarıldı.' : 'Hazır, Raporlar > Dosyalar.'; auditAdd(o.run === 'seans' ? 'Seans' : o.total ? 'Otomasyon' : 'Sistem', 'İşlem tamamlandı', o.n, 'ok', o.note, o.id); } }
        if (o.st === 'preview') { o.left = Math.max(0, o.left - 1); if (o.left === 0) { o.st = 'expired'; o.note = 'Onay süresi doldu, işlem yapılmadı.'; ch = true; } }
      });
      if (vis && ch) renderOps(); else if (ch) side();
    }, 800);
    function tab(t) { TAB = t; $$('dn-tabs').querySelectorAll('[data-dt]').forEach(function (x) { x.setAttribute('aria-selected', String(x.getAttribute('data-dt') === t)); }); $$('dn-p-kayit').hidden = t !== 'kayit'; $$('dn-p-islem').hidden = t !== 'islem'; $$('dn-exp').hidden = t !== 'kayit'; if (t === 'kayit') { modOpts(); renderLog(); } else renderOps(); }
    $$('dn-tabs').addEventListener('click', function (e) { var b = e.target.closest('[data-dt]'); if (b) tab(b.getAttribute('data-dt')); });
    $$('dn-exp').addEventListener('click', function () { var id = 'OP-' + (2042 + OPS.length - 7); OPS.unshift({ id: id, n: 'Dışa aktarma: Denetim kaydı (' + (F.per ? 'son ' + F.per + ' gün' : 'tümü') + ')', st: 'running', p: 0, run: 'exp' }); auditAdd('Denetim', 'Dışa aktarma başlatıldı', 'Denetim kaydı', 'ok', 'Filtre: ' + (F.mod || 'tüm modüller'), id); tab('islem'); toast('Dışa aktarma başlatıldı'); });
    window.addEventListener('hashchange', function () { if ((location.hash || '').slice(1) === 'denetim') tab(TAB); });
    SHARED.opsAttn = attn; side(); tab('kayit');
  })();

  /* ---------- Ortak durumlar (yükleme, boş, hata, çakışma, limit, erişim) ---------- */
  (function () {
    var $$ = function (id) { return document.getElementById(id); };
    function st(o) { return '<div class="state' + (o.bad ? ' bad' : '') + '" role="' + (o.bad ? 'alert' : 'status') + '"><span class="st-i">' + ic(o.i) + '</span><' + (o.h || 'h2') + '>' + o.t + '</' + (o.h || 'h2') + '><p>' + o.p + '</p>' + (o.code ? '<code>' + o.code + '</code>' : '') + (o.a ? '<div class="st-a">' + o.a + '</div>' : '') + '</div>'; }
    window.__stateShow = function (kind, name) {
      document.querySelectorAll('section.view').forEach(function (v) { v.hidden = true; }); $$('sx-body').parentNode.hidden = false;
      var t = titles[name] || name, o;
      if (kind === '404') o = { i: 'search', t: 'Sayfa bulunamadı', p: '#' + name + ' adresinde bir sayfa yok. Bağlantı eski ya da yanlış olabilir.', a: '<a class="btn" href="#genel-bakis">Genel bakışa dön</a><a class="btn outline" href="#yardim">Yardım</a>' };
      else o = { i: 'lock', t: 'Bu sayfaya erişimin yok', p: 'Eğitmen rolünde <b>' + t + '</b> sayfası yok. Erişim gerekiyorsa stüdyo yöneticisine yaz.', a: '<a class="btn" href="#egt-bugun">Bugünkü derslerime dön</a><a class="btn outline" href="#yardim">Yardım</a>' };
      $$('sx-body').innerHTML = '<div class="card">' + st(o) + '</div>'; swap($$('sx-body'));
      document.getElementById('crumb').textContent = kind === '404' ? 'Sayfa bulunamadı' : 'Erişim yok'; document.querySelectorAll('[data-route]').forEach(function (a) { a.removeAttribute('aria-current'); });
    };
    var sk = '<div style="padding:20px;display:grid;gap:12px"><div class="sk" style="width:40%"></div><div class="sk"></div><div class="sk" style="width:85%"></div><div class="sk" style="width:60%"></div></div>';
    var CAT = [
      ['Yükleniyor', 'Liste ya da kart verisi gelirken. Boş görünüm yerine iskelet; 400 ms altında gösterilmez.', sk, '<button type="button" class="btn outline sm" data-sd="load">Yeniden yükle</button>'],
      ['Boş: henüz kayıt yok', 'İlk kullanım. Ne olduğunu söyler, tek birincil eylem sunar.', st({ i: 'users', h: 'h3', t: 'Henüz üye yok', p: 'İlk üyeni davet et ya da üye listeni CSV ile içe aktar.', a: '<a class="btn sm" href="#uyeler">Üye davet et</a>' }), ''],
      ['Boş: filtre sonucu yok', 'Filtre ya da arama hiçbir şey bulmadığında. Kayıt olmadığını değil, filtrenin dar olduğunu söyler.', st({ i: 'search', h: 'h3', t: 'Bu filtreye uyan kayıt yok', p: 'Filtreleri değiştir ya da temizle.', a: '<button type="button" class="btn outline sm" data-sd="clr">Filtreleri temizle</button>' }), ''],
      ['Hata: sunucu', 'İşlem başarısız ya da veri yüklenemedi. Ne olduğunu, tekrar denenebilir mi ve işlem kimliğini söyler.', st({ i: 'x', h: 'h3', bad: true, t: 'Liste yüklenemedi', p: 'Sunucuya ulaşılamadı. Girdiğin hiçbir şey kaybolmadı.', code: 'İşlem kimliği OP-7F3A-21', a: '<button type="button" class="btn outline sm" data-sd="retry">Tekrar dene</button>' }), ''],
      ['Çevrimdışı', 'Bağlantı kesilince üst çubukta çıkar. Kaydet düğmeleri kapanmaz, hata verirse yukarıdaki durum anlatır.', st({ i: 'zap', h: 'h3', t: 'Bağlantı yok', p: 'Bağlantı gelince değişiklikler tekrar denenebilir. Gerçek kesintide bu çubuk kendiliğinden açılır.', a: '<button type="button" class="btn outline sm" data-sd="off">Çubuğu göster</button>' }), ''],
      ['Sürüm çakışması (409)', 'Başkası aynı kaydı kaydetmişse. Sessizce üzerine yazılmaz; iki değer yan yana gösterilir.', st({ i: 'merge', h: 'h3', t: 'Kayıt başka biri tarafından değiştirildi', p: 'Kaydederken sürüm uyuşmadı. Seçimini sen yaparsın.', a: '<button type="button" class="btn outline sm" data-sd="conf">Çakışmayı aç</button>' }), ''],
      ['Plan limiti', 'Plan sınırına ulaşınca eylem kapanır, nedeni ve çıkış yolu yazılır.', st({ i: 'package', h: 'h3', t: 'Aktif üye limiti doldu', p: 'Stüdyo planında 100 aktif üye var, şu an 100 / 100. Üyeleri pasifleştir ya da planı yükselt.', a: '<a class="btn sm" href="#ayarlar" data-sd="plan">Planı yükselt</a><a class="btn outline sm" href="#uyeler">Üyelere git</a>' }), ''],
      ['Yetkisiz erişim (403)', 'Rolün sayfayı görmeye yetmiyorsa. Eğitmen rolünde bir yönetim sayfasına gidilince bu çıkar.', st({ i: 'lock', h: 'h3', t: 'Bu sayfaya erişimin yok', p: 'Eğitmen rolünde Finans sayfası yok.', a: '<button type="button" class="btn outline sm" data-sd="403">Eğitmen olarak dene</button>' }), ''],
      ['Kapalı erişim', 'Abonelik sona erince ya da hesap askıdayken. Panel salt okunur, veriler saklanır.', st({ i: 'ban', h: 'h3', t: 'Panel salt okunur', p: 'Aboneliğin sona erdi. Görüntüleyebilir ve dışa aktarabilirsin, değişiklik yapamazsın.', a: '<button type="button" class="btn outline sm" data-sd="ro">Üst çubuğu göster</button>' }), ''],
      ['Sayfa bulunamadı (404)', 'Adres yanlış ya da kayıt silinmişse.', st({ i: 'search', h: 'h3', t: 'Sayfa bulunamadı', p: 'Bağlantı eski ya da yanlış olabilir.', a: '<button type="button" class="btn outline sm" data-sd="404">Gerçek ekranı aç</button>' }), ''],
      ['Onay süresi doldu', 'Önizleme geçerlilik süresini aşınca. Onay verilemez, önizleme yenilenir.', st({ i: 'clock', h: 'h3', t: 'Onay süresi doldu', p: 'Önizleme 15 dk geçerliydi. Kayıtlar değişmiş olabilir, önizlemeyi yenileyip tekrar onayla.', a: '<a class="btn outline sm" href="#denetim">İşlemlere git</a>' }), ''],
      ['Tekrar gönderim: tek sonuç', 'Aynı işlem iki kez gönderilince ikinci kez yapılmaz, ilk sonuç gösterilir.', st({ i: 'check', h: 'h3', t: 'Bu işlem zaten alındı', p: 'Tahsilat 14:21 saatinde kaydedildi. İkinci bir kayıt oluşturulmadı.', a: '<button type="button" class="btn sm" data-sd="dup">Çift gönderim dene</button>' }), '']
    ];
    var holders = {};
    function renderCat() { $$('st-cat').innerHTML = CAT.map(function (c, i) { return '<div class="card"><div class="card-h"><h2>' + c[0] + '</h2><p>' + c[1] + '</p></div><div class="card-c" id="sc' + i + '">' + c[2] + (c[3] ? '<div style="padding:0 20px 16px">' + c[3] + '</div>' : '') + '</div></div>'; }).join(''); swap($$('st-cat')); }
    renderCat();
    var dupAt = 0, dupN = 0;
    function dlgOpen() { $$('st-dlg').hidden = $$('st-scrim').hidden = false; $$('st-load').focus(); }
    function dlgClose() { $$('st-dlg').hidden = $$('st-scrim').hidden = true; }
    $$('st-scrim').addEventListener('click', dlgClose); $$('st-load').addEventListener('click', function () { dlgClose(); toast('Son sürüm yüklendi, farkı gözden geçir'); }); $$('st-over').addEventListener('click', function () { dlgClose(); toast('Değişikliğin kaydedildi, öncekinin üzerine yazıldı'); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$$('st-dlg').hidden) dlgClose(); });
    $$('st-cat').addEventListener('click', function (e) {
      var b = e.target.closest('[data-sd]'); if (!b) return; var k = b.getAttribute('data-sd'), card = b.closest('.card-c'), orig = card.innerHTML;
      if (k === 'load') { card.innerHTML = sk; setTimeout(function () { card.innerHTML = '<div style="padding:20px"><b style="font-weight:500">Yüklendi</b><p class="muted" style="margin:4px 0 0">3 satır geldi.</p></div>'; setTimeout(function () { card.innerHTML = sk + '<div style="padding:0 20px 16px"><button type="button" class="btn outline sm" data-sd="load">Yeniden yükle</button></div>'; }, 1400); }, 1300); }
      if (k === 'clr') toast('Filtreler temizlendi');
      if (k === 'retry') { card.innerHTML = sk; setTimeout(function () { card.innerHTML = '<div style="padding:20px"><b style="font-weight:500">Liste yüklendi</b><p class="muted" style="margin:4px 0 0">İkinci denemede başarılı oldu.</p></div>'; setTimeout(function () { card.innerHTML = orig; swap(card); }, 1600); }, 1000); }
      if (k === 'off') { $$('off-bar').hidden = false; setTimeout(function () { $$('off-bar').hidden = true; }, 3500); }
      if (k === 'conf') dlgOpen();
      if (k === 'plan') toast('Planı yükselt: Ayarlar > Plan');
      if (k === '403') { SHARED.roleTo('egt'); location.hash = '#finans'; }
      if (k === 'ro') { $$('ro-bar').hidden = false; }
      if (k === '404') location.hash = '#bu-sayfa-yok';
      if (k === 'dup') { var now = Date.now(); dupN++; if (now - dupAt < 2000) { toast('Bu işlem zaten alındı, ikinci kayıt oluşturulmadı'); } else { toast('Tahsilat kaydedildi'); } dupAt = now; }
    });
    $$('ro-off').addEventListener('click', function () { $$('ro-bar').hidden = true; });
    window.addEventListener('offline', function () { $$('off-bar').hidden = false; }); window.addEventListener('online', function () { $$('off-bar').hidden = true; toast('Bağlantı geri geldi'); });
  })();

  /* ---------- Ara ve git (Ctrl K) ---------- */
  (function () {
    var $$ = function (id) { return document.getElementById(id); };
    function fold(t) { return String(t).toLocaleLowerCase('tr').replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u'); }
    var ASET = [['genel', 'Genel'], ['rezervasyon', 'Rezervasyon'], ['politika', 'Politikalar'], ['salonlar', 'Salonlar'], ['bildirim', 'Bildirimler'], ['sablon', 'Şablonlar'], ['yayin', 'Yayın'], ['ekip', 'Ekip'], ['plan', 'Plan ve abonelik'], ['gecmis', 'Değişiklik geçmişi']];
    var EGT = ['egt-bugun', 'egt-program', 'egt-hakedis', 'hesap', 'yardim'];
    function items() {
      var egt = document.body.classList.contains('role-egt'), out = [];
      groups.forEach(function (g) { g.items.forEach(function (i) { out.push({ g: 'Sayfalar', t: i[1], k: i[0], run: function () { location.hash = '#' + i[0]; } }); }); });
      [['hesap', 'Hesabım'], ['yardim', 'Yardım'], ['durumlar', 'Durum ekranları'], ['uye-birlestir', 'Kişileri birleştir'], ['uye-hesaplar', 'Davetler ve hesaplar']].forEach(function (x) { out.push({ g: 'Sayfalar', t: x[1], k: x[0], run: function () { location.hash = '#' + x[0]; } }); });
      if (egt) return [{ g: 'Sayfalar', t: 'Bugün', run: function () { location.hash = '#egt-bugun'; } }, { g: 'Sayfalar', t: 'Programım', run: function () { location.hash = '#egt-program'; } }, { g: 'Sayfalar', t: 'Hakedişim', run: function () { location.hash = '#egt-hakedis'; } }, { g: 'Sayfalar', t: 'Hesabım', run: function () { location.hash = '#hesap'; } }, { g: 'Sayfalar', t: 'Yardım', run: function () { location.hash = '#yardim'; } }];
      ASET.forEach(function (a) { out.push({ g: 'Ayarlar', t: a[1], sub: 'Ayarlar', run: function () { location.hash = '#ayarlar'; setTimeout(function () { var b = document.querySelector('[data-stab="' + a[0] + '"]'); if (b) b.click(); }, 0); } }); });
      SHARED.stu().forEach(function (m) { out.push({ g: 'Üyeler', t: m.n, sub: m.mail || '', extra: m.mail || '', run: function () { SHARED.selectMember(m.id); location.hash = '#uye'; } }); });
      out.push({ g: 'Eylemler', t: 'Üye davet et', run: function () { location.hash = '#uyeler'; setTimeout(function () { $$('st-add').click(); }, 0); } });
      out.push({ g: 'Eylemler', t: 'Üyeleri içe aktar', run: function () { location.hash = '#uyeler'; setTimeout(function () { $$('st-imp').click(); }, 0); } });
      out.push({ g: 'Eylemler', t: 'Raporu dışa aktar', run: function () { location.hash = '#raporlar'; setTimeout(function () { $$('rp-exp').click(); }, 0); } });
      out.push({ g: 'Eylemler', t: 'Temayı değiştir', run: function () { var b = $$('theme-btn'); if (b) b.click(); else toast('Tema: Hesabım > Görünüm'); } });
      out.push({ g: 'Eylemler', t: 'Çıkış yap', run: function () { $$('ac-out').click(); } });
      return out;
    }
    var list = [], idx = 0, op = null;
    function match(q) {
      var f = fold(q.trim()), all = items(), r;
      if (!f) return all.filter(function (x) { return x.g === 'Sayfalar'; }).slice(0, 8);
      r = all.map(function (x) { var t = fold(x.t + ' ' + (x.extra || '')), i = t.indexOf(f); return { x: x, s: i < 0 ? -1 : (i === 0 ? 0 : (t.charAt(i - 1) === ' ' ? 1 : 2)) }; }).filter(function (y) { return y.s >= 0; });
      r.sort(function (a, b) { return a.s - b.s; });
      var cnt = {}; return r.map(function (y) { return y.x; }).filter(function (x) { cnt[x.g] = (cnt[x.g] || 0) + 1; return cnt[x.g] <= 6; });
    }
    function draw() {
      list = match($$('cp-q').value); idx = Math.min(idx, Math.max(0, list.length - 1)); var g = '', h = '';
      list.forEach(function (x, i) { if (x.g !== g) { g = x.g; h += '<div class="cp-g" role="presentation">' + g + '</div>'; } h += '<button type="button" class="cp-i" role="option" id="cp-o' + i + '" data-i="' + i + '" aria-selected="' + (i === idx) + '">' + x.t + (x.sub ? '<small>' + x.sub + '</small>' : '') + '</button>'; });
      $$('cp-list').innerHTML = h || '<div class="state" style="padding:24px"><p>Sonuç bulunamadı. Başka bir sözcük dene.</p></div>'; $$('cp-n').textContent = list.length ? list.length + ' sonuç' : 'Sonuç yok';
      $$('cp-q').setAttribute('aria-activedescendant', list.length ? 'cp-o' + idx : ''); var el = $$('cp-o' + idx); if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
    }
    function open() { if (['role-uye', 'role-pub', 'role-auth'].some(function (c) { return document.body.classList.contains(c); })) return; op = document.activeElement; $$('cp-scrim').hidden = $$('cp').hidden = false; $$('cp-q').value = ''; idx = 0; draw(); swap($$('cp')); $$('cp-q').focus(); }
    function close() { $$('cp-scrim').hidden = $$('cp').hidden = true; if (op && op.focus && document.contains(op)) op.focus(); }
    function go(i) { var x = list[i]; if (!x) return; close(); x.run(); }
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); if ($$('cp').hidden) open(); else close(); return; }
      if ($$('cp').hidden) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); idx = Math.min(list.length - 1, idx + 1); draw(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); idx = Math.max(0, idx - 1); draw(); }
      else if (e.key === 'Enter') { e.preventDefault(); go(idx); }
      else if (e.key === 'Tab') { e.preventDefault(); $$('cp-q').focus(); }
    });
    $$('cp-q').addEventListener('input', function () { idx = 0; draw(); });
    $$('cp-list').addEventListener('click', function (e) { var b = e.target.closest('[data-i]'); if (b) go(+b.getAttribute('data-i')); });
    $$('cp-list').addEventListener('mousemove', function (e) { var b = e.target.closest('[data-i]'); if (b && +b.getAttribute('data-i') !== idx) { idx = +b.getAttribute('data-i'); $$('cp-list').querySelectorAll('.cp-i').forEach(function (x) { x.setAttribute('aria-selected', String(+x.getAttribute('data-i') === idx)); }); } });
    $$('cp-scrim').addEventListener('click', close);
    document.addEventListener('click', function (e) { if (e.target.closest('#topbar .search')) open(); });
  })();

  /* ---------- Yardım (yanıtlar önizlemedeki kurallarla tutarlı) ---------- */
  (function () {
    var $$ = function (id) { return document.getElementById(id); };
    var G = [
      ['Üyeler ve haklar', [
        ['Yeni üyeyi nasıl eklerim?', '<a href="#uyeler">Üyeler</a> sayfasında "Üye davet et" düğmesine bas ve e-posta adresini yaz. Davet e-postayla gider. Üye adını, telefonunu ve diğer bilgilerini kendisi tamamlar.'],
        ['Üyenin adını, e-postasını ya da telefonunu değiştirebilir miyim?', 'Hayır. Bu bilgileri yalnızca üyenin kendisi değiştirir. Yönetim ekranında bilgi amaçlı gösterilir.'],
        ['Üyeye paket ya da hak nasıl tahsis ederim?', 'Üyenin profilinde "Paket / hak tahsis et" düğmesini kullan. Paketi seç, başlangıç tarihini yaz ve ödemeyi şimdi tahsil et ya da borç olarak kaydet. Paketleri <a href="#paketler">Paketler</a> sayfasından yönetirsin.'],
        ['Üyenin paketini nasıl yenilerim ya da süresini uzatırım?', 'Profilde Haklar sekmesinde "Paketi yenile" ile yeni paketi mevcut hakkın bitiminden ya da bugünden başlat. "Süreyi uzat" yalnızca bitiş tarihini ileri alır, ders sayısını değiştirmez ve gerekçe ister. İkisinde de uygulamadan önce etkiyi aynı çekmecede görürsün.'],
        ['Satış neden tamamlanmıyor?', 'Satış için gerekli bir belgeyi üye henüz kabul etmediyse satış tamamlanamaz. Çekmecedeki etki listesi hangi belgenin beklediğini gösterir. Kabulü yalnızca üyenin kendisi verir, durumu <a href="#belgeler">Belgeler</a> sayfasında izlersin.'],
        ['Negatif limit nedir?', 'Hakkı biten üyenin, belirlediğin limit kadar ders daha rezerve edebilmesidir. Profilde Haklar sekmesindeki Negatif limit kartından limiti ve ders değerini gerekçeyle ayarlarsın. Limit 0 ise kapalıdır.'],
        ['Bir üyenin hakkını nasıl düzeltirim?', 'Profilde Haklar sekmesinde "Hakkı düzelt" düğmesine bas. Hak ekle ya da çıkar, ders sayısını yaz ve gerekçeni gir. Gerekçe zorunludur ve düzeltme hak geçmişine kayıt olarak düşer.'],
        ['Üyeyi neden pasifleştiremiyorum?', 'Açık rezervasyonu olan üye pasifleştirilemez. Önce rezervasyonları iptal et. Pasifleştirirken gerekçe yazman gerekir, geçmiş kayıtlar korunur.']
      ]],
      ['Ders programı', [
        ['Seansı başka bir güne ya da saate nasıl taşırım?', '<a href="#program">Ders programı</a> sayfasında seansı sürükle. Saatler 15 dakikalık adımlarla değişir, alt kenardan tutup süreyi uzatabilir ya da kısaltabilirsin. Değişiklikler taslak kalır, alttaki çubuktan tek seferde kaydedilir.'],
        ['Kaydet düğmesi neden kapalı?', 'Aynı salonda çakışan bir seans varsa çakışma bitene kadar kaydedilemez. Çakışan seanslar kırmızı görünür. Geçmiş seanslar da taşınamaz.'],
        ['Kaydederken üyelere bildirim gider mi?', 'Kaydetmeden önce özet açılır. "Üyelere bildirim gönder" seçeneği orada, etkilenecek üye sayısıyla birlikte görünür.'],
        ['Seansın kontenjanını nasıl değiştiririm?', 'Seans detayında "Seansı düzenle" çekmecesini aç. Kontenjan oda sınırını aşamaz. Mevcut rezervasyonlar iptal edilmez. Önce etkilenen seansların önizlemesini görür, sonra uygularsın. Oda sınırlarını <a href="#ayarlar">Ayarlar</a> sayfasındaki Salonlar bölümünde ayarlarsın.']
      ]],
      ['Rezervasyon ve yoklama', [
        ['Üye iptal edince hakkı iade edilir mi?', 'Ücretsiz iptal süresi içinde evet. Bu süre ve geç iptalde hakkın düşüp düşmeyeceği Ayarlar sayfasında, Rezervasyon bölümünde belirlenir.'],
        ['Üyeyi bir seansa kendim nasıl eklerim?', 'Seans detayında "Katılımcı ekle" düğmesini kullan. Hakkı, borcu ve belge kabulü uygun olmayan üyeler nedeniyle birlikte görünür ve seçilemez. Kontenjan dolmuşsa yalnızca yönetici, açık onay ve gerekçeyle kontenjanı aşarak ekleyebilir.'],
        ['Özel ders talebini nasıl onaylarım?', '<a href="#talepler">Talepler</a> sayfasında talebi aç, uygunluk satırlarını kontrol et ve onayla, reddet ya da alternatif öner. Eğitmen, borç ya da belge engeli varsa onaylayamazsın. Reddederken gerekçe zorunludur. Talep onaylanana kadar kesin rezervasyon değildir.'],
        ['Yoklamayı nasıl alırım?', 'Seans detayında yoklamayı başlat, üyeleri Geldi ya da Gelmedi olarak işaretle ve yoklamayı kapat. Kapanan yoklamayı yalnızca yönetici düzeltebilir: "Yoklamayı düzenle" düğmesine bas, işaretleri değiştir ve gerekçeni yaz. Önceki kayıt geçmişte kalır.']
      ]],
      ['Tahsilat ve borç', [
        ['Eğitmen hakedişi nasıl hesaplanır?', 'Yoklaması kapanan her seans için eğitmenin anlaşmasına göre bir hakediş satırı oluşur: seans başı, saatlik ya da katılımcı başı. Satırları ve ödemeleri <a href="#hakedis">Hakediş</a> sayfasında görürsün. Anlaşmayı Stüdyo sayfasındaki Anlaşmalar sekmesinde yeni sürümle değiştirirsin, yalnızca yürürlük tarihinden sonraki seanslar etkilenir.'],
        ['Eğitmene yaptığım ödemeyi nasıl düzeltirim?', 'Hakediş sayfasında Ödemeler sekmesinden ödemenin yanındaki Düzelt düğmesini kullan. Fark ve gerekçe yazılır, özgün kayıt değişmez, düzeltme ayrı satır olarak eklenir. Üyeden aldığın tahsilat eğitmen ödemesi sayılmaz.'],
        ['Tahsilatı nasıl kaydederim?', '<a href="#finans">Finans</a> sayfasında "Tahsilat al" düğmesini kullan ya da üyenin profilinden başla. Açık borcu olan üyede tutar kutuya otomatik gelir. Yöntem olarak nakit, kart ya da havale seçersin.'],
        ['Satışı nasıl iade ederim?', '<a href="#finans">Finans</a> sayfasında satış satırındaki "İade" düğmesini kullan. İade tutarı kullanılmayan hakka göre hesaplanır, çekmecede borç, alacak, kapanan hak ve iptal olacak rezervasyon etkisini uygulamadan önce görürsün. İade önce açık borçtan düşer, kalan tutar alacak olur.'],
        ['Alacak nedir, nasıl kapatırım?', 'Alacak, üyeye geri ödenecek ya da borcuna mahsup edilecek tutardır. Finans sayfasındaki Alacaklar sekmesinde "Nakit iade" ile ödeme yaparsın, "Borca mahsup" ile nakit hareketi olmadan açık borçtan düşersin.'],
        ['Yanlış girilen tahsilatı silebilir miyim?', 'Silemezsin, iptal edebilirsin. Finans sayfasında tahsilat satırındaki "İptal et" düğmesini kullan ve gerekçe yaz. Kayıt "İptal edildi" olarak kalır ve tutar üyenin borcuna geri eklenir.']
      ]],
      ['Belgeler', [
        ['Yeni bir belge ya da sürüm nasıl yayınlarım?', '<a href="#belgeler">Belgeler</a> sayfasında "Belge yükle" düğmesine bas, PDF ya da düz metin dosyasını seç ve belgenin hangi işlemden önce kabul edileceğini işaretle. Yayınlamadan önce "Etkiyi göster" ile kaç üyenin kabul etmesi gerektiğini ve korunan rezervasyonları görürsün. Bilgiler değişirse etkiyi yeniden göstermen gerekir.'],
        ['Yeni sürümde üyeler yeniden kabul etmek zorunda mı?', 'Sen seçersin. "Tüm üyelerden yeniden kabul iste" dersen eski sürümü kabul etmiş olmak yetmez. Mevcut rezervasyonlar iptal edilmez, üye bir sonraki işleminde yeni sürümü kabul eder.'],
        ['Belgeyi üye adına kabul edebilir miyim?', 'Hayır. Kabulü yalnızca üyenin kendisi verir. Kabul durumunu Belgeler sayfasındaki Kabul durumu sekmesinden izlersin.']
      ]],
      ['Hesap', [
        ['Koyu temaya nasıl geçerim?', 'Üst çubuktaki tema düğmesini kullan ya da <a href="#hesap">Hesabım</a> sayfasında Görünüm kartından Sistem, Açık ya da Koyu seç. Seçim bu cihazda geçerlidir.'],
        ['Tanımadığım bir oturum görüyorum, ne yapmalıyım?', 'Hesabım sayfasında Oturumlar sekmesine git ve o oturumu kapat. Gerekirse parolanı değiştir.']
      ]]
    ];
    function plain(h) { return h.replace(/<[^>]+>/g, ''); }
    function render() {
      var q = $$('hp-search').value.trim().toLocaleLowerCase('tr'), n = 0;
      $$('hp-groups').innerHTML = G.map(function (g) {
        var items = g[1].filter(function (x) { return !q || (x[0] + ' ' + plain(x[1])).toLocaleLowerCase('tr').indexOf(q) > -1; });
        n += items.length;
        if (!items.length) return '';
        return '<div class="card"><div class="card-h" style="padding-bottom:8px"><h2>' + g[0] + '</h2></div><div class="faq">' + items.map(function (x) {
          return '<details' + (q ? ' open' : '') + '><summary>' + x[0] + '</summary><div class="ans"><p>' + x[1] + '</p></div></details>';
        }).join('') + '</div></div>';
      }).join('');
      $$('hp-empty').hidden = n > 0;
    }
    $$('hp-search').addEventListener('input', render);
    $$('hp-copy').addEventListener('click', function () {
      var t = $$('hp-mail').textContent;
      function sel() { var r = document.createRange(); r.selectNodeContents($$('hp-mail')); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); toast('Adresi seçtim, kopyalamak için Ctrl C'); }
      try { navigator.clipboard.writeText(t).then(function () { toast('Adres kopyalandı'); }, sel); } catch (e) { sel(); }
    });
    render(); swap(document.querySelector('[data-view="yardim"]'));
  })();

  /* ---------- Stüdyo (kurgusal veri; eğitmenler Genel bakış, salonlar Ders programı ile tutarlı) ---------- */
  (function () {
    var $$ = function (id) { return document.getElementById(id); };
    var view = document.querySelector('[data-view="studyo"]');
    var TYPES = [
      { n: 'Salsa başlangıç', salon: 'Salon A', w: 3 }, { n: 'Salsa orta', salon: 'Salon A', w: 2 },
      { n: 'Bachata başlangıç', salon: 'Salon B', w: 2 }, { n: 'Bachata orta', salon: 'Salon B', w: 2 },
      { n: 'Arjantin tango teknik', salon: 'Salon A', w: 2 }, { n: 'Pilates mat', salon: 'Salon B', w: 2 },
      { n: 'Özel ders', salon: 'Stüdyo C', w: 3 }
    ];
    var IN = [
      { id: 1, n: 'Elif Kara', mail: 'elif.kara@ornek.test', on: true, pending: false, d: ['Salsa başlangıç', 'Arjantin tango teknik'] },
      { id: 2, n: 'Mert Aydın', mail: 'mert.aydin@ornek.test', on: true, pending: false, d: ['Bachata başlangıç', 'Salsa başlangıç'] },
      { id: 3, n: 'Kaan Sezer', mail: 'kaan.sezer@ornek.test', on: true, pending: false, d: ['Salsa orta', 'Bachata orta', 'Bachata başlangıç'] },
      { id: 4, n: 'Ceren Bulut', mail: 'ceren.bulut@ornek.test', on: true, pending: false, d: ['Pilates mat'] },
      { id: 5, n: 'Deniz Yıldırım', mail: 'deniz.yildirim@ornek.test', on: true, pending: false, d: ['Özel ders'] },
      { id: 6, n: 'Selma Ercan', mail: 'selma.ercan@ornek.test', on: false, pending: false, d: ['Salsa orta'] }
    ];
    var fil = 'all', cur = null, base = '', nextId = 7;
    SHARED.sd = { TYPES: TYPES, IN: IN, wk: wk, teachers: teachers, render: function () { render(); } };
    SHARED.sdRefresh = function () { if (SHARED.sdSync) SHARED.sdSync(); };
    function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
    function ini(n) { var p = n.trim().split(/\s+/); return ((p[0] || '')[0] + ((p[1] || '')[0] || '')).toLocaleUpperCase('tr'); }
    function sh(e) { var p = e.n.split(' '); return p[0] + ' ' + p[1][0] + '.'; }
    function wk(e) { return SHARED.calAll ? SHARED.calAll().filter(function (o) { return !o.x && SHARED.coachOf(o.s) === sh(e); }).length : 0; }
    function teachers(t) { return IN.filter(function (e) { return e.on && e.d.indexOf(t.n) > -1; }).map(function (e) { return e.n.split(' ')[0] + ' ' + e.n.split(' ')[1][0] + '.'; }).join(', ') || '-'; }
    function render() {
      var rows = IN.filter(function (e) { return fil === 'all' || (fil === 'on') === e.on; });
      $$('sd-body').innerHTML = rows.map(function (e) {
        return '<tr tabindex="0" data-id="' + e.id + '" class="' + (e.on ? '' : 'off') + '"><td><span class="who"><span class="avatar sm">' + ini(e.n) + '</span><span class="nm"><span>' + esc(e.n) + '</span><small>' + esc(e.mail) + '</small></span></span></td>' +
          '<td>' + e.d.map(function (d) { return '<span class="badge soft" style="margin:0 4px 4px 0">' + d + '</span>'; }).join('') + '</td><td class="r tnum">' + (e.pending || !e.on ? '<span class="muted">-</span>' : wk(e)) + '</td>' +
          '<td>' + (e.pending ? '<span class="badge">Davet bekliyor</span>' : e.on ? '<span class="badge">Aktif</span>' : '<span class="badge soft">Pasif</span>') + '</td></tr>';
      }).join('') || '<tr><td colspan="4" class="muted" style="padding:32px 0;text-align:center">Bu süzgece uygun eğitmen yok.</td></tr>';
      $$('sd-count').textContent = rows.length + ' eğitmen gösteriliyor, ' + IN.filter(function (e) { return e.on; }).length + ' aktif';
      if (SHARED.sdCls) SHARED.sdCls(); if (SHARED.sdSetup) SHARED.sdSetup();
    }

    /* Çekmece: ekle ya da düzenle */
    var sheet = $$('sd-sheet'), scrim = $$('sd-scrim'), opener = null;
    function picked() { return Array.prototype.slice.call($$('sd-dersler').querySelectorAll('input:checked')).map(function (i) { return i.value; }); }
    function sig() { return [$$('sd-ad').value.trim(), $$('sd-posta').value.trim(), picked().join('|'), $$('sd-on').checked].join('~'); }
    function problem() {
      var e = cur;
      if (!picked().length) return 'En az bir ders seç.';
      if (e) {
        if (!$$('sd-ad').value.trim()) return 'Ad soyad boş olamaz.';
        if (!$$('sd-on').checked && e.on && wk(e) > 0) return e.n.split(' ')[0] + ' için haftada ' + wk(e) + ' seans planlı. Pasifleştirmeden önce seansları başka eğitmene ver.';
      } else if (!/^\S+@\S+\.\S+$/.test($$('sd-posta').value.trim())) return '';
      return null;
    }
    function sync() {
      var p = problem(), er = $$('sd-err');
      var show = p && (cur || sig() !== base); er.hidden = !show; er.querySelector('span').textContent = show ? p : '';
      $$('sd-save').disabled = p !== null || (cur && sig() === base);
    }
    function open(e) {
      opener = document.activeElement; cur = e || null;
      $$('sd-title').textContent = e ? e.n : 'Eğitmen ekle';
      $$('sd-sub').textContent = e ? (e.pending ? 'Davet gönderildi, eğitmen kabul edince aktif olur.' : 'Haftada ' + wk(e) + ' seansı var.') : 'Davet e-postayla gider. Eğitmen adını ve diğer bilgilerini kendisi tamamlar.';
      $$('sd-f-ad').hidden = !e; $$('sd-f-on').hidden = !e || e.pending;
      $$('sd-ad').value = e ? e.n : ''; $$('sd-posta').value = e ? e.mail : ''; $$('sd-posta').readOnly = !!e;
      $$('sd-posta-h').textContent = e ? 'Yalnızca eğitmenin kendisi değiştirir' : '';
      $$('sd-dersler').innerHTML = '<legend class="label">Verdiği dersler</legend>' + TYPES.filter(function (t) { return t.on !== false; }).map(function (t, i) {
        return '<label class="opt"><input type="checkbox" value="' + t.n + '"' + (e && e.d.indexOf(t.n) > -1 ? ' checked' : '') + '><span><b>' + t.n + '</b><small>' + t.salon + '</small></span></label>';
      }).join('');
      $$('sd-on').checked = e ? e.on : true; $$('sd-save').textContent = e ? 'Değişiklikleri kaydet' : 'Daveti gönder';
      base = sig(); sync(); sheet.hidden = false; scrim.hidden = false; (e ? $$('sd-ad') : $$('sd-posta')).focus();
    }
    function close() { sheet.hidden = true; scrim.hidden = true; if (opener) opener.focus(); }
    $$('sd-add').addEventListener('click', function () { open(null); });
    $$('sd-x').addEventListener('click', close); $$('sd-cancel').addEventListener('click', close); scrim.addEventListener('click', close);
    $$('sd-form').addEventListener('input', sync); $$('sd-form').addEventListener('change', sync); $$('sd-form').addEventListener('submit', function (e) { e.preventDefault(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !sheet.hidden) close(); });
    $$('sd-save').addEventListener('click', function () {
      if ($$('sd-save').disabled) return;
      if (cur) { cur.n = $$('sd-ad').value.trim(); cur.d = picked(); cur.on = $$('sd-on').checked; close(); render(); toast('Eğitmen güncellendi'); }
      else {
        var m = $$('sd-posta').value.trim(), nm = m.split('@')[0].split('.').map(function (s) { return s.charAt(0).toLocaleUpperCase('tr') + s.slice(1); }).join(' ');
        IN.push({ id: nextId++, n: nm, mail: m, on: false, pending: true, d: picked() }); close(); render(); toast('Davet gönderildi, ' + m);
      }
    });
    $$('sd-body').addEventListener('click', function (e) { var tr = e.target.closest('tr[data-id]'); if (tr) open(IN.filter(function (x) { return x.id === +tr.getAttribute('data-id'); })[0]); });
    $$('sd-body').addEventListener('keydown', function (e) { var tr = e.target.closest('tr[data-id]'); if (!tr || (e.key !== 'Enter' && e.key !== ' ')) return; e.preventDefault(); open(IN.filter(function (x) { return x.id === +tr.getAttribute('data-id'); })[0]); });
    $$('sd-filter').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-f]'); if (!b) return; fil = b.getAttribute('data-f');
      $$('sd-filter').querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); render();
    });
    render(); swap($$('sd-sheet')); swap(view);
  })();

  /* ---------- Stüdyo 2: kurulum, dersler ve salonlar, uygunluk, kapanışlar (kurgusal veri) ---------- */
  (function () {
    var $$ = function (id) { return document.getElementById(id); };
    var view = document.querySelector('[data-view="studyo"]');
    var SD = SHARED.sd, TYPES = SD.TYPES, IN = SD.IN, S = SHARED.cal;
    var DAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'], MON = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
    var TODAY = '2026-11-04', PLAN_MAX = 5;
    function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
    function pd(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
    function iso(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
    function wd(d) { return (d.getDay() + 6) % 7; }
    function fd(s) { var d = pd(s); return DAYS[wd(d)] + ' ' + d.getDate() + ' ' + MON[d.getMonth()]; }
    function hm(m) { return ('0' + Math.floor(m / 60)).slice(-2) + ':' + ('0' + (m % 60)).slice(-2); }
    function tm(s) { var p = s.split(':'); return +p[0] * 60 + +p[1]; }
    function first(n) { var p = n.split(' '); return p[0] + ' ' + p[1][0] + '.'; }

    /* Veri: ders türü ve salon alanları bu modülde tamamlanır */
    var META = { 'Salsa başlangıç': [60, 14, ['Salon A']], 'Salsa orta': [60, 12, ['Salon A', 'Salon B']], 'Bachata başlangıç': [60, 12, ['Salon B', 'Salon A']], 'Bachata orta': [60, 12, ['Salon B']], 'Arjantin tango teknik': [60, 12, ['Salon A']], 'Pilates mat': [60, 10, ['Salon B']], 'Özel ders': [45, 1, ['Stüdyo C']] };
    TYPES.forEach(function (t) { var m = META[t.n]; t.len = m[0]; t.cap = m[1]; t.allow = m[2].slice(); t.on = true; });
    var ROOMS = [{ n: 'Salon A', cap: 16, kind: 'Grup dersi', on: true }, { n: 'Salon B', cap: 12, kind: 'Grup dersi', on: true }, { n: 'Stüdyo C', cap: 2, kind: 'Özel ders', on: true }];
    var AV = {};
    function mk(a) { return DAYS.map(function (d, i) { return a[i] || null; }); }
    AV[1] = mk([['14:00', '21:00'], null, ['14:00', '21:00'], ['17:00', '21:00']]);
    AV[2] = mk([['17:00', '21:00'], null, ['17:00', '21:00'], ['17:00', '21:00'], null, ['10:00', '14:00']]);
    AV[3] = mk([null, ['17:00', '21:00'], null, null, ['17:00', '21:00']]);
    AV[5] = mk([['10:00', '18:00'], ['10:00', '18:00'], ['10:00', '18:00'], ['10:00', '18:00'], ['10:00', '18:00'], ['10:00', '18:00']]);
    var CL = [
      { id: 1, k: 'studio', who: '', from: '2026-10-29', to: '2026-10-29', why: 'Resmi tatil', pol: 'cancel', past: true, aff: 4 },
      { id: 2, k: 'studio', who: '', from: '2026-11-10', to: '2026-11-10', why: 'Resmi tatil', pol: 'cancel' },
      { id: 3, k: 'room', who: 'Salon B', from: '2026-11-17', to: '2026-11-18', why: 'Bakım ya da tadilat', pol: 'cancel' },
      { id: 4, k: 'coach', who: 'Elif Kara', from: '2026-11-23', to: '2026-11-27', why: 'Yıllık izin', pol: 'keep' }
    ], nextCl = 5;

    function typeOf(t) { return TYPES.filter(function (x) { return t.indexOf(x.n) === 0; })[0]; }
    function coachOf(ses) { var ty = typeOf(ses.t); return ty ? IN.filter(function (e) { return e.on && e.d.indexOf(ty.n) > -1; }) : []; }
    function roomUse(n) { return TYPES.filter(function (t) { return t.salon === n; }); }
    function roomWeekly(n) { return SHARED.calAll().filter(function (o) { return !o.x && o.s.r === n; }).length; }
    function syncW() { TYPES.forEach(function (t) { t.w = SHARED.calAll().filter(function (o) { return !o.x && o.s.t.indexOf(t.n) === 0; }).length; }); }
    function activeRooms() { return ROOMS.filter(function (r) { return r.on; }); }

    /* Kurulum listesi */
    var tabsEl = $$('sd-tabs');
    function tab(n) {
      tabsEl.querySelectorAll('[role=tab]').forEach(function (b) { b.setAttribute('aria-selected', String(b.getAttribute('data-sdtab') === n)); });
      view.querySelectorAll('[data-sdpanel]').forEach(function (p) { p.hidden = p.getAttribute('data-sdpanel') !== n; });
    }
    tabsEl.addEventListener('click', function (e) { var b = e.target.closest('[data-sdtab]'); if (b) tab(b.getAttribute('data-sdtab')); });
    var hidden = false;
    function setup() {
      var act = IN.filter(function (e) { return e.on; }), miss = act.filter(function (e) { return !AV[e.id]; });
      var st = [
        ['Stüdyo bilgileri', 'Ad, adres, saat dilimi', true, 'ayarlar', 'Ayarlar'],
        ['Salon', activeRooms().length + ' açık salon', activeRooms().length > 0, 'tab:cls', 'Ekle'],
        ['Ders türleri', TYPES.filter(function (t) { return t.on; }).length + ' açık tür', TYPES.some(function (t) { return t.on; }), 'tab:cls', 'Ekle'],
        ['Eğitmen ve uygunluk', miss.length ? first(miss[0].n) + (miss.length > 1 ? ' ve ' + (miss.length - 1) + ' kişi' : '') + ' için uygunluk eksik' : act.length + ' aktif eğitmen', act.length > 0 && !miss.length, 'tab:av', 'Tamamla'],
        ['Paket', 'Üyelere satılan paketler', true, 'paketler', 'Paketler'],
        ['Belge', 'Sözleşme ve onay metinleri', true, 'belgeler', 'Belgeler'],
        ['İlk seans ya da seri', 'Programda açık seans var', true, 'program', 'Program'],
        ['Üye daveti', 'Davet gönderildi', true, 'uye-hesaplar', 'Davetler']
      ];
      var n = st.filter(function (x) { return x[2]; }).length, all = n === st.length;
      $$('su-n').textContent = n + ' / ' + st.length; $$('su-bar').style.width = (n / st.length * 100) + '%';
      $$('su-t').textContent = all ? 'Kurulum tamam' : 'Kurulum'; $$('su-s').textContent = all ? 'Stüdyo üyelere açılmaya hazır.' : 'Üyeleri almadan önce eksikleri tamamla.';
      $$('su-hide').hidden = !all; $$('sd-setup').hidden = all && hidden;
      $$('su-list').innerHTML = st.map(function (x) {
        var a = x[3].indexOf('tab:') === 0 ? '<button type="button" class="btn outline sm" data-tab="' + x[3].slice(4) + '">' + x[4] + '</button>' : '<a class="btn ' + (x[2] ? 'ghost' : 'outline') + ' sm" href="#' + x[3] + '">' + x[4] + '</a>';
        return '<li class="' + (x[2] ? 'ok' : '') + '"><span class="ck">' + (x[2] ? '<i data-i="check"></i>' : '') + '</span><span class="tx"><b>' + x[0] + '</b><small>' + esc(x[1]) + '</small></span>' + (x[2] ? '' : a) + '</li>';
      }).join('');
      swap($$('su-list'));
    }
    $$('su-list').addEventListener('click', function (e) { var b = e.target.closest('[data-tab]'); if (b) tab(b.getAttribute('data-tab')); });
    $$('su-hide').addEventListener('click', function () { hidden = true; setup(); });

    /* Ders türleri ve salonlar */
    function types() {
      $$('sd-types').innerHTML = TYPES.map(function (t, i) {
        return '<tr tabindex="0" data-i="' + i + '" class="' + (t.on ? '' : 'off') + '"><td>' + esc(t.n) + '</td><td class="tnum">' + t.len + ' dk</td><td class="r tnum">' + t.cap + '</td><td class="muted">' + t.salon + '</td><td class="muted">' + esc(SD.teachers(t)) + '</td><td class="r tnum">' + (t.on ? t.w : '<span class="muted">-</span>') + '</td><td>' + (t.on ? '<span class="badge">Açık</span>' : '<span class="badge soft">Kapalı</span>') + '</td></tr>';
      }).join('');
    }
    function rooms() {
      var on = activeRooms().length;
      $$('rm-plan').textContent = ROOMS.length + ' / ' + PLAN_MAX + ' salon kullanılıyor (plan sınırı).';
      $$('rm-add').disabled = ROOMS.length >= PLAN_MAX; $$('rm-add').title = ROOMS.length >= PLAN_MAX ? 'Planın salon sınırına ulaştın' : '';
      $$('rm-body').innerHTML = ROOMS.map(function (r, i) {
        var u = roomUse(r.n).filter(function (t) { return t.on; }).map(function (t) { return t.n; });
        return '<tr tabindex="0" data-i="' + i + '" class="' + (r.on ? '' : 'off') + '"><td>' + esc(r.n) + '</td><td class="muted">' + r.kind + '</td><td class="r tnum">' + r.cap + '</td><td class="muted">' + (u.length ? esc(u.join(', ')) : '-') + '</td><td>' + (r.on ? '<span class="badge">Açık</span>' : '<span class="badge soft">Kapalı</span>') + '</td></tr>';
      }).join('');
    }
    var mxs = null, mxBase = '';
    function mxInit() { mxs = {}; TYPES.forEach(function (t) { mxs[t.n] = t.allow.slice(); }); mxBase = JSON.stringify(mxs); }
    function matrix() {
      var rs = activeRooms();
      $$('mx').innerHTML = '<thead><tr><th>Ders</th>' + rs.map(function (r) { return '<th>' + esc(r.n) + '<br><small class="muted tnum" style="font-weight:400">' + r.cap + ' kişi</small></th>'; }).join('') + '</tr></thead><tbody>' +
        TYPES.filter(function (t) { return t.on; }).map(function (t) {
          return '<tr><td>' + esc(t.n) + '<br><small class="muted tnum">' + t.cap + ' kişi</small></td>' + rs.map(function (r) {
            var chk = (mxs[t.n] || []).indexOf(r.n) > -1, fit = t.cap <= r.cap, lock = chk && t.salon === r.n && t.w > 0;
            var why = !fit ? 'Kontenjan sığmıyor' : lock ? 'Haftada ' + t.w + ' seans bu salonda' : '';
            return '<td><input type="checkbox" data-t="' + esc(t.n) + '" data-r="' + esc(r.n) + '" aria-label="' + esc(t.n + ', ' + r.n) + '"' + (chk ? ' checked' : '') + (!fit || lock ? ' disabled' : '') + (why ? ' title="' + why + '"' : '') + '></td>';
          }).join('') + '</tr>';
        }).join('') + '</tbody>';
      mxSync();
    }
    function mxSync() {
      var dirty = JSON.stringify(mxs) !== mxBase, bad = TYPES.filter(function (t) { return t.on && !(mxs[t.n] || []).length; })[0], s = $$('mx-s');
      s.textContent = bad ? bad.n + ' için en az bir salon seç' : dirty ? 'Kaydedilmemiş değişiklik var' : 'Değişiklik yok'; s.className = 'status' + (dirty ? ' dirty' : '');
      s.style.color = bad ? 'var(--destructive)' : ''; $$('mx-undo').disabled = !dirty; $$('mx-save').disabled = !dirty || !!bad;
    }
    $$('mx').addEventListener('change', function (e) {
      var c = e.target.closest('input'); if (!c) return; var a = mxs[c.getAttribute('data-t')], r = c.getAttribute('data-r'), i = a.indexOf(r);
      if (c.checked && i < 0) a.push(r); if (!c.checked && i > -1) a.splice(i, 1); mxSync();
    });
    $$('mx-undo').addEventListener('click', function () { mxInit(); matrix(); });
    $$('mx-save').addEventListener('click', function () { TYPES.forEach(function (t) { t.allow = mxs[t.n].slice(); }); mxInit(); matrix(); toast('Salon uyumu kaydedildi'); });

    /* Sağ çekmeceler: ortak açma/kapama */
    function drawer(p) {
      var sh = $$(p + '-sheet'), sc = $$(p + '-scrim'), op = null;
      function close() { sh.hidden = true; sc.hidden = true; if (op) op.focus(); }
      function open() { op = document.activeElement; sh.hidden = false; sc.hidden = false; }
      $$(p + '-x').addEventListener('click', close); $$(p + '-cancel').addEventListener('click', close); sc.addEventListener('click', close);
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !sh.hidden) close(); });
      swap(sh); return { open: open, close: close };
    }
    function rowKeys(tb, fn) {
      tb.addEventListener('click', function (e) { var tr = e.target.closest('tr[data-i]'); if (tr) fn(+tr.getAttribute('data-i')); });
      tb.addEventListener('keydown', function (e) { var tr = e.target.closest('tr[data-i]'); if (tr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); fn(+tr.getAttribute('data-i')); } });
    }
    function fail(id, msg, show) { var e = $$(id); e.hidden = !(msg && show); e.querySelector('span').textContent = msg || ''; }

    /* Ders türü çekmecesi */
    var ty = drawer('ty'), tcur = null, tbase = '';
    function tsig() { return [$$('ty-n').value.trim(), $$('ty-len').value, $$('ty-cap').value, $$('ty-room').value, $$('ty-on').checked].join('~'); }
    function tcheck() {
      var n = $$('ty-n').value.trim(), cap = +$$('ty-cap').value, r = ROOMS.filter(function (x) { return x.n === $$('ty-room').value; })[0], m = null;
      if (!n) m = 'Ders adı boş olamaz.';
      else if (TYPES.some(function (t) { return t !== tcur && t.n.toLocaleLowerCase('tr') === n.toLocaleLowerCase('tr'); })) m = 'Bu adda bir ders türü var.';
      else if (!(cap >= 1)) m = 'Kontenjan en az 1 olmalı.';
      else if (r && cap > r.cap) m = r.n + ' kontenjanı ' + r.cap + '. Bu ders için ' + cap + ' sığmaz.';
      else if (tcur && tcur.on && !$$('ty-on').checked && tcur.w > 0) m = 'Haftada ' + tcur.w + ' seans planlı. Kapatmadan önce seansları iptal et ya da başka türe taşı.';
      var ch = tsig() !== tbase; fail('ty-err', m, ch); $$('ty-save').disabled = !!m || !ch; return m;
    }
    function tOpen(t) {
      tcur = t || null; $$('ty-title').textContent = t ? t.n : 'Ders türü ekle';
      $$('ty-sub').textContent = t ? (t.w ? 'Haftada ' + t.w + ' seans planlı.' : 'Planlı seans yok.') : 'Süre ve kontenjan yeni seanslara varsayılan olur.';
      $$('ty-n').value = t ? t.n : ''; $$('ty-len').value = t ? t.len : 60; $$('ty-cap').value = t ? t.cap : 10;
      $$('ty-room').innerHTML = activeRooms().map(function (r) { return '<option' + (t && t.salon === r.n ? ' selected' : '') + '>' + esc(r.n) + '</option>'; }).join('');
      $$('ty-room-h').textContent = 'Seans eklerken değiştirilebilir.'; $$('ty-on').checked = t ? t.on : true; $$('ty-on-w').hidden = !t;
      $$('ty-save').textContent = t ? 'Kaydet' : 'Ders türünü ekle'; tbase = tsig(); $$('ty-err').hidden = true; $$('ty-save').disabled = true; ty.open(); $$('ty-n').focus();
    }
    $$('ty-form').addEventListener('input', tcheck); $$('ty-form').addEventListener('change', tcheck); $$('ty-form').addEventListener('submit', function (e) { e.preventDefault(); });
    $$('ty-add').addEventListener('click', function () { tOpen(null); });
    rowKeys($$('sd-types'), function (i) { tOpen(TYPES[i]); });
    $$('ty-save').addEventListener('click', function () {
      if (tcheck() !== null) return; var v = { n: $$('ty-n').value.trim(), len: +$$('ty-len').value, cap: +$$('ty-cap').value, salon: $$('ty-room').value, on: $$('ty-on').checked };
      if (tcur) { Object.assign(tcur, v); if (tcur.allow.indexOf(v.salon) < 0) tcur.allow.push(v.salon); toast('Ders türü güncellendi'); }
      else { v.w = 0; v.allow = [v.salon]; TYPES.push(v); toast('Ders türü eklendi'); }
      ty.close(); refresh();
    });

    /* Salon çekmecesi */
    var rm = drawer('rm'), rcur = null, rbase = '';
    function rsig() { return [$$('rm-n').value.trim(), $$('rm-cap').value, $$('rm-kind').value, $$('rm-on').checked].join('~'); }
    function rcheck() {
      var n = $$('rm-n').value.trim(), cap = +$$('rm-cap').value, m = null;
      if (!n) m = 'Salon adı boş olamaz.';
      else if (ROOMS.some(function (r) { return r !== rcur && r.n.toLocaleLowerCase('tr') === n.toLocaleLowerCase('tr'); })) m = 'Bu adda bir salon var.';
      else if (!(cap >= 1)) m = 'Kontenjan en az 1 olmalı.';
      if (!m && rcur) {
        var big = TYPES.filter(function (t) { return t.on && t.allow.indexOf(rcur.n) > -1 && t.cap > cap; })[0];
        if (big) m = big.n + ' bu salonda ' + big.cap + ' kişiyle açılıyor. Kontenjan ' + big.cap + ' altına inemez.';
        else if (rcur.on && !$$('rm-on').checked && roomWeekly(rcur.n) > 0) m = rcur.n + ' salonunda haftada ' + roomWeekly(rcur.n) + ' seans var. Kapatmadan önce seansları başka salona taşı.';
      }
      var ch = rsig() !== rbase; fail('rm-err', m, ch); $$('rm-save').disabled = !!m || !ch; return m;
    }
    function rOpen(r) {
      rcur = r || null; $$('rm-title').textContent = r ? r.n : 'Salon ekle';
      $$('rm-sub').textContent = r ? (roomWeekly(r.n) ? 'Haftada ' + roomWeekly(r.n) + ' seans burada.' : 'Bu salonda planlı seans yok.') : ROOMS.length + ' / ' + PLAN_MAX + ' salon kullanılıyor.';
      $$('rm-n').value = r ? r.n : ''; $$('rm-cap').value = r ? r.cap : 10; $$('rm-kind').value = r ? r.kind : 'Grup dersi'; $$('rm-on').checked = r ? r.on : true; $$('rm-on-w').hidden = !r;
      $$('rm-save').textContent = r ? 'Kaydet' : 'Salonu ekle'; rbase = rsig(); $$('rm-err').hidden = true; $$('rm-save').disabled = true; rm.open(); $$('rm-n').focus();
    }
    $$('rm-form').addEventListener('input', rcheck); $$('rm-form').addEventListener('change', rcheck); $$('rm-form').addEventListener('submit', function (e) { e.preventDefault(); });
    $$('rm-add').addEventListener('click', function () { if (ROOMS.length < PLAN_MAX) rOpen(null); });
    rowKeys($$('rm-body'), function (i) { rOpen(ROOMS[i]); });
    $$('rm-save').addEventListener('click', function () {
      if (rcheck() !== null) return; var v = { n: $$('rm-n').value.trim(), cap: +$$('rm-cap').value, kind: $$('rm-kind').value, on: $$('rm-on').checked };
      if (rcur) {
        var old = rcur.n; Object.assign(rcur, v);
        if (old !== v.n) TYPES.forEach(function (t) { if (t.salon === old) t.salon = v.n; t.allow = t.allow.map(function (a) { return a === old ? v.n : a; }); });
        toast('Salon güncellendi');
      } else { ROOMS.push(v); toast('Salon eklendi'); }
      rm.close(); refresh();
    });

    /* Eğitmen uygunluğu */
    var who = null, draft = null, abase = '';
    function avFill() {
      $$('av-who').innerHTML = IN.map(function (e) { return '<option value="' + e.id + '"' + (who === e.id ? ' selected' : '') + '>' + esc(e.n) + (e.on ? '' : ' (pasif)') + (e.on && !AV[e.id] ? ' - eksik' : '') + '</option>'; }).join('');
    }
    function avLoad(id) { who = id; var a = AV[id]; draft = a ? a.map(function (x) { return x ? x.slice() : null; }) : mk([]); abase = JSON.stringify(draft); avFill(); avRender(); }
    function avRender() {
      var e = IN.filter(function (x) { return x.id === who; })[0], off = !e.on;
      $$('av-off').hidden = !off; $$('av-copy').disabled = off;
      $$('av-days').innerHTML = DAYS.map(function (d, i) {
        var v = draft[i];
        return '<div class="av-r"><span>' + ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'][i] + '</span><input type="checkbox" class="switch" role="switch" data-d="' + i + '" aria-label="' + d + ' müsait"' + (v ? ' checked' : '') + (off ? ' disabled' : '') + '>' +
          (v ? '<span class="tm"><input class="input tnum" type="time" step="900" data-d="' + i + '" data-e="0" value="' + v[0] + '" aria-label="' + d + ' başlangıç"' + (off ? ' disabled' : '') + '><span class="muted">-</span><input class="input tnum" type="time" step="900" data-d="' + i + '" data-e="1" value="' + v[1] + '" aria-label="' + d + ' bitiş"' + (off ? ' disabled' : '') + '></span>' : '<span class="none">Müsait değil</span>') + '</div>';
      }).join('');
      avSync();
    }
    function avProblem() {
      for (var i = 0; i < 7; i++) { var v = draft[i]; if (v && (!v[0] || !v[1] || tm(v[1]) - tm(v[0]) < 30)) return DAYS[i] + ': bitiş başlangıçtan en az 30 dk sonra olmalı.'; }
      if (!draft.some(Boolean)) return 'En az bir gün müsait olmalı.'; return null;
    }
    function avSync() {
      var e = IN.filter(function (x) { return x.id === who; })[0], ch = JSON.stringify(draft) !== abase, p = e.on ? avProblem() : null, s = $$('av-s');
      s.textContent = ch ? (p || 'Kaydedilmemiş değişiklik var') : (!AV[who] && e.on ? 'Uygunluk henüz girilmedi' : 'Değişiklik yok'); s.className = 'status' + (ch && !p ? ' dirty' : ''); s.style.color = ch && p ? 'var(--destructive)' : '';
      $$('av-undo').disabled = !ch; $$('av-save').disabled = !ch || !!p || !e.on;
      var bad = [], tot = 0;
      S.forEach(function (x) {
        var ty = typeOf(x.t); if (!ty || e.d.indexOf(ty.n) < 0) return; tot++;
        var v = draft[x.d]; if (!v || x.s < tm(v[0]) || x.s + x.l > tm(v[1])) bad.push(x);
      });
      $$('av-eff').innerHTML = !e.on ? '<li><span class="ch">Pasif eğitmen seansa atanamaz.</span></li>' : bad.length ? bad.map(function (x) { return '<li><div class="row-l"><span>' + DAYS[x.d] + ' ' + hm(x.s) + ' · ' + esc(x.t) + '</span><span class="tnum muted">' + x.r + '</span></div><span class="ch">Uygunluk dışında kalıyor. Seans silinmez, programda uyarı görünür.</span></li>'; }).join('') : '<li><span class="ch">' + (tot ? tot + ' planlı seansın hepsi uygunluk içinde.' : 'Bu eğitmenin planlı seansı yok.') + '</span></li>';
    }
    $$('av-who').addEventListener('change', function () {
      var id = +$$('av-who').value; if (JSON.stringify(draft) !== abase) { avFill(); toast('Önce kaydet ya da geri al'); return; } avLoad(id);
    });
    $$('av-days').addEventListener('change', function (e) {
      var t = e.target, i = +t.getAttribute('data-d'); if (t.type === 'checkbox') draft[i] = t.checked ? ['10:00', '18:00'] : null; else draft[i][+t.getAttribute('data-e')] = t.value;
      if (t.type === 'checkbox') avRender(); else avSync();
    });
    $$('av-days').addEventListener('input', function (e) { var t = e.target; if (t.type === 'time') { draft[+t.getAttribute('data-d')][+t.getAttribute('data-e')] = t.value; avSync(); } });
    $$('av-copy').addEventListener('click', function () { var m = draft[0]; if (!m) { toast('Önce pazartesiyi aç'); return; } for (var i = 1; i < 5; i++) draft[i] = m.slice(); avRender(); });
    $$('av-undo').addEventListener('click', function () { avLoad(who); });
    $$('av-save').addEventListener('click', function () { if ($$('av-save').disabled) return; AV[who] = draft.map(function (x) { return x ? x.slice() : null; }); avLoad(who); refresh(); toast('Uygunluk kaydedildi'); });

    /* Kapanışlar */
    function affected(c) {
      var out = [], a = pd(c.from), b = pd(c.to), t0 = pd(TODAY);
      for (var d = new Date(a); d <= b; d.setDate(d.getDate() + 1)) {
        if (d < t0) continue;
        S.forEach(function (x) {
          if (x.d !== wd(d) || x.x) return; var ok = c.k === 'studio' || (c.k === 'room' && x.r === c.who);
          if (c.k === 'coach') { var ty = typeOf(x.t), e = IN.filter(function (z) { return z.n === c.who; })[0]; ok = !!(ty && e && e.d.indexOf(ty.n) > -1); }
          if (ok) out.push({ x: x, date: iso(d), d: new Date(d) });
        });
      }
      return out.sort(function (p, q) { return p.date < q.date ? -1 : p.date > q.date ? 1 : p.x.s - q.x.s; });
    }
    function cancelList(list) { list.forEach(function (z) { var m = new Date(z.d); m.setDate(m.getDate() - wd(m)); m.setHours(0, 0, 0, 0); z.x.xs = z.x.xs || {}; z.x.xs[m.getTime()] = 1; }); }
    function scopeTxt(c) { return c.k === 'studio' ? 'Tüm stüdyo' : c.k === 'room' ? c.who : c.who + ' izni'; }
    function period(c) { return c.from === c.to ? fd(c.from) : fd(c.from) + ' - ' + fd(c.to); }
    function state(c) { return c.to < TODAY ? 'Geçti' : c.from <= TODAY ? 'Sürüyor' : 'Yaklaşan'; }
    function cls() {
      var sorted = CL.slice().sort(function (a, b) { return a.from < b.from ? 1 : -1; }).reverse();
      $$('cl-body').innerHTML = sorted.map(function (c) {
        var n = c.past ? c.aff : affected(c).length, st = state(c);
        return '<tr tabindex="0" data-i="' + c.id + '" class="' + (st === 'Geçti' ? 'off' : '') + '"><td class="tnum">' + period(c) + '</td><td>' + esc(scopeTxt(c)) + '</td><td class="muted">' + esc(c.why) + '</td><td class="r tnum">' + (n || '<span class="muted">-</span>') + '</td><td><span class="badge' + (st === 'Geçti' ? ' soft' : '') + '">' + st + '</span></td></tr>';
      }).join('');
      $$('cl-count').textContent = CL.filter(function (c) { return state(c) !== 'Geçti'; }).length + ' güncel kapanış, ' + CL.filter(function (c) { return state(c) === 'Geçti'; }).length + ' geçmiş';
    }
    var cd = drawer('cl'), ck = 'studio', cview = null, confirmDel = false;
    function cdraft() { return { k: ck, who: ck === 'studio' ? '' : $$('cl-who').value, from: $$('cl-from').value, to: $$('cl-to').value, why: $$('cl-why').value, pol: (document.querySelector('input[name=cl-p]:checked') || {}).value || 'cancel' }; }
    function ccheck() {
      var c = cdraft(), m = null;
      if (!c.from || !c.to) m = 'Başlangıç ve bitiş tarihini seç.';
      else if (c.to < c.from) m = 'Bitiş başlangıçtan önce olamaz.';
      else if (CL.some(function (o) { return !o.past && o.k === c.k && o.who === c.who && o.from <= c.to && c.from <= o.to; })) m = 'Bu kapsamda bu tarihlerde zaten bir kapanış var.';
      else if (!c.why) m = 'Neden seç.';
      var list = (c.from && c.to && c.to >= c.from) ? affected(c) : [], rez = list.reduce(function (a, z) { return a + z.x.h; }, 0);
      $$('cl-pol').hidden = !list.length;
      $$('cl-eff').innerHTML = (c.from && c.to && c.to >= c.from) ? (list.length ? '<li><div class="row-l"><span>' + list.length + ' seans etkilenir</span><span class="tnum muted">' + rez + ' rezervasyon</span></div><span class="ch">' + (c.pol === 'cancel' ? 'Seanslar iptal edilir, haklar iade edilir.' : 'Seanslar programda kalır, kapanış uyarısı gösterir.') + '</span></li>' + list.slice(0, 5).map(function (z) { return '<li><div class="row-l"><span>' + fd(z.date) + ' ' + hm(z.x.s) + ' · ' + esc(z.x.t) + '</span><span class="tnum muted">' + z.x.h + ' kişi</span></div></li>'; }).join('') + (list.length > 5 ? '<li><span class="ch tnum">ve ' + (list.length - 5) + ' seans daha</span></li>' : '') : '<li><span class="ch">Bu aralıkta etkilenen seans yok.</span></li>') + (c.k === 'coach' ? '<li><span class="ch">' + esc(c.who) + ' bu aralıkta seansa atanamaz.</span></li>' : c.k === 'room' ? '<li><span class="ch">' + esc(c.who) + ' bu aralıkta yeni seansa seçilemez.</span></li>' : '<li><span class="ch">Bu aralıkta yeni seans eklenemez.</span></li>') : '<li><span class="ch">Tarih seçince etki burada görünür.</span></li>';
      $$('cl-nd').textContent = list.length ? rez + ' üyeye e-posta gider' : 'Etkilenen üye yok'; $$('cl-notify').disabled = !list.length;
      var touched = c.from || c.to || c.why; fail('cl-err', m, !!touched && !!(c.from && c.to)); $$('cl-save').disabled = !!m; return { m: m, c: c, list: list };
    }
    function ckind(k) {
      ck = k; $$('cl-kind').querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-k') === k)); });
      $$('cl-who-w').hidden = k === 'studio';
      if (k === 'room') { $$('cl-who-l').textContent = 'Salon'; $$('cl-who').innerHTML = activeRooms().map(function (r) { return '<option>' + esc(r.n) + '</option>'; }).join(''); }
      if (k === 'coach') { $$('cl-who-l').textContent = 'Eğitmen'; $$('cl-who').innerHTML = IN.filter(function (e) { return e.on; }).map(function (e) { return '<option>' + esc(e.n) + '</option>'; }).join(''); }
      ccheck();
    }
    function cOpen(c) {
      cview = c || null; confirmDel = false; var det = !!c; $$('cl-new').hidden = det; $$('cl-det').hidden = !det; $$('cl-err').hidden = true;
      $$('cl-title').textContent = det ? scopeTxt(c) : 'Kapanış ekle'; $$('cl-sub').textContent = det ? period(c) : 'Seanslar bu aralıkta açılamaz.';
      var foot = $$('cl-foot');
      if (det) {
        var list = c.past ? [] : affected(c);
        $$('cl-facts').innerHTML = [['Kapsam', scopeTxt(c)], ['Dönem', period(c)], ['Neden', c.why], ['Seanslar', c.pol === 'cancel' ? 'İptal edildi' : 'Programda bırakıldı'], ['Durum', state(c)]].map(function (r) { return '<li><div class="row-l"><span>' + r[0] + '</span><span class="muted">' + esc(r[1]) + '</span></div></li>'; }).join('');
        $$('cl-aff').innerHTML = c.past ? '<li><span class="ch tnum">' + c.aff + ' seans bu kapanışta iptal edildi.</span></li>' : list.length ? list.map(function (z) { return '<li><div class="row-l"><span>' + fd(z.date) + ' ' + hm(z.x.s) + ' · ' + esc(z.x.t) + '</span><span class="tnum muted">' + z.x.h + ' kişi</span></div></li>'; }).join('') : '<li><span class="ch">Etkilenen seans yok.</span></li>';
        $$('cl-dnote').textContent = c.past ? 'Geçmiş kapanış değiştirilemez.' : 'Kapanışı kaldırınca tarih yeniden açılır. İptal edilen seanslar geri gelmez, gerekirse yeniden eklenir.';
        foot.innerHTML = '<button type="button" class="btn outline" id="cl-cancel">Kapat</button>' + (c.past ? '' : '<button type="button" class="btn danger" id="cl-del">Kapanışı kaldır</button>');
      } else {
        foot.innerHTML = '<button type="button" class="btn outline" id="cl-cancel">Vazgeç</button><button type="button" class="btn" id="cl-save" disabled>Kapanışı kaydet</button>';
        $$('cl-from').value = $$('cl-to').value = '2026-11-12'; $$('cl-why').value = ''; $$('cl-notify').checked = true; document.querySelector('input[name=cl-p][value=cancel]').checked = true; ckind('studio'); $$('cl-err').hidden = true;
      }
      $$('cl-cancel') && 0; cd.open();
    }
    $$('cl-foot').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.id === 'cl-cancel') cd.close();
      else if (b.id === 'cl-del') { if (!confirmDel) { confirmDel = true; b.textContent = 'Evet, kaldır'; fail('cl-err', 'Bu kapanış kaldırılacak. Emin misin?', true); } else { CL.splice(CL.indexOf(cview), 1); cd.close(); cls(); refresh(); toast('Kapanış kaldırıldı'); } }
      else if (b.id === 'cl-save') {
        var r = ccheck(); if (r.m) return; var c = r.c; c.id = nextCl++;
        if (c.pol === 'cancel') cancelList(r.list);
        CL.push(c); cd.close(); cls(); toast('Kapanış eklendi' + (r.list.length && $$('cl-notify').checked ? ', üyelere bildirim gitti' : ''));
      }
    });
    $$('cl-kind').addEventListener('click', function (e) { var b = e.target.closest('button[data-k]'); if (b) ckind(b.getAttribute('data-k')); });
    $$('cl-form').addEventListener('input', function () { if (!cview) ccheck(); }); $$('cl-form').addEventListener('change', function () { if (!cview) ccheck(); }); $$('cl-form').addEventListener('submit', function (e) { e.preventDefault(); });
    $$('cl-add').addEventListener('click', function () { cOpen(null); });
    rowKeys($$('cl-body'), function (id) { cOpen(CL.filter(function (c) { return c.id === id; })[0]); });

    SHARED.coachFull = function (sh) { var e = IN.filter(function (x) { return first(x.n) === sh; })[0]; return e ? e.n : sh; };
    SHARED.sdTeaches = function (nm, t) { var ty = typeOf(t.replace(/ · Telafi$/, '')), e = IN.filter(function (x) { return x.n === nm; })[0]; return !ty || !e || e.d.indexOf(ty.n) > -1; };
    SHARED.sdWin = function (nm, d) { var e = IN.filter(function (x) { return x.n === nm; })[0]; if (!e || !AV[e.id]) return undefined; var v = AV[e.id][d]; return v ? [tm(v[0]), tm(v[1])] : null; };
    SHARED.sdLeave = function (nm, iso) { var c = CL.filter(function (x) { return !x.past && x.k === 'coach' && x.who === nm && x.from <= iso && iso <= x.to; })[0]; return c ? c.why : ''; };
    SHARED.sdIssue = function (nm, iso, st, l, room) {
      var lv = SHARED.sdLeave(nm, iso); if (lv) return nm.split(' ')[0] + ' izinli (' + lv + ').';
      var w = SHARED.sdWin(nm, wd(pd(iso)));
      if (w === null) return nm.split(' ')[0] + ' bu gün uygun değil.';
      if (w && (st < w[0] || st + l > w[1])) return nm.split(' ')[0] + ' uygunluğu ' + hm(w[0]) + ' - ' + hm(w[1]) + '.';
      var cl = CL.filter(function (x) { return !x.past && x.pol === 'keep' && (x.k === 'studio' || (x.k === 'room' && x.who === room)) && x.from <= iso && iso <= x.to; })[0];
      return cl ? (cl.k === 'studio' ? 'Stüdyo' : room) + ' kapalı (' + cl.why + ').' : '';
    };
    function refresh() { syncW(); SD.render(); types(); rooms(); mxInit(); matrix(); avFill(); setup(); cls(); if (who) avSync(); if (SHARED.calCoaches) SHARED.calCoaches(); }
    SHARED.sdSync = refresh;
    window.addEventListener('hashchange', function () { if (location.hash === '#studyo') refresh(); });
    SHARED.sdCls = function () { types(); rooms(); }; SHARED.sdSetup = setup;
    CL.forEach(function (c) { if (!c.past && c.pol === 'cancel') cancelList(affected(c)); });
    syncW(); if (SHARED.calCoaches) SHARED.calCoaches();
    mxInit(); matrix(); types(); rooms(); cls(); avLoad(IN.filter(function (e) { return e.on && !AV[e.id]; })[0].id); setup(); swap(view);
  })();

  /* ---------- Etkinlikler: atölye ve paketli Pratik (kurgusal veri; kapasite ders modelinden ayrı) ---------- */
  (function () {
    var $$ = function (id) { return document.getElementById(id); };
    var vL = document.querySelector('[data-view="etkinlikler"]'), vD = document.querySelector('[data-view="etkinlik"]');
    var DAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'], MON = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
    var TODAY = '2026-11-04', ROOMS = { 'Salon A': 16, 'Salon B': 12 }, PRODS = ['Aylık sınırsız', '12 derslik paket', '8 derslik paket'];
    function money(n) { return '₺' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
    function pd(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
    function fd(s) { var d = pd(s); return d.getDate() + ' ' + MON[d.getMonth()]; }
    function wdi(s) { return (pd(s).getDay() + 6) % 7; }
    function fdw(s) { return DAYS[wdi(s)] + ' ' + fd(s); }
    function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
    function tm(t) { var p = t.split(':'); return +p[0] * 60 + +p[1]; }
    var MEM = {
      'Cem Demir': { a: 'CD', pk: 'Aylık sınırsız', doc: true }, 'Selin Aksoy': { a: 'SA', pk: '8 derslik paket', doc: true }, 'Burak Kaya': { a: 'BK', pk: '12 derslik paket', doc: true },
      'Merve Tan': { a: 'MT', pk: 'Aylık sınırsız', doc: true }, 'Onur Çelik': { a: 'OÇ', pk: '8 derslik paket', doc: true }, 'Derya Sönmez': { a: 'DS', pk: '12 derslik paket', doc: true },
      'Ece Mutlu': { a: 'EM', pk: 'Aylık sınırsız', doc: true }, 'Kerem Zorlu': { a: 'KZ', pk: '8 derslik paket', doc: true, bad: 'Açık borç ₺450. Tahsilat al ya da negatif limit tanımla.' },
      'Nehir Gür': { a: 'NG', pk: '12 derslik paket', doc: true }, 'Tolga Yıldız': { a: 'TY', pk: '8 derslik paket', doc: true }, 'Aylin Polat': { a: 'AP', pk: '8 derslik paket', doc: true, bad: 'Üye pasif.' },
      'Seda Kurt': { a: 'SK', pk: '12 derslik paket', doc: false }, 'Baran Yücel': { a: 'BY', pk: '12 derslik paket', doc: true }, 'Yiğit Arslan': { a: 'YA', pk: 'Aylık sınırsız', doc: true }
    };
    function R(n, pay, amt, extra) { var r = { n: n, st: 'ok', pay: pay, amt: amt || 0, warn: '', m: '' }; for (var k in extra) r[k] = extra[k]; return r; }
    var E = [
      { id: 1, t: 'Çarşamba Salsa Pratiği', type: 'pratik', st: 'pub', d: '2026-11-04', s: '20:00', e: '22:00', loc: 'in', room: 'Salon B', cap: 12, fee: 0, prods: ['Aylık sınırsız', '12 derslik paket'], duty: ['Mert A.'], doc: '',
        reg: [R('Cem Demir', 'free'), R('Merve Tan', 'free'), R('Ece Mutlu', 'free'), R('Burak Kaya', 'free'), R('Derya Sönmez', 'free'), R('Nehir Gür', 'free', 0, { warn: 'Uygunluk kaybı: 12 derslik paket 4 Kas\'tan itibaren donduruldu. Yoklamada yeniden kontrol edilir.' })],
        att: { on: false, act: '', why: '', marks: {}, closed: false, fix: false }, dv: { 'Mert A.': 'wait' } },
      { id: 2, t: 'Tango Milonga Atölyesi', type: 'atolye', st: 'pub', d: '2026-11-21', s: '14:00', e: '17:00', loc: 'in', room: 'Salon A', cap: 16, fee: 450, prods: [], duty: ['Elif K.'], doc: 'Atölye katılım şartları',
        reg: [R('Selin Aksoy', 'paid', 450, { m: 'Havale' }), R('Onur Çelik', 'paid', 450, { m: 'Nakit' }), R('Derya Sönmez', 'due', 450), R('Tolga Yıldız', 'paid', 450, { m: 'Havale' }), R('Nehir Gür', 'due', 450), R('Cem Demir', 'paid', 450, { m: 'Havale' }), R('Merve Tan', 'paid', 450, { m: 'Havale' }), R('Burak Kaya', 'paid', 450, { m: 'Nakit' }), R('Ece Mutlu', 'paid', 450, { m: 'Havale' })],
        att: { on: false, act: '', why: '', marks: {}, closed: false, fix: false }, dv: { 'Elif K.': 'wait' } },
      { id: 3, t: 'Açık Hava Dans Pikniği', type: 'atolye', st: 'draft', d: '2026-11-29', s: '12:00', e: '16:00', loc: 'out', room: '', cap: null, fee: 150, prods: [], duty: ['Kaan S.'], doc: '', reg: [],
        att: { on: false, act: '', why: '', marks: {}, closed: false, fix: false }, dv: { 'Kaan S.': 'wait' } },
      { id: 4, t: 'Cadılar Bayramı Pratik Gecesi', type: 'pratik', st: 'done', d: '2026-10-31', s: '21:00', e: '23:00', loc: 'in', room: 'Salon A', cap: 16, fee: 0, prods: ['Aylık sınırsız', '12 derslik paket'], duty: ['Elif K.'], doc: '',
        reg: [R('Cem Demir', 'free', 0, { mk: 'attended' }), R('Merve Tan', 'free', 0, { mk: 'attended' }), R('Ece Mutlu', 'free', 0, { mk: 'no_show' }), R('Burak Kaya', 'free', 0, { mk: 'attended' }), R('Derya Sönmez', 'free', 0, { mk: 'attended' })],
        att: { on: true, act: '21:10', why: 'Müzik sistemi geç kuruldu', marks: {}, closed: true, fix: false }, dv: { 'Elif K.': 'ok' } },
      { id: 5, t: 'Kış Salsa Kampı', type: 'atolye', st: 'cancel', d: '2026-12-12', s: '10:00', e: '18:00', loc: 'in', room: 'Salon A', cap: 14, fee: 900, prods: [], duty: ['Elif K.'], doc: 'Atölye katılım şartları', why: 'Eğitmen müsait değil',
        reg: [R('Selin Aksoy', 'paid', 900, { st: 'cancel' }), R('Derya Sönmez', 'paid', 900, { st: 'cancel' }), R('Tolga Yıldız', 'due', 900, { st: 'cancel' })],
        att: { on: false, act: '', why: '', marks: {}, closed: false, fix: false }, dv: { 'Elif K.': 'wait' } }
    ];
    E[3].reg.forEach(function (r) { E[3].att.marks[r.n] = r.mk; });
    var cur = 1, eid = 6, flt = 'all', tab = 'kat';
    var ST = { draft: ['soft', 'Taslak'], pub: ['', 'Yayında'], done: ['ok', 'Tamamlandı'], cancel: ['bad', 'İptal edildi'] };
    function ev(id) { return E.filter(function (x) { return x.id === id; })[0]; }
    function act(e) { return e.reg.filter(function (r) { return r.st === 'ok'; }); }
    function due(e) { return act(e).filter(function (r) { return r.pay === 'due'; }); }
    function sum(list, f) { return list.reduce(function (a, r) { return a + f(r); }, 0); }
    function capT(e) { return e.cap == null ? 'Sınırsız' : e.cap; }
    function feeT(e) { return e.type === 'pratik' ? 'Ücretsiz' : money(e.fee); }
    function where(e) { return e.loc === 'out' ? 'Dış mekan' : e.room; }

    /* Liste */
    function kpi(l, v, s) { return '<div class="kpi card"><span class="l">' + l + '</span><b class="tnum">' + v + '</b><span class="sub">' + s + '</span></div>'; }
    function renderL() {
      var pub = E.filter(function (e) { return e.st === 'pub'; }), dr = E.filter(function (e) { return e.st === 'draft'; });
      var regs = sum(pub, function (e) { return act(e).length; }), dueN = sum(pub, function (e) { return due(e).length; }), dueT = sum(pub, function (e) { return sum(due(e), function (r) { return r.amt; }); });
      $$('ev-kpi').innerHTML = kpi('Yayında', pub.length, 'Kayıt alıyor') + kpi('Taslak', dr.length, 'Henüz yayınlanmadı') + kpi('Kayıtlı üye', regs, 'Yayındaki etkinliklerde') + kpi('Bekleyen ödeme', money(dueT), dueN + ' kayıt');
      var q = $$('ev-q').value.trim().toLocaleLowerCase('tr');
      var rows = E.filter(function (e) { return (flt === 'all' || e.st === flt) && e.t.toLocaleLowerCase('tr').indexOf(q) > -1; }).sort(function (a, b) { return a.d < b.d ? -1 : 1; });
      $$('ev-body').innerHTML = rows.map(function (e) {
        var n = act(e).length, b = ST[e.st];
        return '<tr tabindex="0" data-id="' + e.id + '"><td><span class="nm"><span>' + esc(e.t) + '</span><small>' + (e.type === 'pratik' ? 'Paketli Pratik' : 'Atölye') + '</small></span></td><td class="tnum">' + fdw(e.d) + '<span class="pk-sub-p">' + e.s + ' - ' + e.e + '</span></td><td>' + where(e) + '</td><td class="r tnum">' + n + ' / ' + capT(e) + '</td><td class="tnum">' + feeT(e) + '</td><td><span class="badge ' + b[0] + '">' + b[1] + '</span></td></tr>';
      }).join('') || '<tr><td colspan="6" class="muted" style="padding:32px 0;text-align:center">Aramana uygun etkinlik yok.</td></tr>';
      $$('ev-cnt').textContent = rows.length + ' etkinlik';
    }
    $$('ev-q').addEventListener('input', renderL);
    $$('ev-f').addEventListener('click', function (e) { var b = e.target.closest('button[data-f]'); if (!b) return; flt = b.getAttribute('data-f'); $$('ev-f').querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); renderL(); });
    function openE(id) { cur = id; tab = 'kat'; location.hash = '#etkinlik'; renderD(); }
    $$('ev-body').addEventListener('click', function (e) { var tr = e.target.closest('tr[data-id]'); if (tr) openE(+tr.getAttribute('data-id')); });
    $$('ev-body').addEventListener('keydown', function (e) { var tr = e.target.closest('tr[data-id]'); if (tr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openE(+tr.getAttribute('data-id')); } });

    /* Detay */
    function mkBadge(m) { return m === 'attended' ? '<span class="badge ok">Geldi</span>' : m === 'no_show' ? '<span class="badge bad">Gelmedi</span>' : '<span class="badge soft">' + 'Başlamadı' + '</span>'; }
    function attB(e, r) { var a = e.att, m = a.marks[r.n]; if (r.st !== 'ok') return '<span class="muted">-</span>'; if (!a.on) return '<span class="badge soft">Başlamadı</span>'; return m ? mkBadge(m) : '<span class="badge soft">İşaretlenmedi</span>'; }
    function payB(r) { return r.pay === 'free' ? '<span class="badge soft">Ücretsiz</span>' : r.pay === 'paid' ? '<span class="badge ok">Ödendi ' + money(r.amt) + '</span>' : '<span class="badge">Ödeme bekliyor ' + money(r.amt) + '</span>'; }
    function renderD() {
      var e = ev(cur), b = ST[e.st], n = act(e).length, a = e.att;
      $$('ed-t').textContent = e.t;
      $$('ed-b').innerHTML = '<span class="badge ' + b[0] + '">' + b[1] + '</span><span class="badge soft">' + (e.type === 'pratik' ? 'Paketli Pratik' : 'Atölye') + '</span>';
      var ac = '';
      if (e.st === 'draft') ac = '<button type="button" class="btn outline" id="ed-edit"><i data-i="pencil"></i>Düzenle</button><button type="button" class="btn" id="ed-pub">Yayınla</button>';
      else if (e.st === 'pub') ac = '<button type="button" class="btn danger" id="ed-cx"><i data-i="ban"></i>Etkinliği iptal et</button><button type="button" class="btn outline" id="ed-edit"><i data-i="pencil"></i>Düzenle</button><button type="button" class="btn" id="ed-done"' + (e.d > TODAY ? ' disabled title="Etkinlik günü gelince tamamlanır"' : '') + '>Etkinliği tamamla</button>';
      $$('ed-acts').innerHTML = ac;
      $$('ed-note').innerHTML = e.st === 'cancel' ? '<div class="card" style="margin-bottom:16px"><div class="card-c"><div class="ib-sent" style="border:0;padding:0"><i data-i="ban" style="color:var(--destructive)"></i><div><b style="font-weight:500">Etkinlik iptal edildi: ' + esc(e.why) + '</b><p class="muted" style="font-size:13px">Kayıtlar iptal oldu, ödenenler alacak olarak yazıldı. Etkinlik yeniden açılmaz.</p></div></div></div></div>' : e.st === 'draft' ? '<p class="note" style="margin-bottom:16px">Taslak. Üyeler yayınlanana kadar etkinliği göremez ve kayıt olamaz.</p>' : '';
      $$('ed-facts').innerHTML = [['Tarih', fdw(e.d) + ', ' + pd(e.d).getFullYear()], ['Saat', '<span class="tnum">' + e.s + ' - ' + e.e + '</span>'], ['Mekân', where(e)], ['Ücret', feeT(e) + (e.type === 'pratik' ? ', paketli' : '')]].map(function (f) { return '<div><span class="k">' + f[0] + '</span><b>' + f[1] + '</b></div>'; }).join('');
      $$('ed-n').textContent = n;
      $$('ed-ks').textContent = n + ' kayıtlı' + (e.reg.length - n ? ', ' + (e.reg.length - n) + ' iptal' : '');
      var can = e.st === 'pub', full = e.cap != null && n >= e.cap;
      $$('ed-radd').disabled = !can || full; $$('ed-radd').title = e.st === 'draft' ? 'Yayınlanınca kayıt alınır' : full ? 'Kontenjan dolu' : '';
      $$('ed-kb').innerHTML = e.reg.map(function (r) {
        var m = MEM[r.n] || { a: '?', pk: '-' }, off = r.st !== 'ok';
        return '<tr' + (off ? ' class="off"' : '') + '><td><span class="who"><span class="avatar sm">' + m.a + '</span><span class="nm"><span>' + r.n + '</span>' + (r.warn && !off ? '<small style="color:var(--destructive)">' + esc(r.warn) + '</small>' : '') + '</span></span></td><td class="muted">' + m.pk + '</td><td>' + (off ? '<span class="badge soft">İptal edildi</span>' : payB(r) + (r.m ? '<span class="pk-sub-p">' + r.m + '</span>' : '')) + '</td><td>' + attB(e, r) + '</td><td class="act">' + (!off && can ? '<button type="button" class="btn ghost sm" data-rc="' + esc(r.n) + '">Kaydı iptal et</button>' : '') + '</td></tr>';
      }).join('') || '<tr><td colspan="5" class="muted" style="padding:24px 0">' + (e.st === 'draft' ? 'Yayınlanınca kayıtlar burada görünür.' : 'Henüz kayıt yok.') + '</td></tr>';
      $$('ed-tabs').querySelectorAll('[role=tab]').forEach(function (t) { t.setAttribute('aria-selected', String(t.getAttribute('data-et') === tab)); });
      vD.querySelectorAll('[data-edp]').forEach(function (p) { p.hidden = p.getAttribute('data-edp') !== tab; });
      renderAside(e); renderA(e); swap(vD);
    }
    function renderAside(e) {
      var n = act(e).length, seats = '';
      if (e.cap != null) { seats = '<div class="seats" role="img" aria-label="' + e.cap + ' yerden ' + n + '\'i dolu">'; for (var k = 0; k < e.cap; k++) seats += '<i class="' + (k < n ? 'held' : 'free') + '"></i>'; seats += '</div><div class="legend"><span><i class="sw held"></i>Kayıtlı ' + n + '</span><span><i class="sw free"></i>Boş ' + Math.max(0, e.cap - n) + '</span></div>'; }
      var h = '<div class="card"><div class="card-h"><h2>Kontenjan</h2></div><div class="card-c"><p class="big tnum">' + n + '<span class="muted"> / ' + capT(e) + '</span></p><p class="muted" style="margin-bottom:12px">' + (e.cap == null ? 'Dış mekan, sınırsız kontenjan' : e.cap - n > 0 ? (e.cap - n) + ' yer boş' : 'Dolu') + '</p>' + seats + '<p class="hint" style="margin-top:12px">' + (e.loc === 'out' ? 'Dış mekanda oda sınırı yoktur.' : 'Etkinlik kontenjanı ' + e.room + ' oda sınırı (' + ROOMS[e.room] + ') ile sınırlıdır, ders kontenjanından ayrıdır.') + '</p></div></div>';
      h += '<div class="card"><div class="card-h"><h2>Görevliler</h2></div><div class="card-c" style="display:grid;gap:12px">' + e.duty.map(function (c) {
        var ok = e.dv[c] === 'ok', ready = e.att.closed && e.st === 'pub';
        return '<div style="display:flex;align-items:center;gap:12px"><span class="avatar sm">' + c.slice(0, 2).toUpperCase() + '</span><div style="flex:1;min-width:0"><b style="font-weight:500">' + esc(SHARED.coachFull ? SHARED.coachFull(c) : c) + '</b><p class="muted" style="font-size:13px">' + (ok ? 'Görev doğrulandı' : ready ? 'Doğrulama bekliyor' : 'Yoklama kapanınca doğrulanır') + '</p></div>' + (ok ? '<span class="badge ok">Doğrulandı</span>' : e.st === 'pub' ? '<button type="button" class="btn outline sm" data-dv="' + esc(c) + '"' + (ready ? '' : ' disabled') + '>Doğrula</button>' : '') + '</div>';
      }).join('') + '</div></div>';
      h += '<div class="card"><div class="card-h"><h2>Koşullar</h2></div><div class="card-c" style="display:grid;gap:8px">' + (e.type === 'pratik'
        ? '<p class="muted" style="font-size:13px">İzinli ürünler</p><div style="display:flex;gap:6px;flex-wrap:wrap">' + e.prods.map(function (p) { return '<span class="badge soft">' + p + '</span>'; }).join('') + '</div><p class="hint">Ücretsiz. Pratik ders hakkı tüketmez. Üyenin ürünü uygunluğunu kaybederse kayıt uyarı alır.</p>'
        : '<p class="muted" style="font-size:13px">Ücret</p><b class="tnum" style="font-weight:500">' + money(e.fee) + '</b><p class="muted" style="font-size:13px;margin-top:4px">Belge</p><b style="font-weight:500">' + (e.doc || 'Belge istenmez') + '</b>') + '</div></div>';
      $$('ed-aside').innerHTML = h;
    }
    $$('ed-tabs').addEventListener('click', function (x) { var b = x.target.closest('[data-et]'); if (b) { tab = b.getAttribute('data-et'); renderD(); } });
    window.addEventListener('hashchange', function () { if (location.hash === '#etkinlikler') renderL(); if (location.hash === '#etkinlik') renderD(); });

    /* Yoklama, fiilî başlangıç */
    function renderA(e) {
      var a = e.att, n = act(e), done = 0, miss = 0;
      $$('ed-plan').value = e.s;
      n.forEach(function (r) { var m = a.marks[r.n]; if (m === 'attended' || m === 'no_show') done++; else miss++; });
      var live = e.st === 'pub', today = e.d <= TODAY, locked = !live || a.closed && !a.fix;
      $$('ed-act').value = a._act != null ? a._act : (a.act || e.s); $$('ed-act').disabled = a.on && !a.fix || !live || !today; $$('ed-why').disabled = $$('ed-act').disabled; $$('ed-why').value = a._why != null ? a._why : a.why;
      var diff = $$('ed-act').value && $$('ed-act').value !== e.s;
      $$('ed-why-w').hidden = !(diff || a.why || a.fix);
      $$('ed-an').textContent = e.st === 'draft' ? 'Yayınlanınca yoklama açılır.' : e.st === 'cancel' ? 'Etkinlik iptal edildi.' : !today ? 'Yoklama etkinlik gününde (' + fd(e.d) + ') başlar.' : !a.on ? 'Fiilî başlangıcı yaz, sonra yoklamayı başlat.' : a.closed ? (a.fix ? 'Düzeltme açık, gerekçe zorunlu.' : 'Yoklama kapandı.') : 'Yoklama ' + a.act + '\'te başladı.';
      $$('ed-as').textContent = a.on ? 'Geldi ' + n.filter(function (r) { return a.marks[r.n] === 'attended'; }).length + ', gelmedi ' + n.filter(function (r) { return a.marks[r.n] === 'no_show'; }).length + ', işaretlenmemiş ' + miss : '';
      $$('ed-al').innerHTML = n.map(function (r) {
        var m = MEM[r.n] || { a: '?' }, s = a.marks[r.n], dis = !a.on || (a.closed && !a.fix) ? ' disabled' : '';
        return '<li><span class="who"><span class="avatar sm">' + m.a + '</span><span class="nm"><span>' + r.n + '</span>' + (r.warn ? '<small style="color:var(--destructive)">Uygunluk kaybı uyarısı</small>' : '') + '</span></span><div class="seg sm" role="group" aria-label="' + r.n + ' yoklama"><button type="button" class="ok" data-m="attended" data-n="' + esc(r.n) + '" aria-pressed="' + (s === 'attended') + '"' + dis + '>Geldi</button><button type="button" class="no" data-m="no_show" data-n="' + esc(r.n) + '" aria-pressed="' + (s === 'no_show') + '"' + dis + '>Gelmedi</button></div></li>';
      }).join('');
      var warnMark = n.filter(function (r) { return r.warn && a.marks[r.n] === 'attended'; })[0];
      $$('ed-ae').hidden = !warnMark; if (warnMark) $$('ed-ae').textContent = warnMark.n + ' için uygunluk uyarısı var. Geldi işaretlenebilir, ürün durumunu Üye profilinden kontrol et.';
      var needWhy = diff && !$$('ed-why').value.trim();
      $$('ed-astart').hidden = a.on || !live; $$('ed-astart').disabled = !today || !$$('ed-act').value || needWhy;
      $$('ed-aclose').hidden = !a.on || a.closed || !live; $$('ed-aclose').disabled = miss > 0 || n.length === 0;
      $$('ed-aedit').hidden = !(a.closed && !a.fix && live); $$('ed-acancel').hidden = $$('ed-asave').hidden = !a.fix;
      $$('ed-asave').disabled = !(a.fix && $$('ed-why').value.trim());
      $$('ed-ah').textContent = e.type === 'pratik' ? 'Pratik ders hakkı tüketmez. Yoklama yalnızca katılımı kaydeder.' : 'Atölye ücreti kayıtta alınır, yoklama ücreti değiştirmez.';
    }
    $$('ed-act').addEventListener('input', function () { var e = ev(cur); e.att._act = $$('ed-act').value; renderA(e); });
    $$('ed-why').addEventListener('input', function () { var e = ev(cur); e.att._why = $$('ed-why').value; renderA(e); });
    $$('ed-al').addEventListener('click', function (x) { var b = x.target.closest('button[data-m]'); if (!b || b.disabled) return; var e = ev(cur); e.att.marks[b.getAttribute('data-n')] = b.getAttribute('data-m'); renderD(); });
    $$('ed-astart').addEventListener('click', function () { var e = ev(cur); if ($$('ed-astart').disabled) return; e.att.on = true; e.att.act = $$('ed-act').value; e.att.why = $$('ed-why').value.trim(); e.att._act = e.att._why = null; renderD(); toast('Yoklama başladı, fiilî başlangıç ' + e.att.act + ' kaydedildi'); });
    $$('ed-aclose').addEventListener('click', function () { var e = ev(cur); e.att.closed = true; renderD(); toast('Yoklama kapatıldı'); });
    $$('ed-aedit').addEventListener('click', function () { var e = ev(cur); e.att.fix = true; e.att._snap = JSON.stringify([e.att.marks, e.att.act]); e.att._why = ''; e.att._act = e.att.act; renderD(); $$('ed-why').placeholder = 'Düzeltme gerekçesi'; });
    $$('ed-acancel').addEventListener('click', function () { var e = ev(cur), s = JSON.parse(e.att._snap); e.att.marks = s[0]; e.att.act = s[1]; e.att.fix = false; e.att._act = e.att._why = null; renderD(); });
    $$('ed-asave').addEventListener('click', function () { var e = ev(cur); if ($$('ed-asave').disabled) return; e.att.fix = false; e.att.act = $$('ed-act').value || e.att.act; e.att.why = $$('ed-why').value.trim(); e.att._act = e.att._why = null; renderD(); toast('Yoklama düzeltildi, gerekçe geçmişe yazıldı'); });

    /* Ortak onay penceresi */
    var D = null, dl = $$('ed-dlg'), dsc = $$('ed-dscrim'), dOp = null;
    function dChk() { var bad = D.block || (D.why && !$$('ed-dwhy').value.trim()) || (D.conf && !$$('ed-dconf').checked); $$('ed-dok').disabled = !!bad; }
    function dlg(o) {
      D = o; dOp = document.activeElement; $$('ed-dt').textContent = o.t; $$('ed-db').innerHTML = o.body; $$('ed-dwhy').value = ''; $$('ed-dconf').checked = false;
      $$('ed-dwhy-w').hidden = !o.why; $$('ed-dconf-w').hidden = !o.conf; if (o.conf) $$('ed-dconf-t').textContent = o.conf;
      $$('ed-dok').textContent = o.ok; $$('ed-dok').className = 'btn' + (o.danger ? ' danger' : ''); dChk(); dl.hidden = false; dsc.hidden = false; (o.why ? $$('ed-dwhy') : $$('ed-dok')).focus(); swap(dl);
    }
    function dClose() { dl.hidden = true; dsc.hidden = true; D = null; if (dOp) dOp.focus(); }
    $$('ed-dcancel').addEventListener('click', dClose); dsc.addEventListener('click', dClose);
    $$('ed-dwhy').addEventListener('input', dChk); $$('ed-dconf').addEventListener('change', dChk);
    $$('ed-dok').addEventListener('click', function () { if ($$('ed-dok').disabled || !D) return; var f = D.go, w = $$('ed-dwhy').value.trim(); dClose(); f(w); });
    function aff(rows) { return '<ul class="aff">' + rows.map(function (r) { return '<li><span class="row-l"><span>' + r[0] + '</span><b class="tnum">' + r[1] + '</b></span>' + (r[2] ? '<span class="ch">' + r[2] + '</span>' : '') + '</li>'; }).join('') + '</ul>'; }

    vD.addEventListener('click', function (x) {
      var e = ev(cur), t;
      if ((t = x.target.closest('[data-rc]'))) {
        var r = e.reg.filter(function (q) { return q.n === t.getAttribute('data-rc'); })[0], n = act(e).length;
        dlg({ t: 'Kaydı iptal et', body: '<p class="muted" style="margin-bottom:12px"><b style="font-weight:500;color:var(--foreground)">' + r.n + '</b> için ' + esc(e.t) + ' kaydı iptal edilir.</p>' + aff([['Kontenjan', n + ' → ' + (n - 1), e.cap == null ? 'Sınırsız etkinlik.' : 'Boşalan yer yeni kayıta açılır.'], r.pay === 'paid' ? ['Ödeme', money(r.amt) + ' ödenmişti', 'Alacak olarak üyenin hesabına yazılır. İade Finans üzerinden yapılır.'] : r.pay === 'due' ? ['Ödeme', money(r.amt) + ' bekliyordu', 'Borç kaydı silinir.'] : ['Hak', 'Değişmez', 'Pratik ders hakkı tüketmez.']]), why: true, ok: 'Kaydı iptal et', danger: true,
          go: function (w) { if (r.pay === 'paid' || r.pay === 'due') SHARED.finEvent({ n: r.n, title: e.t, a: r.amt, how: 'cancel-' + r.pay }); r.st = 'cancel'; r.why = w; renderD(); toast(r.n + ' kaydı iptal edildi'); } });
      } else if ((t = x.target.closest('[data-dv]'))) { var c = t.getAttribute('data-dv'); e.dv[c] = 'ok'; renderD(); toast(c + ' görevi doğrulandı'); }
      else if (x.target.closest('#ed-edit')) openEd(e);
      else if (x.target.closest('#ed-pub')) {
        var v = val(e, true), ok = !v.err;
        dlg({ t: 'Etkinliği yayınla', body: '<p class="muted" style="margin-bottom:12px">Yayınlanınca üyeler ' + (e.type === 'pratik' ? 'izinli ürünüyle' : 'üye panelinden') + ' kayıt olabilir.</p>' + aff([['Mekân ve saat', fdw(e.d) + ' ' + e.s, v.err ? v.err : 'Çakışma yok'], ['Kontenjan', capT(e), e.loc === 'out' ? 'Dış mekan, oda sınırı yok.' : ''], ['Ücret', feeT(e), e.type === 'pratik' ? 'Sıfır ücret, izinli ürün: ' + e.prods.join(', ') : '']]), ok: 'Yayınla', block: !ok,
          go: function () { e.st = 'pub'; renderD(); toast('Etkinlik yayınlandı'); } });
      } else if (x.target.closest('#ed-cx')) {
        var A = act(e), paid = sum(A.filter(function (r) { return r.pay === 'paid'; }), function (r) { return r.amt; }), dd = sum(due(e), function (r) { return r.amt; });
        dlg({ t: 'Etkinliği iptal et', body: '<p class="muted" style="margin-bottom:12px">İptal geri alınamaz. Etki aşağıdadır.</p>' + aff([['Kayıtlar', A.length + ' kayıt iptal olur', 'Üyelere bildirim gider.'], e.type === 'pratik' ? ['Hak', 'Değişmez', 'Pratik ders hakkı tüketmez.'] : ['Ödenen', money(paid), paid ? 'Alacak olarak üye hesaplarına yazılır, iade Finans üzerinden yapılır.' : 'Ödenen tutar yok.'], ['Bekleyen ödeme', money(dd), dd ? 'Borç kayıtları silinir.' : 'Yok']]), why: true, conf: 'Etkinliği iptal etmek istiyorum', ok: 'Etkinliği iptal et', danger: true,
          go: function (w) { e.st = 'cancel'; e.why = w; A.forEach(function (r) { if (r.pay === 'paid' || r.pay === 'due') SHARED.finEvent({ n: r.n, title: e.t, a: r.amt, how: 'cancel-' + r.pay }); r.st = 'cancel'; }); renderD(); toast('Etkinlik iptal edildi'); } });
      } else if (x.target.closest('#ed-done')) {
        var dn = due(e).length, dvOk = e.duty.every(function (c) { return e.dv[c] === 'ok'; }), ck = [['Yoklama kapandı', e.att.closed], ['Görevler doğrulandı', dvOk], ['Bekleyen ödeme yok', dn === 0]];
        dlg({ t: 'Etkinliği tamamla', body: '<p class="muted" style="margin-bottom:12px">Tamamlanan etkinlik düzenlenemez.</p><ul class="aff">' + ck.map(function (k) { return '<li><span class="row-l"><span>' + k[0] + '</span><b>' + (k[1] ? 'Tamam' : (k[0] === 'Bekleyen ödeme yok' ? dn + ' kayıtta ödeme bekliyor' : 'Eksik')) + '</b></span></li>'; }).join('') + '</ul>', ok: 'Etkinliği tamamla', block: ck.some(function (k) { return !k[1]; }),
          go: function () { e.st = 'done'; renderD(); toast('Etkinlik tamamlandı'); } });
      }
    });

    /* Kayıt çekmecesi: seç → ödeme hazırla → kesin onay */
    var rSh = $$('er-sheet'), rSc = $$('er-scrim'), rOp = null, rs = { step: 1, who: null, how: 'paid', m: 'Havale', ref: '' };
    function eligible(e, n) {
      var m = MEM[n]; if (m.bad) return m.bad;
      if (e.type === 'pratik' && e.prods.indexOf(m.pk) < 0) return 'Bu Pratik için izinli ürün yok. Üyenin hakkı: ' + m.pk + '.';
      if (e.doc && !m.doc) return 'Belge onayı yok: ' + e.doc + '. Üye kabul etmeli.';
      return '';
    }
    function rSteps(e) { return e.type === 'pratik' || e.fee === 0 ? [1, 3] : [1, 2, 3]; }
    function rDraw() {
      var e = ev(cur), st = rSteps(e), i = st.indexOf(rs.step) + 1;
      $$('er-step').textContent = 'Adım ' + i + ' / ' + st.length + ' · ' + (rs.step === 1 ? 'Üye seç' : rs.step === 2 ? 'Ödeme hazırlığı' : 'Kesin onay');
      $$('er-p1').hidden = rs.step !== 1; $$('er-p2').hidden = rs.step !== 2; $$('er-p3').hidden = rs.step !== 3; $$('er-p2').style.display = rs.step === 2 ? 'grid' : 'none'; $$('er-p3').style.display = rs.step === 3 ? 'grid' : 'none';
      var last = rs.step === st[st.length - 1];
      $$('er-next').textContent = rs.step === 1 ? 'Devam' : rs.step === 2 ? 'Ödemeyi hazırla' : 'Kaydı oluştur'; $$('er-back').textContent = rs.step === 1 ? 'Vazgeç' : 'Geri';
      if (rs.step === 1) {
        var c = $$('er-list').querySelector('input:checked'); rs.who = c ? c.value : null; var eff = $$('er-eff');
        $$('er-next').disabled = !rs.who; eff.hidden = !rs.who;
        if (rs.who) { var n = act(e).length, m = MEM[rs.who]; eff.querySelector('ul').innerHTML = [['Kontenjan', (n + 1) + ' / ' + capT(e), e.cap != null && n + 1 === e.cap ? 'Son yer. Kayıttan sonra etkinlik dolar.' : ''], e.type === 'pratik' ? ['Uygunluk', m.pk, 'İzinli ürün. Ders hakkı tüketilmez.'] : ['Ücret', money(e.fee), 'Sonraki adımda ödeme hazırlanır.'], e.doc ? ['Belge', 'Kabul edilmiş', e.doc] : null].filter(Boolean).map(function (r) { return '<li><span class="row-l"><span>' + r[0] + '</span><b class="tnum">' + r[1] + '</b></span>' + (r[2] ? '<span class="ch">' + r[2] + '</span>' : '') + '</li>'; }).join(''); }
      } else if (rs.step === 2) {
        $$('er-items').innerHTML = '<li><span class="row-l"><span>Etkinlik ücreti</span><b class="tnum">' + money(e.fee) + '</b></span></li><li><span class="row-l"><span>İndirim</span><b>Yok</b></span><span class="ch">Etkinlik kaydında indirim uygulanmaz.</span></li><li><span class="row-l"><span>Toplam</span><b class="tnum">' + money(e.fee) + '</b></span></li>';
        $$('er-m-w').hidden = rs.how !== 'paid'; $$('er-how-h').textContent = rs.how === 'paid' ? 'Tutar tahsilat kaydı olarak yazılır.' : 'Üyenin hesabına ' + money(e.fee) + ' borç yazılır. Etkinlik tamamlanmadan tahsil edilmeli.'; $$('er-next').disabled = false;
      } else {
        $$('er-sum').innerHTML = [['Üye', rs.who, MEM[rs.who].pk], ['Etkinlik', esc(e.t), fdw(e.d) + ' · ' + e.s], ['Kontenjan', (act(e).length + 1) + ' / ' + capT(e), ''], e.type === 'pratik' ? ['Hak', 'Tüketilmez', 'Paketli Pratik, sıfır ücret.'] : ['Ödeme', money(e.fee) + (rs.how === 'paid' ? ' · ' + rs.m : ' · sonra'), rs.how === 'paid' ? 'Hazırlandı: ' + rs.ref : 'Borç olarak yazılır.']].map(function (r) { return '<li><span class="row-l"><span>' + r[0] + '</span><b class="tnum">' + r[1] + '</b></span>' + (r[2] ? '<span class="ch">' + r[2] + '</span>' : '') + '</li>'; }).join('');
        $$('er-next').disabled = !$$('er-conf').checked;
      }
    }
    function rOpen() {
      var e = ev(cur); rOp = document.activeElement; rs = { step: 1, who: null, how: 'paid', m: 'Havale', ref: '' };
      $$('er-sub').textContent = e.t + ', ' + fdw(e.d) + '. Kayıt önce önizlenir, sonra ayrıca onaylanır.'; $$('er-conf').checked = false;
      $$('er-list').innerHTML = '<legend class="label">Üye</legend>' + Object.keys(MEM).filter(function (n) { return !act(e).some(function (r) { return r.n === n; }); }).map(function (n) {
        var b = eligible(e, n), m = MEM[n]; return '<label class="opt' + (b ? ' ap-off' : '') + '"><input type="radio" name="er" value="' + n + '"' + (b ? ' disabled' : '') + '><span><b>' + n + '</b><small>' + m.pk + '</small>' + (b ? '<small style="color:var(--destructive)">' + b + '</small>' : '') + '</span></label>';
      }).join('');
      $$('er-how').querySelectorAll('button').forEach(function (b, i) { b.setAttribute('aria-pressed', String(i === 0)); }); $$('er-m').querySelectorAll('button').forEach(function (b, i) { b.setAttribute('aria-pressed', String(i === 0)); });
      rDraw(); rSh.hidden = false; rSc.hidden = false; $$('er-x').focus();
    }
    function rClose() { rSh.hidden = true; rSc.hidden = true; if (rOp) rOp.focus(); }
    $$('er-list').addEventListener('change', rDraw); $$('er-conf').addEventListener('change', rDraw);
    $$('er-how').addEventListener('click', function (x) { var b = x.target.closest('button'); if (!b) return; rs.how = b.getAttribute('data-v'); $$('er-how').querySelectorAll('button').forEach(function (y) { y.setAttribute('aria-pressed', String(y === b)); }); rDraw(); });
    $$('er-m').addEventListener('click', function (x) { var b = x.target.closest('button'); if (!b) return; rs.m = b.getAttribute('data-v'); $$('er-m').querySelectorAll('button').forEach(function (y) { y.setAttribute('aria-pressed', String(y === b)); }); });
    $$('er-back').addEventListener('click', function () { var st = rSteps(ev(cur)), i = st.indexOf(rs.step); if (i === 0) rClose(); else { rs.step = st[i - 1]; rDraw(); } });
    $$('er-next').addEventListener('click', function () {
      if ($$('er-next').disabled) return; var e = ev(cur), st = rSteps(e), i = st.indexOf(rs.step);
      if (rs.step === 2) rs.ref = 'ETK-' + e.id + '-' + (400 + e.reg.length + 12);
      if (rs.step !== 3) { rs.step = st[i + 1]; rDraw(); return; }
      e.reg.push(R(rs.who, e.type === 'pratik' || e.fee === 0 ? 'free' : rs.how, e.fee, { m: rs.how === 'paid' && e.type !== 'pratik' ? rs.m : '' }));
      if (e.type !== 'pratik' && e.fee > 0) SHARED.finEvent({ n: rs.who, title: e.t, a: e.fee, how: rs.how, m: rs.m });
      rClose(); renderD(); toast(rs.who + ' kaydedildi' + (e.type === 'pratik' ? '' : rs.how === 'paid' ? ', ödeme alındı' : ', ödeme bekliyor'));
    });
    $$('er-x').addEventListener('click', rClose); rSc.addEventListener('click', rClose); $$('ed-radd').addEventListener('click', rOpen);

    /* Ekle / düzenle çekmecesi */
    var eSh = $$('ev-sheet'), eSc = $$('ev-scrim'), eOp = null, edit = null, typ = 'atolye', loc = 'in';
    function segSet(id, v) { $$(id).querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-v') === v)); }); }
    function numv(id) { return Math.round(+$$(id).value.replace(/\D/g, '')) || 0; }
    function draft() {
      return { t: $$('ev-t').value.trim(), type: typ, d: $$('ev-d').value, s: $$('ev-s').value, e: $$('ev-e').value, loc: loc, room: loc === 'in' ? $$('ev-room').value : '', cap: loc === 'out' && $$('ev-unl').checked ? null : numv('ev-cap'), fee: typ === 'pratik' ? 0 : numv('ev-fee'), prods: Array.prototype.map.call($$('ev-prods-w').querySelectorAll('input:checked'), function (i) { return i.value; }), duty: Array.prototype.map.call($$('ev-duty').querySelectorAll('input:checked'), function (i) { return i.value; }), doc: typ === 'atolye' ? $$('ev-doc').value : '' };
    }
    function conflict(d, id) {
      if (d.loc === 'out' || !d.d || !d.s || !d.e) return '';
      var i = wdi(d.d), a = tm(d.s), b = tm(d.e), hit = '';
      (SHARED.cal || []).forEach(function (c) { if (!c.once && !c.from && c.d === i && c.r === d.room && a < c.s + c.l && c.s < b) hit = c.t + ' dersi ' + d.room + ' salonunda ' + ('0' + Math.floor(c.s / 60)).slice(-2) + ':' + ('0' + c.s % 60).slice(-2) + ' - ' + ('0' + Math.floor((c.s + c.l) / 60)).slice(-2) + ':' + ('0' + (c.s + c.l) % 60).slice(-2) + ' arasında var.'; });
      E.forEach(function (o) { if (o.id !== id && o.st !== 'cancel' && o.d === d.d && o.room === d.room && a < tm(o.e) && tm(o.s) < b) hit = o.t + ' etkinliği aynı salonda aynı saatte.'; });
      return hit;
    }
    function val(d, pub) {
      if (pub) { var o = d; d = { t: o.t, type: o.type, d: o.d, s: o.s, e: o.e, loc: o.loc, room: o.room, cap: o.cap, fee: o.fee, prods: o.prods, duty: o.duty, doc: o.doc }; edit = o; var r = chk(d); edit = null; return r; }
      return chk(d);
    }
    function chk(d) {
      var err = '', reg = edit ? act(edit).length : 0, cf = conflict(d, edit ? edit.id : 0);
      if (!d.t) err = 'Başlık yaz.'; else if (!d.d || d.d < TODAY) err = 'Tarih bugünden önce olamaz.'; else if (!d.s || !d.e || tm(d.e) <= tm(d.s)) err = 'Bitiş saati başlangıçtan sonra olmalı.';
      else if (cf) err = 'Çakışma: ' + cf;
      else if (d.cap != null && !(d.cap > 0)) err = 'Kontenjan yaz.'; else if (d.loc === 'in' && d.cap > ROOMS[d.room]) err = d.room + ' oda sınırı ' + ROOMS[d.room] + '. Daha çok kişi için dış mekan seç.'; else if (d.cap != null && d.cap < reg) err = 'Kayıtlı ' + reg + ' üye var, kontenjan bunun altına inemez.';
      else if (d.type === 'atolye' && !(d.fee > 0)) err = 'Atölye ücreti yaz. Ücretsiz etkinlik için Paketli Pratik seç.'; else if (d.type === 'pratik' && !d.prods.length) err = 'Pratik için en az bir izinli ürün seç.'; else if (!d.duty.length) err = 'En az bir görevli eğitmen seç.';
      return { err: err, cf: cf };
    }
    function eCheck() {
      var d = draft(), v = chk(d), rows = [];
      $$('ev-type-h').textContent = typ === 'pratik' ? 'Ücretsiz. Ürünü uygun üyeler kayıt olur, ders hakkı tüketilmez.' : 'Ücretli. Kayıtta ödeme hazırlanır ve ayrıca onaylanır.';
      $$('ev-room-w').hidden = loc === 'out'; $$('ev-unl-w').hidden = loc !== 'out'; $$('ev-cap').disabled = loc === 'out' && $$('ev-unl').checked;
      $$('ev-cap-h').textContent = loc === 'in' ? 'Oda sınırı ' + ROOMS[$$('ev-room').value] : $$('ev-unl').checked ? 'Sınırsız' : 'Dış mekanda oda sınırı yok';
      $$('ev-fee-w').hidden = typ === 'pratik'; $$('ev-doc-w').hidden = typ === 'pratik'; $$('ev-prods-w').hidden = typ !== 'pratik';
      rows.push(['Kapasite', d.cap == null ? 'Sınırsız' : d.cap + (d.loc === 'in' && ROOMS[d.room] ? ' / oda ' + ROOMS[d.room] : ''), 'Ders kontenjanından ayrıdır.']);
      rows.push(['Çakışma', v.cf ? 'Var' : 'Yok', v.cf ? v.cf : d.loc === 'out' ? 'Dış mekanda salon çakışması aranmaz.' : 'Ders programı ve diğer etkinliklerle kontrol edildi.']);
      rows.push(['Ücret', typ === 'pratik' ? 'Sıfır' : d.fee ? money(d.fee) : '-', typ === 'pratik' ? 'Hak uygunluğuna bakılır.' : 'Yalnız yeni kayıtlara uygulanır.']);
      if (edit && edit.st === 'pub' && act(edit).length) { var ch = edit.d !== d.d || edit.s !== d.s || edit.room !== d.room; rows.push(['Kayıtlı üyeler', act(edit).length + ' üye', ch ? 'Tarih, saat veya salon değişti. Üyelere bildirim gider.' : 'Değişiklik üyeleri etkilemez.']); }
      $$('ev-eff').innerHTML = rows.map(function (r) { return '<li><span class="row-l"><span>' + r[0] + '</span><b class="tnum">' + esc(r[1]) + '</b></span><span class="ch">' + esc(r[2]) + '</span></li>'; }).join('');
      var er = $$('ev-err'); er.hidden = !v.err; er.querySelector('span').textContent = v.err; $$('ev-save').disabled = !!v.err;
    }
    function eFill(d) {
      $$('ev-t').value = d.t; typ = d.type; loc = d.loc; segSet('ev-type', typ); segSet('ev-loc', loc); $$('ev-d').value = d.d; $$('ev-s').value = d.s; $$('ev-e').value = d.e; $$('ev-room').value = d.room || 'Salon A';
      $$('ev-unl').checked = d.cap == null && d.loc === 'out'; $$('ev-cap').value = d.cap == null ? '' : d.cap; $$('ev-fee').value = d.fee || ''; $$('ev-doc').value = d.doc || '';
      $$('ev-prods-w').innerHTML = '<legend class="label">Katılabilen ürünler</legend>' + PRODS.map(function (p) { return '<label class="opt"><input type="checkbox" value="' + p + '"' + (d.prods.indexOf(p) > -1 ? ' checked' : '') + '><span><b>' + p + '</b></span></label>'; }).join('');
      $$('ev-duty').innerHTML = '<legend class="label">Görevli eğitmenler</legend>' + ['Elif K.', 'Mert A.', 'Kaan S.', 'Ceren B.', 'Deniz Y.'].map(function (c) { return '<label class="opt"><input type="checkbox" value="' + c + '"' + (d.duty.indexOf(c) > -1 ? ' checked' : '') + '><span><b>' + (SHARED.coachFull ? SHARED.coachFull(c) : c) + '</b></span></label>'; }).join('');
    }
    function eOpen(e) {
      eOp = document.activeElement; edit = e || null;
      $$('ev-title').textContent = e ? 'Etkinliği düzenle' : 'Etkinlik ekle'; $$('ev-sub').textContent = e ? e.t : 'Taslak olarak kaydedilir. Yayın ayrı bir adımdır.'; $$('ev-save').textContent = e && e.st === 'pub' ? 'Değişiklikleri kaydet' : 'Taslak kaydet';
      eFill(e || { t: '', type: 'atolye', loc: 'in', d: '2026-11-28', s: '14:00', e: '17:00', room: 'Salon A', cap: 16, fee: 450, prods: [], duty: [], doc: '' });
      eCheck(); eSh.hidden = false; eSc.hidden = false; $$('ev-t').focus(); swap(eSh);
    }
    function openEd(e) { eOpen(e); }
    function eClose() { eSh.hidden = true; eSc.hidden = true; if (eOp) eOp.focus(); }
    $$('ev-add').addEventListener('click', function () { eOpen(null); });
    $$('ev-x').addEventListener('click', eClose); $$('ev-cancel').addEventListener('click', eClose); eSc.addEventListener('click', eClose);
    $$('ev-form').addEventListener('input', eCheck); $$('ev-form').addEventListener('change', eCheck); $$('ev-form').addEventListener('submit', function (x) { x.preventDefault(); });
    $$('ev-type').addEventListener('click', function (x) { var b = x.target.closest('button'); if (!b) return; typ = b.getAttribute('data-v'); segSet('ev-type', typ); if (typ === 'pratik' && !$$('ev-prods-w').querySelector('input:checked')) { var f = $$('ev-prods-w').querySelector('input'); if (f) f.checked = true; } eCheck(); });
    $$('ev-loc').addEventListener('click', function (x) { var b = x.target.closest('button'); if (!b) return; loc = b.getAttribute('data-v'); segSet('ev-loc', loc); eCheck(); });
    $$('ev-save').addEventListener('click', function () {
      if ($$('ev-save').disabled) return; var d = draft();
      if (edit) { for (var k in d) edit[k] = d[k]; cur = edit.id; eClose(); renderL(); renderD(); toast('Etkinlik güncellendi'); }
      else { var n = { id: eid++, st: 'draft', reg: [], att: { on: false, act: '', why: '', marks: {}, closed: false, fix: false }, dv: {} }; for (var k2 in d) n[k2] = d[k2]; n.duty.forEach(function (c) { n.dv[c] = 'wait'; }); E.push(n); cur = n.id; eClose(); renderL(); toast('Taslak kaydedildi'); openE(n.id); }
    });
    document.addEventListener('keydown', function (x) { if (x.key !== 'Escape') return; if (!dl.hidden) dClose(); else if (!rSh.hidden) rClose(); else if (!eSh.hidden) eClose(); });
    SHARED.ev = { E: E };
    /* Mevcut ücretli etkinlik kayıtlarını Finans ve üye kayıtlarına bir kez işle */
    E.forEach(function (e) { if (e.type === 'pratik' || e.st === 'cancel' || !e.fee) return; e.reg.forEach(function (r) { if ((r.pay === 'paid' || r.pay === 'due') && r.st !== 'cancel') SHARED.finEvent({ n: r.n, title: e.t, a: r.amt, how: r.pay, m: r.m, day: 33 }); }); });
    renderL(); renderD(); swap(vL); swap(eSh); swap(rSh);
  })();

  /* ---------- Hakediş ve eğitmen anlaşmaları (kurgusal veri; seanslar Ders programı ile tutarlı) ---------- */
  (function () {
    var $$ = function (id) { return document.getElementById(id); };
    var view = document.querySelector('[data-view="hakedis"]');
    var SD = SHARED.sd, IN = SD.IN;
    var DAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'], MON = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
    var TODAY = '2026-11-04', MODEL = { seans: 'Seans başı', saat: 'Saatlik', katilim: 'Katılımcı başı' };
    function money(n) { return (n < 0 ? '-' : '') + '₺' + String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
    function pd(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
    function iso(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
    function fd(s) { var d = pd(s); return d.getDate() + ' ' + MON[d.getMonth()]; }
    function fdw(s) { var d = pd(s); return DAYS[(d.getDay() + 6) % 7] + ' ' + d.getDate() + ' ' + MON[d.getMonth()]; }
    function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
    function sh(n) { var p = n.split(' '); return p[0] + ' ' + p[1][0] + '.'; }
    function hm(m) { return ('0' + Math.floor(m / 60)).slice(-2) + ':' + ('0' + (m % 60)).slice(-2); }

    /* Anlaşmalar: sürümlü, yürürlük tarihli */
    var AGR = {
      'Elif K.': [{ v: 1, from: '2026-09-01', model: 'seans', amt: 400, min: 0, note: 'İlk anlaşma' }, { v: 2, from: '2026-10-15', model: 'seans', amt: 450, min: 0, note: 'Ekim ücret güncellemesi' }],
      'Mert A.': [{ v: 1, from: '2026-09-01', model: 'saat', amt: 300, min: 0, note: 'İlk anlaşma' }],
      'Kaan S.': [{ v: 1, from: '2026-09-01', model: 'katilim', amt: 60, min: 250, note: 'İlk anlaşma' }],
      'Ceren B.': [{ v: 1, from: '2026-09-01', model: 'seans', amt: 400, min: 0, note: 'İlk anlaşma' }],
      'Deniz Y.': [{ v: 1, from: '2026-09-01', model: 'saat', amt: 500, min: 0, note: 'İlk anlaşma' }]
    };
    function agrAt(c, d) { var l = (AGR[c] || []).filter(function (a) { return a.from <= d; }); return l[l.length - 1] || null; }
    function calc(a, l, att) { return !a ? 0 : a.model === 'seans' ? a.amt : a.model === 'saat' ? Math.round(a.amt * l / 60) : Math.max(a.min, att * a.amt); }
    function basis(a, l, att) { return !a ? '-' : a.model === 'seans' ? 'Seans başı' : a.model === 'saat' ? (l / 60).toString().replace('.', ',') + ' sa × ' + money(a.amt) : (att * a.amt < a.min ? 'Asgari ' + money(a.min) : att + ' katılımcı × ' + money(a.amt)); }
    function rate(a) { return !a ? '-' : money(a.amt) + (a.model === 'saat' ? ' / saat' : a.model === 'katilim' ? ' / katılımcı' : ' / seans') + (a.model === 'katilim' && a.min ? ' (asgari ' + money(a.min) + ')' : ''); }

    /* Kök hakediş satırları: kapanan geçmiş seanslar */
    var LINES = [], lid = 1;
    (function () {
      var base = SHARED.cal.filter(function (x) { return !x.once && !x.from; });
      for (var d = pd('2026-10-01'); iso(d) <= '2026-11-03'; d.setDate(d.getDate() + 1)) {
        var di = iso(d), idx = (d.getDay() + 6) % 7; if (di === '2026-10-29') continue;
        base.forEach(function (s) {
          if (s.d !== idx) return; var c = SHARED.coachOf(s), a = agrAt(c, di), att = s.p ? 1 : Math.max(1, s.h - ((d.getDate() + s.d) % 3));
          LINES.push({ id: lid++, d: di, t: s.t, c: c, l: s.l, att: att, v: a ? a.v : 0, basis: basis(a, s.l, att), amt: calc(a, s.l, att) });
        });
      }
      LINES.sort(function (a, b) { return a.d < b.d ? -1 : a.d > b.d ? 1 : a.id - b.id; });
    })();
    function sumTo(c, upto) { return LINES.filter(function (x) { return x.c === c && x.d <= upto; }).reduce(function (a, x) { return a + x.amt; }, 0); }
    var PAYS = [], pid = 1;
    function addPay(c, d, amt, m, note, kind, ref) { PAYS.push({ id: pid++, c: c, d: d, amt: amt, m: m, note: note || '', kind: kind || 'p', ref: ref || 0 }); return pid - 1; }
    addPay('Elif K.', '2026-10-26', sumTo('Elif K.', '2026-10-25'), 'Havale', 'Ekim ilk 3 hafta');
    var mp = addPay('Mert A.', '2026-10-26', sumTo('Mert A.', '2026-10-25') + 100, 'Havale', 'Ekim ilk 3 hafta');
    addPay('Mert A.', '2026-10-28', -100, 'Havale', 'Yanlış tutar girildi', 'c', mp);
    addPay('Kaan S.', '2026-11-02', sumTo('Kaan S.', '2026-10-31') - 120, 'Nakit', 'Ekim, kalan sonra');
    addPay('Ceren B.', '2026-11-03', sumTo('Ceren B.', '2026-11-03') + 250, 'Havale', 'Ekim ve Kasım');
    addPay('Deniz Y.', '2026-11-02', sumTo('Deniz Y.', '2026-10-31'), 'Nakit', 'Ekim');

    function coaches() { return IN.filter(function (e) { return e.on && AGR[sh(e.n)]; }).map(function (e) { return sh(e.n); }); }
    function alloc(c) {
      var ls = LINES.filter(function (x) { return x.c === c; }), net = PAYS.filter(function (p) { return p.c === c; }).reduce(function (a, p) { return a + p.amt; }, 0), left = net, tot = 0;
      var out = ls.map(function (x) { var p = Math.min(Math.max(left, 0), x.amt); left -= p; tot += x.amt; return { x: x, paid: p }; });
      return { rows: out, total: tot, paid: net, rem: Math.max(0, tot - net), over: Math.max(0, net - tot) };
    }

    /* Hakediş sayfası */
    var tab = 'ins', per = 'all', who = '', shown = 15;
    function inPer(d) { return per === 'all' || d.indexOf(per) === 0; }
    function whoList() { return who ? [who] : coaches(); }
    function kpi(l, v, s, c) { return '<div class="kpi card"><span class="l">' + l + '</span><b class="tnum"' + (c ? ' style="color:' + c + '"' : '') + '>' + v + '</b><span class="sub">' + s + '</span></div>'; }
    function render() {
      var cs = whoList(), A = cs.map(alloc), tot = 0, paid = 0, rem = 0, over = 0, nl = 0;
      A.forEach(function (a) { tot += a.total; paid += Math.min(a.paid, a.total); rem += a.rem; over += a.over; nl += a.rows.length; });
      $$('hk-kpi').innerHTML = kpi('Toplam hakediş', money(tot), nl + ' kapanan seans') + kpi('Ödenen', money(paid), 'Düzeltmeler dahil') + kpi('Kalan', money(rem), rem ? 'Ödeme bekliyor' : 'Borç yok', rem ? 'var(--destructive)' : '') + kpi('Fazla ödeme', money(over), over ? 'Sonraki hakedişten düşer' : 'Yok');
      $$('hk-ins').innerHTML = coaches().filter(function (c) { return !who || c === who; }).map(function (c) {
        var a = alloc(c), g = agrAt(c, TODAY);
        return '<tr><td><span class="nm"><span>' + esc(SHARED.coachFull(c)) + '</span><small>' + c + '</small></span></td><td class="tnum">' + MODEL[g.model] + '<span class="pk-sub-p">' + rate(g) + ' · v' + g.v + '</span></td><td class="r tnum">' + a.rows.length + '</td><td class="r tnum">' + money(a.total) + '</td><td class="r tnum">' + money(a.paid) + '</td><td class="r tnum">' + (a.over ? '<span class="badge soft">Fazla ' + money(a.over) + '</span>' : a.rem ? '<b style="color:var(--destructive);font-weight:500">' + money(a.rem) + '</b>' : '<span class="muted">-</span>') + '</td><td class="act"><button type="button" class="btn outline sm" data-pay="' + esc(c) + '">Ödeme kaydet</button></td></tr>';
      }).join('') || '<tr><td colspan="7" class="muted" style="padding:32px 0;text-align:center">Anlaşması olan eğitmen yok.</td></tr>';
      var rows = []; A.forEach(function (a) { a.rows.forEach(function (r) { if (inPer(r.x.d)) rows.push(r); }); });
      rows.sort(function (a, b) { return a.x.d < b.x.d ? 1 : a.x.d > b.x.d ? -1 : b.x.id - a.x.id; });
      $$('hk-lines').innerHTML = rows.slice(0, shown).map(function (r) {
        var x = r.x, rem = x.amt - r.paid, st = r.paid >= x.amt ? '<span class="badge ok">Ödendi</span>' : r.paid > 0 ? '<span class="badge">Kısmi</span>' : '<span class="badge soft">Bekliyor</span>';
        return '<tr><td class="tnum">' + fdw(x.d) + '</td><td><span class="nm"><span>' + esc(x.t) + '</span><small class="tnum">' + hm(0).slice(0, 0) + x.l + ' dk · ' + x.att + ' katılımcı</small></span></td><td>' + x.c + '</td><td class="muted tnum">' + esc(x.basis) + '<span class="pk-sub-p">v' + x.v + '</span></td><td class="r tnum">' + money(x.amt) + '</td><td class="r tnum">' + money(r.paid) + '</td><td class="r tnum">' + (rem ? money(rem) : '<span class="muted">-</span>') + '</td><td>' + (x.live ? '<span class="badge">Yeni</span> ' : '') + st + '</td></tr>';
      }).join('') || '<tr><td colspan="8" class="muted" style="padding:32px 0;text-align:center">Bu dönemde hakediş satırı yok.</td></tr>';
      $$('hk-more').hidden = rows.length <= shown; $$('hk-more').textContent = 'Daha fazla göster (' + (rows.length - shown) + ')';
      var ps = PAYS.filter(function (p) { return (!who || p.c === who) && inPer(p.d); }).sort(function (a, b) { return a.d < b.d ? 1 : a.d > b.d ? -1 : b.id - a.id; });
      $$('hk-pays').innerHTML = ps.map(function (p) {
        var eff = p.kind === 'p' ? p.amt + PAYS.filter(function (q) { return q.ref === p.id; }).reduce(function (a, q) { return a + q.amt; }, 0) : 0;
        return '<tr class="' + (p.kind === 'c' ? 'sub' : '') + '"><td class="tnum">' + (p.kind === 'c' ? '<span class="muted">↳ </span>' : '') + fd(p.d) + '</td><td>' + p.c + '</td><td>' + (p.kind === 'p' ? 'Ödeme · ' + p.m : 'Düzeltme') + '</td><td class="r tnum">' + (p.kind === 'c' ? (p.amt > 0 ? '+' : '') : '') + money(p.amt) + '</td><td class="muted">' + esc(p.note) + '</td><td class="act">' + (p.kind === 'p' ? '<button type="button" class="btn ghost sm" data-fix="' + p.id + '">Düzelt</button>' + (eff !== p.amt ? '<span class="pk-sub-p tnum">Güncel ' + money(eff) + '</span>' : '') : '') + '</td></tr>';
      }).join('') || '<tr><td colspan="6" class="muted" style="padding:32px 0;text-align:center">Ödeme kaydı yok.</td></tr>';
      $$('hk-s').textContent = tab === 'lines' ? rows.length + ' satır' : tab === 'pays' ? ps.length + ' kayıt' : coaches().length + ' eğitmen';
      view.querySelectorAll('[data-hkpanel]').forEach(function (p) { p.hidden = p.getAttribute('data-hkpanel') !== tab; });
      $$('hk-tabs').querySelectorAll('[role=tab]').forEach(function (b) { b.setAttribute('aria-selected', String(b.getAttribute('data-hk') === tab)); });
      $$('hk-who').innerHTML = '<option value="">Tüm eğitmenler</option>' + coaches().map(function (c) { return '<option value="' + c + '"' + (c === who ? ' selected' : '') + '>' + c + '</option>'; }).join('');
    }
    $$('hk-tabs').addEventListener('click', function (e) { var b = e.target.closest('[data-hk]'); if (b) { tab = b.getAttribute('data-hk'); render(); } });
    $$('hk-who').addEventListener('change', function () { who = $$('hk-who').value; shown = 15; render(); });
    $$('hk-per').addEventListener('click', function (e) { var b = e.target.closest('button[data-p]'); if (!b) return; per = b.getAttribute('data-p'); shown = 15; $$('hk-per').querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); render(); });
    $$('hk-more').addEventListener('click', function () { shown += 20; render(); });

    /* Çekmece: ödeme kaydet / düzelt */
    var sheet = $$('hp-sheet'), scrim = $$('hp-scrim'), opener = null, mode = 'new', fixId = 0;
    function num(id) { return Math.round(+$$(id).value.replace(/\D/g, '')) || 0; }
    function segV(id) { return $$(id).querySelector('[aria-pressed="true"]').textContent; }
    function hpCheck() {
      var eff = [], err = '', ok = false;
      if (mode === 'new') {
        var c = $$('hp-who2').value, a = alloc(c), amt = num('hp-amt'), d = $$('hp-d').value, over = Math.max(0, amt - a.rem);
        $$('hp-who-h').textContent = 'Kalan ' + money(a.rem) + (a.over ? ', avans ' + money(a.over) : '');
        if (!(amt > 0)) err = ''; else if (!d || d > TODAY) err = 'Ödeme tarihi bugünden ileri olamaz.';
        var left = amt, full = 0, part = 0; a.rows.forEach(function (r) { var need = r.x.amt - r.paid; if (need > 0 && left > 0) { if (left >= need) full++; else part++; left -= Math.min(left, need); } });
        eff = amt > 0 ? [['Kalan', money(a.rem) + ' → ' + money(Math.max(0, a.rem - amt)), full + ' satır tamamen ödenir' + (part ? ', 1 satır kısmi kalır' : '') + '. En eski hakedişten başlanır.']] : [['Kalan', money(a.rem), 'Tutar yazınca dağıtım görünür.']];
        if (over > 0 && amt > 0) eff.push(['Fazla ödeme', money(over), 'Hakedişi aşıyor. Fazlası avans olarak kalır.']);
        $$('hp-over-w').hidden = !(over > 0 && amt > 0);
        ok = amt > 0 && !err && (over === 0 || $$('hp-over').checked);
      } else {
        var p = PAYS.filter(function (x) { return x.id === fixId; })[0], cur = p.amt + PAYS.filter(function (q) { return q.ref === p.id; }).reduce(function (s, q) { return s + q.amt; }, 0), dec = segV('hp-k') === 'Azalt', f = num('hp-famt'), al = alloc(p.c), delta = dec ? -f : f;
        if (f > 0 && dec && f > cur) err = 'Azaltma, bu ödemenin güncel tutarını (' + money(cur) + ') aşamaz.';
        var newNet = al.paid + delta, after = Math.max(0, al.total - newNet), afterOver = Math.max(0, newNet - al.total);
        eff = f > 0 ? [['Ödeme', money(cur) + ' → ' + money(cur + delta), 'Özgün ' + money(p.amt) + ' kaydı değişmez, düzeltme satırı eklenir.'], [afterOver ? 'Fazla ödeme' : 'Kalan', afterOver ? money(afterOver) : money(al.rem) + ' → ' + money(after), dec ? 'Azaltılan tutar tekrar hakediş borcuna döner.' : 'Artış en eski hakedişe dağıtılır.']] : [['Ödeme', money(cur), 'Fark yazınca etki görünür.']];
        ok = f > 0 && !err && !!$$('hp-why').value.trim();
      }
      $$('hp-eff').innerHTML = eff.map(function (r) { return '<li><span class="row-l"><span>' + r[0] + '</span><b class="tnum">' + esc(r[1]) + '</b></span><span class="ch">' + esc(r[2]) + '</span></li>'; }).join('');
      var er = $$('hp-err'); er.hidden = !err; er.querySelector('span').textContent = err; $$('hp-ok').disabled = !ok;
    }
    function open(m, c, id) {
      opener = document.activeElement; mode = m; fixId = id || 0;
      $$('hp-new').hidden = m !== 'new'; $$('hp-fix').hidden = m !== 'fix';
      if (m === 'new') {
        $$('hp-title').textContent = 'Ödeme kaydet'; $$('hp-sub').textContent = 'Eğitmene yaptığın ödemeyi kaydet. Üye tahsilatından ayrıdır.'; $$('hp-ok').textContent = 'Ödemeyi kaydet';
        $$('hp-who2').innerHTML = coaches().map(function (x) { return '<option value="' + x + '"' + (x === (c || who || coaches()[0]) ? ' selected' : '') + '>' + esc(SHARED.coachFull(x)) + '</option>'; }).join('');
        var a = alloc($$('hp-who2').value); $$('hp-amt').value = a.rem || ''; $$('hp-d').value = TODAY; $$('hp-note').value = ''; $$('hp-over').checked = false;
      } else {
        var p = PAYS.filter(function (x) { return x.id === id; })[0];
        $$('hp-title').textContent = 'Ödemeyi düzelt'; $$('hp-sub').textContent = p.c + ' · ' + fd(p.d) + ' · ' + p.m; $$('hp-ok').textContent = 'Düzeltmeyi kaydet';
        var chain = PAYS.filter(function (q) { return q.ref === p.id; });
        $$('hp-orig').innerHTML = '<li><span class="row-l"><span>Özgün ödeme</span><b class="tnum">' + money(p.amt) + '</b></span><span class="ch">' + fd(p.d) + (p.note ? ' · ' + esc(p.note) : '') + '</span></li>' + chain.map(function (q) { return '<li><span class="row-l"><span>Düzeltme</span><b class="tnum">' + (q.amt > 0 ? '+' : '') + money(q.amt) + '</b></span><span class="ch">' + fd(q.d) + ' · ' + esc(q.note) + '</span></li>'; }).join('');
        $$('hp-famt').value = ''; $$('hp-why').value = ''; $$('hp-k').querySelectorAll('button').forEach(function (b, i) { b.setAttribute('aria-pressed', String(i === 0)); });
      }
      sheet.hidden = false; scrim.hidden = false; hpCheck(); (m === 'new' ? $$('hp-amt') : $$('hp-famt')).focus();
    }
    function close() { sheet.hidden = true; scrim.hidden = true; if (opener) opener.focus(); }
    $$('hp-form').addEventListener('input', hpCheck); $$('hp-form').addEventListener('change', hpCheck); $$('hp-form').addEventListener('submit', function (e) { e.preventDefault(); });
    $$('hp-form').addEventListener('click', function (e) { var b = e.target.closest('.seg button'); if (!b) return; b.parentNode.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); hpCheck(); });
    $$('hp-who2').addEventListener('change', function () { $$('hp-amt').value = alloc($$('hp-who2').value).rem || ''; $$('hp-over').checked = false; hpCheck(); });
    $$('hp-x').addEventListener('click', close); $$('hp-cancel').addEventListener('click', close); scrim.addEventListener('click', close);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !sheet.hidden) close(); });
    $$('hk-pay').addEventListener('click', function () { open('new'); });
    view.addEventListener('click', function (e) {
      var a = e.target.closest('[data-pay]'), f = e.target.closest('[data-fix]');
      if (a) open('new', a.getAttribute('data-pay')); else if (f) open('fix', null, +f.getAttribute('data-fix'));
    });
    $$('hp-ok').addEventListener('click', function () {
      if ($$('hp-ok').disabled) return;
      if (mode === 'new') { var c = $$('hp-who2').value, amt = num('hp-amt'); addPay(c, $$('hp-d').value, amt, segV('hp-m'), $$('hp-note').value.trim()); close(); render(); toast(c + ' için ' + money(amt) + ' ödeme kaydedildi'); }
      else { var p = PAYS.filter(function (x) { return x.id === fixId; })[0], dec = segV('hp-k') === 'Azalt', f = num('hp-famt'); addPay(p.c, TODAY, dec ? -f : f, p.m, $$('hp-why').value.trim(), 'c', p.id); close(); render(); toast('Düzeltme kaydedildi, özgün ödeme korunur'); }
    });

    /* Stüdyo > Anlaşmalar */
    var agCur = null, agM = 'seans', agBase = '';
    function weekly(c, a) { return SHARED.calAll().filter(function (o) { return !o.x && SHARED.coachOf(o.s) === c; }).reduce(function (t, o) { return t + calc(a, o.s.l, o.s.h); }, 0); }
    function agRender() {
      var b = $$('ag-body'); if (!b) return;
      b.innerHTML = IN.filter(function (e) { return e.on; }).map(function (e) {
        var c = sh(e.n), g = agrAt(c, TODAY), pend = (AGR[c] || []).filter(function (a) { return a.from > TODAY; })[0];
        return '<tr tabindex="0" data-c="' + esc(c) + '"><td><span class="nm"><span>' + esc(e.n) + '</span><small>' + c + '</small></span></td><td>' + (g ? MODEL[g.model] : '<span class="muted">Anlaşma yok</span>') + '</td><td class="tnum">' + (g ? rate(g) : '-') + '</td><td class="tnum">' + (g ? fd(g.from) + (pend ? '<span class="pk-sub-p">Sonraki: ' + fd(pend.from) + ', v' + pend.v + '</span>' : '') : '-') + '</td><td class="tnum">' + (g ? 'v' + g.v : '-') + '</td><td class="r tnum">' + (g ? money(weekly(c, g)) : '-') + '</td></tr>';
      }).join('');
    }
    var ag = (function () { var sh2 = $$('ag-sheet'), sc = $$('ag-scrim'), op = null; function cl() { sh2.hidden = true; sc.hidden = true; if (op) op.focus(); } $$('ag-x').addEventListener('click', cl); $$('ag-cancel').addEventListener('click', cl); sc.addEventListener('click', cl); document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !sh2.hidden) cl(); }); return { open: function () { op = document.activeElement; sh2.hidden = false; sc.hidden = false; }, close: cl }; })();
    function agDraft() { return { v: 0, from: $$('ag-from').value, model: agM, amt: num('ag-amt'), min: agM === 'katilim' ? num('ag-min') : 0, note: $$('ag-note').value.trim() }; }
    function agSig(a) { return [a.model, a.amt, a.min].join('~'); }
    function agCheck() {
      var d = agDraft(), g = agrAt(agCur, TODAY), err = '', ch = !g || agSig(d) !== agSig(g);
      $$('ag-al').innerHTML = (agM === 'seans' ? 'Seans ücreti' : agM === 'saat' ? 'Saat ücreti' : 'Katılımcı başı ücret') + '<span class="hint">₺</span>'; $$('ag-min-w').hidden = agM !== 'katilim';
      $$('ag-mh').textContent = agM === 'seans' ? 'Süreye ve katılıma bakmadan sabit tutar.' : agM === 'saat' ? 'Seans süresi × saat ücreti.' : 'Katılımcı sayısı × ücret, asgari tutarın altına düşmez.';
      if (!(d.amt > 0)) err = ''; else if (!d.from || d.from < TODAY) err = 'Yürürlük tarihi bugünden önce olamaz.'; else if (agM === 'katilim' && !(d.min > 0)) err = 'Asgari ücreti yaz.';
      var cnt = LINES.filter(function (x) { return x.c === agCur; }).length, wk0 = g ? weekly(agCur, g) : 0, wk1 = d.amt > 0 ? weekly(agCur, d) : 0;
      $$('ag-eff').innerHTML = [['Yeni sürüm', 'v' + ((AGR[agCur] || []).length + 1), 'Yürürlük ' + (d.from ? fd(d.from) : '-') + '. Bu tarihten sonra kapanan seanslar yeni sürümle hesaplanır.'], ['Mevcut hakediş', cnt + ' satır', 'Değişmez, eski sürümle kalır.'], ['Haftalık tahmin', money(wk0) + ' → ' + money(wk1), 'Bu haftanın seanslarına göre, katılım mevcut doluluktan alınır.']].map(function (r) { return '<li><span class="row-l"><span>' + r[0] + '</span><b class="tnum">' + esc(r[1]) + '</b></span><span class="ch">' + esc(r[2]) + '</span></li>'; }).join('');
      var er = $$('ag-err'); er.hidden = !err; er.querySelector('span').textContent = err; $$('ag-save').disabled = !!err || !(d.amt > 0) || !ch || !$$('ag-ok').checked;
    }
    function agOpen(c) {
      agCur = c; var g = agrAt(c, TODAY), full = SHARED.coachFull(c);
      $$('ag-title').textContent = full; $$('ag-sub').textContent = g ? 'Güncel: ' + MODEL[g.model] + ', ' + rate(g) + ' (v' + g.v + ')' : 'Henüz anlaşma yok.';
      agM = g ? g.model : 'seans'; $$('ag-model').querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-m') === agM)); });
      $$('ag-amt').value = g ? g.amt : ''; $$('ag-min').value = g && g.min ? g.min : ''; $$('ag-from').value = '2026-11-05'; $$('ag-note').value = ''; $$('ag-ok').checked = false;
      $$('ag-hist').innerHTML = (AGR[c] || []).slice().reverse().map(function (a) { return '<li><div class="row-l"><span><b>v' + a.v + '</b> · ' + MODEL[a.model] + ', ' + rate(a) + '</span><span class="tnum muted">' + fd(a.from) + '</span></div><span class="ch">' + esc(a.note || '-') + '</span></li>'; }).join('') || '<li><span class="ch">Sürüm yok.</span></li>';
      ag.open(); agCheck(); $$('ag-amt').focus();
    }
    $$('ag-model').addEventListener('click', function (e) { var b = e.target.closest('button[data-m]'); if (!b) return; agM = b.getAttribute('data-m'); $$('ag-model').querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); agCheck(); });
    $$('ag-form').addEventListener('input', agCheck); $$('ag-form').addEventListener('change', agCheck); $$('ag-form').addEventListener('submit', function (e) { e.preventDefault(); });
    $$('ag-save').addEventListener('click', function () {
      if ($$('ag-save').disabled) return; var d = agDraft(); d.v = (AGR[agCur] || []).length + 1; (AGR[agCur] = AGR[agCur] || []).push(d); ag.close(); agRender(); render(); toast(agCur + ' anlaşması v' + d.v + ' yayınlandı, ' + fd(d.from) + ' tarihinde başlar');
    });
    $$('ag-body').addEventListener('click', function (e) { var tr = e.target.closest('tr[data-c]'); if (tr) agOpen(tr.getAttribute('data-c')); });
    $$('ag-body').addEventListener('keydown', function (e) { var tr = e.target.closest('tr[data-c]'); if (tr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); agOpen(tr.getAttribute('data-c')); } });

    /* Seans detayı: yoklama kapanışında hakediş etkisi */
    var f = { c: 'Elif K.', t: 'Arjantin tango teknik', l: 60, att: 8 }, fa = agrAt(f.c, TODAY);
    if ($$('att-hint')) $$('att-hint').textContent = 'Yoklamayı kapatınca hak tüketimi uygulanır. Hakediş: ' + f.c + ' için ' + money(calc(fa, f.l, f.att)) + ' oluşur.';
    SHARED.hkClose = function () {
      var a = agrAt(f.c, TODAY); LINES.push({ id: lid++, d: TODAY, t: f.t, c: f.c, l: f.l, att: f.att, v: a.v, basis: basis(a, f.l, f.att), amt: calc(a, f.l, f.att), live: true });
      $$('att-note').textContent = 'Yoklama kapatıldı. Hakediş: ' + f.c + ' ' + money(calc(a, f.l, f.att)) + ' oluştu.'; render(); agRender();
    };
    SHARED.hkRefresh = function () { agRender(); render(); };
    SHARED.hkOf = function (c) { var a = alloc(c), g = agrAt(c, TODAY); return { rows: a.rows, total: a.total, paid: a.paid, rem: a.rem, pays: PAYS.filter(function (p) { return p.c === c; }), agr: g, rate: rate(g) }; };
    SHARED.hkCalc = function (c, l, att) { var g = agrAt(c, TODAY); return { amt: calc(g, l, att), basis: basis(g, l, att) }; };
    SHARED.hkAdd = function (c, d, t, l, att) { var g = agrAt(c, d); LINES.push({ id: lid++, d: d, t: t, c: c, l: l, att: att, v: g ? g.v : 0, basis: basis(g, l, att), amt: calc(g, l, att), live: true }); render(); agRender(); };
    window.addEventListener('hashchange', function () { if (location.hash === '#hakedis' || location.hash === '#studyo') { agRender(); render(); } });
    render(); agRender(); swap(view); swap($$('hp-sheet')); swap($$('ag-sheet'));
  })();

  /* ---------- Belgeler (kurgusal veri; aktif üye sayısı Üyeler ile tutarlı: 10) ---------- */
  (function () {
    var $$ = function (id) { return document.getElementById(id); };
    var view = document.querySelector('[data-view="belgeler"]');
    var M = ['Cem Demir', 'Selin Aksoy', 'Burak Kaya', 'Merve Tan', 'Onur Çelik', 'Derya Sönmez', 'Ece Mutlu', 'Kerem Zorlu', 'Nehir Gür', 'Tolga Yıldız'];
    var DOCS = [
      { id: 1, n: 'Kayıt ve katılım şartları', v: 3, need: ['Satış', 'Rezervasyon'], date: '12 Eki', st: 'on', hist: [[3, '12 Eki 2026', 'Yeniden kabul istendi'], [2, '3 Ağu 2026', 'Yeniden kabul istenmedi'], [1, '2 Haz 2026', 'İlk yayın']] },
      { id: 2, n: 'Sağlık ve sorumluluk beyanı', v: 2, need: ['Rezervasyon'], date: '1 Eyl', st: 'on', hist: [[2, '1 Eyl 2026', 'Yeniden kabul istendi'], [1, '2 Haz 2026', 'İlk yayın']] },
      { id: 3, n: 'İptal ve telafi koşulları', v: 1, need: ['Satış'], date: '15 Eyl', st: 'on', hist: [[1, '15 Eyl 2026', 'İlk yayın']] },
      { id: 4, n: 'Atölye katılım şartları', v: 1, need: ['Rezervasyon'], date: '', st: 'draft', file: 'atolye-sartlari.pdf · 142 KB', hist: [] }
    ];
    var ACC = {
      1: ['ok', 'ok', 'ok', 'ok', 'old', 'ok', 'ok', 'none', 'ok', 'ok'],
      2: ['ok', 'ok', 'old', 'ok', 'ok', 'ok', 'old', 'ok', 'none', 'ok'],
      3: ['ok', 'ok', 'ok', 'ok', 'ok', 'ok', 'ok', 'ok', 'ok', 'ok'],
      4: ['none', 'none', 'none', 'none', 'none', 'none', 'none', 'none', 'none', 'none']
    };
    var nextId = 5, lastPub = '12 Eki', tab = 'docs', fil = 'pend', cur = null, mode = 'new', fileInfo = null, shown = false;
    function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
    function ini(n) { var p = n.split(' '); return (p[0][0] + p[1][0]).toLocaleUpperCase('tr'); }
    function okN(d) { return ACC[d.id].filter(function (x) { return x === 'ok'; }).length; }
    function live() { return DOCS.filter(function (d) { return d.st === 'on'; }); }
    function pendingRows() {
      var r = [];
      live().forEach(function (d) { ACC[d.id].forEach(function (s, i) { if (s !== 'ok') r.push({ d: d, i: i, s: s }); }); });
      return r.sort(function (a, b) { return a.i - b.i || a.d.id - b.d.id; });
    }
    function render() {
      var lv = live(), pm = {}; pendingRows().forEach(function (r) { pm[r.i] = 1; });
      var pn = Object.keys(pm).length;
      $$('bd-kpi').innerHTML = [['Yayında belge', String(lv.length), 'sürümlü'], ['Taslak', String(DOCS.length - lv.length), 'yayınlanmadı'], ['Kabul bekleyen üye', pn + '<small> / 10</small>', 'en az bir belge'], ['Son yayın', lastPub, 'yeni sürüm']].map(function (k) {
        return '<div class="card kpi"><span class="l">' + k[0] + '</span><b class="tnum">' + k[1] + '</b><span class="sub">' + k[2] + '</span></div>';
      }).join('');
      $$('bd-pill').textContent = String(pendingRows().length);
      $$('bd-body').innerHTML = DOCS.map(function (d) {
        var on = d.st === 'on';
        return '<tr tabindex="0" data-id="' + d.id + '"><td><span class="bd-name"><i data-i="filetext"></i><span class="nm"><span>' + esc(d.n) + '</span></span></span></td>' +
          '<td>' + d.need.map(function (n) { return '<span class="badge soft" style="margin:0 4px 4px 0">' + n + '</span>'; }).join('') + '</td>' +
          '<td class="tnum">v' + d.v + '</td><td class="muted tnum">' + (d.date || '-') + '</td>' +
          '<td>' + (on ? '<span class="minibar"><span class="bar"><i style="width:' + okN(d) * 10 + '%"></i></span><span class="tnum">' + okN(d) + ' / 10</span></span>' : '<span class="muted">-</span>') + '</td>' +
          '<td>' + (on ? '<span class="badge">Yayında</span>' : '<span class="badge soft">Taslak</span>') + '</td></tr>';
      }).join('');
      $$('bd-count').textContent = lv.length + ' belge yayında, ' + (DOCS.length - lv.length) + ' taslak';
      var rows = [];
      if (fil === 'pend') rows = pendingRows(); else live().forEach(function (d) { M.forEach(function (n, i) { rows.push({ d: d, i: i, s: ACC[d.id][i] }); }); });
      if (fil === 'all') rows.sort(function (a, b) { return a.i - b.i || a.d.id - b.d.id; });
      $$('bd-acc').innerHTML = rows.map(function (r) {
        var b = r.s === 'ok' ? '<span class="badge ok">' + '<i data-i="check"></i>' + 'Kabul etti</span>' : r.s === 'old' ? '<span class="badge soft">Eski sürümü kabul etti (v' + (r.d.v - 1) + ')</span>' : '<span class="badge bad">Bekliyor</span>';
        return '<tr><td><span class="who"><span class="avatar sm">' + ini(M[r.i]) + '</span>' + M[r.i] + '</span></td><td>' + esc(r.d.n) + '</td><td class="tnum">v' + r.d.v + '</td><td>' + b + '</td></tr>';
      }).join('') || '<tr><td colspan="4" class="muted" style="padding:32px 0;text-align:center">Kabul bekleyen üye yok.</td></tr>';
      $$('bd-acc-count').textContent = rows.length + ' kayıt gösteriliyor';
      swap(view);
    }

    /* Çekmece */
    var sheet = $$('bd-sheet'), scrim = $$('bd-scrim'), opener = null;
    function needs() { return Array.prototype.slice.call($$('bd-need').querySelectorAll('input:checked')).map(function (i) { return i.value; }); }
    function renew() { return mode === 'version' && document.querySelector('input[name="bd-r"]:checked').value === 'yes'; }
    function valid() { return !!($$('bd-ad').value.trim() && fileInfo && needs().length); }
    function sync() {
      $$('bd-show').disabled = !valid(); $$('bd-show').hidden = shown;
      $$('bd-pub').hidden = !shown; $$('bd-pub').disabled = !$$('bd-ok').checked;
      $$('bd-prev').hidden = !shown;
    }
    function invalidate() {
      if (!shown) return;
      shown = false; $$('bd-ok').checked = false; $$('bd-stale').hidden = false; sync();
    }
    function preview() {
      var n = needs(), cnt, sub;
      if (mode === 'version') {
        var pend = ACC[cur.id].filter(function (x) { return x !== 'ok'; }).length;
        cnt = renew() ? 10 : pend;
        sub = renew() ? 'Eski sürümü kabul etmiş üyeler de yeniden kabul eder.' : 'Yalnızca henüz kabul etmeyenler.';
      } else { cnt = 10; sub = 'Tüm aktif üyeler ilk kabulü verir.'; }
      var rez = n.indexOf('Rezervasyon') > -1 || n.indexOf('Yoklama') > -1;
      $$('bd-prev-l').innerHTML =
        '<li><span class="row-l"><span>Kabul etmesi gereken üye</span><b class="tnum">' + cnt + ' / 10</b></span><span class="ch">' + sub + '</span></li>' +
        '<li><span class="row-l"><span>Korunan kesin rezervasyon</span><b class="tnum">' + (rez ? '22' : '0') + '</b></span><span class="ch">' + (rez ? 'Bugünkü 3 seans. Mevcut rezervasyonlar iptal edilmez, üye bir sonraki işleminde kabul eder.' : 'Rezervasyonlar etkilenmez, yalnızca ' + n.join(' ve ').toLocaleLowerCase('tr') + ' sırasında kabul istenir.') + '</span></li>' +
        '<li><span class="row-l"><span>Önizleme geçerliliği</span><b class="tnum">14:35</b></span><span class="ch">Süre dolarsa etkiyi yeniden göster. Kabulü yönetici adına veremez, üye kendisi verir.</span></li>';
      shown = true; $$('bd-ok').checked = false; $$('bd-stale').hidden = true; sync();
    }
    function open(d, m) {
      opener = document.activeElement; cur = d || null; mode = m; shown = false; fileInfo = d && m === 'draft' ? d.file : null;
      $$('bd-title').textContent = m === 'new' ? 'Belge yükle' : d.n;
      $$('bd-sub').textContent = m === 'new' ? 'Yeni belge ilk sürüm olarak yayınlanır.' : m === 'draft' ? 'Taslak, henüz yayınlanmadı.' : 'Şu an v' + d.v + ' yayında. Yeni sürüm yüklersen geçmiş sürümler korunur.';
      $$('bd-hist-wrap').hidden = m !== 'version';
      $$('bd-hist').innerHTML = m === 'version' ? d.hist.map(function (h) { return '<li><span class="row-l"><b>v' + h[0] + '</b><span class="tnum muted">' + h[1] + '</span></span><span class="ch">' + h[2] + '</span></li>'; }).join('') : '';
      $$('bd-renew').hidden = m !== 'version';
      document.querySelector('input[name="bd-r"][value="yes"]').checked = true;
      $$('bd-ad').value = d ? d.n : ''; $$('bd-ad').readOnly = m === 'version'; $$('bd-ad-h').textContent = m === 'version' ? 'Yeni sürümde ad değişmez' : '';
      $$('bd-dosya').value = ''; $$('bd-file-info').textContent = fileInfo || '';
      $$('bd-need').querySelectorAll('input').forEach(function (i) { i.checked = !!d && d.need.indexOf(i.value) > -1; });
      $$('bd-err').hidden = true; $$('bd-stale').hidden = true; $$('bd-ok').checked = false;
      sync(); sheet.hidden = false; scrim.hidden = false; (m === 'version' ? $$('bd-dosya') : $$('bd-ad')).focus();
    }
    function close() { sheet.hidden = true; scrim.hidden = true; if (opener) opener.focus(); }
    function err(t) { $$('bd-err').hidden = !t; $$('bd-err').querySelector('span').textContent = t || ''; }
    $$('bd-dosya').addEventListener('change', function () {
      var f = this.files && this.files[0]; fileInfo = null; err('');
      if (f) {
        if (!/\.(pdf|txt)$/i.test(f.name)) err('Yalnızca PDF ya da düz metin (.txt) yüklenebilir.');
        else if (f.size > 2 * 1024 * 1024) err('Dosya 2 MiB sınırını aşıyor.');
        else {
          fileInfo = f.name + ' · ' + Math.max(1, Math.round(f.size / 1024)) + ' KB';
          if (!$$('bd-ad').value.trim()) { var b = f.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '); $$('bd-ad').value = b.charAt(0).toLocaleUpperCase('tr') + b.slice(1); }
        }
      }
      $$('bd-file-info').textContent = fileInfo || '';
      invalidate(); sync();
    });
    $$('bd-form').addEventListener('input', function (e) { if (e.target.id !== 'bd-ok' && e.target.id !== 'bd-dosya') invalidate(); sync(); });
    $$('bd-form').addEventListener('change', function (e) { if (e.target.id !== 'bd-ok' && e.target.id !== 'bd-dosya') invalidate(); sync(); });
    $$('bd-form').addEventListener('submit', function (e) { e.preventDefault(); });
    $$('bd-show').addEventListener('click', function () { if (!$$('bd-show').disabled) preview(); });
    $$('bd-pub').addEventListener('click', function () {
      if ($$('bd-pub').disabled) return;
      var n = needs(), t = $$('bd-ad').value.trim(), msg;
      if (mode === 'version') {
        var rn = renew(); cur.v++; cur.date = '4 Kas'; cur.need = n; cur.hist.unshift([cur.v, '4 Kas 2026', rn ? 'Yeniden kabul istendi' : 'Yeniden kabul istenmedi']);
        if (rn) ACC[cur.id] = ACC[cur.id].map(function (x) { return x === 'ok' ? 'old' : x; });
        msg = cur.n + ' v' + cur.v + ' yayınlandı';
      } else if (mode === 'draft') {
        cur.n = t; cur.need = n; cur.st = 'on'; cur.date = '4 Kas'; cur.hist = [[1, '4 Kas 2026', 'İlk yayın']]; msg = t + ' yayınlandı';
      } else {
        var id = nextId++; DOCS.push({ id: id, n: t, v: 1, need: n, date: '4 Kas', st: 'on', hist: [[1, '4 Kas 2026', 'İlk yayın']] });
        ACC[id] = M.map(function () { return 'none'; }); msg = t + ' yayınlandı';
      }
      lastPub = '4 Kas'; close(); render(); toast(msg);
    });
    $$('bd-add').addEventListener('click', function () { open(null, 'new'); });
    $$('bd-x').addEventListener('click', close); $$('bd-cancel').addEventListener('click', close); scrim.addEventListener('click', close);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !sheet.hidden) close(); });
    function rowOpen(e) {
      var tr = e.target.closest('tr[data-id]'); if (!tr) return;
      var d = DOCS.filter(function (x) { return x.id === +tr.getAttribute('data-id'); })[0]; open(d, d.st === 'on' ? 'version' : 'draft');
    }
    $$('bd-body').addEventListener('click', rowOpen);
    $$('bd-body').addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); rowOpen(e); } });
    view.querySelectorAll('[data-bt]').forEach(function (b) {
      b.addEventListener('click', function () {
        tab = b.getAttribute('data-bt');
        view.querySelectorAll('[data-bt]').forEach(function (x) { x.setAttribute('aria-selected', String(x === b)); });
        view.querySelectorAll('[data-bpanel]').forEach(function (p) { p.hidden = p.getAttribute('data-bpanel') !== tab; });
        $$('bd-filter').hidden = tab !== 'acc';
      });
    });
    $$('bd-filter').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-f]'); if (!b) return; fil = b.getAttribute('data-f');
      $$('bd-filter').querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); render();
    });
    SHARED.docsOf = function (name) { var i = M.indexOf(name); if (i < 0) return []; return live().map(function (d) { return { id: d.id, n: d.n, v: d.v, need: d.need, s: ACC[d.id][i], date: d.date }; }); };
    SHARED.docAccept = function (name, id) { var i = M.indexOf(name); if (i < 0 || !ACC[id]) return; ACC[id][i] = 'ok'; render(); };
    SHARED.pendingDocs = function (name, op) {
      var i = M.indexOf(name); if (i < 0) return [];
      return live().filter(function (d) { return d.need.indexOf(op) > -1 && ACC[d.id][i] !== 'ok'; }).map(function (d) { return d.n + ' v' + d.v; });
    };
    render(); swap(sheet);
  })();

  /* ---------- Özel ders talepleri (kurgusal veri; üyeler, belgeler ve Stüdyo ile tutarlı) ---------- */
  (function () {
    var $$ = function (id) { return document.getElementById(id); };
    var view = document.querySelector('[data-view="talepler"]');
    var R = [
      { id: 1, n: 'Selin Aksoy', a: 'SA', day: 'Cum 6 Kas', t: '16:00 - 17:00', coach: 'Deniz Y.', asked: '3 Kas', st: 'pend', note: 'Tango figürleri için bire bir ders almak istiyorum.', hak: '8 derslik paket, 5 hak kaldı', debt: 0, cok: true },
      { id: 2, n: 'Derya Sönmez', a: 'DS', day: 'Cum 6 Kas', t: '19:30 - 20:30', coach: 'Deniz Y.', asked: '3 Kas', st: 'pend', note: 'İş çıkışı ancak bu saate gelebiliyorum.', hak: '12 derslik paket, 7 hak kaldı', debt: 0, cok: false, cwhy: 'Deniz Y. bu saatte uygun değil (uygunluk 10:00 - 18:00).' },
      { id: 3, n: 'Kerem Zorlu', a: 'KZ', day: 'Pzt 9 Kas', t: '17:00 - 18:00', coach: 'Deniz Y.', asked: '2 Kas', st: 'pend', note: '', hak: '8 derslik paket, 4 hak kaldı', debt: 450, cok: true },
      { id: 4, n: 'Merve Tan', a: 'MT', day: 'Cmt 7 Kas', t: '11:00 - 12:00', coach: 'Deniz Y.', asked: '2 Kas', st: 'alt', alt: 'Cmt 7 Kas, 12:00 - 13:00', until: '6 Kas 18:00', note: 'Cumartesi sabahı olabilir mi?', hak: 'Aylık sınırsız', debt: 0, cok: true },
      { id: 5, n: 'Cem Demir', a: 'CD', day: 'Pzt 9 Kas', t: '10:00 - 11:00', coach: 'Deniz Y.', asked: '31 Eki', st: 'ok', res: 'Özel ders seansı oluşturuldu: Pzt 9 Kas, 10:00 - 11:00, Stüdyo C.', note: 'Sahne öncesi çalışma.', hak: 'Aylık sınırsız', debt: 0, cok: true },
      { id: 6, n: 'Nehir Gür', a: 'NG', day: 'Per 5 Kas', t: '15:00 - 16:00', coach: 'Deniz Y.', asked: '30 Eki', st: 'no', res: 'Reddedildi: Eğitmen o gün izinli.', note: '', hak: '12 derslik paket, 10 hak kaldı', debt: 0, cok: true },
      { id: 7, n: 'Tolga Yıldız', a: 'TY', day: 'Sal 3 Kas', t: '18:00 - 19:00', coach: 'Deniz Y.', asked: '29 Eki', st: 'wd', res: 'Üye talebi geri çekti.', note: '', hak: '8 derslik paket, 6 hak kaldı', debt: 0, cok: true }
    ];
    var BD = { pend: '<span class="badge">Bekliyor</span>', alt: '<span class="badge soft">Üyenin yanıtı bekleniyor</span>', ok: '<span class="badge ok"><i data-i="check"></i>Onaylandı</span>', no: '<span class="badge bad">Reddedildi</span>', wd: '<span class="badge soft">Geri çekildi</span>' };
    var fil = 'pend', cur = null, step = 'view', opener = null;
    function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
    function n(st) { return R.filter(function (x) { return x.st === st; }).length; }
    function elig(r) {
      var miss = SHARED.pendingDocs ? SHARED.pendingDocs(r.n, 'Rezervasyon') : [], rows = [];
      rows.push(r.cok ? ['Eğitmen', 'Uygun', r.coach + ' bu saatte boş.', true] : ['Eğitmen', 'Uygun değil', r.cwhy, false]);
      rows.push(['Salon', 'Stüdyo C boş', 'Özel ders odası, 2 kişi.', true]);
      rows.push(r.debt ? ['Borç', TLs(r.debt) + ' açık', 'Tahsilat alınana kadar onaylanamaz. Negatif limit tanımlanırsa devam edilebilir.', false] : ['Hak', r.hak, 'Özel ders için geçerli.', true]);
      rows.push(miss.length ? ['Belge', 'Kabul bekliyor', miss.join(', ') + '. Üye kendisi kabul eder.', false] : ['Belge', 'Tamam', 'Gerekli belgeler kabul edilmiş.', true]);
      return rows;
    }
    function TLs(v) { return '₺' + String(v).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
    function render() {
      var rows = R.filter(function (r) { return fil === 'all' || (fil === 'done' ? (r.st === 'ok' || r.st === 'no' || r.st === 'wd') : r.st === fil); });
      $$('tl-body').innerHTML = rows.map(function (r) {
        return '<tr tabindex="0" data-id="' + r.id + '"><td><span class="who"><span class="avatar sm">' + r.a + '</span><span class="nm"><span>' + r.n + '</span><small>' + r.hak + '</small></span></span></td><td class="tnum">' + r.day + '<span class="pk-sub-p">' + r.t + '</span></td><td class="muted">' + r.coach + '</td><td class="muted tnum">' + r.asked + '</td><td>' + BD[r.st] + '</td></tr>';
      }).join('') || '<tr><td colspan="5" class="muted" style="padding:32px 0;text-align:center">Bu süzgece uygun talep yok.</td></tr>';
      $$('tl-count').textContent = rows.length + ' talep gösteriliyor';
      $$('tl-kpi').innerHTML = [['Bekleyen', n('pend'), 'karar bekliyor'], ['Alternatif önerildi', n('alt'), 'üyenin yanıtı bekleniyor'], ['Onaylanan', n('ok'), 'seans oluşturuldu'], ['Reddedilen', n('no'), 'gerekçeyle bildirildi']].map(function (k) {
        return '<div class="card kpi"><span class="l">' + k[0] + '</span><b class="tnum">' + k[1] + '</b><span class="sub">' + k[2] + '</span></div>';
      }).join('');
      var c = document.querySelector('[data-route="talepler"] .count'); if (c) { c.textContent = n('pend'); c.hidden = !n('pend'); }
      swap(view);
    }
    var sheet = $$('tl-sheet'), scrim = $$('tl-scrim');
    function blockers(r) { return elig(r).filter(function (x) { return !x[3]; }); }
    function paint() {
      var r = cur, pend = r.st === 'pend';
      ['view', 'reject', 'alt', 'ok'].forEach(function (p) { $$('tl-p-' + p).hidden = p !== step; });
      var f = '', t = { view: r.n + ' özel ders talebi', reject: 'Talebi reddet', alt: 'Alternatif öner', ok: 'Talebi onayla' }[step];
      $$('tl-title').textContent = t; $$('tl-sub').textContent = r.day + ', ' + r.t + ' · ' + r.coach;
      if (step === 'view') {
        $$('tl-state').innerHTML = BD[r.st] + (r.st === 'alt' ? '<p class="muted" style="margin-top:8px">Önerdiğin saat: ' + r.alt + '. Üye ' + r.until + '\'e kadar yanıtlamazsa talep sona erer.</p>' : r.res ? '<p class="muted" style="margin-top:8px">' + esc(r.res) + '</p>' : '<p class="muted" style="margin-top:8px">Bu bir talep, kesin rezervasyon değil. Onaylayınca seans oluşur.</p>');
        $$('tl-note').textContent = r.note || 'Üye not bırakmadı.'; $$('tl-note').hidden = false;
        $$('tl-elig').innerHTML = elig(r).map(function (x) { return '<li><span class="row-l"><span>' + x[0] + '</span><b class="tnum ' + (x[3] ? '' : 'debt') + '">' + esc(x[1]) + '</b></span><span class="ch">' + esc(x[2]) + '</span></li>'; }).join('');
        var b = blockers(r);
        f = pend ? '<button type="button" class="btn ghost" id="tl-reject" style="margin-right:auto;color:var(--destructive)">Reddet</button><button type="button" class="btn outline" id="tl-alt">Alternatif öner</button><button type="button" class="btn" id="tl-ok"' + (b.length ? ' disabled title="' + esc(b[0][2]) + '"' : '') + '>Onayla</button>' : '<button type="button" class="btn outline" id="tl-close">Kapat</button>';
        if (pend && b.length) $$('tl-state').innerHTML += '<p class="note" style="color:var(--destructive)">Onaylanamıyor: ' + esc(b[0][0].toLocaleLowerCase('tr')) + ' engeli var. Alternatif öner ya da reddet.</p>';
      } else if (step === 'reject') {
        $$('tl-why').value = ''; f = '<button type="button" class="btn outline" id="tl-back">Geri</button><button type="button" class="btn" id="tl-send" disabled>Reddi gönder</button>';
      } else if (step === 'alt') {
        var o = ''; for (var h = 10; h <= 17; h++) o += '<option' + (h === 12 ? ' selected' : '') + '>' + h + ':00</option>'; $$('tl-at').innerHTML = o; $$('tl-an').value = '';
        f = '<button type="button" class="btn outline" id="tl-back">Geri</button><button type="button" class="btn" id="tl-send">Alternatifi gönder</button>'; altEff();
      } else {
        var rows = [['Seans', 'Özel ders', r.day + ', ' + r.t + ', Stüdyo C, ' + r.coach], ['Hak', r.hak.indexOf('sınırsız') > -1 ? 'Sınırsız' : '1 ders ayrılır', 'Yoklama kapanınca tüketilir.'], ['Üye', 'Bildirim gider', 'Kesin rezervasyon oluşur.']];
        $$('tl-ok-l').innerHTML = rows.map(function (x) { return '<li><span class="row-l"><span>' + x[0] + '</span><b class="tnum">' + x[1] + '</b></span><span class="ch">' + esc(x[2]) + '</span></li>'; }).join('');
        f = '<button type="button" class="btn outline" id="tl-back">Geri</button><button type="button" class="btn" id="tl-send">Onayla ve seans oluştur</button>';
      }
      $$('tl-foot').innerHTML = f;
    }
    function altEff() {
      var h = +$$('tl-at').value.split(':')[0], d = $$('tl-ad').value, ok = !!d && d >= '2026-11-05';
      $$('tl-alt-eff').textContent = ok ? 'Üye ' + d.split('-')[2] + '.' + d.split('-')[1] + '.2026 ' + h + ':00 - ' + (h + 1) + ':00 önerisini görür. Kabul ederse seans oluşur.' : 'Geçmiş bir gün seçilemez.';
      var s = $$('tl-send'); if (s) s.disabled = !ok;
    }
    function open(r) { opener = document.activeElement; cur = r; step = 'view'; paint(); sheet.hidden = false; scrim.hidden = false; $$('tl-x').focus(); }
    function close() { sheet.hidden = true; scrim.hidden = true; if (opener) opener.focus(); }
    $$('tl-foot').addEventListener('click', function (e) {
      var id = e.target.id; if (!id || e.target.disabled) return;
      if (id === 'tl-reject') { step = 'reject'; paint(); $$('tl-why').focus(); }
      else if (id === 'tl-alt') { step = 'alt'; paint(); }
      else if (id === 'tl-ok') { step = 'ok'; paint(); }
      else if (id === 'tl-back') { step = 'view'; paint(); }
      else if (id === 'tl-close') close();
      else if (id === 'tl-send') {
        var r = cur;
        if (step === 'reject') { r.st = 'no'; r.res = 'Reddedildi: ' + $$('tl-why').value.trim(); close(); render(); toast('Talep reddedildi, üyeye iletildi'); }
        else if (step === 'alt') { var d = $$('tl-ad').value.split('-'), h = +$$('tl-at').value.split(':')[0]; r.st = 'alt'; r.alt = d[2] + '.' + d[1] + ' ' + h + ':00 - ' + (h + 1) + ':00'; r.until = '2 gün içinde'; close(); render(); toast('Alternatif üyeye gönderildi'); }
        else { r.st = 'ok'; r.res = 'Özel ders seansı oluşturuldu: ' + r.day + ', ' + r.t + ', Stüdyo C.'; close(); render(); toast('Talep onaylandı, seans oluşturuldu'); }
      }
    });
    sheet.addEventListener('input', function (e) {
      if (e.target.id === 'tl-why') $$('tl-send').disabled = !e.target.value.trim();
      if (e.target.id === 'tl-ad' || e.target.id === 'tl-at') altEff();
    });
    $$('tl-x').addEventListener('click', close); scrim.addEventListener('click', close);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !sheet.hidden) close(); });
    function rowOpen(e) { var tr = e.target.closest('tr[data-id]'); if (tr) open(R.filter(function (x) { return x.id === +tr.getAttribute('data-id'); })[0]); }
    $$('tl-body').addEventListener('click', rowOpen);
    $$('tl-body').addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); rowOpen(e); } });
    $$('tl-filter').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-f]'); if (!b) return; fil = b.getAttribute('data-f');
      $$('tl-filter').querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); render();
    });
    SHARED.requestCount = function () { return n('pend'); };
    render(); swap(sheet);
  })();

  /* ---------- Üye tarafı: kişi birleştirme, davetler ve hesaplar, adaylar (kurgusal veri; Üyeler, Finans ve Belgeler ile tutarlı) ---------- */
  (function () {
    const g = (id) => document.getElementById(id);
    const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    const BASE = 4; /* Çarşamba 4 Kasım, tüm sayfalarla aynı gün */
    const DOW = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
    const dayName = (n) => DOW[(n - 1) % 7] + ' ' + n + ' Kas';
    const pad = (n) => (n < 10 ? '0' : '') + n;
    const byId = (id) => stu.filter((x) => x.id === id)[0];
    const kpiHtml = (l, v, sub, cls) => '<div class="card kpi"><span class="l">' + l + '</span><b class="tnum ' + (cls || '') + '">' + v + '</b><span class="sub">' + sub + '</span></div>';
    const view = (n) => document.querySelector('[data-view="' + n + '"]');

    /* ---------- Ortak onay diyaloğu ---------- */
    let dlgCb = null, dlgOpener = null;
    function dlgOpen(o) {
      dlgOpener = document.activeElement; dlgCb = o.cb;
      g('uh-dt').textContent = o.t; g('uh-db').innerHTML = o.b;
      g('uh-why-w').hidden = !o.why; g('uh-why').value = '';
      const ok = g('uh-dok'); ok.textContent = o.ok; ok.className = 'btn' + (o.danger ? ' danger' : ''); ok.disabled = !!o.why;
      g('uh-dlg').hidden = false; g('uh-dscrim').hidden = false;
      (o.why ? g('uh-why') : g('uh-dcancel')).focus();
    }
    function dlgClose() { g('uh-dlg').hidden = true; g('uh-dscrim').hidden = true; dlgCb = null; if (dlgOpener && document.contains(dlgOpener)) dlgOpener.focus(); }
    g('uh-why').addEventListener('input', () => { g('uh-dok').disabled = !g('uh-why').value.trim(); });
    g('uh-dcancel').addEventListener('click', dlgClose); g('uh-dscrim').addEventListener('click', dlgClose);
    g('uh-dok').addEventListener('click', () => { if (g('uh-dok').disabled) return; const cb = dlgCb, why = g('uh-why').value.trim(); dlgClose(); if (cb) cb(why); });

    /* ---------- Veri ---------- */
    const LEADS = [
      { id: 1, n: 'Yusuf Arslan', mail: 'yusuf.arslan@ornek.test', tel: '+90 533 100 20 01', src: 'Instagram', int: 'Bachata', st: 'won', next: 'Davet kabulünü bekle', due: 10, owner: 'Ayşe Y.', note: '', hist: [['3 Kas', 'Üyelik daveti gönderildi'], ['31 Eki', 'Deneme dersine geldi: Bachata başlangıç'], ['27 Eki', 'Instagram mesajıyla ulaştı']] },
      { id: 2, n: 'Ceren Baydar', mail: 'ceren.baydar@ornek.test', tel: '+90 533 100 20 02', src: 'Web formu', int: 'Salsa', st: 'won', next: 'Davet kabulünü bekle', due: 4, owner: 'Ayşe Y.', note: '', hist: [['28 Eki', 'Üyelik daveti gönderildi'], ['26 Eki', 'Deneme dersine geldi: Salsa başlangıç'], ['22 Eki', 'Web formunu doldurdu']] },
      { id: 3, n: 'Barış Ekin', mail: 'baris.ekin@ornek.test', tel: '', src: 'Tavsiye', int: 'Tango', st: 'done', next: 'Daveti yeniden gönder', due: 5, owner: 'Elif K.', note: 'Davet süresi doldu, paket fiyatını sormuştu.', hist: [['20 Eki', 'Üyelik daveti gönderildi, süresi doldu'], ['17 Eki', 'Deneme dersine geldi: Arjantin tango teknik']] },
      { id: 4, n: 'Gizem Özkan', mail: 'gizem.ozkan@ornek.test', tel: '+90 533 100 20 04', src: 'Instagram', int: 'Salsa', st: 'new', next: 'Ara, deneme dersi öner', due: 4, owner: 'Ayşe Y.', note: 'Hiç dans etmemiş, grup dersi istiyor.', hist: [['3 Kas', 'Instagram mesajıyla ulaştı']] },
      { id: 5, n: 'Ali Rıza Demir', mail: '', tel: '+90 533 100 20 05', src: 'Yürüyerek', int: 'Tango', st: 'talk', next: 'WhatsApp ile programı gönder', due: 3, owner: 'Elif K.', note: 'Hafta içi akşam gelebiliyor.', hist: [['2 Kas', 'Stüdyoya uğradı, program bırakıldı'], ['1 Kas', 'Yürüyerek geldi']] },
      { id: 6, n: 'Pelin Yaman', mail: 'pelin.yaman@ornek.test', tel: '', src: 'Web formu', int: 'Bachata', st: 'trial', trial: 'Per 5 Kas 19:00 Bachata başlangıç', next: 'Deneme dersi', due: 5, owner: 'Ayşe Y.', note: '', hist: [['2 Kas', 'Deneme dersi planlandı: Per 5 Kas 19:00'], ['30 Eki', 'Web formunu doldurdu']] },
      { id: 7, n: 'Mert Kaplan', mail: 'mert.kaplan@ornek.test', tel: '+90 533 100 20 07', src: 'Tavsiye', int: 'Salsa', st: 'trial', trial: 'Çar 4 Kas 19:00 Salsa başlangıç', next: 'Deneme dersi', due: 4, owner: 'Elif K.', note: 'Cem Demir tavsiye etti.', hist: [['1 Kas', 'Deneme dersi planlandı: Çar 4 Kas 19:00'], ['30 Eki', 'Cem Demir tavsiye etti']] },
      { id: 8, n: 'Sena Türk', mail: 'sena.turk@ornek.test', tel: '+90 533 100 20 08', src: 'Instagram', int: 'Tango', st: 'done', next: 'Paket teklifini gönder', due: 3, owner: 'Ayşe Y.', note: '8 derslik paketle ilgileniyor.', hist: [['1 Kas', 'Deneme dersine geldi: Arjantin tango teknik'], ['28 Eki', 'Deneme dersi planlandı']] },
      { id: 9, n: 'Hakan Şen', mail: 'hakan.sen@ornek.test', tel: '', src: 'Web formu', int: 'Bachata', st: 'lost', lost: 'Fiyat', next: '', due: 0, owner: 'Elif K.', note: '', hist: [['29 Eki', 'Kapandı: Fiyat'], ['24 Eki', 'Web formunu doldurdu']] },
      { id: 10, n: 'Duygu Eren', mail: '', tel: '+90 533 100 20 10', src: 'Instagram', int: 'Salsa', st: 'new', next: 'Ara, deneme dersi öner', due: 5, owner: 'Ayşe Y.', note: '', hist: [['4 Kas', 'Instagram mesajıyla ulaştı']] }
    ];
    LEADS.forEach((l) => { l.a = l.n.split(' ').map((w) => w[0]).slice(0, 2).join('').toLocaleUpperCase('tr'); });
    const ST = { new: 'Yeni', talk: 'İletişimde', trial: 'Deneme planlı', done: 'Deneme yapıldı', won: 'Üye oldu', lost: 'Kaybedildi' };
    const OPEN = ['new', 'talk', 'trial', 'done'];
    const STB = { new: 'badge solid', talk: 'badge', trial: 'badge', done: 'badge', won: 'badge ok', lost: 'badge soft' };
    const SRC = ['Instagram', 'Web formu', 'Tavsiye', 'Yürüyerek', 'Diğer'];
    const INT = ['Bachata', 'Salsa', 'Tango', 'Özel ders', 'Henüz bilmiyor'];
    const TRIALS = [['Çar 4 Kas 18:30 Bachata başlangıç', '3 yer boş'], ['Çar 4 Kas 19:00 Salsa başlangıç', '9 yer boş'], ['Per 5 Kas 19:00 Bachata başlangıç', '4 yer boş'], ['Cum 6 Kas 19:00 Salsa başlangıç', '7 yer boş']];
    const LOSS = ['Fiyat', 'Zamanı uymadı', 'Başka stüdyo', 'Yanıt vermedi', 'Diğer'];

    const INV = [
      { id: 1, mail: 'yusuf.arslan@ornek.test', kind: 'Yeni üye', lead: 1, sent: '3 Kas', exp: 10, st: 'pend', n: 0 },
      { id: 2, mail: 'ceren.baydar@ornek.test', kind: 'Yeni üye', lead: 2, sent: '28 Eki', exp: 4, st: 'pend', n: 2 },
      { id: 3, mail: 'kerem.zorlu@ornek.test', kind: 'Hesap bağlama', who: 'Kerem Zorlu', sid: 8, sent: '1 Kas', exp: 8, st: 'pend', n: 0 },
      { id: 4, mail: 'baris.ekin@ornek.test', kind: 'Yeni üye', lead: 3, sent: '20 Eki', expTxt: '27 Eki', st: 'exp', n: 1 },
      { id: 5, mail: 'tolga.yildiz@ornek.test', kind: 'Yeni üye', who: 'Tolga Yıldız', sent: '12 Eki', expTxt: '19 Eki', acc: '13 Eki', st: 'acc', n: 0 },
      { id: 6, mail: 'selim.ay@ornek.test', kind: 'Yeni üye', sent: '14 Eki', expTxt: '21 Eki', st: 'cx', n: 0 }
    ];
    const ACC = {};
    stu.forEach((s) => { ACC[s.id] = s.id === 8 ? 'invited' : s.id === 11 ? 'none' : 'linked'; });
    const LAST = ['Bugün', 'Dün', '3 gün önce', '2 hafta önce'];
    const lastIn = (s) => (s.id === 10 ? '5 ay önce' : LAST[s.id % 4]);

    /* ======================= Davetler ve hesaplar ======================= */
    let ifil = 'open', afil = 'all', uhTab = 'inv';
    const INVB = { pend: '<span class="badge">Bekliyor</span>', exp: '<span class="badge soft">Süresi doldu</span>', acc: '<span class="badge ok"><i data-i="check"></i>Kabul etti</span>', cx: '<span class="badge soft">İptal edildi</span>' };
    const expText = (i) => (i.exp ? i.exp + ' Kas' : i.expTxt);
    function left(i) {
      if (i.st !== 'pend') return '<span class="muted">-</span>';
      const d = i.exp - BASE;
      return d <= 0 ? '<span class="due-late">Bugün sona eriyor</span>' : '<span>' + d + ' gün kaldı</span>';
    }
    function invCount() { return INV.filter((i) => i.st === 'pend' || i.st === 'exp').length; }
    function uhKpi() {
      const linked = stu.filter((s) => ACC[s.id] === 'linked').length;
      g('uh-kpi').innerHTML =
        kpiHtml('Hesabı bağlı üye', linked + '<small> / ' + stu.length + '</small>', 'Giriş yapabilir') +
        kpiHtml('Bekleyen davet', INV.filter((i) => i.st === 'pend').length, 'Henüz kabul edilmedi') +
        kpiHtml('Süresi dolan', INV.filter((i) => i.st === 'exp').length, 'Yeniden gönderilebilir') +
        kpiHtml('Hesabı olmayan üye', stu.filter((s) => ACC[s.id] !== 'linked').length, 'Bağlama daveti gerekir');
      g('uh-n-inv').textContent = invCount();
      g('uh-n-acc').textContent = stu.filter((s) => ACC[s.id] !== 'linked').length;
    }
    function who(i) {
      if (i.kind === 'Hesap bağlama') return '<span class="nm"><span>' + esc(i.mail) + '</span><small>Hesap bağlama · ' + esc(i.who) + '</small></span>';
      const l = i.lead ? LEADS.filter((x) => x.id === i.lead)[0] : null;
      return '<span class="nm"><span>' + esc(i.mail) + '</span><small>Yeni üye' + (l ? ' · aday: ' + esc(l.n) : i.who ? ' · ' + esc(i.who) : '') + '</small></span>';
    }
    function invRows() {
      const rows = INV.filter((i) => ifil === 'all' || (ifil === 'open') === (i.st === 'pend' || i.st === 'exp'));
      g('uh-ibody').innerHTML = rows.map((i) => {
        const live = i.st === 'pend' || i.st === 'exp', maxed = i.n >= 3;
        return '<tr data-id="' + i.id + '"><td>' + who(i) + '</td><td class="tnum">' + i.sent + (i.n ? '<span class="pk-sub-p">' + i.n + ' kez yeniden gönderildi</span>' : '') + '</td><td class="tnum">' + expText(i) + '<span class="pk-sub-p">' + left(i) + '</span></td><td>' + INVB[i.st] + '</td><td class="act">' +
          (live ? '<span class="uh-act"><button type="button" class="btn ghost sm" data-act="resend"' + (maxed ? ' disabled title="En çok 3 kez yeniden gönderilir"' : '') + '>Yeniden gönder</button><button type="button" class="btn ghost icon sm" data-act="copy" aria-label="Davet bağlantısını kopyala" title="Bağlantıyı kopyala"><i data-i="copy"></i></button><button type="button" class="btn ghost sm" data-act="cancel">İptal et</button></span>' : '') + '</td></tr>';
      }).join('') || '<tr><td colspan="5" class="muted" style="padding:32px 0;text-align:center">Bu süzgece uygun davet yok.</td></tr>';
      swap(g('uh-ibody'));
    }
    const ACB = { linked: '<span class="badge ok"><i data-i="check"></i>Bağlı</span>', invited: '<span class="badge">Davet bekliyor</span>', none: '<span class="badge soft">Hesap yok</span>' };
    function accRows() {
      const q = g('uh-asearch').value.trim().toLocaleLowerCase('tr');
      const rows = stu.filter((s) => s.n.toLocaleLowerCase('tr').indexOf(q) > -1 && (afil === 'all' || (afil === 'linked') === (ACC[s.id] === 'linked')));
      g('uh-abody').innerHTML = rows.map((s) => {
        const a = ACC[s.id];
        const act = a === 'linked' ? '<button type="button" class="btn ghost sm" data-act="unlink">Bağlantıyı kaldır</button>' :
          a === 'invited' ? '<button type="button" class="btn ghost sm" data-act="relink">Daveti yeniden gönder</button>' :
            '<button type="button" class="btn outline sm" data-act="link">Bağlama daveti gönder</button>';
        return '<tr data-sid="' + s.id + '"><td><span class="who"><span class="avatar sm">' + s.a + '</span><span class="nm"><span>' + esc(s.n) + (s.on ? '' : ' <span class="badge soft" style="margin-left:4px">Pasif</span>') + '</span><small>' + esc(s.mail) + '</small></span></span></td><td>' + ACB[a] + '</td><td class="tnum ' + (a === 'linked' ? '' : 'muted') + '">' + (a === 'linked' ? s.joined : '-') + '</td><td class="tnum ' + (a === 'linked' ? '' : 'muted') + '">' + (a === 'linked' ? lastIn(s) : '-') + '</td><td class="act">' + act + '</td></tr>';
      }).join('') || '<tr><td colspan="5" class="muted" style="padding:32px 0;text-align:center">Aramana uygun üye yok.</td></tr>';
      swap(g('uh-abody'));
    }
    function uhRender() { uhKpi(); invRows(); accRows(); }
    function sendInvite(i) { i.sent = '4 Kas'; i.exp = BASE + 7; i.expTxt = ''; i.n += 1; i.st = 'pend'; }
    g('uh-ibody').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-act]'); if (!b || b.disabled) return;
      const i = INV.filter((x) => x.id === +b.closest('tr').getAttribute('data-id'))[0];
      const act = b.getAttribute('data-act');
      if (act === 'resend') { sendInvite(i); uhRender(); toast('Davet ' + i.mail + ' adresine yeniden gönderildi'); }
      else if (act === 'copy') {
        const link = 'https://app.ornek.test/davet/' + (1000 + i.id * 37);
        const done = () => toast('Davet bağlantısı kopyalandı');
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(link).then(done, () => toast('Kopyalanamadı. Bağlantı: ' + link)); else toast('Bağlantı: ' + link);
      } else if (act === 'cancel') {
        dlgOpen({ t: 'Daveti iptal et', b: '<p><b>' + esc(i.mail) + '</b> adresine giden davet bağlantısı hemen çalışmaz olur. Kişi yeniden davet edilebilir.</p>', ok: 'Daveti iptal et', danger: true, cb: () => { i.st = 'cx'; i.exp = null; i.expTxt = '4 Kas'; uhRender(); toast('Davet iptal edildi'); } });
      }
    });
    g('uh-abody').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-act]'); if (!b) return;
      const s = byId(+b.closest('tr').getAttribute('data-sid')), act = b.getAttribute('data-act');
      if (act === 'unlink') {
        const up = s.rez.filter((r) => r.r === 'up').length;
        dlgOpen({ t: s.n + ' hesabının bağlantısını kaldır', why: true, ok: 'Bağlantıyı kaldır', danger: true,
          b: '<p>Üye giriş yapamaz ve kendi başına rezervasyon yapamaz. Kayıt, haklar ve ödemeler olduğu gibi kalır.</p><p>' + (up ? 'Yaklaşan ' + up + ' rezervasyon geçerli kalır, yönetici yönetir.' : 'Yaklaşan rezervasyon yok.') + ' Üye yeniden bağlanmak için davet almalıdır.</p>',
          cb: () => { ACC[s.id] = 'none'; uhRender(); toast(s.n + ' hesabının bağlantısı kaldırıldı'); } });
      } else if (act === 'link') {
        INV.unshift({ id: INV.length + 20, mail: s.mail, kind: 'Hesap bağlama', who: s.n, sid: s.id, sent: '4 Kas', exp: BASE + 7, st: 'pend', n: 0 });
        ACC[s.id] = 'invited'; uhRender(); toast('Bağlama daveti ' + s.mail + ' adresine gönderildi');
      } else if (act === 'relink') {
        const i = INV.filter((x) => x.sid === s.id && (x.st === 'pend' || x.st === 'exp'))[0];
        if (i && i.n >= 3) { toast('Bu davet en çok 3 kez yeniden gönderilir'); return; }
        if (i) sendInvite(i); uhRender(); toast('Davet yeniden gönderildi');
      }
    });
    g('uh-ifilter').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-f]'); if (!b) return; ifil = b.getAttribute('data-f');
      g('uh-ifilter').querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); invRows();
    });
    g('uh-afilter').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-f]'); if (!b) return; afil = b.getAttribute('data-f');
      g('uh-afilter').querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); accRows();
    });
    g('uh-asearch').addEventListener('input', accRows);
    document.querySelectorAll('[data-uhtab]').forEach((t) => t.addEventListener('click', () => {
      uhTab = t.getAttribute('data-uhtab');
      document.querySelectorAll('[data-uhtab]').forEach((x) => x.setAttribute('aria-selected', String(x === t)));
      document.querySelectorAll('[data-uhpanel]').forEach((p) => { p.hidden = p.getAttribute('data-uhpanel') !== uhTab; });
    }));
    g('uh-new').addEventListener('click', () => g('st-add').click());

    /* ======================= Kişi birleştirme ======================= */
    function rec(s, by, mailOverride) {
      return { n: s.n, sid: s.id, mail: mailOverride || s.mail, tel: s.tel, acct: ACC[s.id] === 'linked', by: by, st: s.on ? 'Aktif' : 'Pasif',
        hak: s.pkg + (s.k === 'c' ? ', ' + s.av + ' hak kaldı' : ''), rez: s.rez.length, pay: s.pay.length, debt: s.debt, docs: 'Tümü kabul' };
    }
    const MG = [
      { id: 1, st: 'open', why: 'Aynı telefon, aynı ad ve soyad', dupRez: 'Çar 4 Kas 14:30 Arjantin tango teknik',
        r: [rec(byId(2), 'Kendisi, 3 Mar 2026'), { n: 'Selin Aksoy', mail: '', tel: byId(2).tel, acct: false, by: 'Yönetici, 20 Eki 2026', st: 'Pasif', hak: 'Deneme dersi, 1 hak kaldı', rez: 1, pay: 1, debt: 0, docs: 'Kabul yok' }] },
      { id: 2, st: 'open', why: 'Aynı ad ve soyad, benzer e-posta',
        r: [rec(byId(1), 'Kendisi, 12 Eyl 2025'), { n: 'Cem Demir', mail: 'cem.d@ornek.test', tel: '+90 535 111 22 33', acct: false, by: 'Yönetici, 2 Kas 2026', st: 'Pasif', hak: 'Deneme dersi, 0 hak kaldı', rez: 1, pay: 1, debt: 150, docs: 'Kabul yok' }] },
      { id: 3, st: 'open', why: 'Aynı ad ve soyad, aynı telefon',
        r: [rec(byId(4), 'Kendisi, 20 Haz 2025'), { n: 'Merve Tan', mail: 'merve.tan2@ornek.test', tel: byId(4).tel, acct: true, by: 'Kendisi, 14 Eki 2026', st: 'Aktif', hak: '12 derslik paket, 12 hak kaldı', rez: 2, pay: 1, debt: 0, docs: 'Tümü kabul' }] }
    ];
    MG.forEach((p) => { p.keep = 0; p.reason = ''; p.okc = false; });
    let mfil = 'open', msel = 1;
    const mcur = () => MG.filter((p) => p.id === msel)[0];
    const mshown = () => MG.filter((p) => (mfil === 'open') === (p.st === 'open'));
    const FV = {
      n: (r) => esc(r.n), mail: (r) => (r.mail ? esc(r.mail) : '<span class="muted">Yok</span>'), tel: (r) => '<span class="tnum">' + esc(r.tel) + '</span>',
      acct: (r) => (r.acct ? '<span class="badge ok">Bağlı</span>' : '<span class="badge soft">Yok</span>'), by: (r) => esc(r.by), st: (r) => esc(r.st), hak: (r) => esc(r.hak),
      rez: (r) => r.rez + ' kayıt', pay: (r) => r.pay + ' kayıt', debt: (r) => (r.debt ? '<span class="debt">' + TL(r.debt) + '</span>' : '₺0'), docs: (r) => esc(r.docs)
    };
    const CMP = [['Ad soyad', 'n'], ['E-posta', 'mail'], ['Telefon', 'tel'], ['Hesap', 'acct'], ['Kaydı açan', 'by'], ['Durum', 'st'], ['Hak', 'hak'], ['Rezervasyon', 'rez'], ['Ödemeler', 'pay'], ['Açık borç', 'debt'], ['Belge kabulü', 'docs']];
    function impact(p) {
      const K = p.r[p.keep], D = p.r[1 - p.keep], kn = 'Kayıt ' + (p.keep + 1), rows = [];
      const blocked = K.acct && D.acct ? 'İki kaydın da hesabı bağlı. Önce birinin bağlantısını Davetler ve hesaplar sayfasından kaldır.' : '';
      rows.push(['Haklar', D.hak + ' ' + kn + ' kaydına taşınır', 'Ayrı hak kalemi olarak görünür, süreleri değişmez.']);
      rows.push(['Rezervasyon ve yoklama', D.rez + ' kayıt taşınır', p.dupRez ? 'İki kayıtta da ' + p.dupRez + ' var. Tek rezervasyon kalır, fazla ayrılan 1 hak iade edilir.' : 'Geçmiş yoklamalar olduğu gibi kalır.']);
      rows.push(['Ödemeler', D.pay + ' kayıt taşınır', D.debt ? 'Açık borç ' + TL(D.debt) + ', ' + kn + ' borcuna eklenir.' : 'Taşınan kayıtlarda açık borç yok.']);
      rows.push(['Belge kabulleri', 'Korunur', 'Aynı belgede en yeni kabul geçerli olur.']);
      rows.push(['Hesap', K.acct ? 'Değişmez' : D.acct ? 'Hesap ' + kn + ' kaydına bağlanır' : 'İki kayıtta da hesap yok', K.acct ? 'Üye aynı hesapla girmeye devam eder.' : D.acct ? 'Üye aynı e-postayla girmeye devam eder.' : 'Üye daha sonra davetle hesap açar.']);
      rows.push(['Kişi bilgileri', 'Aktarılmaz', 'Silinen kaydın e-posta ve telefonu kalan kayda eklenmez. Bunları yalnızca üyenin kendisi ekler.']);
      return { rows: rows, blocked: blocked };
    }
    function mgList() {
      const rows = mshown();
      g('mg-list').innerHTML = rows.map((p) => '<button type="button" class="mg-item" role="option" data-id="' + p.id + '" aria-selected="' + (p.id === msel) + '"><span class="pair"><span class="avatar sm">' + esc(p.r[0].n.split(' ').map((w) => w[0]).join('')) + '</span>' + esc(p.r[0].n) + '</span><small>' + (p.st === 'open' ? esc(p.why) : p.st === 'done' ? 'Birleştirildi' : 'Kopya değil') + '</small><small>' + (p.st === 'open' ? 'Kayıt 1 ' + (p.r[0].acct ? 'hesaplı' : 'hesapsız') + ', Kayıt 2 ' + (p.r[1].acct ? 'hesaplı' : 'hesapsız') : '') + '</small></button>').join('') ||
        '<p class="muted" style="padding:28px 20px;text-align:center">' + (mfil === 'open' ? 'Bekleyen öneri yok.' : 'Tamamlanan birleştirme yok.') + '</p>';
      g('mg-count').textContent = MG.filter((p) => p.st === 'open').length + ' bekleyen öneri';
      const b = g('mg-badge'); if (b) { b.textContent = MG.filter((p) => p.st === 'open').length; b.hidden = !MG.some((p) => p.st === 'open'); }
    }
    function mgCheck() {
      const p = mcur(); if (!p || p.st !== 'open') return;
      const imp = impact(p), ok = !imp.blocked && p.reason.trim() && p.okc;
      const btn = g('mg-go'); if (btn) btn.disabled = !ok;
    }
    function mgDetail() {
      const el = g('mg-detail'), p = mcur();
      if (!p || (mfil === 'open') !== (p.st === 'open')) {
        const first = mshown()[0];
        if (first) { msel = first.id; return mgDetail(); }
        el.innerHTML = '<div class="card"><div class="card-c muted" style="padding:40px 20px;text-align:center">' + (mfil === 'open' ? 'Birleştirilecek kayıt kalmadı.' : 'Henüz tamamlanan işlem yok.') + '</div></div>'; return;
      }
      if (p.st !== 'open') {
        el.innerHTML = '<div class="card"><div class="card-c" style="display:grid;gap:12px"><div class="ib-sent"><i data-i="' + (p.st === 'done' ? 'check' : 'x') + '"></i><div>' + esc(p.res) + '</div></div>' +
          (p.st === 'done' && p.r[p.keep].sid ? '<div><a class="btn outline sm" href="#uye" data-open="' + p.r[p.keep].sid + '">Üye profilini aç</a></div>' : '') + '</div></div>';
        swap(el); return;
      }
      const imp = impact(p), K = p.r[p.keep];
      el.innerHTML =
        '<div class="card"><div class="card-h"><h2>' + esc(p.r[0].n) + ' için iki kayıt</h2><p>' + esc(p.why) + '. Hangisinin kalacağını seç.</p></div><div class="card-c" style="display:grid;gap:14px">' +
        '<fieldset class="scope" id="mg-keep">' + p.r.map((r, i) => '<label class="opt"><input type="radio" name="mg-keep" value="' + i + '"' + (p.keep === i ? ' checked' : '') + '><span><b>Kayıt ' + (i + 1) + ' kalsın</b><small>' + (r.acct ? 'Hesabı bağlı' : 'Hesabı yok') + ', ' + esc(r.by) + '</small></span></label>').join('') + '</fieldset>' +
        '<div class="table-wrap"><table class="list static cmp" style="min-width:32rem"><thead><tr><th></th><th class="' + (p.keep === 0 ? 'keep' : '') + '">Kayıt 1' + (p.keep === 0 ? ' <span class="badge ok" style="margin-left:4px">Kalacak</span>' : '') + '</th><th class="' + (p.keep === 1 ? 'keep' : '') + '">Kayıt 2' + (p.keep === 1 ? ' <span class="badge ok" style="margin-left:4px">Kalacak</span>' : '') + '</th></tr></thead><tbody>' +
        CMP.map((c) => '<tr class="' + (FV[c[1]](p.r[0]) !== FV[c[1]](p.r[1]) ? 'df' : '') + '"><td>' + c[0] + '</td><td>' + FV[c[1]](p.r[0]) + '</td><td>' + FV[c[1]](p.r[1]) + '</td></tr>').join('') +
        '</tbody></table></div></div></div>' +
        '<div class="card"><div class="card-h"><h2>Birleştirince</h2><p>Kayıt ' + (2 - p.keep) + ' silinir, içindekiler Kayıt ' + (p.keep + 1) + ' kaydına taşınır.</p></div><div class="card-c" style="display:grid;gap:12px">' +
        '<ul class="aff" style="margin-top:0">' + imp.rows.map((x) => '<li><span class="row-l"><span>' + x[0] + '</span><b class="tnum">' + esc(x[1]) + '</b></span><span class="ch">' + esc(x[2]) + '</span></li>').join('') + '</ul>' +
        (imp.blocked ? '<p class="mg-warn"><i data-i="ban"></i><span>' + esc(imp.blocked) + '</span></p>' : '') +
        '<div class="field"><label class="label" for="mg-why">Gerekçe<span class="hint">Zorunlu, kayıt geçmişine yazılır</span></label><textarea class="input" id="mg-why" rows="2" placeholder="Örn. Aynı kişi, yönetici kaydı yanlışlıkla ikinci kez açılmış">' + esc(p.reason) + '</textarea></div>' +
        '<label class="opt"><input type="checkbox" id="mg-ok"' + (p.okc ? ' checked' : '') + '><span><b>Etkiyi okudum</b><small>Birleştirme geri alınamaz. Kayıt geçmişinde "Birleştirildi" izi kalır.</small></span></label></div>' +
        '<div class="card-f"><button type="button" class="btn ghost" id="mg-no">Kopya değil</button><button type="button" class="btn" id="mg-go" disabled>Kayıtları birleştir</button></div></div>';
      swap(el); mgCheck();
    }
    function mgAll() { mgList(); mgDetail(); }
    g('mg-list').addEventListener('click', (e) => { const b = e.target.closest('.mg-item'); if (!b) return; msel = +b.getAttribute('data-id'); mgAll(); });
    g('mg-filter').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-f]'); if (!b) return; mfil = b.getAttribute('data-f');
      g('mg-filter').querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      const f = mshown()[0]; if (f) msel = f.id; mgAll();
    });
    g('mg-detail').addEventListener('change', (e) => {
      const p = mcur();
      if (e.target.name === 'mg-keep') { p.keep = +e.target.value; p.okc = false; mgDetail(); }
      else if (e.target.id === 'mg-ok') { p.okc = e.target.checked; mgCheck(); }
    });
    g('mg-detail').addEventListener('input', (e) => { if (e.target.id === 'mg-why') { mcur().reason = e.target.value; mgCheck(); } });
    g('mg-detail').addEventListener('click', (e) => {
      const p = mcur(), open = e.target.closest('[data-open]');
      if (open) { select(+open.getAttribute('data-open')); return; }
      if (e.target.id === 'mg-go' && !e.target.disabled) {
        const K = p.r[p.keep], D = p.r[1 - p.keep];
        p.st = 'done'; p.res = 'Birleştirildi: Kayıt ' + (2 - p.keep) + ' silindi, ' + D.hak + ', ' + D.rez + ' rezervasyon ve ' + D.pay + ' ödeme kaydı Kayıt ' + (p.keep + 1) + ' kaydına taşındı.' + (D.debt ? ' Açık borç ' + TL(D.debt) + ' kalan kayda eklendi.' : '');
        const f = mshown()[0]; if (f) msel = f.id; mgAll(); toast('Kayıtlar birleştirildi');
      } else if (e.target.id === 'mg-no') {
        dlgOpen({ t: 'Bu iki kayıt farklı kişiler mi?', b: '<p>Bu öneri bir daha gösterilmez. Gerekirse Tamamlanan sekmesinden görürsün.</p>', ok: 'Kopya değil', cb: () => { p.st = 'no'; p.res = 'Kopya değil olarak işaretlendi. Bu iki kayıt bir daha önerilmeyecek.'; const f = mshown()[0]; if (f) msel = f.id; mgAll(); toast('Öneri kapatıldı'); } });
      }
    });

    /* ======================= Adaylar ======================= */
    let lfil = 'all', ldCur = null, ldStep = 'edit', ldSnap = '', ldOpener = null;
    const openLeads = () => LEADS.filter((l) => OPEN.indexOf(l.st) > -1);
    const needsAction = (l) => OPEN.indexOf(l.st) > -1 && l.due && l.due <= BASE;
    function dueHtml(l) {
      if (!l.next) return '<span class="muted">-</span>';
      if (OPEN.indexOf(l.st) === -1) return '<span class="muted">' + esc(l.next) + '</span>';
      const cls = l.due < BASE ? 'due-late' : l.due === BASE ? 'due-today' : 'muted';
      return '<span class="nm"><span>' + esc(l.next) + '</span><small class="' + (l.due < BASE ? 'due-late' : '') + ' tnum">' + (l.due < BASE ? 'Gecikti, ' : l.due === BASE ? 'Bugün, ' : '') + dayName(l.due) + '</small></span>';
    }
    function ldRender() {
      const won = LEADS.filter((l) => l.st === 'won').length;
      g('ld-kpi').innerHTML =
        kpiHtml('Açık aday', openLeads().length, 'Takip ediliyor') +
        kpiHtml('Bugün yapılacak', LEADS.filter((l) => OPEN.indexOf(l.st) > -1 && l.due === BASE).length, 'Arama ya da deneme dersi') +
        kpiHtml('Takibi gecikmiş', LEADS.filter((l) => OPEN.indexOf(l.st) > -1 && l.due < BASE).length, 'Sonraki adım tarihi geçti', LEADS.some((l) => OPEN.indexOf(l.st) > -1 && l.due < BASE) ? 'due-late' : '') +
        kpiHtml('Son 30 gün üye olan', won + '<small> / ' + LEADS.length + '</small>', '%' + Math.round(won / LEADS.length * 100) + ' dönüşüm');
      const cells = [['all', 'Tümü', LEADS.length]].concat(Object.keys(ST).map((k) => [k, ST[k], LEADS.filter((l) => l.st === k).length]));
      g('ld-fn').innerHTML = cells.map((c) => '<button type="button" data-f="' + c[0] + '" aria-pressed="' + (lfil === c[0]) + '"><span class="l">' + c[1] + '</span><b class="tnum">' + c[2] + '</b></button>').join('');
      const q = g('ld-search').value.trim().toLocaleLowerCase('tr');
      const rows = LEADS.filter((l) => (lfil === 'all' || l.st === lfil) && l.n.toLocaleLowerCase('tr').indexOf(q) > -1);
      g('ld-body').innerHTML = rows.map((l) =>
        '<tr tabindex="0" data-id="' + l.id + '"><td><span class="who"><span class="avatar sm">' + l.a + '</span><span class="nm"><span>' + esc(l.n) + '</span><small>' + esc(l.mail || l.tel) + '</small></span></span></td><td class="muted">' + l.src + '</td><td>' + l.int + '</td><td><span class="' + STB[l.st] + '">' + (l.st === 'won' ? '<i data-i="check"></i>' : '') + ST[l.st] + '</span>' + (l.st === 'trial' ? '<span class="pk-sub-p tnum">' + esc(l.trial) + '</span>' : l.st === 'lost' ? '<span class="pk-sub-p">' + esc(l.lost) + '</span>' : '') + '</td><td>' + dueHtml(l) + '</td></tr>'
      ).join('') || '<tr><td colspan="5" class="muted" style="padding:32px 0;text-align:center">Bu süzgece uygun aday yok.</td></tr>';
      g('ld-count').textContent = rows.length + ' aday gösteriliyor'; lbAll();
      const c = document.querySelector('[data-route="adaylar"] .count'); if (c) { const n = LEADS.filter(needsAction).length + appOpenN(); c.textContent = n; c.hidden = !n; }
      swap(view('adaylar'));
    }
    /* Çekmece */
    const sheet = g('ld-sheet'), scrim = g('ld-scrim');
    const opts = (arr, sel) => arr.map((o) => '<option' + (o === sel ? ' selected' : '') + '>' + o + '</option>').join('');
    const ldVals = () => JSON.stringify(['ld-n', 'ld-mail', 'ld-tel', 'ld-src', 'ld-int', 'ld-st', 'ld-trial', 'ld-next', 'ld-due', 'ld-note'].map((i) => g(i).value.trim()));
    function ldPaint() {
      const l = ldCur, isNew = !l, closed = !isNew && OPEN.indexOf(l.st) === -1;
      ['edit', 'conv', 'lose', 'offer', 'conf'].forEach((p) => { g('ld-p-' + p).hidden = p !== ldStep; });
      g('ld-err').hidden = true;
      if (ldStep === 'edit') {
        g('ld-title').textContent = isNew ? 'Aday ekle' : l.n;
        g('ld-sub').textContent = isNew ? 'Üye olmadan önce ilgilenen kişi' : ST[l.st] + ' · ' + l.src + ' · ' + l.owner;
        g('ld-n').value = isNew ? '' : l.n; g('ld-mail').value = isNew ? '' : l.mail; g('ld-tel').value = isNew ? '' : l.tel;
        g('ld-src').innerHTML = opts(SRC, isNew ? 'Instagram' : l.src); g('ld-int').innerHTML = opts(INT, isNew ? 'Henüz bilmiyor' : l.int);
        g('ld-st').innerHTML = (closed ? Object.keys(ST) : OPEN).map((k) => '<option value="' + k + '"' + (k === (isNew ? 'new' : l.st) ? ' selected' : '') + '>' + ST[k] + '</option>').join('');
        g('ld-trial').innerHTML = TRIALS.map((t) => '<option>' + t[0] + ' (' + t[1] + ')</option>').join('');
        if (!isNew && l.trial) { const m = TRIALS.filter((t) => t[0] === l.trial)[0]; g('ld-trial').value = m ? m[0] + ' (' + m[1] + ')' : g('ld-trial').value; }
        g('ld-next').value = isNew ? '' : l.next; g('ld-due').value = !isNew && l.due ? '2026-11-' + pad(l.due) : ''; g('ld-note').value = isNew ? '' : l.note;
        ['ld-n', 'ld-mail', 'ld-tel', 'ld-src', 'ld-int', 'ld-st', 'ld-trial', 'ld-next', 'ld-due', 'ld-note'].forEach((i) => { g(i).disabled = closed; });
        g('ld-trial-w').hidden = g('ld-st').value !== 'trial';
        g('ld-hist-w').hidden = isNew;
        g('ld-hist').innerHTML = isNew ? '' : l.hist.map((h) => '<li><span class="row-l"><span>' + esc(h[1]) + '</span><span class="muted tnum">' + h[0] + '</span></span></li>').join('');
        g('ld-hint').hidden = !isNew; offerBlock(l); taskBlock(l);
        ldSnap = ldVals();
        g('ld-foot').innerHTML = isNew ? '<button type="button" class="btn outline" id="ld-cancel">Vazgeç</button><button type="button" class="btn" id="ld-create" disabled>Aday ekle</button>' :
          closed ? (l.st === 'lost' ? '<button type="button" class="btn ghost" id="ld-reopen" style="margin-right:auto">Yeniden aç</button>' : '<a class="btn ghost" href="#uye-hesaplar" id="ld-toinv" style="margin-right:auto">Davetlere git</a>') + '<button type="button" class="btn outline" id="ld-cancel">Kapat</button>' :
            '<button type="button" class="btn ghost" id="ld-lose" style="margin-right:auto;color:var(--destructive)">Kaybedildi</button><button type="button" class="btn outline" id="ld-conv">Üyeliğe çevir</button><button type="button" class="btn" id="ld-save" disabled>Kaydet</button>';
        ldCheck();
      } else if (ldStep === 'conv') {
        g('ld-title').textContent = 'Üyeliğe çevir'; g('ld-sub').textContent = l.n;
        g('ld-cmail').value = l.mail; g('ld-cmail-w').hidden = !!l.mail;
        g('ld-conv-l').innerHTML = [['Davet', 'E-postayla gider', (l.mail || 'Adres yazılınca') + ' adresine 7 gün geçerli bağlantı gönderilir.'], ['Hesap', 'Aday kendisi açar', 'Bilgilerini (ad, e-posta, telefon) yalnızca kendisi yönetir.'], ['Aday kaydı', 'Üye oldu olarak kapanır', 'Davet kabul edilince Üyeler listesine düşer. Hak tahsisi sonra yapılır.']]
          .map((x) => '<li><span class="row-l"><span>' + x[0] + '</span><b>' + x[1] + '</b></span><span class="ch">' + esc(x[2]) + '</span></li>').join('');
        g('ld-foot').innerHTML = '<button type="button" class="btn outline" id="ld-back">Geri</button><button type="button" class="btn" id="ld-send"' + (l.mail ? '' : ' disabled') + '>Daveti gönder</button>';
      } else if (ldStep === 'lose') {
        g('ld-title').textContent = 'Adayı kapat'; g('ld-sub').textContent = l.n;
        g('ld-why').innerHTML = '<option value="">Neden seç</option>' + LOSS.map((o) => '<option>' + o + '</option>').join(''); g('ld-lnote').value = '';
        g('ld-foot').innerHTML = '<button type="button" class="btn outline" id="ld-back">Geri</button><button type="button" class="btn" id="ld-lsend" disabled>Kaybedildi olarak kapat</button>';
      } else if (ldStep === 'offer') offerPaint();
      else confPaint();
      swap(sheet);
    }
    function ldCheck() {
      if (ldStep !== 'edit') return;
      const isNew = !ldCur, n = g('ld-n').value.trim(), mail = g('ld-mail').value.trim(), tel = g('ld-tel').value.trim(), st = g('ld-st').value;
      let err = '';
      if (mail) {
        const m = stu.filter((s) => s.mail === mail.toLocaleLowerCase('tr'))[0];
        if (m) err = 'Bu e-posta ' + m.n + ' üyesine ait. Üye olan kişi aday olarak eklenemez.';
        else if (mail.indexOf('@') < 1) err = 'E-posta adresi geçerli görünmüyor.';
      }
      if (!err && st !== 'won' && st !== 'lost' && !g('ld-due').value) err = 'Sonraki adım için bir tarih seç.';
      const eb = g('ld-err'); eb.hidden = !err; eb.querySelector('span').textContent = err;
      const valid = !!n && (!!mail || !!tel) && !err, dirty = ldVals() !== ldSnap;
      const c = g('ld-create'), s = g('ld-save');
      if (c) c.disabled = !valid; if (s) s.disabled = !valid || !dirty;
    }
    function ldOpen(l) { ldOpener = document.activeElement; ldCur = l; ldStep = 'edit'; ldPaint(); sheet.hidden = false; scrim.hidden = false; g('ld-x').focus(); }
    function ldClose() { sheet.hidden = true; scrim.hidden = true; if (ldOpener && document.contains(ldOpener)) ldOpener.focus(); }
    g('ld-form').addEventListener('input', (e) => { if (e.target.id === 'ld-st') g('ld-trial-w').hidden = e.target.value !== 'trial'; ldCheck(); });
    g('ld-cmail').addEventListener('input', () => { const s = g('ld-send'); if (s) s.disabled = g('ld-cmail').value.indexOf('@') < 1; });
    g('ld-why').addEventListener('change', () => { const b = g('ld-lsend'); if (b) b.disabled = !g('ld-why').value; });
    g('ld-foot').addEventListener('click', (e) => {
      const id = e.target.id, l = ldCur; if (!id || e.target.disabled) return;
      if (id === 'ld-cancel') ldClose();
      else if (id === 'ld-back') { ldStep = 'edit'; ldPaint(); }
      else if (id === 'ld-conv') { ldStep = 'conv'; ldPaint(); }
      else if (id === 'ld-lose') { ldStep = 'lose'; ldPaint(); g('ld-why').focus(); }
      else if (id === 'ld-reopen') { l.st = 'talk'; l.lost = ''; l.next = 'Yeniden ara'; l.due = BASE + 1; lbPrimary(l); l.hist.unshift(['4 Kas', 'Yeniden açıldı']); ldClose(); ldRender(); toast(l.n + ' yeniden açıldı'); }
      else if (id === 'ld-create') {
        const n = g('ld-n').value.trim(), nl = { id: LEADS.length + 1, n: n, a: n.split(' ').map((w) => w[0]).slice(0, 2).join('').toLocaleUpperCase('tr'), mail: g('ld-mail').value.trim(), tel: g('ld-tel').value.trim(), src: g('ld-src').value, int: g('ld-int').value, st: 'new', next: g('ld-next').value.trim() || 'Ara, deneme dersi öner', due: +g('ld-due').value.slice(8), owner: 'Ayşe Y.', note: g('ld-note').value.trim(), hist: [['4 Kas', 'Aday eklendi (' + g('ld-src').value + ')']] };
        if (g('ld-st').value !== 'new') { nl.st = g('ld-st').value; }
        LEADS.unshift(nl); lbPrimary(nl); lfil = 'all'; ldClose(); ldRender(); toast(n + ' aday olarak eklendi');
      } else if (id === 'ld-save') {
        const was = l.st, st = g('ld-st').value;
        l.n = g('ld-n').value.trim(); l.mail = g('ld-mail').value.trim(); l.tel = g('ld-tel').value.trim(); l.src = g('ld-src').value; l.int = g('ld-int').value; l.next = g('ld-next').value.trim(); l.due = +g('ld-due').value.slice(8); l.note = g('ld-note').value.trim(); l.st = st;
        l.a = l.n.split(' ').map((w) => w[0]).slice(0, 2).join('').toLocaleUpperCase('tr');
        lbPrimary(l);
        if (st === 'trial') { l.trial = g('ld-trial').value.replace(/ \([^)]*\)$/, ''); }
        if (st !== was) l.hist.unshift(['4 Kas', st === 'trial' ? 'Deneme dersi planlandı: ' + l.trial : 'Aşama: ' + ST[was] + ' → ' + ST[st]]);
        ldClose(); ldRender(); toast('Aday güncellendi' + (st === 'trial' && st !== was ? ', deneme dersi için 1 yer ayrıldı' : ''));
      } else if (id === 'ld-send') {
        l.mail = l.mail || g('ld-cmail').value.trim(); l.st = 'won'; l.next = 'Davet kabulünü bekle'; l.due = BASE + 7; l.hist.unshift(['4 Kas', 'Üyelik daveti gönderildi']);
        INV.unshift({ id: INV.length + 40, mail: l.mail, kind: 'Yeni üye', lead: l.id, sent: '4 Kas', exp: BASE + 7, st: 'pend', n: 0 });
        ldClose(); ldRender(); uhRender(); toast('Davet gönderildi, ' + l.n + ' Üye oldu olarak işaretlendi');
      } else if (id === 'ld-lsend') {
        l.st = 'lost'; l.lost = g('ld-why').value; l.next = ''; l.due = 0; l.hist.unshift(['4 Kas', 'Kapandı: ' + l.lost + (g('ld-lnote').value.trim() ? ' (' + g('ld-lnote').value.trim() + ')' : '')]);
        ldClose(); ldRender(); toast(l.n + ' kapatıldı');
      }
    });
    g('ld-x').addEventListener('click', ldClose); scrim.addEventListener('click', ldClose);
    g('ld-add').addEventListener('click', () => ldOpen(null));
    g('ld-search').addEventListener('input', ldRender);
    g('ld-fn').addEventListener('click', (e) => { const b = e.target.closest('button[data-f]'); if (!b) return; lfil = b.getAttribute('data-f'); ltab = 'list'; ldRender(); });
    const rowOpen = (e) => { const tr = e.target.closest('tr[data-id]'); if (tr) ldOpen(LEADS.filter((x) => x.id === +tr.getAttribute('data-id'))[0]); };
    g('ld-body').addEventListener('click', rowOpen);
    g('ld-body').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); rowOpen(e); } });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!g('uh-dlg').hidden) dlgClose(); else if (!sheet.hidden) ldClose();
    });

    /* ======================= A5: Pano, takipler, deneme teklifi, ortak başvuru kutusu ======================= */
    const TASKS = []; let tkSeq = 1;
    const tkAdd = (who, kind, text, due, owner, extra) => { const t = Object.assign({ id: tkSeq++, who: who, kind: kind, text: text, due: due, owner: owner, done: false, res: '', at: 0 }, extra || {}); TASKS.push(t); return t; };
    const L = (id) => ({ t: 'l', id: id }), M = (sid) => ({ t: 'm', sid: sid });
    tkAdd(L(4), 'Arama', 'Ara, deneme dersi öner', 4, 'Ayşe Y.');
    tkAdd(L(5), 'WhatsApp', 'WhatsApp ile programı gönder', 3, 'Elif K.');
    tkAdd(L(6), 'Yüz yüze', 'Deneme dersi', 5, 'Ayşe Y.');
    tkAdd(L(7), 'Yüz yüze', 'Deneme dersi', 4, 'Elif K.');
    tkAdd(L(8), 'E-posta', 'Paket teklifini gönder', 3, 'Ayşe Y.');
    tkAdd(L(8), 'Arama', '8 derslik paket sorusunu yanıtla', 6, 'Ayşe Y.');
    tkAdd(L(3), 'Arama', 'Daveti yeniden gönder', 5, 'Elif K.');
    tkAdd(L(10), 'Arama', 'Ara, deneme dersi öner', 5, 'Ayşe Y.');
    tkAdd(L(6), 'WhatsApp', 'Deneme saatini onayla', 2, 'Ayşe Y.', { done: true, res: 'Per 19:00 uygun, onayladı', at: 2 });
    tkAdd(L(3), 'Arama', 'Deneme sonrası görüşme', 18, 'Elif K.', { done: true, res: 'Paket fiyatını sordu', at: 18 });
    tkAdd(M(5), 'Arama', 'Paket yenileme teklifini ilet (2 hak kaldı)', 6, 'Ayşe Y.');
    tkAdd(M(8), 'Arama', 'Açık borç için tahsilat hatırlat', 3, 'Elif K.');
    const whoRec = (t) => t.who.t === 'l' ? LEADS.filter((l) => l.id === t.who.id)[0] : byId(t.who.sid);
    const taskLive = (t) => t.who.t === 'm' || OPEN.indexOf(whoRec(t).st) > -1;
    const openTasks = (l) => TASKS.filter((t) => !t.done && t.who.t === 'l' && t.who.id === l.id).sort((a, b) => a.due - b.due);
    const lbDerive = (l) => { const o = openTasks(l)[0]; l.next = o ? o.text : ''; l.due = o ? o.due : 0; };
    const lbPrimary = (l) => {
      const o = openTasks(l)[0];
      if (l.next && l.due) { if (o) { o.text = l.next; o.due = l.due; } else tkAdd(L(l.id), 'Arama', l.next, l.due, l.owner); }
      lbDerive(l);
    };
    const dueFull = (n) => (n < BASE ? 'Gecikti, ' : n === BASE ? 'Bugün, ' : '') + dayName(n);
    const initials = (n) => n.split(' ').map((w) => w[0]).slice(0, 2).join('').toLocaleUpperCase('tr');
    const dstr = (n) => '2026-11-' + pad(n);

    let ltab = 'board', lown = '', townF = '', bfil = 'open', dragId = 0;
    const COLS = ['new', 'talk', 'trial', 'done', 'won', 'lost'];
    const trialShort = (s) => s.split(' ').slice(0, 4).join(' ');

    /* ---- Pano ---- */
    function cardHtml(l) {
      const op = OPEN.indexOf(l.st) > -1, nt = openTasks(l), chips = ['<span class="badge soft">' + l.int + '</span>'];
      if (l.st === 'trial' && l.trial) chips.push('<span class="badge">Deneme ' + esc(trialShort(l.trial)) + '</span>');
      if (l.offer && l.offer.st === 'sent') chips.push('<span class="badge solid">Teklif gönderildi</span>');
      if (l.offer && l.offer.st === 'req') chips.push('<span class="badge solid">Kayıt onayı bekliyor</span>');
      if (op && !nt.length) chips.push('<span class="badge bad">Takip planı yok</span>');
      const sub = op ? (l.next ? dueHtml(l) : '<span class="kb-sub">Sonraki adım yok</span>') : l.st === 'lost' ? '<span class="kb-sub">Neden: ' + esc(l.lost) + '</span>' : '<span class="kb-sub">' + esc(l.next || 'Davet gönderildi') + '</span>';
      return '<div class="kb-card' + (op ? '' : ' static') + '" ' + (op ? 'draggable="true" ' : '') + 'tabindex="0" data-id="' + l.id + '" aria-label="' + esc(l.n) + ', ' + ST[l.st] + '. ' + (op ? 'Alt ve ok tuşlarıyla aşama değiştir.' : '') + '"><div class="kb-top"><span class="avatar sm">' + l.a + '</span><b>' + esc(l.n) + '</b><span class="kb-own" title="Sorumlu: ' + esc(l.owner) + '">' + initials(l.owner) + '</span></div><div class="kb-chips">' + chips.join('') + '</div>' + sub + '</div>';
    }
    function lbRender() {
      g('lb-board').innerHTML = COLS.map((k) => {
        const ls = LEADS.filter((l) => l.st === k && (!lown || l.owner === lown)), late = ls.filter((l) => OPEN.indexOf(k) > -1 && l.due && l.due < BASE).length;
        return '<div class="kb-col' + (OPEN.indexOf(k) > -1 ? '' : ' closed') + '" data-col="' + k + '" aria-label="' + ST[k] + ', ' + ls.length + ' aday"><div class="kb-h"><span>' + ST[k] + '</span>' + (late ? '<span class="badge bad tnum">' + late + ' gecikmiş</span>' : '') + '<span class="pill-n tnum n">' + ls.length + '</span></div><div class="kb-cards">' + (ls.map(cardHtml).join('') || '<p class="kb-empty">Bu aşamada aday yok.</p>') + '</div></div>';
      }).join('');
      swap(g('lb-board'));
    }
    const lbCard = (id) => LEADS.filter((l) => l.id === id)[0];
    function lbMove(l, to) {
      const from = l.st; if (from === to) return;
      if (OPEN.indexOf(from) === -1) { toast(from === 'won' ? 'Üye olan aday geri taşınamaz.' : 'Kaybedilen aday önce Yeniden aç ile açılmalı.'); return; }
      const say = (m) => { g('lb-msg').textContent = m; };
      if (to === 'new' || to === 'talk') {
        const go = () => { l.st = to; if (from === 'trial') { l.trial = ''; l.offer = null; } l.hist.unshift(['4 Kas', 'Aşama: ' + ST[from] + ' → ' + ST[to]]); ldRender(); say(l.n + ' ' + ST[to] + ' aşamasına taşındı.'); toast(l.n + ': ' + ST[to]); };
        if (from === 'trial') dlgOpen({ t: 'Deneme kaydı iptal olsun mu?', b: '<p>' + esc(l.n) + ' için ayrılan deneme yeri (' + esc(l.trial) + ') serbest kalır. Aday ' + ST[to] + ' aşamasına döner.</p>', ok: 'Kaydı iptal et ve taşı', cb: go }); else go();
      } else if (to === 'trial') {
        if (l.offer && l.offer.st === 'sent') { toast('Teklif gönderildi. Aday kabul edince kaydı onaylayabilirsin.'); say('Teklif aday yanıtını bekliyor.'); return; }
        ldOpen(l); ldStep = l.offer && l.offer.st === 'req' ? 'conf' : 'offer'; ldPaint();
      } else if (to === 'done') {
        if (from !== 'trial') { toast('Önce deneme dersi planlanmalı.'); say('Deneme yapıldı aşamasına yalnızca Deneme planlı adaylar geçer.'); return; }
        dlgOpen({ t: 'Deneme dersine geldi mi?', b: '<p>' + esc(l.n) + ' için ' + esc(l.trial) + ' dersi.</p><ul class="aff"><li><span class="row-l"><span>Aşama</span><b>Deneme yapıldı</b></span></li><li><span class="row-l"><span>Takip</span><b>Yarın aranır</b></span><span class="ch">Paket teklifi için takip görevi oluşur.</span></li></ul>', ok: 'Geldi', cb: () => { l.st = 'done'; TASKS.forEach((t) => { if (!t.done && t.who.t === 'l' && t.who.id === l.id && t.text === 'Deneme dersi') { t.done = true; t.res = 'Denemeye geldi'; t.at = BASE; } }); l.hist.unshift(['4 Kas', 'Deneme dersine geldi: ' + l.trial.split(' ').slice(4).join(' ')]); tkAdd(L(l.id), 'Arama', 'Deneme sonrası görüş, paket öner', BASE + 1, l.owner); lbDerive(l); ldRender(); say(l.n + ' denemeye geldi, yarın için takip oluştu.'); toast('Deneme yapıldı olarak işaretlendi'); } });
      } else if (to === 'won') { ldOpen(l); ldStep = 'conv'; ldPaint(); }
      else if (to === 'lost') { ldOpen(l); ldStep = 'lose'; ldPaint(); g('ld-why').focus(); }
    }
    const lb = g('lb-board');
    lb.addEventListener('click', (e) => { const c = e.target.closest('.kb-card'); if (c) ldOpen(lbCard(+c.getAttribute('data-id'))); });
    lb.addEventListener('dragstart', (e) => { const c = e.target.closest('.kb-card'); if (!c || c.classList.contains('static')) { e.preventDefault(); return; } dragId = +c.getAttribute('data-id'); c.classList.add('drag'); e.dataTransfer.setData('text/plain', String(dragId)); e.dataTransfer.effectAllowed = 'move'; });
    lb.addEventListener('dragend', () => { dragId = 0; lb.querySelectorAll('.drag,.over').forEach((x) => x.classList.remove('drag', 'over')); });
    lb.addEventListener('dragover', (e) => { const c = e.target.closest('.kb-col'); if (!c || !dragId) return; e.preventDefault(); lb.querySelectorAll('.over').forEach((x) => { if (x !== c) x.classList.remove('over'); }); c.classList.add('over'); });
    lb.addEventListener('drop', (e) => { const c = e.target.closest('.kb-col'); if (!c || !dragId) return; e.preventDefault(); const id = dragId; dragId = 0; c.classList.remove('over'); lbMove(lbCard(id), c.getAttribute('data-col')); });
    lb.addEventListener('keydown', (e) => {
      const c = e.target.closest('.kb-card'); if (!c) return;
      if (e.key === 'Enter' && !e.altKey) { ldOpen(lbCard(+c.getAttribute('data-id'))); return; }
      if (e.altKey && (e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !c.classList.contains('static')) {
        e.preventDefault(); const l = lbCard(+c.getAttribute('data-id')), i = COLS.indexOf(l.st) + (e.key === 'ArrowRight' ? 1 : -1);
        if (i >= 0 && i < COLS.length) { const id = l.id; lbMove(l, COLS[i]); const n = lb.querySelector('.kb-card[data-id="' + id + '"]'); if (n) n.focus(); }
      }
    });
    g('lb-own').addEventListener('change', () => { lown = g('lb-own').value; lbRender(); });

    /* ---- Takipler ---- */
    function taskRow(t) {
      const r = whoRec(t), isL = t.who.t === 'l', name = isL ? r.n : r.n, sub = isL ? 'Aday · ' + ST[r.st] : 'Üye · ' + (r.pkg || '');
      return '<tr data-tk="' + t.id + '"><td><span class="who"><span class="avatar sm">' + (isL ? r.a : r.a) + '</span><span class="nm"><span>' + esc(name) + '</span><small>' + esc(sub) + '</small></span></span></td><td><span class="nm"><span>' + esc(t.text) + '</span><small>' + t.kind + '</small></span></td><td class="tnum"><span class="' + (t.due < BASE ? 'due-late' : t.due === BASE ? 'due-today' : '') + '">' + dueFull(t.due) + '</span></td><td class="muted">' + esc(t.owner) + '</td><td class="act"><button type="button" class="btn outline sm" data-tkd="' + t.id + '">Tamamla</button> <button type="button" class="btn ghost sm" data-tks="' + t.id + '">Ertele</button></td></tr>';
    }
    const renewals = () => stu.filter((s) => s.on && ((s.k === 'c' && s.av != null && s.av <= 2) || (s.k === 't' && /Kas|Ara/.test(s.until || '') && s.until.indexOf('Ara') === -1)));
    const idle = () => stu.filter((s) => !s.on || (s.on && !s.next && !s.debt));
    const mReason = (s, kind) => kind === 'r' ? (s.k === 'c' ? s.av + ' hak kaldı, ' + s.per.split(' - ')[1] + '\'e kadar' : s.until + '\'de biter') : (!s.on ? 'Pasif, ' + lastIn(s) + ' geldi' : 'Planlı ders yok, ' + lastIn(s) + ' geldi');
    function mRow(s, kind) {
      const pend = TASKS.filter((t) => !t.done && t.who.t === 'm' && t.who.sid === s.id)[0];
      return '<li><span class="row-l"><span><b style="font-weight:500">' + esc(s.n) + '</b></span><span class="tnum muted">' + (pend ? 'Takip ' + dayName(pend.due) : '') + '</span></span><span class="ch">' + esc(mReason(s, kind)) + (pend ? '' : ' · <button type="button" class="btn ghost sm" data-mtk="' + s.id + '" data-mk="' + kind + '" style="height:22px;padding:0 6px">Takip ekle</button>') + '</span></li>';
    }
    function ltRender() {
      const live = TASKS.filter((t) => !t.done && taskLive(t) && (!townF || t.owner === townF)).sort((a, b) => a.due - b.due);
      const G = [['Gecikmiş', live.filter((t) => t.due < BASE), 'bad'], ['Bugün', live.filter((t) => t.due === BASE)], ['Bu hafta', live.filter((t) => t.due > BASE && t.due <= BASE + 6)], ['Daha sonra', live.filter((t) => t.due > BASE + 6)]];
      const done = TASKS.filter((t) => t.done && taskLive(t)).sort((a, b) => b.at - a.at).slice(0, 4);
      g('lt-s').textContent = live.length + ' açık takip';
      g('lt-body').innerHTML = G.filter((x) => x[1].length).map((x) => '<div class="tk-g"><h3>' + x[0] + '<span class="badge ' + (x[2] || 'soft') + ' tnum">' + x[1].length + '</span></h3><div class="table-wrap"><table class="list static" style="min-width:42rem"><tbody>' + x[1].map(taskRow).join('') + '</tbody></table></div></div>').join('') || '<p class="muted" style="padding:24px 0;text-align:center">Açık takip yok.</p>';
      g('lt-body').innerHTML += '<div class="tk-two"><div class="card"><div class="card-h"><h2>Yenileme yaklaşan üyeler</h2><p>Hakkı azalan ya da süresi bitmek üzere.</p></div><div class="card-c"><ul class="aff" style="margin-top:0">' + (renewals().map((s) => mRow(s, 'r')).join('') || '<li><span class="ch">Yok</span></li>') + '</ul></div></div><div class="card"><div class="card-h"><h2>Hareketsiz üyeler</h2><p>Planlı dersi olmayan ya da pasif.</p></div><div class="card-c"><ul class="aff" style="margin-top:0">' + (idle().map((s) => mRow(s, 'i')).join('') || '<li><span class="ch">Yok</span></li>') + '</ul></div></div></div>' +
        (done.length ? '<div class="tk-g"><h3>Son tamamlananlar</h3><ul class="aff">' + done.map((t) => '<li><span class="row-l"><span>' + esc(whoRec(t).n) + ' · ' + esc(t.text) + '</span><span class="tnum muted">' + dayName(t.at) + '</span></span><span class="ch">' + esc(t.res) + '</span></li>').join('') + '</ul></div>' : '');
      swap(g('lt-body'));
    }
    g('lt-own').addEventListener('change', () => { townF = g('lt-own').value; ltRender(); });
    g('lt-body').addEventListener('click', (e) => {
      const d = e.target.closest('[data-tkd]'), s = e.target.closest('[data-tks]'), m = e.target.closest('[data-mtk]'), tr = e.target.closest('tr[data-tk]');
      if (d) tkOpen('done', TASKS.filter((t) => t.id === +d.getAttribute('data-tkd'))[0]);
      else if (s) tkOpen('snooze', TASKS.filter((t) => t.id === +s.getAttribute('data-tks'))[0]);
      else if (m) tkOpen('add', null, M(+m.getAttribute('data-mtk')), m.getAttribute('data-mk') === 'r' ? 'Paket yenileme teklifini ilet' : 'Neden gelmediğini sor');
      else if (tr) { const t = TASKS.filter((x) => x.id === +tr.getAttribute('data-tk'))[0]; if (t.who.t === 'l') ldOpen(whoRec(t)); }
    });
    g('lt-add').addEventListener('click', () => tkOpen('add', null, null));

    /* ---- Takip çekmecesi: ekle, tamamla, ertele ---- */
    const tkS = g('tk-sheet'), tkSc = g('tk-scrim'); let tkMode = 'add', tkT = null, tkW = null, tkOp = null;
    const segV = (id) => g(id).querySelector('[aria-pressed="true"]').getAttribute('data-v');
    const segSet = (id, v) => g(id).querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.getAttribute('data-v') === v)));
    const dnum = (id) => +g(id).value.slice(8);
    function tkWhoOpts(sel) {
      return '<optgroup label="Adaylar">' + LEADS.filter((l) => OPEN.indexOf(l.st) > -1).map((l) => '<option value="l' + l.id + '"' + (sel === 'l' + l.id ? ' selected' : '') + '>' + esc(l.n) + '</option>').join('') + '</optgroup><optgroup label="Üyeler">' + stu.filter((s) => s.on).map((s) => '<option value="m' + s.id + '"' + (sel === 'm' + s.id ? ' selected' : '') + '>' + esc(s.n) + '</option>').join('') + '</optgroup>';
    }
    const whoFromVal = (v) => v[0] === 'l' ? L(+v.slice(1)) : M(+v.slice(1));
    function tkOpen(mode, t, who, text) {
      tkOp = document.activeElement; tkMode = mode; tkT = t; tkW = who;
      const rec = t ? whoRec(t) : null, isDone = mode === 'done', isSn = mode === 'snooze';
      g('tk-title').textContent = mode === 'add' ? 'Takip ekle' : isDone ? 'Takibi tamamla' : 'Takibi ertele';
      g('tk-sub').textContent = rec ? rec.n : 'Kişi için tarihli bir takip planla.';
      g('tk-who-w').hidden = mode !== 'add' || !!who; g('tk-done-w').hidden = !isDone; g('tk-main').hidden = isDone;
      g('tk-kind-l').parentNode.hidden = isSn; g('tk-text-l').parentNode.hidden = isSn; g('tk-own-w').hidden = isSn;
      g('tk-who').innerHTML = tkWhoOpts(who ? (who.t === 'l' ? 'l' + who.id : 'm' + who.sid) : '');
      g('tk-ok').textContent = mode === 'add' ? 'Takibi kaydet' : isDone ? 'Tamamla' : 'Ertele';
      segSet('tk-kind', t ? t.kind : 'Arama'); g('tk-text').value = mode === 'add' ? (text || '') : t.text; g('tk-due').value = dstr(mode === 'add' ? BASE + 1 : isSn ? Math.min(30, t.due + 1 > BASE ? t.due + 1 : BASE + 1) : t.due); g('tk-own').value = t ? t.owner : 'Ayşe Y.';
      g('tk-res').value = ''; g('tk-nx').checked = false;
      g('tk-due-l').textContent = isSn ? 'Yeni tarih' : 'Ne zaman';
      if (isDone) {
        g('tk-cur').innerHTML = '<li><span class="row-l"><span>' + esc(t.text) + '</span><span class="tnum muted">' + dayName(t.due) + '</span></span><span class="ch">' + t.kind + ' · ' + esc(t.owner) + '</span></li>';
        const need = t.who.t === 'l' && OPEN.indexOf(rec.st) > -1 && openTasks(rec).length === 1;
        g('tk-nx-w').hidden = false; g('tk-nx').checked = need; g('tk-nx').disabled = need; g('tk-nx-h').textContent = need ? 'Aday açık olduğu için zorunlu. Başka planlı takip yok.' : 'Aynı kişi için bir sonraki adımı hemen planla.';
        g('tk-text').value = ''; g('tk-due').value = dstr(BASE + 2); segSet('tk-kind', 'Arama');
      } else g('tk-nx-w').hidden = true;
      tkCheck(); tkS.hidden = false; tkSc.hidden = false; (isDone ? g('tk-res') : mode === 'add' && !who ? g('tk-who') : isSn ? g('tk-due') : g('tk-text')).focus(); swap(tkS);
    }
    function tkCheck() {
      const rows = []; let err = '', ok = false;
      const showMain = tkMode === 'add' || (tkMode === 'done' && g('tk-nx').checked);
      g('tk-main').hidden = tkMode === 'done' ? !g('tk-nx').checked : false;
      if (tkMode === 'snooze') g('tk-main').hidden = false;
      const due = dnum('tk-due'), text = g('tk-text').value.trim(), ymd = g('tk-due').value;
      const w = tkMode === 'add' ? (tkW || whoFromVal(g('tk-who').value || 'l4')) : tkT.who, rec = w.t === 'l' ? LEADS.filter((l) => l.id === w.id)[0] : byId(w.sid);
      if (tkMode === 'add') {
        if (!ymd || due < BASE) err = 'Tarih bugünden önce olamaz.'; ok = !!text && !err;
        const o = w.t === 'l' ? openTasks(rec)[0] : null;
        rows.push(['Takip', text ? text + ' · ' + dayName(due) : '-', g('tk-kind') ? segV('tk-kind') + ', sorumlu ' + g('tk-own').value : '']);
        if (w.t === 'l') rows.push(['Aday kartı', !o || due < o.due ? 'Sonraki adım olur' : 'Sonraki adım değişmez', !o || due < o.due ? 'Karttaki tarih ' + dayName(due) + ' olur.' : 'Önce ' + dayName(o.due) + ' tarihli takip yapılır.']);
      } else if (tkMode === 'done') {
        ok = !!g('tk-res').value.trim(); const nx = g('tk-nx').checked;
        if (nx) { if (!ymd || due < BASE) err = 'Sonraki takip tarihi bugünden önce olamaz.'; else if (!text) ok = false; }
        rows.push(['Takip', 'Tamamlanır', 'Sonuç adayın ya da üyenin geçmişine yazılır.']);
        rows.push(['Sonraki takip', nx && text ? text + ' · ' + dayName(due) : 'Planlanmadı', w.t === 'l' && !nx && openTasks(rec).length === 1 ? 'Dikkat: aday takipsiz kalır.' : '']);
        ok = ok && !err;
      } else {
        if (!ymd || due < BASE) err = 'Tarih bugünden önce olamaz.'; else if (due === tkT.due) err = 'Farklı bir tarih seç.';
        ok = !err; rows.push(['Takip', dayName(tkT.due) + ' → ' + dayName(due), tkT.due < BASE && due >= BASE ? 'Gecikme kapanır.' : 'Sorumlu aynı kalır.']);
      }
      g('tk-eff').innerHTML = rows.map((r) => '<li><span class="row-l"><span>' + r[0] + '</span><b class="tnum">' + esc(r[1]) + '</b></span>' + (r[2] ? '<span class="ch">' + esc(r[2]) + '</span>' : '') + '</li>').join('');
      const er = g('tk-err'); er.hidden = !err; er.querySelector('span').textContent = err; g('tk-ok').disabled = !ok;
    }
    function tkClose() { tkS.hidden = true; tkSc.hidden = true; if (tkOp && document.contains(tkOp)) tkOp.focus(); }
    g('tk-form').addEventListener('input', tkCheck); g('tk-form').addEventListener('change', tkCheck); g('tk-form').addEventListener('submit', (e) => e.preventDefault());
    g('tk-kind').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { segSet('tk-kind', b.getAttribute('data-v')); tkCheck(); } });
    g('tk-x').addEventListener('click', tkClose); g('tk-cancel').addEventListener('click', tkClose); tkSc.addEventListener('click', tkClose);
    g('tk-ok').addEventListener('click', () => {
      if (g('tk-ok').disabled) return;
      const due = dnum('tk-due'), text = g('tk-text').value.trim(), kind = segV('tk-kind'), own = g('tk-own').value;
      if (tkMode === 'add') {
        const w = tkW || whoFromVal(g('tk-who').value), rec = w.t === 'l' ? LEADS.filter((l) => l.id === w.id)[0] : byId(w.sid);
        tkAdd(w, kind, text, due, own); if (w.t === 'l') { rec.hist.unshift(['4 Kas', 'Takip planlandı: ' + text + ' (' + dayName(due) + ')']); lbDerive(rec); }
        toast('Takip eklendi, ' + dayName(due));
      } else if (tkMode === 'done') {
        const t = tkT, rec = whoRec(t); t.done = true; t.res = g('tk-res').value.trim(); t.at = BASE;
        if (t.who.t === 'l') rec.hist.unshift(['4 Kas', t.kind + ': ' + t.res]);
        if (g('tk-nx').checked) { tkAdd(t.who, kind, text, due, own); if (t.who.t === 'l') rec.hist.unshift(['4 Kas', 'Takip planlandı: ' + text + ' (' + dayName(due) + ')']); }
        if (t.who.t === 'l') lbDerive(rec); toast('Takip tamamlandı' + (g('tk-nx').checked ? ', sonraki takip planlandı' : ''));
      } else {
        const t = tkT, rec = whoRec(t), was = t.due; t.due = due; if (t.who.t === 'l') { rec.hist.unshift(['4 Kas', 'Takip ertelendi: ' + dayName(was) + ' → ' + dayName(due)]); lbDerive(rec); } toast('Takip ertelendi, ' + dayName(due));
      }
      tkClose(); ldRender(); if (!sheet.hidden && ldCur && ldStep === 'edit') ldPaint();
    });

    /* ---- Deneme teklifi ve kayıt onayı ---- */
    const DISC = { 0: 'Yok', 100: 'İlk pakette ₺100', 200: 'İlk pakette ₺200' };
    function ofCheck() {
      const l = ldCur, d = +g('ld-of-d').value, why = g('ld-of-w').value.trim(); g('ld-of-w-w').hidden = !d;
      let err = ''; if (!l.mail) err = 'Teklif e-postayla gider. Önce adayın e-posta adresini ekle.'; else if (d && !why) err = 'İndirim için gerekçe yaz.';
      g('ld-of-eff').innerHTML = [['Teklif', 'E-postayla gider', (l.mail || 'E-posta yok') + ' adresine ' + g('ld-of-v').value + ' gün geçerli bağlantı gönderilir.'], ['Kontenjan', 'Yer ayrılmaz', 'Aday kaydı onaylayınca ve sen onaylayınca 1 yer ayrılır.'], ['İndirim', DISC[d], d ? 'Yalnızca bu adayın ilk paketine, tek kullanımlık. Yeni indirim kuralı oluşturmaz.' : 'Teklifte indirim yok.'], ['Takip', 'Yanıt takibi planlanır', dayName(BASE + 3) + ', ' + l.owner]].map((r) => '<li><span class="row-l"><span>' + r[0] + '</span><b>' + esc(r[1]) + '</b></span><span class="ch">' + esc(r[2]) + '</span></li>').join('');
      const er = g('ld-of-err'); er.hidden = !err; er.querySelector('span').textContent = err; const b = g('ld-osend'); if (b) b.disabled = !!err;
    }
    g('ld-p-offer').addEventListener('input', ofCheck); g('ld-p-offer').addEventListener('change', ofCheck);
    function offerPaint() {
      const l = ldCur; g('ld-title').textContent = 'Deneme teklifi'; g('ld-sub').textContent = l.n;
      g('ld-of-s').innerHTML = TRIALS.map((t) => '<option>' + t[0] + ' (' + t[1] + ')</option>').join(''); g('ld-of-v').value = '3'; g('ld-of-d').value = '0'; g('ld-of-w').value = '';
      g('ld-foot').innerHTML = '<button type="button" class="btn outline" id="ld-back">Geri</button><button type="button" class="btn" id="ld-osend" disabled>Teklifi gönder</button>'; ofCheck();
    }
    function confPaint() {
      const l = ldCur, o = l.offer;
      g('ld-title').textContent = 'Deneme kaydını onayla'; g('ld-sub').textContent = l.n;
      g('ld-cf-o').innerHTML = '<li><span class="row-l"><span>Ders</span><b>' + esc(trialShort(o.s)) + '</b></span><span class="ch">' + esc(o.s.split(' ').slice(4).join(' ')) + '</span></li><li><span class="row-l"><span>İndirim</span><b>' + DISC[o.d] + '</b></span>' + (o.w ? '<span class="ch">' + esc(o.w) + '</span>' : '') + '</li>';
      g('ld-cf-eff').innerHTML = [['Kontenjan', '1 yer ayrılır', TRIALS.filter((t) => t[0] === o.s)[0] ? TRIALS.filter((t) => t[0] === o.s)[0][1] + ', onaydan sonra 1 azalır.' : ''], ['Aşama', 'Deneme planlı', 'Aday kartı Deneme planlı sütununa geçer.'], ['Satış', 'Oluşmaz', 'Deneme kaydı üyelik, satış ya da tahsilat değildir. Dönüşüm ayrıca onaylanır.']].map((r) => '<li><span class="row-l"><span>' + r[0] + '</span><b>' + r[1] + '</b></span><span class="ch">' + esc(r[2]) + '</span></li>').join('');
      g('ld-foot').innerHTML = '<button type="button" class="btn outline" id="ld-back">Geri</button><button type="button" class="btn" id="ld-ocok">Deneme kaydını onayla</button>';
    }
    function offerBlock(l) {
      const w = g('ld-offer-w'), isNew = !l, op = !isNew && OPEN.indexOf(l.st) > -1; w.hidden = !op; if (!op) return;
      const o = l.offer, rows = [], acts = [];
      if (l.st === 'trial' && l.trial) rows.push(['Deneme kaydı', 'Onaylandı', l.trial]);
      else if (o && o.st === 'sent') { rows.push(['Teklif', 'Gönderildi, yanıt bekleniyor', trialShort(o.s) + ', ' + o.v + ' gün geçerli' + (o.d ? ', ' + DISC[o.d] : '')]); acts.push('<button type="button" class="btn outline sm" id="ld-oacc">Önizleme: aday teklifi kabul etti</button>'); }
      else if (o && o.st === 'req') { rows.push(['Teklif', 'Aday kabul etti, onayın bekleniyor', trialShort(o.s) + (o.d ? ', ' + DISC[o.d] : '')]); acts.push('<button type="button" class="btn sm" id="ld-oconf">Deneme kaydını onayla</button>'); }
      else { rows.push(['Teklif', 'Yok', 'Deneme dersi teklifi gönderilmedi.']); acts.push('<button type="button" class="btn outline sm" id="ld-ogo">Deneme teklifi gönder</button>'); }
      g('ld-offer').innerHTML = rows.map((r) => '<li><span class="row-l"><span>' + r[0] + '</span><b>' + esc(r[1]) + '</b></span><span class="ch">' + esc(r[2]) + '</span></li>').join(''); g('ld-offer-a').innerHTML = acts.join('');
    }
    function taskBlock(l) {
      const w = g('ld-tk-w'), isNew = !l; w.hidden = isNew; if (isNew) return;
      const open = openTasks(l), done = TASKS.filter((t) => t.done && t.who.t === 'l' && t.who.id === l.id).sort((a, b) => b.at - a.at), isOpen = OPEN.indexOf(l.st) > -1;
      g('ld-tk-add').hidden = !isOpen;
      g('ld-tk').innerHTML = (open.map((t) => '<li><span class="row-l"><span><span class="badge soft">' + t.kind + '</span> ' + esc(t.text) + '</span><span class="tnum ' + (t.due < BASE ? 'due-late' : 'muted') + '">' + dueFull(t.due) + '</span></span><span class="ch">' + esc(t.owner) + ' · <button type="button" class="btn ghost sm" data-tkd="' + t.id + '" style="height:22px;padding:0 6px">Tamamla</button><button type="button" class="btn ghost sm" data-tks="' + t.id + '" style="height:22px;padding:0 6px">Ertele</button></span></li>').join('') +
        done.map((t) => '<li><span class="row-l"><span class="muted"><span class="badge soft">' + t.kind + '</span> ' + esc(t.text) + '</span><span class="tnum muted">' + dayName(t.at) + '</span></span><span class="ch">Yapıldı: ' + esc(t.res) + '</span></li>').join('')) || '<li><span class="ch">Planlı takip yok.</span></li>';
    }
    g('ld-p-edit').addEventListener('click', (e) => {
      const l = ldCur, b = e.target.closest('button'); if (!b || !l) return;
      if (b.id === 'ld-tk-add') tkOpen('add', null, L(l.id));
      else if (b.hasAttribute('data-tkd')) tkOpen('done', TASKS.filter((t) => t.id === +b.getAttribute('data-tkd'))[0]);
      else if (b.hasAttribute('data-tks')) tkOpen('snooze', TASKS.filter((t) => t.id === +b.getAttribute('data-tks'))[0]);
      else if (b.id === 'ld-ogo') { ldStep = 'offer'; ldPaint(); }
      else if (b.id === 'ld-oacc') { l.offer.st = 'req'; l.hist.unshift(['4 Kas', 'Aday deneme teklifini kabul etti']); ldRender(); ldPaint(); toast('Aday teklifi kabul etti, onayın bekleniyor'); }
      else if (b.id === 'ld-oconf') { ldStep = 'conf'; ldPaint(); }
    });
    g('ld-foot').addEventListener('click', (e) => {
      const id = e.target.id, l = ldCur; if (!id || e.target.disabled) return;
      if (id === 'ld-osend') {
        const d = +g('ld-of-d').value, s = g('ld-of-s').value.replace(/ \([^)]*\)$/, '');
        l.offer = { s: s, v: +g('ld-of-v').value, d: d, w: d ? g('ld-of-w').value.trim() : '', st: 'sent' }; l.hist.unshift(['4 Kas', 'Deneme teklifi gönderildi: ' + trialShort(s) + (d ? ', ' + DISC[d] : '')]);
        tkAdd(L(l.id), 'Arama', 'Deneme teklifinin yanıtını sor', BASE + 3, l.owner); lbDerive(l); ldStep = 'edit'; ldRender(); ldPaint(); toast('Teklif gönderildi, ' + dayName(BASE + 3) + ' için takip oluştu');
      } else if (id === 'ld-ocok') {
        const o = l.offer; l.st = 'trial'; l.trial = o.s; o.st = 'ok'; l.hist.unshift(['4 Kas', 'Deneme kaydı onaylandı: ' + o.s]); TASKS.forEach((t) => { if (!t.done && t.who.t === 'l' && t.who.id === l.id && /yanıtını sor|deneme dersi öner/.test(t.text)) { t.done = true; t.res = 'Aday teklifi kabul etti'; t.at = BASE; } });
        tkAdd(L(l.id), 'Yüz yüze', 'Deneme dersi', +o.s.split(' ')[1] || BASE, l.owner); lbDerive(l); ldStep = 'edit'; ldClose(); ldRender(); toast('Deneme kaydı onaylandı, 1 yer ayrıldı');
      }
    });

    /* ---- Ortak başvuru kutusu ---- */
    const APPS = [
      { id: 1, n: 'Nilay Çakır', mail: 'nilay.cakir@ornek.test', tel: '+90 533 100 30 01', int: 'Salsa', msg: 'Hiç dans etmedim, hafta içi akşam grubu var mı?', at: '3 Kas 21:14', cons: 'İletişim izni verildi', consAt: '3 Kas 21:14 · form sürüm 2', match: null, st: 'open' },
      { id: 2, n: 'Nilay Çakır', mail: 'nilay.cakir@ornek.test', tel: '+90 533 100 30 01', int: 'Bachata', msg: 'Bachata başlangıç saatlerini de öğrenebilir miyim?', at: '4 Kas 09:02', cons: 'İletişim izni verildi', consAt: '4 Kas 09:02 · form sürüm 2', match: null, prev: 1, st: 'open' },
      { id: 3, n: 'C. Demir', mail: '', tel: '+90 533 100 10 01', int: 'Özel ders', msg: 'Özel ders için müsaitlik var mı?', at: '4 Kas 08:40', cons: 'İletişim izni verildi', consAt: '4 Kas 08:40 · form sürüm 2', match: { t: 'm', id: 1, n: 'Cem Demir', why: 'Telefon numarası Cem Demir kaydıyla aynı' }, st: 'open' },
      { id: 4, n: 'asdf', mail: 'x@x', tel: '', int: 'Henüz bilmiyor', msg: 'test', at: '2 Kas 03:11', cons: 'İletişim izni verilmedi', consAt: '', match: null, st: 'open', noc: true },
      { id: 5, n: 'Gizem Özkan', mail: 'gizem.ozkan@ornek.test', tel: '+90 533 100 20 04', int: 'Salsa', msg: 'Salsa başlangıç grubu', at: '3 Kas 20:30', cons: 'İletişim izni verildi', consAt: '3 Kas 20:30 · form sürüm 2', st: 'lead', res: 'Aday olarak alındı: Gizem Özkan' }
    ];
    const appOpenN = () => APPS.filter((a) => a.st === 'open').length;
    function suggest(a) {
      if (a.prev) { const p = APPS.filter((x) => x.id === a.prev)[0]; if (p && p.lid) { const l = LEADS.filter((x) => x.id === p.lid)[0]; return { t: 'l', id: l.id, n: l.n, why: 'Aynı kişinin önceki başvurusu aday olarak alındı' }; } }
      return a.match;
    }
    function baRender() {
      const rows = APPS.filter((a) => (bfil === 'open') === (a.st === 'open'));
      g('lt-n-apps').textContent = appOpenN(); g('ba-s').textContent = bfil === 'open' ? appOpenN() + ' açık başvuru' : rows.length + ' tamamlanan';
      g('ba-body').innerHTML = rows.map((a) => {
        const sg = suggest(a), pv = a.prev && !(sg && sg.t === 'l');
        return '<tr tabindex="0" data-ba="' + a.id + '"><td><span class="who"><span class="avatar sm">' + esc(initials(a.n)) + '</span><span class="nm"><span>' + esc(a.n) + '</span><small>' + esc(a.mail || a.tel) + '</small></span></span></td><td>' + a.int + '</td><td class="tnum muted">' + a.at + '</td><td>' + (a.noc ? '<span class="badge bad">İzin yok</span>' : '<span class="badge ok">İzin var</span>') + '</td><td>' + (a.st !== 'open' ? '<span class="muted">' + esc(a.res) + '</span>' : sg ? '<span class="badge solid">Eşleşme önerisi</span>' : pv ? '<span class="badge">Aynı kişinin ikinci başvurusu</span>' : '<span class="muted">-</span>') + '</td></tr>';
      }).join('') || '<tr><td colspan="5" class="muted" style="padding:32px 0;text-align:center">Açık başvuru yok.</td></tr>';
    }
    SHARED.appAdd = (a) => {
      const open = APPS.filter((x) => x.st === 'open');
      if (open.some((x) => (a.mail && x.mail === a.mail) || (a.tel && x.tel === a.tel))) return 'dup';
      const m = stu.filter((s) => (a.mail && s.mail === a.mail) || (a.tel && s.tel === a.tel))[0];
      APPS.unshift(Object.assign({ id: APPS.reduce((n, x) => Math.max(n, x.id), 0) + 1, match: m ? { t: 'm', id: m.id, n: m.n, why: (a.mail && m.mail === a.mail ? 'E-posta' : 'Telefon numarası') + ' ' + m.n + ' kaydıyla aynı' } : null, st: 'open' }, a));
      lbAll(); return 'ok';
    };
    g('ba-f').addEventListener('click', (e) => { const b = e.target.closest('button[data-f]'); if (!b) return; bfil = b.getAttribute('data-f'); g('ba-f').querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); baRender(); });
    const baS = g('ba-sheet'), baSc = g('ba-scrim'); let baCur = null, baOp = null;
    function baCheck() {
      const a = baCur, act = segV('ba-act'), sg = suggest(a); let ok = false;
      g('ba-m-w').hidden = act !== 'link'; g('ba-why-w').hidden = act !== 'close';
      const nBtn = g('ba-act').querySelector('[data-v=new]'); nBtn.disabled = !!a.noc; if (a.noc && act === 'new') { segSet('ba-act', 'close'); return baCheck(); }
      let rows = [];
      if (act === 'new') { ok = true; rows = [['Aday', 'Yeni aday oluşur', 'Kaynak Web formu, aşama Yeni, sorumlu Ayşe Y.'], ['Takip', 'Ara, deneme dersi öner', 'Bugün, ' + 'Ayşe Y.'], ['Başvuru', 'Kapanır', 'Başvuru ayrı kayıt olarak adayın geçmişinde kalır.']]; }
      else if (act === 'link') { ok = !!g('ba-m').value; const v = g('ba-m').value, isL = v[0] === 'l', rec = isL ? LEADS.filter((l) => l.id === +v.slice(1))[0] : byId(+v.slice(1)); rows = [[isL ? 'Aday' : 'Üye', rec ? rec.n : '-', isL ? 'Aday kaydı değişmez, başvuru geçmişe eklenir.' : 'Üyenin ad, e-posta ve telefon bilgisi değişmez. Bu bilgileri yalnızca üyenin kendisi düzenler.'], ['Aday kaydı', 'Açılmaz', 'Mükerrer kayıt oluşmaz.'], ['Takip', 'Başvuru mesajı için takip planlanır', 'Bugün, Ayşe Y.']]; }
      else { ok = !!g('ba-why').value; rows = [['Başvuru', 'Kapanır', 'Silinmez, Tamamlanan sekmesinde kalır.'], ['Kişi kaydı', 'Oluşmaz', 'Hiçbir aday ya da üye kaydı değişmez.']]; }
      g('ba-eff').innerHTML = rows.map((r) => '<li><span class="row-l"><span>' + r[0] + '</span><b>' + esc(r[1]) + '</b></span><span class="ch">' + esc(r[2]) + '</span></li>').join(''); g('ba-ok').disabled = !ok;
    }
    function baOpen(a) {
      baOp = document.activeElement; baCur = a; const sg = suggest(a);
      g('ba-title').textContent = a.n; g('ba-sub').textContent = 'Başvuru #' + a.id + ' · ' + a.at;
      g('ba-facts').innerHTML = [['E-posta', a.mail || '-', ''], ['Telefon', a.tel || '-', ''], ['İlgi', a.int, ''], ['Mesaj', 'İletildi', a.msg], ['Onay kanıtı', a.cons, a.consAt || 'Kanıt kaydı yok']].map((r) => '<li><span class="row-l"><span>' + r[0] + '</span><b>' + esc(r[1]) + '</b></span>' + (r[2] ? '<span class="ch">' + esc(r[2]) + '</span>' : '') + '</li>').join('');
      const w = g('ba-warn'); const msgs = []; if (a.noc) msgs.push('İletişim izni yok. Başvuru aday olarak alınamaz, yalnızca kapatılabilir.'); if (sg) msgs.push(sg.why + '. Bu yalnızca öneridir, kayıtlar otomatik birleşmez.'); if (a.prev && !(sg && sg.t === 'l')) msgs.push('Aynı kişinin önceki başvurusu henüz işlenmedi. Bu başvuru ayrı geçmiş olarak durur.');
      w.hidden = !msgs.length; w.querySelector('span').textContent = msgs.join(' ');
      g('ba-m').innerHTML = '<optgroup label="Üyeler">' + stu.map((s) => '<option value="m' + s.id + '"' + (sg && sg.t === 'm' && sg.id === s.id ? ' selected' : '') + '>' + esc(s.n) + '</option>').join('') + '</optgroup><optgroup label="Adaylar">' + LEADS.map((l) => '<option value="l' + l.id + '"' + (sg && sg.t === 'l' && sg.id === l.id ? ' selected' : '') + '>' + esc(l.n) + '</option>').join('') + '</optgroup>';
      g('ba-why').value = ''; const done = a.st !== 'open'; g('ba-act-w').hidden = done; g('ba-eff').parentNode.hidden = done; g('ba-ok').hidden = done; g('ba-cancel').textContent = done ? 'Kapat' : 'Vazgeç';
      segSet('ba-act', a.noc ? 'close' : sg ? 'link' : 'new'); baCheck(); baS.hidden = false; baSc.hidden = false; g('ba-x').focus(); swap(baS);
    }
    function baClose() { baS.hidden = true; baSc.hidden = true; if (baOp && document.contains(baOp)) baOp.focus(); }
    g('ba-act').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b || b.disabled) return; segSet('ba-act', b.getAttribute('data-v')); baCheck(); });
    g('ba-form').addEventListener('change', baCheck); g('ba-form').addEventListener('submit', (e) => e.preventDefault());
    g('ba-x').addEventListener('click', baClose); g('ba-cancel').addEventListener('click', baClose); baSc.addEventListener('click', baClose);
    g('ba-ok').addEventListener('click', () => {
      if (g('ba-ok').disabled) return; const a = baCur, act = segV('ba-act');
      if (act === 'new') {
        const nl = { id: LEADS.length + 1, n: a.n, a: initials(a.n), mail: a.mail, tel: a.tel, src: 'Web formu', int: a.int, st: 'new', next: 'Ara, deneme dersi öner', due: BASE, owner: 'Ayşe Y.', note: a.msg, hist: [['4 Kas', 'Herkese açık sayfadan başvurdu: ' + a.int]] };
        LEADS.unshift(nl); tkAdd(L(nl.id), 'Arama', nl.next, BASE, 'Ayşe Y.'); a.st = 'lead'; a.lid = nl.id; a.res = 'Aday olarak alındı: ' + a.n; toast(a.n + ' aday olarak alındı, bugün için takip oluştu');
      } else if (act === 'link') {
        const v = g('ba-m').value, isL = v[0] === 'l', rec = isL ? LEADS.filter((l) => l.id === +v.slice(1))[0] : byId(+v.slice(1));
        if (isL) rec.hist.unshift(['4 Kas', 'Yeni başvuru: ' + a.int + ' · ' + a.msg]); tkAdd(isL ? L(rec.id) : M(rec.id), 'Arama', 'Başvuru mesajını yanıtla: ' + a.int, BASE, 'Ayşe Y.'); if (isL) lbDerive(rec);
        a.st = 'linked'; a.res = (isL ? 'Adayla' : 'Üyeyle') + ' eşleştirildi: ' + rec.n; toast('Başvuru ' + rec.n + ' ile eşleştirildi');
      } else { a.st = 'closed'; a.res = 'Kapatıldı: ' + g('ba-why').value; toast('Başvuru kapatıldı'); }
      baClose(); ldRender();
    });
    g('ba-body').addEventListener('click', (e) => { const tr = e.target.closest('tr[data-ba]'); if (tr) baOpen(APPS.filter((x) => x.id === +tr.getAttribute('data-ba'))[0]); });
    g('ba-body').addEventListener('keydown', (e) => { const tr = e.target.closest('tr[data-ba]'); if (tr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); baOpen(APPS.filter((x) => x.id === +tr.getAttribute('data-ba'))[0]); } });

    /* ---- Sekmeler ve ortak yenileme ---- */
    function lbAll() {
      g('lt-n-tasks').textContent = TASKS.filter((t) => !t.done && taskLive(t)).length;
      g('lt-tabs').querySelectorAll('[role=tab]').forEach((b) => b.setAttribute('aria-selected', String(b.getAttribute('data-lt') === ltab)));
      view('adaylar').querySelectorAll('[data-lp]').forEach((p) => { p.hidden = p.getAttribute('data-lp') !== ltab; });
      lbRender(); ltRender(); baRender();
    }
    g('lt-tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-lt]'); if (b) { ltab = b.getAttribute('data-lt'); lbAll(); } });
    document.addEventListener('keydown', (e) => { if (e.key !== 'Escape') return; if (!tkS.hidden) tkClose(); else if (!baS.hidden) baClose(); });

    uhRender(); mgAll(); ldRender(); swap(g('uh-dlg')); swap(sheet); swap(g('tk-sheet')); swap(g('ba-sheet'));
  })();
})();
