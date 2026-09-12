import test from 'node:test';
import assert from 'node:assert/strict';
import {computeAssessment, createRun} from '../src/value-domain.js';
import {reportModel, reportMarkdown} from '../src/value-report.js';
import {comparisonPresentation, updateReportDraft, saveReportVersion} from '../src/value-workflow.js';

const unit = id => ({id, properties: {name: id}, geometry: {type: 'Polygon', coordinates: []}});
const analysis = (distance = 0) => ({area: 10000, buildingCount: 3, nearest: {transit: distance === null ? null : {distance, properties: {name: '地铁站'}}}, counts: {transit: 1}, method: '既有测算方法', geometryDate: '2026-09-11', spatialDate: '2026-09-12'});
const assessment = (id = 'XW-R01', distance = 0) => computeAssessment(unit(id), analysis(distance), {mode: 'demo'});
const runOf = (result, id = 'RUN-' + result.unitId) => ({...structuredClone(result), id, createdAt: '2026-09-12T10:00:00Z', review: {status: '未复核'}});
const draft = () => reportModel(createRun(unit('XW-R01'), analysis(), {mode: 'demo'}), analysis(), {evidence: {documents: [{title: '原始资料', date: '2026-01-01', publisher: '原发布者', url: 'https://example.com/original'}]}});

test('comparison distinguishes a true zero distance from missing observations', () => {
 const results = [assessment('XW-R01', null), assessment('XW-R02', 0)];
 const presentation = comparisonPresentation(results, results.map(result => runOf(result)));
 assert.equal(presentation.items[0].distanceText, '缺失');
 assert.equal(presentation.items[1].distanceText, '0');
 assert.equal(presentation.canCompare, false);
 assert(presentation.items.every(item => item.barValue === null && item.scoreText === '暂不比较'));
});

test('comparison binds saved run IDs and shows totals only when all runs agree', () => {
 const results = [assessment(), assessment('XW-R02')], runs = results.map(result => runOf(result));
 const presentation = comparisonPresentation(results, runs);
 assert.equal(presentation.canCompare, true);
 assert.equal(presentation.ranked.length, 2);
 assert.deepEqual(presentation.snapshot.runIds, runs.map(run => run.id));
 assert.equal(presentation.items[0].scoreText, String(runs[0].total));
 assert.equal(presentation.items[0].barValue, runs[0].total);
 presentation.snapshot.items[0].result.input.area = 1;
 assert.equal(runs[0].input.area, 10000);
});

test('a valid zero assessment remains visible in an otherwise comparable saved run set', () => {
 const results = [{...assessment(), total: 0}, assessment('XW-R02')];
 const presentation = comparisonPresentation(results, results.map(result => runOf(result)));
 assert.equal(presentation.canCompare, true);
 assert.equal(presentation.items[0].scoreText, '0');
 assert.equal(presentation.items[0].barValue, 0);
});

test('missing or stale runs suppress every score and mark exported observations as raw', () => {
 const results = [assessment(), assessment('XW-R02')], run = runOf(results[0]);
 for (const runs of [[run, null], [run, {...runOf(results[1]), fingerprint: 'stale'}]]) {
  const presentation = comparisonPresentation(results, runs);
  assert.equal(presentation.canCompare, false);
  assert(presentation.items.every(item => item.barValue === null));
  assert.equal(presentation.snapshot.items[1].source, 'instantaneous-raw');
  assert.equal(presentation.snapshot.items[1].runId, null);
  assert.equal(presentation.snapshot.items[1].result.total, null);
  assert(presentation.snapshot.items[1].result.dimensions.every(dimension => dimension.score === null));
  assert.equal(presentation.snapshot.items[0].runId, run.id);
 }
});

test('incompatible saved versions and business dates cannot leak scores into comparison bars', () => {
 for (const change of [result => ({...result, ruleVersion: 'OTHER'}), result => ({...result, input: {...result.input, date: '2025-01-01'}})]) {
  const results = [assessment(), change(assessment('XW-R02'))];
  const presentation = comparisonPresentation(results, results.map(result => runOf(result)));
  assert.equal(presentation.canCompare, false);
  assert.match(presentation.reason, /规则版本不同|数据时点不同/);
  assert(presentation.items.every(item => item.scoreText === '暂不比较' && item.barValue === null));
 }
});

test('save, repeated download and print reuse one content version and its original clock', () => {
 let previous = draft();
 previous.mapImage = 'data:image/png;base64,ORIGINAL';
 let result = saveReportVersion(previous, previous, []);
 assert.equal(result.created, true);
 const id = result.model.id, createdAt = result.model.createdAt;
 for (let i = 0; i < 4; i++) {
  previous = structuredClone(result.model);
  const candidate = updateReportDraft(previous, {});
  candidate.createdAt = '2099-01-01T00:00:00Z';
  result = saveReportVersion(previous, candidate, result.reports);
  assert.equal(result.created, false);
  assert.equal(result.reports.length, 1);
  assert.equal(result.model.id, id);
  assert.equal(result.model.createdAt, createdAt);
 }
});

