// app.js — application logic for the Veggie Tracker.
// Depends on VEGETABLES being defined in data.js (loaded before this file).

let state = {
  currentWeek: getWeekKey(new Date()),
  data: {},
  filter: '',
  category: 'All'
};

try {
  const s = localStorage.getItem('vegtracker');
  if (s) state.data = JSON.parse(s);
} catch (e) {}

// ---------- Category stacked bar chart (Trends tab) ----------

// Distinct colors per category for the stacked bar chart
const CATEGORY_COLORS = {
  "Vegetables": "#1D9E75",
  "Root veg": "#C2702D",
  "Brassicas": "#3E8E4F",
  "Squash": "#E8A33D",
  "Legumes": "#7A9D54",
  "Alliums": "#9B6FB0",
  "Leafy greens": "#4F9D69",
  "Fungi": "#8B7355",
  "Fruits": "#E24B4A",
  "Berries": "#5B6EE1",
  "Citrus": "#F2A93B",
  "Tropical": "#F26B4A"
};

let categoryChart = null;

function renderCategoryChart() {
  const weeks = Object.keys(state.data).sort();
  const canvas = document.getElementById('category-chart');
  const wrap = canvas.parentElement;
  if (!weeks.length) {
    if (categoryChart) { categoryChart.destroy(); categoryChart = null; }
    wrap.style.display = 'none';
    return;
  }
  wrap.style.display = '';

  const categories = [...new Set(VEGETABLES.map(v => v.cat))];
  const catOf = {};
  VEGETABLES.forEach(v => { catOf[v.name] = v.cat; });

  // counts[week][category] = number of distinct plants logged in that category that week
  const counts = weeks.map(wk => {
    const row = {};
    categories.forEach(c => { row[c] = 0; });
    (state.data[wk] || []).forEach(name => {
      const cat = catOf[name];
      if (cat) row[cat]++;
    });
    return row;
  });

  const datasets = categories.map(cat => ({
    label: cat,
    data: counts.map(row => row[cat]),
    backgroundColor: CATEGORY_COLORS[cat] || '#999999'
  })).filter(ds => ds.data.some(v => v > 0));

  const labels = weeks.map(weekKeyToLabel);

  if (categoryChart) categoryChart.destroy();
  categoryChart = new Chart(canvas, {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
        tooltip: {
          callbacks: {
            footer: items => {
              const total = items.reduce((sum, i) => sum + i.parsed.y, 0);
              return `Total: ${total} plants`;
            }
          }
        }
      },
      scales: {
        x: { stacked: true, title: { display: true, text: 'Week' } },
        y: { stacked: true, beginAtZero: true, ticks: { precision: 0 }, title: { display: true, text: 'Plants eaten' } }
      }
    }
  });
}

// ---------- Week helpers ----------

