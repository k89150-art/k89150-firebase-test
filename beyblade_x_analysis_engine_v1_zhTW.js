// Beyblade X Contextual Analysis Engine v1.1
// \u4f7f\u7528\u65b9\u5f0f\uff1a
// import { analyzeCombo } from './beyblade_x_analysis_engine_v1_1_contextual_zhTW.js'
// analyzeCombo({ blade:'BX-31', ratchet:'5-60', bit:'I' }, database)
// CX:
// analyzeCombo({ cx:{ lockChip:'\u9f8d\u738b', metalBlade:'\u9583\u64ca', overBlade:'B', assistBlade:'K' }, ratchet:'1-50', bit:'I' }, database)

export function analyzeCombo(input, database, options = {}) {
  const ctx = buildContext(input, database);
  const score = initScore();
  const strengths = [];
  const warnings = [];
  const recommendations = [];

  applyWeightedBaseScores(ctx, score);
  applyContextualSynergy(ctx, score, strengths, warnings, recommendations);
  applyCxContext(ctx, score, strengths, warnings, recommendations);
  applyRiskDetection(ctx, score, strengths, warnings, recommendations);

  normalizeScores(score);
  const primaryRole = classifyPrimaryRole(ctx, score);
  const summary = buildContextualSummary(ctx, primaryRole, score);
  const deckRole = classifyDeckRole(ctx, primaryRole, score, warnings);
  const confidence = classifyConfidence(ctx, score);

  const finalStrengths = cleanList(strengths);
  const finalWarnings = warnings.length
    ? cleanList(warnings)
    : ['\u76ee\u524d\u6c92\u6709\u91cd\u5927\u7d50\u69cb\u6027\u98a8\u96aa\uff0c\u5efa\u8b70\u5148\u5be6\u6e2c\u767c\u5c04\u7a69\u5b9a\u6027\u8207\u5c0d\u653b\u64ca\u578b\u7684\u6297\u58d3\u80fd\u529b\u3002'];
  const finalRecommendations = recommendations.length
    ? cleanList(recommendations)
    : ['\u6b64\u914d\u7f6e\u65b9\u5411\u660e\u78ba\uff0c\u53ef\u5148\u4fdd\u7559\u6838\u5fc3\u96f6\u4ef6\u6e2c\u8a66\uff0c\u518d\u4f9d\u5be6\u6230\u7d50\u679c\u5fae\u8abf\u56fa\u9396\u6216\u8ef8\u5fc3\u3002'];

  return {
    version: 'v1.1-contextual',
    input,
    resolved: summarizeResolved(ctx),
    summary,
    primaryRole,
    scores: roundScore(score),
    strengths: finalStrengths,
    warnings: finalWarnings,
    recommendations: finalRecommendations,
    deckRole,
    confidence,
    debug: options.debug ? { tags: collectTags(ctx), contextFlags: buildFlags(ctx) } : undefined
  };
}

function initScore() {
  return {
    attack: 0,
    stamina: 0,
    defense: 0,
    balance: 0,
    burstSafety: 0,
    control: 0,
    metaConfidence: 0,
    selfKORisk: 0
  };
}


function normalize(s) { return (s ?? '').toString().trim().toLowerCase(); }
function includesAny(text, words) { const t = normalize(text); return words.some(w => t.includes(normalize(w))); }
function hasTag(part, tags) { return (part?.roleTags || []).some(t => tags.includes(t)); }
function partLabel(part) { return part?.name || part?.code || part?.id || '\u672a\u8b58\u5225\u96f6\u4ef6'; }
function tierValue(tier) { return ({ S: 5, A: 4, 'A-': 3.5, 'B+': 3.2, B: 3, 'B-': 2.5, C: 2, D: 1 })[tier] ?? 2; }
function confValue(c) { return ({ high: 5, 'medium-high': 4, medium: 3, 'medium-low': 2, low: 1, unknown: 1.5 })[c] ?? 2; }

function findByAny(list, value, keys) {
  const v = normalize(value);
  if (!v || !Array.isArray(list)) return null;
  // \u5148\u505a\u7cbe\u6e96\u6bd4\u5c0d\uff0c\u907f\u514d Impact \u88ab\u77ed\u4ee3\u78bc P \u8aa4\u5224\u3002
  const exact = list.find(item => keys.some(k => normalize(item[k]) === v));
  if (exact) return exact;
  // \u518d\u505a\u8f03\u5b89\u5168\u7684\u6a21\u7cca\u6bd4\u5c0d\uff1a\u53ea\u5141\u8a31\u4f7f\u7528\u8005\u8f38\u5165\u53bb\u6bd4\u5c0d\u8f03\u9577\u6b04\u4f4d\u5167\u5bb9\u3002
  return list.find(item => keys.some(k => {
    const raw = normalize(item[k]);
    if (!raw || raw.length < 2 || v.length < 2) return false;
    return raw.includes(v);
  })) || null;
}
function findBlade(db, value) { return findByAny(db.blades, value, ['id','model','name']); }
function findRatchet(db, value) { return findByAny(db.ratchets, value, ['id','code']); }
function findBit(db, value) { return findByAny(db.bits, value, ['id','code','name']); }
function findCx(list, value, keys=['id','code','name']) { return findByAny(list, value, keys); }

