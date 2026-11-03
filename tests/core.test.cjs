const test = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../dist/data.js');

function populated() {
  return Core.importRows(Core.createState(), [
    { 学号: '001', 姓名: '张同学', 班级: '一班' },
    { 学号: '002', 姓名: '李同学', 班级: '一班', 初始积分: 70 }
  ]).state;
}
function recordInput(state, overrides = {}) {
  return { studentIds: state.students.map(s => s.id), ruleId: 'default-1', ruleName: '跑腿小任务', points: 1, date: '2026-11-03', ...overrides };
}
test('默认 11 条规则与用户所列分值完全一致，每次生成互不影响', () => {
  const first = Core.createState(), second = Core.createState();
  assert.equal(first.rules.length, 11);
  assert.deepEqual(first.rules.map(r => r.points), [1, 2, 5, 5, 3, 2, -5, -5, -10, -2, -5]);
  first.rules[0].points = 999;
  assert.equal(second.rules[0].points, 1);
});
test('导入保留前导零、去 BOM 和空白、默认 60 分，重复项跳过', () => {
  const original = populated();
  const result = Core.importRows(original, [
    { '\uFEFF学号': ' 003 ', 姓名: ' 王同学 ', 班级: ' 二班 ', 初始积分: '' },
    { 学号: '003', 姓名: '重复', 班级: '二班' },
    { 学号: '001', 姓名: '重复', 班级: '一班' }
  ]);
  assert.equal(result.added, 1); assert.equal(result.skipped, 2); assert.equal(result.total, 3);
  assert.equal(result.state.students[2].number, '003');
  assert.equal(result.state.students[2].initialScore, 60);
  assert.equal(result.state.students[2].name, '王同学');
  assert.equal(original.students.length, 2);
});
test('无效行、缺表头、非法分值导致整批导入失败，原数据不变', () => {
  const original = populated(), snapshot = JSON.stringify(original);
  assert.throws(() => Core.importRows(original, [{ 学号: '003', 姓名: '王', 班级: '一班' }, { 学号: '004', 姓名: '', 班级: '一班' }]), /第 3 行/);
  assert.throws(() => Core.importRows(original, [{ 学号: '003', 姓名: '王' }]), /三列表头/);
  for (const value of [Infinity, NaN, 'bad', 100001, true, []]) {
    assert.throws(() => Core.importRows(original, [{ 学号: '003', 姓名: '王', 班级: '一班', 初始积分: value }]));
  }
  assert.equal(JSON.stringify(original), snapshot);
});
test('批量加分、自由扣分与整批撤销正确计算，均不修改原 state', () => {
  const original = populated();
  const added = Core.addRecords(original, recordInput(original));
  assert.equal(original.records.length, 0); assert.equal(added.records.length, 2);
  assert.equal(new Set(added.records.map(r => r.batchId)).size, 1);
  const deducted = Core.addRecords(added, recordInput(added, { studentIds: [added.students[0].id], ruleId: null, ruleName: '其他事项', points: -2.5, note: '班主任调整' }));
  assert.deepEqual(Core.studentTotals(deducted, deducted.students[0]), { initialScore: 60, added: 1, deducted: -2.5, score: 58.5, count: 2 });
  assert.equal(Core.studentScore(deducted, deducted.students[1].id), 71);
  const undone = Core.undoBatch(deducted, added.records[0].batchId);
  assert.equal(undone.records.length, 1); assert.equal(Core.studentScore(undone, undone.students[0]), 57.5);
  assert.equal(deducted.records.length, 3);
  assert.throws(() => Core.undoBatch(undone, 'missing'), /未找到/);
});
test('录入拒绝无学生、重复或不存在的学生、零分、无效日期及事由', () => {
  const state = populated(), input = recordInput(state);
  for (const overrides of [
    { studentIds: [] }, { studentIds: [state.students[0].id, state.students[0].id] },
    { studentIds: ['missing'] }, { points: 0 }, { points: Infinity }, { points: 'NaN' },
    { ruleName: ' ' }, { date: '2026-02-30' }, { date: '2026-2-3' }, { ruleId: 'missing' }
  ]) assert.throws(() => Core.addRecords(state, { ...input, ...overrides }));
  assert.doesNotThrow(() => Core.addRecords(state, { ...input, date: '2024-02-29' }));
});
test('CSV 支持 BOM、引号、逗号、换行、转义引号与 CRLF', () => {
  const rows = Core.parseCSV('\uFEFF学号,姓名,班级,初始积分\r\n001,"张,同学","高一\n一班",60\r\n002,"李""同学",一班,\r\n');
  assert.equal(rows.length, 2); assert.equal(rows[0].姓名, '张,同学');
  assert.equal(rows[0].班级, '高一\n一班'); assert.equal(rows[1].姓名, '李"同学');
  assert.equal(rows[0].学号, '001');
  assert.throws(() => Core.parseCSV('学号,姓名\n1,"张'), /未闭合/);
  assert.throws(() => Core.parseCSV('学号,姓名\n1,"张"错误'), /无效内容/);
  assert.throws(() => Core.parseCSV('学号,学号\n1,2'), /表头/);
  assert.throws(() => Core.parseCSV('学号,姓名\n1,张,多余'), /列数/);
});
test('CSV 导出转义单元格并阻止电子表格公式注入，同时保留数字', () => {
  const csv = Core.toCSV([{ 姓名: '=HYPERLINK("bad")', 备注: 'a,b\nc', 积分: -5, 班级: '\t+cmd' }]);
  const result = Core.parseCSV(csv)[0];
  assert.equal(result.姓名, '\'=HYPERLINK("bad")'); assert.equal(result.备注, 'a,b\nc');
  assert.equal(result.积分, '-5'); assert.equal(result.班级, "'\t+cmd");
  assert.equal(csv.charCodeAt(0), 0xFEFF);
});
test('备份校验检查引用完整性、重复 ID 与学号，允许删除规则后的历史记录', () => {
  let state = populated(); state = Core.addRecords(state, recordInput(state));
  assert.deepEqual(Core.validateState(JSON.parse(JSON.stringify(state))), state);
  const invalidStudent = structuredClone(state); invalidStudent.students[1].number = invalidStudent.students[0].number;
  assert.throws(() => Core.validateState(invalidStudent), /重复的学号/);
  const orphan = structuredClone(state); orphan.records[0].studentId = 'missing';
  assert.throws(() => Core.validateState(orphan), /不存在的学生/);
  const duplicate = structuredClone(state); duplicate.records[1].id = duplicate.records[0].id;
  assert.throws(() => Core.validateState(duplicate), /重复的积分记录 ID/);
  const removedRule = structuredClone(state); removedRule.rules = [];
  assert.equal(Core.validateState(removedRule).records.length, 2);
  assert.throws(() => Core.validateState({ version: 2, students: [], rules: [], records: [] }), /版本/);
});
