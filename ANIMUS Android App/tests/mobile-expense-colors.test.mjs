import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('mobile expense totals use gold in browser and native themes',async()=>{
  const css=await readFile(new URL('../../mobile-cloud.css',import.meta.url),'utf8');
  const native=await readFile(new URL('../src/native.css',import.meta.url),'utf8');
  const mobile=await readFile(new URL('../../mobile-cloud.js',import.meta.url),'utf8');
  const workspace=await readFile(new URL('../../mobile-workspace.js',import.meta.url),'utf8');
  assert.ok(css.includes('--expense-gold:#946b22'));
  assert.ok(native.includes('--expense-gold:#d4af64'));
  for(const selector of ['.expense-total-card strong','.expense-total strong','.receipt-row .money','.receipt-total-heading strong','.expense-value'])assert.ok(css.includes(selector));
  assert.ok(native.includes('.app-shell .expense-total-card strong{color:var(--expense-gold)!important}'));
  assert.ok(mobile.includes('summaryCards[3].classList.add("expense-total-card")'));
  assert.ok(workspace.includes("textContent==='Expenses'"));
  assert.ok(workspace.includes('<strong class="expense-value">'));
});