function buildContext(input, db) {
  const ratchet = findRatchet(db, input.ratchet || input.ratchetCode);
  const bit = findBit(db, input.bit || input.bitCode);
  let blade = findBlade(db, input.blade || input.bladeIdOrName);
  let cx = null;

  const cxInput = input.cx || input;
  const hasCxInput = !!(input.cx || cxInput.lockChip || cxInput.lockChipName || cxInput.assistBlade || cxInput.assistBladeCode || cxInput.metalBlade || cxInput.metalBladeName || cxInput.mainBlade || cxInput.mainBladeName || cxInput.overBlade || cxInput.overBladeCode);

  if (hasCxInput && db.cx) {
    const lockChip = findCx(db.cx.lockChips, cxInput.lockChip || cxInput.lockChipName, ['name','id']);
    const mainBlade = findCx(db.cx.mainBlades, cxInput.mainBlade || cxInput.mainBladeName, ['name','id']);
    const metalBlade = findCx(db.cx.metalBlades, cxInput.metalBlade || cxInput.metalBladeName, ['name','id']);
    const overBlade = findCx(db.cx.overBlades, cxInput.overBlade || cxInput.overBladeCode || cxInput.over, ['code','name','id']);
    const assistBlade = findCx(db.cx.assistBlades, cxInput.assistBlade || cxInput.assistBladeCode || cxInput.assist || cxInput.assistCode, ['code','name','id']);
    cx = { lockChip, mainBlade, metalBlade, overBlade, assistBlade, mode: cxInput.mode || null };
    blade = blade || metalBlade || mainBlade;
  }
  return { blade, ratchet, bit, cx };
}

function collectTags(ctx) {
  const all = [];
  for (const p of [ctx.blade, ctx.ratchet, ctx.bit, ctx.cx?.lockChip, ctx.cx?.mainBlade, ctx.cx?.metalBlade, ctx.cx?.overBlade, ctx.cx?.assistBlade]) {
    if (p?.roleTags) all.push(...p.roleTags);
    if (p?.role) all.push(p.role);
  }
  return all;
}

function buildFlags(ctx) {
  const bladeText = `${ctx.blade?.role || ''} ${(ctx.blade?.roleTags || []).join(' ')} ${ctx.blade?.name || ''}`;
  const bitText = `${ctx.bit?.role || ''} ${(ctx.bit?.roleTags || []).join(' ')} ${ctx.bit?.name || ''}`;
  const ratchet = ctx.ratchet;
  const bitCode = ctx.bit?.code;
  const flags = {
    bladeAttack: hasTag(ctx.blade, ['\u653b\u64ca']) || includesAny(bladeText, ['\u653b\u64ca','\u91cd\u653b\u64ca','\u4e00\u64ca','\u58d3\u5236']),
    bladeHeavyAttack: includesAny(bladeText, ['\u91cd\u653b\u64ca','\u91cd\u91cf','\u4e00\u64ca','\u58d3\u5236']) || ['\u66b4\u9f8d\u9738\u64ca','\u84bc\u9f8d\u7a81\u64ca','\u885d\u64ca\u9f8d\u795e','\u9cf3\u51f0\u98db\u7ffc','\u9cf3\u51f0\u5c3e\u7ffc','\u5929\u880d\u9577\u77db'].some(n => (ctx.blade?.name || '').includes(n)),
    bladeStamina: hasTag(ctx.blade, ['\u6301\u4e45']) || includesAny(bladeText, ['\u6301\u4e45','\u7e8c\u822a','\u7a69\u5b9a']),
    bladeDefense: hasTag(ctx.blade, ['\u9632\u79a6']) || includesAny(bladeText, ['\u9632\u79a6','\u6297\u58d3','\u53cd\u6253','anti']),
    bladeLeftSpin: includesAny(ctx.blade?.name || '', ['\u84bc\u7a79\u9f8d\u9a0e\u58eb','\u9695\u661f\u9f8d\u9a0e\u58eb','dragoon']),
    bitAttack: hasTag(ctx.bit, ['\u653b\u64ca']) || ['R','LR','GF','F','LF','A','V','I','Q','RA','UF','J'].includes(bitCode),
    bitControlledAttack: ['R','LR'].includes(bitCode),
    bitBurstAttack: ['GF','A','V','I','Q','RA'].includes(bitCode),
    bitStamina: hasTag(ctx.bit, ['\u6301\u4e45']) || ['B','O','DB','LO','FB','W','WW','Nr','Y'].includes(bitCode),
    bitDefense: hasTag(ctx.bit, ['\u9632\u79a6']) || ['H','WB','BS','UN','N','HN','MN','S','D'].includes(bitCode),
    bitBalance: hasTag(ctx.bit, ['\u5e73\u8861']) || ['P','T','GP','GB','G','GR','K','U','GU','L','E'].includes(bitCode),
    bitLeftSpinEndgame: bitCode === 'E',
    bitTechnical: ['P','L','TP','TK','U'].includes(bitCode),
    ratchetLow: ratchet?.height <= 60,
    ratchetUltraLow: ratchet?.height < 60,
    ratchetMid: ratchet?.height === 65 || ratchet?.height === 70,
    ratchetHigh: ratchet?.height >= 80,
    ratchetStable: ['5','7','9','0'].includes((ratchet?.code || '').split('-')[0]),
    ratchetAttackAligned: ['1','2','3'].includes((ratchet?.code || '').split('-')[0]),
    ratchetBurstSafe: ['9-60','9-65','5-60','7-55','4-50','4-55','0-60'].includes(ratchet?.code)
  };
  return flags;
}

