'use strict';
// Camera encoding equations from published camera documentation and ASWF
// OpenColorIO. XYZ is scene-linear, D65, Y=1 for a neutral linear RGB of 1.
// No display rendering, sensor calibration, or RAW processing occurs here.
const WHITE=[.9504559270516716,1,1.0890577507598784];
const vec=(m,v)=>m.map(r=>r.reduce((s,x,i)=>s+x*v[i],0));
const multiply=(a,b)=>a.map(r=>b[0].map((_,j)=>r.reduce((s,x,i)=>s+x*b[i][j],0)));
function inverse(m){const a=m.map((r,i)=>[...r,...[0,1,2].map(j=>+(i===j))]);for(let i=0;i<3;i++){let p=i;for(let j=i+1;j<3;j++)if(Math.abs(a[j][i])>Math.abs(a[p][i]))p=j;[a[i],a[p]]=[a[p],a[i]];const d=a[i][i];if(Math.abs(d)<1e-15)throw Error('Singular colour matrix');a[i]=a[i].map(x=>x/d);for(let j=0;j<3;j++)if(j!==i){const k=a[j][i];a[j]=a[j].map((x,n)=>x-k*a[i][n]);}}return a.map(r=>r.slice(3));}
function rgbXYZ(p){const m=[0,1,2].map(i=>p.map(([x,y])=>[x/y,1,(1-x-y)/y][i])),s=vec(inverse(m),WHITE);return m.map(r=>r.map((x,i)=>x*s[i]));}
function check(v){if(!Array.isArray(v)||v.length!==3||v.some(x=>!Number.isFinite(x)))throw Error('A colour must have three finite values.');return v;}
const sourceCurves=require('../ui/source-curves.js');
// ACES AP0 D60 -> XYZ D65 with CAT02, as used by the reviewed ASWF CLFs.
// This also preserves the Blackmagic Gen5 matrix's published white-point handling.
const AP0_XYZ_D65=[[.9386309487502731,-.005741920550374038,.017566898851772334],[.33809359492202157,.7272139028114358,-.06530749773345718],[.0007231215113411635,.0008184418492447288,1.0875161873992927]];
const BMD_XYZ=multiply(AP0_XYZ_D65,[[.647091325580708,.242595385134207,.110313289285085],[.0651915997328519,1.02504756760476,-.0902391673376125],[-.0275570729194699,-.0805887097177784,1.10814578263725]]);
const DJI_XYZ=multiply(AP0_XYZ_D65,[[.691279245585754,.214382527745956,.0943382266682902],[.0662224037667752,1.0116160801876,-.0778384839543733],[-.0172985410341745,-.0773788501012682,1.09467739113544]]);
const BT2020=[[.708,.292],[.17,.797],[.131,.046]],CGAMUT=[[.74,.27],[.17,1.14],[.08,-.1]];
function make(id,label,shortLabel,p,note='',matrix){const curve=sourceCurves.forProfile(id),m=matrix||rgbXYZ(p),inv=inverse(m);return Object.freeze({id,label,shortLabel,note,decode:rgb=>vec(m,check(rgb).map(curve.decode)),encode:xyz=>vec(inv,check(xyz)).map(curve.encode)});}
const profiles=Object.freeze([
 make('sony-slog3-sgamut3cine','Sony · S-Log3 / S-Gamut3.Cine','S-Log3 / S-Gamut3.Cine',[[.766,.275],[.225,.8],[.089,-.087]]),
 make('sony-slog3-sgamut3','Sony · S-Log3 / S-Gamut3','S-Log3 / S-Gamut3',[[.73,.28],[.14,.855],[.1,-.05]]),
 make('apple-log','Apple · Apple Log / BT.2020','Apple Log',BT2020,'Standard video; excludes RAW.'),
 make('apple-log2','Apple · Apple Log 2 / Apple Wide Gamut','Apple Log 2',[[.725,.301],[.221,.814],[.068,-.076]],'Standard video; excludes RAW.'),
 make('canon-clog2-cinema-gamut','Canon · C-Log2 / Cinema Gamut','C-Log2 / Cinema Gamut',CGAMUT),
 make('canon-clog3-cinema-gamut','Canon · C-Log3 / Cinema Gamut','C-Log3 / Cinema Gamut',CGAMUT),
 make('panasonic-vlog-vgamut','Panasonic · V-Log / V-Gamut','V-Log / V-Gamut',[[.73,.28],[.165,.84],[.1,-.03]]),
 make('arri-logc3-wide-gamut3','ARRI · LogC3 / Wide Gamut 3 (EI 800)','LogC3 / AWG3 (EI 800)',[[.684,.313],[.221,.848],[.0861,-.102]],'EI 800 only; do not substitute for other LogC3 exposure-index encodings.'),
 make('arri-logc4-wide-gamut4','ARRI · LogC4 / Wide Gamut 4','LogC4 / AWG4',[[.7347,.2653],[.1424,.8576],[.0991,-.0308]]),
 make('red-log3g10-redwidegamutrgb','RED · Log3G10 / REDWideGamutRGB','Log3G10 / RWG',[[.780308,.304253],[.121595,1.493994],[.095612,-.084589]]),
 make('blackmagic-film-gen5-wide-gamut','Blackmagic · Film Gen 5 / Wide Gamut Gen 5','Film Gen 5 / Wide Gamut',null,'Gen 5 only; older Blackmagic camera-specific Film encodings are different.',BMD_XYZ),
 make('dji-dlog-dgamut','DJI · D-Log / D-Gamut (2017)','D-Log / D-Gamut',null,'ASWF 2017 D-Log encoding; excludes D-Log M and EI-specific Zenmuse X9 curves.',DJI_XYZ),
 make('fujifilm-flog-fgamut','Fujifilm · F-Log / F-Gamut','F-Log / F-Gamut',BT2020),
 make('fujifilm-flog2-fgamut','Fujifilm · F-Log2 / F-Gamut','F-Log2 / F-Gamut',BT2020),
 make('fujifilm-flog2c-fgamutc','Fujifilm · F-Log2 C / F-Gamut C','F-Log2 C / F-Gamut C',[[.7347,.2653],[.0263,.9737],[.1173,-.0224]]),
 make('nikon-nlog-bt2020','Nikon · N-Log / BT.2020','N-Log / BT.2020',BT2020)
]);
const lookup=new Map(profiles.map(p=>[p.id,p]));
const byId=id=>lookup.get(id);
module.exports={profiles,byId};
