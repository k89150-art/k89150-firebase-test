
/**
 * Beyblade X analysis helper v1.8
 * Use with beyblade_x_codex_database_v1_8_ASCII_SAFE.json
 */
export function findPart(database, section, matcher) {
  const arr = database?.[section] || [];
  if (typeof matcher === "string") {
    return arr.find(x => x.code === matcher || x.name_en === matcher || x.name_zh === matcher || x.combo === matcher);
  }
  return arr.find(matcher);
}
export function getBit(database, code) { return findPart(database, "bits", code); }
export function getRatchet(database, code) { return findPart(database, "ratchets", code); }
export function getBlade(database, name) {
  return findPart(database, "bladesTop30", x => x.name_en === name || x.name_zh === name);
}
function hasAny(tags = [], wanted = []) { return wanted.some(w => tags.includes(w)); }
export function analyzeCombo(input, database) {
  const blade = input.blade ? getBlade(database, input.blade) : null;
  const ratchet = input.ratchet ? getRatchet(database, input.ratchet) : null;
  const bit = input.bit ? getBit(database, input.bit) : null;
  const scores = { attack:0, stamina:0, defense:0, balance:0, burstSafety:0, control:0, metaConfidence:0 };
  const advantages = [], risks = [], suggestions = [], notes = [];
  let role = "\u5f85\u5224\u65b7\u914d\u7f6e";

  if (blade) {
    notes.push(`${blade.name_zh || blade.name_en}\uff1a${blade.role}`);
    if (hasAny(blade.tags, ["meta_attack_core","classic_attack","heavy_attack","burst_attack","cx_one_hit_attack","low_height_attack"])) scores.attack += 3;
    if (hasAny(blade.tags, ["meta_stamina_core","stamina_baseline","low_height_stamina","stable_stamina","defense_stamina"])) scores.stamina += 3;
    if (hasAny(blade.tags, ["anti_attack","defense_counter","cx_defense","early_defense","thick_defense"])) scores.defense += 3;
    if (hasAny(blade.tags, ["balance_counter","attack_stamina_hybrid","defense_balance"])) scores.balance += 2;
    if ((blade.confidence || "").includes("\u9ad8")) scores.metaConfidence += 2;
  }
  if (ratchet) {
    notes.push(`${ratchet.code}\uff1a${ratchet.role}`);
    if (hasAny(ratchet.tags, ["low_height","low_height_attack"])) scores.burstSafety += 1;
    if (hasAny(ratchet.tags, ["attack","offset_contact"])) scores.attack += 1;
    if (hasAny(ratchet.tags, ["stamina","burst_safety"])) scores.stamina += 1;
    if (hasAny(ratchet.tags, ["balance","stable"])) scores.control += 1;
    if (hasAny(ratchet.tags, ["high_risk"])) risks.push(`${ratchet.code} \u5c6c\u65bc\u9ad8\u8eab\u4f4d\u6216\u7279\u5316\u56fa\u9396\uff0c\u9700\u6ce8\u610f\u88ab\u6253\u56fa\u9396\u98a8\u96aa\u3002`);
  }
  if (bit) {
    notes.push(`${bit.code} / ${bit.name_zh}\uff1a${bit.role}`);
    if (hasAny(bit.tags, ["attack","low_height_attack","one_hit","high_speed"])) scores.attack += 3;
    if (hasAny(bit.tags, ["stamina","left_spin","spin_equalize","endgame","low_height_stamina"])) scores.stamina += 3;
    if (hasAny(bit.tags, ["defense","anti_attack"])) scores.defense += 2;
    if (hasAny(bit.tags, ["balance","technical","attack_stamina","hybrid"])) scores.balance += 2;
    if (hasAny(bit.tags, ["controlled_attack","control_attack"])) scores.control += 1;
    if (["GF","A","V","I","J","Q","RA","UF"].includes(bit.code)) risks.push(`${bit.code} \u7206\u767c\u9ad8\uff0c\u4f46\u7e8c\u822a\u8207\u63a7\u5834\u98a8\u96aa\u504f\u9ad8\u3002`);
    if (["Op","Tr"].includes(bit.code)) notes.push(`${bit.code} \u662f\u56fa\u9396\u4e00\u9ad4\u5f0f\u8ef8\u5fc3\uff0c\u4e0d\u53ef\u7528\u4e00\u822c Ratchet + Bit \u908f\u8f2f\u5224\u65b7\u3002`);
  }

  const attackBlade = blade && hasAny(blade.tags, ["meta_attack_core","classic_attack","heavy_attack","burst_attack","low_height_attack","cx_one_hit_attack"]);
  const staminaBlade = blade && hasAny(blade.tags, ["meta_stamina_core","stamina_baseline","low_height_stamina","stable_stamina","defense_stamina"]);
  const defenseBlade = blade && hasAny(blade.tags, ["anti_attack","defense_counter","cx_defense","early_defense","thick_defense"]);

  if (attackBlade && bit && ["R","LR","F","LF","GR"].includes(bit.code)) {
    role = "\u53ef\u63a7\u653b\u64ca\u578b";
    advantages.push(`${blade.name_zh} \u504f\u653b\u64ca\uff0c\u642d\u914d ${bit.code} \u53ef\u4fdd\u7559\u4e3b\u52d5\u9032\u653b\u540c\u6642\u964d\u4f4e\u5931\u63a7\u3002`);
  }
  if (attackBlade && bit && ["I","GF","A","V","J"].includes(bit.code)) {
    role = "\u9ad8\u7206\u767c\u653b\u64ca / \u5947\u8972\u578b";
    advantages.push(`${blade.name_zh} \u642d\u914d ${bit.code} \u80fd\u63d0\u9ad8\u7b2c\u4e00\u6ce2\u885d\u64ca\u8207\u64ca\u98db\u6a5f\u6703\u3002`);
    risks.push(`\u82e5\u7b2c\u4e00\u6ce2\u6c92\u6709\u6253\u51fa\u6709\u6548\u63a5\u89f8\uff0c\u5f8c\u6bb5\u53ef\u80fd\u6703\u5931\u901f\u3002`);
  }
  if (staminaBlade && bit && ["B","O","DB","FB","LO"].includes(bit.code)) {
    role = "\u6301\u4e45 / \u672b\u6bb5\u578b";
    advantages.push(`${blade.name_zh} \u642d\u914d ${bit.code} \u662f\u6301\u4e45\u6216\u672b\u6bb5\u8def\u7dda\uff0c\u914d\u7f6e\u65b9\u5411\u660e\u78ba\u3002`);
  }
  if ((defenseBlade || staminaBlade) && bit && ["H","WB","FB"].includes(bit.code)) {
    role = "\u9632\u5b88\u53cd\u6253 / anti-attack";
    advantages.push(`${bit.code} \u80fd\u8b93 ${blade?.name_zh || ""} \u5f80\u6297\u653b\u64ca\u6216\u9632\u5b88\u6301\u4e45\u65b9\u5411\u767c\u5c55\u3002`);
  }
  if (blade && ["Cobalt Dragoon","Meteor Dragoon"].includes(blade.name_en) && bit?.code === "E") {
    role = "\u5de6\u8ff4\u65cb\u672b\u6bb5 / \u53cd\u65cb\u6838\u5fc3";
    advantages.push(`${blade.name_zh} \u662f\u5de6\u8ff4\u65cb\u6838\u5fc3\uff0c\u642d\u914d Elevate \u7684\u4e3b\u50f9\u503c\u5728\u53cd\u65cb\u672b\u6bb5\u3002`);
  }
  if (attackBlade && bit && ["B","O","DB","FB","LO"].includes(bit.code)) {
    role = "\u7279\u5316 / \u8def\u7dda\u53ef\u80fd\u62b5\u6d88";
    risks.push(`\u653b\u64ca\u4e0a\u84cb\u642d\u6301\u4e45\u8ef8\u5fc3\u53ef\u80fd\u964d\u4f4e\u4e3b\u52d5\u5f97\u5206\uff0c\u9700\u78ba\u8a8d\u662f\u5426\u523b\u610f\u505a\u53cd\u6253\u6216\u5947\u8972\u3002`);
  }
  if (ratchet && ["1-50","4-50","4-55"].includes(ratchet.code) && bit && hasAny(bit.tags, ["attack","one_hit","low_height_attack"])) {
    advantages.push(`${ratchet.code} \u80fd\u58d3\u4f4e\u91cd\u5fc3\u4e26\u964d\u4f4e\u88ab\u6253\u56fa\u9396\u98a8\u96aa\uff0c\u9069\u5408\u4f4e\u8eab\u4f4d\u653b\u64ca\u3002`);
    risks.push(`\u4f4e\u9ad8\u5ea6\u914d\u7f6e\u9700\u6ce8\u610f\u522e\u5730\u8207\u767c\u5c04\u89d2\u5ea6\u3002`);
  }

  if (advantages.length === 0) advantages.push("\u6b64\u914d\u7f6e\u53ef\u5148\u4f9d\u4e3b\u8981 Blade \u8207 Bit \u65b9\u5411\u5be6\u6e2c\uff0c\u518d\u5fae\u8abf\u56fa\u9396\u6216\u8ef8\u5fc3\u3002");
  if (risks.length === 0) risks.push(database.analysisRules.emptyResultText.risks);
  suggestions.push(database.analysisRules.emptyResultText.suggestions);
  const mainScore = Object.keys(scores).reduce((a,b)=>scores[a] >= scores[b] ? a : b);
  return { role, scores, mainScore, advantages, risks, suggestions, notes };
}