function add(score, obj, weight = 1) {
  for (const [k, v] of Object.entries(obj)) {
    if (!(k in score)) score[k] = 0;
    score[k] += v * weight;
  }
}

function tagScore(part) {
  const out = { attack: 0, stamina: 0, defense: 0, balance: 0, burstSafety: 0, control: 0, metaConfidence: 0, selfKORisk: 0 };
  const text = `${part?.role || ''} ${(part?.roleTags || []).join(' ')}`;
  if (includesAny(text, ['\u653b\u64ca','\u91cd\u653b\u64ca','\u4e00\u64ca','\u58d3\u5236'])) out.attack += 2;
  if (includesAny(text, ['\u6301\u4e45','\u7e8c\u822a','\u8010\u4e45'])) out.stamina += 2;
  if (includesAny(text, ['\u9632\u79a6','\u6297\u58d3','\u53cd\u6253','anti'])) out.defense += 2;
  if (includesAny(text, ['\u5e73\u8861','\u5747\u8861','\u7a69\u5b9a'])) out.balance += 1.5;
  if (includesAny(text, ['\u4f4e\u8eab\u4f4d','\u7206\u6297','\u9632\u7206'])) out.burstSafety += 1.3;
  if (includesAny(text, ['\u53ef\u63a7','\u7a69\u5b9a','\u7559\u4e2d'])) out.control += 1.2;
  if (includesAny(text, ['\u9ad8\u7206\u767c','\u66b4\u885d','\u4e82\u6d41','\u4e00\u64ca'])) out.selfKORisk += 1.2;
  out.metaConfidence += tierValue(part?.metaTier) * 0.45 + confValue(part?.confidence) * 0.55;
  return out;
}

function applyWeightedBaseScores(ctx, score) {
  // v1.1 \u6838\u5fc3\uff1aBlade 45%\u3001Bit 35%\u3001Ratchet 20%\uff1bCX \u62c6\u4ef6\u4ee5 Blade \u6b0a\u91cd\u5167\u90e8\u5206\u914d\u3002
  if (ctx.cx) {
    add(score, tagScore(ctx.cx.metalBlade || ctx.cx.mainBlade || ctx.blade), 0.28);
    add(score, tagScore(ctx.cx.assistBlade), 0.14);
    add(score, tagScore(ctx.cx.overBlade), 0.06);
    add(score, tagScore(ctx.cx.lockChip), 0.04);
  } else {
    add(score, tagScore(ctx.blade), 0.45);
  }
  add(score, tagScore(ctx.bit), 0.35);
  add(score, tagScore(ctx.ratchet), 0.20);
}

