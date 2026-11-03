/* Student Points — browser-local classroom records. */
(() => {
  'use strict';
  const Core = window.PointsCore;
  const KEY = 'classroom-student-points-v1';
  const $ = (selector, root = document) => root.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const icons = {
    book:'<path d="M12 7c-2-2-6-3-10-2v14c4-1 8 0 10 2m0-14c2-2 6-3 10-2v14c-4-1-8 0-10 2V7Z"/>',
    users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/><circle cx="9" cy="7" r="4"/>',
    rules:'<path d="M9 5h11M9 12h11M9 19h11M3 5h.01M3 12h.01M3 19h.01"/>',
    edit:'<path d="m16 3 5 5M4 20l4-1L21 6a2.1 2.1 0 0 0-3-3L5 16l-1 4Z"/>',
    chart:'<path d="M3 3v18h18M7 16v-5m5 5V7m5 9V4"/>',
    history:'<path d="M3 11a9 9 0 1 1 2.5 7M3 4v7h7m2-4v5l3 2"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 16v4h16v-4"/>',
    download:'<path d="M12 3v13m-5-5 5 5 5-5M4 16v4h16v-4"/>',
    file:'<path d="M14 2H5v20h14V7l-5-5Zm0 0v6h5M8 13h8m-8 4h6"/>',
    search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',
    check:'<path d="m5 12 4 4L19 6"/>',
    close:'<path d="m6 6 12 12M6 18 18 6"/>',
    shield:'<path d="m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6l9-4Z"/><path d="m8 12 3 3 5-6"/>',
    trophy:'<path d="M8 3h8v6a4 4 0 0 1-8 0V3Zm0 2H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4M12 13v6m-5 2h10m-8-2h6"/>',
    calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
    trash:'<path d="M3 6h18M9 6V3h6v3m-10 0 1 15h12l1-15M10 10v7m4-7v7"/>',
    undo:'<path d="M3 10h11a6 6 0 0 1 0 12M3 10l6-6m-6 6 6 6"/>',
    spark:'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z"/>'
  };
  const icon = (name, size = 20) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.file}</svg>`;
  const uid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  const signed = n => `${n > 0 ? '+' : ''}${Number(n.toPrecision(12))}`;
  const num = n => Number(n.toPrecision(12)).toLocaleString('zh-CN',{maximumFractionDigits:12});
  let state = Core.createState();
  let bootError = '', originalData = '';
  try { originalData = localStorage.getItem(KEY) || ''; if(originalData) state = Core.validateState(JSON.parse(originalData)); }
  catch(error) { bootError = '原有本地数据无法读取。请先导出原始数据，再恢复备份或重置。'; }
  let persistedRaw = originalData;
  let tab = 'students', search = '', classFilter = '', ruleFilter = 'all', overviewSort = 'score', detailSign = 'all', detailFrom = '', detailTo = '', detailStudentId = '';
  let selected = new Set(), entrySearch = '', entryClass = '';
  let draft = {ruleId:state.rules[0]?.id || 'other',points:state.rules[0]?.points || 1,date:today(),note:'',reason:''};
  let importBusy = false, lastFocus;

  function toast(message, error = false) {
    const el = document.createElement('div'); el.className = `toast${error ? ' toast-error' : ''}`;
    el.innerHTML = `${icon(error ? 'close' : 'check')}<span>${esc(message)}</span>`;
    $('#toast-stack').append(el); setTimeout(() => el.remove(), 5500);
  }
  function commit(next, message) {
    if(bootError) { toast('请先处理上方的数据恢复提示，避免覆盖原始数据。', true); return false; }
    try {
      const latestRaw=localStorage.getItem(KEY) || '';
      if(latestRaw !== persistedRaw) {
        state=latestRaw?Core.validateState(JSON.parse(latestRaw)):Core.createState();
        persistedRaw=latestRaw;closeModal();render();
        toast('另一页面已更新数据，本次保存已暂停。请检查最新数据后重新操作。',true);
        return false;
      }
      next = Core.validateState(next);
      const raw=JSON.stringify(next);
      localStorage.setItem(KEY, raw);persistedRaw=raw;
      state = next; selected = new Set([...selected].filter(id => state.students.some(s => s.id === id)));
      $('#save-status').innerHTML = `${icon('check',14)} 已保存到本地`;
      render(); if(message) toast(message); return true;
    } catch(error) { toast(`保存失败：${error.message}。请检查浏览器存储空间。`,true); return false; }
  }
  function classes() { return [...new Set(state.students.map(s => s.className))].sort((a,b) => a.localeCompare(b,'zh-CN')); }
  function classOptions(current, label = '全部班级') { return `<option value="">${label}</option>${classes().map(c => `<option value="${esc(c)}" ${current === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}`; }
  function matchStudent(s, term = search, cls = classFilter) { return (!cls || s.className === cls) && (!term || `${s.number} ${s.name} ${s.className}`.toLowerCase().includes(term.trim().toLowerCase())); }
  function filteredStudents() { return state.students.filter(s => matchStudent(s)); }
  function empty(title, description, action = '') { return `<div class="empty-state"><div class="empty-icon">${icon('book',36)}</div><h3>${title}</h3><p>${description}</p>${action}</div>`; }
  function searchBox(id, value, placeholder = '搜索姓名、学号或班级') { return `<div class="search-field">${icon('search',18)}<input id="${id}" class="input" value="${esc(value)}" placeholder="${placeholder}" aria-label="${placeholder}"></div>`; }
  function heading(title, description, controls = '') { return `<div class="section-heading"><div><h2>${title}</h2><p>${description}</p></div><div class="toolbar">${controls}</div></div>`; }
  function renderStats() {
    const average = state.students.length ? state.students.reduce((sum,s) => sum + Core.studentScore(state,s),0) / state.students.length : 0;
    const items = [['users','学生人数',state.students.length,'人',`${classes().length} 个班级`],['chart','班级平均积分',state.students.length ? num(Number(average.toFixed(2))) : '—','分','全部学生均分 · 保留两位小数'],['rules','积分规则',state.rules.length,'项','加减分规则自由设置'],['history','本月积分记录',state.records.filter(r => r.date.slice(0,7) === today().slice(0,7)).length,'条','每一笔变动都有迹可循']];
    $('#stats').innerHTML = items.map(([i,label,value,unit,detail]) => `<div class="stat-card"><span class="stat-icon">${icon(i,23)}</span><div class="stat-info"><small>${label}</small><strong>${value}<em>${unit}</em></strong><span class="stat-context">${detail}</span></div></div>`).join('');
  }
  function render() {
    renderStats();
    const tabs = [['students','users','学生管理'],['rules','rules','积分规则管理'],['entry','edit','积分录入'],['overview','chart','积分总览'],['details','history','变动明细']];
    $('#tabs').innerHTML = tabs.map(([id,i,label]) => `<button class="tab-button ${id === tab ? 'active' : ''}" data-action="tab" data-id="${id}" ${id === tab ? 'aria-current="page"' : ''}>${icon(i,19)}<span>${label}</span></button>`).join('');
    $('#view').innerHTML = (bootError ? `<div class="notice notice-warning">${esc(bootError)} <button class="btn btn-secondary btn-sm" data-action="raw-backup">导出原始数据</button> <button class="btn btn-danger btn-sm" data-action="reset-corrupt">重置本地数据</button></div>` : '') + ({students:studentsView,rules:rulesView,entry:entryView,overview:overviewView,details:detailsView}[tab])();
  }
  function studentsView() {
    return heading('学生名单管理','先导入学生名单，再开始记录班级的每一次进步。',`<button class="btn btn-secondary" data-action="export-students">${icon('download',17)} 导出名单</button><button class="btn btn-primary" data-action="add-student">${icon('plus',18)} 手动新增学生</button>`) +
      `<div class="import-layout"><div class="dropzone" id="dropzone"><span class="dropzone-icon">${icon('upload',30)}</span><h3>导入学生名单</h3><p>拖拽文件到这里，或点击按钮选择文件</p><label class="btn btn-primary file-label">${icon('plus',17)} 选择 Excel / CSV 文件<input id="student-file" type="file" accept=".xlsx,.xls,.csv" class="sr-only"></label><small>支持 .xlsx / .xls / .csv，最大 10 MB · 相同学号自动跳过</small></div><aside class="template-card"><span class="template-icon">${icon('file',26)}</span><h3>从标准模板开始</h3><p>必须包含「学号、姓名、班级」三列。初始积分可选，留空默认为 60 分。</p><button class="btn btn-secondary" data-action="template">${icon('download',17)} 下载 Excel 模板</button><small>学号建议设为文本格式</small></aside></div>` +
      `<div class="section-heading list-heading"><div><h3>全部学生 <span class="count-label">${state.students.length}</span></h3><p>名单和积分变动自动保存在当前浏览器</p></div><div class="filters">${searchBox('student-search',search)}<select class="input" id="student-class" aria-label="筛选班级">${classOptions(classFilter)}</select></div></div><div id="student-table">${studentTable()}</div>`;
  }
  function studentTable() {
    const students = filteredStudents();
    if(!state.students.length) return empty('还没有学生，先导入一份名单吧','支持 Excel 批量导入，也可以手动添加。');
    if(!students.length) return empty('没有找到符合条件的学生','试试其他姓名、学号或班级。');
    return `<div class="table-wrap"><table class="data-table"><thead><tr><th>学号</th><th>姓名</th><th>班级</th><th>初始积分</th><th>当前积分</th><th class="text-right">操作</th></tr></thead><tbody>${students.map(s => `<tr><td class="subtle nowrap">${esc(s.number)}</td><td><div class="student-name"><span class="avatar">${esc(s.name.slice(0,1))}</span><strong>${esc(s.name)}</strong></div></td><td>${esc(s.className)}</td><td>${num(s.initialScore)} <span class="muted">分</span></td><td><strong class="score-pill">${num(Core.studentScore(state,s))}</strong></td><td class="text-right nowrap"><button class="btn btn-ghost btn-sm" data-action="edit-student" data-id="${esc(s.id)}">编辑</button><button class="btn btn-ghost btn-sm negative" data-action="delete-student" data-id="${esc(s.id)}">删除</button></td></tr>`).join('')}</tbody></table></div><div class="table-footer">共 ${students.length} 名学生</div>`;
  }
  function rulesView() {
    const plus = state.rules.filter(r => r.points > 0).length;
    return heading('自定义积分规则库','把班级约定变成规则，录入时一键选择、自动带出分值。',`<button class="btn btn-primary" data-action="add-rule">${icon('plus',18)} 添加新规则</button>`) +
      `<div class="notice notice-info">${icon('spark',19)} 已内置你提供的 11 项积分规则；可随时新增、编辑或删除。“其他事项”在积分录入时自由填写分值。</div><div class="section-heading list-heading"><div class="segmented"><button class="btn btn-sm ${ruleFilter === 'all' ? 'btn-primary' : 'btn-ghost'}" data-action="filter-rule" data-id="all">全部 ${state.rules.length}</button><button class="btn btn-sm ${ruleFilter === 'positive' ? 'btn-primary' : 'btn-ghost'}" data-action="filter-rule" data-id="positive">加分 ${plus}</button><button class="btn btn-sm ${ruleFilter === 'negative' ? 'btn-primary' : 'btn-ghost'}" data-action="filter-rule" data-id="negative">扣分 ${state.rules.length-plus}</button></div></div><div class="rule-grid">${state.rules.filter(r => ruleFilter === 'all' || (ruleFilter === 'positive' ? r.points > 0 : r.points < 0)).map(r => `<article class="rule-card"><div class="rule-copy"><span class="badge ${r.points > 0 ? 'badge-positive' : 'badge-negative'}">${r.points > 0 ? '加分' : '扣分'}</span><h3>${esc(r.name)}</h3><div class="rule-actions"><button class="btn btn-ghost btn-sm" data-action="edit-rule" data-id="${esc(r.id)}">编辑</button><button class="btn btn-ghost btn-sm" data-action="delete-rule" data-id="${esc(r.id)}">删除</button></div></div><div class="rule-points ${r.points > 0 ? 'positive' : 'negative'}">${signed(r.points)}<small>分</small></div></article>`).join('')}</div><div class="notice subtle">${icon('shield',18)} 修改或删除规则不会影响已经录入的历史积分。</div>`;
  }
  function entryView() {
    if(!state.students.length) return heading('积分录入','选择学生和积分事项，一次完成批量记录。') + empty('先添加学生，再录入积分','导入名单后，就可以为一名或多名学生同时加减分。',`<button class="btn btn-primary" data-action="tab" data-id="students">去导入名单 ${icon('arrow',17)}</button>`);
    if(draft.ruleId !== 'other' && !state.rules.some(r => r.id === draft.ruleId)) { draft.ruleId='other'; draft.points=1; }
    return heading('积分录入','选择学生 → 选择规则 → 确认提交，支持一次记录多名学生。') +
      `<div class="entry-layout"><section class="panel"><div class="panel-title"><h3><span class="step-number">1</span> 选择学生</h3><span class="muted" id="selected-count">已选 ${selected.size} 人</span></div><div class="filters">${searchBox('entry-search',entrySearch,'搜索姓名或学号')}<select class="input" id="entry-class" aria-label="录入时筛选班级">${classOptions(entryClass)}</select></div><div class="picker-toolbar"><button class="btn btn-ghost btn-sm" data-action="select-visible">全选筛选结果</button><button class="btn btn-ghost btn-sm" data-action="clear-selected">清空选择</button></div><div class="student-picker" id="student-picker">${studentPicker()}</div></section><section class="panel"><div class="panel-title"><h3><span class="step-number">2</span> 填写积分事项</h3></div><form id="entry-form"><div class="field"><label for="entry-rule">积分规则</label><select class="input" id="entry-rule">${state.rules.map(r => `<option value="${esc(r.id)}" ${draft.ruleId === r.id ? 'selected' : ''}>${esc(r.name)}（${signed(r.points)}）</option>`).join('')}<option value="other" ${draft.ruleId === 'other' ? 'selected' : ''}>其他事项（班主任自主裁量）</option></select></div><div class="field ${draft.ruleId !== 'other' ? 'hidden' : ''}" id="reason-field"><label for="entry-reason">具体事项 <span class="negative">*</span></label><input class="input" id="entry-reason" maxlength="100" value="${esc(draft.reason)}" placeholder="例如：主动帮助同学" ${draft.ruleId === 'other' ? 'required' : ''}></div><div class="form-grid"><div class="field"><label for="entry-points">变动分值</label><input class="input" id="entry-points" type="number" step="any" min="-100000" max="100000" required value="${draft.points}" ${draft.ruleId !== 'other' ? 'readonly' : ''}><small>正数加分，负数扣分</small></div><div class="field"><label for="entry-date">发生日期</label><input class="input" id="entry-date" type="date" required value="${esc(draft.date)}"></div></div><div class="field"><label for="entry-note">备注 <span class="muted">（选填）</span></label><textarea class="input" id="entry-note" rows="3" maxlength="500" placeholder="补充说明，方便日后查看">${esc(draft.note)}</textarea></div><div class="entry-preview" id="entry-preview">${entryPreview()}</div><button class="btn btn-primary full-width" type="submit">${icon('check',18)} 确认录入积分</button><p class="form-hint">提交前会再次确认，录入后可在变动明细中撤销。</p></form></section></div>`;
  }
  function studentPicker() {
    const list = state.students.filter(s => matchStudent(s,entrySearch,entryClass));
    return list.length ? list.map(s => `<label class="student-option ${selected.has(s.id) ? 'selected' : ''}"><input type="checkbox" data-student-id="${esc(s.id)}" ${selected.has(s.id) ? 'checked' : ''}><span class="avatar">${esc(s.name.slice(0,1))}</span><span class="student-option-info"><strong>${esc(s.name)}</strong><small>${esc(s.className)} · ${esc(s.number)}</small></span><span class="score-pill">${num(Core.studentScore(state,s))} 分</span></label>`).join('') : empty('没有匹配的学生','请调整搜索或班级筛选。');
  }
  function entryPreview() { return `<div><span class="muted">本次将为</span><strong>${selected.size} <small>名学生</small></strong></div><div><span class="muted">每人${Number(draft.points) >= 0 ? '增加' : '扣除'}</span><strong class="${Number(draft.points) >= 0 ? 'positive' : 'negative'}">${Math.abs(Number(draft.points) || 0)} <small>分</small></strong></div>`; }
  function updatePicker() { $('#student-picker').innerHTML = studentPicker(); $('#selected-count').textContent = `已选 ${selected.size} 人`; $('#entry-preview').innerHTML=entryPreview(); }
  function overviewView() {
    return heading('积分总览','了解班级整体状态，也看见每一位学生的成长。',`<button class="btn btn-secondary" data-action="export-overview">${icon('download',17)} 导出积分总览</button>`) +
      `<div class="section-heading list-heading"><div class="filters">${searchBox('overview-search',search)}<select class="input" id="overview-class" aria-label="总览筛选班级">${classOptions(classFilter)}</select></div><select class="input" id="overview-sort" aria-label="排序方式"><option value="score" ${overviewSort === 'score' ? 'selected' : ''}>按积分从高到低</option><option value="number" ${overviewSort === 'number' ? 'selected' : ''}>按学号排序</option></select></div><div id="overview-table">${overviewTable()}</div>`;
  }
  function rankedStudents() { return [...filteredStudents()].sort((a,b) => overviewSort === 'number' ? a.number.localeCompare(b.number,'zh-CN',{numeric:true}) : Core.studentScore(state,b)-Core.studentScore(state,a) || a.number.localeCompare(b.number,'zh-CN',{numeric:true})); }
  function overviewTable() {
    const list = rankedStudents();
    if(!list.length) return empty(state.students.length ? '没有符合条件的学生' : '还没有可展示的积分','导入学生名单后，这里将自动生成积分总览。');
    let previousScore,rank=0;
    return `<div class="table-wrap"><table class="data-table"><thead><tr><th>${overviewSort === 'score' ? '排名' : '序号'}</th><th>学生</th><th>班级</th><th>初始积分</th><th>累计加分</th><th>累计扣分</th><th>当前积分</th><th class="text-right">操作</th></tr></thead><tbody>${list.map((s,index) => { const t=Core.studentTotals(state,s); if(t.score !== previousScore) rank=index+1;previousScore=t.score;return `<tr><td><span class="ranking-position ${overviewSort === 'score' && rank<=3 ? 'rank-top' : ''}">${overviewSort === 'score' ? rank : index+1}</span></td><td><div class="student-name"><span class="avatar">${esc(s.name.slice(0,1))}</span><span><strong>${esc(s.name)}</strong><small class="muted">${esc(s.number)}</small></span></div></td><td>${esc(s.className)}</td><td>${num(t.initialScore)}</td><td class="positive">${signed(t.added)}</td><td class="negative">${signed(t.deducted)}</td><td><strong class="score-total">${num(t.score)}</strong><small class="muted"> 分</small></td><td class="text-right"><button class="btn btn-ghost btn-sm" data-action="student-details" data-id="${esc(s.id)}">查看明细 ${icon('arrow',14)}</button></td></tr>`; }).join('')}</tbody></table></div><div class="table-footer">共 ${list.length} 名学生${overviewSort === 'score' ? ' · 相同积分并列排名（当前筛选范围）' : ''}</div>`;
  }
  function detailRecords() {
    return state.records.filter(r => { const s=state.students.find(s => s.id === r.studentId); return s && (!detailStudentId || r.studentId===detailStudentId) && matchStudent(s) && (detailSign==='all' || (detailSign==='positive' ? r.points>0 : r.points<0)) && (!detailFrom || r.date>=detailFrom) && (!detailTo || r.date<=detailTo); }).sort((a,b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  }
  function detailsView() {
    return heading('积分变动明细','每一笔加减分都有记录，支持按学生、班级和日期筛选。',`<button class="btn btn-secondary" data-action="export-details">${icon('download',17)} 导出变动明细</button>`) +
      `<div class="filters detail-filters">${searchBox('detail-search',search)}<select class="input" id="detail-class" aria-label="明细筛选班级">${classOptions(classFilter)}</select><select class="input" id="detail-sign" aria-label="变动类型"><option value="all">全部类型</option><option value="positive" ${detailSign==='positive'?'selected':''}>加分</option><option value="negative" ${detailSign==='negative'?'selected':''}>扣分</option></select><input class="input" type="date" id="detail-from" aria-label="开始日期" value="${detailFrom}"><span class="muted">至</span><input class="input" type="date" id="detail-to" aria-label="结束日期" value="${detailTo}"><button class="btn btn-ghost btn-sm" data-action="clear-filters">重置筛选</button></div><div id="details-table">${detailsTable()}</div>`;
  }
  function detailsTable() {
    const records = detailRecords();
    if(!records.length) return empty('暂无积分变动记录',state.records.length ? '当前筛选条件下没有记录，试试调整筛选。' : '完成首次积分录入后，所有变动都会出现在这里。');
    return `<div class="table-wrap"><table class="data-table"><thead><tr><th>发生日期</th><th>学生</th><th>班级</th><th>积分事项</th><th>变动</th><th>备注</th><th class="text-right">操作</th></tr></thead><tbody>${records.map(r => {const s=state.students.find(s=>s.id===r.studentId);return `<tr><td class="subtle nowrap">${esc(r.date)}</td><td class="nowrap"><strong>${esc(s.name)}</strong><small class="muted block">${esc(s.number)}</small></td><td class="nowrap">${esc(s.className)}</td><td>${esc(r.ruleName)}</td><td><span class="badge ${r.points>0?'badge-positive':'badge-negative'}">${signed(r.points)}</span></td><td class="note-cell">${esc(r.note || '—')}</td><td class="text-right nowrap"><button class="btn btn-ghost btn-sm" data-action="undo-batch" data-id="${esc(r.batchId)}">${icon('undo',14)} 撤销批次</button></td></tr>`;}).join('')}</tbody></table></div><div class="table-footer">共 ${records.length} 条记录 · 撤销批次将同时撤销该次提交的所有学生记录</div>`;
  }

  function closeModal() { $('#modal-root').innerHTML=''; document.body.style.overflow=''; lastFocus?.focus(); }
  function modal(title, body, submit, onSubmit, wide=false) {
    lastFocus=document.activeElement;
    $('#modal-root').innerHTML=`<div class="modal-backdrop"><section class="modal ${wide?'modal-wide':''}" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabindex="-1"><div class="modal-header"><h2 id="modal-title">${esc(title)}</h2><button type="button" class="btn btn-ghost btn-sm" data-action="close-modal" aria-label="关闭">${icon('close')}</button></div><form id="modal-form"><div class="modal-body">${body}</div><div class="modal-footer"><button type="button" class="btn btn-secondary" data-action="close-modal">取消</button><button class="btn btn-primary" type="submit">${esc(submit)}</button></div></form></section></div>`;
    document.body.style.overflow='hidden';
    $('#modal-form').addEventListener('submit', event => { event.preventDefault(); try {onSubmit(new FormData(event.target));} catch(error) {toast(error.message,true);} });
    setTimeout(() => $('.modal input:not([type="hidden"]), .modal select, .modal button[type="submit"]')?.focus(),20);
  }
  function confirmAction(title, message, submit, callback) { modal(title,`<p class="confirm-copy">${message}</p>`,submit,() => { if(callback() !== false) closeModal(); }); }
  function studentModal(id) {
    const s = state.students.find(s=>s.id===id) || {number:'',name:'',className:classes()[0] || '',initialScore:60};
    modal(id ? '编辑学生' : '新增学生',`<div class="form-grid"><div class="field"><label for="student-number">学号</label><input class="input" id="student-number" name="number" maxlength="100" required value="${esc(s.number)}" placeholder="例如：20260101"></div><div class="field"><label for="student-name">姓名</label><input class="input" id="student-name" name="name" maxlength="100" required value="${esc(s.name)}" placeholder="学生姓名"></div><div class="field"><label for="student-class-name">班级</label><input class="input" id="student-class-name" name="className" maxlength="100" required value="${esc(s.className)}" placeholder="例如：高一（1）班"></div><div class="field"><label for="student-initial">初始积分</label><input class="input" id="student-initial" name="initialScore" type="number" step="any" min="-100000" max="100000" required value="${s.initialScore}"></div></div>${id ? '<div class="notice notice-info">修改初始积分会同步改变该学生的当前总分，历史加减分记录保持不变。</div>' : ''}`,'保存学生', data => {
      const student=Core.validateStudent({...Object.fromEntries(data),id:id || uid()});
      if(state.students.some(x=>x.number===student.number && x.id!==id)) throw Error('该学号已存在，请使用唯一学号。');
      if(commit({...state,students:id ? state.students.map(x=>x.id===id?student:x) : [...state.students,student]},id?'学生资料已更新':'学生已添加')) closeModal();
    });
  }
  function ruleModal(id) {
    const r=state.rules.find(r=>r.id===id) || {name:'',points:1};
    modal(id?'编辑积分规则':'添加积分规则',`<div class="field"><label for="rule-name">规则名称</label><input class="input" id="rule-name" name="name" value="${esc(r.name)}" required maxlength="100" placeholder="例如：主动帮助同学"></div><div class="field"><label for="rule-points">变动分值</label><input class="input" id="rule-points" name="points" type="number" step="any" min="-100000" max="100000" value="${r.points}" required><small>正数为加分，负数为扣分，不能为 0。</small></div><div class="notice notice-info">规则类型根据分值自动确定。历史记录会保留录入时的名称和分值。</div>`,'保存规则',data => {
      const name=data.get('name').trim(),points=Number(data.get('points'));
      if(!name || !Number.isFinite(points) || points===0 || Math.abs(points)>100000) throw Error('请填写规则名称和有效的非零分值。');
      if(state.rules.some(x=>x.name===name && x.id!==id)) throw Error('该规则名称已存在。');
      const rule={id:id || uid(),name,points};
      if(commit({...state,rules:id?state.rules.map(x=>x.id===id?rule:x):[...state.rules,rule]},'积分规则已保存')) { if(draft.ruleId===id) draft.points=points; closeModal(); }
    });
  }
  function download(content,name,type) { const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000); }
  function exportExcel(rows,headers,name) {
    if(!window.XLSX) throw Error('Excel 组件加载失败，请刷新页面。');
    const sheet=XLSX.utils.aoa_to_sheet([headers,...rows.map(row=>headers.map(key=>row[key]??''))]);
    sheet['!cols']=headers.map(h=>({wch:h==='备注'||h==='积分事项'?34:18}));
    const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,sheet,'学生积分');XLSX.writeFile(book,`${name}.xlsx`);
  }
  function exportStudents() { exportExcel(state.students.map(s=>({'学号':s.number,'姓名':s.name,'班级':s.className,'初始积分':s.initialScore})),['学号','姓名','班级','初始积分'],`学生名单_${today()}`); }
  function exportOverview() { exportExcel(rankedStudents().map(s=>{const t=Core.studentTotals(state,s);return {'学号':s.number,'姓名':s.name,'班级':s.className,'初始积分':t.initialScore,'累计加分':t.added,'累计扣分':t.deducted,'当前积分':t.score};}),['学号','姓名','班级','初始积分','累计加分','累计扣分','当前积分'],`积分总览_${today()}`); }
  function exportDetails() { exportExcel(detailRecords().map(r=>{const s=state.students.find(s=>s.id===r.studentId);return {'发生日期':r.date,'学号':s.number,'姓名':s.name,'班级':s.className,'积分事项':r.ruleName,'变动分值':r.points,'备注':r.note};}),['发生日期','学号','姓名','班级','积分事项','变动分值','备注'],`积分变动明细_${today()}`); }
  async function importFile(file) {
    if(!file || importBusy) return;
    if(!/\.(xlsx|xls|csv)$/i.test(file.name)) return toast('请选择 Excel（.xlsx / .xls）或 CSV 文件。',true);
    if(file.size>10*1024*1024) return toast('文件过大，请选择 10 MB 以内的名单。',true);
    importBusy=true;
    toast('正在读取名单…');
    try {
      let rows;
      if(/\.csv$/i.test(file.name)) {
        const bytes=await file.arrayBuffer(); let text=new TextDecoder('utf-8').decode(bytes);
        if(text.includes('\uFFFD')) text=new TextDecoder('gb18030').decode(bytes);
        rows=Core.parseCSV(text);
      } else {
        if(!window.XLSX) throw Error('Excel 组件加载失败，请刷新后重试。');
        const book=XLSX.read(await file.arrayBuffer(),{type:'array',cellText:true});
        const sheet=book.Sheets[book.SheetNames[0]];
        const array=XLSX.utils.sheet_to_json(sheet,{header:1,raw:false,defval:'',blankrows:false});
        if(!array.length) throw Error('工作表为空。');
        const headers=array[0].map(h=>String(h).replace(/^\uFEFF/,'').trim());
        if(new Set(headers).size!==headers.length) throw Error('表头存在重复列，请使用标准模板。');
        rows=array.slice(1).filter(row=>row.some(cell=>String(cell).trim())).map(row=>Object.fromEntries(headers.map((h,i)=>[h,row[i]??''])));
      }
      const result=Core.importRows(state,rows);
      modal('确认导入名单',`<div class="import-summary"><div><strong>${result.added}</strong><span>名新学生</span></div><div><strong>${result.skipped}</strong><span>条重复学号已跳过</span></div></div><p class="muted">文件：${esc(file.name)} · 学生原有积分和记录会保留。</p><div class="table-wrap"><table class="data-table"><thead><tr><th>学号</th><th>姓名</th><th>班级</th><th>初始积分</th></tr></thead><tbody>${result.state.students.slice(state.students.length,state.students.length+5).map(s=>`<tr><td>${esc(s.number)}</td><td>${esc(s.name)}</td><td>${esc(s.className)}</td><td>${s.initialScore}</td></tr>`).join('')}</tbody></table></div>${result.added>5?'<p class="muted">预览前 5 名学生，确认后将导入所有有效学生。</p>':''}`,'确认导入',()=>{if(commit(result.state,`成功导入 ${result.added} 名学生，跳过 ${result.skipped} 条重复学号`)) closeModal();},true);
    } catch(error) { toast(`导入失败：${error.message}`,true); }
    finally { importBusy=false; if($('#student-file')) $('#student-file').value=''; }
  }
  async function restoreFile(file) {
    if(!file) return;
    try {
      if(file.size>20*1024*1024) throw Error('备份文件不能超过 20 MB。');
      const restored=Core.validateState(JSON.parse(await file.text()));
      confirmAction('恢复数据备份',`即将恢复 <strong>${restored.students.length}</strong> 名学生、<strong>${restored.rules.length}</strong> 条规则和 <strong>${restored.records.length}</strong> 条记录。<br><br>这会替换当前浏览器中的全部系统数据，建议先点击“备份数据”保存当前内容。`,'确认恢复',()=>{ const previous=bootError;bootError='';if(!commit(restored,'备份已恢复')){bootError=previous;return false;}selected.clear();return true; });
    } catch(error) {toast(`恢复失败：${error.message}`,true);}
    finally {$('#restore-input').value='';}
  }

  document.addEventListener('click',event => {
    const button=event.target.closest('[data-action]'); if(!button) return;
    const id=button.dataset.id;
    try {
      switch(button.dataset.action) {
        case 'tab': tab=id;search='';classFilter='';detailStudentId='';render();break;
        case 'close-modal': closeModal();break;
        case 'add-student': studentModal();break;
        case 'edit-student': studentModal(id);break;
        case 'delete-student': {const s=state.students.find(s=>s.id===id);const count=state.records.filter(r=>r.studentId===id).length;confirmAction('删除学生',`确定删除 <strong>${esc(s.name)}（${esc(s.number)}）</strong> 吗？${count?`该学生的 ${count} 条积分记录也将删除。`:''}<br><br>此操作无法撤销，请先备份需要保留的数据。`,'确认删除',()=>commit({...state,students:state.students.filter(s=>s.id!==id),records:state.records.filter(r=>r.studentId!==id)},'学生已删除'));break;}
        case 'add-rule': ruleModal();break;
        case 'edit-rule': ruleModal(id);break;
        case 'delete-rule': {const r=state.rules.find(r=>r.id===id);confirmAction('删除积分规则',`确定删除“${esc(r.name)}”吗？已经录入的历史记录会保留。`,'确认删除',()=>commit({...state,rules:state.rules.filter(r=>r.id!==id)},'规则已删除'));break;}
        case 'filter-rule':ruleFilter=id;render();break;
        case 'template':exportExcel([{'学号':'20260101','姓名':'示例学生（导入前请替换）','班级':'高一（1）班','初始积分':60}],['学号','姓名','班级','初始积分'],'学生名单导入模板');break;
        case 'export-students':exportStudents();break;
        case 'export-overview':exportOverview();break;
        case 'export-details':exportDetails();break;
        case 'select-visible':state.students.filter(s=>matchStudent(s,entrySearch,entryClass)).forEach(s=>selected.add(s.id));updatePicker();break;
        case 'clear-selected':selected.clear();updatePicker();break;
        case 'student-details': {const s=state.students.find(s=>s.id===id);tab='details';detailStudentId=s.id;search=s.number;classFilter=s.className;detailFrom='';detailTo='';detailSign='all';render();break;}
        case 'clear-filters':search='';classFilter='';detailStudentId='';detailSign='all';detailFrom='';detailTo='';render();break;
        case 'undo-batch': {const records=state.records.filter(r=>r.batchId===id);confirmAction('撤销本次积分录入',`将撤销“${esc(records[0].ruleName)}”的 <strong>${records.length} 条记录</strong>，涉及的所有学生积分会恢复。<br><br>此批次的变动分值为每人 <strong>${signed(records[0].points)} 分</strong>。`,'确认撤销',()=>commit(Core.undoBatch(state,id),'该批次积分已撤销'));break;}
        case 'backup':download(JSON.stringify(state,null,2),`学生积分备份_${today()}.json`,'application/json');toast('备份文件已生成，请妥善保存。');break;
        case 'restore':$('#restore-input').click();break;
        case 'raw-backup':download(originalData,'学生积分_原始数据.txt','text/plain');break;
        case 'reset-corrupt':confirmAction('重置本地数据','请先导出原始数据。重置后将恢复为空名单和初始规则，原有数据无法在系统内撤回。','确认重置',()=>{const old=bootError;bootError='';if(!commit(Core.createState(),'本地数据已重置')){bootError=old;return false;}return true;});break;
      }
    } catch(error) {toast(error.message,true);}
  });
  document.addEventListener('input',event => {
    const el=event.target;
    if(el.id==='student-search'){search=el.value;$('#student-table').innerHTML=studentTable();}
    if(el.id==='overview-search'){search=el.value;$('#overview-table').innerHTML=overviewTable();}
    if(el.id==='detail-search'){search=el.value;detailStudentId='';$('#details-table').innerHTML=detailsTable();}
    if(el.id==='entry-search'){entrySearch=el.value;updatePicker();}
    if(el.id==='entry-points'){draft.points=el.value;$('#entry-preview').innerHTML=entryPreview();}
    if(el.id==='entry-note')draft.note=el.value;
    if(el.id==='entry-reason')draft.reason=el.value;
    if(el.id==='entry-date')draft.date=el.value;
  });
  document.addEventListener('change',event => {
    const el=event.target;
    if(el.id==='student-file')importFile(el.files[0]);
    if(el.id==='restore-input')restoreFile(el.files[0]);
    if(el.id==='student-class'){classFilter=el.value;$('#student-table').innerHTML=studentTable();}
    if(el.id==='overview-class'){classFilter=el.value;$('#overview-table').innerHTML=overviewTable();}
    if(el.id==='overview-sort'){overviewSort=el.value;$('#overview-table').innerHTML=overviewTable();}
    if(el.id==='detail-class'){classFilter=el.value;detailStudentId='';$('#details-table').innerHTML=detailsTable();}
    if(el.id==='detail-sign'){detailSign=el.value;$('#details-table').innerHTML=detailsTable();}
    if(el.id==='detail-from'){detailFrom=el.value;$('#details-table').innerHTML=detailsTable();}
    if(el.id==='detail-to'){detailTo=el.value;$('#details-table').innerHTML=detailsTable();}
    if(el.id==='entry-class'){entryClass=el.value;updatePicker();}
    if(el.dataset.studentId){el.checked?selected.add(el.dataset.studentId):selected.delete(el.dataset.studentId);updatePicker();}
    if(el.id==='entry-rule') {draft.ruleId=el.value;const r=state.rules.find(r=>r.id===el.value);draft.points=r?r.points:1;render();$('#entry-rule')?.focus();}
  });
  document.addEventListener('submit',event => {
    if(event.target.id!=='entry-form')return;
    event.preventDefault();
    try {
      if(!selected.size)throw Error('请先选择至少一名学生。');
      const r=state.rules.find(r=>r.id===draft.ruleId);
      if(!r && !draft.reason.trim())throw Error('请为其他事项填写具体事由。');
      const payload={studentIds:[...selected],ruleId:r?r.id:null,ruleName:r?r.name:`其他事项：${draft.reason.trim()}`,points:r?r.points:Number(draft.points),date:draft.date,note:draft.note};
      const next=Core.addRecords(state,payload);
      const names=state.students.filter(s=>selected.has(s.id)).map(s=>s.name);
      modal('确认积分录入',`<div class="notice ${payload.points>0?'notice-info':'notice-warning'}">将为 ${selected.size} 名学生每人 <strong>${payload.points>0?'加':'扣'} ${Math.abs(payload.points)} 分</strong></div><dl class="confirm-details"><dt>积分事项</dt><dd>${esc(payload.ruleName)}</dd><dt>发生日期</dt><dd>${esc(payload.date)}</dd><dt>所选学生</dt><dd>${names.map(esc).join('、')}</dd><dt>备注</dt><dd>${esc(payload.note||'无')}</dd></dl>`,'确认提交',()=>{if(commit(next,`已为 ${selected.size} 名学生录入 ${signed(payload.points)} 分`)){draft.note='';draft.reason='';selected.clear();closeModal();render();}},true);
    } catch(error) {toast(error.message,true);}
  });
  document.addEventListener('dragover',event => {if(event.target.closest('#dropzone')){event.preventDefault();$('#dropzone').classList.add('dragover');}});
  document.addEventListener('dragleave',event => {if(event.target.id==='dropzone')event.target.classList.remove('dragover');});
  document.addEventListener('drop',event => {if(event.target.closest('#dropzone')){event.preventDefault();$('#dropzone').classList.remove('dragover');importFile(event.dataTransfer.files[0]);}});
  document.addEventListener('keydown',event => {
    const dialog=$('.modal');if(!dialog)return;
    if(event.key==='Escape')closeModal();
    if(event.key==='Tab'){const nodes=[...dialog.querySelectorAll('button,input,select,textarea,[tabindex="0"]')].filter(e=>!e.disabled&&!e.hidden);const first=nodes[0],last=nodes[nodes.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
  });
  window.addEventListener('storage',event => {if(event.key!==KEY)return;try{state=event.newValue?Core.validateState(JSON.parse(event.newValue)):Core.createState();persistedRaw=event.newValue||'';closeModal();selected.clear();render();toast('已同步另一个页面中的最新数据。');}catch{toast('另一个页面的数据更新无效，请刷新检查。',true);}});
  $('#brand-icon').innerHTML=icon('book',26);
  render();
})();
