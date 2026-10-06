'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {profiles,byId}=require('../src/camera-transforms.cjs');
const vec=(m,v)=>m.map(r=>r.reduce((s,x,i)=>s+x*v[i],0));
const near=(a,b,t=2e-6)=>a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<=t,`${i}: ${v} != ${b[i]}`));
// Independent AP0/XYZ reference matrices from ACES AP0 and published D60/D65
// chromatic adaptation constants. These do not use the implementation's matrix code.
const CAT02=[[1.0623661070458874,.008406953653800545,-.01665578963256834],[-.493941371628253,1.3711095252144125,.09031658697352177],[-.0003346685773764159,-.0010374582718291141,.9194696473222923]];
const BRADFORD=[[1.0634954914941996,.006408910197117952,-.01580678661760551],[-.4920741279238918,1.3682234074733286,.09133708831447362],[-.0028164616392534945,.004644171056800662,.9164185745936566]];
// Published OpenColorIO BuiltinTransform_tests.cpp camera fixtures: encoded
// [.5,.4,.3] -> ACES2065-1. They jointly verify curve, primaries, and white point.
const fixtures=[
 ['apple-log',[.153334766,.083515430,.032948254],BRADFORD],
 ['apple-log2',[.160302015,.091223177,.026405713],BRADFORD],
 ['arri-logc3-wide-gamut3',[.401621427766,.236455447604,.064830001192],CAT02],
 ['arri-logc4-wide-gamut4',[1.786878082249,.743018593362,.232840037656],CAT02],
 ['canon-clog2-cinema-gamut',[.408435767126,.197486903378,.034204558318],CAT02],
 ['canon-clog3-cinema-gamut',[.496034919950,.301015360499,.083691829261],CAT02],
 ['panasonic-vlog-vgamut',[.306918773245,.148128050597,.046334439047],BRADFORD],
 ['red-log3g10-redwidegamutrgb',[.887988237100,.416932247547,-.025442210717],BRADFORD],
 ['sony-slog3-sgamut3',[.342259707137,.172043362337,.057188031769],CAT02],
 ['sony-slog3-sgamut3cine',[.314942672433,.170408017753,.046854940520],CAT02],
 // Independently evaluated reviewed ASWF CLFs (not implementation outputs).
 ['blackmagic-film-gen5-wide-gamut',[.5148607607954617,.2639832175383797,.035539868373239476],CAT02],
 ['dji-dlog-dgamut',[.36518078341896193,.2095963735755749,.0521192439025173],CAT02],
 // Independently evaluated official Fujifilm CLF v1.10, 2026-04-16.
 ['fujifilm-flog2-fgamut',[.39669906803125954,.19977840493753832,.07286165973840554],CAT02],
 ['fujifilm-flog2c-fgamutc',[.4531911139712726,.1982373830834269,.0695473300853368],CAT02]
];
test('camera curves and matrices agree with published ASWF camera fixtures',()=>{for(const [id,ap0,m] of fixtures)near(vec(m,byId(id).decode([.5,.4,.3])),ap0);});
test('vendor reflection code-value landmarks for Fuji, Nikon and Blackmagic',()=>{
 const white=[.9504559270516716,1,1.0890577507598784],encode=(id,x)=>byId(id).encode(white.map(v=>v*x));
 for(const id of ['fujifilm-flog2-fgamut','fujifilm-flog2c-fgamutc'])for(const [x,code] of [[0,95],[.18,400],[.9,570]])near(encode(id,x).map(y=>y*1023),[code,code,code],.6);
 for(const [x,code] of [[0,95],[.18,470],[.9,705]])near(encode('fujifilm-flog-fgamut',x).map(y=>y*1023),[code,code,code],.6);
 // Nikon's published 10-bit formula values: decode x=650 -> exp(31/150).
 near(byId('nikon-nlog-bt2020').decode([650/1023,650/1023,650/1023]),white.map(v=>v*Math.exp(31/150)),1e-12);
 near(byId('blackmagic-film-gen5-wide-gamut').encode(white.map(v=>v*.18)),[.38356164383561653,.38356164383561653,.38356164383561653],1e-12);
});
test('Fuji gamut distinguishes FLog2C; verified BT2020 matrix landmark',()=>{
 const xyz=byId('nikon-nlog-bt2020').decode([byId('nikon-nlog-bt2020').encode([.6369580483012914,.2627002120112671,0])[0],byId('nikon-nlog-bt2020').encode([0,0,0])[1],byId('nikon-nlog-bt2020').encode([0,0,0])[2]]);
 near(xyz,[.6369580483012914,.2627002120112671,0],1e-12);
 assert.ok(Math.abs(byId('fujifilm-flog2c-fgamutc').decode([.5,.4,.3])[0]-byId('fujifilm-flog2-fgamut').decode([.5,.4,.3])[0])>.05);
});
test('all supported profiles round-trip encoded lattice samples and remain finite',()=>{
 assert.equal(profiles.length,16);assert.equal(new Set(profiles.map(p=>p.id)).size,16);
 for(const p of profiles)for(const rgb of [[0,0,0],[.1,.1,.1],[.5,.4,.3],[1,1,1],[.4,.8,.2]]){const xyz=p.decode(rgb),back=p.encode(xyz);assert.ok(xyz.every(Number.isFinite),p.id);near(back,rgb,p.id==='nikon-nlog-bt2020'?1e-6:1e-8);}
});
test('cross-profile conversion is finite throughout the nominal CUBE input domain',()=>{
 for(const target of profiles)for(const source of profiles)for(const rgb of [[0,0,0],[1,0,0],[0,1,0],[0,0,1],[1,1,1],[.5,.4,.3]])assert.ok(source.encode(target.decode(rgb)).every(Number.isFinite),`${target.id} -> ${source.id}`);
});
test('negative values are retained, except Apple documented zero-code floor',()=>{
 const white=[.9504559270516716,1,1.0890577507598784];
 for(const p of profiles){const linear=white.map(v=>v*-.001);near(p.decode(p.encode(linear)),linear,1e-10);}
 near(byId('apple-log2').encode(white.map(v=>v*-.1)),[0,0,0]);
});
test('unknown, nonfinite, incomplete colours and unsupported RAW/display profiles rejected',()=>{
 assert.equal(byId('dji-dlog-m'),undefined);assert.equal(byId('apple-log2-raw'),undefined);assert.equal(byId('rec2100-hlg'),undefined);
 for(const v of [null,[],[1,2],[NaN,0,0],[Infinity,0,0]])assert.throws(()=>byId('apple-log2').decode(v),/three finite/);
 assert.match(byId('arri-logc3-wide-gamut3').note,/EI 800 only/);assert.match(byId('dji-dlog-dgamut').note,/excludes D-Log M/);
});
