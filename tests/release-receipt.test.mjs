import test from 'node:test';
import assert from 'node:assert/strict';
import {validateReceipt} from '../tools/release-receipt.mjs';
const receipt={allPassed:true,digest:'files',commit:'tested'};
const state={digest:'files',commit:'tested',dirty:false,refs:[{commit:'tested'}]};
test('only the exact clean tested commit can be pushed',()=>{
  assert.doesNotThrow(()=>validateReceipt(receipt,state));
  for(const changed of [{dirty:true},{commit:'untested'},{digest:'different'},{refs:[{commit:'old-head'}]}])
    assert.throws(()=>validateReceipt(receipt,{...state,...changed}));
  assert.throws(()=>validateReceipt({...receipt,allPassed:false},state));
});