function applyContextualSynergy(ctx, score, strengths, warnings, recommendations) {
  const f = buildFlags(ctx);
  const blade = partLabel(ctx.blade);
  const ratchet = partLabel(ctx.ratchet);
  const bit = `${ctx.bit?.name || ctx.bit?.code || '\u672a\u8b58\u5225\u8ef8\u5fc3'}`;
  const bitCode = ctx.bit?.code;
  const ratchetCode = ctx.ratchet?.code;

  if (f.bladeHeavyAttack && f.bitBurstAttack) {
    add(score, { attack: 2.5, selfKORisk: 1.8, stamina: -0.8, control: -0.8 });
    strengths.push(`${blade} \u672c\u8eab\u504f\u91cd\u653b\u64ca\uff0c\u642d\u914d ${bit} \u53ef\u4ee5\u628a\u77ac\u9593\u885d\u64ca\u8207\u4e00\u64ca\u7206\u767c\u62c9\u9ad8\u3002`);
    warnings.push(`${bit} \u5c6c\u65bc\u9ad8\u7206\u767c\u6216\u4e00\u64ca\u578b\u8ef8\u5fc3\uff0c\u7b2c\u4e00\u6ce2\u6c92\u6709\u6253\u51fa\u6709\u6548\u63a5\u89f8\u6642\uff0c\u5f8c\u6bb5\u7e8c\u822a\u8207\u63a7\u5834\u98a8\u96aa\u6703\u4e0a\u5347\u3002`);
    recommendations.push(`\u82e5\u60f3\u4fdd\u7559\u653b\u64ca\u4f46\u63d0\u9ad8\u7a69\u5b9a\u5ea6\uff0c\u53ef\u628a ${bitCode || '\u6b64\u8ef8\u5fc3'} \u6539\u6e2c R \u6216 LR\u3002`);
  }

  if (f.bladeAttack && f.bitControlledAttack) {
    add(score, { attack: 2, control: 1.5, selfKORisk: -0.5 });
    strengths.push(`${blade} \u642d\u914d ${bit} \u6703\u504f\u5411\u53ef\u63a7\u653b\u64ca\uff0c\u901a\u5e38\u6bd4\u7d14\u66b4\u885d\u8ef8\u5fc3\u66f4\u5bb9\u6613\u6253\u51fa\u53ef\u91cd\u8907\u7684\u653b\u64ca\u8def\u7dda\u3002`);
  }

  if (f.bladeAttack && f.bitStamina && !f.bitLeftSpinEndgame) {
    add(score, { balance: 1.2, attack: -0.8, stamina: 0.8 });
    warnings.push(`${blade} \u662f\u653b\u64ca\u53d6\u5411\uff0c\u4f46 ${bit} \u504f\u6301\u4e45\uff0c\u53ef\u80fd\u964d\u4f4e\u4e3b\u52d5\u5f97\u5206\u80fd\u529b\uff1b\u9019\u6703\u8b8a\u6210\u5e73\u8861\u6216\u7279\u5316\u8def\u7dda\uff0c\u800c\u4e0d\u662f\u7d14\u653b\u64ca\u3002`);
    recommendations.push(`\u82e5\u76ee\u6a19\u662f\u64ca\u98db\uff0c\u5efa\u8b70\u512a\u5148\u6e2c R\u3001LR\u3001GF \u6216 A\uff1b\u82e5\u76ee\u6a19\u662f\u62d6\u8f49\u901f\uff0c\u5247\u8981\u78ba\u8a8d ${blade} \u7684\u5916\u578b\u662f\u5426\u8db3\u5920\u7a69\u5b9a\u3002`);
  }

  if (f.bladeStamina && f.bitAttack) {
    add(score, { balance: 1.2, attack: 0.8, stamina: -0.6, control: -0.4 });
    warnings.push(`${blade} \u504f\u6301\u4e45\uff0c\u4f46 ${bit} \u6703\u8b93\u5b83\u66f4\u4e3b\u52d5\u79fb\u52d5\uff1b\u9019\u662f\u53cd\u6253\u6216\u7279\u5316\u8def\u7dda\uff0c\u4e0d\u61c9\u76f4\u63a5\u7576\u7d14\u6301\u4e45\u914d\u7f6e\u3002`);
  }

  if (f.bladeStamina && ['B','O','DB','LO','FB'].includes(bitCode)) {
    add(score, { stamina: 2.2, control: 1.1, defense: 0.4 });
    strengths.push(`${blade} \u642d\u914d ${bit} \u7684\u65b9\u5411\u660e\u78ba\uff0c\u662f\u4ee5\u7559\u4e2d\u3001\u7e8c\u822a\u8207\u672b\u6bb5\u7a69\u5b9a\u70ba\u4e3b\u7684\u6301\u4e45\u914d\u7f6e\u3002`);
  }

  if (f.bladeLeftSpin && bitCode === 'E') {
    add(score, { stamina: 2.4, balance: 1.2, metaConfidence: 1.2 });
    strengths.push(`${blade} \u662f\u5de6\u8ff4\u65cb\u6838\u5fc3\uff0c\u642d\u914d Elevate/\u62ac\u5347\u53ef\u5f37\u5316\u53cd\u65cb\u672b\u6bb5\u8207\u62d6\u8f49\u901f\u80fd\u529b\u3002`);
  }

  if ((f.bladeDefense || includesAny(ctx.blade?.role, ['\u91cd\u91cf','\u7a69\u5b9a'])) && ['H','WB','BS'].includes(bitCode)) {
    add(score, { defense: 2.2, control: 1.2, stamina: 0.5 });
    strengths.push(`${blade} \u642d\u914d ${bit} \u53ef\u8d70 anti-attack / \u9632\u5b88\u53cd\u6253\u8def\u7dda\uff0c\u91cd\u9ede\u662f\u6297\u63a8\u3001\u56de\u6b63\u8207\u5438\u6536\u653b\u64ca\u3002`);
  }

  if (f.ratchetLow) {
    add(score, { burstSafety: 1.1, control: 0.4 });
    strengths.push(`${ratchet} \u7684 ${ctx.ratchet.height} \u9ad8\u5ea6\u80fd\u8b93 ${blade} \u4fdd\u6301\u8f03\u4f4e\u91cd\u5fc3\uff0c\u901a\u5e38\u6709\u52a9\u65bc\u964d\u4f4e\u88ab\u6253\u56fa\u9396\u7684\u98a8\u96aa\u3002`);
  }
  if (f.ratchetUltraLow) {
    add(score, { burstSafety: 1.2, attack: 0.7, stamina: -0.3 });
    strengths.push(`${ratchet} \u5c6c\u65bc\u8d85\u4f4e\u8eab\u4f4d\u56fa\u9396\uff0c\u80fd\u58d3\u4f4e\u6574\u9ad4\u9ad8\u5ea6\uff0c\u9069\u5408\u4e00\u64ca\u653b\u64ca\u6216\u4f4e\u6253\u9ede\u914d\u7f6e\u3002`);
    warnings.push(`${ratchet} \u904e\u4f4e\u6642\u8981\u6ce8\u610f\u522e\u5730\u3001\u50be\u659c\u5f8c\u78e8\u5730\uff0c\u4ee5\u53ca\u8ef8\u5fc3\u5de5\u4f5c\u89d2\u5ea6\u88ab\u58d3\u7e2e\u7684\u554f\u984c\u3002`);
  }
  if (f.ratchetStable) {
    add(score, { control: 0.9, stamina: 0.4, defense: 0.3 });
    strengths.push(`${ratchet} \u7684\u51f8\u9ede\u5206\u5e03\u504f\u7a69\u5b9a\uff0c\u80fd\u7a0d\u5fae\u88dc\u8db3 ${bit} \u6216 ${blade} \u5728\u59ff\u614b\u4e0a\u7684\u4e0d\u7a69\u3002`);
  }
  if (f.ratchetAttackAligned && f.bladeAttack) {
    add(score, { attack: 0.9 });
    strengths.push(`${ratchet} \u7684\u51f8\u9ede\u6578\u8f03\u9069\u5408\u5c0d\u4f4d\u653b\u64ca\u6253\u9ede\uff0c\u80fd\u8b93 ${blade} \u7684\u653b\u64ca\u8def\u7dda\u66f4\u96c6\u4e2d\u3002`);
  }
  if (f.ratchetHigh) {
    add(score, { burstSafety: -1.4, control: -0.7, defense: -0.4 });
    warnings.push(`${ratchet} \u5c6c\u65bc\u9ad8\u8eab\u4f4d\u56fa\u9396\uff0c\u5bb9\u6613\u8b93\u56fa\u9396\u66b4\u9732\u5728\u653b\u64ca\u7bc4\u570d\u5167\uff1b\u82e5\u6c92\u6709\u660e\u78ba\u6253\u9ede\u9700\u6c42\uff0c\u5efa\u8b70\u512a\u5148\u6e2c 60 / 65 / 55 \u9ad8\u5ea6\u3002`);
    recommendations.push(`\u82e5\u9019\u7d44\u4e0d\u662f\u9ad8\u8eab\u4f4d\u7279\u5316\uff0c\u5efa\u8b70\u6539\u6e2c 9-60\u30015-60\u30014-50\u30014-55 \u6216 9-65\u3002`);
  }

  if (bitCode === 'B' && !f.bladeStamina) {
    warnings.push(`B / Ball \u662f\u7d14\u6301\u4e45\u57fa\u6e96\uff0c\u4f46 ${blade} \u4e0d\u4e00\u5b9a\u662f\u7d14\u6301\u4e45\u4e0a\u84cb\uff1b\u5982\u679c\u7f3a\u4e4f\u5713\u6ed1\u5916\u578b\u6216\u5916\u91cd\u5fc3\uff0c\u53ef\u80fd\u88ab\u653b\u64ca\u578b\u63a8\u51fa\u3002`);
  }
  if (bitCode === 'P') {
    strengths.push(`P / Point \u662f\u6280\u8853\u578b\u5e73\u8861\u8ef8\u5fc3\uff0c\u767c\u5c04\u89d2\u5ea6\u6703\u660e\u986f\u5f71\u97ff\u5b83\u504f\u653b\u64ca\u6216\u504f\u7559\u4e2d\u3002`);
    warnings.push(`\u4f7f\u7528 P \u6642\u8981\u5be6\u6e2c\u5e73\u5c04\u3001\u659c\u5c04\u8207\u5f31\u767c\uff1b\u89d2\u5ea6\u4e0d\u7a69\u6703\u8b93\u8def\u7dda\u8b8a\u5f97\u904e\u5ea6\u6fc0\u9032\u6216\u904e\u65e9\u5931\u901f\u3002`);
  }
  if (bitCode === 'L') {
    strengths.push(`L / Level \u4e0d\u662f\u7d14\u653b\u64ca\u8ef8\u5fc3\uff0c\u800c\u662f\u653b\u64ca\u6301\u4e45\u6df7\u5408\uff1b\u9069\u5408\u8b93\u91cd\u578b\u4e0a\u84cb\u4fdd\u7559\u4e3b\u52d5\u6027\u8207\u672b\u6bb5\u6548\u7387\u3002`);
  }
}

