const { createHash } = require('node:crypto');
const PROFILES = ['unknown','rec709','hlg-bt2020',...require('./camera-transforms.cjs').profiles.map(p=>p.id)];
function profile(value) {
  if (!PROFILES.includes(value)) throw new Error('Choose a recording profile from the list.');
  return value;
}
function parseCube(bytes) {
  const text = Buffer.from(bytes).toString('utf8');
  let size, title = '', lo = [0,0,0], hi = [1,1,1], rows = 0;
  const seen = new Set();
  for (const source of text.split(/\r?\n/)) {
    const line = /^\s*TITLE\b/.test(source) ? source.trim() : source.replace(/#.*$/, '').trim();
    if (!line) continue;
    const parts = line.split(/\s+/), key = parts[0];
    if (/^(LUT_1D_SIZE|LUT_1D_INPUT_RANGE|LUT_3D_INPUT_RANGE)$/.test(key)) throw new Error('This version supports standalone 3D CUBE files with DOMAIN_MIN/MAX. 1D, shaper and combined LUTs are not supported.');
    if (['TITLE','LUT_3D_SIZE','DOMAIN_MIN','DOMAIN_MAX'].includes(key)) {
      if (seen.has(key) || rows) throw new Error('Duplicate or misplaced LUT header.');
      seen.add(key);
      if (key === 'TITLE') { const match=line.match(/^TITLE\s+(?:"([^"\r\n]*)"|([^"#\r\n]+?))(?:\s*#.*)?$/);if(!match)throw new Error('Invalid CUBE title.');title=(match[1]??match[2]).trim(); }
      if (key === 'LUT_3D_SIZE') { size = Number(parts[1]); if (parts.length !== 2 || !Number.isInteger(size) || size < 2 || size > 65) throw new Error('Supported 3D grid sizes are 2 through 65.'); }
      if (key.startsWith('DOMAIN')) {
        const values = parts.slice(1).map(Number);
        if (values.length !== 3 || !values.every(Number.isFinite)) throw new Error('Invalid LUT domain.');
        if (key === 'DOMAIN_MIN') lo = values; else hi = values;
      }
    } else {
      if (!size || parts.length !== 3 || !parts.map(Number).every(Number.isFinite)) throw new Error('Invalid CUBE data or unsupported header.');
      rows++;
    }
  }
  if (!size || rows !== size ** 3) throw new Error(`LUT row count does not match its ${size || 'missing'}-point grid.`);
  if (hi.some((value,i) => value <= lo[i])) throw new Error('LUT domain maximum must exceed minimum on every channel.');
  return {size, title, lo, hi, sha256:createHash('sha256').update(bytes).digest('hex')};
}
function compatible(sceneProfile, lut) {
  const legacy=lut.legacy|| (typeof lut.details==='string'&&JSON.parse(lut.details).legacy);
  if(legacy&&sceneProfile==='sony-slog3-sgamut3cine'&&lut.input==='unknown'&&lut.output==='unknown')return {ok:true,reason:'Original Sony viewer library; individual LUT profile labels remain [Unverified].'};
  if (sceneProfile === 'unknown' || lut.input === 'unknown' || lut.output === 'unknown') return {ok:false, reason:'[Unverified] Confirm the clip profile and both LUT profiles before applying this look.'};
  if (sceneProfile !== lut.input) return {ok:false, reason:'This LUT expects a different recording profile. Choose a matching LUT.'};
  if (lut.output !== 'rec709') return {ok:false, reason:'This first build displays LUTs with Rec.709 output only.'};
  return {ok:true, reason:'Direct LUT · profiles supplied by you; reference colour accuracy is still [Unverified].'};
}
module.exports = {parseCube, profile, PROFILES, compatible};
