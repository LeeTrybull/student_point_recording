(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PointsCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MAX_POINTS = 100000;
  const DEFAULT_RULES = [
    ['跑腿小任务', 1], ['每周优秀值日', 2], ['月度优秀班干', 5],
    ['A类活动积极参与', 5], ['B类活动积极参与', 3], ['每周科任老师表扬奖', 2],
    ['手机被抓', -5], ['quiz作弊', -5], ['大考作弊', -10], ['课堂迟到', -2], ['旷课', -5]
  ];
  const fail = message => { throw new Error(message); };
  const clean = value => String(value == null ? '' : value).replace(/^\uFEFF/, '').trim();
  const isObject = value => !!value && typeof value === 'object' && !Array.isArray(value);
  function id(prefix) {
    const suffix = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
    return prefix + '-' + suffix;
  }
  function points(value, label, allowZero) {
    if (value == null || (typeof value !== 'string' && typeof value !== 'number') || clean(value) === '') fail(label + '不能为空');
    const result = Number(value);
    if (!Number.isFinite(result) || Math.abs(result) > MAX_POINTS) fail(label + '须为 -100000 至 100000 之间的有效数字');
    if (!allowZero && result === 0) fail(label + '不能为 0');
    return result;
  }
  function requiredText(value, label, max) {
    const result = clean(value);
    if (!result) fail('请填写' + label);
    if (result.length > max) fail(label + '不能超过 ' + max + ' 个字符');
    return result;
  }
  function validId(value, label) {
    if (typeof value !== 'string' || !value.trim() || value.length > 200) fail(label + '无效');
    return value;
  }
  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail('请选择有效的发生日期');
    const date = new Date(value + 'T00:00:00.000Z');
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) fail('请选择有效的发生日期');
    return value;
  }
  function createState() {
    return {
      version: 1, students: [], records: [],
      rules: DEFAULT_RULES.map((item, index) => ({ id: 'default-' + (index + 1), name: item[0], points: item[1] }))
    };
  }
  function validateStudent(input) {
    if (!isObject(input)) fail('学生信息格式无效');
    const student = {
      number: requiredText(input.number, '学号', 100),
      name: requiredText(input.name, '姓名', 100),
      className: requiredText(input.className, '班级', 100),
      initialScore: points(input.initialScore == null || (typeof input.initialScore === 'string' && clean(input.initialScore) === '') ? 60 : input.initialScore, '初始积分', true)
    };
    if (input.id !== undefined) student.id = validId(input.id, '学生 ID');
    return student;
  }
  function validateState(input) {
    if (!isObject(input) || input.version !== 1 || !Array.isArray(input.students) || !Array.isArray(input.rules) || !Array.isArray(input.records)) fail('备份文件格式不正确或版本不受支持');
    if (input.students.length > 100000 || input.rules.length > 10000 || input.records.length > 1000000) fail('备份文件记录数量超出支持范围');
    const studentIds = new Set(), studentNumbers = new Set(), ruleIds = new Set(), recordIds = new Set();
    const students = input.students.map(raw => {
      const student = validateStudent(raw);
      validId(student.id, '学生 ID');
      if (studentIds.has(student.id)) fail('备份含有重复的学生 ID');
      if (studentNumbers.has(student.number)) fail('备份含有重复的学号：' + student.number);
      studentIds.add(student.id); studentNumbers.add(student.number);
      return student;
    });
    const rules = input.rules.map(raw => {
      if (!isObject(raw)) fail('备份规则格式无效');
      const rule = { id: validId(raw.id, '规则 ID'), name: requiredText(raw.name, '规则名称', 200), points: points(raw.points, '规则分值', false) };
      if (ruleIds.has(rule.id)) fail('备份含有重复的规则 ID');
      ruleIds.add(rule.id);
      return rule;
    });
    const records = input.records.map(raw => {
      if (!isObject(raw)) fail('备份积分记录格式无效');
      const record = {
        id: validId(raw.id, '记录 ID'), batchId: validId(raw.batchId, '批次 ID'),
        studentId: validId(raw.studentId, '学生 ID'),
        ruleId: raw.ruleId == null || raw.ruleId === '' ? null : validId(raw.ruleId, '规则 ID'),
        ruleName: requiredText(raw.ruleName, '积分事由', 200),
        points: points(raw.points, '变动分值', false), date: validDate(raw.date),
        note: clean(raw.note), createdAt: raw.createdAt
      };
      if (!studentIds.has(record.studentId)) fail('备份中的积分记录关联了不存在的学生');
      if (recordIds.has(record.id)) fail('备份含有重复的积分记录 ID');
      if (record.note.length > 2000) fail('备注不能超过 2000 个字符');
      if (typeof record.createdAt !== 'string' || !Number.isFinite(Date.parse(record.createdAt))) fail('备份记录的创建时间无效');
      recordIds.add(record.id);
      // A rule may be removed after use. Historical names and points remain authoritative.
      return record;
    });
    return { version: 1, students, rules, records };
  }
  function resolveStudent(state, studentOrId) {
    const studentId = isObject(studentOrId) ? studentOrId.id : studentOrId;
    return state.students.find(student => student.id === studentId) || fail('找不到该学生');
  }
  function studentTotals(state, studentOrId) {
    const student = resolveStudent(state, studentOrId);
    const totals = { initialScore: student.initialScore, added: 0, deducted: 0, score: student.initialScore, count: 0 };
    for (const record of state.records) {
      if (record.studentId !== student.id) continue;
      if (record.points > 0) totals.added += record.points;
      else totals.deducted += record.points;
      totals.count++;
    }
    totals.score = totals.initialScore + totals.added + totals.deducted;
    return totals;
  }
  function studentScore(state, studentOrId) { return studentTotals(state, studentOrId).score; }
  function importRows(state, rows) {
    if (!Array.isArray(rows) || !rows.length) fail('名单中没有可导入的学生');
    const known = new Set(state.students.map(student => student.number));
    const accepted = [];
    let skipped = 0;
    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      if (!isObject(row)) fail('第 ' + (index + 2) + ' 行格式无效');
      const normalized = {};
      for (const key of Object.keys(row)) normalized[clean(key)] = row[key];
      if (['学号', '姓名', '班级'].some(key => !Object.prototype.hasOwnProperty.call(normalized, key))) fail('名单必须包含「学号、姓名、班级」三列表头');
      let student;
      try {
        student = validateStudent({ number: normalized['学号'], name: normalized['姓名'], className: normalized['班级'], initialScore: normalized['初始积分'] });
      } catch (error) { fail('第 ' + (index + 2) + ' 行：' + error.message); }
      if (known.has(student.number)) { skipped++; continue; }
      known.add(student.number);
      accepted.push({ ...student, id: id('student') });
    }
    return { state: { ...state, students: state.students.concat(accepted) }, added: accepted.length, skipped, total: rows.length };
  }
  function addRecords(state, input) {
    if (!isObject(input) || !Array.isArray(input.studentIds) || !input.studentIds.length) fail('请至少选择一名学生');
    if (new Set(input.studentIds).size !== input.studentIds.length) fail('选中的学生不能重复');
    const known = new Set(state.students.map(student => student.id));
    if (input.studentIds.some(studentId => !known.has(studentId))) fail('选中的学生不存在，请重新选择');
    const ruleName = requiredText(input.ruleName, '积分事由', 200);
    const value = points(input.points, '变动分值', false);
    const date = validDate(input.date);
    const note = clean(input.note);
    if (note.length > 2000) fail('备注不能超过 2000 个字符');
    let ruleId = null;
    if (input.ruleId != null && input.ruleId !== '') {
      if (!state.rules.some(rule => rule.id === input.ruleId)) fail('所选积分规则不存在');
      ruleId = input.ruleId;
    }
    const batchId = id('batch'), createdAt = new Date().toISOString();
    const records = input.studentIds.map(studentId => ({ id: id('record'), batchId, studentId, ruleId, ruleName, points: value, date, note, createdAt }));
    return { ...state, records: state.records.concat(records) };
  }
  function undoBatch(state, batchId) {
    if (!state.records.some(record => record.batchId === batchId)) fail('未找到可撤销的积分批次');
    return { ...state, records: state.records.filter(record => record.batchId !== batchId) };
  }
  function parseCSV(input) {
    if (typeof input !== 'string') fail('CSV 文件内容无效');
    const text = input.replace(/^\uFEFF/, '');
    const rows = []; let row = [], field = '', quoted = false, closed = false;
    function finishField() { row.push(field); field = ''; closed = false; }
    function finishRow() { finishField(); if (row.some(value => value.trim() !== '')) rows.push(row); row = []; }
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (quoted) {
        if (char === '"' && text[i + 1] === '"') { field += '"'; i++; }
        else if (char === '"') { quoted = false; closed = true; }
        else field += char;
      } else if (char === '"') {
        if (field !== '' || closed) fail('CSV 引号格式不正确');
        quoted = true;
      } else if (char === ',') finishField();
      else if (char === '\n' || char === '\r') { if (char === '\r' && text[i + 1] === '\n') i++; finishRow(); }
      else {
        if (closed && char.trim() !== '') fail('CSV 引号后存在无效内容');
        if (!closed) field += char;
      }
    }
    if (quoted) fail('CSV 存在未闭合的引号');
    if (field !== '' || row.length || closed) finishRow();
    if (!rows.length) fail('CSV 文件为空');
    const headers = rows.shift().map(clean);
    if (headers.some(header => !header) || new Set(headers).size !== headers.length) fail('CSV 表头不能为空或重复');
    return rows.map((cells, index) => {
      if (cells.length > headers.length) fail('CSV 第 ' + (index + 2) + ' 行列数超出表头');
      const result = Object.create(null);
      headers.forEach((header, col) => { result[header] = cells[col] == null ? '' : cells[col]; });
      return result;
    });
  }
  function toCSV(rows, headers) {
    if (!Array.isArray(rows)) fail('导出数据格式无效');
    let matrix;
    if (rows.length && Array.isArray(rows[0])) matrix = rows;
    else {
      const columns = headers || (rows.length ? Object.keys(rows[0]) : []);
      matrix = [columns, ...rows.map(row => columns.map(column => row[column]))];
    }
    function escape(value) {
      let text = value == null ? '' : String(value);
      if (typeof value !== 'number' && /^[\u0000-\u0020]*[=+\-@]/.test(text)) text = "'" + text;
      return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
    }
    return '\uFEFF' + matrix.map(row => row.map(escape).join(',')).join('\r\n');
  }
  return Object.freeze({ createState, validateState, validateStudent, studentScore, studentTotals, importRows, parseCSV, toCSV, addRecords, undoBatch });
});