function applyCxContext(ctx, score, strengths, warnings, recommendations) {
  if (!ctx.cx) return;
  const assist = ctx.cx.assistBlade;
  const over = ctx.cx.overBlade;
  const metal = ctx.cx.metalBlade;
  const main = ctx.cx.mainBlade;
  const bladeName = partLabel(metal || main);

  if (assist?.code === 'H') {
    add(score, { attack: 1.3, defense: 0.8, control: 0.6, metaConfidence: 0.8 });
    strengths.push(`CX \u8f14\u52a9\u6230\u5203 H / Heavy \u80fd\u88dc\u91cd\u91cf\u4e14\u9ad8\u5ea6\u4f4e\uff0c\u901a\u5e38\u53ef\u4ee5\u4fdd\u7559 ${bladeName} \u7684\u4e3b\u8981\u63a5\u89f8\u9ede\uff0c\u662f\u76ee\u524d\u6700\u503c\u5f97\u512a\u5148\u6e2c\u7684 CX \u8f14\u52a9\u6230\u5203\u4e4b\u4e00\u3002`);
  }
  if (['B','W','E','Z'].includes(assist?.code)) {
    add(score, { defense: 0.9, stamina: 0.6, control: 0.5 });
    strengths.push(`CX \u8f14\u52a9\u6230\u5203 ${assist.code} / ${assist.name || assist.id} \u504f\u9632\u5b88\u3001\u6301\u4e45\u6216\u6297\u4e0b\u65b9\u653b\u64ca\uff0c\u9069\u5408\u7528\u4f86\u63d0\u9ad8 CX \u4e0a\u84cb\u7684\u7a69\u5b9a\u8207\u6297\u58d3\u80fd\u529b\u3002`);
  }
  if (assist?.code === 'K') {
    add(score, { attack: 1.2, selfKORisk: 0.8 });
    strengths.push(`K / Knuckle \u80fd\u66ff ${bladeName} \u88dc\u96c6\u4e2d\u6253\u9ede\uff0c\u9069\u5408\u4e00\u64ca\u653b\u64ca\u8def\u7dda\u3002`);
    warnings.push(`K / Knuckle \u53ef\u80fd\u589e\u52a0\u53cd\u4f5c\u7528\uff1b\u5982\u679c\u653b\u64ca\u8ecc\u8de1\u592a\u66b4\u885d\uff0c\u5bb9\u6613\u81ea\u5df1\u5148\u5931\u8861\u6216\u7a7a\u8f49\u3002`);
    recommendations.push(`\u82e5 K \u592a\u4e0d\u7a69\uff0c\u53ef\u6e2c H \u63d0\u9ad8\u91cd\u91cf\u7a69\u5b9a\uff0c\u6216\u6539\u7528 R / LR \u985e\u8ef8\u5fc3\u964d\u4f4e\u5931\u63a7\u3002`);
  }
  if (metal?.name === '\u9583\u64ca') {
    add(score, { attack: 1.8, selfKORisk: 0.7 });
    strengths.push(`\u9583\u64ca\u91d1\u5c6c\u6230\u5203\u7684\u6838\u5fc3\u662f\u96c6\u4e2d\u6253\u9ede\u8207\u4f4e\u8eab\u4f4d\u4e00\u64ca\u653b\u64ca\uff0c\u9069\u5408\u642d\u914d\u4f4e\u56fa\u9396\u8207\u653b\u64ca\u8ef8\u5fc3\u3002`);
  }
  if (metal?.name === '\u72c2\u6012') {
    add(score, { defense: 1.0, balance: 1.0, attack: 0.4 });
    strengths.push(`\u72c2\u6012\u91d1\u5c6c\u6230\u5203\u66f4\u63a5\u8fd1\u53cd\u653b / anti-attack \u8def\u7dda\uff0c\u4e0d\u61c9\u53ea\u7576\u7d14\u653b\u64ca\u96f6\u4ef6\u770b\u3002`);
  }
  if (metal?.name === '\u97ad\u64ca') {
    add(score, { stamina: 1.1, balance: 0.8 });
    strengths.push(`\u97ad\u64ca\u91d1\u5c6c\u6230\u5203\u504f\u5916\u91cd\u5fc3\u8207\u5e72\u64fe / \u6301\u4e45\u65b9\u5411\uff0c\u9069\u5408\u7528\u7a69\u5b9a\u8ef8\u5fc3\u6e2c\u7e8c\u822a\u8207\u59ff\u614b\u3002`);
  }
  if (over?.code === 'F') {
    add(score, { control: 0.6, balance: 0.4 });
    strengths.push(`F / Flow \u8d85\u8d8a\u6230\u5203\u504f\u4f4e\u5e72\u6d89\u8207\u914d\u91cd\u8abf\u6574\uff0c\u91cd\u9ede\u662f\u8b93\u91d1\u5c6c\u6230\u5203\u672c\u9ad4\u5de5\u4f5c\uff0c\u800c\u4e0d\u662f\u81ea\u5df1\u4e3b\u52d5\u653b\u64ca\u3002`);
  }
  if (over?.code === 'P') {
    add(score, { balance: 0.8 });
    warnings.push(`P \u985e\u8d85\u8d8a\u6230\u5203\u5c6c\u65bc\u6a21\u5f0f\u578b\u96f6\u4ef6\uff0c\u5206\u6790\u6642\u9700\u8981\u8a18\u9304\u88dd\u914d\u65b9\u5411\uff1b\u65b9\u5411\u4e0d\u540c\uff0c\u653b\u64ca / \u5e73\u8861 / \u9632\u79a6\u8868\u73fe\u6703\u4e0d\u540c\u3002`);
  }
}

