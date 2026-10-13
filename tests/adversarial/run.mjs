import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { writeFileSync } from 'fs';

const ADDR = process.argv[2];
if (!ADDR) { console.error('usage: node run.mjs <contract-address>'); process.exit(1); }
const keys = ['CG_KEY_A', 'CG_KEY_B', 'CG_KEY_C'].map(k => {
  const v = process.env[k];
  if (!v) { console.error(`missing env ${k} — set all three test-wallet private keys`); process.exit(1); }
  return v;
});
const mk = (k) => createClient({ chain: studionet, account: privateKeyToAccount(k) });
const cA = mk(keys[0]), cB = mk(keys[1]), cC = mk(keys[2]);
const A = { address: cA.account.address }, B = { address: cB.account.address }, C = { address: cC.account.address };
const ro = createClient({ chain: studionet });
const R = { contract: ADDR, owner: A.address, walletB: B.address, stranger: C.address, steps: [], txs: [] };
const step = (name, pass, info) => { R.steps.push({ name, pass, info }); console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name} :: ${info}`); };
const wait = (c, h) => c.waitForTransactionReceipt({ hash: h, status: 'ACCEPTED', retries: 240, interval: 5000 });

// returns {hash, exec} where exec is leader execution_result, or {threw}
async function write(client, fn, args) {
  try {
    const hash = await client.writeContract({ address: ADDR, functionName: fn, args });
    const r = await wait(client, hash);
    const exec = r.consensus_data?.leader_receipt?.[0]?.execution_result || 'UNKNOWN';
    R.txs.push({ fn, hash, exec });
    return { hash, exec };
  } catch (e) {
    R.txs.push({ fn, hash: null, exec: 'THREW', err: String(e.shortMessage || e.message).slice(0, 120) });
    return { hash: null, exec: 'THREW' };
  }
}
const readPos = async (pid) => { const s = await ro.readContract({ address: ADDR, functionName: 'get_position_status', args: [pid] }); return s === 'NOT_FOUND' ? null : JSON.parse(s); };
const pidA1 = `${A.address}#safe-1`, pidA2 = `${A.address}#critical-1`, pidB = `${B.address}#b-pos`;

// baselines: the suite also runs on a contract that already has positions/history
// (e.g. the production deployment). Assertions below are relative to these.
const _all0 = JSON.parse(await ro.readContract({ address: ADDR, functionName: 'get_all_positions', args: [] }));
const _aList0 = JSON.parse(await ro.readContract({ address: ADDR, functionName: 'get_positions_for_account', args: [A.address] }));
const _hist0 = JSON.parse(await ro.readContract({ address: ADDR, functionName: 'get_check_history', args: [200] }));
const _manual0 = _hist0.filter(h => h.type === 'CHECK' && h.trigger === 'MANUAL').length;
step('baseline', true, `positions=${_all0.length} a_positions=${_aList0.length} history=${_hist0.length} manual_checks=${_manual0}`);

// 1. protocol state disclosures
const ps = JSON.parse(await ro.readContract({ address: ADDR, functionName: 'get_protocol_state', args: [] }));
step('protocol_state_v3', ps.contract_version === 'v3.1' && ps.position_origin.includes('USER_DECLARED_SIMULATION') && ps.enforcement.includes('MONITORING_ONLY') && ps.monitoring_mode.includes('MANUAL'), JSON.stringify(ps).slice(0, 220));

// 2. register safe position (sender-bound)
let w = await write(cA, 'add_position', ['safe-1', 10, 1000, 'BTC', 'USDT']);
let p = await readPos(pidA1);
step('register_safe', w.exec === 'SUCCESS' && p && p.account === A.address && p.status === 'UNVERIFIED' && p.origin === 'USER_DECLARED_SIMULATION', `exec=${w.exec} account=${p?.account} status=${p?.status} origin=${p?.origin}`);

// 3. duplicate registration rejected
w = await write(cA, 'add_position', ['safe-1', 1, 1, 'BTC', 'USDT']);
step('duplicate_rejected', w.exec !== 'SUCCESS', `exec=${w.exec}`);

// 4. invalid inputs rejected
w = await write(cA, 'add_position', ['bad-asset', 1, 100, 'DOGE', 'USDT']);
const e1 = w.exec; w = await write(cA, 'add_position', ['bad-debt', 1, 100, 'BTC', 'EUR']);
const e2 = w.exec; w = await write(cA, 'add_position', ['zero-amt', 0, 100, 'BTC', 'USDT']);
step('invalid_inputs_rejected', e1 !== 'SUCCESS' && e2 !== 'SUCCESS' && w.exec !== 'SUCCESS', `asset=${e1} debt=${e2} zero=${w.exec}`);

// 5. check safe position (triggered by B -- manual checks are permissionless)
w = await write(cB, 'check_and_protect', [pidA1]);
p = await readPos(pidA1);
step('check_safe', w.exec === 'SUCCESS' && p && (p.status === 'SAFE' || p.status === 'WARNING') && p.sources_agreed >= 2 && p.price_used > 0, `exec=${w.exec} status=${p?.status} ratio=${p?.last_ratio} sources_agreed=${p?.sources_agreed} price_used=${p?.price_used} sentiment=${p?.ai_sentiment} src=${p?.price_source}`);