test('editing narrative creates an immutable revision without forging review identity', () => {
 const initial = draft(), first = saveReportVersion(initial, initial, []), before = JSON.stringify(first);
 const edited = updateReportDraft(first.model, {note: '新增研究意见', reviewer: ' 蔡子攀 ', reviewNote: ' 已核对原始资料 '});
 const second = saveReportVersion(first.model, edited, first.reports);
 assert.equal(second.created, true);
 assert.equal(second.reports.length, 2);
 assert.equal(second.model.parentId, first.model.id);
 assert.equal(second.model.familyId, first.model.familyId);
 assert.equal(second.model.revision, 2);
 assert.equal(JSON.stringify(first), before);
 assert.match(reportMarkdown(second.model), /新增研究意见/);
 assert.equal(second.model.status, '未复核');
 assert.equal(second.model.reviewer, '');
 assert.equal(second.reports[0].note, '');
});

test('reopening an older version preserves its evidence and clock, then branches safely', () => {
 const initial = draft();
 initial.mapImage = 'original-map';
 const first = saveReportVersion(initial, initial, []);
 const second = saveReportVersion(first.model, updateReportDraft(first.model, {note: '第二版'}), first.reports);
 const reopened = saveReportVersion(first.model, updateReportDraft(first.model, {}), second.reports);
 assert.equal(reopened.created, false);
 assert.equal(reopened.model.id, first.model.id);
 assert.equal(reopened.model.createdAt, first.model.createdAt);
 assert.deepEqual(reopened.model.sections, first.model.sections);
 const third = saveReportVersion(reopened.model, updateReportDraft(reopened.model, {note: '从第一版修订'}), reopened.reports);
 assert.equal(third.model.parentId, first.model.id);
 assert.equal(third.model.revision, 3);
 assert.equal(third.model.mapImage, 'original-map');
 assert.deepEqual(third.model.run, first.model.run);
 assert.match(reportMarkdown(third.model), /原始资料/);
 assert.equal(second.model.note, '第二版');
});

test('comparison evidence, map or source changes count as content changes', () => {
 const initial = draft();
 initial.comparison = [runOf(assessment('XW-R02'))];
 const first = saveReportVersion(initial, initial, []);
 for (const change of [
  candidate => { candidate.comparison[0].id = 'OTHER-RUN'; },
  candidate => { candidate.comparison[0].input.source = '更正的调查来源'; },
  candidate => { candidate.mapImage = 'different-map'; },
  candidate => { candidate.sections[5].paragraphs.push('补充来源'); },
 ]) {
  const candidate = structuredClone(first.model);
  change(candidate);
  const saved = saveReportVersion(first.model, candidate, first.reports);
  assert.equal(saved.created, true);
  assert.notEqual(saved.model.id, first.model.id);
 }
});

test('report comparison shares the view gating and retains exact run IDs and data dates', () => {
 const first = draft(), a = runOf(assessment()), b = runOf(assessment('XW-R02'));
 const valid = reportModel(first.run, analysis(), {comparison: [a, b]});
 const section = valid.sections.find(section => section.title === '研究单元比较');
 assert.equal(section.rows[1][3], String(a.total));
 assert.match(section.rows[1][0], new RegExp(a.id));
 assert.match(section.rows[1][2], /2026-09-11/);
 const invalid = reportModel(first.run, analysis(), {comparison: [a, {...b, ruleVersion: 'OTHER'}]});
 const blocked = invalid.sections.find(section => section.title === '研究单元比较');
 assert(blocked.rows.slice(1).every(row => row[3] === '暂不比较'));
 assert.match(blocked.paragraphs[0], /规则版本不同/);
});

test('report history keeps eight content versions without duplicating the active revision', () => {
 const initial = draft();
 let result = saveReportVersion(initial, initial, []);
 const familyId = result.model.familyId;
 for (let i = 0; i < 10; i++) result = saveReportVersion(result.model, updateReportDraft(result.model, {note: String(i)}), result.reports);
 assert.equal(result.reports.length, 8);
 assert.equal(result.model.revision, 11);
 assert.equal(result.model.familyId, familyId);
 assert.equal(new Set(result.reports.map(report => report.id)).size, 8);
 const repeated = saveReportVersion(result.model, updateReportDraft(result.model, {}), result.reports);
 assert.equal(repeated.reports.length, 8);
 assert.equal(repeated.created, false);
});