function applyRiskDetection(ctx, score, strengths, warnings, recommendations) {
  const f = buildFlags(ctx);
  const bit = ctx.bit;
  const blade = partLabel(ctx.blade);
  const ratchet = partLabel(ctx.ratchet);

  if (score.selfKORisk >= 1.8) {
    warnings.push(`${partLabel(bit)} \u6703\u653e\u5927\u81ea\u7206\u6216\u7a7a\u8f49\u98a8\u96aa\uff1b${blade} \u82e5\u7b2c\u4e00\u6ce2\u6c92\u6253\u4e2d\uff0c\u5f8c\u6bb5\u5f88\u53ef\u80fd\u9032\u5165\u5931\u901f\u3002`);
    recommendations.push(`\u82e5\u5be6\u6e2c\u5e38\u81ea\u7206\uff0c\u5148\u628a\u8ef8\u5fc3\u6539\u6210 R / LR\uff1b\u82e5\u60f3\u4fdd\u7559\u7206\u767c\uff0c\u518d\u8abf\u6574\u767c\u5c04\u89d2\u5ea6\u6216\u6539 9-60 / 5-60 \u589e\u52a0\u7a69\u5b9a\u3002`);
  }
  if (f.bitStamina && !f.bladeStamina && !f.bladeDefense) {
    warnings.push(`${partLabel(bit)} \u504f\u6301\u4e45\uff0c\u4f46 ${blade} \u4e0d\u4e00\u5b9a\u80fd\u9760\u5916\u578b\u7a69\u5b9a\u62d6\u5230\u672b\u6bb5\uff0c\u9700\u6ce8\u610f\u88ab\u63a8\u51fa\u6216\u88ab\u58d3\u5236\u3002`);
  }
  if (['N','HN','MN','UN','S','D'].includes(bit?.code)) {
    warnings.push(`${partLabel(bit)} \u504f\u5b9a\u9ede\u6216\u4f4e\u6469\u64e6\uff0c\u9047\u5230\u9ad8\u885d\u64ca\u653b\u64ca\u6642\u53ef\u80fd\u88ab\u76f4\u63a5\u63a8\u51fa\uff0c\u4e0d\u80fd\u53ea\u7528\u300c\u9632\u79a6\u300d\u6a19\u7c64\u5224\u65b7\u3002`);
  }
  if (f.ratchetMid && f.bladeStamina) {
    warnings.push(`${ratchet} \u53ef\u4ee5\u8abf\u6574\u63a5\u89f8\u9ad8\u5ea6\uff0c\u4f46\u6301\u4e45\u914d\u7f6e\u82e5\u6c92\u6709\u660e\u78ba\u6253\u9ede\u9700\u6c42\uff0c\u901a\u5e38\u4ecd\u8981\u548c 9-60 / 5-60 / 9-65 \u6bd4\u8f03\u7a69\u5b9a\u6027\u3002`);
  }
}

