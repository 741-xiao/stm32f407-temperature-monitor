(() => {
  'use strict';

  const paths = {
    pulse: '<path d="M2 12h5l3-8 4 16 3-8h5"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    chart: '<path d="M4 3v17h17M8 14l4-5 4 3 5-7"/>',
    database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/>',
    leaf: '<path d="M20 3C9 2 3 8 5 15c2 7 15 6 15-12ZM3 22 16 8M9 16v-5M12 13h5"/>',
    layers: '<path d="m12 3 10 5-10 5L2 8l10-5ZM2 12l10 5 10-5M2 16l10 5 10-5"/>',
    refresh: '<path d="M20 7v5h-5M4 17v-5h5M5.5 7a7 7 0 0 1 11.7-2L20 8M4 16l2.8 3A7 7 0 0 0 18.5 17"/>',
    thermometer: '<path d="M9 14.5V5a3 3 0 0 1 6 0v9.5a5 5 0 1 1-6 0ZM12 10v7"/><circle cx="12" cy="18" r="1.3"/>',
    droplet: '<path d="M12 2S5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13ZM8 15a4 4 0 0 0 4 4"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/>',
    wind: '<path d="M3 8h12a3 3 0 1 0-3-3M2 12h17a3 3 0 1 1-3 3M4 16h5a3 3 0 1 1-3 3"/>',
    sliders: '<path d="M4 3v5M4 12v9M12 3v10M12 17v4M20 3v3M20 10v11"/><circle cx="4" cy="10" r="2"/><circle cx="12" cy="15" r="2"/><circle cx="20" cy="8" r="2"/>',
    bulb: '<path d="M9 18v-2c-7-5-3-13 3-13s10 8 3 13v2H9ZM9 21h6M10 8l2-1"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4"/>',
    ruler: '<path d="m3 16 13-13 5 5L8 21l-5-5ZM7 12l2 2M10 9l2 2M13 6l2 2"/>',
    person: '<circle cx="12" cy="6" r="3"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v.2"/>',
    search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
    download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    'chevron-left': '<path d="m14 6-6 6 6 6"/>',
    'chevron-right': '<path d="m10 6 6 6-6 6"/>'
  };
  document.querySelectorAll('[data-icon]').forEach(element => {
    element.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[element.dataset.icon] ?? paths.chart}</svg>`;
  });

  const $ = id => document.getElementById(id);
  const historyPage = document.body.dataset.page === 'history';
  const fields = {
    temp: { name: '温度', unit: '℃', color: '#cf7856' },
    hum: { name: '湿度', unit: '%RH', color: '#218d79' },
  };
  const state = { rows: [], limit: 30, metric: 'temp', query: '', page: 1, auto: true, loading: false, failed: false, synced: false };
  const charts = new Map();
  const pageSize = 10;
  let pollTimer;
  let toastTimer;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const setText = (id, value) => { if ($(id)) $(id).textContent = value; };
  const numeric = value => {
    if (value === null || value === undefined || String(value).trim() === '') return null;
    const result = Number(value);
    return Number.isFinite(result) ? result : null;
  };
  const format = value => {
    const number = numeric(value);
    return number === null ? '--' : number.toLocaleString('zh-CN', { maximumFractionDigits: 1 });
  };
  const presence = value => String(value) === '1' ? '有人' : String(value) === '0' ? '无人' : '--';
  const labelTime = value => String(value ?? '').replace('T', ' ').split(' ')[1]?.slice(0, 8) ?? String(value ?? '--');
  const windowRows = () => state.rows.slice(0, state.limit).reverse();
  const matchingRows = () => state.query ? state.rows.filter(row => [row.id, row.ip, row.colltime].some(value => String(value ?? '').toLowerCase().includes(state.query))) : state.rows;

  function showToast(message, warning = false) {
    clearTimeout(toastTimer);
    $('toast').textContent = message;
    $('toast').classList.toggle('warning', warning);
    $('toast').hidden = false;
    toastTimer = setTimeout(() => { $('toast').hidden = true; }, 5500);
  }

  /** Draw only actual sensor readings; missing readings remain gaps. */
  function drawChart(id, emptyId, key, rows) {
    if (!$(id)) return;
    const metric = fields[key];
    const values = rows.map(row => key === 'people' ? (presence(row[key]) === '--' ? null : Number(row[key])) : numeric(row[key]));
    const hasReadings = values.some(value => value !== null);
    const emptyElement = $(emptyId);
    if (!window.echarts) {
      emptyElement.hidden = false;
      emptyElement.querySelector('strong').textContent = '图表组件暂时无法加载';
      emptyElement.querySelector('p').textContent = '请刷新页面重试，采集记录仍可在首页查看';
      return;
    }
    emptyElement.hidden = hasReadings;
    if (!charts.has(id)) charts.set(id, window.echarts.init($(id)));
    const chart = charts.get(id);
    const peopleChart = key === 'people';
    const option = {
      animation: !reducedMotion,
      animationDuration: 250,
      animationDurationUpdate: 200,
      color: [metric.color],
      textStyle: { fontFamily: 'Segoe UI, Microsoft YaHei, sans-serif' },
      grid: { left: peopleChart ? 48 : 46, right: 22, top: 36, bottom: 32 },
      tooltip: { trigger: 'axis', renderMode: 'richText', confine: true, backgroundColor: '#fff', borderColor: '#e2eae5', textStyle: { color: '#566c5e', fontSize: 11 }, axisPointer: { lineStyle: { color: '#c5d6cb', type: 'dashed' } } },
      xAxis: { type: 'category', boundaryGap: false, data: rows.map(row => String(row.colltime ?? '--')), axisLine: { lineStyle: { color: '#e9efeb' } }, axisTick: { show: false }, axisLabel: { color: '#9aaa9e', fontSize: 9, margin: 12, formatter: labelTime, hideOverlap: true } },
      yAxis: { type: 'value', scale: !peopleChart, min: peopleChart ? 0 : undefined, max: peopleChart ? 1 : undefined, interval: peopleChart ? 1 : undefined, splitNumber: 3, name: metric.unit, nameTextStyle: { color: '#9aaa9e', fontSize: 9, align: 'right' }, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#9aaa9e', fontSize: 9, formatter: peopleChart ? value => value === 1 ? '有人' : '无人' : undefined }, splitLine: { lineStyle: { color: '#edf1ee', type: 'dashed' } } },
      series: [{ name: metric.name, type: 'line', data: values, smooth: false, step: peopleChart ? 'end' : false, connectNulls: false, symbol: 'circle', symbolSize: rows.length < 3 ? 7 : 5, showSymbol: rows.length < 3, lineStyle: { width: 2 }, itemStyle: { color: metric.color, borderColor: '#fff', borderWidth: 2 }, areaStyle: { opacity: 1, color: new window.echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: `${metric.color}21` }, { offset: 1, color: `${metric.color}02` }]) } }]
    };
    chart.setOption(option, true);
    $(id).setAttribute('aria-label', `${metric.name}趋势图，${rows.length} 条记录${hasReadings ? '' : '，暂无有效读数'}`);
  }

  function drawSpark(key, rows) {
    const target = $(`spark-${key}`);
    if (!target) return;
    const values = rows.slice(-20).map(row => numeric(row[key]));
    const valid = values.filter(value => value !== null);
    if (valid.length < 2) { target.replaceChildren(); return; }
    const min = Math.min(...valid);
    const span = Math.max(...valid) - min;
    let joined = false;
    const path = values.map((value, index) => {
      if (value === null) { joined = false; return ''; }
      const command = joined ? 'L' : 'M';
      joined = true;
      return `${command}${(index * 84 / (values.length - 1) + 3).toFixed(2)},${(span === 0 ? 15 : 26 - (value - min) / span * 22).toFixed(2)}`;
    }).join(' ');
    target.innerHTML = `<svg viewBox="0 0 90 30" width="100%" height="100%" aria-hidden="true"><path d="${path}" fill="none" stroke="${fields[key].color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  function renderOverview() {
    const latest = state.rows[0];
    const rows = windowRows();
    for (const key of ['temp', 'hum']) {
      const value = numeric(latest?.[key]);
      setText(`value-${key}`, format(value));
      const isWarm = key === 'temp' && latest?.alarm === 1;
      setText(`note-${key}`, value === null ? '等待采集' : isWarm ? `本次采集报警 · 阈值 ${format(latest?.threshold)} ℃` : '最近一次采集');
      $(`note-${key}`).classList.toggle('warning', isWarm);
      drawSpark(key, rows);
    }
    setText('value-threshold', `${format(latest?.threshold)} ℃`);
    setText('value-alarm', latest ? (latest.alarm === 1 ? '报警开启' : '报警关闭') : '等待采集');
    setText('sample-time', latest ? labelTime(latest.colltime) : '--');
    const age = latest ? Date.now() - new Date(String(latest.colltime).replace(' ', 'T') + '+08:00').getTime() : NaN;
    setText('sample-freshness', !latest ? '等待开发板上传第一条数据' : age > 8000 ? '暂未收到新数据：可能已停止采集或设备离线。表中为历史记录。' : '持续接收温湿度数据');
    setText('trend-caption', `最近 ${state.limit} 条采集记录 · 按时间顺序展示`);
    setText('chart-count', rows.length ? `已展示 ${rows.length} 条记录` : '暂无采集记录');
    setText('legend-label', `${fields[state.metric].name} / ${fields[state.metric].unit}`);
    $('legend-dot').style.backgroundColor = fields[state.metric].color;
    drawChart('main-chart', 'main-chart-empty', state.metric, rows);
    renderTable();
  }

  function renderHistory() {
    const rows = windowRows();
    const temperatures = rows.map(row => numeric(row.temp)).filter(value => value !== null);
    const humidities = rows.map(row => numeric(row.hum)).filter(value => value !== null);
    setText('history-count', rows.length);
    setText('history-max-temp', temperatures.length ? format(Math.max(...temperatures)) : '--');
    setText('history-avg-hum', humidities.length ? format(humidities.reduce((sum, value) => sum + value, 0) / humidities.length) : '--');
    const latestTime = state.rows[0]?.colltime;
    setText('history-last-time', latestTime ? labelTime(latestTime) : '--:--:--');
    setText('history-last-date', latestTime ? String(latestTime).slice(0, 10) : '等待采集');
    setText('history-caption', `当前展示 ${rows.length} 条记录，共 ${state.rows.length} 条 · 按时间顺序展示`);
    for (const key of Object.keys(fields)) drawChart(`chart-${key}`, `empty-${key}`, key, rows);
    $('export').disabled = rows.length === 0;
  }

  function renderTable() {
    const filtered = matchingRows();
    const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
    state.page = Math.min(state.page, pages);
    const first = (state.page - 1) * pageSize;
    const fragment = document.createDocumentFragment();
    for (const row of filtered.slice(first, first + pageSize)) {
      const tr = document.createElement('tr');
      for (const key of ['id', 'temp', 'hum', 'threshold', 'alarm', 'ip', 'colltime']) {
        const td = document.createElement('td');
        if (key === 'alarm') {
          const badge = document.createElement('span');
          badge.className = `presence-badge${row.alarm === 1 ? ' detected' : ''}`;
          badge.textContent = row.alarm === 1 ? '报警开启' : '报警关闭';
          td.append(badge);
        } else {
          td.textContent = ['id', 'ip', 'colltime'].includes(key) ? String(row[key] ?? '--') : format(row[key]);
        }
        if (key === 'temp' && row.alarm === 1) td.className = 'temperature-warning';
        tr.append(td);
      }
      fragment.append(tr);
    }
    $('records-empty').hidden = filtered.length > 0;
    setText('records-empty-title', state.failed && !state.synced ? '暂时无法读取数据' : state.query ? '没有找到匹配的记录' : '暂无采集记录');
    setText('records-empty-description', state.failed && !state.synced ? '请检查数据服务后重新加载' : state.query ? '试试其他 IP、时间或编号' : '设备上传数据后，采集记录会自动出现在这里');
    $('rows').replaceChildren(fragment);
    setText('record-total', state.rows.length.toLocaleString('zh-CN'));
    setText('page-summary', filtered.length ? `显示 ${first + 1}–${Math.min(first + pageSize, filtered.length)} 条，共 ${filtered.length} 条${state.query ? '匹配记录' : '记录'}` : '共 0 条记录');
    setText('page-number', `${state.page} / ${pages}`);
    $('previous-page').disabled = state.page <= 1;
    $('next-page').disabled = state.page >= pages;
    $('export').disabled = filtered.length === 0;
  }

  const render = () => { if (historyPage) renderHistory(); else renderOverview(); };
  const scheduleRefresh = () => { clearTimeout(pollTimer); if (state.auto) pollTimer = setTimeout(refresh, 2000); };

  async function refresh() {
    if (state.loading) return;
    clearTimeout(pollTimer);
    state.loading = true;
    $('refresh').disabled = true;
    $('retry').disabled = true;
    try {
      const response = await fetch('/selectAllCollData', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const rows = await response.json();
      if (!Array.isArray(rows) || rows.some(row => !row || typeof row !== 'object' || Array.isArray(row))) throw new Error('Unexpected data response');
      state.rows = rows;
      state.failed = false;
      state.synced = true;
      $('error-banner').hidden = true;
      setText('last-sync', `更新于 ${new Date().toLocaleTimeString('zh-CN', { hour12: false })}`);
      render();
    } catch (error) {
      state.failed = true;
      $('error-banner').hidden = false;
      setText('error-text', state.synced ? '数据更新失败，当前展示上次成功读取的记录。' : '暂时无法读取采集数据，请检查服务和数据库连接。');
      if (!state.synced) { setText('last-sync', '数据读取失败'); render(); }
    } finally {
      state.loading = false;
      $('refresh').disabled = false;
      $('retry').disabled = false;
      $('auto-refresh').classList.toggle('has-error', state.failed);
      scheduleRefresh();
    }
  }

  function exportCsv() {
    const rows = historyPage ? state.rows.slice(0, state.limit) : matchingRows();
    if (!rows.length) return;
    const keys = ['id', 'temp', 'hum', 'threshold', 'alarm', 'ip', 'colltime'];
    const header = ['编号', '温度(℃)', '湿度(%RH)', '报警阈值(℃)', '采集时报警', '设备IP', '采集时间'];
    const csvCell = value => {
      const text = String(value ?? '');
      const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
      return `"${safe.replace(/"/g, '""')}"`;
    };
    const developer = document.querySelector('.profile strong span')?.textContent ?? '';
    const student = document.querySelector('.profile small')?.textContent ?? '';
    const csv = [['开发者', developer, '学号', student], header, ...rows.map(row => keys.map(key => key === 'alarm' ? (row.alarm === 1 ? '报警开启' : '报警关闭') : row[key]))].map(row => row.map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `环境采集记录-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast(`已导出 ${rows.length} 条采集记录`);
  }

  $('today').dateTime = new Date().toISOString().slice(0, 10);
  $('today').textContent = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }).format(new Date());
  $('refresh').addEventListener('click', refresh);
  $('retry').addEventListener('click', refresh);
  $('auto-refresh').addEventListener('click', () => {
    state.auto = !state.auto;
    $('auto-refresh').setAttribute('aria-pressed', String(state.auto));
    setText('auto-label', state.auto ? '自动刷新 · 2 秒' : '自动刷新已暂停');
    if (state.auto) refresh(); else clearTimeout(pollTimer);
  });
  $('record-limit').addEventListener('change', event => { state.limit = Number(event.target.value); render(); });
  $('export').addEventListener('click', exportCsv);
  document.querySelectorAll('[data-metric]').forEach(button => button.addEventListener('click', () => {
    state.metric = button.dataset.metric;
    document.querySelectorAll('[data-metric]').forEach(item => {
      item.classList.toggle('selected', item === button);
      item.setAttribute('aria-pressed', String(item === button));
    });
    renderOverview();
  }));
  $('record-search')?.addEventListener('input', event => { state.query = event.target.value.trim().toLowerCase(); state.page = 1; renderTable(); });
  $('previous-page')?.addEventListener('click', () => { state.page = Math.max(1, state.page - 1); renderTable(); });
  $('next-page')?.addEventListener('click', () => { state.page += 1; renderTable(); });
  const observer = new ResizeObserver(() => { charts.forEach(chart => chart.resize()); });
  document.querySelectorAll('.chart-wrap').forEach(element => observer.observe(element));
  window.addEventListener('pagehide', () => { clearTimeout(pollTimer); clearTimeout(toastTimer); });
  window.addEventListener('pageshow', event => { if (event.persisted) { charts.forEach(chart => chart.resize()); if (state.auto) refresh(); } });
  refresh();
})();
