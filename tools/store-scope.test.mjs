import assert from 'node:assert/strict';
import * as S from '../script/store.js';
const first='11111111-1111-4111-8111-111111111111',second='22222222-2222-4222-8222-222222222222',adapter={authorize:async()=>{}};
S.configureAccount(first,adapter);S.savePreferences({theme:'light',language:'ja',history:20,trashDays:30});S.memoryPut('notes',{id:'synthetic',body:'Only a test'});
S.configureAccount(first,adapter);assert.equal(S.preferences().history,20);assert.equal((await S.rawAll('notes')).length,1);
S.configureAccount(second,adapter);assert.equal(S.preferences().history,3);assert.equal(S.preferences().trashDays,7);assert.equal((await S.rawAll('notes')).length,0);
assert.equal(S.preferences().language,'ja');assert.equal(S.preferences().theme,'light');
S.savePreferences({...S.preferences(),history:10,trashDays:14});S.detachAccount();assert.equal(S.preferences().history,3);assert.equal(S.preferences().trashDays,7);
console.log('PASS account-memory isolation, retention reset and public appearance continuity.');