function normalizeScores(score) {
  // \u5c07\u5206\u6578\u9650\u5236\u5230 0~10\uff1bselfKORisk \u4e0d\u986f\u793a\u65bc\u4e3b\u5206\u6578\u4f46\u6703\u5f71\u97ff control\u3002
  score.control -= Math.max(0, score.selfKORisk || 0) * 0.25;
  for (const k of ['attack','stamina','defense','balance','burstSafety','control','metaConfidence']) {
    score[k] = Math.max(0, Math.min(10, score[k]));
  }
}

function classifyPrimaryRole(ctx, score) {
  const f = buildFlags(ctx);
  const bitCode = ctx.bit?.code;
  if (f.bladeHeavyAttack && f.bitBurstAttack) return '\u4f4e\u8eab\u4f4d\u91cd\u653b\u64ca / \u4e00\u64ca\u7206\u767c\u578b';
  if (f.bladeAttack && f.bitControlledAttack) return '\u53ef\u63a7\u653b\u64ca\u578b';
  if (f.bladeLeftSpin && bitCode === 'E') return '\u5de6\u8ff4\u65cb\u53cd\u65cb\u672b\u6bb5\u578b';
  if (f.bladeStamina && ['B','O','DB','LO','FB','W','WW'].includes(bitCode)) return '\u6301\u4e45 / \u7e8c\u822a\u578b';
  if ((f.bladeDefense || f.bladeStamina) && ['H','WB','BS'].includes(bitCode)) return '\u9632\u5b88\u53cd\u6253 / anti-attack \u578b';
  if (score.attack >= score.stamina && score.attack >= score.defense && score.attack >= score.balance) return '\u653b\u64ca\u578b';
  if (score.stamina >= score.attack && score.stamina >= score.defense && score.stamina >= score.balance) return '\u6301\u4e45 / \u7e8c\u822a\u578b';
  if (score.defense >= score.attack && score.defense >= score.stamina && score.defense >= score.balance) return '\u9632\u79a6 / \u6297\u653b\u64ca\u578b';
  return '\u5e73\u8861 / \u4f9d\u767c\u5c04\u8abf\u6574\u578b';
}

