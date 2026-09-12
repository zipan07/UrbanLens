import {compareRuns} from './value-domain.js';

const finite = value => typeof value === 'number' && Number.isFinite(value);
const clone = value => structuredClone(value);
const canonical = value => {
 if (Array.isArray(value)) return value.map(canonical);
 if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => [key, canonical(value[key])]));
 return value;
};
const serialize = value => JSON.stringify(canonical(value));
const without = (value, keys) => Object.fromEntries(Object.entries(value || {}).filter(([key]) => !keys.includes(key)));
const assessmentContent = result => without(result, ['id', 'createdAt', 'review', 'projectId', 'projectDataVersion', 'createdBy', 'createdByName', 'geometry']);
const matchesRun = (result, run) => Boolean(run?.id && result && serialize(assessmentContent(result)) === serialize(assessmentContent(run)));

/** One comparability decision for the table, bars and exported evidence. */
export function comparisonPresentation(results, runs = []) {
 const matching = results.map((result, index) => matchesRun(result, runs[index]));
 const allSaved = matching.every(Boolean);
 let check;
 if (results.length < 2 || results.length > 3) check = {ranked: [], reason: '请选择 2–3 个研究单元。'};
 else if (!allSaved) check = {ranked: [], reason: '部分对象尚未运行或输入已变化，请统一口径重新评估。当前仅比较原始指标，不展示分值。'};
 else {
  check = compareRuns(runs.slice(0, results.length));
  if (check.ranked.length && runs.slice(0, results.length).some(run => !finite(run.total))) check = {ranked: [], reason: '数据不完整，暂不排序；可比较原始指标与缺失项。'};
 }
 const canCompare = allSaved && check.ranked.length === results.length && results.length >= 2;
 const items = results.map((result, index) => {
  const saved = matching[index];
  return {
   result: clone(saved ? runs[index] : result),
   runId: saved ? runs[index].id : null,
   source: saved ? 'saved-run' : 'instantaneous-raw',
   distanceText: finite(result.input?.distance) ? String(Math.round(result.input.distance)) : '缺失',
   scoreText: canCompare ? String(runs[index].total) : saved ? '暂不比较' : runs[index] ? '待重新评估' : '未运行',
   barValue: canCompare ? runs[index].total : null,
  };
 });
 const snapshot = {
  canCompare,
  reason: check.reason,
  runIds: items.map(item => item.runId),
  items: items.map(item => {
   const result = clone(item.result);
   // Instant calculations are raw observations, never persisted assessment runs.
   if (!item.runId) {
    delete result.id;
    delete result.createdAt;
    delete result.review;
    result.total = null;
    result.scores = result.scores?.map(() => null) || [];
    result.dimensions = result.dimensions?.map(dimension => ({...dimension, score: null})) || [];
   }
   return {unitId: result.unitId, runId: item.runId, source: item.source, result};
  }),
 };
 return {canCompare, reason: check.reason, ranked: canCompare ? clone(check.ranked) : [], items, snapshot};
}

/** Edit only the human-authored fields of an existing evidence snapshot. */
export function updateReportDraft(previous, {note = previous.note || '', reviewer = previous.reviewer || '', reviewNote = previous.reviewNote || ''} = {}) {
 const model = clone(previous);
 model.note = note;
 if(model.run?.projectId||model.run?.fieldEvidence){
  const summary=model.sections.find(s=>s.title==='研究摘要');if(summary)summary.paragraphs[1]=note||'建议优先核对研究边界、法定规划条件、计容面积、权属及建筑和经营调查。';
  return model;
 }
 model.reviewer = reviewer.trim();
 model.reviewNote = reviewNote.trim();
 model.status = model.reviewer && model.reviewNote ? '已记录本机演示复核' : '未复核';
 const summary = model.sections.find(section => section.title === '研究摘要');
 if (summary) summary.paragraphs[1] = model.note || '建议优先核对研究边界、法定规划条件、计容面积、权属及建筑和经营调查。';
 const review = model.sections.find(section => section.title === '版本与复核');
 if (review) review.paragraphs[1] = `复核状态：${model.status}。${model.reviewer ? '填写人：' + model.reviewer + '。' : ''}${model.reviewNote ? '意见：' + model.reviewNote : ''} 本机填写不构成身份认证、业务审批或正式专业复核。`;
 return model;
}

const reportContent = model => serialize(without(model, ['id', 'createdAt', 'familyId', 'rootId', 'parentId', 'revision']));
const familyOf = model => model?.familyId || model?.rootId || model?.id;

/** Returns a new history value; repeated exports reuse the saved content version. */
export function saveReportVersion(previous, candidate, reports = []) {
 const content = reportContent(candidate);
 const previousStored = previous?.id && reports.find(report => report.id === previous.id);
 const same = previousStored && reportContent(previousStored) === content ? previousStored : reports.find(report => reportContent(report) === content);
 if (same) return {model: clone(same), reports: reports.slice(-8), created: false};
 // An already saved snapshot may have fallen out of the eight-item local window.
 if (previous?.id && reportContent(previous) === content) return {model: clone(previous), reports: [...reports, clone(previous)].slice(-8), created: false};
 const familyId = familyOf(previous);
 const family = familyId ? reports.filter(report => familyOf(report) === familyId) : [];
 const revision = familyId ? Math.max(previous?.revision || 1, ...family.map(report => report.revision || 1)) + 1 : 1;
 const createdAt = new Date().toISOString();
 const stem = 'REPORT-' + createdAt.replace(/\D/g, '') + '-' + revision;
 let id = stem, suffix = 1;
 while (reports.some(report => report.id === id) || previous?.id === id) id = stem + '-' + suffix++;
 const model = {...clone(candidate), id, createdAt, familyId: familyId || id, parentId: previous?.id || null, revision};
 // Normalize legacy rootId if supplied, while retaining the stable family key.
 if ('rootId' in model) model.rootId = model.familyId;
 return {model, reports: [...reports, clone(model)].slice(-8), created: true};
}