function getWeekKey(d) {
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const wk = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(wk).padStart(2, '0')}`;
}

function weekKeyToLabel(k) {
  const [y, w] = k.split('-W');
  const jan1 = new Date(+y, 0, 1);
  const days = (jan1.getDay() <= 4 ? 1 - jan1.getDay() : 8 - jan1.getDay());
  const mon = new Date(jan1.getTime() + (+w - 1) * 7 * 86400000 + days * 86400000);
  const sun = new Date(mon.getTime() + 6 * 86400000);
  const fmt = d => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return `${fmt(mon)} – ${fmt(sun)}`;
}

function changeWeek(dir) {
  const [y, w] = state.currentWeek.split('-W');
  const d = new Date(+y, 0, (+w) * 7);
  d.setDate(d.getDate() + dir * 7);
  state.currentWeek = getWeekKey(d);
  renderLog();
}

function getCurrentSelected() {
  return (state.data[state.currentWeek] || []);
}

function isSelected(name) {
  return getCurrentSelected().includes(name);
}

// ---------- Weekly log panel ----------

function renderLog() {
  document.getElementById('week-label').textContent = weekKeyToLabel(state.currentWeek);
  document.getElementById('sel-count').textContent = getCurrentSelected().length;
  const cats = ['All', ...new Set(VEGETABLES.map(v => v.cat))];
  document.getElementById('cat-filter').innerHTML = cats.map(c =>
    `<button class="cat-btn${state.category === c ? ' active' : ''}" onclick="setCategory('${c}')">${c}</button>`
  ).join('');
  filterVeg();
}

function setCategory(c) {
  state.category = c;
  renderLog();
}

function filterVeg() {
  const q = (document.getElementById('search-input') || { value: '' }).value.toLowerCase();
  const items = VEGETABLES.filter(v => {
    const matchQ = !q || v.name.toLowerCase().includes(q) || v.cat.toLowerCase().includes(q);
    const matchC = state.category === 'All' || v.cat === state.category;
    return matchQ && matchC;
  });
  document.getElementById('veg-grid').innerHTML = items.map(v => {
    const s = isSelected(v.name);
    return `<div class="veg-card${s ? ' selected' : ''}" onclick="toggleVeg('${v.name}')" role="checkbox" aria-checked="${s}" tabindex="0" onkeydown="if(event.key===' ')toggleVeg('${v.name}')">
      <span class="veg-emoji">${v.emoji}</span>
      <span class="veg-name">${v.name}</span>
      <span class="veg-cat">${v.cat}</span>
      ${s ? '<span class="veg-check"><i class="ti ti-check"></i> added</span>' : ''}
    </div>`;
  }).join('');
}

function toggleVeg(name) {
  const sel = [...getCurrentSelected()];
  const idx = sel.indexOf(name);
  if (idx >= 0) sel.splice(idx, 1); else sel.push(name);
  state.data[state.currentWeek] = sel;
  save();
  renderLog();
}

function saveWeek() {
  save();
  const n = getCurrentSelected().length;
  showToast(`Week saved! ${n} plant${n !== 1 ? 's' : ''} logged ✓`);
}

function save() {
  try { localStorage.setItem('vegtracker', JSON.stringify(state.data)); } catch (e) {}
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// ---------- Export ----------

function exportCSV() {
  const rows = [['Week', 'Date range', 'Vegetables & Fruits', 'Count']];
  Object.entries(state.data).sort().forEach(([k, v]) => {
    rows.push([k, weekKeyToLabel(k), v.join('; '), v.length]);
  });
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'veggie-tracker.csv';
  a.click();
  showToast('CSV exported!');
}

// ---------- Import ----------

function triggerImport() {
  document.getElementById('import-file').value = '';
  document.getElementById('import-file').click();
}

function handleImport(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      let imported = {};
      if (file.name.endsWith('.json')) {
        imported = JSON.parse(e.target.result);
        if (typeof imported !== 'object' || Array.isArray(imported)) throw new Error('Invalid JSON structure');
        Object.keys(imported).forEach(k => {
          if (!/^\d{4}-W\d{2}$/.test(k)) throw new Error(`Unexpected key: ${k}`);
        });
      } else if (file.name.endsWith('.csv')) {
        const lines = e.target.result.trim().split('\n').slice(1); // skip header
        lines.forEach(line => {
          const cols = line.match(/(".*?"|[^,]+)/g) || [];
          const clean = cols.map(c => c.replace(/^"|"$/g, '').replace(/""/g, '"'));
          const weekKey = clean[0];
          const plants = clean[2] ? clean[2].split(';').map(s => s.trim()).filter(Boolean) : [];
          if (weekKey && /^\d{4}-W\d{2}$/.test(weekKey)) imported[weekKey] = plants;
        });
      } else {
        throw new Error('Unsupported file type');
      }
      const existingWeeks = Object.keys(state.data).length;
      const importedWeeks = Object.keys(imported).length;
      if (!importedWeeks) { showToast('No valid data found in file.'); return; }
      // Merge: imported data takes precedence for matching weeks
      state.data = { ...state.data, ...imported };
      save();
      renderLog();
      showToast(`Imported ${importedWeeks} week${importedWeeks !== 1 ? 's' : ''} (${existingWeeks} already saved) ✓`);
    } catch (err) {
      showToast('Import failed: ' + err.message);
    }
  };
  reader.readAsText(file);
}

// ---------- Trends panel ----------

function renderTrends() {
  const all = {};
  VEGETABLES.forEach(v => { all[v.name] = 0; });
  Object.values(state.data).forEach(list => list.forEach(n => { if (all[n] !== undefined) all[n]++; }));
  const totalWeeks = Object.keys(state.data).length;
  const sorted = Object.entries(all).sort((a, b) => a[1] - b[1]);
  const maxCount = Math.max(...Object.values(all), 1);
  const c = document.getElementById('trend-content');
  if (!totalWeeks) {
    c.innerHTML = '<div class="no-data"><i class="ti ti-leaf" style="font-size:32px"></i><p style="margin-top:8px">Save some weeks first to see trends.</p></div>';
    return;
  }
  const never = sorted.filter(([, n]) => n === 0);
  const rare = sorted.filter(([, n]) => n > 0 && n <= Math.ceil(totalWeeks * 0.3));
  const good = sorted.filter(([, n]) => n > Math.ceil(totalWeeks * 0.3));

  // Category totals: sum of times-eaten across every plant in each category
  const categoryTotals = {};
  VEGETABLES.forEach(v => { categoryTotals[v.cat] = (categoryTotals[v.cat] || 0) + all[v.name]; });
  const categorySorted = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
  const maxCatCount = Math.max(...Object.values(categoryTotals), 1);

  const categoryChartHTML = () => {
    const totalServings = Object.values(categoryTotals).reduce((a, b) => a + b, 0);
    if (!totalServings) return '';
    return `<div class="trend-group">
      <div class="section-label">All-time category totals</div>
      ${categorySorted.map(([cat, count]) => {
        if (count === 0) return '';
        const pct = Math.round((count / maxCatCount) * 100);
        const share = totalServings ? Math.round((count / totalServings) * 100) : 0;
        return `<div class="trend-bar-wrap">
          <div class="trend-bar-header">
            <span class="trend-bar-name">${cat}</span>
            <span class="trend-bar-count">${count} servings · ${share}%</span>
          </div>
          <div class="trend-bar-bg"><div class="trend-bar-fill" style="width:${pct}%"></div></div>
        </div>`;
      }).join('')}
    </div>`;
  };

  const sectionHTML = (title, items, colorClass) => {
    if (!items.length) return '';
    return `<div class="trend-group">
      <div class="section-label">${title}</div>
      ${items.slice(0, 20).map(([name, count]) => {
        const pct = Math.round((count / maxCount) * 100);
        const veg = VEGETABLES.find(v => v.name === name) || { emoji: '🌿' };
        return `<div class="trend-bar-wrap">
          <div class="trend-bar-header">
            <span class="trend-bar-name">${veg.emoji} ${name}</span>
            <span class="trend-bar-count">${count} / ${totalWeeks} weeks</span>
          </div>
          <div class="trend-bar-bg"><div class="trend-bar-fill ${colorClass}" style="width:${pct}%"></div></div>
        </div>`;
      }).join('')}
    </div>`;
  };

  c.innerHTML = `<div class="stats-row">
    <div class="stat-card"><div class="stat-val">${totalWeeks}</div><div class="stat-lbl">Weeks tracked</div></div>
    <div class="stat-card"><div class="stat-val">${Object.values(all).filter(n => n > 0).length}</div><div class="stat-lbl">Plants tried</div></div>
    <div class="stat-card"><div class="stat-val">${never.length}</div><div class="stat-lbl">Never eaten</div></div>
  </div>`
    + categoryChartHTML()
    + sectionHTML('Never eaten — try these!', never.slice(0, 15), 'low')
    + sectionHTML('Occasionally', rare.slice(0, 10), 'mid')
    + sectionHTML('Regulars', good.slice(-10).reverse(), '');
}

// ---------- History panel ----------

function renderHistory() {
  const c = document.getElementById('history-content');
  const weeks = Object.keys(state.data).sort().reverse();
  if (!weeks.length) {
    c.innerHTML = '<div class="no-data">No history yet. Start logging!</div>';
    return;
  }
  c.innerHTML = `<div style="display:flex;justify-content:flex-end;gap:8px;margin-bottom:1rem">
    <button class="export-btn" onclick="triggerImport()"><i class="ti ti-upload"></i> Import</button>
    <button class="export-btn" onclick="exportCSV()"><i class="ti ti-download"></i> Export CSV</button>
  </div>` +
    weeks.map(k => {
      const items = state.data[k] || [];
      const isCurrent = k === getWeekKey(new Date());
      return `<div class="history-week">
        <div class="history-week-head"><span>${weekKeyToLabel(k)}${isCurrent ? ' (this week)' : ''}</span><span style="color:var(--text-secondary)">${items.length} plants</span></div>
        <div class="history-week-body">${items.map(n => { const v = VEGETABLES.find(x => x.name === n) || { emoji: '🌿' }; return `<span class="pill">${v.emoji} ${n}</span>`; }).join('')}</div>
      </div>`;
    }).join('');
}

// ---------- Tab switching ----------

function switchTab(tab) {
  document.querySelectorAll('.tab').forEach((t, i) =>
    t.classList.toggle('active', ['log', 'trends', 'history'][i] === tab)
  );
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.getElementById('panel-' + tab).classList.add('active');
  if (tab === 'trends') { renderCategoryChart(); renderTrends(); }
  if (tab === 'history') renderHistory();
}

// ---------- Init ----------

renderLog();