function buildContextualSummary(ctx, role, score) {
  const blade = partLabel(ctx.blade);
  const ratchet = partLabel(ctx.ratchet);
  const bit = partLabel(ctx.bit);
  if (ctx.cx) {
    const core = partLabel(ctx.cx.metalBlade || ctx.cx.mainBlade || ctx.blade);
    const assist = partLabel(ctx.cx.assistBlade);
    return `${role}\uff1a\u4ee5 ${core} \u4f5c\u70ba\u4e3b\u8981\u63a5\u89f8\u6838\u5fc3\uff0c${assist} \u88dc\u5f37\u4e0b\u5c64\u8868\u73fe\uff0c\u642d\u914d ${ratchet} \u8207 ${bit} \u5f62\u6210\u5be6\u6230\u8def\u7dda\u3002`;
  }
  return `${role}\uff1a${blade} \u642d\u914d ${ratchet} \u8207 ${bit}\uff0c\u4e3b\u8981\u8a55\u4f30\u91cd\u9ede\u662f\u96f6\u4ef6\u65b9\u5411\u662f\u5426\u4e92\u88dc\u3001\u662f\u5426\u80fd\u7a69\u5b9a\u57f7\u884c\u52dd\u5229\u65b9\u5f0f\u3002`;
}

function classifyDeckRole(ctx, primaryRole, score, warnings) {
  if (primaryRole.includes('\u4e00\u64ca') || primaryRole.includes('\u653b\u64ca')) {
    if (score.control >= 1.5 && warnings.length <= 2) return '\u4e3b\u52d5\u653b\u64ca\u4f4d';
    return '\u5947\u8972\u653b\u64ca\u4f4d\uff0c\u4e0d\u5efa\u8b70\u7576\u4fdd\u5e95\u6301\u4e45\u4f4d';
  }
  if (primaryRole.includes('\u53cd\u65cb')) return '\u53cd\u5236\u4f4d / \u91dd\u5c0d\u53f3\u8ff4\u65cb\u6301\u4e45\u8207\u672b\u6bb5\u5c0d\u5c40';
  if (primaryRole.includes('\u6301\u4e45')) return '\u4fdd\u5e95\u4f4d / \u6301\u4e45\u7a69\u5b9a\u4f4d';
  if (primaryRole.includes('\u9632\u5b88') || primaryRole.includes('anti')) return '\u53cd\u5236\u4f4d / \u6297\u653b\u64ca\u4f4d';
  return '\u5e73\u8861\u4f4d / \u4f9d\u968a\u4f0d\u7f3a\u53e3\u8abf\u6574';
}

function classifyConfidence(ctx, score) {
  const parts = [ctx.blade, ctx.ratchet, ctx.bit, ctx.cx?.mainBlade, ctx.cx?.metalBlade, ctx.cx?.overBlade, ctx.cx?.assistBlade].filter(Boolean);
  const avg = parts.length ? parts.reduce((s,p)=>s+confValue(p.confidence),0) / parts.length : 1;
  if (avg >= 4.2 || score.metaConfidence >= 4) return '\u9ad8';
  if (avg >= 2.6 || score.metaConfidence >= 2) return '\u4e2d';
  return '\u5f85\u9a57\u8b49';
}

function roundScore(score) {
  const keys = ['attack','stamina','defense','balance','burstSafety','control','metaConfidence'];
  const out = {};
  for (const k of keys) out[k] = Math.round((score[k] || 0) * 10) / 10;
  return out;
}

function cleanList(list) {
  return [...new Set((list || []).filter(Boolean))];
}

function summarizeResolved(ctx) {
  return {
    blade: ctx.blade ? `${ctx.blade.model ? ctx.blade.model + ' ' : ''}${ctx.blade.name || ctx.blade.id}` : null,
    ratchet: ctx.ratchet?.code || null,
    bit: ctx.bit ? `${ctx.bit.code} / ${ctx.bit.name || ''}` : null,
    cx: ctx.cx ? {
      lockChip: ctx.cx.lockChip?.name || null,
      mainBlade: ctx.cx.mainBlade?.name || null,
      metalBlade: ctx.cx.metalBlade?.name || null,
      overBlade: ctx.cx.overBlade?.code || null,
      assistBlade: ctx.cx.assistBlade?.code || null,
      mode: ctx.cx.mode || null
    } : null
  };
}
