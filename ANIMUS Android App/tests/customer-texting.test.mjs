import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../../animus-work-file.js',import.meta.url),'utf8');
function fixture(clipboard){
  const scope={navigator:{clipboard},escape:value=>String(value).replace(/"/g,'&quot;')};
  vm.runInNewContext(source.slice(source.indexOf('  function textCustomerAction('),source.indexOf('  function communicationPanel(')),scope);return scope;
}
test('desktop Text Customer opens only the official Google Messages URL without private number in the URL',()=>{
  const html=fixture().textCustomerAction('+12395550100');assert.ok(html.includes('href="https://messages.google.com/web/"'));assert.ok(html.includes('rel="noopener noreferrer"'));assert.ok(html.includes('target="_blank"'));assert.ok(!html.includes('phone='));assert.ok(!html.includes('sms:'));
});
test('customer number is copied locally without claiming a text was sent or modifying workfiles',async()=>{
  let copied;const scope=fixture({writeText:async value=>{copied=value;}}),status={hidden:true},link={dataset:{animusTextCustomer:'+12395550100'},closest:()=>({querySelector:()=>status})};
  await scope.copyTextCustomerNumber(link);assert.equal(copied,'+12395550100');assert.equal(status.hidden,false);assert.match(status.textContent,/Paste it into Google Messages/);assert.ok(!status.textContent.includes('sent'));
});
test('clipboard failures show an explicit copy fallback and malformed numbers are not copied',async()=>{
  let copies=0;const scope=fixture({writeText:async()=>{copies++;throw Error('Denied');}}),status={},link={dataset:{animusTextCustomer:'2395550100'},closest:()=>({querySelector:()=>status})};
  await scope.copyTextCustomerNumber(link);assert.match(status.textContent,/Copy 2395550100/);link.dataset.animusTextCustomer='javascript:bad';await scope.copyTextCustomerNumber(link);assert.equal(copies,1);
});
test('phone CRM retains its native SMS action',async()=>{
  const mobile=await readFile(new URL('../../mobile-cloud.js',import.meta.url),'utf8');assert.ok(mobile.includes('sms:'));assert.ok(!mobile.includes('messages.google.com'));
});
