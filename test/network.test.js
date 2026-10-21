'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { server } = require('../server');

test('live Server-Sent Events publish room state changes to multiple clients',async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  const send = async(path,data)=>{
    const r=await fetch(base+'/api/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
    assert.equal(r.status,200);return r.json();
  };
  const cancels=[];
  try {
    const host=await send('create',{name:'Alpha'});
    const rival=await send('join',{name:'Bravo',code:host.code});
    async function watch(session) {
      const ctrl=new AbortController();cancels.push(ctrl);
      const u=base+'/api/events?code='+session.code+'&token='+session.token;
      const response=await fetch(u,{signal:ctrl.signal});
      assert.equal(response.status,200);
      assert.match(response.headers.get('content-type'),/text\/event-stream/);
      const reader=response.body.getReader();
      return reader;
    }
    const [hostReader,rivalReader]=await Promise.all([watch(host),watch(rival)]);
    // Both streams receive an initial authoritative snapshot.
    const [a,b]=await Promise.all([hostReader.read(),rivalReader.read()]);
    assert.match(new TextDecoder().decode(a.value),/event: state/);
    assert.match(new TextDecoder().decode(b.value),/event: state/);
    // A mutation by player B must be pushed to player A and B independently.
    await send('action',{code:rival.code,token:rival.token,type:'select_house',house:'kandor'});
    async function until(reader,predicate) {
      const decoder=new TextDecoder();let combined='';
      for(let n=0;n<5;n++) {
        const r=await Promise.race([reader.read(),new Promise((_,reject)=>setTimeout(()=>reject(Error('SSE did not publish in time')),2500))]);
        combined+=decoder.decode(r.value);
        if(predicate(combined))return combined;
      }
      throw new Error('No SSE state mutation received.');
    }
    const [a2,b2]=await Promise.all([until(hostReader,text=>text.includes('"house":"kandor"')),until(rivalReader,text=>text.includes('"house":"kandor"'))]);
    assert.match(a2,/"house":"kandor"/);
    assert.match(b2,/"house":"kandor"/);
  } finally {
    for(const c of cancels)c.abort();
    await new Promise(resolve=>server.close(resolve));
  }
});