// 6. register + check critical position
w = await write(cA, 'add_position', ['critical-1', 1, 5000000, 'BTC', 'USDT']);
w = await write(cA, 'check_and_protect', [pidA2]);
p = await readPos(pidA2);
step('check_critical_locks', w.exec === 'SUCCESS' && p && p.status === 'CRITICAL' && p.locked === true, `exec=${w.exec} status=${p?.status} locked=${p?.locked} ratio=${p?.last_ratio}`);

// 7. locked position cannot be re-checked
w = await write(cA, 'check_and_protect', [pidA2]);
step('locked_check_rejected', w.exec !== 'SUCCESS', `exec=${w.exec}`);

// 8. stranger cannot resume
w = await write(cC, 'resume_position', [pidA2]);
p = await readPos(pidA2);
step('stranger_resume_rejected', w.exec !== 'SUCCESS' && p.locked === true, `exec=${w.exec} still_locked=${p.locked}`);

// 9. owner resumes -> UNVERIFIED (not safe)
w = await write(cA, 'resume_position', [pidA2]);
p = await readPos(pidA2);
step('resume_unverified', w.exec === 'SUCCESS' && p && p.status === 'UNVERIFIED' && p.locked === false, `exec=${w.exec} status=${p?.status} locked=${p?.locked}`);

// 10. resume of non-locked rejected
w = await write(cA, 'resume_position', [pidA2]);
step('resume_not_locked_rejected', w.exec !== 'SUCCESS', `exec=${w.exec}`);

// 11. re-check after resume -> CRITICAL again (resume did not fake safety)
w = await write(cA, 'check_and_protect', [pidA2]);
p = await readPos(pidA2);
step('recheck_after_resume', w.exec === 'SUCCESS' && p && p.status === 'CRITICAL' && p.locked === true, `exec=${w.exec} status=${p?.status} locked=${p?.locked}`);

// 12. B registers own position -- bound to B, not A
w = await write(cB, 'add_position', ['b-pos', 5, 2000, 'ETH', 'USDC']);
p = await readPos(pidB);
const bList = JSON.parse(await ro.readContract({ address: ADDR, functionName: 'get_positions_for_account', args: [B.address] }));
const aList = JSON.parse(await ro.readContract({ address: ADDR, functionName: 'get_positions_for_account', args: [A.address] }));
step('sender_binding', w.exec === 'SUCCESS' && p && p.account === B.address && bList.length === 1 && aList.length === _aList0.length + 2, `exec=${w.exec} account=${p?.account} bList=${bList.length} aList=${aList.length}`);

// 13. check B's ETH position (second asset corroboration)
w = await write(cB, 'check_and_protect', [pidB]);
p = await readPos(pidB);
step('check_eth_position', w.exec === 'SUCCESS' && p && p.sources_agreed >= 2 && p.status !== 'UNVERIFIED', `exec=${w.exec} status=${p?.status} ratio=${p?.last_ratio} sources_agreed=${p?.sources_agreed} sentiment=${p?.ai_sentiment}`);

// 14. threshold attacks + update
w = await write(cC, 'set_threshold', [200]); const t1 = w.exec;
w = await write(cA, 'set_threshold', [0]); const t2 = w.exec;
w = await write(cA, 'set_threshold', [200]); const t3 = w.exec;
let ps2 = JSON.parse(await ro.readContract({ address: ADDR, functionName: 'get_protocol_state', args: [] }));
const mid = ps2.threshold;
w = await write(cA, 'set_threshold', [150]);
step('threshold_controls', t1 !== 'SUCCESS' && t2 !== 'SUCCESS' && t3 === 'SUCCESS' && mid === '200', `stranger=${t1} zero=${t2} owner=${t3} readback=${mid}`);

// 15. pause attacks + gate
w = await write(cC, 'pause_protocol', []); const p1 = w.exec;
w = await write(cA, 'pause_protocol', []); const p2 = w.exec;
w = await write(cA, 'check_and_protect', [pidA1]); const p3 = w.exec;
w = await write(cA, 'resume_protocol', []); const p4 = w.exec;
w = await write(cB, 'check_and_protect', [pidA1]); const p5 = w.exec;
step('pause_gate', p1 !== 'SUCCESS' && p2 === 'SUCCESS' && p3 !== 'SUCCESS' && p4 === 'SUCCESS' && p5 === 'SUCCESS', `stranger_pause=${p1} owner_pause=${p2} check_paused=${p3} resume=${p4} check_after=${p5}`);

// 16. aggregate readback
const all = JSON.parse(await ro.readContract({ address: ADDR, functionName: 'get_all_positions', args: [] }));
const hist = JSON.parse(await ro.readContract({ address: ADDR, functionName: 'get_check_history', args: [100] }));
const checks = hist.filter(h => h.type === 'CHECK');
step('aggregate_readback', all.length === _all0.length + 3 && checks.length >= _manual0 + 3 && checks.every(h => h.trigger === 'MANUAL'), `positions=${all.length} history=${hist.length} manual_checks=${checks.length}`);
R.finalState = JSON.parse(await ro.readContract({ address: ADDR, functionName: 'get_protocol_state', args: [] }));
R.historyTypes = hist.map(h => h.type);
writeFileSync('./cg-results.json', JSON.stringify(R, null, 2));
console.log('results written to ./cg-results.json — run node finalize.mjs next to poll all txs to FINALIZED');
console.log('CG MAIN TEST DONE — steps passed:', R.steps.filter(s => s.pass).length, '/', R.steps.length, '| write txs:', R.txs.length);
