"use strict";(()=>{var En=Symbol.for("@supabase/supabase-js.traceContextExtractor");function Ni(){return globalThis[En]}function be(i,e){var t={};for(var r in i)Object.prototype.hasOwnProperty.call(i,r)&&e.indexOf(r)<0&&(t[r]=i[r]);if(i!=null&&typeof Object.getOwnPropertySymbols=="function")for(var n=0,r=Object.getOwnPropertySymbols(i);n<r.length;n++)e.indexOf(r[n])<0&&Object.prototype.propertyIsEnumerable.call(i,r[n])&&(t[r[n]]=i[r[n]]);return t}function Hi(i,e,t,r){function n(s){return s instanceof t?s:new t(function(a){a(s)})}return new(t||(t=Promise))(function(s,a){function o(h){try{l(r.next(h))}catch(d){a(d)}}function c(h){try{l(r.throw(h))}catch(d){a(d)}}function l(h){h.done?s(h.value):n(h.value).then(o,c)}l((r=r.apply(i,e||[])).next())})}var Ui=i=>i?(...e)=>i(...e):(...e)=>fetch(...e);var Ce=class extends Error{constructor(e,t="FunctionsError",r){super(e),this.name=t,this.context=r}toJSON(){return{name:this.name,message:this.message,context:this.context}}},Ve=class extends Ce{constructor(e){super("Failed to send a request to the Edge Function","FunctionsFetchError",e)}},Re=class extends Ce{constructor(e){super("Relay Error invoking the Edge Function","FunctionsRelayError",e)}},Pe=class extends Ce{constructor(e){super("Edge Function returned a non-2xx status code","FunctionsHttpError",e)}},Ke;(function(i){i.Any="any",i.ApNortheast1="ap-northeast-1",i.ApNortheast2="ap-northeast-2",i.ApSouth1="ap-south-1",i.ApSoutheast1="ap-southeast-1",i.ApSoutheast2="ap-southeast-2",i.CaCentral1="ca-central-1",i.EuCentral1="eu-central-1",i.EuWest1="eu-west-1",i.EuWest2="eu-west-2",i.EuWest3="eu-west-3",i.SaEast1="sa-east-1",i.UsEast1="us-east-1",i.UsWest1="us-west-1",i.UsWest2="us-west-2"})(Ke||(Ke={}));var Ge=class{constructor(e,{headers:t={},customFetch:r,region:n=Ke.Any}={}){this.url=e,this.headers=t,this.region=n,this.fetch=Ui(r)}setAuth(e){this.headers.Authorization=`Bearer ${e}`}invoke(e){return Hi(this,arguments,void 0,function*(t,r={}){var n,s;let a,o,c;try{let{headers:l,method:h,body:d,signal:f,timeout:u}=r,p={},{region:m}=r;m||(m=this.region);let y=new URL(`${this.url}/${t}`);m&&m!=="any"&&(p["x-region"]=m,y.searchParams.set("forceFunctionRegion",m));let g,v=!!l&&Object.keys(l).some(Q=>Q.toLowerCase()==="content-type");d&&!v?typeof Blob<"u"&&d instanceof Blob||d instanceof ArrayBuffer?(p["Content-Type"]="application/octet-stream",g=d):typeof d=="string"?(p["Content-Type"]="text/plain",g=d):typeof FormData<"u"&&d instanceof FormData?g=d:(p["Content-Type"]="application/json",g=JSON.stringify(d)):d&&typeof d!="string"&&!(typeof Blob<"u"&&d instanceof Blob)&&!(d instanceof ArrayBuffer)&&!(typeof FormData<"u"&&d instanceof FormData)?g=JSON.stringify(d):g=d;let w=f;u&&(o=new AbortController,a=setTimeout(()=>o.abort(),u),f?(w=o.signal,c=()=>o.abort(),f.addEventListener("abort",c)):w=o.signal);let T=yield this.fetch(y.toString(),{method:h||"POST",headers:Object.assign(Object.assign(Object.assign({},p),this.headers),l),body:g,signal:w}).catch(Q=>{throw new Ve(Q)}),L=T.headers.get("x-relay-error");if(L&&L==="true")throw new Re(T);if(!T.ok)throw new Pe(T);let I=((n=T.headers.get("Content-Type"))!==null&&n!==void 0?n:"text/plain").split(";")[0].trim().toLowerCase(),P;return I==="application/json"?P=yield T.json():I==="application/octet-stream"||I==="application/pdf"?P=yield T.blob():I==="text/event-stream"?P=T:I==="multipart/form-data"?P=yield T.formData():P=yield T.text(),{data:P,error:null,response:T}}catch(l){return{data:null,error:l,response:l instanceof Pe||l instanceof Re?l.context:void 0}}finally{a&&clearTimeout(a),c&&((s=r.signal)===null||s===void 0||s.removeEventListener("abort",c))}})}};var Di=i=>Math.min(1e3*2**i,3e4),Tn=[520,503],Wi=["GET","HEAD","OPTIONS"],Et=class extends Error{constructor(i){super(i.message),this.name="PostgrestError",this.details=i.details,this.hint=i.hint,this.code=i.code}toJSON(){return{name:this.name,message:this.message,details:this.details,hint:this.hint,code:this.code}}};function Je(i){"@babel/helpers - typeof";return Je=typeof Symbol=="function"&&typeof Symbol.iterator=="symbol"?function(e){return typeof e}:function(e){return e&&typeof Symbol=="function"&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e},Je(i)}function Sn(i,e){if(Je(i)!="object"||!i)return i;var t=i[Symbol.toPrimitive];if(t!==void 0){var r=t.call(i,e||"default");if(Je(r)!="object")return r;throw new TypeError("@@toPrimitive must return a primitive value.")}return(e==="string"?String:Number)(i)}function An(i){var e=Sn(i,"string");return Je(e)=="symbol"?e:e+""}function In(i,e,t){return(e=An(e))in i?Object.defineProperty(i,e,{value:t,enumerable:!0,configurable:!0,writable:!0}):i[e]=t,i}function zi(i,e){var t=Object.keys(i);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(i);e&&(r=r.filter(function(n){return Object.getOwnPropertyDescriptor(i,n).enumerable})),t.push.apply(t,r)}return t}function Oe(i){for(var e=1;e<arguments.length;e++){var t=arguments[e]!=null?arguments[e]:{};e%2?zi(Object(t),!0).forEach(function(r){In(i,r,t[r])}):Object.getOwnPropertyDescriptors?Object.defineProperties(i,Object.getOwnPropertyDescriptors(t)):zi(Object(t)).forEach(function(r){Object.defineProperty(i,r,Object.getOwnPropertyDescriptor(t,r))})}return i}function qi(i,e){return new Promise(t=>{if(e?.aborted){t();return}let r=setTimeout(()=>{e?.removeEventListener("abort",n),t()},i);function n(){clearTimeout(r),t()}e?.addEventListener("abort",n)})}function Cn(i,e,t,r){return!(!r||t>=3||!Wi.includes(i)||!Tn.includes(e))}var Rn=class{constructor(i){var e,t,r,n,s;this.shouldThrowOnError=!1,this.retryEnabled=!0,this.method=i.method,this.url=i.url,this.headers=new Headers(i.headers),this.schema=i.schema,this.body=i.body,this.shouldThrowOnError=(e=i.shouldThrowOnError)!==null&&e!==void 0?e:!1,this.signal=i.signal,this.isMaybeSingle=(t=i.isMaybeSingle)!==null&&t!==void 0?t:!1,this.shouldStripNulls=(r=i.shouldStripNulls)!==null&&r!==void 0?r:!1,this.urlLengthLimit=(n=i.urlLengthLimit)!==null&&n!==void 0?n:8e3,this.retryEnabled=(s=i.retry)!==null&&s!==void 0?s:!0,i.fetch?this.fetch=i.fetch:this.fetch=fetch}throwOnError(){return this.shouldThrowOnError=!0,this}stripNulls(){if(this.headers.get("Accept")==="text/csv")throw new Error("stripNulls() cannot be used with csv()");return this.shouldStripNulls=!0,this}setHeader(i,e){return this.headers=new Headers(this.headers),this.headers.set(i,e),this}retry(i){return this.retryEnabled=i,this}then(i,e){var t=this;if(this.schema===void 0||(["GET","HEAD"].includes(this.method)?this.headers.set("Accept-Profile",this.schema):this.headers.set("Content-Profile",this.schema)),this.method!=="GET"&&this.method!=="HEAD"&&this.headers.set("Content-Type","application/json"),this.shouldStripNulls){let a=this.headers.get("Accept");a==="application/vnd.pgrst.object+json"?this.headers.set("Accept","application/vnd.pgrst.object+json;nulls=stripped"):(!a||a==="application/json")&&this.headers.set("Accept","application/vnd.pgrst.array+json;nulls=stripped")}let r=this.fetch,s=(async()=>{let a=0;for(;;){let l={};t.headers.forEach((d,f)=>{l[f]=d}),a>0&&(l["X-Retry-Count"]=String(a));let h;try{h=await r(t.url.toString(),{method:t.method,headers:l,body:JSON.stringify(t.body,(d,f)=>typeof f=="bigint"?f.toString():f),signal:t.signal})}catch(d){if(d?.name==="AbortError"||d?.code==="ABORT_ERR"||!Wi.includes(t.method))throw d;if(t.retryEnabled&&a<3){let f=Di(a);a++,await qi(f,t.signal);continue}throw d}if(Cn(t.method,h.status,a,t.retryEnabled)){var o,c;let d=(o=(c=h.headers)===null||c===void 0?void 0:c.get("Retry-After"))!==null&&o!==void 0?o:null,f=d!==null?Math.max(0,parseInt(d,10)||0)*1e3:Di(a);await h.text(),a++,await qi(f,t.signal);continue}return await t.processResponse(h)}})();return this.shouldThrowOnError||(s=s.catch(a=>{var o;let c="",l="",h="",d=a?.cause;if(d){var f,u,p,m;let v=(f=d?.message)!==null&&f!==void 0?f:"",w=(u=d?.code)!==null&&u!==void 0?u:"";c=`${(p=a?.name)!==null&&p!==void 0?p:"FetchError"}: ${a?.message}`,c+=`

Caused by: ${(m=d?.name)!==null&&m!==void 0?m:"Error"}: ${v}`,w&&(c+=` (${w})`),d?.stack&&(c+=`
${d.stack}`)}else{var y;c=(y=a?.stack)!==null&&y!==void 0?y:""}let g=this.url.toString().length;return a?.name==="AbortError"||a?.code==="ABORT_ERR"?(h="",l="Request was aborted (timeout or manual cancellation)",g>this.urlLengthLimit&&(l+=`. Note: Your request URL is ${g} characters, which may exceed server limits. If selecting many fields, consider using views. If filtering with large arrays (e.g., .in('id', [many IDs])), consider using an RPC function to pass values server-side.`)):(d?.name==="HeadersOverflowError"||d?.code==="UND_ERR_HEADERS_OVERFLOW")&&(h="",l="HTTP headers exceeded server limits (typically 16KB)",g>this.urlLengthLimit&&(l+=`. Your request URL is ${g} characters. If selecting many fields, consider using views. If filtering with large arrays (e.g., .in('id', [200+ IDs])), consider using an RPC function instead.`)),{success:!1,error:{message:`${(o=a?.name)!==null&&o!==void 0?o:"FetchError"}: ${a?.message}`,details:c,hint:l,code:h},data:null,count:null,status:0,statusText:""}})),s.then(i,e)}async processResponse(i){var e=this;let t=null,r=null,n=null,s=i.status,a=i.statusText;if(i.ok){var o,c;if(e.method!=="HEAD"){var l;let u=await i.text();if(u!=="")if(e.headers.get("Accept")==="text/csv")r=u;else if(e.headers.get("Accept")&&(!((l=e.headers.get("Accept"))===null||l===void 0)&&l.includes("application/vnd.pgrst.plan+text")))r=u;else try{r=JSON.parse(u)}catch{if(t={message:u},r=null,e.shouldThrowOnError)throw new Et({message:u,details:"",hint:"",code:""})}}let d=(o=e.headers.get("Prefer"))===null||o===void 0?void 0:o.match(/count=(exact|planned|estimated)/),f=(c=i.headers.get("content-range"))===null||c===void 0?void 0:c.split("/");if(d&&f&&f.length>1&&(n=parseInt(f[1])),e.isMaybeSingle&&Array.isArray(r))if(r.length>1){if(t={code:"PGRST116",details:`Results contain ${r.length} rows, application/vnd.pgrst.object+json requires 1 row`,hint:null,message:"JSON object requested, multiple (or no) rows returned"},r=null,n=null,s=406,a="Not Acceptable",e.shouldThrowOnError){var h;throw new Et(Oe(Oe({},t),{},{hint:(h=t.hint)!==null&&h!==void 0?h:""}))}}else r.length===1?r=r[0]:r=null}else{let d=await i.text();try{t=JSON.parse(d),Array.isArray(t)&&i.status===404&&(r=[],t=null,s=200,a="OK")}catch{i.status===404&&d===""?(s=204,a="No Content"):t={message:d}}if(t&&e.shouldThrowOnError)throw new Et(t)}return{success:t===null,error:t,data:r,count:n,status:s,statusText:a}}returns(){return this}overrideTypes(){return this}},Pn=class extends Rn{throwOnError(){return super.throwOnError()}select(i){let e=!1,t=(i??"*").split("").map(r=>/\s/.test(r)&&!e?"":(r==='"'&&(e=!e),r)).join("");return this.url.searchParams.set("select",t),this.headers.append("Prefer","return=representation"),this}order(i,{ascending:e=!0,nullsFirst:t,foreignTable:r,referencedTable:n=r}={}){let s=n?`${n}.order`:"order",a=this.url.searchParams.get(s);return this.url.searchParams.set(s,`${a?`${a},`:""}${i}.${e?"asc":"desc"}${t===void 0?"":t?".nullsfirst":".nullslast"}`),this}limit(i,{foreignTable:e,referencedTable:t=e}={}){let r=typeof t>"u"?"limit":`${t}.limit`;return this.url.searchParams.set(r,`${i}`),this}range(i,e,{foreignTable:t,referencedTable:r=t}={}){let n=typeof r>"u"?"offset":`${r}.offset`,s=typeof r>"u"?"limit":`${r}.limit`;return this.url.searchParams.set(n,`${i}`),this.url.searchParams.set(s,`${e-i+1}`),this}abortSignal(i){return this.signal=i,this}single(){return this.headers.set("Accept","application/vnd.pgrst.object+json"),this}maybeSingle(){return this.isMaybeSingle=!0,this}csv(){return this.headers.set("Accept","text/csv"),this}geojson(){return this.headers.set("Accept","application/geo+json"),this}explain({analyze:i=!1,verbose:e=!1,settings:t=!1,buffers:r=!1,wal:n=!1,format:s="text"}={}){var a;let o=[i?"analyze":null,e?"verbose":null,t?"settings":null,r?"buffers":null,n?"wal":null].filter(Boolean).join("|"),c=(a=this.headers.get("Accept"))!==null&&a!==void 0?a:"application/json";return this.headers.set("Accept",`application/vnd.pgrst.plan+${s}; for="${c}"; options=${o};`),s==="json"?this:this}rollback(){return this.headers.append("Prefer","tx=rollback"),this}returns(){return this}maxAffected(i){return this.headers.append("Prefer","handling=strict"),this.headers.append("Prefer",`max-affected=${i}`),this}},Fi=new RegExp("[,()]"),Le=class extends Pn{throwOnError(){return super.throwOnError()}eq(i,e){return this.url.searchParams.append(i,`eq.${e}`),this}neq(i,e){return this.url.searchParams.append(i,`neq.${e}`),this}gt(i,e){return this.url.searchParams.append(i,`gt.${e}`),this}gte(i,e){return this.url.searchParams.append(i,`gte.${e}`),this}lt(i,e){return this.url.searchParams.append(i,`lt.${e}`),this}lte(i,e){return this.url.searchParams.append(i,`lte.${e}`),this}like(i,e){return this.url.searchParams.append(i,`like.${e}`),this}likeAllOf(i,e){return this.url.searchParams.append(i,`like(all).{${e.join(",")}}`),this}likeAnyOf(i,e){return this.url.searchParams.append(i,`like(any).{${e.join(",")}}`),this}ilike(i,e){return this.url.searchParams.append(i,`ilike.${e}`),this}ilikeAllOf(i,e){return this.url.searchParams.append(i,`ilike(all).{${e.join(",")}}`),this}ilikeAnyOf(i,e){return this.url.searchParams.append(i,`ilike(any).{${e.join(",")}}`),this}regexMatch(i,e){return this.url.searchParams.append(i,`match.${e}`),this}regexIMatch(i,e){return this.url.searchParams.append(i,`imatch.${e}`),this}is(i,e){return this.url.searchParams.append(i,`is.${e}`),this}isDistinct(i,e){return this.url.searchParams.append(i,`isdistinct.${e}`),this}in(i,e){let t=Array.from(new Set(e)).map(r=>typeof r=="string"&&Fi.test(r)?`"${r}"`:`${r}`).join(",");return this.url.searchParams.append(i,`in.(${t})`),this}notIn(i,e){let t=Array.from(new Set(e)).map(r=>typeof r=="string"&&Fi.test(r)?`"${r}"`:`${r}`).join(",");return this.url.searchParams.append(i,`not.in.(${t})`),this}contains(i,e){return typeof e=="string"?this.url.searchParams.append(i,`cs.${e}`):Array.isArray(e)?this.url.searchParams.append(i,`cs.{${e.join(",")}}`):this.url.searchParams.append(i,`cs.${JSON.stringify(e)}`),this}containedBy(i,e){return typeof e=="string"?this.url.searchParams.append(i,`cd.${e}`):Array.isArray(e)?this.url.searchParams.append(i,`cd.{${e.join(",")}}`):this.url.searchParams.append(i,`cd.${JSON.stringify(e)}`),this}rangeGt(i,e){return this.url.searchParams.append(i,`sr.${e}`),this}rangeGte(i,e){return this.url.searchParams.append(i,`nxl.${e}`),this}rangeLt(i,e){return this.url.searchParams.append(i,`sl.${e}`),this}rangeLte(i,e){return this.url.searchParams.append(i,`nxr.${e}`),this}rangeAdjacent(i,e){return this.url.searchParams.append(i,`adj.${e}`),this}overlaps(i,e){return typeof e=="string"?this.url.searchParams.append(i,`ov.${e}`):this.url.searchParams.append(i,`ov.{${e.join(",")}}`),this}textSearch(i,e,{config:t,type:r}={}){let n="";r==="plain"?n="pl":r==="phrase"?n="ph":r==="websearch"&&(n="w");let s=t===void 0?"":`(${t})`;return this.url.searchParams.append(i,`${n}fts${s}.${e}`),this}match(i){return Object.entries(i).filter(([e,t])=>t!==void 0).forEach(([e,t])=>{this.url.searchParams.append(e,`eq.${t}`)}),this}not(i,e,t){return this.url.searchParams.append(i,`not.${e}.${t}`),this}or(i,{foreignTable:e,referencedTable:t=e}={}){let r=t?`${t}.or`:"or";return this.url.searchParams.append(r,`(${i})`),this}filter(i,e,t){return this.url.searchParams.append(i,`${e}.${t}`),this}},Ln=class{constructor(i,{headers:e={},schema:t,fetch:r,urlLengthLimit:n=8e3,retry:s}){this.url=i,this.headers=new Headers(e),this.schema=t,this.fetch=r,this.urlLengthLimit=n,this.retry=s}cloneRequestState(){return{url:new URL(this.url.toString()),headers:new Headers(this.headers)}}select(i,e){let{head:t=!1,count:r}=e??{},n=t?"HEAD":"GET",s=!1,a=(i??"*").split("").map(l=>/\s/.test(l)&&!s?"":(l==='"'&&(s=!s),l)).join(""),{url:o,headers:c}=this.cloneRequestState();return o.searchParams.set("select",a),r&&c.append("Prefer",`count=${r}`),new Le({method:n,url:o,headers:c,schema:this.schema,fetch:this.fetch,urlLengthLimit:this.urlLengthLimit,retry:this.retry})}insert(i,{count:e,defaultToNull:t=!0}={}){var r;let n="POST",{url:s,headers:a}=this.cloneRequestState();if(e&&a.append("Prefer",`count=${e}`),t||a.append("Prefer","missing=default"),Array.isArray(i)){let o=i.reduce((c,l)=>c.concat(Object.keys(l)),[]);if(o.length>0){let c=[...new Set(o)].map(l=>`"${l}"`);s.searchParams.set("columns",c.join(","))}}return new Le({method:n,url:s,headers:a,schema:this.schema,body:i,fetch:(r=this.fetch)!==null&&r!==void 0?r:fetch,urlLengthLimit:this.urlLengthLimit,retry:this.retry})}upsert(i,{onConflict:e,ignoreDuplicates:t=!1,count:r,defaultToNull:n=!0}={}){var s;let a="POST",{url:o,headers:c}=this.cloneRequestState();if(c.append("Prefer",`resolution=${t?"ignore":"merge"}-duplicates`),e!==void 0&&o.searchParams.set("on_conflict",e),r&&c.append("Prefer",`count=${r}`),n||c.append("Prefer","missing=default"),Array.isArray(i)){let l=i.reduce((h,d)=>h.concat(Object.keys(d)),[]);if(l.length>0){let h=[...new Set(l)].map(d=>`"${d}"`);o.searchParams.set("columns",h.join(","))}}return new Le({method:a,url:o,headers:c,schema:this.schema,body:i,fetch:(s=this.fetch)!==null&&s!==void 0?s:fetch,urlLengthLimit:this.urlLengthLimit,retry:this.retry})}update(i,{count:e}={}){var t;let r="PATCH",{url:n,headers:s}=this.cloneRequestState();return e&&s.append("Prefer",`count=${e}`),new Le({method:r,url:n,headers:s,schema:this.schema,body:i,fetch:(t=this.fetch)!==null&&t!==void 0?t:fetch,urlLengthLimit:this.urlLengthLimit,retry:this.retry})}delete({count:i}={}){var e;let t="DELETE",{url:r,headers:n}=this.cloneRequestState();return i&&n.append("Prefer",`count=${i}`),new Le({method:t,url:r,headers:n,schema:this.schema,fetch:(e=this.fetch)!==null&&e!==void 0?e:fetch,urlLengthLimit:this.urlLengthLimit,retry:this.retry})}},Vi=class Ki{constructor(e,{headers:t={},schema:r,fetch:n,timeout:s,urlLengthLimit:a=8e3,retry:o}={}){this.url=e,this.headers=new Headers(t),this.schemaName=r,this.urlLengthLimit=a;let c=n??globalThis.fetch;s!==void 0&&s>0?this.fetch=(l,h)=>{let d=new AbortController,f=setTimeout(()=>d.abort(),s),u=h?.signal;if(u){if(u.aborted)return clearTimeout(f),c(l,h);let p=()=>{clearTimeout(f),d.abort()};return u.addEventListener("abort",p,{once:!0}),c(l,Oe(Oe({},h),{},{signal:d.signal})).finally(()=>{clearTimeout(f),u.removeEventListener("abort",p)})}return c(l,Oe(Oe({},h),{},{signal:d.signal})).finally(()=>clearTimeout(f))}:this.fetch=c,this.retry=o}from(e){if(!e||typeof e!="string"||e.trim()==="")throw new Error("Invalid relation name: relation must be a non-empty string.");return new Ln(new URL(`${this.url}/${e}`),{headers:new Headers(this.headers),schema:this.schemaName,fetch:this.fetch,urlLengthLimit:this.urlLengthLimit,retry:this.retry})}schema(e){return new Ki(this.url,{headers:this.headers,schema:e,fetch:this.fetch,urlLengthLimit:this.urlLengthLimit,retry:this.retry})}rpc(e,t={},{head:r=!1,get:n=!1,count:s}={}){var a;let o,c=new URL(`${this.url}/rpc/${e}`),l,h=u=>u!==null&&typeof u=="object"&&(!Array.isArray(u)||u.some(h)),d=r&&Object.values(t).some(h);d?(o="POST",l=t):r||n?(o=r?"HEAD":"GET",Object.entries(t).filter(([u,p])=>p!==void 0).map(([u,p])=>[u,Array.isArray(p)?`{${p.join(",")}}`:`${p}`]).forEach(([u,p])=>{c.searchParams.append(u,p)})):(o="POST",l=t);let f=new Headers(this.headers);return d?f.set("Prefer",s?`count=${s},return=minimal`:"return=minimal"):s&&f.set("Prefer",`count=${s}`),new Le({method:o,url:c,headers:f,schema:this.schemaName,body:l,fetch:(a=this.fetch)!==null&&a!==void 0?a:fetch,urlLengthLimit:this.urlLengthLimit,retry:this.retry})}};var ei=class{constructor(){}static detectEnvironment(){var e;if(typeof WebSocket<"u")return{type:"native",wsConstructor:WebSocket};let t=globalThis;if(typeof globalThis<"u"&&typeof t.WebSocket<"u")return{type:"native",wsConstructor:t.WebSocket};let r=typeof global<"u"?global:void 0;if(r&&typeof r.WebSocket<"u")return{type:"native",wsConstructor:r.WebSocket};if(typeof globalThis<"u"&&typeof t.WebSocketPair<"u"&&typeof globalThis.WebSocket>"u")return{type:"cloudflare",error:"Cloudflare Workers detected. WebSocket clients are not supported in Cloudflare Workers.",workaround:"Use Cloudflare Workers WebSocket API for server-side WebSocket handling, or deploy to a different runtime."};if(typeof globalThis<"u"&&t.EdgeRuntime||typeof navigator<"u"&&(!((e=navigator.userAgent)===null||e===void 0)&&e.includes("Vercel-Edge")))return{type:"unsupported",error:"Edge runtime detected (Vercel Edge/Netlify Edge). WebSockets are not supported in edge functions.",workaround:"Use serverless functions or a different deployment target for WebSocket functionality."};let n=globalThis.process;if(n){let s=n.versions;if(s&&s.node)return{type:"unsupported",error:"Node.js detected but native WebSocket not found.",workaround:"Ensure you are running Node.js 22+ or provide a WebSocket implementation via the transport option."}}return{type:"unsupported",error:"Unknown JavaScript runtime without WebSocket support.",workaround:"Ensure you're running in a supported environment (browser, Node.js, Deno) or provide a custom WebSocket implementation."}}static getWebSocketConstructor(){let e=this.detectEnvironment();if(e.wsConstructor)return e.wsConstructor;let t=e.error||"WebSocket not supported in this environment.";throw e.workaround&&(t+=`

Suggested solution: ${e.workaround}`),new Error(t)}static isWebSocketSupported(){try{return this.detectEnvironment().type==="native"}catch{return!1}}},ti=ei;var Gi="2.112.4";var Ji=`realtime-js/${Gi}`,Yi="1.0.0",ii="2.0.0",Qi=ii;var Zi=1e4;var Xi=100;var re={closed:"closed",errored:"errored",joined:"joined",joining:"joining",leaving:"leaving"},Tt={close:"phx_close",error:"phx_error",join:"phx_join",reply:"phx_reply",leave:"phx_leave",access_token:"access_token"};var Ye={connecting:"connecting",open:"open",closing:"closing",closed:"closed"};var Qe=class{constructor(e){this.HEADER_LENGTH=1,this.USER_BROADCAST_PUSH_META_LENGTH=6,this.KINDS={userBroadcastPush:3,userBroadcast:4},this.BINARY_ENCODING=0,this.JSON_ENCODING=1,this.BROADCAST_EVENT="broadcast",this.allowedMetadataKeys=[],this.allowedMetadataKeys=e??[]}encode(e,t){if(e.event===this.BROADCAST_EVENT&&!(e.payload instanceof ArrayBuffer)&&typeof e.payload.event=="string")return t(this._binaryEncodeUserBroadcastPush(e));let r=[e.join_ref,e.ref,e.topic,e.event,e.payload];return t(JSON.stringify(r))}_binaryEncodeUserBroadcastPush(e){var t;return this._isArrayBuffer((t=e.payload)===null||t===void 0?void 0:t.payload)?this._encodeBinaryUserBroadcastPush(e):this._encodeJsonUserBroadcastPush(e)}_encodeBinaryUserBroadcastPush(e){var t,r;let n=(r=(t=e.payload)===null||t===void 0?void 0:t.payload)!==null&&r!==void 0?r:new ArrayBuffer(0);return this._encodeUserBroadcastPush(e,this.BINARY_ENCODING,n)}_encodeJsonUserBroadcastPush(e){var t,r;let n=(r=(t=e.payload)===null||t===void 0?void 0:t.payload)!==null&&r!==void 0?r:{},a=new TextEncoder().encode(JSON.stringify(n)).buffer;return this._encodeUserBroadcastPush(e,this.JSON_ENCODING,a)}_encodeUserBroadcastPush(e,t,r){var n,s;let a=new TextEncoder,o=a.encode(e.topic),c=a.encode((n=e.ref)!==null&&n!==void 0?n:""),l=a.encode((s=e.join_ref)!==null&&s!==void 0?s:""),h=a.encode(e.payload.event),d=this.allowedMetadataKeys?this._pick(e.payload,this.allowedMetadataKeys):{},f=a.encode(Object.keys(d).length===0?"":JSON.stringify(d));if(l.length>255)throw new Error(`joinRef length ${l.length} exceeds maximum of 255`);if(c.length>255)throw new Error(`ref length ${c.length} exceeds maximum of 255`);if(o.length>255)throw new Error(`topic length ${o.length} exceeds maximum of 255`);if(h.length>255)throw new Error(`userEvent length ${h.length} exceeds maximum of 255`);if(f.length>255)throw new Error(`metadata length ${f.length} exceeds maximum of 255`);let u=this.USER_BROADCAST_PUSH_META_LENGTH+l.length+c.length+o.length+h.length+f.length,p=new ArrayBuffer(this.HEADER_LENGTH+u),m=new DataView(p),y=new Uint8Array(p),g=0;m.setUint8(g++,this.KINDS.userBroadcastPush),m.setUint8(g++,l.length),m.setUint8(g++,c.length),m.setUint8(g++,o.length),m.setUint8(g++,h.length),m.setUint8(g++,f.length),m.setUint8(g++,t),y.set(l,g),g+=l.length,y.set(c,g),g+=c.length,y.set(o,g),g+=o.length,y.set(h,g),g+=h.length,y.set(f,g),g+=f.length;var v=new Uint8Array(p.byteLength+r.byteLength);return v.set(new Uint8Array(p),0),v.set(new Uint8Array(r),p.byteLength),v.buffer}decode(e,t){if(this._isArrayBuffer(e)){let r=this._binaryDecode(e);return t(r)}if(typeof e=="string"){let r=JSON.parse(e),[n,s,a,o,c]=r;return t({join_ref:n,ref:s,topic:a,event:o,payload:c})}return t({})}_binaryDecode(e){let t=new DataView(e),r=t.getUint8(0),n=new TextDecoder;if(r===this.KINDS.userBroadcast)return this._decodeUserBroadcast(e,t,n)}_decodeUserBroadcast(e,t,r){let n=t.getUint8(1),s=t.getUint8(2),a=t.getUint8(3),o=t.getUint8(4),c=this.HEADER_LENGTH+4,l=r.decode(e.slice(c,c+n));c=c+n;let h=r.decode(e.slice(c,c+s));c=c+s;let d=r.decode(e.slice(c,c+a));c=c+a;let f=e.slice(c,e.byteLength),u=o===this.JSON_ENCODING?JSON.parse(r.decode(f)):f,p={type:this.BROADCAST_EVENT,event:h,payload:u};return a>0&&(p.meta=JSON.parse(d)),{join_ref:null,ref:null,topic:l,event:this.BROADCAST_EVENT,payload:p}}_isArrayBuffer(e){var t;return e instanceof ArrayBuffer||((t=e?.constructor)===null||t===void 0?void 0:t.name)==="ArrayBuffer"}_pick(e,t){return!e||typeof e!="object"?{}:Object.fromEntries(Object.entries(e).filter(([r])=>t.includes(r)))}};var O;(function(i){i.abstime="abstime",i.bool="bool",i.date="date",i.daterange="daterange",i.float4="float4",i.float8="float8",i.int2="int2",i.int4="int4",i.int4range="int4range",i.int8="int8",i.int8range="int8range",i.json="json",i.jsonb="jsonb",i.money="money",i.numeric="numeric",i.oid="oid",i.reltime="reltime",i.text="text",i.time="time",i.timestamp="timestamp",i.timestamptz="timestamptz",i.timetz="timetz",i.tsrange="tsrange",i.tstzrange="tstzrange"})(O||(O={}));var ni=(i,e,t={})=>{var r;let n=(r=t.skipTypes)!==null&&r!==void 0?r:[];return e?Object.keys(e).reduce((s,a)=>(s[a]=On(a,i,e,n),s),{}):{}},On=(i,e,t,r)=>{let n=e.find(o=>o.name===i),s=n?.type,a=t[i];return s&&!r.includes(s)?er(s,a):ri(a)},er=(i,e)=>{if(i.charAt(0)==="_"){let t=i.slice(1,i.length);return Bn(e,t)}switch(i){case O.bool:return jn(e);case O.float4:case O.float8:case O.int2:case O.int4:case O.int8:case O.numeric:case O.oid:return $n(e);case O.json:case O.jsonb:return Mn(e);case O.timestamp:return Nn(e);case O.abstime:case O.date:case O.daterange:case O.int4range:case O.int8range:case O.money:case O.reltime:case O.text:case O.time:case O.timestamptz:case O.timetz:case O.tsrange:case O.tstzrange:return ri(e);default:return ri(e)}},ri=i=>i,jn=i=>{switch(i){case"t":return!0;case"f":return!1;default:return i}},$n=i=>{if(typeof i=="string"){let e=parseFloat(i);if(!Number.isNaN(e))return e}return i},Mn=i=>{if(typeof i=="string")try{return JSON.parse(i)}catch{return i}return i},Bn=(i,e)=>{if(typeof i!="string")return i;let t=i.length-1,r=i[t];if(i[0]==="{"&&r==="}"){let s,a=i.slice(1,t);try{s=JSON.parse("["+a+"]")}catch{s=a?a.split(","):[]}return s.map(o=>er(e,o))}return i},Nn=i=>typeof i=="string"?i.replace(" ","T"):i,St=i=>{let e=new URL(i);return e.protocol=e.protocol.replace(/^ws/i,"http"),e.pathname=e.pathname.replace(/\/+$/,"").replace(/\/socket\/websocket$/i,"").replace(/\/socket$/i,"").replace(/\/websocket$/i,""),e.pathname===""||e.pathname==="/"?e.pathname="/api/broadcast":e.pathname=e.pathname+"/api/broadcast",e.href};var Me=i=>typeof i=="function"?i:function(){return i},Un=typeof self<"u"?self:null,$e=typeof window<"u"?window:null,ne=Un||$e||globalThis,Dn="2.0.0",zn=1e4,qn=1e3,Fn=100,se={connecting:0,open:1,closing:2,closed:3},W={closed:"closed",errored:"errored",joined:"joined",joining:"joining",leaving:"leaving"},de={close:"phx_close",error:"phx_error",join:"phx_join",reply:"phx_reply",leave:"phx_leave"},si={longpoll:"longpoll",websocket:"websocket"},Wn={complete:4},ai="base64url.bearer.phx.",At=class{constructor(i,e,t,r){this.channel=i,this.event=e,this.payload=t||function(){return{}},this.receivedResp=null,this.timeout=r,this.timeoutTimer=null,this.recHooks=[],this.sent=!1,this.ref=void 0}resend(i){this.timeout=i,this.reset(),this.send()}send(){this.hasReceived("timeout")||(this.startTimeout(),this.sent=!0,this.channel.socket.push({topic:this.channel.topic,event:this.event,payload:this.payload(),ref:this.ref,join_ref:this.channel.joinRef()}))}receive(i,e){return this.hasReceived(i)&&e(this.receivedResp.response),this.recHooks.push({status:i,callback:e}),this}reset(){this.cancelRefEvent(),this.ref=null,this.refEvent=null,this.receivedResp=null,this.sent=!1}destroy(){this.cancelRefEvent(),this.cancelTimeout()}matchReceive({status:i,response:e,_ref:t}){this.recHooks.filter(r=>r.status===i).forEach(r=>r.callback(e))}cancelRefEvent(){this.refEvent&&this.channel.off(this.refEvent)}cancelTimeout(){clearTimeout(this.timeoutTimer),this.timeoutTimer=null}startTimeout(){this.timeoutTimer&&this.cancelTimeout(),this.ref=this.channel.socket.makeRef(),this.refEvent=this.channel.replyEventName(this.ref),this.channel.on(this.refEvent,i=>{this.cancelRefEvent(),this.cancelTimeout(),this.receivedResp=i,this.matchReceive(i)}),this.timeoutTimer=setTimeout(()=>{this.trigger("timeout",{})},this.timeout)}hasReceived(i){return this.receivedResp&&this.receivedResp.status===i}trigger(i,e){this.channel.trigger(this.refEvent,{status:i,response:e})}},tr=class{constructor(i,e){this.callback=i,this.timerCalc=e,this.timer=void 0,this.tries=0}reset(){this.tries=0,clearTimeout(this.timer)}scheduleTimeout(){clearTimeout(this.timer),this.timer=setTimeout(()=>{this.tries=this.tries+1,this.callback()},this.timerCalc(this.tries+1))}},Vn=class{constructor(i,e,t){this.state=W.closed,this.topic=i,this.params=Me(e||{}),this.socket=t,this.bindings=[],this.bindingRef=0,this.timeout=this.socket.timeout,this.joinedOnce=!1,this.joinPush=new At(this,de.join,this.params,this.timeout),this.pushBuffer=[],this.stateChangeRefs=[],this.rejoinTimer=new tr(()=>{this.socket.isConnected()&&this.rejoin()},this.socket.rejoinAfterMs),this.stateChangeRefs.push(this.socket.onError(()=>this.rejoinTimer.reset())),this.stateChangeRefs.push(this.socket.onOpen(()=>{this.rejoinTimer.reset(),this.isErrored()&&this.rejoin()})),this.joinPush.receive("ok",()=>{this.state=W.joined,this.rejoinTimer.reset(),this.pushBuffer.forEach(r=>r.send()),this.pushBuffer=[]}),this.joinPush.receive("error",r=>{this.state=W.errored,this.socket.hasLogger()&&this.socket.log("channel",`error ${this.topic}`,r),this.socket.isConnected()&&this.rejoinTimer.scheduleTimeout()}),this.onClose(()=>{this.rejoinTimer.reset(),this.socket.hasLogger()&&this.socket.log("channel",`close ${this.topic}`),this.state=W.closed,this.socket.remove(this)}),this.onError(r=>{this.socket.hasLogger()&&this.socket.log("channel",`error ${this.topic}`,r),this.isJoining()&&this.joinPush.reset(),this.state=W.errored,this.socket.isConnected()&&this.rejoinTimer.scheduleTimeout()}),this.joinPush.receive("timeout",()=>{this.socket.hasLogger()&&this.socket.log("channel",`timeout ${this.topic}`,this.joinPush.timeout),new At(this,de.leave,Me({}),this.timeout).send(),this.state=W.errored,this.joinPush.reset(),this.socket.isConnected()&&this.rejoinTimer.scheduleTimeout()}),this.on(de.reply,(r,n)=>{this.trigger(this.replyEventName(n),r)})}join(i=this.timeout){if(this.joinedOnce)throw new Error("tried to join multiple times. 'join' can only be called a single time per channel instance");return this.timeout=i,this.joinedOnce=!0,this.rejoin(),this.joinPush}teardown(){this.pushBuffer.forEach(i=>i.destroy()),this.pushBuffer=[],this.rejoinTimer.reset(),this.joinPush.destroy(),this.state=W.closed,this.bindings=[]}onClose(i){this.on(de.close,i)}onError(i){return this.on(de.error,e=>i(e))}on(i,e){let t=this.bindingRef++;return this.bindings.push({event:i,ref:t,callback:e}),t}off(i,e){this.bindings=this.bindings.filter(t=>!(t.event===i&&(typeof e>"u"||e===t.ref)))}canPush(){return this.socket.isConnected()&&this.isJoined()}push(i,e,t=this.timeout){if(e=e||{},!this.joinedOnce)throw new Error(`tried to push '${i}' to '${this.topic}' before joining. Use channel.join() before pushing events`);let r=new At(this,i,function(){return e},t);return this.canPush()?r.send():(r.startTimeout(),this.pushBuffer.push(r)),r}leave(i=this.timeout){this.rejoinTimer.reset(),this.joinPush.cancelTimeout(),this.state=W.leaving;let e=()=>{this.socket.hasLogger()&&this.socket.log("channel",`leave ${this.topic}`),this.trigger(de.close,"leave")},t=new At(this,de.leave,Me({}),i);return t.receive("ok",()=>e()).receive("timeout",()=>e()),t.send(),this.canPush()||t.trigger("ok",{}),t}onMessage(i,e,t){return e}filterBindings(i,e,t){return!0}isMember(i,e,t,r){return this.topic!==i?!1:r&&r!==this.joinRef()?(this.socket.hasLogger()&&this.socket.log("channel","dropping outdated message",{topic:i,event:e,payload:t,joinRef:r}),!1):!0}joinRef(){return this.joinPush.ref}rejoin(i=this.timeout){this.isLeaving()||(this.socket.leaveOpenTopic(this.topic),this.state=W.joining,this.joinPush.resend(i))}trigger(i,e,t,r){let n=this.onMessage(i,e,t,r);if(e&&!n)throw new Error("channel onMessage callbacks must return the payload, modified or unmodified");let s=this.bindings.filter(a=>a.event===i&&this.filterBindings(a,e,t));for(let a=0;a<s.length;a++)s[a].callback(n,t,r||this.joinRef())}replyEventName(i){return`chan_reply_${i}`}isClosed(){return this.state===W.closed}isErrored(){return this.state===W.errored}isJoined(){return this.state===W.joined}isJoining(){return this.state===W.joining}isLeaving(){return this.state===W.leaving}},Ct=class{static request(i,e,t,r,n,s,a){if(ne.XDomainRequest){let o=new ne.XDomainRequest;return this.xdomainRequest(o,i,e,r,n,s,a)}else if(ne.XMLHttpRequest){let o=new ne.XMLHttpRequest;return this.xhrRequest(o,i,e,t,r,n,s,a)}else{if(ne.fetch&&ne.AbortController)return this.fetchRequest(i,e,t,r,n,s,a);throw new Error("No suitable XMLHttpRequest implementation found")}}static fetchRequest(i,e,t,r,n,s,a){let o={method:i,headers:t,body:r},c=null;if(n){c=new AbortController;let l=setTimeout(()=>c.abort(),n);o.signal=c.signal}return ne.fetch(e,o).then(l=>l.text()).then(l=>this.parseJSON(l)).then(l=>a&&a(l)).catch(l=>{l.name==="AbortError"&&s?s():a&&a(null)}),c}static xdomainRequest(i,e,t,r,n,s,a){return i.timeout=n,i.open(e,t),i.onload=()=>{let o=this.parseJSON(i.responseText);a&&a(o)},s&&(i.ontimeout=s),i.onprogress=()=>{},i.send(r),i}static xhrRequest(i,e,t,r,n,s,a,o){i.open(e,t,!0),i.timeout=s;for(let[c,l]of Object.entries(r))i.setRequestHeader(c,l);return i.onerror=()=>o&&o(null),i.onreadystatechange=()=>{if(i.readyState===Wn.complete&&o){let c=this.parseJSON(i.responseText);o(c)}},a&&(i.ontimeout=a),i.send(n),i}static parseJSON(i){if(!i||i==="")return null;try{return JSON.parse(i)}catch{return console&&console.log("failed to parse JSON response",i),null}}static serialize(i,e){let t=[];for(var r in i){if(!Object.prototype.hasOwnProperty.call(i,r))continue;let n=e?`${e}[${r}]`:r,s=i[r];typeof s=="object"?t.push(this.serialize(s,n)):t.push(encodeURIComponent(n)+"="+encodeURIComponent(s))}return t.join("&")}static appendParams(i,e){if(Object.keys(e).length===0)return i;let t=i.match(/\?/)?"&":"?";return`${i}${t}${this.serialize(e)}`}},Kn=i=>{let e="",t=new Uint8Array(i),r=t.byteLength;for(let n=0;n<r;n++)e+=String.fromCharCode(t[n]);return btoa(e)},je=class{constructor(i,e){e&&e.length===2&&e[1].startsWith(ai)&&(this.authToken=atob(e[1].slice(ai.length))),this.endPoint=null,this.token=null,this.skipHeartbeat=!0,this.reqs=new Set,this.awaitingBatchAck=!1,this.currentBatch=null,this.currentBatchTimer=null,this.batchBuffer=[],this.onopen=function(){},this.onerror=function(){},this.onmessage=function(){},this.onclose=function(){},this.pollEndpoint=this.normalizeEndpoint(i),this.readyState=se.connecting,setTimeout(()=>this.poll(),0)}normalizeEndpoint(i){return i.replace("ws://","http://").replace("wss://","https://").replace(new RegExp("(.*)/"+si.websocket),"$1/"+si.longpoll)}endpointURL(){return Ct.appendParams(this.pollEndpoint,{token:this.token})}closeAndRetry(i,e,t){this.close(i,e,t),this.readyState=se.connecting}ontimeout(){this.onerror("timeout"),this.closeAndRetry(1005,"timeout",!1)}isActive(){return this.readyState===se.open||this.readyState===se.connecting}poll(){let i={Accept:"application/json"};this.authToken&&(i["X-Phoenix-AuthToken"]=this.authToken),this.ajax("GET",i,null,()=>this.ontimeout(),e=>{if(e){var{status:t,token:r,messages:n}=e;if(t===410&&this.token!==null){this.onerror(410),this.closeAndRetry(3410,"session_gone",!1);return}this.token=r}else t=0;switch(t){case 200:n.forEach(s=>{setTimeout(()=>this.onmessage({data:s}),0)}),this.poll();break;case 204:this.poll();break;case 410:this.readyState=se.open,this.onopen({}),this.poll();break;case 403:this.onerror(403),this.close(1008,"forbidden",!1);break;case 0:case 500:this.onerror(500),this.closeAndRetry(1011,"internal server error",500);break;default:throw new Error(`unhandled poll status ${t}`)}})}send(i){typeof i!="string"&&(i=Kn(i)),this.currentBatch?this.currentBatch.push(i):this.awaitingBatchAck?this.batchBuffer.push(i):(this.currentBatch=[i],this.currentBatchTimer=setTimeout(()=>{this.batchSend(this.currentBatch),this.currentBatch=null},0))}batchSend(i,e=0){this.awaitingBatchAck=!0;let t=e+Fn,r=i.slice(e,t);this.ajax("POST",{"Content-Type":"application/x-ndjson"},r.join(`
`),()=>this.onerror("timeout"),n=>{!n||n.status!==200?(this.awaitingBatchAck=!1,this.onerror(n&&n.status),this.closeAndRetry(1011,"internal server error",!1)):t<i.length?this.batchSend(i,t):this.batchBuffer.length>0?(this.batchSend(this.batchBuffer),this.batchBuffer=[]):this.awaitingBatchAck=!1})}close(i,e,t){for(let n of this.reqs)n.abort();this.readyState=se.closed;let r=Object.assign({code:1e3,reason:void 0,wasClean:!0},{code:i,reason:e,wasClean:t});this.batchBuffer=[],clearTimeout(this.currentBatchTimer),this.currentBatchTimer=null,typeof CloseEvent<"u"?this.onclose(new CloseEvent("close",r)):this.onclose(r)}ajax(i,e,t,r,n){let s,a=()=>{this.reqs.delete(s),r()};s=Ct.request(i,this.endpointURL(),e,t,this.timeout,a,o=>{this.reqs.delete(s),this.isActive()&&n(o)}),this.reqs.add(s)}},ir=class Ze{constructor(e,t={}){let r=t.events||{state:"presence_state",diff:"presence_diff"};this.state=Object.create(null),this.pendingDiffs=[],this.channel=e,this.joinRef=null,this.caller={onJoin:function(){},onLeave:function(){},onSync:function(){}},this.channel.on(r.state,n=>{let{onJoin:s,onLeave:a,onSync:o}=this.caller;this.joinRef=this.channel.joinRef(),this.state=Ze.syncState(this.state,n,s,a),this.pendingDiffs.forEach(c=>{this.state=Ze.syncDiff(this.state,c,s,a)}),this.pendingDiffs=[],o()}),this.channel.on(r.diff,n=>{let{onJoin:s,onLeave:a,onSync:o}=this.caller;this.inPendingSyncState()?this.pendingDiffs.push(n):(this.state=Ze.syncDiff(this.state,n,s,a),o())})}onJoin(e){this.caller.onJoin=e}onLeave(e){this.caller.onLeave=e}onSync(e){this.caller.onSync=e}list(e){return Ze.list(this.state,e)}inPendingSyncState(){return!this.joinRef||this.joinRef!==this.channel.joinRef()}static syncState(e,t,r,n){let s=this.toNullProtoObj(this.clone(e));t=this.toNullProtoObj(t);let a=Object.create(null),o=Object.create(null);return this.map(s,(c,l)=>{t[c]||(o[c]=l)}),this.map(t,(c,l)=>{let h=s[c];if(h){let d=l.metas.map(m=>m.phx_ref),f=h.metas.map(m=>m.phx_ref),u=l.metas.filter(m=>f.indexOf(m.phx_ref)<0),p=h.metas.filter(m=>d.indexOf(m.phx_ref)<0);u.length>0&&(a[c]=l,a[c].metas=u),p.length>0&&(o[c]=this.clone(h),o[c].metas=p)}else a[c]=l}),this.syncDiff(s,{joins:a,leaves:o},r,n)}static syncDiff(e,t,r,n){e=this.toNullProtoObj(e);let{joins:s,leaves:a}=this.clone(t);return r||(r=function(){}),n||(n=function(){}),this.map(s,(o,c)=>{let l=e[o];if(e[o]=this.clone(c),l){let h=e[o].metas.map(f=>f.phx_ref),d=l.metas.filter(f=>h.indexOf(f.phx_ref)<0);e[o].metas.unshift(...d)}r(o,l,c)}),this.map(a,(o,c)=>{let l=e[o];if(!l)return;let h=c.metas.map(d=>d.phx_ref);l.metas=l.metas.filter(d=>h.indexOf(d.phx_ref)<0),n(o,l,c),l.metas.length===0&&delete e[o]}),e}static list(e,t){return t||(t=function(r,n){return n}),this.map(e,(r,n)=>t(r,n))}static map(e,t){return Object.getOwnPropertyNames(e).map(r=>t(r,e[r]))}static toNullProtoObj(e){if(Object.getPrototypeOf(e)===null)return e;let t=Object.create(null);return Object.getOwnPropertyNames(e).forEach(r=>{t[r]=e[r]}),t}static clone(e){return JSON.parse(JSON.stringify(e))}},It={HEADER_LENGTH:1,META_LENGTH:4,KINDS:{push:0,reply:1,broadcast:2},encode(i,e){if(i.payload.constructor===ArrayBuffer)return e(this.binaryEncode(i));{let t=[i.join_ref,i.ref,i.topic,i.event,i.payload];return e(JSON.stringify(t))}},decode(i,e){if(i.constructor===ArrayBuffer)return e(this.binaryDecode(i));{let[t,r,n,s,a]=JSON.parse(i);return e({join_ref:t,ref:r,topic:n,event:s,payload:a})}},binaryEncode(i){let{join_ref:e,ref:t,event:r,topic:n,payload:s}=i,a=new TextEncoder,o=a.encode(e),c=a.encode(t),l=a.encode(n),h=a.encode(r);this.assertFieldSize(o.byteLength,"join_ref"),this.assertFieldSize(c.byteLength,"ref"),this.assertFieldSize(l.byteLength,"topic"),this.assertFieldSize(h.byteLength,"event");let d=this.META_LENGTH+o.byteLength+c.byteLength+l.byteLength+h.byteLength,f=new ArrayBuffer(this.HEADER_LENGTH+d),u=new Uint8Array(f),p=new DataView(f),m=0;p.setUint8(m++,this.KINDS.push),p.setUint8(m++,o.byteLength),p.setUint8(m++,c.byteLength),p.setUint8(m++,l.byteLength),p.setUint8(m++,h.byteLength),u.set(o,m),m+=o.byteLength,u.set(c,m),m+=c.byteLength,u.set(l,m),m+=l.byteLength,u.set(h,m),m+=h.byteLength;var y=new Uint8Array(f.byteLength+s.byteLength);return y.set(u,0),y.set(new Uint8Array(s),f.byteLength),y.buffer},assertFieldSize(i,e){if(i>255)throw new Error(`unable to convert ${e} to binary: must be less than or equal to 255 bytes, but is ${i} bytes`)},binaryDecode(i){let e=new DataView(i),t=e.getUint8(0),r=new TextDecoder;switch(t){case this.KINDS.push:return this.decodePush(i,e,r);case this.KINDS.reply:return this.decodeReply(i,e,r);case this.KINDS.broadcast:return this.decodeBroadcast(i,e,r)}},decodePush(i,e,t){let r=e.getUint8(1),n=e.getUint8(2),s=e.getUint8(3),a=this.HEADER_LENGTH+this.META_LENGTH-1,o=t.decode(i.slice(a,a+r));a=a+r;let c=t.decode(i.slice(a,a+n));a=a+n;let l=t.decode(i.slice(a,a+s));a=a+s;let h=i.slice(a,i.byteLength);return{join_ref:o,ref:null,topic:c,event:l,payload:h}},decodeReply(i,e,t){let r=e.getUint8(1),n=e.getUint8(2),s=e.getUint8(3),a=e.getUint8(4),o=this.HEADER_LENGTH+this.META_LENGTH,c=t.decode(i.slice(o,o+r));o=o+r;let l=t.decode(i.slice(o,o+n));o=o+n;let h=t.decode(i.slice(o,o+s));o=o+s;let d=t.decode(i.slice(o,o+a));o=o+a;let f=i.slice(o,i.byteLength),u={status:d,response:f};return{join_ref:c,ref:l,topic:h,event:de.reply,payload:u}},decodeBroadcast(i,e,t){let r=e.getUint8(1),n=e.getUint8(2),s=this.HEADER_LENGTH+2,a=t.decode(i.slice(s,s+r));s=s+r;let o=t.decode(i.slice(s,s+n));s=s+n;let c=i.slice(s,i.byteLength);return{join_ref:null,ref:null,topic:a,event:o,payload:c}}},rr=class{constructor(i,e={}){this.stateChangeCallbacks={open:[],close:[],error:[],message:[]},this.channels=[],this.sendBuffer=[],this.ref=0,this.fallbackRef=null,this.timeout=e.timeout||zn,this.transport=e.transport||ne.WebSocket||je,this.conn=void 0,this.primaryPassedHealthCheck=!1,this.longPollFallbackMs=e.longPollFallbackMs,this.fallbackTimer=null;let t=null;try{t=ne&&ne.sessionStorage}catch{}this.sessionStore=e.sessionStorage||t,this.establishedConnections=0,this.defaultEncoder=It.encode.bind(It),this.defaultDecoder=It.decode.bind(It),this.closeWasClean=!0,this.disconnecting=!1,this.binaryType=e.binaryType||"arraybuffer",this.connectClock=1,this.pageHidden=!1,this.encode=void 0,this.decode=void 0,this.transport!==je?(this.encode=e.encode||this.defaultEncoder,this.decode=e.decode||this.defaultDecoder):(this.encode=this.defaultEncoder,this.decode=this.defaultDecoder);let r=null;$e&&$e.addEventListener&&($e.addEventListener("pagehide",n=>{this.conn&&(this.disconnect(),r=this.connectClock)}),$e.addEventListener("pageshow",n=>{r===this.connectClock&&(r=null,this.connect())}),$e.addEventListener("visibilitychange",()=>{document.visibilityState==="hidden"?this.pageHidden=!0:(this.pageHidden=!1,!this.isConnected()&&!this.closeWasClean&&this.teardown(()=>this.connect()))})),this.heartbeatIntervalMs=e.heartbeatIntervalMs||3e4,this.autoSendHeartbeat=e.autoSendHeartbeat??!0,this.heartbeatCallback=e.heartbeatCallback??(()=>{}),this.rejoinAfterMs=n=>e.rejoinAfterMs?e.rejoinAfterMs(n):[1e3,2e3,5e3][n-1]||1e4,this.reconnectAfterMs=n=>e.reconnectAfterMs?e.reconnectAfterMs(n):[10,50,100,150,200,250,500,1e3,2e3][n-1]||5e3,this.logger=e.logger||null,!this.logger&&e.debug&&(this.logger=(n,s,a)=>{console.log(`${n}: ${s}`,a)}),this.longpollerTimeout=e.longpollerTimeout||2e4,this.params=Me(e.params||{}),this.endPoint=`${i}/${si.websocket}`,this.vsn=e.vsn||Dn,this.heartbeatTimeoutTimer=null,this.heartbeatTimer=null,this.heartbeatSentAt=null,this.pendingHeartbeatRef=null,this.reconnectTimer=new tr(()=>{if(this.pageHidden){this.log("Not reconnecting as page is hidden!"),this.teardown();return}this.teardown(async()=>{e.beforeReconnect&&await e.beforeReconnect(),this.connect()})},this.reconnectAfterMs),this.authToken=e.authToken&&Me(e.authToken)}getLongPollTransport(){return je}replaceTransport(i){this.connectClock++,this.closeWasClean=!0,clearTimeout(this.fallbackTimer),this.reconnectTimer.reset(),this.conn&&(this.conn.close(),this.conn=null),this.transport=i}protocol(){return location.protocol.match(/^https/)?"wss":"ws"}endPointURL(){let i=Ct.appendParams(Ct.appendParams(this.endPoint,this.params()),{vsn:this.vsn});return i.charAt(0)!=="/"?i:i.charAt(1)==="/"?`${this.protocol()}:${i}`:`${this.protocol()}://${location.host}${i}`}disconnect(i,e,t){this.connectClock++,this.disconnecting=!0,this.closeWasClean=!0,clearTimeout(this.fallbackTimer),this.reconnectTimer.reset(),this.teardown(()=>{this.disconnecting=!1,i&&i()},e,t)}connect(i){i&&(console&&console.log("passing params to connect is deprecated. Instead pass :params to the Socket constructor"),this.params=Me(i)),!(this.conn&&!this.disconnecting)&&(this.longPollFallbackMs&&this.transport!==je?this.connectWithFallback(je,this.longPollFallbackMs):this.transportConnect())}log(i,e,t){this.logger&&this.logger(i,e,t)}hasLogger(){return this.logger!==null}onOpen(i){let e=this.makeRef();return this.stateChangeCallbacks.open.push([e,i]),e}onClose(i){let e=this.makeRef();return this.stateChangeCallbacks.close.push([e,i]),e}onError(i){let e=this.makeRef();return this.stateChangeCallbacks.error.push([e,i]),e}onMessage(i){let e=this.makeRef();return this.stateChangeCallbacks.message.push([e,i]),e}onHeartbeat(i){this.heartbeatCallback=i}ping(i){if(!this.isConnected())return!1;let e=this.makeRef(),t=Date.now();this.push({topic:"phoenix",event:"heartbeat",payload:{},ref:e});let r=this.onMessage(n=>{n.ref===e&&(this.off([r]),i(Date.now()-t))});return!0}transportName(i){return i===je?"LongPoll":i.name}transportConnect(){this.connectClock++,this.closeWasClean=!1;let i;this.authToken&&(i=["phoenix",`${ai}${btoa(this.authToken()).replace(/=/g,"")}`]),this.conn=new this.transport(this.endPointURL(),i),this.conn.binaryType=this.binaryType,this.conn.timeout=this.longpollerTimeout,this.conn.onopen=()=>this.onConnOpen(),this.conn.onerror=e=>this.onConnError(e),this.conn.onmessage=e=>this.onConnMessage(e),this.conn.onclose=e=>this.onConnClose(e)}getSession(i){return this.sessionStore&&this.sessionStore.getItem(i)}storeSession(i,e){this.sessionStore&&this.sessionStore.setItem(i,e)}connectWithFallback(i,e=2500){clearTimeout(this.fallbackTimer);let t=!1,r=!0,n,s,a=this.transportName(i),o=c=>{this.log("transport",`falling back to ${a}...`,c),this.off([n,s]),r=!1,this.replaceTransport(i),this.transportConnect()};if(this.getSession(`phx:fallback:${a}`))return o("memorized");this.fallbackTimer=setTimeout(o,e),s=this.onError(c=>{this.log("transport","error",c),r&&!t&&(clearTimeout(this.fallbackTimer),o(c))}),this.fallbackRef&&this.off([this.fallbackRef]),this.fallbackRef=this.onOpen(()=>{if(t=!0,!r){let c=this.transportName(i);return this.primaryPassedHealthCheck||this.storeSession(`phx:fallback:${c}`,"true"),this.log("transport",`established ${c} fallback`)}clearTimeout(this.fallbackTimer),this.fallbackTimer=setTimeout(o,e),this.ping(c=>{this.log("transport","connected to primary after",c),this.primaryPassedHealthCheck=!0,clearTimeout(this.fallbackTimer)})}),this.transportConnect()}clearHeartbeats(){clearTimeout(this.heartbeatTimer),clearTimeout(this.heartbeatTimeoutTimer)}onConnOpen(){this.hasLogger()&&this.log("transport",`connected to ${this.endPointURL()}`),this.closeWasClean=!1,this.disconnecting=!1,this.establishedConnections++,this.flushSendBuffer(),this.reconnectTimer.reset(),this.autoSendHeartbeat&&this.resetHeartbeat(),this.triggerStateCallbacks("open")}heartbeatTimeout(){if(this.pendingHeartbeatRef){this.pendingHeartbeatRef=null,this.heartbeatSentAt=null,this.hasLogger()&&this.log("transport","heartbeat timeout. Attempting to re-establish connection");try{this.heartbeatCallback("timeout")}catch(i){this.log("error","error in heartbeat callback",i)}this.triggerChanError(new Error("heartbeat timeout")),this.closeWasClean=!1,this.teardown(()=>this.reconnectTimer.scheduleTimeout(),qn,"heartbeat timeout")}}resetHeartbeat(){this.conn&&this.conn.skipHeartbeat||(this.pendingHeartbeatRef=null,this.clearHeartbeats(),this.heartbeatTimer=setTimeout(()=>this.sendHeartbeat(),this.heartbeatIntervalMs))}teardown(i,e,t){if(!this.conn)return i&&i();let r=this.conn;this.waitForBufferDone(r,()=>{e?r.close(e,t||""):r.close(),this.waitForSocketClosed(r,()=>{this.conn===r&&(this.conn.onopen=function(){},this.conn.onerror=function(){},this.conn.onmessage=function(){},this.conn.onclose=function(){},this.conn=null),i&&i()})})}waitForBufferDone(i,e,t=1){if(t===5||!i.bufferedAmount){e();return}setTimeout(()=>{this.waitForBufferDone(i,e,t+1)},150*t)}waitForSocketClosed(i,e,t=1){if(t===5||i.readyState===se.closed){e();return}setTimeout(()=>{this.waitForSocketClosed(i,e,t+1)},150*t)}onConnClose(i){this.conn&&(this.conn.onclose=()=>{}),this.hasLogger()&&this.log("transport","close",i),this.triggerChanError(i),this.clearHeartbeats(),this.closeWasClean||this.reconnectTimer.scheduleTimeout(),this.triggerStateCallbacks("close",i)}onConnError(i){this.hasLogger()&&this.log("transport","error",i);let e=this.transport,t=this.establishedConnections;this.triggerStateCallbacks("error",i,e,t),(e===this.transport||t>0)&&this.triggerChanError(i)}triggerChanError(i){this.channels.forEach(e=>{e.isErrored()||e.isLeaving()||e.isClosed()||e.trigger(de.error,i)})}connectionState(){switch(this.conn&&this.conn.readyState){case se.connecting:return"connecting";case se.open:return"open";case se.closing:return"closing";default:return"closed"}}isConnected(){return this.connectionState()==="open"}remove(i){this.off(i.stateChangeRefs),this.channels=this.channels.filter(e=>e!==i)}off(i){for(let e in this.stateChangeCallbacks)this.stateChangeCallbacks[e]=this.stateChangeCallbacks[e].filter(([t])=>i.indexOf(t)===-1)}channel(i,e={}){let t=new Vn(i,e,this);return this.channels.push(t),t}push(i){if(this.hasLogger()){let{topic:e,event:t,payload:r,ref:n,join_ref:s}=i;this.log("push",`${e} ${t} (${s}, ${n})`,r)}this.isConnected()?this.encode(i,e=>this.conn.send(e)):this.sendBuffer.push(()=>this.encode(i,e=>this.conn.send(e)))}makeRef(){let i=this.ref+1;return i===this.ref?this.ref=0:this.ref=i,this.ref.toString()}sendHeartbeat(){if(!this.isConnected()){try{this.heartbeatCallback("disconnected")}catch(i){this.log("error","error in heartbeat callback",i)}return}if(this.pendingHeartbeatRef){this.heartbeatTimeout();return}this.pendingHeartbeatRef=this.makeRef(),this.heartbeatSentAt=Date.now(),this.push({topic:"phoenix",event:"heartbeat",payload:{},ref:this.pendingHeartbeatRef});try{this.heartbeatCallback("sent")}catch(i){this.log("error","error in heartbeat callback",i)}this.heartbeatTimeoutTimer=setTimeout(()=>this.heartbeatTimeout(),this.heartbeatIntervalMs)}flushSendBuffer(){this.isConnected()&&this.sendBuffer.length>0&&(this.sendBuffer.forEach(i=>i()),this.sendBuffer=[])}onConnMessage(i){this.decode(i.data,e=>{let{topic:t,event:r,payload:n,ref:s,join_ref:a}=e;if(s&&s===this.pendingHeartbeatRef){let o=this.heartbeatSentAt?Date.now()-this.heartbeatSentAt:void 0;this.clearHeartbeats();try{this.heartbeatCallback(n.status==="ok"?"ok":"error",o)}catch(c){this.log("error","error in heartbeat callback",c)}this.pendingHeartbeatRef=null,this.heartbeatSentAt=null,this.autoSendHeartbeat&&(this.heartbeatTimer=setTimeout(()=>this.sendHeartbeat(),this.heartbeatIntervalMs))}this.hasLogger()&&this.log("receive",`${n.status||""} ${t} ${r} ${s&&"("+s+")"||""}`.trim(),n);for(let o=0;o<this.channels.length;o++){let c=this.channels[o];c.isMember(t,r,n,a)&&c.trigger(r,n,s,a)}this.triggerStateCallbacks("message",e)})}triggerStateCallbacks(i,...e){try{this.stateChangeCallbacks[i].forEach(([t,r])=>{try{r(...e)}catch(n){this.log("error",`error in ${i} callback`,n)}})}catch(t){this.log("error",`error triggering ${i} callbacks`,t)}}leaveOpenTopic(i){let e=this.channels.find(t=>t.topic===i&&(t.isJoined()||t.isJoining()));e&&(this.hasLogger()&&this.log("transport",`leaving duplicate topic "${i}"`),e.leave())}};var Xe=class i{constructor(e,t){let r=Jn(t);this.presence=new ir(e.getChannel(),r),this.presence.onJoin((n,s,a)=>{let o=i.onJoinPayload(n,s,a);e.getChannel().trigger("presence",o)}),this.presence.onLeave((n,s,a)=>{let o=i.onLeavePayload(n,s,a);e.getChannel().trigger("presence",o)}),this.presence.onSync(()=>{e.getChannel().trigger("presence",{event:"sync"})})}get state(){return i.transformState(this.presence.state)}static transformState(e){return e=Gn(e),Object.getOwnPropertyNames(e).reduce((t,r)=>{let n=e[r];return t[r]=Rt(n),t},{})}static onJoinPayload(e,t,r){let n=nr(t),s=Rt(r);return{event:"join",key:e,currentPresences:n,newPresences:s}}static onLeavePayload(e,t,r){let n=nr(t),s=Rt(r);return{event:"leave",key:e,currentPresences:n,leftPresences:s}}};function Rt(i){return i.metas.map(e=>{let t=Object.getOwnPropertyDescriptors(e),r=Object.defineProperties({},t);return r.presence_ref=r.phx_ref,delete r.phx_ref,delete r.phx_ref_prev,r})}function Gn(i){return JSON.parse(JSON.stringify(i))}function Jn(i){return i?.events&&{events:i.events}}function nr(i){return i?.metas?Rt(i):[]}var oi;(function(i){i.SYNC="sync",i.JOIN="join",i.LEAVE="leave"})(oi||(oi={}));var Be=class{get state(){return this.presenceAdapter.state}constructor(e,t){this.channel=e,this.presenceAdapter=new Xe(this.channel.channelAdapter,t)}};function sr(i){if(i instanceof Error)return i;if(typeof i=="string")return new Error(i);if(i&&typeof i=="object"){let e=i;if(typeof e.code=="number"){let t=typeof e.reason=="string"&&e.reason?` (${e.reason})`:"";return new Error(`socket closed: ${e.code}${t}`,{cause:i})}return new Error("channel error: transport failure",{cause:i})}return new Error("channel error: connection lost")}var et=class{constructor(e,t,r){let n=Yn(r);this.channel=e.getSocket().channel(t,n),this.socket=e}get state(){return this.channel.state}set state(e){this.channel.state=e}get joinedOnce(){return this.channel.joinedOnce}get joinPush(){return this.channel.joinPush}get rejoinTimer(){return this.channel.rejoinTimer}on(e,t){return this.channel.on(e,t)}off(e,t){this.channel.off(e,t)}subscribe(e){return this.channel.join(e)}unsubscribe(e){return this.channel.leave(e)}teardown(){this.channel.teardown()}onClose(e){this.channel.onClose(e)}onError(e){return this.channel.onError(e)}push(e,t,r){let n;try{n=this.channel.push(e,t,r)}catch{throw new Error(`tried to push '${e}' to '${this.channel.topic}' before joining. Use channel.subscribe() before pushing events`)}if(this.channel.pushBuffer.length>Xi){let s=this.channel.pushBuffer.shift();s.cancelTimeout(),this.socket.log("channel",`discarded push due to buffer overflow: ${s.event}`,s.payload())}return n}updateJoinPayload(e){let t=this.channel.joinPush.payload();this.channel.joinPush.payload=()=>Object.assign(Object.assign({},t),e)}canPush(){return this.socket.isConnected()&&this.state===re.joined}isJoined(){return this.state===re.joined}isJoining(){return this.state===re.joining}isClosed(){return this.state===re.closed}isLeaving(){return this.state===re.leaving}updateFilterBindings(e){this.channel.filterBindings=e}updatePayloadTransform(e){this.channel.onMessage=e}getChannel(){return this.channel}};function Yn(i){return{config:Object.assign({broadcast:{ack:!1,self:!1},presence:{key:"",enabled:!1},private:!1},i.config)}}var Qn=/[,()"\\]/,Zn=i=>Qn.test(i)||i!==i.trim(),Xn=i=>`"${i.replace(/\\/g,"\\\\").replace(/"/g,'\\"')}"`,ar=i=>{let e=i===null?"null":String(i);return Zn(e)?Xn(e):e},es=i=>i===null?"null":String(i),ts=(i,e)=>{if(i==="in"){let t=Array.isArray(e)?e:[e];if(t.length===0)throw new Error("Realtime `in` filter requires at least one value.");return`in.(${Array.from(new Set(t)).map(n=>ar(n)).join(",")})`}return i==="is"?`is.${es(e)}`:`${i}.${ar(e)}`},Ne=class{constructor(){this.filters=[]}add(e,t,r,n=!1){let s=n?"not.":"";return this.filters.push(`${e}=${s}${ts(t,r)}`),this}eq(e,t){return this.add(e,"eq",t)}neq(e,t){return this.add(e,"neq",t)}gt(e,t){return this.add(e,"gt",t)}gte(e,t){return this.add(e,"gte",t)}lt(e,t){return this.add(e,"lt",t)}lte(e,t){return this.add(e,"lte",t)}in(e,t){return this.add(e,"in",t)}like(e,t){return this.add(e,"like",t)}ilike(e,t){return this.add(e,"ilike",t)}match(e,t){return this.add(e,"match",t)}imatch(e,t){return this.add(e,"imatch",t)}is(e,t){return this.add(e,"is",t)}isDistinct(e,t){return this.add(e,"isdistinct",t)}not(e,t,r){return this.add(e,t,r,!0)}build(){return this.filters.join(",")}toString(){return this.build()}};var ci;(function(i){i.ALL="*",i.INSERT="INSERT",i.UPDATE="UPDATE",i.DELETE="DELETE"})(ci||(ci={}));var ge;(function(i){i.BROADCAST="broadcast",i.PRESENCE="presence",i.POSTGRES_CHANGES="postgres_changes",i.SYSTEM="system"})(ge||(ge={}));var ae;(function(i){i.SUBSCRIBED="SUBSCRIBED",i.TIMED_OUT="TIMED_OUT",i.CLOSED="CLOSED",i.CHANNEL_ERROR="CHANNEL_ERROR"})(ae||(ae={}));var He=class i{get state(){return this.channelAdapter.state}set state(e){this.channelAdapter.state=e}get joinedOnce(){return this.channelAdapter.joinedOnce}get timeout(){return this.socket.timeout}get joinPush(){return this.channelAdapter.joinPush}get rejoinTimer(){return this.channelAdapter.rejoinTimer}constructor(e,t={config:{}},r){var n,s;if(this.topic=e,this.params=t,this.socket=r,this.bindings={},this.subTopic=e.replace(/^realtime:/i,""),this.params.config=Object.assign({broadcast:{ack:!1,self:!1},presence:{key:"",enabled:!1},private:!1},t.config),this.channelAdapter=new et(this.socket.socketAdapter,e,this.params),this.presence=new Be(this),this._onClose(()=>{this.socket._remove(this)}),this._updateFilterTransform(),this.broadcastEndpointURL=St(this.socket.socketAdapter.endPointURL()),this.private=this.params.config.private||!1,!this.private&&(!((s=(n=this.params.config)===null||n===void 0?void 0:n.broadcast)===null||s===void 0)&&s.replay))throw new Error(`tried to use replay on public channel '${this.topic}'. It must be a private channel.`)}subscribe(e,t=this.timeout){var r,n,s;if(this.socket.isConnected()||this.socket.connect(),this.channelAdapter.isClosed()){let{config:{broadcast:a,presence:o,private:c}}=this.params,l=(n=(r=this.bindings.postgres_changes)===null||r===void 0?void 0:r.map(u=>u.filter))!==null&&n!==void 0?n:[],h=!!this.bindings[ge.PRESENCE]&&this.bindings[ge.PRESENCE].length>0||((s=this.params.config.presence)===null||s===void 0?void 0:s.enabled)===!0,d={},f={broadcast:a,presence:Object.assign(Object.assign({},o),{enabled:h}),postgres_changes:l,private:c};this.socket.accessTokenValue&&(d.access_token=this.socket.accessTokenValue),this._onError(u=>{e?.(ae.CHANNEL_ERROR,sr(u))}),this._onClose(()=>e?.(ae.CLOSED)),this.updateJoinPayload(Object.assign({config:f},d)),this._updateFilterMessage(),this.channelAdapter.subscribe(t).receive("ok",async({postgres_changes:u})=>{if(this.socket._isManualToken()||this.socket.setAuth(),u===void 0){e?.(ae.SUBSCRIBED);return}this._updatePostgresBindings(u,e)}).receive("error",u=>{this.state=re.errored;let p=Object.values(u).join(", ")||"error";e?.(ae.CHANNEL_ERROR,new Error(p,{cause:u}))}).receive("timeout",()=>{e?.(ae.TIMED_OUT)})}return this}_updatePostgresBindings(e,t){var r;let n=this.bindings.postgres_changes,s=(r=n?.length)!==null&&r!==void 0?r:0,a=[];for(let o=0;o<s;o++){let c=n[o],{filter:{event:l,schema:h,table:d,filter:f}}=c,u=e&&e[o];if(u&&u.event===l&&i.isFilterValueEqual(u.schema,h)&&i.isFilterValueEqual(u.table,d)&&i.isFilterValueEqual(u.filter,f))a.push(Object.assign(Object.assign({},c),{id:u.id}));else{this.unsubscribe(),this.state=re.errored,t?.(ae.CHANNEL_ERROR,new Error("mismatch between server and client bindings for postgres changes"));return}}this.bindings.postgres_changes=a,this.state!=re.errored&&t&&t(ae.SUBSCRIBED)}presenceState(){return this.presence.state}async track(e,t={}){return await this.send({type:"presence",event:"track",payload:e},t)}async untrack(e={}){return await this.send({type:"presence",event:"untrack"},e)}on(e,t,r){let n=this.channelAdapter.isJoined()||this.channelAdapter.isJoining(),s=e===ge.PRESENCE||e===ge.POSTGRES_CHANGES;if(n&&s)throw this.socket.log("channel",`cannot add \`${e}\` callbacks for ${this.topic} after \`subscribe()\`.`),new Error(`cannot add \`${e}\` callbacks for ${this.topic} after \`subscribe()\`.`);return this._on(e,t,r)}async httpSend(e,t,r={}){var n;if(t==null)return Promise.reject(new Error("Payload is required for httpSend()"));let s=t instanceof ArrayBuffer||ArrayBuffer.isView(t),a={apikey:this.socket.apiKey?this.socket.apiKey:"","Content-Type":s?"application/octet-stream":"application/json"};this.socket.accessTokenValue&&(a.Authorization=`Bearer ${this.socket.accessTokenValue}`);let o=new URL(this.broadcastEndpointURL);o.pathname+=`/${encodeURIComponent(this.subTopic)}/events/${encodeURIComponent(e)}`,this.private&&o.searchParams.set("private","true");let c={method:"POST",headers:a,body:s?t:JSON.stringify(t)},l=await this._fetchWithTimeout(o.toString(),c,(n=r.timeout)!==null&&n!==void 0?n:this.timeout);if(l.status===202)return{success:!0};if(l.status===404)return Promise.reject(new Error("httpSend() requires Realtime server v2.97.0 or newer; the endpoint returned 404. Update your Supabase CLI to a recent version, or upgrade the Realtime server in your self-hosted setup. See https://github.com/supabase/supabase-js/blob/master/packages/core/realtime-js/migrations/httpsend-server-version.md"));let h=l.statusText;try{let d=await l.json();h=d.error||d.message||h}catch{}return Promise.reject(new Error(h))}async send(e,t={}){var r,n;if(!this.channelAdapter.canPush()&&e.type==="broadcast"){let s="Realtime send() is automatically falling back to REST API. This behavior will be deprecated in the future. Please use httpSend() explicitly for REST delivery.";this.socket.hasLogger()?this.socket.log("channel",s):console.warn(s);let{event:a,payload:o}=e,c={apikey:this.socket.apiKey?this.socket.apiKey:"","Content-Type":"application/json"};this.socket.accessTokenValue&&(c.Authorization=`Bearer ${this.socket.accessTokenValue}`);let l={method:"POST",headers:c,body:JSON.stringify({messages:[{topic:this.subTopic,event:a,payload:o,private:this.private}]})};try{let h=await this._fetchWithTimeout(this.broadcastEndpointURL,l,(r=t.timeout)!==null&&r!==void 0?r:this.timeout);return await((n=h.body)===null||n===void 0?void 0:n.cancel()),h.ok?"ok":"error"}catch(h){return h instanceof Error&&h.name==="AbortError"?"timed out":"error"}}else return new Promise(s=>{var a,o,c;let l=this.channelAdapter.push(e.type,e,t.timeout||this.timeout);e.type==="broadcast"&&!(!((c=(o=(a=this.params)===null||a===void 0?void 0:a.config)===null||o===void 0?void 0:o.broadcast)===null||c===void 0)&&c.ack)&&s("ok"),l.receive("ok",()=>s("ok")),l.receive("error",()=>s("error")),l.receive("timeout",()=>s("timed out"))})}updateJoinPayload(e){this.channelAdapter.updateJoinPayload(e)}async unsubscribe(e=this.timeout){return new Promise(t=>{this.channelAdapter.unsubscribe(e).receive("ok",()=>t("ok")).receive("timeout",()=>t("timed out")).receive("error",()=>t("error"))})}teardown(){this.channelAdapter.teardown()}async _fetchWithTimeout(e,t,r){let n=new AbortController,s=setTimeout(()=>n.abort(),r),a=await this.socket.fetch(e,Object.assign(Object.assign({},t),{signal:n.signal}));return clearTimeout(s),a}_on(e,t,r){var n;let s=e.toLocaleLowerCase(),a=t?.filter;if((a instanceof Ne||typeof a=="object"&&a!==null&&typeof a.build=="function")&&(t=Object.assign(Object.assign({},t),{filter:a.build()})),s===ge.POSTGRES_CHANGES&&((n=this.bindings[s])===null||n===void 0?void 0:n.find(h=>i.isSamePostgresFilter(h.filter,t))))return this.socket.log("error",`duplicate \`postgres_changes\` binding for ${this.topic} ignored`,t),this;let o=this.channelAdapter.on(e,r),c={type:s,filter:t,callback:r,ref:o};return this.bindings[s]?this.bindings[s].push(c):this.bindings[s]=[c],this._updateFilterMessage(),this}_onClose(e){this.channelAdapter.onClose(e)}_onError(e){this.channelAdapter.onError(e)}_updateFilterMessage(){this.channelAdapter.updateFilterBindings((e,t,r)=>{var n,s,a,o,c,l,h;let d=e.event.toLocaleLowerCase();if(this._notThisChannelEvent(d,r))return!1;let f=(n=this.bindings[d])===null||n===void 0?void 0:n.find(u=>u.ref===e.ref);if(!f)return!0;if(["broadcast","presence","postgres_changes"].includes(d))if("id"in f){let u=f.id,p=(s=f.filter)===null||s===void 0?void 0:s.event;return u&&((a=t.ids)===null||a===void 0?void 0:a.includes(u))&&(p==="*"||p?.toLocaleLowerCase()===((o=t.data)===null||o===void 0?void 0:o.type.toLocaleLowerCase()))}else{let u=(l=(c=f?.filter)===null||c===void 0?void 0:c.event)===null||l===void 0?void 0:l.toLocaleLowerCase();return u==="*"||u===((h=t?.event)===null||h===void 0?void 0:h.toLocaleLowerCase())}else return f.type.toLocaleLowerCase()===d})}_notThisChannelEvent(e,t){let{close:r,error:n,leave:s,join:a}=Tt;return t&&[r,n,s,a].includes(e)&&t!==this.joinPush.ref}_updateFilterTransform(){this.channelAdapter.updatePayloadTransform((e,t,r)=>{if(typeof t=="object"&&"ids"in t){let n=t.data,{schema:s,table:a,commit_timestamp:o,type:c,errors:l}=n;return Object.assign(Object.assign({},{schema:s,table:a,commit_timestamp:o,eventType:c,new:{},old:{},errors:l}),this._getPayloadRecords(n))}return t})}copyBindings(e){if(this.joinedOnce)throw new Error("cannot copy bindings into joined channel");for(let t in e.bindings)for(let r of e.bindings[t])this._on(r.type,r.filter,r.callback)}static isFilterValueEqual(e,t){return(e??void 0)===(t??void 0)}static isSamePostgresFilter(e,t){var r,n,s,a;let o=(n=(r=e?.select)===null||r===void 0?void 0:r.join())!==null&&n!==void 0?n:void 0,c=(a=(s=t?.select)===null||s===void 0?void 0:s.join())!==null&&a!==void 0?a:void 0;return e?.event===t?.event&&i.isFilterValueEqual(e?.schema,t?.schema)&&i.isFilterValueEqual(e?.table,t?.table)&&i.isFilterValueEqual(e?.filter,t?.filter)&&o===c}_getPayloadRecords(e){let t={new:{},old:{}};return(e.type==="INSERT"||e.type==="UPDATE")&&(t.new=ni(e.columns,e.record)),(e.type==="UPDATE"||e.type==="DELETE")&&(t.old=ni(e.columns,e.old_record)),t}};var tt=class{constructor(e,t){this.socket=new rr(e,t)}get timeout(){return this.socket.timeout}get endPoint(){return this.socket.endPoint}get transport(){return this.socket.transport}get heartbeatIntervalMs(){return this.socket.heartbeatIntervalMs}get heartbeatCallback(){return this.socket.heartbeatCallback}set heartbeatCallback(e){this.socket.heartbeatCallback=e}get heartbeatTimer(){return this.socket.heartbeatTimer}get pendingHeartbeatRef(){return this.socket.pendingHeartbeatRef}get reconnectTimer(){return this.socket.reconnectTimer}get vsn(){return this.socket.vsn}get encode(){return this.socket.encode}get decode(){return this.socket.decode}get reconnectAfterMs(){return this.socket.reconnectAfterMs}get sendBuffer(){return this.socket.sendBuffer}get stateChangeCallbacks(){return this.socket.stateChangeCallbacks}connect(){this.socket.connect()}disconnect(e,t,r,n=1e4){return new Promise(s=>{setTimeout(()=>s("timeout"),n),this.socket.disconnect(()=>{e(),s("ok")},t,r)})}push(e){this.socket.push(e)}log(e,t,r){this.socket.log(e,t,r)}hasLogger(){return this.socket.hasLogger()}makeRef(){return this.socket.makeRef()}onOpen(e){this.socket.onOpen(e)}onClose(e){this.socket.onClose(e)}onError(e){this.socket.onError(e)}onMessage(e){this.socket.onMessage(e)}isConnected(){return this.socket.isConnected()}isConnecting(){return this.socket.connectionState()==Ye.connecting}isDisconnecting(){return this.socket.connectionState()==Ye.closing}connectionState(){return this.socket.connectionState()}endPointURL(){return this.socket.endPointURL()}sendHeartbeat(){this.socket.sendHeartbeat()}getSocket(){return this.socket}};var or={HEARTBEAT_INTERVAL:25e3,RECONNECT_DELAY:10,HEARTBEAT_TIMEOUT_FALLBACK:100},rs=[1e3,2e3,5e3,1e4],ns=1e4;function ss(){let i=new Map;return{get length(){return i.size},clear(){i.clear()},getItem(e){return i.has(e)?i.get(e):null},key(e){var t;return(t=Array.from(i.keys())[e])!==null&&t!==void 0?t:null},removeItem(e){i.delete(e)},setItem(e,t){i.set(e,String(t))}}}function as(){try{if(typeof globalThis<"u"&&globalThis.sessionStorage)return globalThis.sessionStorage}catch{}return ss()}var os=`
  addEventListener("message", (e) => {
    if (e.data.event === "start") {
      setInterval(() => postMessage({ event: "keepAlive" }), e.data.interval);
    }
  });`,Ue=class{get endPoint(){return this.socketAdapter.endPoint}get timeout(){return this.socketAdapter.timeout}get transport(){return this.socketAdapter.transport}get heartbeatCallback(){return this.socketAdapter.heartbeatCallback}get heartbeatIntervalMs(){return this.socketAdapter.heartbeatIntervalMs}get heartbeatTimer(){return this.worker?this._workerHeartbeatTimer:this.socketAdapter.heartbeatTimer}get pendingHeartbeatRef(){return this.worker?this._pendingWorkerHeartbeatRef:this.socketAdapter.pendingHeartbeatRef}get reconnectTimer(){return this.socketAdapter.reconnectTimer}get vsn(){return this.socketAdapter.vsn}get encode(){return this.socketAdapter.encode}get decode(){return this.socketAdapter.decode}get reconnectAfterMs(){return this.socketAdapter.reconnectAfterMs}get sendBuffer(){return this.socketAdapter.sendBuffer}get stateChangeCallbacks(){return this.socketAdapter.stateChangeCallbacks}constructor(e,t){var r;if(this.channels=new Array,this.accessTokenValue=null,this.accessToken=null,this.apiKey=null,this.httpEndpoint="",this.headers={},this.params={},this.ref=0,this.serializer=new Qe,this._manuallySetToken=!1,this._authPromise=null,this._authGeneration=0,this._workerHeartbeatTimer=void 0,this._pendingWorkerHeartbeatRef=null,this._pendingDisconnectTimer=null,this._disconnectOnEmptyChannelsAfterMs=0,this._resolveFetch=s=>s?(...a)=>s(...a):(...a)=>fetch(...a),!(!((r=t?.params)===null||r===void 0)&&r.apikey))throw new Error("API key is required to connect to Realtime");this.apiKey=t.params.apikey;let n=this._initializeOptions(t);this.socketAdapter=new tt(e,n),this.httpEndpoint=St(e),this.fetch=this._resolveFetch(t?.fetch)}connect(){if(!(this.isConnecting()||this.isDisconnecting()||this.isConnected())){this.accessToken&&!this._authPromise&&this._setAuthSafely("connect"),this._setupConnectionHandlers();try{this.socketAdapter.connect()}catch(e){let t=e.message;throw new Error(`WebSocket not available: ${t}`)}this._handleNodeJsRaceCondition()}}endpointURL(){return this.socketAdapter.endPointURL()}async disconnect(e,t){return this._cancelPendingDisconnect(),this.isDisconnecting()?"ok":await this.socketAdapter.disconnect(()=>{clearInterval(this._workerHeartbeatTimer),this._terminateWorker()},e,t)}getChannels(){return this.channels}async removeChannel(e){let t=await e.unsubscribe();return t==="ok"&&e.teardown(),t}async removeAllChannels(){let e=this.channels.map(async r=>{let n=await r.unsubscribe();return r.teardown(),n}),t=await Promise.all(e);return await this.disconnect(),t}log(e,t,r){this.socketAdapter.log(e,t,r)}hasLogger(){return this.socketAdapter.hasLogger()}connectionState(){return this.socketAdapter.connectionState()||Ye.closed}isConnected(){return this.socketAdapter.isConnected()}isConnecting(){return this.socketAdapter.isConnecting()}isDisconnecting(){return this.socketAdapter.isDisconnecting()}channel(e,t={config:{}}){let r=`realtime:${e}`,n=this.getChannels().find(s=>s.topic===r);if(n)return n;{let s=new He(`realtime:${e}`,t,this);return this._cancelPendingDisconnect(),this.channels.push(s),s}}push(e){this.socketAdapter.push(e)}async setAuth(e=null){let t=++this._authGeneration,r=this._performAuth(e,t);t===this._authGeneration&&(this._authPromise=r);try{await r}finally{this._authPromise===r&&(this._authPromise=null)}}_isManualToken(){return this._manuallySetToken}async sendHeartbeat(){this.socketAdapter.sendHeartbeat()}onHeartbeat(e){this.socketAdapter.heartbeatCallback=this._wrapHeartbeatCallback(e)}_makeRef(){return this.socketAdapter.makeRef()}_remove(e){this.channels=this.channels.filter(t=>t.topic!==e.topic),this.channels.length===0&&(this.log("transport","no channels remaining, scheduling disconnect"),this._schedulePendingDisconnect())}_schedulePendingDisconnect(){if(this._cancelPendingDisconnect(),this._disconnectOnEmptyChannelsAfterMs===0){this.log("transport","disconnecting immediately - no channels"),this.disconnect();return}this._pendingDisconnectTimer=setTimeout(()=>{this._pendingDisconnectTimer=null,this.channels.length===0&&(this.log("transport","deferred disconnect fired - no channels, disconnecting"),this.disconnect())},this._disconnectOnEmptyChannelsAfterMs),this.log("transport",`deferred disconnect scheduled in ${this._disconnectOnEmptyChannelsAfterMs}ms`)}_cancelPendingDisconnect(){this._pendingDisconnectTimer!==null&&(this.log("transport","pending disconnect cancelled - channel activity detected"),clearTimeout(this._pendingDisconnectTimer),this._pendingDisconnectTimer=null)}async _performAuth(e,t){let r,n=!1;if(e)r=e,n=!0;else if(this.accessToken)try{r=await this.accessToken()}catch(s){this.log("error","Error fetching access token from callback",s),r=this.accessTokenValue}else r=this.accessTokenValue;t===this._authGeneration&&(this.accessToken?this._manuallySetToken=!1:n&&(this._manuallySetToken=!0),this.accessTokenValue!=r&&(this.accessTokenValue=r,this.channels.forEach(s=>{let a={access_token:r,version:Ji};s.updateJoinPayload(a),s.joinedOnce&&s.channelAdapter.isJoined()&&s.channelAdapter.push(Tt.access_token,{access_token:r})})))}async _waitForAuthIfNeeded(){this._authPromise&&await this._authPromise}_setAuthSafely(e="general"){this._isManualToken()||this.setAuth().catch(t=>{this.log("error",`Error setting auth in ${e}`,t)})}_setupConnectionHandlers(){this.socketAdapter.onOpen(()=>{(this._authPromise||(this.accessToken&&!this.accessTokenValue?this.setAuth():Promise.resolve())).catch(t=>{this.log("error","error waiting for auth on connect",t)}),this.worker&&!this.workerRef&&this._startWorkerHeartbeat()}),this.socketAdapter.onClose(()=>{this.worker&&this.workerRef&&this._terminateWorker()}),this.socketAdapter.onMessage(e=>{e.ref&&e.ref===this._pendingWorkerHeartbeatRef&&(this._pendingWorkerHeartbeatRef=null)})}_handleNodeJsRaceCondition(){this.socketAdapter.isConnected()&&this.socketAdapter.getSocket().onConnOpen()}_wrapHeartbeatCallback(e){return(t,r)=>{t!=="disconnected"&&(t=="sent"&&this._setAuthSafely(),e&&e(t,r))}}_startWorkerHeartbeat(){this.workerUrl?this.log("worker",`starting worker for from ${this.workerUrl}`):this.log("worker","starting default worker");let e=this._workerObjectUrl(this.workerUrl);this.workerRef=new Worker(e),this.workerRef.onerror=t=>{this.log("worker","worker error",t.message),this._terminateWorker(),this.disconnect()},this.workerRef.onmessage=t=>{t.data.event==="keepAlive"&&this.sendHeartbeat()},this.workerRef.postMessage({event:"start",interval:this.heartbeatIntervalMs})}_terminateWorker(){this.workerRef&&(this.log("worker","terminating worker"),this.workerRef.terminate(),this.workerRef=void 0)}_workerObjectUrl(e){let t;if(e)t=e;else{let r=new Blob([os],{type:"application/javascript"});t=URL.createObjectURL(r)}return t}_initializeOptions(e){var t,r,n,s,a,o,c,l,h,d,f,u;this.worker=(t=e?.worker)!==null&&t!==void 0?t:!1,this.accessToken=(r=e?.accessToken)!==null&&r!==void 0?r:null;let p={};p.timeout=(n=e?.timeout)!==null&&n!==void 0?n:Zi,p.heartbeatIntervalMs=(s=e?.heartbeatIntervalMs)!==null&&s!==void 0?s:or.HEARTBEAT_INTERVAL,this._disconnectOnEmptyChannelsAfterMs=(a=e?.disconnectOnEmptyChannelsAfterMs)!==null&&a!==void 0?a:2*((o=e?.heartbeatIntervalMs)!==null&&o!==void 0?o:or.HEARTBEAT_INTERVAL),p.transport=(c=e?.transport)!==null&&c!==void 0?c:ti.getWebSocketConstructor(),p.params=e?.params,p.logger=e?.logger,p.heartbeatCallback=this._wrapHeartbeatCallback(e?.heartbeatCallback),p.sessionStorage=(l=e?.sessionStorage)!==null&&l!==void 0?l:as(),p.reconnectAfterMs=(h=e?.reconnectAfterMs)!==null&&h!==void 0?h:(v=>rs[v-1]||ns);let m,y,g=(d=e?.vsn)!==null&&d!==void 0?d:Qi;switch(g){case Yi:m=(v,w)=>w(JSON.stringify(v)),y=(v,w)=>w(JSON.parse(v));break;case ii:m=this.serializer.encode.bind(this.serializer),y=this.serializer.decode.bind(this.serializer);break;default:throw new Error(`Unsupported serializer version: ${p.vsn}`)}if(p.vsn=g,p.encode=(f=e?.encode)!==null&&f!==void 0?f:m,p.decode=(u=e?.decode)!==null&&u!==void 0?u:y,p.beforeReconnect=this._reconnectAuth.bind(this),(e?.logLevel||e?.log_level)&&(this.logLevel=e.logLevel||e.log_level,p.params=Object.assign(Object.assign({},p.params),{log_level:this.logLevel})),this.worker){if(typeof window<"u"&&!window.Worker)throw new Error("Web Worker is not supported");this.workerUrl=e?.workerUrl,p.autoSendHeartbeat=!this.worker}return p}async _reconnectAuth(){await this._waitForAuthIfNeeded(),this.isConnected()||this.connect()}};var it=class extends Error{constructor(i,e){super(i),this.name="IcebergError",this.status=e.status,this.icebergType=e.icebergType,this.icebergCode=e.icebergCode,this.details=e.details,this.isCommitStateUnknown=e.icebergType==="CommitStateUnknownException"||[500,502,504].includes(e.status)&&e.icebergType?.includes("CommitState")===!0}isNotFound(){return this.status===404}isConflict(){return this.status===409}isAuthenticationTimeout(){return this.status===419}};function cs(i,e,t){let r=new URL(e,i);if(t)for(let[n,s]of Object.entries(t))s!==void 0&&r.searchParams.set(n,s);return r.toString()}async function ls(i){return!i||i.type==="none"?{}:i.type==="bearer"?{Authorization:`Bearer ${i.token}`}:i.type==="header"?{[i.name]:i.value}:i.type==="custom"?await i.getHeaders():{}}function hs(i){let e=i.fetchImpl??globalThis.fetch;return{async request({method:t,path:r,query:n,body:s,headers:a}){let o=cs(i.baseUrl,r,n),c=await ls(i.auth),l=await e(o,{method:t,headers:{...s?{"Content-Type":"application/json"}:{},...c,...a},body:s?JSON.stringify(s):void 0}),h=await l.text(),d=(l.headers.get("content-type")||"").includes("application/json"),f=d&&h?JSON.parse(h):h;if(!l.ok){let u=d?f:void 0,p=u?.error;throw new it(p?.message??`Request failed with status ${l.status}`,{status:l.status,icebergType:p?.type,icebergCode:p?.code,details:u})}return{status:l.status,headers:l.headers,data:f}}}}function Pt(i){return i.join("")}var ds=class{constructor(i,e=""){this.client=i,this.prefix=e}async listNamespaces(i){let e=i?{parent:Pt(i.namespace)}:void 0;return(await this.client.request({method:"GET",path:`${this.prefix}/namespaces`,query:e})).data.namespaces.map(r=>({namespace:r}))}async createNamespace(i,e){let t={namespace:i.namespace,properties:e?.properties};return(await this.client.request({method:"POST",path:`${this.prefix}/namespaces`,body:t})).data}async dropNamespace(i){await this.client.request({method:"DELETE",path:`${this.prefix}/namespaces/${Pt(i.namespace)}`})}async loadNamespaceMetadata(i){return{properties:(await this.client.request({method:"GET",path:`${this.prefix}/namespaces/${Pt(i.namespace)}`})).data.properties}}async namespaceExists(i){try{return await this.client.request({method:"HEAD",path:`${this.prefix}/namespaces/${Pt(i.namespace)}`}),!0}catch(e){if(e instanceof it&&e.status===404)return!1;throw e}}async createNamespaceIfNotExists(i,e){try{return await this.createNamespace(i,e)}catch(t){if(t instanceof it&&t.status===409)return;throw t}}};function De(i){return i.join("")}var us=class{constructor(i,e="",t){this.client=i,this.prefix=e,this.accessDelegation=t}async listTables(i){return(await this.client.request({method:"GET",path:`${this.prefix}/namespaces/${De(i.namespace)}/tables`})).data.identifiers}async createTable(i,e){let t={};return this.accessDelegation&&(t["X-Iceberg-Access-Delegation"]=this.accessDelegation),(await this.client.request({method:"POST",path:`${this.prefix}/namespaces/${De(i.namespace)}/tables`,body:e,headers:t})).data.metadata}async updateTable(i,e){let t=await this.client.request({method:"POST",path:`${this.prefix}/namespaces/${De(i.namespace)}/tables/${i.name}`,body:e});return{"metadata-location":t.data["metadata-location"],metadata:t.data.metadata}}async dropTable(i,e){await this.client.request({method:"DELETE",path:`${this.prefix}/namespaces/${De(i.namespace)}/tables/${i.name}`,query:{purgeRequested:String(e?.purge??!1)}})}async loadTable(i){let e={};return this.accessDelegation&&(e["X-Iceberg-Access-Delegation"]=this.accessDelegation),(await this.client.request({method:"GET",path:`${this.prefix}/namespaces/${De(i.namespace)}/tables/${i.name}`,headers:e})).data.metadata}async tableExists(i){let e={};this.accessDelegation&&(e["X-Iceberg-Access-Delegation"]=this.accessDelegation);try{return await this.client.request({method:"HEAD",path:`${this.prefix}/namespaces/${De(i.namespace)}/tables/${i.name}`,headers:e}),!0}catch(t){if(t instanceof it&&t.status===404)return!1;throw t}}async createTableIfNotExists(i,e){try{return await this.createTable(i,e)}catch(t){if(t instanceof it&&t.status===409)return await this.loadTable({namespace:i.namespace,name:e.name});throw t}}},cr=class{constructor(i){let e="v1";i.catalogName&&(e+=`/${i.catalogName}`);let t=i.baseUrl.endsWith("/")?i.baseUrl:`${i.baseUrl}/`;this.client=hs({baseUrl:t,auth:i.auth,fetchImpl:i.fetch}),this.accessDelegation=i.accessDelegation?.join(","),this.namespaceOps=new ds(this.client,e),this.tableOps=new us(this.client,e,this.accessDelegation)}async listNamespaces(i){return this.namespaceOps.listNamespaces(i)}async createNamespace(i,e){return this.namespaceOps.createNamespace(i,e)}async dropNamespace(i){await this.namespaceOps.dropNamespace(i)}async loadNamespaceMetadata(i){return this.namespaceOps.loadNamespaceMetadata(i)}async listTables(i){return this.tableOps.listTables(i)}async createTable(i,e){return this.tableOps.createTable(i,e)}async updateTable(i,e){return this.tableOps.updateTable(i,e)}async dropTable(i,e){await this.tableOps.dropTable(i,e)}async loadTable(i){return this.tableOps.loadTable(i)}async namespaceExists(i){return this.namespaceOps.namespaceExists(i)}async tableExists(i){return this.tableOps.tableExists(i)}async createNamespaceIfNotExists(i,e){return this.namespaceOps.createNamespaceIfNotExists(i,e)}async createTableIfNotExists(i,e){return this.tableOps.createTableIfNotExists(i,e)}};function nt(i){"@babel/helpers - typeof";return nt=typeof Symbol=="function"&&typeof Symbol.iterator=="symbol"?function(e){return typeof e}:function(e){return e&&typeof Symbol=="function"&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e},nt(i)}function fs(i,e){if(nt(i)!="object"||!i)return i;var t=i[Symbol.toPrimitive];if(t!==void 0){var r=t.call(i,e||"default");if(nt(r)!="object")return r;throw new TypeError("@@toPrimitive must return a primitive value.")}return(e==="string"?String:Number)(i)}function ps(i){var e=fs(i,"string");return nt(e)=="symbol"?e:e+""}function gs(i,e,t){return(e=ps(e))in i?Object.defineProperty(i,e,{value:t,enumerable:!0,configurable:!0,writable:!0}):i[e]=t,i}function lr(i,e){var t=Object.keys(i);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(i);e&&(r=r.filter(function(n){return Object.getOwnPropertyDescriptor(i,n).enumerable})),t.push.apply(t,r)}return t}function E(i){for(var e=1;e<arguments.length;e++){var t=arguments[e]!=null?arguments[e]:{};e%2?lr(Object(t),!0).forEach(function(r){gs(i,r,t[r])}):Object.getOwnPropertyDescriptors?Object.defineProperties(i,Object.getOwnPropertyDescriptors(t)):lr(Object(t)).forEach(function(r){Object.defineProperty(i,r,Object.getOwnPropertyDescriptor(t,r))})}return i}var jt=class extends Error{constructor(i,e="storage",t,r){super(i),this.__isStorageError=!0,this.namespace=e,this.name=e==="vectors"?"StorageVectorsError":"StorageError",this.status=t,this.statusCode=r}toJSON(){return{name:this.name,message:this.message,status:this.status,statusCode:this.statusCode}}};function $t(i){return typeof i=="object"&&i!==null&&"__isStorageError"in i}var Lt=class extends jt{constructor(i,e,t,r="storage",n){super(i,r,e,t),this.name=r==="vectors"?"StorageVectorsApiError":"StorageApiError",this.status=e,this.statusCode=t,this.code=n}toJSON(){return E(E({},super.toJSON()),{},{code:this.code})}},ur=class extends jt{constructor(i,e,t="storage"){super(i,t),this.name=t==="vectors"?"StorageVectorsUnknownError":"StorageUnknownError",this.originalError=e}};function Ot(i,e,t){let r=E({},i),n=e.toLowerCase();for(let s of Object.keys(r))s.toLowerCase()===n&&delete r[s];return r[n]=t,r}function ms(i){let e={};for(let[t,r]of Object.entries(i))e[t.toLowerCase()]=r;return e}var ys=i=>i?(...e)=>i(...e):(...e)=>fetch(...e),vs=i=>{if(typeof i!="object"||i===null)return!1;let e=Object.getPrototypeOf(i);return(e===null||e===Object.prototype||Object.getPrototypeOf(e)===null)&&!(Symbol.toStringTag in i)&&!(Symbol.iterator in i)},hi=i=>{if(Array.isArray(i))return i.map(t=>hi(t));if(typeof i=="function"||i!==Object(i))return i;let e={};return Object.entries(i).forEach(([t,r])=>{let n=t.replace(/([-_][a-z])/gi,s=>s.toUpperCase().replace(/[-_]/g,""));e[n]=hi(r)}),e},ws=i=>!i||typeof i!="string"||i.length===0||i.length>100||i.trim()!==i||i.includes("/")||i.includes("\\")?!1:/^[\w!.\*'() &$@=;:+,?-]+$/.test(i),fr=i=>i.split("/").map(encodeURIComponent).join("/"),hr=i=>{if(typeof i=="object"&&i!==null){let e=i;if(typeof e.msg=="string")return e.msg;if(typeof e.message=="string")return e.message;if(typeof e.error_description=="string")return e.error_description;if(typeof e.error=="string")return e.error;if(typeof e.error=="object"&&e.error!==null){let t=e.error;if(typeof t.message=="string")return t.message}}return JSON.stringify(i)},bs=async(i,e,t,r)=>{if(i!==null&&typeof i=="object"&&"json"in i&&typeof i.json=="function"){let n=i,s=parseInt(String(n.status),10);Number.isFinite(s)||(s=500),n.json().then(a=>{let o=a?.statusCode||a?.code||s+"";e(new Lt(hr(a),s,o,r,a?.code))}).catch(()=>{let a=s+"";e(new Lt(n.statusText||`HTTP ${s} error`,s,a,r))})}else e(new ur(hr(i),i,r))},_s=(i,e,t,r)=>{let n={method:i,headers:e?.headers||{}};if(i==="GET"||i==="HEAD"||!r)return E(E({},n),t);if(vs(r)){var s;let a=e?.headers||{},o;for(let[c,l]of Object.entries(a))c.toLowerCase()==="content-type"&&(o=l);n.headers=Ot(a,"Content-Type",(s=o)!==null&&s!==void 0?s:"application/json"),n.body=JSON.stringify(r)}else n.body=r;return e?.duplex&&(n.duplex=e.duplex),E(E({},n),t)};async function rt(i,e,t,r,n,s,a){return new Promise((o,c)=>{i(t,_s(e,r,n,s)).then(l=>{if(!l.ok)throw l;if(r?.noResolveJson)return l;if(a==="vectors"){let h=l.headers.get("content-type");if(l.headers.get("content-length")==="0"||l.status===204)return{};if(!h||!h.includes("application/json"))return{}}return l.json()}).then(l=>o(l)).catch(l=>bs(l,c,r,a))})}function pr(i="storage"){return{get:async(e,t,r,n)=>rt(e,"GET",t,r,n,void 0,i),post:async(e,t,r,n,s)=>rt(e,"POST",t,n,s,r,i),put:async(e,t,r,n,s)=>rt(e,"PUT",t,n,s,r,i),head:async(e,t,r,n)=>rt(e,"HEAD",t,E(E({},r),{},{noResolveJson:!0}),n,void 0,i),remove:async(e,t,r,n,s)=>rt(e,"DELETE",t,n,s,r,i)}}var xs=pr("storage"),{get:st,post:ee,put:di,head:ks,remove:at}=xs,V=pr("vectors"),ze=class{constructor(i,e={},t,r="storage"){this.shouldThrowOnError=!1,this.url=i,this.headers=ms(e),this.fetch=ys(t),this.namespace=r}throwOnError(){return this.shouldThrowOnError=!0,this}setHeader(i,e){return this.headers=Ot(this.headers,i,e),this}async handleOperation(i){var e=this;try{return{data:await i(),error:null}}catch(t){if(e.shouldThrowOnError)throw t;if($t(t))return{data:null,error:t};throw t}}},gr;gr=Symbol.toStringTag;var Es=class{constructor(i,e){this.downloadFn=i,this.shouldThrowOnError=e,this[gr]="StreamDownloadBuilder",this.promise=null}then(i,e){return this.getPromise().then(i,e)}catch(i){return this.getPromise().catch(i)}finally(i){return this.getPromise().finally(i)}getPromise(){return this.promise||(this.promise=this.execute()),this.promise}async execute(){var i=this;try{return{data:(await i.downloadFn()).body,error:null}}catch(e){if(i.shouldThrowOnError)throw e;if($t(e))return{data:null,error:e};throw e}}},mr;mr=Symbol.toStringTag;var Ts=class{constructor(i,e){this.downloadFn=i,this.shouldThrowOnError=e,this[mr]="BlobDownloadBuilder",this.promise=null}asStream(){return new Es(this.downloadFn,this.shouldThrowOnError)}then(i,e){return this.getPromise().then(i,e)}catch(i){return this.getPromise().catch(i)}finally(i){return this.getPromise().finally(i)}getPromise(){return this.promise||(this.promise=this.execute()),this.promise}async execute(){var i=this;try{return{data:await(await i.downloadFn()).blob(),error:null}}catch(e){if(i.shouldThrowOnError)throw e;if($t(e))return{data:null,error:e};throw e}}},li={limit:100,offset:0,sortBy:{column:"name",order:"asc"}},dr={cacheControl:"3600",contentType:"text/plain;charset=UTF-8",upsert:!1},Ss=class extends ze{constructor(i,e={},t,r){super(i,e,r,"storage"),this.bucketId=t}async uploadOrUpdate(i,e,t,r){var n=this;return n.handleOperation(async()=>{let s,a=E(E({},dr),r),o=E(E({},n.headers),i==="POST"&&{"x-upsert":String(a.upsert)}),c=a.metadata;if(typeof Blob<"u"&&t instanceof Blob?(s=new FormData,s.append("cacheControl",a.cacheControl),c&&s.append("metadata",n.encodeMetadata(c)),s.append("",t)):typeof FormData<"u"&&t instanceof FormData?(s=t,s.has("cacheControl")||s.append("cacheControl",a.cacheControl),c&&!s.has("metadata")&&s.append("metadata",n.encodeMetadata(c))):(s=t,o["cache-control"]=`max-age=${a.cacheControl}`,o["content-type"]=a.contentType,c&&(o["x-metadata"]=n.toBase64(n.encodeMetadata(c))),(typeof ReadableStream<"u"&&s instanceof ReadableStream||s&&typeof s=="object"&&"pipe"in s&&typeof s.pipe=="function")&&!a.duplex&&(a.duplex="half")),r?.headers)for(let[f,u]of Object.entries(r.headers))o=Ot(o,f,u);let l=n._removeEmptyFolders(e),h=n._getFinalPath(l),d=await(i=="PUT"?di:ee)(n.fetch,`${n.url}/object/${h}`,s,E({headers:o},a?.duplex?{duplex:a.duplex}:{}));return{path:l,id:d.Id,fullPath:d.Key}})}async upload(i,e,t){return this.uploadOrUpdate("POST",i,e,t)}async uploadToSignedUrl(i,e,t,r){var n=this;let s=n._removeEmptyFolders(i),a=n._getFinalPath(s),o=new URL(n.url+`/object/upload/sign/${a}`);return o.searchParams.set("token",e),n.handleOperation(async()=>{let c,l=E(E({},dr),r),h=E(E({},n.headers),{"x-upsert":String(l.upsert)}),d=l.metadata;if(typeof Blob<"u"&&t instanceof Blob?(c=new FormData,c.append("cacheControl",l.cacheControl),d&&c.append("metadata",n.encodeMetadata(d)),c.append("",t)):typeof FormData<"u"&&t instanceof FormData?(c=t,c.has("cacheControl")||c.append("cacheControl",l.cacheControl),d&&!c.has("metadata")&&c.append("metadata",n.encodeMetadata(d))):(c=t,h["cache-control"]=`max-age=${l.cacheControl}`,h["content-type"]=l.contentType,d&&(h["x-metadata"]=n.toBase64(n.encodeMetadata(d))),(typeof ReadableStream<"u"&&c instanceof ReadableStream||c&&typeof c=="object"&&"pipe"in c&&typeof c.pipe=="function")&&!l.duplex&&(l.duplex="half")),r?.headers)for(let[f,u]of Object.entries(r.headers))h=Ot(h,f,u);return{path:s,fullPath:(await di(n.fetch,o.toString(),c,E({headers:h},l?.duplex?{duplex:l.duplex}:{}))).Key}})}async createSignedUploadUrl(i,e){var t=this;return t.handleOperation(async()=>{let r=t._getFinalPath(i),n=E({},t.headers);e?.upsert&&(n["x-upsert"]="true");let s=await ee(t.fetch,`${t.url}/object/upload/sign/${r}`,{},{headers:n}),a=new URL(t.url+s.url),o=a.searchParams.get("token");if(!o)throw new jt("No token returned by API");return{signedUrl:a.toString(),path:i,token:o}})}async update(i,e,t){return this.uploadOrUpdate("PUT",i,e,t)}async move(i,e,t){var r=this;return r.handleOperation(async()=>await ee(r.fetch,`${r.url}/object/move`,{bucketId:r.bucketId,sourceKey:i,destinationKey:e,destinationBucket:t?.destinationBucket},{headers:r.headers}))}async copy(i,e,t){var r=this;return r.handleOperation(async()=>({path:(await ee(r.fetch,`${r.url}/object/copy`,{bucketId:r.bucketId,sourceKey:i,destinationKey:e,destinationBucket:t?.destinationBucket},{headers:r.headers})).Key}))}async createSignedUrl(i,e,t){var r=this;return r.handleOperation(async()=>{let n=r._getFinalPath(i),s=typeof t?.transform=="object"&&t.transform!==null&&Object.keys(t.transform).length>0,a=await ee(r.fetch,`${r.url}/object/sign/${n}`,E({expiresIn:e},s?{transform:t.transform}:{}),{headers:r.headers}),o=new URLSearchParams;t?.download&&o.set("download",t.download===!0?"":t.download),t?.cacheNonce!=null&&o.set("cacheNonce",String(t.cacheNonce));let c=o.toString();return{signedUrl:encodeURI(`${r.url}${a.signedURL}${c?`&${c}`:""}`)}})}async createSignedUrls(i,e,t){var r=this;return r.handleOperation(async()=>{let n=await ee(r.fetch,`${r.url}/object/sign/${r.bucketId}`,{expiresIn:e,paths:i},{headers:r.headers}),s=new URLSearchParams;t?.download&&s.set("download",t.download===!0?"":t.download),t?.cacheNonce!=null&&s.set("cacheNonce",String(t.cacheNonce));let a=s.toString();return n.map(o=>E(E({},o),{},{signedUrl:o.signedURL?encodeURI(`${r.url}${o.signedURL}${a?`&${a}`:""}`):null}))})}download(i,e,t){let r=typeof e?.transform=="object"&&e.transform!==null&&Object.keys(e.transform).length>0?"render/image/authenticated":"object",n=new URLSearchParams;e?.transform&&this.applyTransformOptsToQuery(n,e.transform),e?.cacheNonce!=null&&n.set("cacheNonce",String(e.cacheNonce));let s=n.toString(),a=this._getFinalPath(i),o=()=>st(this.fetch,`${this.url}/${r}/${a}${s?`?${s}`:""}`,{headers:this.headers,noResolveJson:!0},t);return new Ts(o,this.shouldThrowOnError)}async info(i){var e=this;let t=e._getFinalPath(i);return e.handleOperation(async()=>hi(await st(e.fetch,`${e.url}/object/info/${t}`,{headers:e.headers})))}async exists(i){var e=this;let t=e._getFinalPath(i);try{return await ks(e.fetch,`${e.url}/object/${t}`,{headers:e.headers}),{data:!0,error:null}}catch(n){if(e.shouldThrowOnError)throw n;if($t(n)){var r;let s=n instanceof Lt?n.status:n instanceof ur?(r=n.originalError)===null||r===void 0?void 0:r.status:void 0;if(s!==void 0&&[400,404].includes(s))return{data:!1,error:n}}throw n}}getPublicUrl(i,e){let t=this._getFinalPath(i),r=new URLSearchParams;e?.download&&r.set("download",e.download===!0?"":e.download),e?.transform&&this.applyTransformOptsToQuery(r,e.transform),e?.cacheNonce!=null&&r.set("cacheNonce",String(e.cacheNonce));let n=r.toString(),s=typeof e?.transform=="object"&&e.transform!==null&&Object.keys(e.transform).length>0?"render/image":"object";return{data:{publicUrl:encodeURI(`${this.url}/${s}/public/${t}`)+(n?`?${n}`:"")}}}async remove(i){var e=this;return e.handleOperation(async()=>await at(e.fetch,`${e.url}/object/${e.bucketId}`,{prefixes:i},{headers:e.headers}))}async purgeCache(i,e,t){var r=this;return r.handleOperation(async()=>{let n=fr(r._getFinalPath(i)),s=new URLSearchParams;e?.transformations&&s.set("transformations","true");let a=s.toString();return await at(r.fetch,`${r.url}/cdn/${n}${a?`?${a}`:""}`,{},{headers:r.headers},t)})}async list(i,e,t){var r=this;return r.handleOperation(async()=>{let n=e?.sortBy?E(E({},li.sortBy),e.sortBy):li.sortBy,s=E(E(E({},li),e),{},{sortBy:n,prefix:i||""});return await ee(r.fetch,`${r.url}/object/list/${r.bucketId}`,s,{headers:r.headers},t)})}async listV2(i,e){var t=this;return t.handleOperation(async()=>{let r=E({},i);return await ee(t.fetch,`${t.url}/object/list-v2/${t.bucketId}`,r,{headers:t.headers},e)})}encodeMetadata(i){return JSON.stringify(i)}toBase64(i){return typeof Buffer<"u"?Buffer.from(i).toString("base64"):btoa(i)}_getFinalPath(i){return`${this.bucketId}/${i.replace(/^\/+/,"")}`}_removeEmptyFolders(i){return i.replace(/^\/|\/$/g,"").replace(/\/+/g,"/")}applyTransformOptsToQuery(i,e){return e.width&&i.set("width",e.width.toString()),e.height&&i.set("height",e.height.toString()),e.resize&&i.set("resize",e.resize),e.format&&i.set("format",e.format),e.quality&&i.set("quality",e.quality.toString()),i}},As="2.112.4",ot={"X-Client-Info":`storage-js/${As}`},Is=class extends ze{constructor(i,e={},t,r){let n=new URL(i);r?.useNewHostname&&/supabase\.(co|in|red)$/.test(n.hostname)&&!n.hostname.includes("storage.supabase.")&&(n.hostname=n.hostname.replace("supabase.","storage.supabase."));let s=n.href.replace(/\/$/,""),a=E(E({},ot),e);super(s,a,t,"storage")}async listBuckets(i){var e=this;return e.handleOperation(async()=>{let t=e.listBucketOptionsToQueryString(i);return await st(e.fetch,`${e.url}/bucket${t}`,{headers:e.headers})})}async getBucket(i){var e=this;return e.handleOperation(async()=>await st(e.fetch,`${e.url}/bucket/${i}`,{headers:e.headers}))}async createBucket(i,e={public:!1}){var t=this;return t.handleOperation(async()=>await ee(t.fetch,`${t.url}/bucket`,{id:i,name:i,type:e.type,public:e.public,file_size_limit:e.fileSizeLimit,allowed_mime_types:e.allowedMimeTypes},{headers:t.headers}))}async updateBucket(i,e){var t=this;return t.handleOperation(async()=>await di(t.fetch,`${t.url}/bucket/${i}`,{id:i,name:i,public:e.public,file_size_limit:e.fileSizeLimit,allowed_mime_types:e.allowedMimeTypes},{headers:t.headers}))}async emptyBucket(i){var e=this;return e.handleOperation(async()=>await ee(e.fetch,`${e.url}/bucket/${i}/empty`,{},{headers:e.headers}))}async deleteBucket(i){var e=this;return e.handleOperation(async()=>await at(e.fetch,`${e.url}/bucket/${i}`,{},{headers:e.headers}))}async purgeBucketCache(i,e,t){var r=this;return r.handleOperation(async()=>{let n=new URLSearchParams;e?.transformations&&n.set("transformations","true");let s=n.toString();return await at(r.fetch,`${r.url}/cdn/${fr(i)}${s?`?${s}`:""}`,{},{headers:r.headers},t)})}listBucketOptionsToQueryString(i){let e={};return i&&("limit"in i&&(e.limit=String(i.limit)),"offset"in i&&(e.offset=String(i.offset)),i.search&&(e.search=i.search),i.sortColumn&&(e.sortColumn=i.sortColumn),i.sortOrder&&(e.sortOrder=i.sortOrder)),Object.keys(e).length>0?"?"+new URLSearchParams(e).toString():""}},Cs=class extends ze{constructor(i,e={},t){let r=i.replace(/\/$/,""),n=E(E({},ot),e);super(r,n,t,"storage")}async createBucket(i){var e=this;return e.handleOperation(async()=>await ee(e.fetch,`${e.url}/bucket`,{name:i},{headers:e.headers}))}async listBuckets(i){var e=this;return e.handleOperation(async()=>{let t=new URLSearchParams;i?.limit!==void 0&&t.set("limit",i.limit.toString()),i?.offset!==void 0&&t.set("offset",i.offset.toString()),i?.sortColumn&&t.set("sortColumn",i.sortColumn),i?.sortOrder&&t.set("sortOrder",i.sortOrder),i?.search&&t.set("search",i.search);let r=t.toString(),n=r?`${e.url}/bucket?${r}`:`${e.url}/bucket`;return await st(e.fetch,n,{headers:e.headers})})}async deleteBucket(i){var e=this;return e.handleOperation(async()=>await at(e.fetch,`${e.url}/bucket/${i}`,{},{headers:e.headers}))}from(i){var e=this;if(!ws(i))throw new jt("Invalid bucket name: File, folder, and bucket names must follow AWS object key naming guidelines and should avoid the use of any other characters.");let t=new cr({baseUrl:this.url,catalogName:i,auth:{type:"custom",getHeaders:async()=>e.headers},fetch:this.fetch}),r=this.shouldThrowOnError;return new Proxy(t,{get(n,s){let a=n[s];return typeof a!="function"?a:async(...o)=>{try{return{data:await a.apply(n,o),error:null}}catch(c){if(r)throw c;return{data:null,error:c}}}}})}},Rs=class extends ze{constructor(i,e={},t){let r=i.replace(/\/$/,""),n=E(E({},ot),{},{"Content-Type":"application/json"},e);super(r,n,t,"vectors")}async createIndex(i){var e=this;return e.handleOperation(async()=>await V.post(e.fetch,`${e.url}/CreateIndex`,i,{headers:e.headers})||{})}async getIndex(i,e){var t=this;return t.handleOperation(async()=>await V.post(t.fetch,`${t.url}/GetIndex`,{vectorBucketName:i,indexName:e},{headers:t.headers}))}async listIndexes(i){var e=this;return e.handleOperation(async()=>await V.post(e.fetch,`${e.url}/ListIndexes`,i,{headers:e.headers}))}async deleteIndex(i,e){var t=this;return t.handleOperation(async()=>await V.post(t.fetch,`${t.url}/DeleteIndex`,{vectorBucketName:i,indexName:e},{headers:t.headers})||{})}},Ps=class extends ze{constructor(i,e={},t){let r=i.replace(/\/$/,""),n=E(E({},ot),{},{"Content-Type":"application/json"},e);super(r,n,t,"vectors")}async putVectors(i){var e=this;if(i.vectors.length<1||i.vectors.length>500)throw new Error("Vector batch size must be between 1 and 500 items");return e.handleOperation(async()=>await V.post(e.fetch,`${e.url}/PutVectors`,i,{headers:e.headers})||{})}async getVectors(i){var e=this;return e.handleOperation(async()=>await V.post(e.fetch,`${e.url}/GetVectors`,i,{headers:e.headers}))}async listVectors(i){var e=this;if(i.segmentCount!==void 0){if(i.segmentCount<1||i.segmentCount>16)throw new Error("segmentCount must be between 1 and 16");if(i.segmentIndex!==void 0&&(i.segmentIndex<0||i.segmentIndex>=i.segmentCount))throw new Error(`segmentIndex must be between 0 and ${i.segmentCount-1}`)}return e.handleOperation(async()=>await V.post(e.fetch,`${e.url}/ListVectors`,i,{headers:e.headers}))}async queryVectors(i){var e=this;return e.handleOperation(async()=>await V.post(e.fetch,`${e.url}/QueryVectors`,i,{headers:e.headers}))}async deleteVectors(i){var e=this;if(i.keys.length<1||i.keys.length>500)throw new Error("Keys batch size must be between 1 and 500 items");return e.handleOperation(async()=>await V.post(e.fetch,`${e.url}/DeleteVectors`,i,{headers:e.headers})||{})}},Ls=class extends ze{constructor(i,e={},t){let r=i.replace(/\/$/,""),n=E(E({},ot),{},{"Content-Type":"application/json"},e);super(r,n,t,"vectors")}async createBucket(i){var e=this;return e.handleOperation(async()=>await V.post(e.fetch,`${e.url}/CreateVectorBucket`,{vectorBucketName:i},{headers:e.headers})||{})}async getBucket(i){var e=this;return e.handleOperation(async()=>await V.post(e.fetch,`${e.url}/GetVectorBucket`,{vectorBucketName:i},{headers:e.headers}))}async listBuckets(i={}){var e=this;return e.handleOperation(async()=>await V.post(e.fetch,`${e.url}/ListVectorBuckets`,i,{headers:e.headers}))}async deleteBucket(i){var e=this;return e.handleOperation(async()=>await V.post(e.fetch,`${e.url}/DeleteVectorBucket`,{vectorBucketName:i},{headers:e.headers})||{})}},Os=class extends Ls{constructor(i,e={}){super(i,e.headers||{},e.fetch)}from(i){return new js(this.url,this.headers,i,this.fetch)}async createBucket(i){var e=()=>super.createBucket,t=this;return e().call(t,i)}async getBucket(i){var e=()=>super.getBucket,t=this;return e().call(t,i)}async listBuckets(i={}){var e=()=>super.listBuckets,t=this;return e().call(t,i)}async deleteBucket(i){var e=()=>super.deleteBucket,t=this;return e().call(t,i)}},js=class extends Rs{constructor(i,e,t,r){super(i,e,r),this.vectorBucketName=t}async createIndex(i){var e=()=>super.createIndex,t=this;return e().call(t,E(E({},i),{},{vectorBucketName:t.vectorBucketName}))}async listIndexes(i={}){var e=()=>super.listIndexes,t=this;return e().call(t,E(E({},i),{},{vectorBucketName:t.vectorBucketName}))}async getIndex(i){var e=()=>super.getIndex,t=this;return e().call(t,t.vectorBucketName,i)}async deleteIndex(i){var e=()=>super.deleteIndex,t=this;return e().call(t,t.vectorBucketName,i)}index(i){return new $s(this.url,this.headers,this.vectorBucketName,i,this.fetch)}},$s=class extends Ps{constructor(i,e,t,r,n){super(i,e,n),this.vectorBucketName=t,this.indexName=r}async putVectors(i){var e=()=>super.putVectors,t=this;return e().call(t,E(E({},i),{},{vectorBucketName:t.vectorBucketName,indexName:t.indexName}))}async getVectors(i){var e=()=>super.getVectors,t=this;return e().call(t,E(E({},i),{},{vectorBucketName:t.vectorBucketName,indexName:t.indexName}))}async listVectors(i={}){var e=()=>super.listVectors,t=this;return e().call(t,E(E({},i),{},{vectorBucketName:t.vectorBucketName,indexName:t.indexName}))}async queryVectors(i){var e=()=>super.queryVectors,t=this;return e().call(t,E(E({},i),{},{vectorBucketName:t.vectorBucketName,indexName:t.indexName}))}async deleteVectors(i){var e=()=>super.deleteVectors,t=this;return e().call(t,E(E({},i),{},{vectorBucketName:t.vectorBucketName,indexName:t.indexName}))}},yr=class extends Is{constructor(i,e={},t,r){super(i,e,t,r)}from(i){return new Ss(this.url,this.headers,i,this.fetch)}get vectors(){return new Os(this.url+"/vector",{headers:this.headers,fetch:this.fetch})}get analytics(){return new Cs(this.url+"/iceberg",this.headers,this.fetch)}};var Mt="2.112.4";var oe=30*1e3,qe=3,Bt=qe*oe,vr=2*oe,wr="http://localhost:9999",br="supabase.auth.token";var _r={"X-Client-Info":`gotrue-js/${Mt}`};var ct="X-Supabase-Api-Version",ui={"2024-01-01":{timestamp:Date.parse("2024-01-01T00:00:00.0Z"),name:"2024-01-01"}},xr=/^([a-z0-9_-]{4})*($|[a-z0-9_-]{3}$|[a-z0-9_-]{2}$)$/i,ue="sb_flow_id",kr=5,Er=600*1e3;var me=class extends Error{constructor(e,t,r){super(e),this.__isAuthError=!0,this.name="AuthError",this.status=t,this.code=r}toJSON(){return{name:this.name,message:this.message,status:this.status,code:this.code}}};function b(i){return typeof i=="object"&&i!==null&&"__isAuthError"in i}var Nt=class extends me{constructor(e,t,r){super(e,t,r),this.name="AuthApiError",this.status=t,this.code=r}};function fi(i){return b(i)&&i.name==="AuthApiError"}var z=class extends me{constructor(e,t){super(e),this.name="AuthUnknownError",this.originalError=t}},J=class extends me{constructor(e,t,r,n){super(e,r,n),this.name=t,this.status=r}},$=class extends J{constructor(){super("Auth session missing!","AuthSessionMissingError",400,void 0)}};function ut(i){return b(i)&&i.name==="AuthSessionMissingError"}var fe=class extends J{constructor(){super("Auth session or user missing","AuthInvalidTokenResponseError",500,void 0)}},_e=class extends J{constructor(e){super(e,"AuthInvalidCredentialsError",400,void 0)}},xe=class extends J{constructor(e,t=null){super(e,"AuthImplicitGrantRedirectError",500,void 0),this.details=null,this.details=t}toJSON(){return Object.assign(Object.assign({},super.toJSON()),{details:this.details})}};function Tr(i){return b(i)&&i.name==="AuthImplicitGrantRedirectError"}var lt=class extends J{constructor(e,t=null){super(e,"AuthPKCEGrantCodeExchangeError",500,void 0),this.details=null,this.details=t}toJSON(){return Object.assign(Object.assign({},super.toJSON()),{details:this.details})}},Ht=class extends J{constructor(){super("PKCE code verifier not found in storage. This can happen if the auth flow was initiated in a different browser or device, or if the storage was cleared. For SSR frameworks (Next.js, SvelteKit, etc.), use @supabase/ssr on both the server and client to store the code verifier in cookies.","AuthPKCECodeVerifierMissingError",400,"pkce_code_verifier_not_found")}};var ke=class extends J{constructor(e,t){super(e,"AuthRetryableFetchError",t,void 0)}};function ft(i){return b(i)&&i.name==="AuthRetryableFetchError"}var ht=class extends J{constructor(e="Refresh result discarded: session state changed mid-flight (e.g., concurrent signOut)"){super(e,"AuthRefreshDiscardedError",409,void 0)}};function Sr(i){return b(i)&&i.name==="AuthRefreshDiscardedError"}var dt=class extends J{constructor(e,t,r){super(e,"AuthWeakPasswordError",t,"weak_password"),this.reasons=r}toJSON(){return Object.assign(Object.assign({},super.toJSON()),{reasons:this.reasons})}};var ye=class extends J{constructor(e){super(e,"AuthInvalidJwtError",400,"invalid_jwt")}};var Ut="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_".split(""),Ar=` 	
\r=`.split(""),Ms=(()=>{let i=new Array(128);for(let e=0;e<i.length;e+=1)i[e]=-1;for(let e=0;e<Ar.length;e+=1)i[Ar[e].charCodeAt(0)]=-2;for(let e=0;e<Ut.length;e+=1)i[Ut[e].charCodeAt(0)]=e;return i})();function Ir(i,e,t){if(i!==null)for(e.queue=e.queue<<8|i,e.queuedBits+=8;e.queuedBits>=6;){let r=e.queue>>e.queuedBits-6&63;t(Ut[r]),e.queuedBits-=6}else if(e.queuedBits>0)for(e.queue=e.queue<<6-e.queuedBits,e.queuedBits=6;e.queuedBits>=6;){let r=e.queue>>e.queuedBits-6&63;t(Ut[r]),e.queuedBits-=6}}function Cr(i,e,t){let r=Ms[i];if(r>-1)for(e.queue=e.queue<<6|r,e.queuedBits+=6;e.queuedBits>=8;)t(e.queue>>e.queuedBits-8&255),e.queuedBits-=8;else{if(r===-2)return;throw new Error(`Invalid Base64-URL character "${String.fromCharCode(i)}"`)}}function pi(i){let e=[],t=a=>{e.push(String.fromCodePoint(a))},r={utf8seq:0,codepoint:0},n={queue:0,queuedBits:0},s=a=>{Hs(a,r,t)};for(let a=0;a<i.length;a+=1)Cr(i.charCodeAt(a),n,s);return e.join("")}function Bs(i,e){if(i<=127){e(i);return}else if(i<=2047){e(192|i>>6),e(128|i&63);return}else if(i<=65535){e(224|i>>12),e(128|i>>6&63),e(128|i&63);return}else if(i<=1114111){e(240|i>>18),e(128|i>>12&63),e(128|i>>6&63),e(128|i&63);return}throw new Error(`Unrecognized Unicode codepoint: ${i.toString(16)}`)}function Ns(i,e){for(let t=0;t<i.length;t+=1){let r=i.charCodeAt(t);if(r>55295&&r<=56319){let n=(r-55296)*1024&65535;r=(i.charCodeAt(t+1)-56320&65535|n)+65536,t+=1}Bs(r,e)}}function Hs(i,e,t){if(e.utf8seq===0){if(i<=127){t(i);return}for(let r=1;r<6;r+=1)if((i>>7-r&1)===0){e.utf8seq=r;break}if(e.utf8seq===2)e.codepoint=i&31;else if(e.utf8seq===3)e.codepoint=i&15;else if(e.utf8seq===4)e.codepoint=i&7;else throw new Error("Invalid UTF-8 sequence");e.utf8seq-=1}else if(e.utf8seq>0){if(i<=127)throw new Error("Invalid UTF-8 sequence");e.codepoint=e.codepoint<<6|i&63,e.utf8seq-=1,e.utf8seq===0&&t(e.codepoint)}}function ve(i){let e=[],t={queue:0,queuedBits:0},r=n=>{e.push(n)};for(let n=0;n<i.length;n+=1)Cr(i.charCodeAt(n),t,r);return new Uint8Array(e)}function Rr(i){let e=[];return Ns(i,t=>e.push(t)),new Uint8Array(e)}function pe(i){let e=[],t={queue:0,queuedBits:0},r=n=>{e.push(n)};return i.forEach(n=>Ir(n,t,r)),Ir(null,t,r),e.join("")}function Pr(i){return Math.round(Date.now()/1e3)+i}function Lr(){return Symbol("auth-callback")}var N=()=>typeof window<"u"&&typeof document<"u",Ee={tested:!1,writable:!1},Dt=()=>{if(!N())return!1;try{if(typeof globalThis.localStorage!="object")return!1}catch{return!1}if(Ee.tested)return Ee.writable;let i=`lswt-${Math.random()}${Math.random()}`;try{globalThis.localStorage.setItem(i,i),globalThis.localStorage.removeItem(i),Ee.tested=!0,Ee.writable=!0}catch{Ee.tested=!0,Ee.writable=!1}return Ee.writable};function gi(i){let e={},t=new URL(i);if(t.hash&&t.hash[0]==="#")try{new URLSearchParams(t.hash.substring(1)).forEach((n,s)=>{e[s]=n})}catch{}return t.searchParams.forEach((r,n)=>{e[n]=r}),e}var zt=i=>i?(...e)=>i(...e):(...e)=>fetch(...e),Or=i=>typeof i=="object"&&i!==null&&"status"in i&&"ok"in i&&"json"in i&&typeof i.json=="function",ce=async(i,e,t)=>{await i.setItem(e,JSON.stringify(t))},D=async(i,e)=>{let t=await i.getItem(e);if(!t)return null;try{return JSON.parse(t)}catch{return null}},F=async(i,e)=>{await i.removeItem(e)},pt=class i{constructor(){this.promise=new i.promiseConstructor((e,t)=>{this.resolve=e,this.reject=t})}};pt.promiseConstructor=Promise;function mt(i){let e=i.split(".");if(e.length!==3)throw new ye("Invalid JWT structure");for(let r=0;r<e.length;r++)if(!xr.test(e[r]))throw new ye("JWT not in base64url format");return{header:JSON.parse(pi(e[0])),payload:JSON.parse(pi(e[1])),signature:ve(e[2]),raw:{header:e[0],payload:e[1]}}}async function jr(i){return await new Promise(e=>{setTimeout(()=>e(null),i)})}function $r(i,e){return new Promise((r,n)=>{(async()=>{for(let s=0;s<1/0;s++)try{let a=await i(s);if(!e(s,null,a)){r(a);return}}catch(a){if(!e(s,a)){n(a);return}}})()})}function Mr(i){return("0"+i.toString(16)).substr(-2)}function Us(){let e=new Uint32Array(56);if(typeof crypto>"u"){let t="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~",r=t.length,n="";for(let s=0;s<56;s++)n+=t.charAt(Math.floor(Math.random()*r));return n}return crypto.getRandomValues(e),Array.from(e,Mr).join("")}async function Ds(i){let t=new TextEncoder().encode(i),r=await crypto.subtle.digest("SHA-256",t),n=new Uint8Array(r);return Array.from(n).map(s=>String.fromCharCode(s)).join("")}async function zs(i){if(!(typeof crypto<"u"&&typeof crypto.subtle<"u"&&typeof TextEncoder<"u"))return console.warn("WebCrypto API is not supported. Code challenge method will default to use plain instead of sha256."),i;let t=await Ds(i);return btoa(t).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"")}var qs=/^[a-zA-Z0-9_-]{8,64}$/;function yt(i){return typeof i=="string"&&qs.test(i)?i:null}function Fs(){if(typeof crypto<"u"&&typeof crypto.getRandomValues=="function"){let e=new Uint8Array(16);return crypto.getRandomValues(e),Array.from(e,Mr).join("")}let i="";for(let e=0;e<32;e++)i+=Math.floor(Math.random()*16).toString(16);return i}var Te=(i,e)=>`${i}-flow-${e}-code-verifier`,gt=i=>`${i}-flows-code-verifier`;async function mi(i,e){let t=await D(i,gt(e));return Array.isArray(t)?t.filter(r=>yt(r)!==null):[]}async function Ws(i,e,t,r,n){await ce(i,Te(e,t),r);let s=(await mi(i,e)).filter(a=>a!==t);for(s.push(t);s.length>kr;){let a=s.shift();await F(i,Te(e,a)),n?.(a)}await ce(i,gt(e),s),await ce(i,`${e}-code-verifier`,r)}async function Br(i,e,t){if(t){let n=await D(i,Te(e,t));return{verifier:typeof n=="string"?n:null,flowId:t}}let r=await D(i,`${e}-code-verifier`);return{verifier:typeof r=="string"?r:null,flowId:null}}async function Y(i,e,t){let r=`${e}-code-verifier`;if(!t){await F(i,r);return}let n=Te(e,t),s=await D(i,n);await F(i,n);let a=await mi(i,e),o=a.filter(c=>c!==t);o.length!==a.length&&(o.length>0?await ce(i,gt(e),o):await F(i,gt(e))),s!=null&&s===await D(i,r)&&await F(i,r)}async function Nr(i,e){let t=await mi(i,e);for(let r of t)await F(i,Te(e,r));await F(i,gt(e)),await F(i,`${e}-code-verifier`)}function Hr(i,e){let t=i.indexOf("#"),r=t===-1?i:i.slice(0,t),n=t===-1?"":i.slice(t),s=r.indexOf("?");if(s!==-1){let o=r.slice(0,s),c=r.slice(s+1).split("&").filter(l=>l!==""&&l!==ue&&!l.startsWith(`${ue}=`));r=c.length>0?`${o}?${c.join("&")}`:o}let a=r.includes("?")?"&":"?";return`${r}${a}${ue}=${encodeURIComponent(e)}${n}`}async function Ur(i,e,t=!1,r){let n=Us(),s=n;t&&(s+="/recovery");let a=Fs();await Ws(i,e,a,s,r);let o=await zs(n);return[o,n===o?"plain":"s256",a]}var Vs=/^2[0-9]{3}-(0[1-9]|1[0-2])-(0[1-9]|1[0-9]|2[0-9]|3[0-1])$/i;function Dr(i){let e=i.headers.get(ct);if(!e||!e.match(Vs))return null;try{return new Date(`${e}T00:00:00.0Z`)}catch{return null}}function zr(i){if(!i)throw new Error("Missing exp claim");let e=Math.floor(Date.now()/1e3);if(i<=e)throw new Error("JWT has expired")}function qr(i){switch(i){case"RS256":return{name:"RSASSA-PKCS1-v1_5",hash:{name:"SHA-256"}};case"ES256":return{name:"ECDSA",namedCurve:"P-256",hash:{name:"SHA-256"}};default:throw new Error("Invalid alg claim")}}var Ks=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;function le(i){if(!Ks.test(i))throw new Error("@supabase/auth-js: Expected parameter to be UUID but is not")}function K(i){if(!i.passkey)throw new Error("@supabase/auth-js: the passkey API is experimental and disabled by default. Enable it by passing `auth: { experimental: { passkey: true } }` to createClient (or to the GoTrueClient constructor).")}function qt(){let i={};return new Proxy(i,{get:(e,t)=>{if(t==="__isUserNotAvailableProxy")return!0;if(typeof t=="symbol"){let r=t.toString();if(r==="Symbol(Symbol.toPrimitive)"||r==="Symbol(Symbol.toStringTag)"||r==="Symbol(util.inspect.custom)")return}throw new Error(`@supabase/auth-js: client was created with userStorage option and there was no user stored in the user storage. Accessing the "${t}" property of the session object is not supported. Please use getUser() instead.`)},set:(e,t)=>{throw new Error(`@supabase/auth-js: client was created with userStorage option and there was no user stored in the user storage. Setting the "${t}" property of the session object is not supported. Please use getUser() to fetch a user object you can manipulate.`)},deleteProperty:(e,t)=>{throw new Error(`@supabase/auth-js: client was created with userStorage option and there was no user stored in the user storage. Deleting the "${t}" property of the session object is not supported. Please use getUser() to fetch a user object you can manipulate.`)}})}function Fr(i,e){return new Proxy(i,{get:(t,r,n)=>{if(r==="__isInsecureUserWarningProxy")return!0;if(typeof r=="symbol"){let s=r.toString();if(s==="Symbol(Symbol.toPrimitive)"||s==="Symbol(Symbol.toStringTag)"||s==="Symbol(util.inspect.custom)"||s==="Symbol(nodejs.util.inspect.custom)")return Reflect.get(t,r,n)}return!e.value&&typeof r=="string"&&(console.warn("Using the user object as returned from supabase.auth.getSession() or from some supabase.auth.onAuthStateChange() events could be insecure! This value comes directly from the storage medium (usually cookies on the server) and may not be authentic. Use supabase.auth.getUser() instead which authenticates the data by contacting the Supabase Auth server."),e.value=!0),Reflect.get(t,r,n)}})}function yi(i){return JSON.parse(JSON.stringify(i))}var Se=i=>{if(typeof i=="object"&&i!==null){let e=i;if(typeof e.msg=="string")return e.msg;if(typeof e.message=="string")return e.message;if(typeof e.error_description=="string")return e.error_description;if(typeof e.error=="string")return e.error}return JSON.stringify(i)},Wr=[500,501,502,503,504,520,521,522,523,524,525,526,527,528,529,530];async function Vr(i){var e;if(!Or(i))throw new ke(Se(i),0);let t;try{t=await i.json()}catch(s){throw Wr.includes(i.status)?new ke(i.statusText||`HTTP ${i.status}`,i.status):new z(Se(s),s)}if(Wr.includes(i.status))throw new ke(Se(t),i.status);let r,n=Dr(i);if(n&&n.getTime()>=ui["2024-01-01"].timestamp&&typeof t=="object"&&t&&typeof t.code=="string"?r=t.code:typeof t=="object"&&t&&typeof t.error_code=="string"&&(r=t.error_code),r){if(r==="weak_password")throw new dt(Se(t),i.status,((e=t.weak_password)===null||e===void 0?void 0:e.reasons)||[]);if(r==="session_not_found")throw new $}else if(typeof t=="object"&&t&&typeof t.weak_password=="object"&&t.weak_password&&Array.isArray(t.weak_password.reasons)&&t.weak_password.reasons.length&&t.weak_password.reasons.reduce((s,a)=>s&&typeof a=="string",!0))throw new dt(Se(t),i.status,t.weak_password.reasons);throw new Nt(Se(t),i.status||500,r)}var Gs=(i,e,t,r)=>{let n={method:i,headers:e?.headers||{}};return i==="GET"?n:(n.headers=Object.assign({"Content-Type":"application/json;charset=UTF-8"},e?.headers),n.body=JSON.stringify(r),Object.assign(Object.assign({},n),t))};async function x(i,e,t,r){var n;let s=Object.assign({},r?.headers);s[ct]||(s[ct]=ui["2024-01-01"].name),r?.jwt&&(s.Authorization=`Bearer ${r.jwt}`);let a=(n=r?.query)!==null&&n!==void 0?n:{};r?.redirectTo&&(a.redirect_to=r.redirectTo);let o=Object.keys(a).length?"?"+new URLSearchParams(a).toString():"",c=await Js(i,e,t+o,{headers:s,noResolveJson:r?.noResolveJson},{},r?.body);return r?.xform?r?.xform(c):{data:Object.assign({},c),error:null}}async function Js(i,e,t,r,n,s){let a=Gs(e,r,n,s),o;try{o=await i(t,Object.assign({},a))}catch(c){throw new ke(Se(c),0)}if(o.ok||await Vr(o),r?.noResolveJson)return o;try{return await o.json()}catch(c){await Vr(c)}}function G(i){var e;let t=null;Ys(i)&&(t=Object.assign({},i),i.expires_at||(t.expires_at=Pr(i.expires_in)));let r=(e=i.user)!==null&&e!==void 0?e:typeof i?.id=="string"?i:null;return{data:{session:t,user:r},error:null}}function vi(i){let e=G(i);return!e.error&&i.weak_password&&typeof i.weak_password=="object"&&Array.isArray(i.weak_password.reasons)&&i.weak_password.reasons.length&&i.weak_password.message&&typeof i.weak_password.message=="string"&&i.weak_password.reasons.reduce((t,r)=>t&&typeof r=="string",!0)&&(e.data.weak_password=i.weak_password),e}function he(i){var e;return{data:{user:(e=i.user)!==null&&e!==void 0?e:i},error:null}}function Kr(i){return{data:i,error:null}}function Gr(i){let{action_link:e,email_otp:t,hashed_token:r,redirect_to:n,verification_type:s}=i,a=be(i,["action_link","email_otp","hashed_token","redirect_to","verification_type"]),o={action_link:e,email_otp:t,hashed_token:r,redirect_to:n,verification_type:s},c=Object.assign({},a);return{data:{properties:o,user:c},error:null}}function wi(i){return i}function Ys(i){return!!i.access_token&&!!i.refresh_token&&!!i.expires_in}var Ft=["global","local","others"];var Ae=class{constructor({url:e="",headers:t={},fetch:r,experimental:n}){this.url=e,this.headers=t,this.fetch=zt(r),this.experimental=n??{},this.mfa={listFactors:this._listFactors.bind(this),deleteFactor:this._deleteFactor.bind(this)},this.oauth={listClients:this._listOAuthClients.bind(this),createClient:this._createOAuthClient.bind(this),getClient:this._getOAuthClient.bind(this),updateClient:this._updateOAuthClient.bind(this),deleteClient:this._deleteOAuthClient.bind(this),regenerateClientSecret:this._regenerateOAuthClientSecret.bind(this)},this.customProviders={listProviders:this._listCustomProviders.bind(this),createProvider:this._createCustomProvider.bind(this),getProvider:this._getCustomProvider.bind(this),updateProvider:this._updateCustomProvider.bind(this),deleteProvider:this._deleteCustomProvider.bind(this)},this.passkey={listPasskeys:this._adminListPasskeys.bind(this),deletePasskey:this._adminDeletePasskey.bind(this)}}async signOut(e,t=Ft[0]){if(Ft.indexOf(t)<0)throw new Error(`@supabase/auth-js: Parameter scope must be one of ${Ft.join(", ")}`);try{return await x(this.fetch,"POST",`${this.url}/logout?scope=${t}`,{headers:this.headers,jwt:e,noResolveJson:!0}),{data:null,error:null}}catch(r){if(b(r))return{data:null,error:r};throw r}}async inviteUserByEmail(e,t={}){try{return await x(this.fetch,"POST",`${this.url}/invite`,{body:{email:e,data:t.data},headers:this.headers,redirectTo:t.redirectTo,xform:he})}catch(r){if(b(r))return{data:{user:null},error:r};throw r}}async generateLink(e){try{let{options:t}=e,r=be(e,["options"]),n=Object.assign(Object.assign({},r),t);return"newEmail"in r&&(n.new_email=r?.newEmail,delete n.newEmail),await x(this.fetch,"POST",`${this.url}/admin/generate_link`,{body:n,headers:this.headers,xform:Gr,redirectTo:t?.redirectTo})}catch(t){if(b(t))return{data:{properties:null,user:null},error:t};throw t}}async createUser(e){try{return await x(this.fetch,"POST",`${this.url}/admin/users`,{body:e,headers:this.headers,xform:he})}catch(t){if(b(t))return{data:{user:null},error:t};throw t}}async listUsers(e){var t,r,n,s,a,o,c;try{let l={nextPage:null,lastPage:0,total:0},h=await x(this.fetch,"GET",`${this.url}/admin/users`,{headers:this.headers,noResolveJson:!0,query:{page:(r=(t=e?.page)===null||t===void 0?void 0:t.toString())!==null&&r!==void 0?r:"",per_page:(s=(n=e?.perPage)===null||n===void 0?void 0:n.toString())!==null&&s!==void 0?s:""},xform:wi});if(h.error)throw h.error;let d=await h.json(),f=(a=h.headers.get("x-total-count"))!==null&&a!==void 0?a:0,u=(c=(o=h.headers.get("link"))===null||o===void 0?void 0:o.split(","))!==null&&c!==void 0?c:[];return u.length>0&&(u.forEach(p=>{let m=parseInt(p.split(";")[0].split("=")[1].substring(0,1)),y=JSON.parse(p.split(";")[1].split("=")[1]);l[`${y}Page`]=m}),l.total=parseInt(f)),{data:Object.assign(Object.assign({},d),l),error:null}}catch(l){if(b(l))return{data:{users:[]},error:l};throw l}}async getUserById(e){le(e);try{return await x(this.fetch,"GET",`${this.url}/admin/users/${e}`,{headers:this.headers,xform:he})}catch(t){if(b(t))return{data:{user:null},error:t};throw t}}async updateUserById(e,t){le(e);try{return await x(this.fetch,"PUT",`${this.url}/admin/users/${e}`,{body:t,headers:this.headers,xform:he})}catch(r){if(b(r))return{data:{user:null},error:r};throw r}}async deleteUser(e,t=!1){le(e);try{return await x(this.fetch,"DELETE",`${this.url}/admin/users/${e}`,{headers:this.headers,body:{should_soft_delete:t},xform:he})}catch(r){if(b(r))return{data:{user:null},error:r};throw r}}async _listFactors(e){le(e.userId);try{let{data:t,error:r}=await x(this.fetch,"GET",`${this.url}/admin/users/${e.userId}/factors`,{headers:this.headers,xform:n=>({data:{factors:n},error:null})});return{data:t,error:r}}catch(t){if(b(t))return{data:null,error:t};throw t}}async _deleteFactor(e){le(e.userId),le(e.id);try{return{data:await x(this.fetch,"DELETE",`${this.url}/admin/users/${e.userId}/factors/${e.id}`,{headers:this.headers}),error:null}}catch(t){if(b(t))return{data:null,error:t};throw t}}async _listOAuthClients(e){var t,r,n,s,a,o,c;try{let l={nextPage:null,lastPage:0,total:0},h=await x(this.fetch,"GET",`${this.url}/admin/oauth/clients`,{headers:this.headers,noResolveJson:!0,query:{page:(r=(t=e?.page)===null||t===void 0?void 0:t.toString())!==null&&r!==void 0?r:"",per_page:(s=(n=e?.perPage)===null||n===void 0?void 0:n.toString())!==null&&s!==void 0?s:""},xform:wi});if(h.error)throw h.error;let d=await h.json(),f=(a=h.headers.get("x-total-count"))!==null&&a!==void 0?a:0,u=(c=(o=h.headers.get("link"))===null||o===void 0?void 0:o.split(","))!==null&&c!==void 0?c:[];return u.length>0&&(u.forEach(p=>{let m=parseInt(p.split(";")[0].split("=")[1].substring(0,1)),y=JSON.parse(p.split(";")[1].split("=")[1]);l[`${y}Page`]=m}),l.total=parseInt(f)),{data:Object.assign(Object.assign({},d),l),error:null}}catch(l){if(b(l))return{data:{clients:[]},error:l};throw l}}async _createOAuthClient(e){try{return await x(this.fetch,"POST",`${this.url}/admin/oauth/clients`,{body:e,headers:this.headers,xform:t=>({data:t,error:null})})}catch(t){if(b(t))return{data:null,error:t};throw t}}async _getOAuthClient(e){try{return await x(this.fetch,"GET",`${this.url}/admin/oauth/clients/${e}`,{headers:this.headers,xform:t=>({data:t,error:null})})}catch(t){if(b(t))return{data:null,error:t};throw t}}async _updateOAuthClient(e,t){try{return await x(this.fetch,"PUT",`${this.url}/admin/oauth/clients/${e}`,{body:t,headers:this.headers,xform:r=>({data:r,error:null})})}catch(r){if(b(r))return{data:null,error:r};throw r}}async _deleteOAuthClient(e){try{return await x(this.fetch,"DELETE",`${this.url}/admin/oauth/clients/${e}`,{headers:this.headers,noResolveJson:!0}),{data:null,error:null}}catch(t){if(b(t))return{data:null,error:t};throw t}}async _regenerateOAuthClientSecret(e){try{return await x(this.fetch,"POST",`${this.url}/admin/oauth/clients/${e}/regenerate_secret`,{headers:this.headers,xform:t=>({data:t,error:null})})}catch(t){if(b(t))return{data:null,error:t};throw t}}async _listCustomProviders(e){try{let t={};return e?.type&&(t.type=e.type),await x(this.fetch,"GET",`${this.url}/admin/custom-providers`,{headers:this.headers,query:t,xform:r=>{var n;return{data:{providers:(n=r?.providers)!==null&&n!==void 0?n:[]},error:null}}})}catch(t){if(b(t))return{data:{providers:[]},error:t};throw t}}async _createCustomProvider(e){try{return await x(this.fetch,"POST",`${this.url}/admin/custom-providers`,{body:e,headers:this.headers,xform:t=>({data:t,error:null})})}catch(t){if(b(t))return{data:null,error:t};throw t}}async _getCustomProvider(e){try{return await x(this.fetch,"GET",`${this.url}/admin/custom-providers/${e}`,{headers:this.headers,xform:t=>({data:t,error:null})})}catch(t){if(b(t))return{data:null,error:t};throw t}}async _updateCustomProvider(e,t){try{return await x(this.fetch,"PUT",`${this.url}/admin/custom-providers/${e}`,{body:t,headers:this.headers,xform:r=>({data:r,error:null})})}catch(r){if(b(r))return{data:null,error:r};throw r}}async _deleteCustomProvider(e){try{return await x(this.fetch,"DELETE",`${this.url}/admin/custom-providers/${e}`,{headers:this.headers,noResolveJson:!0}),{data:null,error:null}}catch(t){if(b(t))return{data:null,error:t};throw t}}async _adminListPasskeys(e){K(this.experimental),le(e.userId);try{return await x(this.fetch,"GET",`${this.url}/admin/users/${e.userId}/passkeys`,{headers:this.headers,xform:t=>({data:t,error:null})})}catch(t){if(b(t))return{data:null,error:t};throw t}}async _adminDeletePasskey(e){K(this.experimental),le(e.userId),le(e.passkeyId);try{return await x(this.fetch,"DELETE",`${this.url}/admin/users/${e.userId}/passkeys/${e.passkeyId}`,{headers:this.headers,noResolveJson:!0}),{data:null,error:null}}catch(t){if(b(t))return{data:null,error:t};throw t}}};function bi(i={}){return{getItem:e=>i[e]||null,setItem:(e,t)=>{i[e]=t},removeItem:e=>{delete i[e]}}}var Qs={debug:!!(globalThis&&Dt()&&globalThis.localStorage&&globalThis.localStorage.getItem("supabase.gotrue-js.locks.debug")==="true")},Wt=class extends Error{constructor(e){super(e),this.isAcquireTimeout=!0}};function Jr(){if(typeof globalThis!="object")try{Object.defineProperty(Object.prototype,"__magic__",{get:function(){return this},configurable:!0}),__magic__.globalThis=__magic__,delete Object.prototype.__magic__}catch{typeof self<"u"&&(self.globalThis=self)}}function _i(i){if(!/^0x[a-fA-F0-9]{40}$/.test(i))throw new Error(`@supabase/auth-js: Address "${i}" is invalid.`);return i.toLowerCase()}function Yr(i){return parseInt(i,16)}function Qr(i){let e=new TextEncoder().encode(i);return"0x"+Array.from(e,r=>r.toString(16).padStart(2,"0")).join("")}function Zr(i){var e;let{chainId:t,domain:r,expirationTime:n,issuedAt:s=new Date,nonce:a,notBefore:o,requestId:c,resources:l,scheme:h,uri:d,version:f}=i;{if(!Number.isInteger(t))throw new Error(`@supabase/auth-js: Invalid SIWE message field "chainId". Chain ID must be a EIP-155 chain ID. Provided value: ${t}`);if(!r)throw new Error('@supabase/auth-js: Invalid SIWE message field "domain". Domain must be provided.');if(a&&a.length<8)throw new Error(`@supabase/auth-js: Invalid SIWE message field "nonce". Nonce must be at least 8 characters. Provided value: ${a}`);if(!d)throw new Error('@supabase/auth-js: Invalid SIWE message field "uri". URI must be provided.');if(f!=="1")throw new Error(`@supabase/auth-js: Invalid SIWE message field "version". Version must be '1'. Provided value: ${f}`);if(!((e=i.statement)===null||e===void 0)&&e.includes(`
`))throw new Error(`@supabase/auth-js: Invalid SIWE message field "statement". Statement must not include '\\n'. Provided value: ${i.statement}`)}let u=_i(i.address),p=h?`${h}://${r}`:r,m=i.statement?`${i.statement}
`:"",y=`${p} wants you to sign in with your Ethereum account:
${u}

${m}`,g=`URI: ${d}
Version: ${f}
Chain ID: ${t}${a?`
Nonce: ${a}`:""}
Issued At: ${s.toISOString()}`;if(n&&(g+=`
Expiration Time: ${n.toISOString()}`),o&&(g+=`
Not Before: ${o.toISOString()}`),c&&(g+=`
Request ID: ${c}`),l){let v=`
Resources:`;for(let w of l){if(!w||typeof w!="string")throw new Error(`@supabase/auth-js: Invalid SIWE message field "resources". Every resource must be a valid string. Provided value: ${w}`);v+=`
- ${w}`}g+=v}return`${y}
${g}`}var j=class extends Error{constructor({message:e,code:t,cause:r,name:n}){var s;super(e,{cause:r}),this.__isWebAuthnError=!0,this.name=(s=n??(r instanceof Error?r.name:void 0))!==null&&s!==void 0?s:"Unknown Error",this.code=t}toJSON(){return{name:this.name,message:this.message,code:this.code}}},Ie=class extends j{constructor(e,t){super({code:"ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",cause:t,message:e}),this.name="WebAuthnUnknownError",this.originalError=t}};function Xr({error:i,options:e}){var t,r,n;let{publicKey:s}=e;if(!s)throw Error("options was missing required publicKey property");if(i.name==="AbortError"){if(e.signal instanceof AbortSignal)return new j({message:"Registration ceremony was sent an abort signal",code:"ERROR_CEREMONY_ABORTED",cause:i})}else if(i.name==="ConstraintError"){if(((t=s.authenticatorSelection)===null||t===void 0?void 0:t.requireResidentKey)===!0)return new j({message:"Discoverable credentials were required but no available authenticator supported it",code:"ERROR_AUTHENTICATOR_MISSING_DISCOVERABLE_CREDENTIAL_SUPPORT",cause:i});if(e.mediation==="conditional"&&((r=s.authenticatorSelection)===null||r===void 0?void 0:r.userVerification)==="required")return new j({message:"User verification was required during automatic registration but it could not be performed",code:"ERROR_AUTO_REGISTER_USER_VERIFICATION_FAILURE",cause:i});if(((n=s.authenticatorSelection)===null||n===void 0?void 0:n.userVerification)==="required")return new j({message:"User verification was required but no available authenticator supported it",code:"ERROR_AUTHENTICATOR_MISSING_USER_VERIFICATION_SUPPORT",cause:i})}else{if(i.name==="InvalidStateError")return new j({message:"The authenticator was previously registered",code:"ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED",cause:i});if(i.name==="NotAllowedError")return new j({message:i.message,code:"ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",cause:i});if(i.name==="NotSupportedError")return s.pubKeyCredParams.filter(o=>o.type==="public-key").length===0?new j({message:'No entry in pubKeyCredParams was of type "public-key"',code:"ERROR_MALFORMED_PUBKEYCREDPARAMS",cause:i}):new j({message:"No available authenticator supported any of the specified pubKeyCredParams algorithms",code:"ERROR_AUTHENTICATOR_NO_SUPPORTED_PUBKEYCREDPARAMS_ALG",cause:i});if(i.name==="SecurityError"){let a=window.location.hostname;if(xi(a)){if(s.rp.id!==a)return new j({message:`The RP ID "${s.rp.id}" is invalid for this domain`,code:"ERROR_INVALID_RP_ID",cause:i})}else return new j({message:`${window.location.hostname} is an invalid domain`,code:"ERROR_INVALID_DOMAIN",cause:i})}else if(i.name==="TypeError"){if(s.user.id.byteLength<1||s.user.id.byteLength>64)return new j({message:"User ID was not between 1 and 64 characters",code:"ERROR_INVALID_USER_ID_LENGTH",cause:i})}else if(i.name==="UnknownError")return new j({message:"The authenticator was unable to process the specified options, or could not create a new credential",code:"ERROR_AUTHENTICATOR_GENERAL_ERROR",cause:i})}return new j({message:"a Non-Webauthn related error has occurred",code:"ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",cause:i})}function en({error:i,options:e}){let{publicKey:t}=e;if(!t)throw Error("options was missing required publicKey property");if(i.name==="AbortError"){if(e.signal instanceof AbortSignal)return new j({message:"Authentication ceremony was sent an abort signal",code:"ERROR_CEREMONY_ABORTED",cause:i})}else{if(i.name==="NotAllowedError")return new j({message:i.message,code:"ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",cause:i});if(i.name==="SecurityError"){let r=window.location.hostname;if(xi(r)){if(t.rpId!==r)return new j({message:`The RP ID "${t.rpId}" is invalid for this domain`,code:"ERROR_INVALID_RP_ID",cause:i})}else return new j({message:`${window.location.hostname} is an invalid domain`,code:"ERROR_INVALID_DOMAIN",cause:i})}else if(i.name==="UnknownError")return new j({message:"The authenticator was unable to process the specified options, or could not create a new assertion signature",code:"ERROR_AUTHENTICATOR_GENERAL_ERROR",cause:i})}return new j({message:"a Non-Webauthn related error has occurred",code:"ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",cause:i})}var ki=class{createNewAbortSignal(){if(this.controller){let t=new Error("Cancelling existing WebAuthn API call for new one");t.name="AbortError",this.controller.abort(t)}let e=new AbortController;return this.controller=e,e.signal}cancelCeremony(){if(this.controller){let e=new Error("Manually cancelling existing WebAuthn API call");e.name="AbortError",this.controller.abort(e),this.controller=void 0}}},Gt=new ki;function Ei(i){if(!i)throw new Error("Credential creation options are required");if(typeof PublicKeyCredential<"u"&&"parseCreationOptionsFromJSON"in PublicKeyCredential&&typeof PublicKeyCredential.parseCreationOptionsFromJSON=="function")return PublicKeyCredential.parseCreationOptionsFromJSON(i);let{challenge:e,user:t,excludeCredentials:r}=i,n=be(i,["challenge","user","excludeCredentials"]),s=ve(e).buffer,a=Object.assign(Object.assign({},t),{id:ve(t.id).buffer}),o=Object.assign(Object.assign({},n),{challenge:s,user:a});if(r&&r.length>0){o.excludeCredentials=new Array(r.length);for(let c=0;c<r.length;c++){let l=r[c];o.excludeCredentials[c]=Object.assign(Object.assign({},l),{id:ve(l.id).buffer,type:l.type||"public-key",transports:l.transports})}}return o}function Ti(i){if(!i)throw new Error("Credential request options are required");if(typeof PublicKeyCredential<"u"&&"parseRequestOptionsFromJSON"in PublicKeyCredential&&typeof PublicKeyCredential.parseRequestOptionsFromJSON=="function")return PublicKeyCredential.parseRequestOptionsFromJSON(i);let{challenge:e,allowCredentials:t}=i,r=be(i,["challenge","allowCredentials"]),n=ve(e).buffer,s=Object.assign(Object.assign({},r),{challenge:n});if(t&&t.length>0){s.allowCredentials=new Array(t.length);for(let a=0;a<t.length;a++){let o=t[a];s.allowCredentials[a]=Object.assign(Object.assign({},o),{id:ve(o.id).buffer,type:o.type||"public-key",transports:o.transports})}}return s}function Si(i){var e;if("toJSON"in i&&typeof i.toJSON=="function")return i.toJSON();let t=i;return{id:i.id,rawId:i.id,response:{attestationObject:pe(new Uint8Array(i.response.attestationObject)),clientDataJSON:pe(new Uint8Array(i.response.clientDataJSON))},type:"public-key",clientExtensionResults:i.getClientExtensionResults(),authenticatorAttachment:(e=t.authenticatorAttachment)!==null&&e!==void 0?e:void 0}}function Ai(i){var e;if("toJSON"in i&&typeof i.toJSON=="function")return i.toJSON();let t=i,r=i.getClientExtensionResults(),n=i.response;return{id:i.id,rawId:i.id,response:{authenticatorData:pe(new Uint8Array(n.authenticatorData)),clientDataJSON:pe(new Uint8Array(n.clientDataJSON)),signature:pe(new Uint8Array(n.signature)),userHandle:n.userHandle?pe(new Uint8Array(n.userHandle)):void 0},type:"public-key",clientExtensionResults:r,authenticatorAttachment:(e=t.authenticatorAttachment)!==null&&e!==void 0?e:void 0}}function xi(i){return i==="localhost"||/^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i.test(i)}function vt(){var i,e;return!!(N()&&"PublicKeyCredential"in window&&window.PublicKeyCredential&&"credentials"in navigator&&typeof((i=navigator?.credentials)===null||i===void 0?void 0:i.create)=="function"&&typeof((e=navigator?.credentials)===null||e===void 0?void 0:e.get)=="function")}async function Ii(i){try{let e=await navigator.credentials.create(i);return e?e instanceof PublicKeyCredential?{data:e,error:null}:{data:null,error:new Ie("Browser returned unexpected credential type",e)}:{data:null,error:new Ie("Empty credential response",e)}}catch(e){return{data:null,error:Xr({error:e,options:i})}}}async function Ci(i){try{let e=await navigator.credentials.get(i);return e?e instanceof PublicKeyCredential?{data:e,error:null}:{data:null,error:new Ie("Browser returned unexpected credential type",e)}:{data:null,error:new Ie("Empty credential response",e)}}catch(e){return{data:null,error:en({error:e,options:i})}}}var Zs={hints:["security-key"],authenticatorSelection:{authenticatorAttachment:"cross-platform",requireResidentKey:!1,userVerification:"preferred",residentKey:"discouraged"},attestation:"direct"},Xs={userVerification:"preferred",hints:["security-key"],attestation:"direct"};function Vt(...i){let e=n=>n!==null&&typeof n=="object"&&!Array.isArray(n),t=n=>n instanceof ArrayBuffer||ArrayBuffer.isView(n),r={};for(let n of i)if(n)for(let s in n){let a=n[s];if(a!==void 0)if(Array.isArray(a))r[s]=a;else if(t(a))r[s]=a;else if(e(a)){let o=r[s];e(o)?r[s]=Vt(o,a):r[s]=Vt(a)}else r[s]=a}return r}function ea(i,e){return Vt(Zs,i,e||{})}function ta(i,e){return Vt(Xs,i,e||{})}var Kt=class{constructor(e){this.client=e,this.enroll=this._enroll.bind(this),this.challenge=this._challenge.bind(this),this.verify=this._verify.bind(this),this.authenticate=this._authenticate.bind(this),this.register=this._register.bind(this)}async _enroll(e){return this.client.mfa.enroll(Object.assign(Object.assign({},e),{factorType:"webauthn"}))}async _challenge({factorId:e,webauthn:t,friendlyName:r,signal:n},s){var a;try{let{data:o,error:c}=await this.client.mfa.challenge({factorId:e,webauthn:t});if(!o)return{data:null,error:c};let l=n??Gt.createNewAbortSignal();if(o.webauthn.type==="create"){let{user:h}=o.webauthn.credential_options.publicKey;if(!h.name){let d=r;if(d)h.name=`${h.id}:${d}`;else{let u=(await this.client.getUser()).data.user,p=((a=u?.user_metadata)===null||a===void 0?void 0:a.name)||u?.email||u?.id||"User";h.name=`${h.id}:${p}`}}h.displayName||(h.displayName=h.name)}switch(o.webauthn.type){case"create":{let h=ea(o.webauthn.credential_options.publicKey,s?.create),{data:d,error:f}=await Ii({publicKey:h,signal:l});return d?{data:{factorId:e,challengeId:o.id,webauthn:{type:o.webauthn.type,credential_response:d}},error:null}:{data:null,error:f}}case"request":{let h=ta(o.webauthn.credential_options.publicKey,s?.request),{data:d,error:f}=await Ci(Object.assign(Object.assign({},o.webauthn.credential_options),{publicKey:h,signal:l}));return d?{data:{factorId:e,challengeId:o.id,webauthn:{type:o.webauthn.type,credential_response:d}},error:null}:{data:null,error:f}}}}catch(o){return b(o)?{data:null,error:o}:{data:null,error:new z("Unexpected error in challenge",o)}}}async _verify({challengeId:e,factorId:t,webauthn:r}){return this.client.mfa.verify({factorId:t,challengeId:e,webauthn:r})}async _authenticate({factorId:e,webauthn:{rpId:t=typeof window<"u"?window.location.hostname:void 0,rpOrigins:r=typeof window<"u"?[window.location.origin]:void 0,signal:n}={}},s){if(!t)return{data:null,error:new me("rpId is required for WebAuthn authentication")};try{if(!vt())return{data:null,error:new z("Browser does not support WebAuthn",null)};let{data:a,error:o}=await this.challenge({factorId:e,webauthn:{rpId:t,rpOrigins:r},signal:n},{request:s});if(!a)return{data:null,error:o};let{webauthn:c}=a;return this._verify({factorId:e,challengeId:a.challengeId,webauthn:{type:c.type,rpId:t,rpOrigins:r,credential_response:c.credential_response}})}catch(a){return b(a)?{data:null,error:a}:{data:null,error:new z("Unexpected error in authenticate",a)}}}async _register({friendlyName:e,webauthn:{rpId:t=typeof window<"u"?window.location.hostname:void 0,rpOrigins:r=typeof window<"u"?[window.location.origin]:void 0,signal:n}={}},s){if(!t)return{data:null,error:new me("rpId is required for WebAuthn registration")};try{if(!vt())return{data:null,error:new z("Browser does not support WebAuthn",null)};let{data:a,error:o}=await this._enroll({friendlyName:e});if(!a)return await this.client.mfa.listFactors().then(h=>{var d;return(d=h.data)===null||d===void 0?void 0:d.all.find(f=>f.factor_type==="webauthn"&&f.friendly_name===e&&f.status!=="unverified")}).then(h=>h?this.client.mfa.unenroll({factorId:h?.id}):void 0),{data:null,error:o};let{data:c,error:l}=await this._challenge({factorId:a.id,friendlyName:a.friendly_name,webauthn:{rpId:t,rpOrigins:r},signal:n},{create:s});return c?this._verify({factorId:a.id,challengeId:c.challengeId,webauthn:{rpId:t,rpOrigins:r,type:c.webauthn.type,credential_response:c.webauthn.credential_response}}):{data:null,error:l}}catch(a){return b(a)?{data:null,error:a}:{data:null,error:new z("Unexpected error in register",a)}}}};Jr();var ia={url:wr,storageKey:br,autoRefreshToken:!0,persistSession:!0,detectSessionInUrl:!0,headers:_r,flowType:"implicit",debug:!1,hasCustomAuthorizationHeader:!1,throwOnError:!1,lockAcquireTimeout:5e3,skipAutoInitialize:!1,experimental:{}};var Fe={},tn=!1,Jt=class i{get jwks(){var e,t;return(t=(e=Fe[this.storageKey])===null||e===void 0?void 0:e.jwks)!==null&&t!==void 0?t:{keys:[]}}set jwks(e){Fe[this.storageKey]=Object.assign(Object.assign({},Fe[this.storageKey]),{jwks:e})}get jwks_cached_at(){var e,t;return(t=(e=Fe[this.storageKey])===null||e===void 0?void 0:e.cachedAt)!==null&&t!==void 0?t:Number.MIN_SAFE_INTEGER}set jwks_cached_at(e){Fe[this.storageKey]=Object.assign(Object.assign({},Fe[this.storageKey]),{cachedAt:e})}constructor(e){var t,r,n;this.userStorage=null,this.memoryStorage=null,this.stateChangeEmitters=new Map,this.autoRefreshTicker=null,this.autoRefreshTickTimeout=null,this.visibilityChangedCallback=null,this.refreshingDeferred=null,this.lastRefreshFailure=null,this._sessionRemovalEpoch=0,this.initializePromise=null,this._pendingInitNotifications=null,this.detectSessionInUrl=!0,this.hasCustomAuthorizationHeader=!1,this.suppressGetSessionWarning=!1,this.lock=null,this.lockAcquired=!1,this.pendingInLock=[],this.broadcastChannel=null,this.logger=console.log;let s=Object.assign(Object.assign({},ia),e);if(this.storageKey=s.storageKey,this.instanceID=(t=i.nextInstanceID[this.storageKey])!==null&&t!==void 0?t:0,i.nextInstanceID[this.storageKey]=this.instanceID+1,this.logDebugMessages=!!s.debug,typeof s.debug=="function"&&(this.logger=s.debug),this.instanceID>0&&N()){let a=`${this._logPrefix()} Multiple GoTrueClient instances detected in the same browser context. It is not an error, but this should be avoided as it may produce undefined behavior when used concurrently under the same storage key.`;console.warn(a),this.logDebugMessages&&console.trace(a)}if(this.persistSession=s.persistSession,this.autoRefreshToken=s.autoRefreshToken,this.experimental=(r=s.experimental)!==null&&r!==void 0?r:{},this.admin=new Ae({url:s.url,headers:s.headers,fetch:s.fetch,experimental:this.experimental}),this.url=s.url,this.headers=s.headers,this.fetch=zt(s.fetch),this.detectSessionInUrl=s.detectSessionInUrl,this.flowType=s.flowType,this.hasCustomAuthorizationHeader=s.hasCustomAuthorizationHeader,this.throwOnError=s.throwOnError,this.lockAcquireTimeout=s.lockAcquireTimeout,s.lock!=null&&(this.lock=s.lock,tn||(tn=!0,console.warn(`${this._logPrefix()} The "lock" option is deprecated and will be removed in v3. The client now coordinates session refreshes without a lock, so most apps can drop the option. See https://github.com/supabase/supabase-js/blob/master/packages/core/auth-js/migrations/lockless-coordination.md`))),this.jwks||(this.jwks={keys:[]},this.jwks_cached_at=Number.MIN_SAFE_INTEGER),this.mfa={verify:this._verify.bind(this),enroll:this._enroll.bind(this),unenroll:this._unenroll.bind(this),challenge:this._challenge.bind(this),listFactors:this._listFactors.bind(this),challengeAndVerify:this._challengeAndVerify.bind(this),getAuthenticatorAssuranceLevel:this._getAuthenticatorAssuranceLevel.bind(this),webauthn:new Kt(this)},this.oauth={getAuthorizationDetails:this._getAuthorizationDetails.bind(this),approveAuthorization:this._approveAuthorization.bind(this),denyAuthorization:this._denyAuthorization.bind(this),listGrants:this._listOAuthGrants.bind(this),revokeGrant:this._revokeOAuthGrant.bind(this)},this.passkey={startRegistration:this._startPasskeyRegistration.bind(this),verifyRegistration:this._verifyPasskeyRegistration.bind(this),startAuthentication:this._startPasskeyAuthentication.bind(this),verifyAuthentication:this._verifyPasskeyAuthentication.bind(this),list:this._listPasskeys.bind(this),update:this._updatePasskey.bind(this),delete:this._deletePasskey.bind(this)},this.persistSession?(s.storage?this.storage=s.storage:Dt()?this.storage=globalThis.localStorage:(this.memoryStorage={},this.storage=bi(this.memoryStorage)),s.userStorage&&(this.userStorage=s.userStorage)):(this.memoryStorage={},this.storage=bi(this.memoryStorage)),N()&&globalThis.BroadcastChannel&&this.persistSession&&this.storageKey){try{this.broadcastChannel=new globalThis.BroadcastChannel(this.storageKey)}catch(a){console.error("Failed to create a new BroadcastChannel, multi-tab state changes will not be available",a)}(n=this.broadcastChannel)===null||n===void 0||n.addEventListener("message",async a=>{this._debug("received broadcast notification from other tab or client",a),(a.data.event==="TOKEN_REFRESHED"||a.data.event==="SIGNED_IN")&&(this.lastRefreshFailure=null);try{await this._notifyAllSubscribers(a.data.event,a.data.session,!1)}catch(o){this._debug("#broadcastChannel","error",o)}})}s.skipAutoInitialize||this.initialize().catch(a=>{this._debug("#initialize()","error",a)})}isThrowOnErrorEnabled(){return this.throwOnError}_returnResult(e){if(this.throwOnError&&e&&e.error)throw e.error;return e}_logPrefix(){return`GoTrueClient@${this.storageKey}:${this.instanceID} (${Mt}) ${new Date().toISOString()}`}_debug(...e){return this.logDebugMessages&&this.logger(this._logPrefix(),...e),this}async initialize(){var e;if(this.initializePromise)return await this.initializePromise;this._pendingInitNotifications=[],this.initializePromise=(async()=>this.lock!=null?await this._acquireLock(this.lockAcquireTimeout,async()=>await this._initialize()):await this._initialize())();let t=await this.initializePromise,r=(e=this._pendingInitNotifications)!==null&&e!==void 0?e:[];this._pendingInitNotifications=null;for(let n of r)await this._notifyAllSubscribers(n.event,n.session,n.broadcast);return t}async _initialize(){var e;try{let t={},r="none";if(N()&&(t=gi(window.location.href),this._isImplicitGrantCallback(t)?r="implicit":await this._isPKCECallback(t)&&(r="pkce")),N()&&this.detectSessionInUrl&&r!=="none"){let{data:n,error:s}=await this._getSessionFromURL(t,r);if(s){if(this._debug("#_initialize()","error detecting session from URL",s),Tr(s)){let c=(e=s.details)===null||e===void 0?void 0:e.code;if(c==="identity_already_exists"||c==="identity_not_found"||c==="single_identity_not_deletable")return{error:s}}return{error:s}}let{session:a,redirectType:o}=n;return this._debug("#_initialize()","detected session in URL",a,"redirect type",o),await this._saveSession(a),setTimeout(async()=>{o==="recovery"?await this._notifyAllSubscribers("PASSWORD_RECOVERY",a):await this._notifyAllSubscribers("SIGNED_IN",a)},0),{error:null}}return await this._recoverAndRefresh(),{error:null}}catch(t){return b(t)?this._returnResult({error:t}):this._returnResult({error:new z("Unexpected error during initialization",t)})}finally{await this._handleVisibilityChange(),this._debug("#_initialize()","end")}}async signInAnonymously(e){var t,r,n;try{let s=await x(this.fetch,"POST",`${this.url}/signup`,{headers:this.headers,body:{data:(r=(t=e?.options)===null||t===void 0?void 0:t.data)!==null&&r!==void 0?r:{},gotrue_meta_security:{captcha_token:(n=e?.options)===null||n===void 0?void 0:n.captchaToken}},xform:G}),{data:a,error:o}=s;if(o||!a)return this._returnResult({data:{user:null,session:null},error:o});let c=a.session,l=a.user;return a.session&&(await this._saveSession(a.session),await this._notifyAllSubscribers("SIGNED_IN",c)),this._returnResult({data:{user:l,session:c},error:null})}catch(s){if(b(s))return this._returnResult({data:{user:null,session:null},error:s});throw s}}async signUp(e){var t,r,n;let s=null;try{let a;if("email"in e){let{email:d,password:f,options:u}=e,p=null,m=null;this.flowType==="pkce"&&([p,m,s]=await this._getCodeChallengeAndMethod()),a=await x(this.fetch,"POST",`${this.url}/signup`,{headers:this.headers,redirectTo:this._maybeAppendFlowIdToRedirect(u?.emailRedirectTo,s),body:{email:d,password:f,data:(t=u?.data)!==null&&t!==void 0?t:{},gotrue_meta_security:{captcha_token:u?.captchaToken},code_challenge:p,code_challenge_method:m},xform:G})}else if("phone"in e){let{phone:d,password:f,options:u}=e;a=await x(this.fetch,"POST",`${this.url}/signup`,{headers:this.headers,body:{phone:d,password:f,data:(r=u?.data)!==null&&r!==void 0?r:{},channel:(n=u?.channel)!==null&&n!==void 0?n:"sms",gotrue_meta_security:{captcha_token:u?.captchaToken}},xform:G})}else throw new _e("You must provide either an email or phone number and a password");let{data:o,error:c}=a;if(c||!o)return await Y(this.storage,this.storageKey,s),this._returnResult({data:{user:null,session:null},error:c});let l=o.session,h=o.user;return o.session&&(await this._saveSession(o.session),await this._notifyAllSubscribers("SIGNED_IN",l)),this._returnResult({data:{user:h,session:l},error:null})}catch(a){if(await Y(this.storage,this.storageKey,s),b(a))return this._returnResult({data:{user:null,session:null},error:a});throw a}}async signInWithPassword(e){try{let t;if("email"in e){let{email:s,password:a,options:o}=e;t=await x(this.fetch,"POST",`${this.url}/token?grant_type=password`,{headers:this.headers,body:{email:s,password:a,gotrue_meta_security:{captcha_token:o?.captchaToken}},xform:vi})}else if("phone"in e){let{phone:s,password:a,options:o}=e;t=await x(this.fetch,"POST",`${this.url}/token?grant_type=password`,{headers:this.headers,body:{phone:s,password:a,gotrue_meta_security:{captcha_token:o?.captchaToken}},xform:vi})}else throw new _e("You must provide either an email or phone number and a password");let{data:r,error:n}=t;if(n)return this._returnResult({data:{user:null,session:null},error:n});if(!r||!r.session||!r.user){let s=new fe;return this._returnResult({data:{user:null,session:null},error:s})}return r.session&&(await this._saveSession(r.session),await this._notifyAllSubscribers("SIGNED_IN",r.session)),this._returnResult({data:Object.assign({user:r.user,session:r.session},r.weak_password?{weakPassword:r.weak_password}:null),error:n})}catch(t){if(b(t))return this._returnResult({data:{user:null,session:null},error:t});throw t}}async signInWithOAuth(e){var t,r,n,s;return await this._handleProviderSignIn(e.provider,{redirectTo:(t=e.options)===null||t===void 0?void 0:t.redirectTo,scopes:(r=e.options)===null||r===void 0?void 0:r.scopes,queryParams:(n=e.options)===null||n===void 0?void 0:n.queryParams,skipBrowserRedirect:(s=e.options)===null||s===void 0?void 0:s.skipBrowserRedirect})}async exchangeCodeForSession(e,t){return await this.initializePromise,this.lock!=null?this._acquireLock(this.lockAcquireTimeout,async()=>this._exchangeCodeForSession(e,t)):this._exchangeCodeForSession(e,t)}async signInWithWeb3(e){let{chain:t}=e;switch(t){case"ethereum":return await this.signInWithEthereum(e);case"solana":return await this.signInWithSolana(e);default:throw new Error(`@supabase/auth-js: Unsupported chain "${t}"`)}}async signInWithEthereum(e){var t,r,n,s,a,o,c,l,h,d,f;let u,p;if("message"in e)u=e.message,p=e.signature;else{let{chain:m,wallet:y,statement:g,options:v}=e,w;if(N())if(typeof y=="object")w=y;else{let q=window;if("ethereum"in q&&typeof q.ethereum=="object"&&"request"in q.ethereum&&typeof q.ethereum.request=="function")w=q.ethereum;else throw new Error("@supabase/auth-js: No compatible Ethereum wallet interface on the window object (window.ethereum) detected. Make sure the user already has a wallet installed and connected for this app. Prefer passing the wallet interface object directly to signInWithWeb3({ chain: 'ethereum', wallet: resolvedUserWallet }) instead.")}else{if(typeof y!="object"||!v?.url)throw new Error("@supabase/auth-js: Both wallet and url must be specified in non-browser environments.");w=y}let T=new URL((t=v?.url)!==null&&t!==void 0?t:window.location.href),L=await w.request({method:"eth_requestAccounts"}).then(q=>q).catch(()=>{throw new Error("@supabase/auth-js: Wallet method eth_requestAccounts is missing or invalid")});if(!L||L.length===0)throw new Error("@supabase/auth-js: No accounts available. Please ensure the wallet is connected.");let I=_i(L[0]),P=(r=v?.signInWithEthereum)===null||r===void 0?void 0:r.chainId;if(!P){let q=await w.request({method:"eth_chainId"});P=Yr(q)}let Q={domain:T.host,address:I,statement:g,uri:T.href,version:"1",chainId:P,nonce:(n=v?.signInWithEthereum)===null||n===void 0?void 0:n.nonce,issuedAt:(a=(s=v?.signInWithEthereum)===null||s===void 0?void 0:s.issuedAt)!==null&&a!==void 0?a:new Date,expirationTime:(o=v?.signInWithEthereum)===null||o===void 0?void 0:o.expirationTime,notBefore:(c=v?.signInWithEthereum)===null||c===void 0?void 0:c.notBefore,requestId:(l=v?.signInWithEthereum)===null||l===void 0?void 0:l.requestId,resources:(h=v?.signInWithEthereum)===null||h===void 0?void 0:h.resources};u=Zr(Q),p=await w.request({method:"personal_sign",params:[Qr(u),I]})}try{let{data:m,error:y}=await x(this.fetch,"POST",`${this.url}/token?grant_type=web3`,{headers:this.headers,body:Object.assign({chain:"ethereum",message:u,signature:p},!((d=e.options)===null||d===void 0)&&d.captchaToken?{gotrue_meta_security:{captcha_token:(f=e.options)===null||f===void 0?void 0:f.captchaToken}}:null),xform:G});if(y)throw y;if(!m||!m.session||!m.user){let g=new fe;return this._returnResult({data:{user:null,session:null},error:g})}return m.session&&(await this._saveSession(m.session),await this._notifyAllSubscribers("SIGNED_IN",m.session)),this._returnResult({data:Object.assign({},m),error:y})}catch(m){if(b(m))return this._returnResult({data:{user:null,session:null},error:m});throw m}}async signInWithSolana(e){var t,r,n,s,a,o,c,l,h,d,f,u;let p,m;if("message"in e)p=e.message,m=e.signature;else{let{chain:y,wallet:g,statement:v,options:w}=e,T;if(N())if(typeof g=="object")T=g;else{let I=window;if("solana"in I&&typeof I.solana=="object"&&("signIn"in I.solana&&typeof I.solana.signIn=="function"||"signMessage"in I.solana&&typeof I.solana.signMessage=="function"))T=I.solana;else throw new Error("@supabase/auth-js: No compatible Solana wallet interface on the window object (window.solana) detected. Make sure the user already has a wallet installed and connected for this app. Prefer passing the wallet interface object directly to signInWithWeb3({ chain: 'solana', wallet: resolvedUserWallet }) instead.")}else{if(typeof g!="object"||!w?.url)throw new Error("@supabase/auth-js: Both wallet and url must be specified in non-browser environments.");T=g}let L=new URL((t=w?.url)!==null&&t!==void 0?t:window.location.href);if("signIn"in T&&T.signIn){let I=await T.signIn(Object.assign(Object.assign(Object.assign({issuedAt:new Date().toISOString()},w?.signInWithSolana),{version:"1",domain:L.host,uri:L.href}),v?{statement:v}:null)),P;if(Array.isArray(I)&&I[0]&&typeof I[0]=="object")P=I[0];else if(I&&typeof I=="object"&&"signedMessage"in I&&"signature"in I)P=I;else throw new Error("@supabase/auth-js: Wallet method signIn() returned unrecognized value");if("signedMessage"in P&&"signature"in P&&(typeof P.signedMessage=="string"||P.signedMessage instanceof Uint8Array)&&P.signature instanceof Uint8Array)p=typeof P.signedMessage=="string"?P.signedMessage:new TextDecoder().decode(P.signedMessage),m=P.signature;else throw new Error("@supabase/auth-js: Wallet method signIn() API returned object without signedMessage and signature fields")}else{if(!("signMessage"in T)||typeof T.signMessage!="function"||!("publicKey"in T)||typeof T!="object"||!T.publicKey||!("toBase58"in T.publicKey)||typeof T.publicKey.toBase58!="function")throw new Error("@supabase/auth-js: Wallet does not have a compatible signMessage() and publicKey.toBase58() API");p=[`${L.host} wants you to sign in with your Solana account:`,T.publicKey.toBase58(),...v?["",v,""]:[""],"Version: 1",`URI: ${L.href}`,`Issued At: ${(n=(r=w?.signInWithSolana)===null||r===void 0?void 0:r.issuedAt)!==null&&n!==void 0?n:new Date().toISOString()}`,...!((s=w?.signInWithSolana)===null||s===void 0)&&s.notBefore?[`Not Before: ${w.signInWithSolana.notBefore}`]:[],...!((a=w?.signInWithSolana)===null||a===void 0)&&a.expirationTime?[`Expiration Time: ${w.signInWithSolana.expirationTime}`]:[],...!((o=w?.signInWithSolana)===null||o===void 0)&&o.chainId?[`Chain ID: ${w.signInWithSolana.chainId}`]:[],...!((c=w?.signInWithSolana)===null||c===void 0)&&c.nonce?[`Nonce: ${w.signInWithSolana.nonce}`]:[],...!((l=w?.signInWithSolana)===null||l===void 0)&&l.requestId?[`Request ID: ${w.signInWithSolana.requestId}`]:[],...!((d=(h=w?.signInWithSolana)===null||h===void 0?void 0:h.resources)===null||d===void 0)&&d.length?["Resources",...w.signInWithSolana.resources.map(P=>`- ${P}`)]:[]].join(`
`);let I=await T.signMessage(new TextEncoder().encode(p),"utf8");if(!I||!(I instanceof Uint8Array))throw new Error("@supabase/auth-js: Wallet signMessage() API returned an recognized value");m=I}}try{let{data:y,error:g}=await x(this.fetch,"POST",`${this.url}/token?grant_type=web3`,{headers:this.headers,body:Object.assign({chain:"solana",message:p,signature:pe(m)},!((f=e.options)===null||f===void 0)&&f.captchaToken?{gotrue_meta_security:{captcha_token:(u=e.options)===null||u===void 0?void 0:u.captchaToken}}:null),xform:G});if(g)throw g;if(!y||!y.session||!y.user){let v=new fe;return this._returnResult({data:{user:null,session:null},error:v})}return y.session&&(await this._saveSession(y.session),await this._notifyAllSubscribers("SIGNED_IN",y.session)),this._returnResult({data:Object.assign({},y),error:g})}catch(y){if(b(y))return this._returnResult({data:{user:null,session:null},error:y});throw y}}async _exchangeCodeForSession(e,t){let r=t?.flowId!=null,n=r?yt(t?.flowId):N()?yt(gi(window.location.href)[ue]):null;r&&!n&&this._debug("#_exchangeCodeForSession()","provided flowId is not a valid flow id",t?.flowId);let{verifier:s,flowId:a}=r&&!n?{verifier:null,flowId:null}:await Br(this.storage,this.storageKey,n),[o,c]=(s??"").split("/");try{if(!o&&this.flowType==="pkce")throw new Ht;let{data:l,error:h}=await x(this.fetch,"POST",`${this.url}/token?grant_type=pkce`,{headers:this.headers,body:{auth_code:e,code_verifier:o},xform:G});if(await Y(this.storage,this.storageKey,a),h)throw h;if(!l||!l.session||!l.user){let d=new fe;return this._returnResult({data:{user:null,session:null,redirectType:null},error:d})}return l.session&&(await this._saveSession(l.session),await this._notifyAllSubscribers(c==="recovery"?"PASSWORD_RECOVERY":"SIGNED_IN",l.session)),this._returnResult({data:Object.assign(Object.assign({},l),{redirectType:c??null}),error:h})}catch(l){if(await Y(this.storage,this.storageKey,a),b(l))return this._returnResult({data:{user:null,session:null,redirectType:null},error:l});throw l}}async signInWithIdToken(e){try{let{options:t,provider:r,token:n,access_token:s,nonce:a}=e,o=await x(this.fetch,"POST",`${this.url}/token?grant_type=id_token`,{headers:this.headers,body:{provider:r,id_token:n,access_token:s,nonce:a,gotrue_meta_security:{captcha_token:t?.captchaToken}},xform:G}),{data:c,error:l}=o;if(l)return this._returnResult({data:{user:null,session:null},error:l});if(!c||!c.session||!c.user){let h=new fe;return this._returnResult({data:{user:null,session:null},error:h})}return c.session&&(await this._saveSession(c.session),await this._notifyAllSubscribers("SIGNED_IN",c.session)),this._returnResult({data:c,error:l})}catch(t){if(b(t))return this._returnResult({data:{user:null,session:null},error:t});throw t}}async signInWithOtp(e){var t,r,n,s,a;let o=null;try{if("email"in e){let{email:c,options:l}=e,h=null,d=null;this.flowType==="pkce"&&([h,d,o]=await this._getCodeChallengeAndMethod());let{error:f}=await x(this.fetch,"POST",`${this.url}/otp`,{headers:this.headers,body:{email:c,data:(t=l?.data)!==null&&t!==void 0?t:{},create_user:(r=l?.shouldCreateUser)!==null&&r!==void 0?r:!0,gotrue_meta_security:{captcha_token:l?.captchaToken},code_challenge:h,code_challenge_method:d},redirectTo:this._maybeAppendFlowIdToRedirect(l?.emailRedirectTo,o)});return this._returnResult({data:{user:null,session:null},error:f})}if("phone"in e){let{phone:c,options:l}=e,{data:h,error:d}=await x(this.fetch,"POST",`${this.url}/otp`,{headers:this.headers,body:{phone:c,data:(n=l?.data)!==null&&n!==void 0?n:{},create_user:(s=l?.shouldCreateUser)!==null&&s!==void 0?s:!0,gotrue_meta_security:{captcha_token:l?.captchaToken},channel:(a=l?.channel)!==null&&a!==void 0?a:"sms"}});return this._returnResult({data:{user:null,session:null,messageId:h?.message_id},error:d})}throw new _e("You must provide either an email or phone number.")}catch(c){if(await Y(this.storage,this.storageKey,o),b(c))return this._returnResult({data:{user:null,session:null},error:c});throw c}}async verifyOtp(e){var t,r;try{let n,s;"options"in e&&(n=(t=e.options)===null||t===void 0?void 0:t.redirectTo,s=(r=e.options)===null||r===void 0?void 0:r.captchaToken);let{data:a,error:o}=await x(this.fetch,"POST",`${this.url}/verify`,{headers:this.headers,body:Object.assign(Object.assign({},e),{gotrue_meta_security:{captcha_token:s}}),redirectTo:n,xform:G});if(o)throw o;if(!a)throw new Error("An error occurred on token verification.");let c=a.session,l=a.user;return c?.access_token&&(await this._saveSession(c),await this._notifyAllSubscribers(e.type=="recovery"?"PASSWORD_RECOVERY":"SIGNED_IN",c)),this._returnResult({data:{user:l,session:c},error:null})}catch(n){if(b(n))return this._returnResult({data:{user:null,session:null},error:n});throw n}}async signInWithSSO(e){var t,r,n,s;let a=null;try{let o=null,c=null;this.flowType==="pkce"&&([o,c,a]=await this._getCodeChallengeAndMethod());let l=await x(this.fetch,"POST",`${this.url}/sso`,{body:Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({},"providerId"in e?{provider_id:e.providerId}:null),"domain"in e?{domain:e.domain}:null),{redirect_to:this._maybeAppendFlowIdToRedirect((t=e.options)===null||t===void 0?void 0:t.redirectTo,a)}),!((r=e?.options)===null||r===void 0)&&r.captchaToken?{gotrue_meta_security:{captcha_token:e.options.captchaToken}}:null),{skip_http_redirect:!0,code_challenge:o,code_challenge_method:c}),headers:this.headers,xform:Kr});return!((n=l.data)===null||n===void 0)&&n.url&&N()&&!(!((s=e.options)===null||s===void 0)&&s.skipBrowserRedirect)&&window.location.assign(l.data.url),this._returnResult(l)}catch(o){if(await Y(this.storage,this.storageKey,a),b(o))return this._returnResult({data:null,error:o});throw o}}async reauthenticate(){return await this.initializePromise,this.lock!=null?await this._acquireLock(this.lockAcquireTimeout,async()=>await this._reauthenticate()):await this._reauthenticate()}async _reauthenticate(){try{return await this._useSession(async e=>{let{data:{session:t},error:r}=e;if(r)throw r;if(!t)throw new $;let{error:n}=await x(this.fetch,"GET",`${this.url}/reauthenticate`,{headers:this.headers,jwt:t.access_token});return this._returnResult({data:{user:null,session:null},error:n})})}catch(e){if(b(e))return this._returnResult({data:{user:null,session:null},error:e});throw e}}async resend(e){let t=null;try{let r=`${this.url}/resend`;if("email"in e){let{email:n,type:s,options:a}=e,o=null,c=null;this.flowType==="pkce"&&([o,c,t]=await this._getCodeChallengeAndMethod());let{error:l}=await x(this.fetch,"POST",r,{headers:this.headers,body:{email:n,type:s,gotrue_meta_security:{captcha_token:a?.captchaToken},code_challenge:o,code_challenge_method:c},redirectTo:this._maybeAppendFlowIdToRedirect(a?.emailRedirectTo,t)});return l&&await Y(this.storage,this.storageKey,t),this._returnResult({data:{user:null,session:null},error:l})}else if("phone"in e){let{phone:n,type:s,options:a}=e,{data:o,error:c}=await x(this.fetch,"POST",r,{headers:this.headers,body:{phone:n,type:s,gotrue_meta_security:{captcha_token:a?.captchaToken}}});return this._returnResult({data:{user:null,session:null,messageId:o?.message_id},error:c})}throw new _e("You must provide either an email or phone number and a type")}catch(r){if(await Y(this.storage,this.storageKey,t),b(r))return this._returnResult({data:{user:null,session:null},error:r});throw r}}async getSession(){return await this.initializePromise,this.lock!=null?await this._acquireLock(this.lockAcquireTimeout,async()=>this._useSession(async e=>e)):await this._useSession(async e=>e)}async _acquireLock(e,t){this._debug("#_acquireLock","begin",e);try{if(this.lockAcquired){let r=this.pendingInLock.length?this.pendingInLock[this.pendingInLock.length-1]:Promise.resolve(),n=(async()=>(await r,await t()))();return this.pendingInLock.push((async()=>{try{await n}catch{}})()),n}return await this.lock(`lock:${this.storageKey}`,e,async()=>{this._debug("#_acquireLock","lock acquired for storage key",this.storageKey);try{this.lockAcquired=!0;let r=t();for(this.pendingInLock.push((async()=>{try{await r}catch{}})()),await r;this.pendingInLock.length;){let n=[...this.pendingInLock];await Promise.all(n),this.pendingInLock.splice(0,n.length)}return await r}finally{this._debug("#_acquireLock","lock released for storage key",this.storageKey),this.lockAcquired=!1}})}finally{this._debug("#_acquireLock","end")}}async _useSession(e){this._debug("#_useSession","begin");try{let t=await this.__loadSession();return await e(t)}finally{this._debug("#_useSession","end")}}async __loadSession(){this._debug("#__loadSession()","begin"),this.lock!=null&&!this.lockAcquired&&this._debug("#__loadSession()","used outside of an acquired lock!",new Error().stack);try{let e=null,t=await D(this.storage,this.storageKey);if(this._debug("#getSession()","session from storage",t),t!==null&&(this._isValidSession(t)?e=t:(this._debug("#getSession()","session from storage is not valid"),await this._removeSession())),!e)return{data:{session:null},error:null};let r=e.expires_at?e.expires_at*1e3-Date.now()<Bt:!1;if(this._debug("#__loadSession()",`session has${r?"":" not"} expired`,"expires_at",e.expires_at),!r){if(this.userStorage){let a=await D(this.userStorage,this.storageKey+"-user");a?.user?e.user=a.user:e.user=qt()}if(this.storage.isServer&&e.user&&!e.user.__isUserNotAvailableProxy){let a={value:this.suppressGetSessionWarning};e.user=Fr(e.user,a),a.value&&(this.suppressGetSessionWarning=!0)}return{data:{session:e},error:null}}let{data:n,error:s}=await this._callRefreshToken(e.refresh_token);if(s){if(!!(e.expires_at&&e.expires_at*1e3>Date.now())){let o=await D(this.storage,this.storageKey);if(o&&o.refresh_token===e.refresh_token)return this._returnResult({data:{session:e},error:null})}return this._returnResult({data:{session:null},error:s})}return this._returnResult({data:{session:n},error:null})}finally{this._debug("#__loadSession()","end")}}async getUser(e){if(e)return await this._getUser(e);await this.initializePromise;let t;return this.lock!=null?t=await this._acquireLock(this.lockAcquireTimeout,async()=>await this._getUser()):t=await this._getUser(),t.data.user&&(this.suppressGetSessionWarning=!0),t}async _getUser(e){try{return e?await x(this.fetch,"GET",`${this.url}/user`,{headers:this.headers,jwt:e,xform:he}):await this._useSession(async t=>{var r,n,s;let{data:a,error:o}=t;if(o)throw o;return!(!((r=a.session)===null||r===void 0)&&r.access_token)&&!this.hasCustomAuthorizationHeader?{data:{user:null},error:new $}:await x(this.fetch,"GET",`${this.url}/user`,{headers:this.headers,jwt:(s=(n=a.session)===null||n===void 0?void 0:n.access_token)!==null&&s!==void 0?s:void 0,xform:he})})}catch(t){if(b(t))return ut(t)&&await this._removeSession(),this._returnResult({data:{user:null},error:t});throw t}}async updateUser(e,t={}){return await this.initializePromise,this.lock!=null?await this._acquireLock(this.lockAcquireTimeout,async()=>await this._updateUser(e,t)):await this._updateUser(e,t)}async _updateUser(e,t={}){let r=null;try{return await this._useSession(async n=>{let{data:s,error:a}=n;if(a)throw a;if(!s.session)throw new $;let o=s.session,c=null,l=null;this.flowType==="pkce"&&e.email!=null&&([c,l,r]=await this._getCodeChallengeAndMethod());let{data:h,error:d}=await x(this.fetch,"PUT",`${this.url}/user`,{headers:this.headers,redirectTo:this._maybeAppendFlowIdToRedirect(t?.emailRedirectTo,r),body:Object.assign(Object.assign({},e),{code_challenge:c,code_challenge_method:l}),jwt:o.access_token,xform:he});if(d)throw d;return o.user=h.user,await this._saveSession(o),await this._notifyAllSubscribers("USER_UPDATED",o),this._returnResult({data:{user:o.user},error:null})})}catch(n){if(await Y(this.storage,this.storageKey,r),b(n))return this._returnResult({data:{user:null},error:n});throw n}}async setSession(e){return await this.initializePromise,this.lock!=null?await this._acquireLock(this.lockAcquireTimeout,async()=>await this._setSession(e)):await this._setSession(e)}async _setSession(e){try{if(!e.access_token||!e.refresh_token)throw new $;let t=Date.now()/1e3,r=t,n=!0,s=null,{payload:a}=mt(e.access_token);if(a.exp&&(r=a.exp,n=r<=t),n){let{data:o,error:c}=await this._callRefreshToken(e.refresh_token);if(c)return this._returnResult({data:{user:null,session:null},error:c});if(!o)return{data:{user:null,session:null},error:null};s=o}else{let{data:o,error:c}=await this._getUser(e.access_token);if(c)return this._returnResult({data:{user:null,session:null},error:c});s={access_token:e.access_token,refresh_token:e.refresh_token,user:o.user,token_type:"bearer",expires_in:r-t,expires_at:r},await this._saveSession(s),await this._notifyAllSubscribers("SIGNED_IN",s)}return this._returnResult({data:{user:s.user,session:s},error:null})}catch(t){if(b(t))return this._returnResult({data:{session:null,user:null},error:t});throw t}}async refreshSession(e){return await this.initializePromise,this.lock!=null?await this._acquireLock(this.lockAcquireTimeout,async()=>await this._refreshSession(e)):await this._refreshSession(e)}async _refreshSession(e){try{return await this._useSession(async t=>{var r;if(!e){let{data:a,error:o}=t;if(o)throw o;e=(r=a.session)!==null&&r!==void 0?r:void 0}if(!e?.refresh_token)throw new $;let{data:n,error:s}=await this._callRefreshToken(e.refresh_token);return s?this._returnResult({data:{user:null,session:null},error:s}):n?this._returnResult({data:{user:n.user,session:n},error:null}):this._returnResult({data:{user:null,session:null},error:null})})}catch(t){if(b(t))return this._returnResult({data:{user:null,session:null},error:t});throw t}}async _getSessionFromURL(e,t){var r;try{if(!N())throw new xe("No browser detected.");if(e.error||e.error_description||e.error_code)throw new xe(e.error_description||"Error in URL with unspecified error_description",{error:e.error||"unspecified_error",code:e.error_code||"unspecified_code"});switch(t){case"implicit":if(this.flowType==="pkce")throw new lt("Not a valid PKCE flow url.");break;case"pkce":if(this.flowType==="implicit")throw new xe("Not a valid implicit grant flow url.");break;default:}if(t==="pkce"){if(this._debug("#_initialize()","begin","is PKCE flow",!0),!e.code)throw new lt("No code detected.");let{data:w,error:T}=await this._exchangeCodeForSession(e.code,{flowId:e[ue]});if(T)throw T;let L=new URL(window.location.href);return L.searchParams.delete("code"),L.searchParams.delete(ue),window.history.replaceState(window.history.state,"",L.toString()),{data:{session:w.session,redirectType:(r=w.redirectType)!==null&&r!==void 0?r:null},error:null}}let{provider_token:n,provider_refresh_token:s,access_token:a,refresh_token:o,expires_in:c,expires_at:l,token_type:h}=e;if(!a||!c||!o||!h)throw new xe("No session defined in URL");let d=Math.round(Date.now()/1e3),f=parseInt(c),u=d+f;l&&(u=parseInt(l));let p=u-d;p*1e3<=oe&&console.warn(`@supabase/gotrue-js: Session as retrieved from URL expires in ${p}s, should have been closer to ${f}s`);let m=u-f;d-m>=120?console.warn("@supabase/gotrue-js: Session as retrieved from URL was issued over 120s ago, URL could be stale",m,u,d):d-m<0&&console.warn("@supabase/gotrue-js: Session as retrieved from URL was issued in the future? Check the device clock for skew",m,u,d);let{data:y,error:g}=await this._getUser(a);if(g)throw g;let v={provider_token:n,provider_refresh_token:s,access_token:a,expires_in:f,expires_at:u,refresh_token:o,token_type:h,user:y.user};return window.location.hash="",this._debug("#_getSessionFromURL()","clearing window.location.hash"),this._returnResult({data:{session:v,redirectType:e.type},error:null})}catch(n){if(b(n))return this._returnResult({data:{session:null,redirectType:null},error:n});throw n}}_isImplicitGrantCallback(e){return typeof this.detectSessionInUrl=="function"?this.detectSessionInUrl(new URL(window.location.href),e):!!(e.access_token||e.error||e.error_description||e.error_code)}async _isPKCECallback(e){if(!e.code)return!1;let t=yt(e[ue]);return t&&await D(this.storage,Te(this.storageKey,t))?!0:!!await D(this.storage,`${this.storageKey}-code-verifier`)}async signOut(e={scope:"global"}){return await this.initializePromise,this.lock!=null?await this._acquireLock(this.lockAcquireTimeout,async()=>await this._signOut(e)):await this._signOut(e)}async _signOut({scope:e}={scope:"global"}){return await this._useSession(async t=>{var r;let n=async()=>{await this._removeSession()},{data:s,error:a}=t;if(a&&!ut(a))return this._returnResult({error:a});let o=(r=s.session)===null||r===void 0?void 0:r.access_token;if(o){let{error:c}=await this.admin.signOut(o,e);if(c&&!(fi(c)&&(c.status===404||c.status===401||c.status===403)||ut(c)))return e!=="others"&&await n(),this._returnResult({error:c})}return e!=="others"&&await n(),this._returnResult({error:null})})}onAuthStateChange(e){let t=Lr(),r={id:t,callback:e,unsubscribe:()=>{this._debug("#unsubscribe()","state change callback with id removed",t),this.stateChangeEmitters.delete(t)}};return this._debug("#onAuthStateChange()","registered callback with id",t),this.stateChangeEmitters.set(t,r),(async()=>(await this.initializePromise,this.lock!=null?await this._acquireLock(this.lockAcquireTimeout,async()=>{this._emitInitialSession(t)}):await this._emitInitialSession(t)))(),{data:{subscription:r}}}async _emitInitialSession(e){return await this._useSession(async t=>{var r,n;try{let{data:{session:s},error:a}=t;if(a)throw a;await((r=this.stateChangeEmitters.get(e))===null||r===void 0?void 0:r.callback("INITIAL_SESSION",s)),this._debug("INITIAL_SESSION","callback id",e,"session",s)}catch(s){await((n=this.stateChangeEmitters.get(e))===null||n===void 0?void 0:n.callback("INITIAL_SESSION",null)),this._debug("INITIAL_SESSION","callback id",e,"error",s),ut(s)||ft(s)||fi(s)&&(s.code==="refresh_token_not_found"||s.code==="refresh_token_already_used"||s.code==="session_expired")?console.warn(s):console.error(s)}})}async resetPasswordForEmail(e,t={}){let r=null,n=null,s=null;this.flowType==="pkce"&&([r,n,s]=await this._getCodeChallengeAndMethod(!0));try{return await x(this.fetch,"POST",`${this.url}/recover`,{body:{email:e,code_challenge:r,code_challenge_method:n,gotrue_meta_security:{captcha_token:t.captchaToken}},headers:this.headers,redirectTo:this._maybeAppendFlowIdToRedirect(t.redirectTo,s)})}catch(a){if(await Y(this.storage,this.storageKey,s),b(a))return this._returnResult({data:null,error:a});throw a}}async getUserIdentities(){var e;try{let{data:t,error:r}=await this.getUser();if(r)throw r;return this._returnResult({data:{identities:(e=t.user.identities)!==null&&e!==void 0?e:[]},error:null})}catch(t){if(b(t))return this._returnResult({data:null,error:t});throw t}}async linkIdentity(e){return"token"in e?this.linkIdentityIdToken(e):this.linkIdentityOAuth(e)}async linkIdentityOAuth(e){var t;let r=null;try{let{data:n,error:s}=await this._useSession(async a=>{var o,c,l,h,d;let{data:f,error:u}=a;if(u)throw u;let{url:p,flowId:m}=await this._getUrlForProvider(`${this.url}/user/identities/authorize`,e.provider,{redirectTo:(o=e.options)===null||o===void 0?void 0:o.redirectTo,scopes:(c=e.options)===null||c===void 0?void 0:c.scopes,queryParams:(l=e.options)===null||l===void 0?void 0:l.queryParams,skipBrowserRedirect:!0});return r=m,await x(this.fetch,"GET",p,{headers:this.headers,jwt:(d=(h=f.session)===null||h===void 0?void 0:h.access_token)!==null&&d!==void 0?d:void 0})});if(s)throw s;return N()&&!(!((t=e.options)===null||t===void 0)&&t.skipBrowserRedirect)&&window.location.assign(n?.url),this._returnResult({data:{provider:e.provider,url:n?.url,flowId:r},error:null})}catch(n){if(b(n))return this._returnResult({data:{provider:e.provider,url:null,flowId:r},error:n});throw n}}async linkIdentityIdToken(e){return await this._useSession(async t=>{var r;try{let{error:n,data:{session:s}}=t;if(n)throw n;let{options:a,provider:o,token:c,access_token:l,nonce:h}=e,d=await x(this.fetch,"POST",`${this.url}/token?grant_type=id_token`,{headers:this.headers,jwt:(r=s?.access_token)!==null&&r!==void 0?r:void 0,body:{provider:o,id_token:c,access_token:l,nonce:h,link_identity:!0,gotrue_meta_security:{captcha_token:a?.captchaToken}},xform:G}),{data:f,error:u}=d;return u?this._returnResult({data:{user:null,session:null},error:u}):!f||!f.session||!f.user?this._returnResult({data:{user:null,session:null},error:new fe}):(f.session&&(await this._saveSession(f.session),await this._notifyAllSubscribers("USER_UPDATED",f.session)),this._returnResult({data:f,error:u}))}catch(n){if(await Y(this.storage,this.storageKey,null),b(n))return this._returnResult({data:{user:null,session:null},error:n});throw n}})}async unlinkIdentity(e){try{return await this._useSession(async t=>{var r,n;let{data:s,error:a}=t;if(a)throw a;return await x(this.fetch,"DELETE",`${this.url}/user/identities/${e.identity_id}`,{headers:this.headers,jwt:(n=(r=s.session)===null||r===void 0?void 0:r.access_token)!==null&&n!==void 0?n:void 0})})}catch(t){if(b(t))return this._returnResult({data:null,error:t});throw t}}async _refreshAccessToken(e){let t="#_refreshAccessToken()";this._debug(t,"begin");try{let r=Date.now();return await $r(async n=>(n>0&&await jr(200*Math.pow(2,n-1)),this._debug(t,"refreshing attempt",n),await x(this.fetch,"POST",`${this.url}/token?grant_type=refresh_token`,{body:{refresh_token:e},headers:this.headers,xform:G})),(n,s)=>{let a=200*Math.pow(2,n);return s&&ft(s)&&Date.now()+a-r<oe})}catch(r){if(this._debug(t,"error",r),b(r))return this._returnResult({data:{session:null,user:null},error:r});throw r}finally{this._debug(t,"end")}}_isValidSession(e){return typeof e=="object"&&e!==null&&"access_token"in e&&"refresh_token"in e&&"expires_at"in e}async _handleProviderSignIn(e,t){let{url:r,flowId:n}=await this._getUrlForProvider(`${this.url}/authorize`,e,{redirectTo:t.redirectTo,scopes:t.scopes,queryParams:t.queryParams});return this._debug("#_handleProviderSignIn()","provider",e,"options",t,"url",r),N()&&!t.skipBrowserRedirect&&window.location.assign(r),{data:{provider:e,url:r,flowId:n},error:null}}async _recoverAndRefresh(){var e,t;let r="#_recoverAndRefresh()";this._debug(r,"begin");try{let n=await D(this.storage,this.storageKey);if(n&&this.userStorage){let a=await D(this.userStorage,this.storageKey+"-user");!this.storage.isServer&&Object.is(this.storage,this.userStorage)&&!a&&(a={user:n.user},await ce(this.userStorage,this.storageKey+"-user",a)),n.user=(e=a?.user)!==null&&e!==void 0?e:qt()}else if(n&&!n.user&&!n.user){let a=await D(this.storage,this.storageKey+"-user");a&&a?.user?(n.user=a.user,await F(this.storage,this.storageKey+"-user"),await ce(this.storage,this.storageKey,n)):n.user=qt()}if(this._debug(r,"session from storage",n),!this._isValidSession(n)){this._debug(r,"session is not valid"),n!==null&&await this._removeSession();return}let s=((t=n.expires_at)!==null&&t!==void 0?t:1/0)*1e3-Date.now()<Bt;if(this._debug(r,`session has${s?"":" not"} expired with margin of ${Bt}s`),s){if(this.autoRefreshToken&&n.refresh_token){let{error:a}=await this._callRefreshToken(n.refresh_token);a&&(Sr(a)?this._debug(r,"refresh discarded by commit guard",a):this._debug(r,"refresh failed",a))}}else if(n.user&&n.user.__isUserNotAvailableProxy===!0)try{let{data:a,error:o}=await this._getUser(n.access_token);!o&&a?.user?(n.user=a.user,await this._saveSession(n),await this._notifyAllSubscribers("SIGNED_IN",n)):this._debug(r,"could not get user data, skipping SIGNED_IN notification")}catch(a){console.error("Error getting user data:",a),this._debug(r,"error getting user data, skipping SIGNED_IN notification",a)}else await this._notifyAllSubscribers("SIGNED_IN",n)}catch(n){this._debug(r,"error",n),ft(n)?console.warn(n):console.error(n);return}finally{this._debug(r,"end")}}async _callRefreshToken(e){var t,r;if(!e)throw new $;if(this.refreshingDeferred)return this.refreshingDeferred.promise;if(this.lastRefreshFailure&&this.lastRefreshFailure.refreshToken===e&&Date.now()<this.lastRefreshFailure.expiresAt)return this._debug("#_callRefreshToken()","returning cached failure (cooldown active)"),this.lastRefreshFailure.result;let n="#_callRefreshToken()";this._debug(n,"begin");try{this.refreshingDeferred=new pt,this.refreshingDeferred.promise.then(void 0,()=>{});let s=await D(this.storage,this.storageKey),{data:a,error:o}=await this._refreshAccessToken(e);if(o)throw o;if(!a.session)throw new $;let c=await D(this.storage,this.storageKey);if(s!==null&&(c===null||c.refresh_token!==s.refresh_token)){this._debug(n,"commit guard: storage changed since refresh started, discarding rotated tokens",{startedWith:"present",nowHolds:c?"replaced":"cleared"});let f={data:null,error:new ht};return this.refreshingDeferred.resolve(f),f}let h=this._sessionRemovalEpoch;if(await this._saveSession(a.session),this._sessionRemovalEpoch!==h){this._debug(n,"commit guard (post-save): _removeSession ran during _saveSession, undoing write"),await F(this.storage,this.storageKey),this.userStorage&&await F(this.userStorage,this.storageKey+"-user");let f={data:null,error:new ht};return this.refreshingDeferred.resolve(f),f}await this._notifyAllSubscribers("TOKEN_REFRESHED",a.session);let d={data:a.session,error:null};return this.lastRefreshFailure=null,this.refreshingDeferred.resolve(d),d}catch(s){if(this._debug(n,"error",s),b(s)){let a={data:null,error:s};if(!ft(s)){let o=await D(this.storage,this.storageKey);!!(o?.expires_at&&o.expires_at*1e3>Date.now())?this._debug(n,"proactive refresh failed, access token still valid \u2014 preserving session"):await this._removeSession()}return this.lastRefreshFailure={refreshToken:e,result:a,expiresAt:Date.now()+vr},(t=this.refreshingDeferred)===null||t===void 0||t.resolve(a),a}throw(r=this.refreshingDeferred)===null||r===void 0||r.reject(s),s}finally{this.refreshingDeferred=null,this._debug(n,"end")}}async _notifyAllSubscribers(e,t,r=!0){if(this._pendingInitNotifications!==null&&r){this._pendingInitNotifications.push({event:e,session:t,broadcast:r});return}let n=`#_notifyAllSubscribers(${e})`;this._debug(n,"begin",t,`broadcast = ${r}`);try{this.broadcastChannel&&r&&this.broadcastChannel.postMessage({event:e,session:t});let s=[],a=Array.from(this.stateChangeEmitters.values()).map(async o=>{try{await o.callback(e,t)}catch(c){s.push(c)}});if(await Promise.all(a),s.length>0){for(let o=0;o<s.length;o+=1)console.error(s[o]);throw s[0]}}finally{this._debug(n,"end")}}async _saveSession(e){this._debug("#_saveSession()",e),this.suppressGetSessionWarning=!0;let t=Object.assign({},e),r=t.user&&t.user.__isUserNotAvailableProxy===!0;if(this.userStorage){!r&&t.user&&await ce(this.userStorage,this.storageKey+"-user",{user:t.user});let n=Object.assign({},t);delete n.user;let s=yi(n);await ce(this.storage,this.storageKey,s)}else{let n=yi(t);await ce(this.storage,this.storageKey,n)}}async _removeSession(){this._sessionRemovalEpoch+=1,this._debug("#_removeSession()"),this.lastRefreshFailure=null,this.suppressGetSessionWarning=!1,await F(this.storage,this.storageKey),await Nr(this.storage,this.storageKey),await F(this.storage,this.storageKey+"-user"),this.userStorage&&await F(this.userStorage,this.storageKey+"-user"),await this._notifyAllSubscribers("SIGNED_OUT",null)}_removeVisibilityChangedCallback(){this._debug("#_removeVisibilityChangedCallback()");let e=this.visibilityChangedCallback;this.visibilityChangedCallback=null;try{e&&N()&&window?.removeEventListener&&window.removeEventListener("visibilitychange",e)}catch(t){console.error("removing visibilitychange callback failed",t)}}async _startAutoRefresh(){await this._stopAutoRefresh(),this._debug("#_startAutoRefresh()");let e=setInterval(()=>this._autoRefreshTokenTick(),oe);this.autoRefreshTicker=e,e&&typeof e=="object"&&typeof e.unref=="function"?e.unref():typeof Deno<"u"&&typeof Deno.unrefTimer=="function"&&Deno.unrefTimer(e);let t=setTimeout(async()=>{await this.initializePromise,await this._autoRefreshTokenTick()},0);this.autoRefreshTickTimeout=t,t&&typeof t=="object"&&typeof t.unref=="function"?t.unref():typeof Deno<"u"&&typeof Deno.unrefTimer=="function"&&Deno.unrefTimer(t)}async _stopAutoRefresh(){this._debug("#_stopAutoRefresh()");let e=this.autoRefreshTicker;this.autoRefreshTicker=null,e&&clearInterval(e);let t=this.autoRefreshTickTimeout;this.autoRefreshTickTimeout=null,t&&clearTimeout(t)}async startAutoRefresh(){this._removeVisibilityChangedCallback(),await this._startAutoRefresh()}async stopAutoRefresh(){this._removeVisibilityChangedCallback(),await this._stopAutoRefresh()}async dispose(){var e;this._removeVisibilityChangedCallback(),await this._stopAutoRefresh(),(e=this.broadcastChannel)===null||e===void 0||e.close(),this.broadcastChannel=null,this.stateChangeEmitters.clear()}async _autoRefreshTokenTick(){if(this._debug("#_autoRefreshTokenTick()","begin"),this.lock!=null){try{await this._acquireLock(0,async()=>{try{let e=Date.now();try{return await this._useSession(async t=>{let{data:{session:r}}=t;if(!r||!r.refresh_token||!r.expires_at){this._debug("#_autoRefreshTokenTick()","no session");return}let n=Math.floor((r.expires_at*1e3-e)/oe);this._debug("#_autoRefreshTokenTick()",`access token expires in ${n} ticks, a tick lasts ${oe}ms, refresh threshold is ${qe} ticks`),n<=qe&&await this._callRefreshToken(r.refresh_token)})}catch(t){console.error("Auto refresh tick failed with error. This is likely a transient error.",t)}}finally{this._debug("#_autoRefreshTokenTick()","end")}})}catch(e){if(e instanceof Wt)this._debug("auto refresh token tick lock not available");else throw e}return}if(this.refreshingDeferred!==null){this._debug("#_autoRefreshTokenTick()","refresh already in flight, skipping");return}try{let e=Date.now();try{await this._useSession(async t=>{let{data:{session:r}}=t;if(!r||!r.refresh_token||!r.expires_at){this._debug("#_autoRefreshTokenTick()","no session");return}let n=Math.floor((r.expires_at*1e3-e)/oe);this._debug("#_autoRefreshTokenTick()",`access token expires in ${n} ticks, a tick lasts ${oe}ms, refresh threshold is ${qe} ticks`),n<=qe&&await this._callRefreshToken(r.refresh_token)})}catch(t){console.error("Auto refresh tick failed with error. This is likely a transient error.",t)}}finally{this._debug("#_autoRefreshTokenTick()","end")}}async _handleVisibilityChange(){if(this._debug("#_handleVisibilityChange()"),!N()||!window?.addEventListener)return this.autoRefreshToken&&this.startAutoRefresh(),!1;try{this.visibilityChangedCallback=async()=>{try{await this._onVisibilityChanged(!1)}catch(e){this._debug("#visibilityChangedCallback","error",e)}},window?.addEventListener("visibilitychange",this.visibilityChangedCallback),await this._onVisibilityChanged(!0)}catch(e){console.error("_handleVisibilityChange",e)}}async _onVisibilityChanged(e){let t=`#_onVisibilityChanged(${e})`;if(this._debug(t,"visibilityState",document.visibilityState),document.visibilityState==="visible"){if(this.autoRefreshToken&&this._startAutoRefresh(),!e)if(await this.initializePromise,this.lock!=null)await this._acquireLock(this.lockAcquireTimeout,async()=>{if(document.visibilityState!=="visible"){this._debug(t,"acquired the lock to recover the session, but the browser visibilityState is no longer visible, aborting");return}await this._recoverAndRefresh()});else{if(document.visibilityState!=="visible"){this._debug(t,"visibilityState is no longer visible, skipping recovery");return}await this._recoverAndRefresh()}}else document.visibilityState==="hidden"&&this.autoRefreshToken&&this._stopAutoRefresh()}async _getUrlForProvider(e,t,r){let n=r?.redirectTo,s=null,a=null,o=null;this.flowType==="pkce"&&([s,a,o]=await this._getCodeChallengeAndMethod(),n=this._maybeAppendFlowIdToRedirect(n,o));let c=[`provider=${encodeURIComponent(t)}`];if(n&&c.push(`redirect_to=${encodeURIComponent(n)}`),r?.scopes&&c.push(`scopes=${encodeURIComponent(r.scopes)}`),s!=null&&a!=null){let l=new URLSearchParams({code_challenge:`${encodeURIComponent(s)}`,code_challenge_method:`${encodeURIComponent(a)}`});c.push(l.toString())}if(r?.queryParams){let l=new URLSearchParams(r.queryParams);c.push(l.toString())}return r?.skipBrowserRedirect&&c.push(`skip_http_redirect=${r.skipBrowserRedirect}`),{url:`${e}?${c.join("&")}`,flowId:o}}_maybeAppendFlowIdToRedirect(e,t){return!e||!t||!this.experimental.appendPkceFlowIdToRedirects?e??void 0:Hr(e,t)}async _getCodeChallengeAndMethod(e=!1){return Ur(this.storage,this.storageKey,e,t=>this._debug("#_getCodeChallengeAndMethod()","evicted oldest pending PKCE verifier slot",t))}async _unenroll(e){try{return await this._useSession(async t=>{var r;let{data:n,error:s}=t;return s?this._returnResult({data:null,error:s}):await x(this.fetch,"DELETE",`${this.url}/factors/${e.factorId}`,{headers:this.headers,jwt:(r=n?.session)===null||r===void 0?void 0:r.access_token})})}catch(t){if(b(t))return this._returnResult({data:null,error:t});throw t}}async _enroll(e){try{return await this._useSession(async t=>{var r,n;let{data:s,error:a}=t;if(a)return this._returnResult({data:null,error:a});let o=Object.assign({friendly_name:e.friendlyName,factor_type:e.factorType},e.factorType==="phone"?{phone:e.phone}:e.factorType==="totp"?{issuer:e.issuer}:{}),{data:c,error:l}=await x(this.fetch,"POST",`${this.url}/factors`,{body:o,headers:this.headers,jwt:(r=s?.session)===null||r===void 0?void 0:r.access_token});return l?this._returnResult({data:null,error:l}):(e.factorType==="totp"&&c.type==="totp"&&(!((n=c?.totp)===null||n===void 0)&&n.qr_code)&&(c.totp.qr_code=`data:image/svg+xml;utf-8,${c.totp.qr_code}`),this._returnResult({data:c,error:null}))})}catch(t){if(b(t))return this._returnResult({data:null,error:t});throw t}}async _verify(e){let t=async()=>{try{return await this._useSession(async r=>{var n;let{data:s,error:a}=r;if(a)return this._returnResult({data:null,error:a});let o=Object.assign({challenge_id:e.challengeId},"webauthn"in e?{webauthn:Object.assign(Object.assign({},e.webauthn),{credential_response:e.webauthn.type==="create"?Si(e.webauthn.credential_response):Ai(e.webauthn.credential_response)})}:{code:e.code}),{data:c,error:l}=await x(this.fetch,"POST",`${this.url}/factors/${e.factorId}/verify`,{body:o,headers:this.headers,jwt:(n=s?.session)===null||n===void 0?void 0:n.access_token});return l?this._returnResult({data:null,error:l}):(await this._saveSession(Object.assign({expires_at:Math.round(Date.now()/1e3)+c.expires_in},c)),await this._notifyAllSubscribers("MFA_CHALLENGE_VERIFIED",c),this._returnResult({data:c,error:l}))})}catch(r){if(b(r))return this._returnResult({data:null,error:r});throw r}};return this.lock!=null?this._acquireLock(this.lockAcquireTimeout,t):t()}async _challenge(e){let t=async()=>{try{return await this._useSession(async r=>{var n;let{data:s,error:a}=r;if(a)return this._returnResult({data:null,error:a});let o=await x(this.fetch,"POST",`${this.url}/factors/${e.factorId}/challenge`,{body:e,headers:this.headers,jwt:(n=s?.session)===null||n===void 0?void 0:n.access_token});if(o.error)return o;let{data:c}=o;if(c.type!=="webauthn")return{data:c,error:null};switch(c.webauthn.type){case"create":return{data:Object.assign(Object.assign({},c),{webauthn:Object.assign(Object.assign({},c.webauthn),{credential_options:Object.assign(Object.assign({},c.webauthn.credential_options),{publicKey:Ei(c.webauthn.credential_options.publicKey)})})}),error:null};case"request":return{data:Object.assign(Object.assign({},c),{webauthn:Object.assign(Object.assign({},c.webauthn),{credential_options:Object.assign(Object.assign({},c.webauthn.credential_options),{publicKey:Ti(c.webauthn.credential_options.publicKey)})})}),error:null}}})}catch(r){if(b(r))return this._returnResult({data:null,error:r});throw r}};return this.lock!=null?this._acquireLock(this.lockAcquireTimeout,t):t()}async _challengeAndVerify(e){let{data:t,error:r}=await this._challenge({factorId:e.factorId});return r?this._returnResult({data:null,error:r}):await this._verify({factorId:e.factorId,challengeId:t.id,code:e.code})}async _listFactors(){var e;let{data:{user:t},error:r}=await this.getUser();if(r)return{data:null,error:r};let n={all:[],phone:[],totp:[],webauthn:[]};for(let s of(e=t?.factors)!==null&&e!==void 0?e:[])n.all.push(s),s.status==="verified"&&n[s.factor_type].push(s);return{data:n,error:null}}async _getAuthenticatorAssuranceLevel(e){var t,r,n,s;if(e)try{let{payload:u}=mt(e),p=null;u.aal&&(p=u.aal);let m=p,{data:{user:y},error:g}=await this.getUser(e);if(g)return this._returnResult({data:null,error:g});((r=(t=y?.factors)===null||t===void 0?void 0:t.filter(T=>T.status==="verified"))!==null&&r!==void 0?r:[]).length>0&&(m="aal2");let w=u.amr||[];return{data:{currentLevel:p,nextLevel:m,currentAuthenticationMethods:w},error:null}}catch(u){if(b(u))return this._returnResult({data:null,error:u});throw u}let{data:{session:a},error:o}=await this.getSession();if(o)return this._returnResult({data:null,error:o});if(!a)return{data:{currentLevel:null,nextLevel:null,currentAuthenticationMethods:[]},error:null};let{payload:c}=mt(a.access_token),l=null;c.aal&&(l=c.aal);let h=l;((s=(n=a.user.factors)===null||n===void 0?void 0:n.filter(u=>u.status==="verified"))!==null&&s!==void 0?s:[]).length>0&&(h="aal2");let f=c.amr||[];return{data:{currentLevel:l,nextLevel:h,currentAuthenticationMethods:f},error:null}}async _getAuthorizationDetails(e){try{return await this._useSession(async t=>{let{data:{session:r},error:n}=t;return n?this._returnResult({data:null,error:n}):r?await x(this.fetch,"GET",`${this.url}/oauth/authorizations/${e}`,{headers:this.headers,jwt:r.access_token,xform:s=>({data:s,error:null})}):this._returnResult({data:null,error:new $})})}catch(t){if(b(t))return this._returnResult({data:null,error:t});throw t}}async _approveAuthorization(e,t){try{return await this._useSession(async r=>{let{data:{session:n},error:s}=r;if(s)return this._returnResult({data:null,error:s});if(!n)return this._returnResult({data:null,error:new $});let a=await x(this.fetch,"POST",`${this.url}/oauth/authorizations/${e}/consent`,{headers:this.headers,jwt:n.access_token,body:{action:"approve"},xform:o=>({data:o,error:null})});return a.data&&a.data.redirect_url&&N()&&!t?.skipBrowserRedirect&&window.location.assign(a.data.redirect_url),a})}catch(r){if(b(r))return this._returnResult({data:null,error:r});throw r}}async _denyAuthorization(e,t){try{return await this._useSession(async r=>{let{data:{session:n},error:s}=r;if(s)return this._returnResult({data:null,error:s});if(!n)return this._returnResult({data:null,error:new $});let a=await x(this.fetch,"POST",`${this.url}/oauth/authorizations/${e}/consent`,{headers:this.headers,jwt:n.access_token,body:{action:"deny"},xform:o=>({data:o,error:null})});return a.data&&a.data.redirect_url&&N()&&!t?.skipBrowserRedirect&&window.location.assign(a.data.redirect_url),a})}catch(r){if(b(r))return this._returnResult({data:null,error:r});throw r}}async _listOAuthGrants(){try{return await this._useSession(async e=>{let{data:{session:t},error:r}=e;return r?this._returnResult({data:null,error:r}):t?await x(this.fetch,"GET",`${this.url}/user/oauth/grants`,{headers:this.headers,jwt:t.access_token,xform:n=>({data:n,error:null})}):this._returnResult({data:null,error:new $})})}catch(e){if(b(e))return this._returnResult({data:null,error:e});throw e}}async _revokeOAuthGrant(e){try{return await this._useSession(async t=>{let{data:{session:r},error:n}=t;return n?this._returnResult({data:null,error:n}):r?(await x(this.fetch,"DELETE",`${this.url}/user/oauth/grants`,{headers:this.headers,jwt:r.access_token,query:{client_id:e.clientId},noResolveJson:!0}),{data:{},error:null}):this._returnResult({data:null,error:new $})})}catch(t){if(b(t))return this._returnResult({data:null,error:t});throw t}}async fetchJwk(e,t={keys:[]}){let r=t.keys.find(o=>o.kid===e);if(r)return r;let n=Date.now();if(r=this.jwks.keys.find(o=>o.kid===e),r&&this.jwks_cached_at+Er>n)return r;let{data:s,error:a}=await x(this.fetch,"GET",`${this.url}/.well-known/jwks.json`,{headers:this.headers});if(a)throw a;return!s.keys||s.keys.length===0||(this.jwks=s,this.jwks_cached_at=n,r=s.keys.find(o=>o.kid===e),!r)?null:r}async getClaims(e,t={}){try{let r=e;if(!r){let{data:u,error:p}=await this.getSession();if(p||!u.session)return this._returnResult({data:null,error:p});r=u.session.access_token}let{header:n,payload:s,signature:a,raw:{header:o,payload:c}}=mt(r);if(!t?.allowExpired)try{zr(s.exp)}catch(u){throw new ye(u instanceof Error?u.message:"JWT validation failed")}let l=!n.alg||n.alg.startsWith("HS")||!n.kid||!("crypto"in globalThis&&"subtle"in globalThis.crypto)?null:await this.fetchJwk(n.kid,t?.keys?{keys:t.keys}:t?.jwks);if(!l){let{error:u}=await this.getUser(r);if(u)throw u;return{data:{claims:s,header:n,signature:a},error:null}}let h=qr(n.alg),d=await crypto.subtle.importKey("jwk",l,h,!0,["verify"]);if(!await crypto.subtle.verify(h,d,a,Rr(`${o}.${c}`)))throw new ye("Invalid JWT signature");return{data:{claims:s,header:n,signature:a},error:null}}catch(r){if(b(r))return this._returnResult({data:null,error:r});throw r}}async signInWithPasskey(e){var t,r,n;K(this.experimental);try{if(!vt())return this._returnResult({data:null,error:new z("Browser does not support WebAuthn",null)});let{data:s,error:a}=await this._startPasskeyAuthentication({options:{captchaToken:(t=e?.options)===null||t===void 0?void 0:t.captchaToken}});if(a||!s)return this._returnResult({data:null,error:a});let o=Ti(s.options),c=(n=(r=e?.options)===null||r===void 0?void 0:r.signal)!==null&&n!==void 0?n:Gt.createNewAbortSignal(),{data:l,error:h}=await Ci({publicKey:o,signal:c});if(h||!l)return this._returnResult({data:null,error:h??new z("WebAuthn ceremony failed",null)});let d=Ai(l);return this._verifyPasskeyAuthentication({challengeId:s.challenge_id,credential:d})}catch(s){if(b(s))return this._returnResult({data:null,error:s});throw s}}async registerPasskey(e){var t,r;K(this.experimental);try{if(!vt())return this._returnResult({data:null,error:new z("Browser does not support WebAuthn",null)});let{data:n,error:s}=await this._startPasskeyRegistration();if(s||!n)return this._returnResult({data:null,error:s});let a=Ei(n.options),o=(r=(t=e?.options)===null||t===void 0?void 0:t.signal)!==null&&r!==void 0?r:Gt.createNewAbortSignal(),{data:c,error:l}=await Ii({publicKey:a,signal:o});if(l||!c)return this._returnResult({data:null,error:l??new z("WebAuthn ceremony failed",null)});let h=Si(c);return this._verifyPasskeyRegistration({challengeId:n.challenge_id,credential:h})}catch(n){if(b(n))return this._returnResult({data:null,error:n});throw n}}async _startPasskeyRegistration(){K(this.experimental);try{return await this._useSession(async e=>{let{data:{session:t},error:r}=e;if(r)return this._returnResult({data:null,error:r});if(!t)return this._returnResult({data:null,error:new $});let{data:n,error:s}=await x(this.fetch,"POST",`${this.url}/passkeys/registration/options`,{headers:this.headers,jwt:t.access_token,body:{}});return s?this._returnResult({data:null,error:s}):this._returnResult({data:n,error:null})})}catch(e){if(b(e))return this._returnResult({data:null,error:e});throw e}}async _verifyPasskeyRegistration(e){K(this.experimental);try{return await this._useSession(async t=>{let{data:{session:r},error:n}=t;if(n)return this._returnResult({data:null,error:n});if(!r)return this._returnResult({data:null,error:new $});let{data:s,error:a}=await x(this.fetch,"POST",`${this.url}/passkeys/registration/verify`,{headers:this.headers,jwt:r.access_token,body:{challenge_id:e.challengeId,credential:e.credential}});return a?this._returnResult({data:null,error:a}):this._returnResult({data:s,error:null})})}catch(t){if(b(t))return this._returnResult({data:null,error:t});throw t}}async _startPasskeyAuthentication(e){var t;K(this.experimental);try{let{data:r,error:n}=await x(this.fetch,"POST",`${this.url}/passkeys/authentication/options`,{headers:this.headers,body:{gotrue_meta_security:{captcha_token:(t=e?.options)===null||t===void 0?void 0:t.captchaToken}}});return n?this._returnResult({data:null,error:n}):this._returnResult({data:r,error:null})}catch(r){if(b(r))return this._returnResult({data:null,error:r});throw r}}async _verifyPasskeyAuthentication(e){K(this.experimental);try{let{data:t,error:r}=await x(this.fetch,"POST",`${this.url}/passkeys/authentication/verify`,{headers:this.headers,body:{challenge_id:e.challengeId,credential:e.credential},xform:G});return r?this._returnResult({data:null,error:r}):(t.session&&(await this._saveSession(t.session),await this._notifyAllSubscribers("SIGNED_IN",t.session)),this._returnResult({data:t,error:null}))}catch(t){if(b(t))return this._returnResult({data:null,error:t});throw t}}async _listPasskeys(){K(this.experimental);try{return await this._useSession(async e=>{let{data:{session:t},error:r}=e;if(r)return this._returnResult({data:null,error:r});if(!t)return this._returnResult({data:null,error:new $});let{data:n,error:s}=await x(this.fetch,"GET",`${this.url}/passkeys`,{headers:this.headers,jwt:t.access_token,xform:a=>({data:a,error:null})});return s?this._returnResult({data:null,error:s}):this._returnResult({data:n,error:null})})}catch(e){if(b(e))return this._returnResult({data:null,error:e});throw e}}async _updatePasskey(e){K(this.experimental);try{return await this._useSession(async t=>{let{data:{session:r},error:n}=t;if(n)return this._returnResult({data:null,error:n});if(!r)return this._returnResult({data:null,error:new $});let{data:s,error:a}=await x(this.fetch,"PATCH",`${this.url}/passkeys/${e.passkeyId}`,{headers:this.headers,jwt:r.access_token,body:{friendly_name:e.friendlyName}});return a?this._returnResult({data:null,error:a}):this._returnResult({data:s,error:null})})}catch(t){if(b(t))return this._returnResult({data:null,error:t});throw t}}async _deletePasskey(e){K(this.experimental);try{return await this._useSession(async t=>{let{data:{session:r},error:n}=t;if(n)return this._returnResult({data:null,error:n});if(!r)return this._returnResult({data:null,error:new $});let{error:s}=await x(this.fetch,"DELETE",`${this.url}/passkeys/${e.passkeyId}`,{headers:this.headers,jwt:r.access_token,noResolveJson:!0});return s?this._returnResult({data:null,error:s}):this._returnResult({data:null,error:null})})}catch(t){if(b(t))return this._returnResult({data:null,error:t});throw t}}};Jt.nextInstanceID={};var Ri=Jt;var ra=Ri,Pi=ra;var na="2.112.4",wt="",Zt;if(typeof Deno<"u")wt="deno",Zt=(Yt=Deno.version)===null||Yt===void 0?void 0:Yt.deno;else if(typeof document<"u")wt="web";else if(typeof navigator<"u"&&navigator.product==="ReactNative")wt="react-native";else{wt="node";let i=globalThis.process;Zt=i==null||(Qt=i.version)===null||Qt===void 0?void 0:Qt.replace(/^v/,"")}var Yt,Qt,ln=[`runtime=${wt}`];Zt&&ln.push(`runtime-version=${Zt}`);var sa={"X-Client-Info":`supabase-js/${na}; ${ln.join("; ")}`},aa={headers:sa},oa={schema:"public"},ca={autoRefreshToken:!0,persistSession:!0,detectSessionInUrl:!0,flowType:"implicit"},la={},ha={enabled:!1,respectSamplingDecision:!0};function da(i){if(!i||typeof i!="string")return null;let e=i.split("-");if(e.length!==4)return null;let[t,r,n,s]=e;if(t.length!==2||r.length!==32||n.length!==16||s.length!==2)return null;let a=/^[0-9a-f]+$/i;return!a.test(t)||!a.test(r)||!a.test(n)||!a.test(s)||r==="00000000000000000000000000000000"||n==="0000000000000000"?null:{version:t,traceId:r,parentId:n,traceFlags:s,isSampled:(parseInt(s,16)&1)===1}}function ua(i,e){if(!i||!e||e.length===0)return!1;let t;if(i instanceof URL)t=i;else try{t=new URL(i)}catch{return!1}for(let r of e)try{if(typeof r=="string"){if(fa(t.hostname,r))return!0}else if(r instanceof RegExp){if(r.test(t.hostname))return!0}else if(typeof r=="function"&&r(t))return!0}catch{continue}return!1}function fa(i,e){if(e===i)return!0;if(e.startsWith("*.")){let t=e.slice(2);if(i.endsWith(t)&&(i===t||i.endsWith("."+t)))return!0}return!1}function pa(i){let e=[];try{let t=new URL(i);e.push(t.hostname)}catch{}return e.push("*.supabase.co","*.supabase.in"),e.push("localhost","127.0.0.1","[::1]"),e}function bt(i){"@babel/helpers - typeof";return bt=typeof Symbol=="function"&&typeof Symbol.iterator=="symbol"?function(e){return typeof e}:function(e){return e&&typeof Symbol=="function"&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e},bt(i)}function ga(i,e){if(bt(i)!="object"||!i)return i;var t=i[Symbol.toPrimitive];if(t!==void 0){var r=t.call(i,e||"default");if(bt(r)!="object")return r;throw new TypeError("@@toPrimitive must return a primitive value.")}return(e==="string"?String:Number)(i)}function ma(i){var e=ga(i,"string");return bt(e)=="symbol"?e:e+""}function ya(i,e,t){return(e=ma(e))in i?Object.defineProperty(i,e,{value:t,enumerable:!0,configurable:!0,writable:!0}):i[e]=t,i}function rn(i,e){var t=Object.keys(i);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(i);e&&(r=r.filter(function(n){return Object.getOwnPropertyDescriptor(i,n).enumerable})),t.push.apply(t,r)}return t}function M(i){for(var e=1;e<arguments.length;e++){var t=arguments[e]!=null?arguments[e]:{};e%2?rn(Object(t),!0).forEach(function(r){ya(i,r,t[r])}):Object.getOwnPropertyDescriptors?Object.defineProperties(i,Object.getOwnPropertyDescriptors(t)):rn(Object(t)).forEach(function(r){Object.defineProperty(i,r,Object.getOwnPropertyDescriptor(t,r))})}return i}var va=i=>i?(...e)=>i(...e):(...e)=>fetch(...e),wa=()=>Headers,hn=i=>i.startsWith("sb_publishable_")||i.startsWith("sb_secret_"),ba="sb_temp_",nn=new Set,_a=i=>{var e,t;if(!i.startsWith("sb_")||hn(i)||i.startsWith(ba))return;let r=(e=(t=i.match(/^sb_[a-zA-Z0-9]+_/))===null||t===void 0?void 0:t[0])!==null&&e!==void 0?e:"unknown";nn.has(r)||(nn.add(r),console.warn("@supabase/supabase-js: Unrecognized Supabase API key format. The client will proceed and send this key as-is; if you see authentication errors you may need to upgrade @supabase/supabase-js to a version that recognizes this key type."))},sn=(i,e,t,r,n,s)=>{let a=va(r),o=wa(),c=n?.enabled===!0,l=n?.respectSamplingDecision!==!1,h=c?pa(e):null,d=!(s?.omitApiKeyAsBearer&&hn(i));return async(f,u)=>{let p=await t(),m=new o(u?.headers);if(m.has("apikey")||m.set("apikey",i),!m.has("Authorization")){let y=p??(d?i:null);y&&m.set("Authorization",`Bearer ${y}`)}if(h){let y=xa(f,h,l);y&&(y.traceparent&&!m.has("traceparent")&&m.set("traceparent",y.traceparent),y.tracestate&&!m.has("tracestate")&&m.set("tracestate",y.tracestate),y.baggage&&!m.has("baggage")&&m.set("baggage",y.baggage))}return a(f,M(M({},u),{},{headers:m}))}},an=!1,on=!1;function xa(i,e,t){let r=Ni();if(!r)return an||(an=!0,console.warn("@supabase/supabase-js: tracePropagation is enabled but the tracing runtime is not loaded, so trace headers will not be attached. Add `import '@supabase/supabase-js/tracing'` at your application entry point (requires the OpenTelemetry API package to be installed). The CDN/UMD build does not support trace propagation.")),null;if(!ua(typeof i=="string"||i instanceof URL?i:i.url,e))return null;let n=r();if(!n||!n.traceparent){var s;if(!(n==null||(s=n.carrierKeys)===null||s===void 0)&&s.length&&!on){on=!0;let a=n.carrierKeys.includes("sentry-trace")?" Sentry detected: set `propagateTraceparent: true` in Sentry.init() to emit it.":" Configure your tracing SDK to emit W3C trace context on outgoing requests.";console.warn(`@supabase/supabase-js: tracePropagation is enabled and a tracing SDK is active, but its propagator wrote [${n.carrierKeys.join(", ")}] and no W3C traceparent header, so trace headers will not be attached.`+a)}return null}if(t){let a=da(n.traceparent);if(a&&!a.isSampled)return{traceparent:n.traceparent}}return n}function cn(i){return typeof i=="boolean"?{enabled:i}:i}function ka(i){return i.endsWith("/")?i:i+"/"}function Ea(i,e){var t,r,n,s,a,o;let{db:c,auth:l,realtime:h,global:d}=i,{db:f,auth:u,realtime:p,global:m}=e,y=cn(i.tracePropagation),g=cn(e.tracePropagation),v={db:M(M({},f),c),auth:M(M({},u),l),realtime:M(M({},p),h),storage:{},global:M(M(M({},m),d),{},{headers:M(M({},(t=m?.headers)!==null&&t!==void 0?t:{}),(r=d?.headers)!==null&&r!==void 0?r:{})}),tracePropagation:{enabled:(n=(s=y?.enabled)!==null&&s!==void 0?s:g?.enabled)!==null&&n!==void 0?n:!1,respectSamplingDecision:(a=(o=y?.respectSamplingDecision)!==null&&o!==void 0?o:g?.respectSamplingDecision)!==null&&a!==void 0?a:!0},accessToken:async()=>""};return i.accessToken?v.accessToken=i.accessToken:delete v.accessToken,v}function Ta(i){let e=i?.trim();if(!e)throw new Error("supabaseUrl is required.");if(!e.match(/^https?:\/\//i))throw new Error("Invalid supabaseUrl: Must be a valid HTTP or HTTPS URL.");try{return new URL(ka(e))}catch{throw Error("Invalid supabaseUrl: Provided URL is malformed.")}}var Sa=class extends Pi{constructor(i){super(i)}},Aa=class{constructor(i,e,t){var r,n;this.supabaseUrl=i,this.supabaseKey=e;let s=Ta(i);if(!e)throw new Error("supabaseKey is required.");_a(e),this.realtimeUrl=new URL("realtime/v1",s),this.realtimeUrl.protocol=this.realtimeUrl.protocol.replace("http","ws"),this.authUrl=new URL("auth/v1",s),this.storageUrl=new URL("storage/v1",s),this.functionsUrl=new URL("functions/v1",s);let a=`sb-${s.hostname.split(".")[0]}-auth-token`,o={db:oa,realtime:la,auth:M(M({},ca),{},{storageKey:a}),global:aa,tracePropagation:ha},c=Ea(t??{},o);if(this.settings=c,this.storageKey=(r=c.auth.storageKey)!==null&&r!==void 0?r:"",this.headers=(n=c.global.headers)!==null&&n!==void 0?n:{},c.accessToken)this.accessToken=c.accessToken,this.auth=new Proxy({},{get:(h,d)=>{throw new Error(`@supabase/supabase-js: Supabase Client is configured with the accessToken option, accessing supabase.auth.${String(d)} is not possible`)}});else{var l;this.auth=this._initSupabaseAuthClient((l=c.auth)!==null&&l!==void 0?l:{},this.headers,c.global.fetch)}this.fetch=sn(e,i,this._getSessionToken.bind(this),c.global.fetch,c.tracePropagation),this.functionsFetch=sn(e,i,this._getSessionToken.bind(this),c.global.fetch,c.tracePropagation,{omitApiKeyAsBearer:!0}),this.realtime=this._initRealtimeClient(M({headers:this.headers,accessToken:this._getAccessToken.bind(this),fetch:this.fetch},c.realtime)),this.accessToken&&Promise.resolve(this.accessToken()).then(h=>this.realtime.setAuth(h)).catch(h=>console.warn("Failed to set initial Realtime auth token:",h)),this.rest=new Vi(new URL("rest/v1",s).href,{headers:this.headers,schema:c.db.schema,fetch:this.fetch,timeout:c.db.timeout,urlLengthLimit:c.db.urlLengthLimit,retry:c.db.retry}),this.storage=new yr(this.storageUrl.href,this.headers,this.fetch,t?.storage),c.accessToken||this._listenForAuthEvents()}get functions(){return new Ge(this.functionsUrl.href,{headers:this.headers,customFetch:this.functionsFetch})}from(i){return this.rest.from(i)}schema(i){return this.rest.schema(i)}rpc(i,e={},t={head:!1,get:!1,count:void 0}){return this.rest.rpc(i,e,t)}channel(i,e={config:{}}){return this.realtime.channel(i,e)}getChannels(){return this.realtime.getChannels()}removeChannel(i){return this.realtime.removeChannel(i)}removeAllChannels(){return this.realtime.removeAllChannels()}async _getSessionToken(){var i=this,e,t;if(i.accessToken)return await i.accessToken();let{data:r}=await i.auth.getSession();return(e=(t=r.session)===null||t===void 0?void 0:t.access_token)!==null&&e!==void 0?e:null}async _getAccessToken(){var i=this,e;return(e=await i._getSessionToken())!==null&&e!==void 0?e:i.supabaseKey}_initSupabaseAuthClient({autoRefreshToken:i,persistSession:e,detectSessionInUrl:t,storage:r,userStorage:n,storageKey:s,flowType:a,lock:o,debug:c,throwOnError:l,experimental:h,lockAcquireTimeout:d,skipAutoInitialize:f},u,p){let m={Authorization:`Bearer ${this.supabaseKey}`,apikey:`${this.supabaseKey}`};return new Sa({url:this.authUrl.href,headers:M(M({},m),u),storageKey:s,autoRefreshToken:i,persistSession:e,detectSessionInUrl:t,storage:r,userStorage:n,flowType:a,lock:o,debug:c,throwOnError:l,experimental:h,fetch:p,lockAcquireTimeout:d,skipAutoInitialize:f,hasCustomAuthorizationHeader:Object.keys(this.headers).some(y=>y.toLowerCase()==="authorization")})}_initRealtimeClient(i){return new Ue(this.realtimeUrl.href,M(M({},i),{},{params:M(M({},{apikey:this.supabaseKey}),i?.params)}))}_listenForAuthEvents(){return this.auth.onAuthStateChange((i,e)=>{this._handleTokenChanged(i,"CLIENT",e?.access_token)})}_handleTokenChanged(i,e,t){(i==="TOKEN_REFRESHED"||i==="SIGNED_IN"||i==="INITIAL_SESSION")&&this.changedAccessToken!==t?(this.changedAccessToken=t,this.realtime.setAuth(t)):i==="SIGNED_OUT"&&(this.realtime.setAuth(),e=="STORAGE"&&this.auth.signOut(),this.changedAccessToken=void 0)}},dn=(i,e,t)=>new Aa(i,e,t);function Ia(){if(typeof window<"u"||globalThis.Deno!==void 0)return!1;let i=globalThis.process;if(!i)return!1;let e=i.version;if(e==null)return!1;let t=e.match(/^v(\d+)\./);return t?parseInt(t[1],10)<=20:!1}Ia()&&console.warn("\u26A0\uFE0F  Node.js 20 and below are deprecated and will no longer be supported in future versions of @supabase/supabase-js. Please upgrade to Node.js 22 or later. For more information, visit: https://github.com/orgs/supabase/discussions/45715");var Li="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAYAAABccqhmAAAp9UlEQVR4AezB93Oc930g4Ofz7otGAmyg2KlqiSpWddzLxY4T2+NcMpnMJP9ifkjuh+SSmzjtEltWbMuRdLaKKcmqrGInQBLA7n5uct+57OwAJAEQ4C6w7/NEZmo0GqOp0mg0Rlal0WiMrEqj0RhZlUajMbIqjUZjZFUajcbIqjQajZFVaTQaI6vSaDRGVqXRaIysSqPRGFmVRqMxsiqNRmNkVRqNxsiqNBqNkVVpNBojq9JoNEZWpdFojKxKo9EYWbXGvQiEIhAIdPVUqNBChRYqBAKhJxRpZWl1Qk9Ym9AvrF7aHIlEF1100UYHXSRCkUgkUpEaK6o1VisQCHT1BMYxg/3Yj12Yxk5MYQcmMYlJTKJGC4FA6JeKVCRST1pZIBQVwuqFfmHt0sZLdNDGIhZwEzcwh+u4ggs4i0u4jg4SgUCgq0gNtcadhH4TmMIkpjCFKcxgFodxGHuxCzPYgR2YwiQmMYUaLQQqK0skUpFIPWm5QCAQqKxeWC6sTdpYiUQHbSzhFm5hHtdxDRdxFh/hHC5iHvOYxwJu4Sa6CD1pRNUaKwlFhVQEZnAUj+ERPIRD2I9dmMFOtFChQiBQIVAhEAhFuL3UL61OKEJPuruweRKhX1qdMUUikeiiiy7aWMQNXMNlfIrf4n18hE9xWpEIpCKNoFrj/wuEIjCOHdiHB3AcD+FBHMYs9mAaUxjHBGqEIqwsLBeWS4R+qScUqSf0C0Ui9AuDlQiE1Um3l+hiF2ZxGMfwJC7iPE7jI3yCUziPOdzUL42IWuM/BSqMYQIz2IsDeBCP4fN4BIcxhVqRSEUgEAj9QpEIqxP6JUIRegKJcHuhX7h/EqFIPaEI9yYRaKHCOKbxAEJxA5dwCr/GW3gXp3Ee17GANgJpBNRGWyBQocIsHsEX8Swexx5MYxLjGEcLgUDqF4qwsrCyQLqzcHuBcG/C6qWeQLq90BPWL6wsFIlA6EkkxrAP03gIv4tLeBu/xE/xEa4pEom0jdVGUygqzOIIHsajeBQn8BAOYRwtdJFIBEIR+oW1C0UgrU+4N2FtAqknkAYrFGG5FlqYwh4kjmIWR/AQ3scn+BBncQ2p6NqGaqMlFC2MYRyP4yv4Lp7EQVSKUHQRCGsX1iasLBE2Trh3oV8YPoHQLxEYxyN4GF/DJ3gLP8LP8SEW0cWSnrRN1EZHIFDhGJ7AF/B5nMAhzKBCIPQLpNUJGy/cu9D4T6Go9IzjCKZxCF/G63gdJ3EVbT1pG6iNhsAY9uIYXsCLeAkPYj8qBBJhZYHU2C5CEQjMYAazOIYHcRgH8BbO4zq6irTF1ba3UFSYwgn8Eb6FJzGGQCAQ7i70JMJwC43bCT2hZwJHcARP4kX8FX6OdxUd20Btewo90ziI7+AreBGHMY5Kv7Q2YfiExmolwnIVAoG9+Dx24Cn8FL/AGSQSaYuqbU+BMezGQ3gWf4QXsV9P2F5CY6MEEpM4jKM4iH3o4HWcxxK6SFtQbfupUGEPvoZv45s4iF0IRdgeQmM1wuqFnkCii+OYwR4cwl/iBpbQsQXVto9AC+M4gRfxLTyLhzGOliJsD6FxP4RiArN4EYnEz/AuFtC1xdS2jwo7cQDfxPfwEnYhUCFsH2HrCCtLW0coahzDJA4gcQ3nsIiOLaS29QUqTOJx/DG+iqewExUCYfsIW0cgEba+UCRm8Dj+FPvxVziNm0ikLaC2tQVaGMdL+Ca+g0ewD4lAKMLWF7aOsP2EYhx78SwqzOMVvI0FdJCGXG1rC4xjN/4QP8SDGFNUitAT7izcWbo/wtYUlgvLpfsnbLwKiVm8iAcwhtO4gltIQ662NQVq7McX8X28hAOoEQhF2FihSP3CylJj0BJh44SeFnbiGL6HHfhfeA/XkIZYbWuawD58Ab+PP8QMJhEIhOXCnYXVC6S7C6TGoCXCxgoExjGG5zGNWxjDr7CAtiFV23oq7MYJ/Dm+hH1ooUIoAqkn3FlYu7A64e4SobGZUr+wsrQ2gcBePIMZ7MYZXMQ80hCqbR2BFibwIn6IZ/EAxhB6QhG2jrA1hX5p60jrF5ZrYQpH8U208Xd4CzeRSEOktnUEpnAcX8Uf4AB2oNKTGo3NFVYWqDGDZ7Ef53EZH2PJkKkNv0AgcAB/im/hICYQilSExv2WRke4uwo7cBj/DXM4i7YiDYna1hA4gufxVTyKSYR+odHYPGF1AjV24jlcwtv4AJcMkdpwC1So8SS+jqfxgCIUidBodBxv4R/wEv4eZ7CANKRq21OgRhuf49t4EvexjDYCgdBoDLI6uIxT+AbewB4kUqMxJCqDE4pE4Gf4Dt7CR/i/eBE3EUgEUqMxdCo6fIlreBsv42/xFJ5FojGkKoMTikDgJ3gZ/wUv4kM8j4/RRqLRGEKVXoObeAW/i9/Ff8S/43k8h1RjSFUGp6u3gEt4Hb+D1/E6XsdbeAfncRFdpEajMQRqA1dxE+/ht/B3+A/4O/w3vIEruIFUIq03vAKhNjj7MY5DuIBTeBX/A9/B7+MNvI5XsIA2utY25Cp7cQBfwQv4f/EaXsN/xk/xLi7iOrqK1Ghs5tAjce9l3MQFnMIb+E/4Fn6A38M/wVewH7vRQqCycUKBCoEKh3EYj+Mr+HP8Dr6Pb+NpPI7DeAKHMIZKEVZnrL+2sQIT2I89OI5j+Dq+gf8Xz+JP8U18G4/i+ziGQ5hAhVCE1QurldbvHhxEB0/iaXwF/489OO/N0rs883u/e5+39+69994793vv1Z3uVl9u93Xv7q5uV1/d7rvb1e62O45jx7ETJ3ZiB0cChAATwhZCRiChKCGkCCkQEgIJgZAgJJQQkggpECYhIYSUhJCEhBAChISQhBACEkKCEBICCUJICSSEkBCSEBIChJAEQsgIISEg5AghQghCCAlChJAgRNgIIdhIQogQIkRIIQghhISQhBCEkIQI20cIITF9hJAghBD2V4h9CCFsnyGEfQgbhBAiIYTtKYRECDZCCDZC2F8h9hBCCEIIe7eEEBLC9hBC2F4h9hBCiBBC2N9+Yk8hhCCE7SGEEEJChO0nhBD2V4j9CCHsXyH2IYR9CCFsf2F/hRBCiLARIUIIW9hfIdhf2D5CiP0VghBCQthfIYTtJYTtKYSQEIQQQggJIWwfIYQQQggJIewvhLC9hBACIUJICEEIYSNChBACIUJICCEhBCGE/RVCiBAiREghhBCChBDC/gohhBCEEIJAAuF/AQYA7aP9v4V7c7sAAAAASUVORK5CYII=",un=Li;var _t=[{id:"smileys",name:"Smileys & Emotions",icon:"\u{1F600}",emojis:["\u{1F600}","\u{1F603}","\u{1F604}","\u{1F601}","\u{1F606}","\u{1F605}","\u{1F602}","\u{1F923}","\u{1F60A}","\u{1F607}","\u{1F642}","\u{1F643}","\u{1F609}","\u{1F60C}","\u{1F60D}","\u{1F970}","\u{1F618}","\u{1F617}","\u{1F619}","\u{1F61A}","\u{1F60B}","\u{1F61B}","\u{1F61C}","\u{1F92A}","\u{1F61D}","\u{1F911}","\u{1F917}","\u{1F92D}","\u{1F92B}","\u{1F914}","\u{1F910}","\u{1F928}","\u{1F610}","\u{1F611}","\u{1F636}","\u{1F60F}","\u{1F612}","\u{1F644}","\u{1F62C}","\u{1F925}","\u{1F60C}","\u{1F614}","\u{1F62A}","\u{1F924}","\u{1F634}","\u{1F637}","\u{1F912}","\u{1F915}","\u{1F922}","\u{1F92E}","\u{1F927}","\u{1F975}","\u{1F976}","\u{1F974}","\u{1F635}","\u{1F92F}","\u{1F920}","\u{1F973}","\u{1F60E}","\u{1F913}","\u{1F9D0}","\u{1F615}","\u{1F61F}","\u{1F641}","\u{1F62E}","\u{1F62F}","\u{1F632}","\u{1F633}","\u{1F97A}","\u{1F626}","\u{1F627}","\u{1F628}","\u{1F630}","\u{1F625}","\u{1F622}","\u{1F62D}","\u{1F631}","\u{1F616}","\u{1F623}","\u{1F61E}","\u{1F613}","\u{1F629}","\u{1F62B}","\u{1F971}","\u{1F624}","\u{1F621}","\u{1F620}","\u{1F92C}","\u{1F608}","\u{1F47F}","\u{1F480}","\u2620\uFE0F","\u{1F4A9}","\u{1F921}","\u{1F479}","\u{1F47A}","\u{1F47B}","\u{1F47D}","\u{1F47E}","\u{1F916}"]},{id:"people",name:"People & Gestures",icon:"\u{1F44B}",emojis:["\u{1F44B}","\u{1F91A}","\u{1F590}\uFE0F","\u270B","\u{1F596}","\u{1F44C}","\u{1F90C}","\u{1F90F}","\u270C\uFE0F","\u{1F91E}","\u{1FAF0}","\u{1F91F}","\u{1F918}","\u{1F919}","\u{1F448}","\u{1F449}","\u{1F446}","\u{1F595}","\u{1F447}","\u261D\uFE0F","\u{1F44D}","\u{1F44E}","\u270A","\u{1F44A}","\u{1F91B}","\u{1F91C}","\u{1F44F}","\u{1F64C}","\u{1F450}","\u{1F932}","\u{1F91D}","\u{1F64F}","\u270D\uFE0F","\u{1F485}","\u{1F933}","\u{1F4AA}","\u{1F9BE}","\u{1F9BF}","\u{1F9B5}","\u{1F9B6}","\u{1F442}","\u{1F9BB}","\u{1F443}","\u{1F9E0}","\u{1FAC0}","\u{1FAC1}","\u{1F9B7}","\u{1F9B4}","\u{1F440}","\u{1F441}\uFE0F","\u{1F445}","\u{1F444}","\u{1F48B}","\u{1FAC2}","\u{1F476}","\u{1F467}","\u{1F9D2}","\u{1F466}","\u{1F469}","\u{1F9D1}","\u{1F468}","\u{1F9D1}\u200D\u{1F9B1}","\u{1F468}\u200D\u{1F9B1}","\u{1F469}\u200D\u{1F9B1}","\u{1F9D1}\u200D\u{1F9B0}","\u{1F468}\u200D\u{1F9B0}","\u{1F469}\u200D\u{1F9B0}","\u{1F471}","\u{1F471}\u200D\u2642\uFE0F","\u{1F471}\u200D\u2640\uFE0F","\u{1F9D1}\u200D\u{1F9B3}","\u{1F468}\u200D\u{1F9B3}","\u{1F469}\u200D\u{1F9B3}","\u{1F9D1}\u200D\u{1F9B2}","\u{1F468}\u200D\u{1F9B2}","\u{1F469}\u200D\u{1F9B2}","\u{1F9D4}","\u{1F9D3}","\u{1F474}","\u{1F475}"]},{id:"hearts",name:"Hearts & Love",icon:"\u2764\uFE0F",emojis:["\u2764\uFE0F","\u{1F9E1}","\u{1F49B}","\u{1F49A}","\u{1F499}","\u{1F49C}","\u{1F5A4}","\u{1F90D}","\u{1F90E}","\u{1F494}","\u2763\uFE0F","\u{1F495}","\u{1F49E}","\u{1F493}","\u{1F497}","\u{1F496}","\u{1F498}","\u{1F49D}","\u{1F49F}","\u{1F48C}","\u{1F48B}","\u{1F48D}","\u{1F48E}","\u{1F490}","\u{1F339}","\u{1F940}","\u{1F33A}","\u{1F338}","\u{1F337}","\u{1F33B}"]},{id:"animals",name:"Animals & Nature",icon:"\u{1F436}",emojis:["\u{1F436}","\u{1F431}","\u{1F42D}","\u{1F439}","\u{1F430}","\u{1F98A}","\u{1F43B}","\u{1F43C}","\u{1F428}","\u{1F42F}","\u{1F981}","\u{1F42E}","\u{1F437}","\u{1F43D}","\u{1F438}","\u{1F435}","\u{1F648}","\u{1F649}","\u{1F64A}","\u{1F412}","\u{1F414}","\u{1F427}","\u{1F426}","\u{1F424}","\u{1F423}","\u{1F425}","\u{1F986}","\u{1F985}","\u{1F989}","\u{1F987}","\u{1F43A}","\u{1F417}","\u{1F434}","\u{1F984}","\u{1F41D}","\u{1FAB1}","\u{1F41B}","\u{1F98B}","\u{1F40C}","\u{1F41E}","\u{1F41C}","\u{1FAB0}","\u{1FAB2}","\u{1FAB3}","\u{1F99F}","\u{1F997}","\u{1F577}\uFE0F","\u{1F578}\uFE0F","\u{1F982}","\u{1F422}","\u{1F40D}","\u{1F98E}","\u{1F996}","\u{1F995}","\u{1F419}","\u{1F991}","\u{1F990}","\u{1F99E}","\u{1F980}","\u{1F421}","\u{1F420}","\u{1F41F}","\u{1F42C}","\u{1F433}","\u{1F40B}","\u{1F988}","\u{1F40A}","\u{1F405}","\u{1F406}","\u{1F993}","\u{1F98D}","\u{1F9A7}","\u{1F9A3}","\u{1F418}","\u{1F99B}","\u{1F98F}","\u{1F42A}","\u{1F42B}","\u{1F992}","\u{1F998}","\u{1F403}","\u{1F402}","\u{1F404}","\u{1F40E}","\u{1F416}","\u{1F40F}","\u{1F411}","\u{1F999}","\u{1F410}","\u{1F98C}","\u{1F415}","\u{1F429}","\u{1F9AE}","\u{1F415}\u200D\u{1F9BA}","\u{1F408}","\u{1F408}\u200D\u2B1B","\u{1F413}","\u{1F983}","\u{1F99A}","\u{1F99C}"]},{id:"food",name:"Food & Drink",icon:"\u{1F355}",emojis:["\u{1F34F}","\u{1F34E}","\u{1F350}","\u{1F34A}","\u{1F34B}","\u{1F34C}","\u{1F349}","\u{1F347}","\u{1F353}","\u{1FAD0}","\u{1F348}","\u{1F352}","\u{1F351}","\u{1F96D}","\u{1F34D}","\u{1F965}","\u{1F95D}","\u{1F345}","\u{1F346}","\u{1F951}","\u{1F966}","\u{1F96C}","\u{1F952}","\u{1F336}\uFE0F","\u{1FAD1}","\u{1F33D}","\u{1F955}","\u{1F9C4}","\u{1F9C5}","\u{1F954}","\u{1F360}","\u{1F950}","\u{1F96F}","\u{1F35E}","\u{1F956}","\u{1F968}","\u{1F9C0}","\u{1F95A}","\u{1F373}","\u{1F9C8}","\u{1F95E}","\u{1F9C7}","\u{1F953}","\u{1F969}","\u{1F357}","\u{1F356}","\u{1F32D}","\u{1F354}","\u{1F35F}","\u{1F355}","\u{1FAD3}","\u{1F96A}","\u{1F959}","\u{1F9C6}","\u{1F32E}","\u{1F32F}","\u{1FAD4}","\u{1F957}","\u{1F958}","\u{1FAD5}","\u{1F372}","\u{1F35C}","\u{1F35D}","\u{1F363}","\u{1F371}","\u{1F95F}","\u{1F364}","\u{1F359}","\u{1F35A}","\u{1F358}","\u{1F366}","\u{1F367}","\u{1F368}","\u{1F369}","\u{1F36A}","\u{1F382}","\u{1F370}","\u{1F9C1}","\u{1F36B}","\u{1F36C}","\u{1F36D}","\u{1F36E}","\u{1F36F}","\u{1F37C}","\u{1F95B}","\u2615","\u{1FAD6}","\u{1F375}","\u{1F376}","\u{1F37E}","\u{1F377}","\u{1F378}","\u{1F379}","\u{1F37A}","\u{1F37B}","\u{1F942}","\u{1F943}","\u{1F964}","\u{1F9C3}","\u{1F9CB}"]},{id:"activity",name:"Activities & Sports",icon:"\u26BD",emojis:["\u26BD","\u{1F3C0}","\u{1F3C8}","\u26BE","\u{1F94E}","\u{1F3BE}","\u{1F3D0}","\u{1F3C9}","\u{1F94F}","\u{1F3B1}","\u{1FA80}","\u{1F3D3}","\u{1F3F8}","\u{1F3D2}","\u{1F3D1}","\u{1F94D}","\u{1F3CF}","\u{1FA83}","\u{1F945}","\u26F3","\u{1FA81}","\u{1F3F9}","\u{1F3A3}","\u{1F93F}","\u{1F94A}","\u{1F94B}","\u{1F3BD}","\u{1F6F9}","\u{1F6FC}","\u{1F6F7}","\u26F8\uFE0F","\u{1F94C}","\u{1F3BF}","\u26F7\uFE0F","\u{1F3C2}","\u{1FA82}","\u{1F3CB}\uFE0F","\u{1F93C}","\u{1F938}","\u{1F93A}","\u26F9\uFE0F","\u{1F93E}","\u{1F9D7}","\u{1F3CC}\uFE0F","\u{1F3C4}","\u{1F3CA}","\u{1F6B4}","\u{1F6B5}","\u{1F3C7}","\u{1F3C6}","\u{1F947}","\u{1F948}","\u{1F949}","\u{1F3C5}","\u{1F396}\uFE0F","\u{1F3F5}\uFE0F","\u{1F397}\uFE0F","\u{1F3AB}","\u{1F39F}\uFE0F","\u{1F3AA}","\u{1F939}","\u{1F3AD}","\u{1FA70}","\u{1F3A8}","\u{1F3AC}","\u{1F3A4}","\u{1F3A7}","\u{1F3BC}","\u{1F3B9}","\u{1F941}","\u{1FA98}","\u{1F3B7}","\u{1F3BA}","\u{1FA97}","\u{1F3B8}","\u{1FA95}","\u{1F3BB}","\u{1F3B2}","\u265F\uFE0F","\u{1F3AF}","\u{1F3B3}","\u{1F3AE}","\u{1F3B0}","\u{1F9E9}","\u{1F3B3}","\u{1F579}\uFE0F","\u{1FA84}","\u{1F52E}","\u{1F0CF}","\u{1F004}"]},{id:"objects",name:"Objects & Tech",icon:"\u{1F4A1}",emojis:["\u{1F4F1}","\u{1F4F2}","\u{1F4BB}","\u2328\uFE0F","\u{1F5A5}\uFE0F","\u{1F5A8}\uFE0F","\u{1F5B1}\uFE0F","\u{1F579}\uFE0F","\u{1F4BD}","\u{1F4BE}","\u{1F4BF}","\u{1F4C0}","\u{1F4F7}","\u{1F4F8}","\u{1F4F9}","\u{1F3A5}","\u{1F4FD}\uFE0F","\u{1F39E}\uFE0F","\u{1F4DE}","\u260E\uFE0F","\u{1F4DF}","\u{1F4E0}","\u{1F4FA}","\u{1F4FB}","\u{1F399}\uFE0F","\u{1F39A}\uFE0F","\u{1F39B}\uFE0F","\u23F1\uFE0F","\u23F2\uFE0F","\u23F0","\u{1F570}\uFE0F","\u231B","\u23F3","\u{1F4E1}","\u{1F50B}","\u{1F50C}","\u{1F4A1}","\u{1F526}","\u{1F56F}\uFE0F","\u{1F9EF}","\u{1F5D1}\uFE0F","\u{1F6E2}\uFE0F","\u{1F6D2}","\u{1F6CD}\uFE0F","\u{1F381}","\u{1F388}","\u{1F38F}","\u{1F380}","\u{1FA84}","\u{1F38A}","\u{1F389}","\u{1F38E}","\u{1F3EE}","\u{1F390}","\u2709\uFE0F","\u{1F4E9}","\u{1F4E8}","\u{1F4E7}","\u{1F4E6}","\u{1F3F7}\uFE0F","\u{1F4EA}","\u{1F4EB}","\u{1F4EC}","\u{1F4ED}","\u{1F4EE}","\u{1F4EF}","\u{1F4DC}","\u{1F4C3}","\u{1F4C4}","\u{1F4D1}","\u{1F9FE}","\u{1F4CA}","\u{1F4C8}","\u{1F4C9}","\u{1F5D2}\uFE0F","\u{1F5D3}\uFE0F","\u{1F4C5}","\u{1F4C6}","\u{1F4C7}","\u{1F4C1}","\u{1F4C2}","\u{1F5C2}\uFE0F","\u{1F5DE}\uFE0F","\u{1F4F0}","\u{1F4D3}","\u{1F4D5}","\u{1F4D7}","\u{1F4D8}","\u{1F4D9}","\u{1F4DA}","\u{1F4D6}","\u{1F516}","\u{1F517}","\u{1F4CE}","\u{1F587}\uFE0F","\u{1F4D0}","\u{1F4CF}","\u{1F4CC}","\u{1F4CD}","\u2702\uFE0F","\u{1F58A}\uFE0F","\u{1F58B}\uFE0F","\u2712\uFE0F","\u{1F58C}\uFE0F","\u{1F58D}\uFE0F","\u{1F4DD}","\u270F\uFE0F","\u{1F50D}","\u{1F50E}","\u{1F512}","\u{1F513}","\u{1F50F}","\u{1F510}","\u{1F511}","\u{1F5DD}\uFE0F","\u{1F528}","\u{1FA93}","\u26CF\uFE0F","\u{1F527}","\u{1FA9B}","\u{1F529}","\u2699\uFE0F","\u{1F5DC}\uFE0F","\u2696\uFE0F","\u{1F9AF}","\u26D3\uFE0F","\u{1FA9D}","\u{1F9F0}","\u{1F9F2}"]},{id:"symbols",name:"Symbols & Badges",icon:"\u2728",emojis:["\u{1F4AF}","\u{1F525}","\u2728","\u26A1","\u2B50","\u{1F31F}","\u{1F4AB}","\u{1F4A5}","\u{1F4A2}","\u{1F4A6}","\u{1F4A8}","\u{1F573}\uFE0F","\u{1F4A3}","\u{1F4AC}","\u{1F5E8}\uFE0F","\u{1F5EF}\uFE0F","\u{1F4AD}","\u{1F4A4}","\u{1F310}","\u{1F514}","\u{1F515}","\u{1F4E3}","\u{1F4E2}","\u26A0\uFE0F","\u26D4","\u{1F6AB}","\u2705","\u274C","\u2B55","\u2757","\u2753","\u2755","\u2754","\u203C\uFE0F","\u2049\uFE0F","\u2714\uFE0F","\u2611\uFE0F","\u2795","\u2796","\u2797","\u2716\uFE0F","\u{1F7F0}","\u267E\uFE0F","\u{1F4B2}","\u{1F4B1}","\xA9\uFE0F","\xAE\uFE0F","\u2122\uFE0F","\u{1F534}","\u{1F7E2}","\u{1F535}","\u{1F7E1}","\u{1F7E0}","\u{1F7E3}","\u26AB","\u26AA","\u{1F7E4}","\u{1F53A}","\u{1F53B}","\u{1F680}"]}],fn=_t.flatMap(i=>i.emojis);var Ca=/\.(jpe?g|png|gif|webp|bmp|heic|heif|avif|tiff?)$/i;function Oi(i){return i.type.startsWith("image/")||!i.type&&Ca.test(i.name||"")}var Ra=1920,Pa=.82;async function La(i){if(typeof createImageBitmap=="function")try{let t=await createImageBitmap(i,{imageOrientation:"from-image"});return{width:t.width,height:t.height,draw:(r,n,s)=>r.drawImage(t,0,0,n,s)}}catch{}let e=URL.createObjectURL(i);try{let t=await new Promise((r,n)=>{let s=new Image;s.onload=()=>r(s),s.onerror=n,s.src=e});return{width:t.naturalWidth,height:t.naturalHeight,draw:(r,n,s)=>r.drawImage(t,0,0,n,s)}}catch{return null}finally{setTimeout(()=>URL.revokeObjectURL(e),1e3)}}async function Oa(i){return Promise.race([ja(i),new Promise(e=>setTimeout(()=>e(i),1e4))])}async function ja(i){try{let e=(i.type||"").toLowerCase();if(e==="image/gif"||e==="image/svg+xml"||e==="image/png"&&i.size<1.5*1024*1024||i.size<400*1024&&/jpe?g|webp/.test(e))return i;let t=await La(i);if(!t||!t.width||!t.height)return i;let r=Math.min(1,Ra/Math.max(t.width,t.height)),n=Math.max(1,Math.round(t.width*r)),s=Math.max(1,Math.round(t.height*r)),a=document.createElement("canvas");a.width=n,a.height=s;let o=a.getContext("2d");if(!o)return i;o.fillStyle="#ffffff",o.fillRect(0,0,n,s),t.draw(o,n,s);let c=await new Promise(h=>a.toBlob(h,"image/jpeg",Pa));if(!c||c.size>=i.size)return i;let l=(i.name||"photo").replace(/\.[^.]+$/,"")||"photo";return new File([c],`${l}.jpg`,{type:"image/jpeg",lastModified:Date.now()})}catch{return i}}async function $a(i,e,t){let r={};t?.visitorId&&(r["x-zentry-visitor"]=t.visitorId),t?.visitorToken&&(r["x-zentry-visitor-token"]=t.visitorToken);let n=await fetch(`${i}/api/upload/sign`,{method:"POST",headers:r});if(!n.ok)throw new Error(`sign ${n.status}`);let s=await n.json(),a=new FormData;a.append("file",e),a.append("api_key",s.apiKey),a.append("timestamp",String(s.timestamp)),a.append("signature",s.signature),a.append("folder",s.folder),a.append("allowed_formats",s.allowedFormats);let o=await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(s.cloudName)}/image/upload`,{method:"POST",body:a}),c=await o.json().catch(()=>({}));if(!o.ok||!c?.secure_url)throw new Error(c?.error?.message||`Cloudinary ${o.status}`);return c.secure_url.replace(/\.(heic|heif|avif|bmp|tiff?)$/i,".jpg")}async function Ma(i,e,t){let r=new FormData;r.append("file",e);let n={};t?.visitorId&&(n["x-zentry-visitor"]=t.visitorId),t?.visitorToken&&(n["x-zentry-visitor-token"]=t.visitorToken);let s=await fetch(`${i}/api/upload`,{method:"POST",headers:n,body:r}),a=await s.json().catch(()=>({}));if(!s.ok||!a?.url)throw s.status===413?new Error("This picture is too large. Please choose a smaller one."):new Error(a?.error||`Upload failed (${s.status})`);return a.url}async function pn(i,e,t){let r=typeof e=="string"?e:"",n=typeof e=="object"&&e!==null?e:t,s=Oi(i),a=s?await Oa(i):i;if(s)try{return await $a(r,a,n)}catch(o){console.warn("[upload] direct upload failed, trying the server route:",o)}try{return await Ma(r,a,n)}catch(o){let c=o instanceof Error?o.message:"";throw new Error(c&&!/^Upload failed|^sign|^Cloudinary/.test(c)?c:"Couldn't send the picture. Please check your connection and try again.")}}var Ba="com|net|org|io|co|ai|app|dev|site|online|store|shop|tech|info|biz|me|xyz|tv|cc|us|uk|ca|au|de|fr|in|pk|ae|sa|eu|gov|edu",xt=new RegExp([String.raw`[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}`,String.raw`https?:\/\/[^\s<>"']+`,String.raw`www\.[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+[^\s<>"']*`,String.raw`(?:[A-Za-z0-9-]+\.)+(?:${Ba})(?![\w-])(?:[/?#][^\s<>"']*)?`].join("|"),"gi");function Na(i){let e=i;for(;;){let t=e[e.length-1];if(!t)return e;if(`.,;:!?'"*`.includes(t)){e=e.slice(0,-1);continue}if(t===")"&&(e.match(/\(/g)||[]).length<(e.match(/\)/g)||[]).length){e=e.slice(0,-1);continue}if(t==="]"&&(e.match(/\[/g)||[]).length<(e.match(/\]/g)||[]).length){e=e.slice(0,-1);continue}return e}}function gn(i){let e=[],t=0;xt.lastIndex=0;for(let r=xt.exec(i);r;r=xt.exec(i)){let n=r.index;if(!/^(https?:\/\/|www\.)/i.test(r[0])&&!r[0].includes("@")&&n>0&&/[\w@./-]/.test(i[n-1])){xt.lastIndex=n+1;continue}let s=Na(r[0]);if(!s)continue;let a=n+s.length;xt.lastIndex=a;let o;s.includes("@")&&!/^https?:\/\//i.test(s)&&!s.includes("/")?o=`mailto:${s}`:/^https?:\/\//i.test(s)?o=s:o=`https://${s}`,n>t&&e.push({text:i.slice(t,n)}),e.push({text:s,href:o}),t=a}return t<i.length&&e.push({text:i.slice(t)}),e}var kt={enabled:!0,title:"Welcome! \u{1F44B}",intro:"Tell us a little about yourself so the right person can help.",name:"optional",email:"required",topics:[],topic_required:!1},Ha=["off","optional","required"];function ji(i){let e=i&&typeof i=="object"?i:{},t=(s,a)=>Ha.includes(s)?s:a,r=(s,a,o)=>typeof s=="string"&&s.trim()?s.trim().slice(0,o):a,n=Array.isArray(e.topics)?Array.from(new Set(e.topics.map(s=>String(s??"").trim().slice(0,40)).filter(Boolean))).slice(0,12):[];return{enabled:typeof e.enabled=="boolean"?e.enabled:kt.enabled,title:r(e.title,kt.title,80),intro:r(e.intro,kt.intro,240),name:t(e.name,kt.name),email:t(e.email,kt.email),topics:n,topic_required:!!e.topic_required&&n.length>0}}function mn(i){return i.name==="off"&&i.email==="off"&&i.topics.length===0}var We=i=>`<svg viewBox="0 0 24 24" width="28" height="28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">${i}</svg>`,yn=[{id:"smile_bubble",label:"Smile",svg:We('<path fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="M6 3h12a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-6.2l-4.13 3.1A1.05 1.05 0 0 1 6 20.26V18a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Zm2.3 7.7a.95.95 0 0 0-.43 1.27A4.7 4.7 0 0 0 12 14.6a4.7 4.7 0 0 0 4.13-2.63.95.95 0 1 0-1.7-.84A2.8 2.8 0 0 1 12 12.7a2.8 2.8 0 0 1-2.43-1.57.95.95 0 0 0-1.27-.43Z"/>')},{id:"dots_bubble",label:"Typing",svg:We('<path fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="M12 3c4.97 0 9 3.58 9 8s-4.03 8-9 8c-.97 0-1.9-.14-2.78-.39l-3.9 1.73a.8.8 0 0 1-1.09-.94l.85-3.17A7.6 7.6 0 0 1 3 11c0-4.42 4.03-8 9-8ZM8 12.3a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6Zm4 0a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6Zm5.3-1.3a1.3 1.3 0 1 1-2.6 0 1.3 1.3 0 0 1 2.6 0Z"/>')},{id:"double_bubble",label:"Conversation",svg:We('<path fill="currentColor" opacity=".5" d="M10 2.5h9A2.5 2.5 0 0 1 21.5 5v5.5A2.5 2.5 0 0 1 19 13h-.6v1.9a.5.5 0 0 1-.83.37L15.6 13H10a2.5 2.5 0 0 1-2.5-2.5V5A2.5 2.5 0 0 1 10 2.5Z"/><path fill="currentColor" d="M5 8.5h9a2.5 2.5 0 0 1 2.5 2.5v5a2.5 2.5 0 0 1-2.5 2.5H9.4l-2.97 2.27a.5.5 0 0 1-.83-.4V18.5H5A2.5 2.5 0 0 1 2.5 16v-5A2.5 2.5 0 0 1 5 8.5Z"/>')},{id:"smile_line",label:"Message",svg:We('<path fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="M6 3h12a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-6.2l-4.13 3.1A1.05 1.05 0 0 1 6 20.26V18a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Zm1.75 5a1 1 0 0 0 0 2h8.5a1 1 0 1 0 0-2h-8.5Zm0 4a1 1 0 1 0 0 2h5a1 1 0 1 0 0-2h-5Z"/>')},{id:"headset",label:"Support",svg:We('<path d="M4.5 14v-2a7.5 7.5 0 0 1 15 0v2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><rect x="3" y="12.5" width="5" height="6.5" rx="2.2" fill="currentColor"/><rect x="16" y="12.5" width="5" height="6.5" rx="2.2" fill="currentColor"/><path d="M18.5 19v.4a2.6 2.6 0 0 1-2.6 2.6H13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>')},{id:"help",label:"Help",svg:We('<path fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="M12 2.5a9.5 9.5 0 1 1 0 19 9.5 9.5 0 0 1 0-19Zm0 13.6a1.15 1.15 0 1 0 0 2.3 1.15 1.15 0 0 0 0-2.3Zm.1-9.6c-1.9 0-3.4 1.2-3.65 2.95a.95.95 0 0 0 1.88.27c.1-.75.8-1.32 1.75-1.32 1.02 0 1.72.62 1.72 1.42 0 .62-.33.98-1.15 1.48-.98.6-1.65 1.27-1.65 2.5v.3a.95.95 0 1 0 1.9 0v-.25c0-.45.2-.68.9-1.11 1-.62 1.9-1.42 1.9-2.94 0-1.9-1.6-3.3-3.6-3.3Z"/>')}];function vn(i){return yn.find(e=>e.id===i)||yn[0]}var wn=[{id:"classic",label:"Messenger",description:"A home screen with a gradient header, cards and tabs. Like Intercom."},{id:"compact",label:"Compact",description:"Opens straight into the chat, slim header, a labelled launcher. Like Zendesk.",chatFirst:!0},{id:"livechat",label:"Live chat",description:"Straight into the chat, team photos and online status up top. Like Tawk.to.",chatFirst:!0},{id:"modern",label:"Modern",description:"Two-colour gradient, very round cards and bubbles. Like Chatway."},{id:"minimal",label:"Minimal",description:"White header, hairline borders, colour only on actions. Quiet and modern."},{id:"solid",label:"Solid",description:"Flat brand-colour header, rounded launcher and pill buttons. Bold and friendly."},{id:"midnight",label:"Midnight",description:"Dark header and launcher with your colour as the accent. Premium."}];function $i(i){return wn.some(e=>e.id===i)}function Mi(i){return wn.some(e=>e.id===i&&e.chatFirst)}function bn(i){return i==="auto"||i==="light"||i==="dark"}function _n(i){return typeof i=="string"&&/^#[0-9a-f]{6}$/i.test(i)}function xn(i){if(!i)return"";let e=i.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");return e=e.replace(/```(?:[a-zA-Z0-9_-]+)?\n([\s\S]*?)```/g,(r,n)=>`<pre class="zentry-code-block chatify-code-block"><code>${n.trim()}</code></pre>`),e=e.replace(/`([^`\n]+)`/g,'<code class="zentry-inline-code chatify-inline-code">$1</code>'),e=e.replace(/!\[([^\]]*)\]\((https?:\/\/(?:(?!&(?:quot|#0?39|apos|lt|gt);)[^\s)"'<>])+)\)/g,'<img src="$2" alt="$1" class="zentry-art-img chatify-art-img" style="max-width:100%;border-radius:6px;margin:6px 0;" />'),e=e.replace(/\[([^\]]+)\]\((https?:\/\/(?:(?!&(?:quot|#0?39|apos|lt|gt);)[^\s)"'<>])+|mailto:(?:(?!&(?:quot|#0?39|apos|lt|gt);)[^\s)"'<>])+)\)/g,'<a href="$2" target="_blank" rel="noopener noreferrer" class="zentry-art-link chatify-art-link">$1</a>'),e=e.replace(/^#### (.*$)/gim,'<h5 style="margin:10px 0 4px;font-size:12.5px;font-weight:700;color:var(--w-ink);">$1</h5>'),e=e.replace(/^### (.*$)/gim,'<h4 style="margin:12px 0 4px;font-size:13px;font-weight:700;color:var(--w-ink);">$1</h4>'),e=e.replace(/^## (.*$)/gim,'<h3 style="margin:14px 0 6px;font-size:14px;font-weight:700;color:var(--w-ink);">$1</h3>'),e=e.replace(/^# (.*$)/gim,'<h2 style="margin:16px 0 6px;font-size:15px;font-weight:700;color:var(--w-ink);">$1</h2>'),e=e.replace(/\*\*\*([^*]+)\*\*\*/g,"<strong><em>$1</em></strong>"),e=e.replace(/\*\*([^*]+)\*\*/g,"<strong>$1</strong>"),e=e.replace(/__([^_]+)__/g,"<strong>$1</strong>"),e=e.replace(/\*([^*\s](?:[^*]*?[^*\s])?)\*/g,"<em>$1</em>"),e=e.replace(/(^|\s)_([^_]+)_(\s|$|[.,!?;:])/g,"$1<em>$2</em>$3"),e=e.replace(/^(&gt;|>)\s?(.*$)/gim,'<blockquote style="border-left:3px solid var(--w-brand);margin:6px 0;padding-left:8px;color:var(--w-ink-2);font-style:italic;">$2</blockquote>'),e=e.replace(/((?:^(?:[-*]\s+.+)(?:\n|$))+)/gm,r=>`<ul style="margin:6px 0 8px 18px;padding:0;">${r.trim().split(`
`).map(s=>s.replace(/^[-*]\s+/,"").trim()).filter(Boolean).map(s=>`<li style="margin-bottom:3px;">${s}</li>`).join("")}</ul>`),e=e.replace(/((?:^\d+\.\s+.+(?:\n|$))+)/gm,r=>`<ol style="margin:6px 0 8px 18px;padding:0;">${r.trim().split(`
`).map(s=>s.replace(/^\d+\.\s+/,"").trim()).filter(Boolean).map(s=>`<li style="margin-bottom:3px;">${s}</li>`).join("")}</ol>`),e=e.split(/\n\s*\n/).map(r=>{let n=r.trim();return n?n.startsWith("<h")||n.startsWith("<pre")||n.startsWith("<ul")||n.startsWith("<ol")||n.startsWith("<blockquote")?n:`<p style="margin:0 0 8px 0;line-height:1.55;">${n.replace(/\n/g,"<br/>")}</p>`:""}).join(""),e}var Xt="#2e5bff";var we="https://orbatai.com",kn=new Set(["chat-system-wabd.vercel.app"]),Ua="https://vfjsaynnubxywdbevxtx.supabase.co",Da="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmanNheW5udWJ4eXdkYmV2eHR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgyNTA5MDEsImV4cCI6MjEwMzgyNjkwMX0.YyBCXMqwrOk5BRhQafYLFw8tiM5PC8lc8Yocodw9wf0",za=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,Bi=class i{constructor(){this.container=null;this.shadow=null;this.conversationId=null;this.conversationStatus="open";this.visitorName="";this.visitorEmail="";this.handoffStatus="bot_active";this.handoffSummary=null;this.handoffReason=null;this.assignedAgentId=null;this.assignedAgentName=null;this.expectedWaitText=null;this.nextOpenLabel=null;this.aiAssistEnabled=!1;this.handoffConnecting=!1;this.isOpen=!1;this.activeTab="home";this.unreadCount=0;this.messages=[];this.faqs=[];this.sections=[];this.activeSectionId=null;this.faqSearchQuery="";this.isPreChatCompleted=!1;this.prechat=ji(void 0);this.csatRated=!1;this.pendingAttachment=null;this.netBannerTimer=null;this.activeEmojiCategory="smileys";this.emojiSearchQuery="";this.currentPopupMsgId=null;this.popupCloseTimer=null;this.workspaceAgents=[];this.presenceInterval=null;this.audioCtx=null;this.botTyping=!1;this.agentTyping=!1;this.agentTypingTimer=null;this.realtimeChannel=null;this.typingChannel=null;this.forceNewConversation=!1;this.storageSuffix="";this.visitorToken=null;this.sessionTopic=null;this.sessionConversation=null;this.sessionPromise=null;this.legacyData=!1;this.liveChannel=null;this.liveConnected=!1;this.pollTimer=null;this.agentsPollTimer=null;this.previousConversations=[];this.pageEnteredAt=Date.now();this.lastReportedUrl=typeof window<"u"?window.location.href:"";this.referrerSource=typeof document<"u"&&document.referrer||"";this.routeChangeDebounceTimer=null;this.lastMessagesHtml="";this.lastMessagesTail=null;this.lastMessageId=null;this.config=this.parseConfig(),this.supabase=dn(this.config.supabaseUrl,this.config.supabaseKey);let e=this.config.workspaceId?`_${this.config.workspaceId.slice(0,8)}`:"";this.storageSuffix=e,this.visitorId=this.getOrCreateVisitorId(e);try{this.visitorToken=localStorage.getItem(`zentry_visitor_token${e}`)}catch{}this.conversationId=localStorage.getItem(`zentry_conversation_id${e}`)||localStorage.getItem(`zentry_conversation_id${e}`)||localStorage.getItem(`chatify_conversation_id${e}`),this.visitorName=localStorage.getItem(`zentry_visitor_name${e}`)||localStorage.getItem(`zentry_visitor_name${e}`)||localStorage.getItem(`chatify_visitor_name${e}`)||"",this.visitorEmail=localStorage.getItem(`zentry_visitor_email${e}`)||localStorage.getItem(`zentry_visitor_email${e}`)||localStorage.getItem(`chatify_visitor_email${e}`)||"";let t=!1;try{t=localStorage.getItem(`zentry_prechat_done${e}`)==="1"}catch{}(this.visitorEmail||t)&&(this.isPreChatCompleted=!0),this.initDOM(),this.fetchWorkspaceSettingsAndApply().then(async r=>{if((this.shadow?.getElementById("zentryLauncherBtn")||this.shadow?.getElementById("chatifyLauncherBtn"))?.classList.remove("is-loading"),!(r===!1||(this.bindGlobalTriggers(),!await this.ensureSession()))){if(this.initVisitorTracking(),this.initSPANavigationTracking(),this.legacyData){if(!this.conversationId&&this.visitorId)try{let s=this.supabase.from("conversations").select("id, status").eq("visitor_id",this.visitorId).order("created_at",{ascending:!1}).limit(1);this.config.workspaceId&&(s=s.eq("workspace_id",this.config.workspaceId));let{data:a}=await s.maybeSingle();a?.id&&(this.conversationId=a.id,this.conversationStatus=a.status||"open",localStorage.setItem(`zentry_conversation_id${e}`,a.id),localStorage.setItem(`zentry_conversation_id${e}`,a.id),localStorage.setItem(`chatify_conversation_id${e}`,a.id))}catch{}}else{let s=this.sessionConversation;if(!this.conversationId&&s?.id){this.conversationId=s.id,this.conversationStatus=s.status||"open";try{localStorage.setItem(`zentry_conversation_id${e}`,s.id),localStorage.setItem(`zentry_conversation_id${e}`,s.id),localStorage.setItem(`chatify_conversation_id${e}`,s.id)}catch{}}}this.conversationId&&await this.loadMessageHistory(),this.conversationId?this.subscribeToRealtime():this.visitorId&&this.subscribeToVisitorConversations(e);try{let s=sessionStorage.getItem(`zentry_widget_open${e}`)||sessionStorage.getItem(`zentry_widget_open${e}`)||sessionStorage.getItem(`chatify_widget_open${e}`),a=sessionStorage.getItem(`zentry_widget_tab${e}`)||sessionStorage.getItem(`zentry_widget_tab${e}`)||sessionStorage.getItem(`chatify_widget_tab${e}`);s==="1"&&(this.open(a||"messages"),this.scrollToBottom(!1))}catch{}this.initProactiveWelcome(),this.loadPreviousConversations()}})}getTimeOnPage(){return Math.max(0,Math.round((Date.now()-this.pageEnteredAt)/1e3))}isImageAttachment(e){return e?e.includes("cloudinary.com")&&(e.includes("/image/upload/")||!e.includes("/raw/upload/"))?!0:!!e.match(/\.(jpeg|jpg|png|webp|gif|svg|avif|bmp)(\?.*)?$/i):!1}parseConfig(){let e=document.currentScript;e||(e=document.querySelector('script[src*="widget.js"]'));let t=typeof window<"u"?new URLSearchParams(window.location.search):null,r=t?.get("workspaceId")||t?.get("ws")||t?.get("zentry_workspace")||t?.get("chatify_workspace"),n=t?.get("logo")||t?.get("logoUrl")||t?.get("logo_url"),s=t?.get("show_launcher_logo")??t?.get("launcher_logo"),a=t?.get("widget_icon")||t?.get("icon"),o=e?.getAttribute("data-api-url")||"";if(!o&&e?.src)try{let c=new URL(e.src);c.origin&&c.origin!=="null"&&(o=kn.has(c.hostname)?we:c.origin)}catch{}if(!o&&typeof window<"u"){let c=window.location.hostname;(c==="localhost"||c==="127.0.0.1")&&(o=window.location.origin)}o||(o=we);try{kn.has(new URL(o).hostname)&&(o=we)}catch{}return{supabaseUrl:e?.getAttribute("data-supabase-url")||Ua,supabaseKey:e?.getAttribute("data-supabase-key")||Da,workspaceId:r||e?.getAttribute("data-workspace-id")||null,title:e?.getAttribute("data-title")||"Support Team",subtitle:e?.getAttribute("data-subtitle")||"We reply in under 5 minutes",primaryColor:e?.getAttribute("data-color")||Xt,position:e?.getAttribute("data-position")||"bottom-right",helpTabLabel:e?.getAttribute("data-help-label")||"Help",showHelpTab:e?.getAttribute("data-show-help")!=="false",helpTabIcon:e?.getAttribute("data-help-icon")||"\u{1F4D6}",logoUrl:n||e?.getAttribute("data-logo-url")||e?.getAttribute("data-logo")||void 0,showLauncherLogo:s!==null?s!=="false":e?.getAttribute("data-show-launcher-logo")!=="false",widgetIcon:a||e?.getAttribute("data-widget-icon")||e?.getAttribute("data-icon")||void 0,widgetDesign:(()=>{let c=t?.get("widget_design")||e?.getAttribute("data-design");return $i(c)?c:void 0})(),welcomeText:e?.getAttribute("data-welcome-text")||void 0,businessName:e?.getAttribute("data-business-name")||e?.getAttribute("data-company-name")||void 0,customDomain:e?.getAttribute("data-custom-domain")||void 0,apiUrl:o,offsetBottom:e?.hasAttribute("data-offset-bottom")?parseInt(e.getAttribute("data-offset-bottom"),10):20,offsetSide:e?.hasAttribute("data-offset-side")?parseInt(e.getAttribute("data-offset-side"),10):20,zIndex:e?.hasAttribute("data-z-index")?parseInt(e.getAttribute("data-z-index"),10):2147483e3,enableProactiveWelcome:e?.getAttribute("data-enable-proactive-welcome")!=="false"&&e?.getAttribute("data-proactive-welcome")!=="false",proactiveDelaySeconds:Math.max(8,parseInt(e?.getAttribute("data-proactive-delay")||"8",10))}}resetSession(){let e=this.config.workspaceId?`_${this.config.workspaceId.slice(0,8)}`:"";localStorage.removeItem(`zentry_visitor_id${e}`),localStorage.removeItem(`zentry_visitor_token${e}`),localStorage.removeItem(`zentry_prechat_done${e}`),localStorage.removeItem(`zentry_conversation_id${e}`),localStorage.removeItem(`zentry_visitor_name${e}`),localStorage.removeItem(`zentry_visitor_email${e}`),localStorage.removeItem(`zentry_visitor_id${e}`),localStorage.removeItem(`chatify_visitor_id${e}`),localStorage.removeItem(`zentry_conversation_id${e}`),localStorage.removeItem(`chatify_conversation_id${e}`),localStorage.removeItem(`zentry_visitor_name${e}`),localStorage.removeItem(`chatify_visitor_name${e}`),localStorage.removeItem(`zentry_visitor_email${e}`),localStorage.removeItem(`chatify_visitor_email${e}`),window.location.reload()}async fetchWorkspaceSettingsAndApply(){if(!this.config.workspaceId)return!0;try{let{data:e,error:t}=await this.supabase.rpc("fn_get_workspace_config",{p_workspace_id:this.config.workspaceId});if(t||!e)return console.warn("[Zen-try] Workspace is suspended, inactive, or not found. Widget will not load."),this.container&&this.container.parentNode&&this.container.parentNode.removeChild(this.container),!1;if(e.name&&(this.config.businessName=e.name),e.plan==="enterprise"||e.plan==="legacy"){let r=this.shadow?.getElementById("zentryBrandingBadge");r&&(r.style.display="none")}return e.brand_color&&(this.config.primaryColor=e.brand_color),e.greeting_title&&(this.config.title=e.greeting_title),e.greeting_message&&(this.config.subtitle=e.greeting_message,this.config.welcomeText=e.greeting_message),typeof e.launcher_offset_bottom=="number"?this.config.offsetBottom=e.launcher_offset_bottom:e.navbar_trigger_config?.launcher_offset_bottom!==void 0&&(this.config.offsetBottom=Number(e.navbar_trigger_config.launcher_offset_bottom)),typeof e.launcher_offset_side=="number"?this.config.offsetSide=e.launcher_offset_side:e.navbar_trigger_config?.launcher_offset_side!==void 0&&(this.config.offsetSide=Number(e.navbar_trigger_config.launcher_offset_side)),typeof e.widget_z_index=="number"?this.config.zIndex=e.widget_z_index:e.navbar_trigger_config?.widget_z_index!==void 0&&(this.config.zIndex=Number(e.navbar_trigger_config.widget_z_index)),typeof e.enable_proactive_welcome=="boolean"?this.config.enableProactiveWelcome=e.enable_proactive_welcome:e.navbar_trigger_config?.enable_proactive_welcome!==void 0&&(this.config.enableProactiveWelcome=!!e.navbar_trigger_config.enable_proactive_welcome),typeof e.proactive_delay_seconds=="number"?this.config.proactiveDelaySeconds=Math.max(8,e.proactive_delay_seconds):e.navbar_trigger_config?.proactive_delay_seconds!==void 0&&(this.config.proactiveDelaySeconds=Math.max(8,Number(e.navbar_trigger_config.proactive_delay_seconds))),e.widget_position&&(this.config.position=e.widget_position==="left"?"bottom-left":"bottom-right"),e.help_center_tab_label&&(this.config.helpTabLabel=e.help_center_tab_label),e.logo_url&&(this.config.logoUrl=e.logo_url),typeof e.show_launcher_logo=="boolean"&&(this.config.showLauncherLogo=e.show_launcher_logo),e.navbar_trigger_config?.widget_icon?this.config.widgetIcon=e.navbar_trigger_config.widget_icon:e.widget_icon&&(this.config.widgetIcon=e.widget_icon),$i(e.navbar_trigger_config?.widget_design)&&(this.config.widgetDesign=e.navbar_trigger_config.widget_design),_n(e.navbar_trigger_config?.widget_secondary_color)&&(this.config.secondaryColor=e.navbar_trigger_config.widget_secondary_color),bn(e.navbar_trigger_config?.widget_color_mode)&&(this.config.colorMode=e.navbar_trigger_config.widget_color_mode),this.prechat=ji(e.navbar_trigger_config?.prechat),this.applyPrechatConfig(),e.greeting_title&&(this.config.greetingTitle=e.greeting_title),typeof e.show_help_tab=="boolean"&&(this.config.showHelpTab=e.show_help_tab),e.help_center_tab_icon&&(this.config.helpTabIcon=e.help_center_tab_icon),e.custom_domain&&(e.custom_domain_status==="live"||e.custom_domain_status==="verified")&&(this.config.customDomain=e.custom_domain),e.slug&&(this.config.helpSlug=e.slug),e.navbar_trigger_config&&(this.config.navbarTriggerConfig=e.navbar_trigger_config),e.business_hours&&(this.config.businessHours=e.business_hours),Array.isArray(e.agents)&&(this.workspaceAgents=e.agents),this.initNavbarAutoTrigger(),this.updateThemeAndTexts(),this.renderAvatarsStack(this.workspaceAgents),this.updatePresenceAndTexts(),this.subscribeToAgentsRealtime(),await this.loadWorkspaceArticles(),!0}catch(e){return console.warn("[Zen-try] Could not fetch workspace config:",e),!0}}isOutsideBusinessHours(e){if(!e||!e.enabled||!e.schedule)return!1;try{let t=new Date,r=e.timezone||"UTC",n=new Intl.DateTimeFormat("en-US",{weekday:"long",timeZone:r}).format(t).toLowerCase(),s=e.schedule[n];if(!s||!s.enabled)return!0;let a=new Intl.DateTimeFormat("en-GB",{hour:"2-digit",minute:"2-digit",hour12:!1,timeZone:r}).format(t);return a<s.start||a>s.end}catch{return!1}}async loadWorkspaceArticles(){if(!this.config.workspaceId){this.sections=[],this.faqs=[],this.renderFaqList();return}try{let[e,t]=await Promise.all([this.supabase.from("help_sections").select("id, name, description, icon, order_index, slug").eq("workspace_id",this.config.workspaceId).order("order_index",{ascending:!0}).order("created_at",{ascending:!0}),this.supabase.from("articles").select("id, title, slug, summary, content, category, section_id, order_index, section:help_sections(id, name, icon)").eq("workspace_id",this.config.workspaceId).eq("status","published").order("order_index",{ascending:!0}).order("created_at",{ascending:!0})]),r=t.data||[],n=e.data||[];this.faqs=r.map(h=>({id:h.id,slug:h.slug,q:h.title,summary:h.summary||"",a:h.content,category:h.section?.name||h.section_id&&h.category||"Other",icon:h.section?.icon||"\u{1F4DA}",sectionId:h.section_id||null,order_index:h.order_index??0}));let s={},a=0;this.faqs.forEach(h=>{h.sectionId?s[h.sectionId]=(s[h.sectionId]||0)+1:a++});let o=n.filter(h=>(s[h.id]||0)>0).map(h=>({id:h.id,name:h.name,description:h.description||null,icon:h.icon||"\u{1F4DA}",order_index:h.order_index??0,slug:h.slug||"",articleCount:s[h.id]||0})),c=new Set,l=[];for(let h of o){let d=(h.name||"").trim().toLowerCase();d&&!c.has(d)&&(c.add(d),l.push(h))}if(a>0){let h="Other";c.has("other")&&(h="More Articles"),c.add(h.toLowerCase()),l.push({id:"__other__",name:h,description:null,icon:"\u{1F4DA}",order_index:9999,slug:"other",articleCount:a})}if(this.sections=l,!this.config.customDomain||!this.config.helpSlug){let{data:h}=await this.supabase.from("public_workspaces").select("custom_domain, custom_domain_status, slug").eq("id",this.config.workspaceId).maybeSingle();h&&(h.custom_domain&&(h.custom_domain_status==="live"||h.custom_domain_status==="verified")&&(this.config.customDomain=h.custom_domain),h.slug&&(this.config.helpSlug=h.slug))}this.renderFaqList(),this.updateThemeAndTexts(),this.initNavbarAutoTrigger()}catch(e){console.warn("[Zen-try] Failed to fetch dynamic articles or sections:",e),this.sections=[],this.faqs=[],this.renderFaqList(),this.updateThemeAndTexts(),this.initNavbarAutoTrigger()}}formatChatMarkdown(e){let t=c=>{let l=this.escapeHTML(c);return l=l.replace(/`([^`]+)`/g,'<code class="zentry-inline-code chatify-inline-code">$1</code>'),l=l.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)"'<>]+|mailto:[^\s)"'<>]+)\)/g,'<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'),l=l.split(/(<a\b[^>]*>[\s\S]*?<\/a>|<[^>]+>)/).map((h,d)=>d%2?h:this.linkifyHTML(this.unescapeHTML(h))).join(""),l=l.replace(/\*\*([^*]+?)\*\*/g,"<strong>$1</strong>"),l=l.replace(/(^|[^*\w])\*(?!\s)([^*]+?)\*(?!\w)/g,"$1<em>$2</em>"),l},r=[],n=null,s=[],a=()=>{s.length&&r.push(`<p>${s.map(t).join("<br/>")}</p>`),s=[]},o=()=>{n&&r.push(`<${n.tag}>${n.items.map(c=>`<li>${c}</li>`).join("")}</${n.tag}>`),n=null};for(let c of e.replace(/\r\n/g,`
`).split(`
`)){let l=c.trim(),h=l.match(/^(#{1,4})\s+(.+)$/),d=l.match(/^[-*•]\s+(.+)$/),f=l.match(/^\d+[.)]\s+(.+)$/);if(!l)a(),o();else if(h){a(),o();let u=Math.min(Math.max(h[1].length,2)+1,5);r.push(`<h${u}>${t(h[2].replace(/\*\*/g,""))}</h${u}>`)}else if(/^(-{3,}|\*{3,})$/.test(l))a(),o(),r.push("<hr/>");else if(d||f){a();let u=d?"ul":"ol";n&&n.tag!==u&&o(),n||(n={tag:u,items:[]}),n.items.push(t((d||f)[1]))}else n&&/^\s{2,}/.test(c)?n.items[n.items.length-1]+=`<br/>${t(l)}`:(o(),s.push(l))}return a(),o(),r.join("")}formatMarkdownToHtml(e){return xn(e)}renderArticleItem(e,t,r){let n=encodeURIComponent(e.slug||e.id||""),s="";this.config.workspaceId&&n&&(this.config.customDomain?s=`https://${this.config.customDomain.replace(/^https?:\/\//i,"").replace(/\/$/,"")}/${n}`:s=`${(this.config.apiUrl||we).replace(/\/$/,"")}/help/${encodeURIComponent(this.config.workspaceId)}/${n}`);let a=this.safeUrl(s);return`
      <div class="zentry-faq-item chatify-faq-item" data-idx="${t}" data-id="${this.escapeHTML(e.id||"")}" data-slug="${this.escapeHTML(e.slug||"")}">
        ${r&&e.category?`
          <div style="font-size:11px; font-weight:600; color:var(--w-brand); margin-bottom:4px; display:flex; align-items:center; gap:4px;">
            <span>${this.escapeHTML(e.icon||"\u{1F4DA}")}</span>
            <span>${this.escapeHTML(e.category)}</span>
          </div>
        `:""}
        <div class="zentry-faq-q chatify-faq-q">
          <span>${this.escapeHTML(e.q)}</span>
          <span class="zentry-faq-arrow chatify-faq-arrow">\u203A</span>
        </div>
        <div class="zentry-faq-a chatify-faq-a">
          ${e.summary?`<p style="font-size:12px; font-weight:600; color:var(--w-ink); margin-bottom:6px; line-height:1.4;">${this.escapeHTML(e.summary)}</p>`:""}
          <div class="zentry-faq-markdown chatify-faq-markdown">${this.formatMarkdownToHtml(e.a)}</div>
          
          <div style="margin-top:12px; padding-top:8px; border-top:1px solid var(--w-line); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
            ${a?`
              <a href="${a}" target="_blank" rel="noopener noreferrer" class="zentry-article-ext-link chatify-article-ext-link" title="Open full article in dedicated Help Center">
                <span>Open in full Help Center</span> \u2197
              </a>
            `:"<span></span>"}

            ${e.id?`
              <div class="zentry-vote-group chatify-vote-group" style="display:flex; align-items:center; gap:6px;">
                <span style="font-size:11px; color:var(--w-ink-3);">Helpful?</span>
                <button class="zentry-vote-btn chatify-vote-btn" data-art-id="${this.escapeHTML(e.id)}" data-helpful="true" style="padding:4px 10px; border-radius:var(--w-r-sm); border:1px solid var(--w-line-2); background:var(--w-surface); font-size:12px; font-weight:600; cursor:pointer; color:var(--w-ink);">Yes</button>
                <button class="zentry-vote-btn chatify-vote-btn" data-art-id="${this.escapeHTML(e.id)}" data-helpful="false" style="padding:4px 10px; border-radius:var(--w-r-sm); border:1px solid var(--w-line-2); background:var(--w-surface); font-size:12px; font-weight:600; cursor:pointer; color:var(--w-ink);">No</button>
              </div>
            `:""}
          </div>
        </div>
      </div>
    `}renderFaqList(){let e=this.shadow?.getElementById("faqList");if(!e)return;let t=this.shadow?.getElementById("cardHelpSearch");if(t&&(t.style.display=this.config.showHelpTab!==!1&&this.faqs.length>0?"block":"none"),this.faqs.length===0){e.innerHTML="";return}let r=(this.faqSearchQuery||"").toLowerCase().trim();if(r){let a=this.faqs.filter(o=>o.q.toLowerCase().includes(r)||o.summary&&o.summary.toLowerCase().includes(r)||o.a.toLowerCase().includes(r)||o.category&&o.category.toLowerCase().includes(r));if(a.length===0){e.innerHTML=`
          <div id="faqNoResults" style="padding: 32px 16px; text-align: center; color: var(--w-ink-3); font-size: 13px;">
            <div style="font-size: 24px; margin-bottom: 8px;">\u{1F50D}</div>
            <p style="margin: 0; font-weight: 500;">No articles match &ldquo;${this.escapeHTML(r)}&rdquo;.</p>
          </div>
        `;return}e.innerHTML=`
        <div style="font-size: 11.5px; font-weight: 600; color: var(--w-ink-3); margin-bottom: 10px; padding-left: 2px;">
          ${a.length} article${a.length===1?"":"s"} found
        </div>
        <div class="zentry-faq-list chatify-faq-list">
          ${a.map((o,c)=>this.renderArticleItem(o,c,!0)).join("")}
        </div>
      `,this.bindFaqListeners();return}if(!this.activeSectionId){if(this.sections.length===0){e.innerHTML=`
          <div class="zentry-faq-list chatify-faq-list">
            ${this.faqs.map((a,o)=>this.renderArticleItem(a,o,!0)).join("")}
          </div>
        `,this.bindFaqListeners();return}e.innerHTML=`
        <div class="zentry-section-list chatify-section-list">
          ${this.sections.map(a=>`
            <div class="zentry-section-card chatify-section-card" data-section-id="${this.escapeHTML(a.id)}">
              <div class="zentry-section-card chatify-section-card-icon">${this.escapeHTML(a.icon||"\u{1F4DA}")}</div>
              <div class="zentry-section-card chatify-section-card-info">
                <h4 class="zentry-section-card chatify-section-card-title">${this.escapeHTML(a.name)}</h4>
                <p class="zentry-section-card chatify-section-card-desc">
                  ${a.description?this.escapeHTML(a.description):`${a.articleCount||0} article${(a.articleCount||0)===1?"":"s"}`}
                </p>
              </div>
              <span class="zentry-section-card chatify-section-card-arrow">\u203A</span>
            </div>
          `).join("")}
        </div>
      `,this.bindFaqListeners();return}let n=this.sections.find(a=>a.id===this.activeSectionId)||{id:this.activeSectionId,name:"Articles",icon:"\u{1F4DA}",description:null,articleCount:0},s=this.faqs.filter(a=>a.sectionId===this.activeSectionId||this.activeSectionId==="__other__"&&!a.sectionId);e.innerHTML=`
      <div class="zentry-section-view chatify-section-view">
        <button class="zentry-section-back-btn chatify-section-back-btn" id="faqBackToSections" title="Back to collections">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          <span>All Collections</span>
        </button>

        <div class="zentry-section-view chatify-section-view-header">
          <span class="zentry-section-view chatify-section-view-icon">${this.escapeHTML(n.icon||"\u{1F4DA}")}</span>
          <div class="zentry-section-view chatify-section-view-text">
            <h3>${this.escapeHTML(n.name)}</h3>
            ${n.description?`<p>${this.escapeHTML(n.description)}</p>`:`<p>${s.length} article${s.length===1?"":"s"}</p>`}
          </div>
        </div>

        <div class="zentry-faq-list chatify-faq-list">
          ${s.length===0?`
            <div style="padding: 32px 16px; text-align: center; color: var(--w-ink-3); font-size: 13px;">
              <p style="margin: 0; font-weight: 500;">No articles in this section yet.</p>
            </div>
          `:s.map((a,o)=>this.renderArticleItem(a,o,!1)).join("")}
        </div>
      </div>
    `,this.bindFaqListeners()}bindFaqListeners(){let e=this.shadow?.getElementById("faqBackToSections");e&&(e.onclick=()=>{this.activeSectionId=null,this.renderFaqList()}),this.shadow?.querySelectorAll(".zentry-section-card, .chatify-section-card").forEach(t=>{t.onclick=()=>{let r=t.getAttribute("data-section-id");r&&(this.activeSectionId=r,this.renderFaqList())}}),this.shadow?.querySelectorAll(".zentry-faq-item, .chatify-faq-item").forEach(t=>{t.onclick=r=>{r.target.closest(".zentry-vote-btn, .chatify-vote-btn")||r.target.closest(".zentry-article-ext-link, .chatify-article-ext-link")||t.classList.toggle("open")}}),this.shadow?.querySelectorAll(".zentry-vote-btn, .chatify-vote-btn").forEach(t=>{t.onclick=async r=>{r.stopPropagation();let n=r.currentTarget,s=n.getAttribute("data-art-id"),a=n.getAttribute("data-helpful")==="true",o=n.closest(".zentry-vote-group, .chatify-vote-group");if(o&&(o.innerHTML='<span style="font-size:11px; color:var(--w-brand); font-weight:600;">\u2713 Feedback sent</span>'),s&&this.config.workspaceId)try{await this.supabase.rpc("fn_submit_article_feedback",{p_article_id:s,p_workspace_id:this.config.workspaceId,p_visitor_id:this.visitorId,p_is_helpful:a,p_feedback_text:null})}catch{}}})}getOrCreateVisitorId(e){let t=localStorage.getItem(`zentry_visitor_id${e}`)||localStorage.getItem(`chatify_visitor_id${e}`);return!t||!za.test(t)?(t=this.newVisitorId(),localStorage.setItem(`zentry_visitor_id${e}`,t),localStorage.setItem(`chatify_visitor_id${e}`,t)):localStorage.setItem(`zentry_visitor_id${e}`,t),t}newVisitorId(){try{if(typeof crypto<"u"&&typeof crypto.randomUUID=="function")return crypto.randomUUID()}catch{}return"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,e=>{let t=Math.random()*16|0;return(e==="x"?t:t&3|8).toString(16)})}static isMissingFunction(e){let t=e;return t?.code==="PGRST202"||t?.code==="42883"||/could not find the function/i.test(String(t?.message||""))}static errorText(e){return String(e?.message||e||"")}ensureSession(){return this.legacyData||this.visitorToken&&this.sessionTopic?Promise.resolve(!0):(this.sessionPromise||(this.sessionPromise=this.openSession().finally(()=>{this.sessionPromise=null})),this.sessionPromise)}async openSession(){if(!this.config.workspaceId)return this.legacyData=!0,!0;for(let e=0;e<3;e++){let t=null,r=null;try{let n=await this.supabase.rpc("fn_widget_session",{p_workspace_id:this.config.workspaceId,p_visitor_id:this.visitorId,p_token:this.visitorToken});t=n.data,r=n.error}catch(n){r=n}if(!r&&t){if(t.token){this.visitorToken=t.token;try{localStorage.setItem(`zentry_visitor_token${this.storageSuffix}`,t.token)}catch{}}return this.sessionTopic=t.topic||null,this.sessionConversation=t.conversation||null,!0}if(i.isMissingFunction(r))return this.legacyData=!0,!0;if(/workspace_unavailable/.test(i.errorText(r)))return this.container&&this.container.parentNode&&this.container.parentNode.removeChild(this.container),!1;if(!/visitor_session_invalid/.test(i.errorText(r)))return console.warn("[Zen-try] Could not start the chat session:",i.errorText(r)),!1;if(e===0){await new Promise(s=>setTimeout(s,400));let n=null;try{n=localStorage.getItem(`zentry_visitor_token${this.storageSuffix}`)}catch{}if(n&&n!==this.visitorToken){this.visitorToken=n;continue}}this.resetVisitorIdentity()}return!1}resetVisitorIdentity(){let e=this.storageSuffix;this.visitorId=this.newVisitorId(),this.visitorToken=null,this.sessionTopic=null,this.sessionConversation=null,this.forgetConversation();try{localStorage.setItem(`zentry_visitor_id${e}`,this.visitorId),localStorage.setItem(`chatify_visitor_id${e}`,this.visitorId),localStorage.removeItem(`zentry_visitor_token${e}`)}catch{}}forgetConversation(){let e=this.storageSuffix;this.conversationId=null,this.conversationStatus="open",this.messages=[];try{localStorage.removeItem(`zentry_conversation_id${e}`),localStorage.removeItem(`chatify_conversation_id${e}`)}catch{}}async widgetRpc(e,t={}){if(!await this.ensureSession())throw new Error("Chat session unavailable");let{data:r,error:n}=await this.supabase.rpc(e,{p_visitor_id:this.visitorId,p_token:this.visitorToken,...t});if(n)throw/visitor_session_invalid/.test(n.message||"")&&(this.sessionTopic=null),n;return r}async saveVisitorDetails(e){if(this.legacyData){await this.supabase.rpc("fn_upsert_visitor",{p_id:this.visitorId,p_name:this.visitorName||null,p_email:this.visitorEmail||null,p_current_url:window.location.href,p_user_agent:navigator.userAgent,p_ip_address:null,p_location:e,p_workspace_id:this.config.workspaceId||null});return}await this.widgetRpc("fn_widget_update_visitor",{p_name:this.visitorName||null,p_email:this.visitorEmail||null,p_current_url:window.location.href,p_user_agent:navigator.userAgent,p_location:e})}async initVisitorTracking(){this.pageEnteredAt=Date.now(),this.lastReportedUrl=window.location.href,this.referrerSource=document.referrer||"";let e=Intl.DateTimeFormat().resolvedOptions().timeZone||"Unknown";try{try{await this.saveVisitorDetails(e)}catch(r){console.warn("[Zen-try] Visitor details not saved:",i.errorText(r))}await this.recordPage(window.location.href,document.title||null,0);try{this.legacyData?await this.supabase.rpc("fn_update_visitor_meta",{p_id:this.visitorId,p_timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||null,p_language:navigator.language||null}):await this.widgetRpc("fn_widget_update_meta",{p_timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||null,p_language:navigator.language||null})}catch{}}catch(r){console.warn("[Zen-try] Visitor tracking error:",r)}(async()=>{try{let r=await fetch(`${this.config.apiUrl||""}/api/visitor/geo`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({visitor_id:this.visitorId,visitor_token:this.visitorToken}),signal:AbortSignal.timeout(6e3)}),n=r.ok?await r.json():null;n?.location&&await this.saveVisitorDetails(n.location)}catch{}})(),setInterval(()=>{this.sendHeartbeat()},2e4);let t=()=>{try{let r=this.legacyData;fetch(`${this.config.supabaseUrl}/rest/v1/rpc/${r?"fn_visitor_offline":"fn_widget_offline"}`,{method:"POST",headers:{"Content-Type":"application/json",apikey:this.config.supabaseKey,Authorization:`Bearer ${this.config.supabaseKey}`},body:JSON.stringify(r?{p_visitor_id:this.visitorId}:{p_visitor_id:this.visitorId,p_token:this.visitorToken}),keepalive:!0}).catch(()=>{})}catch{}};window.addEventListener("beforeunload",t),window.addEventListener("offline",()=>this.updateNetworkBanner(!1)),window.addEventListener("online",()=>this.updateNetworkBanner(!0)),window.addEventListener("pagehide",t)}async sendHeartbeat(){try{let e={p_current_url:window.location.href,p_page_title:document.title||null,p_referrer:this.referrerSource||null,p_time_on_page:this.getTimeOnPage()};this.legacyData?await this.supabase.rpc("fn_visitor_heartbeat",{p_visitor_id:this.visitorId,...e}):await this.widgetRpc("fn_widget_heartbeat",e)}catch{}}async recordPage(e,t,r){try{this.legacyData?await this.supabase.rpc("fn_record_visitor_page",{p_visitor_id:this.visitorId,p_url:e,p_title:t,p_referrer:this.referrerSource||null,p_duration_seconds:r,p_workspace_id:this.config.workspaceId||null}):await this.widgetRpc("fn_widget_record_page",{p_url:e,p_title:t,p_referrer:this.referrerSource||null,p_duration_seconds:r})}catch{}}initSPANavigationTracking(){let e=()=>{window.location.href!==this.lastReportedUrl&&(this.routeChangeDebounceTimer&&clearTimeout(this.routeChangeDebounceTimer),this.routeChangeDebounceTimer=setTimeout(async()=>{let s=window.location.href;if(s===this.lastReportedUrl)return;let a=this.getTimeOnPage(),o=this.lastReportedUrl;this.pageEnteredAt=Date.now(),this.referrerSource=o||this.referrerSource,this.lastReportedUrl=s;let c=document.title||null;await this.recordPage(s,c,a)},500))},t=history.pushState;history.pushState=function(...n){let s=t.apply(this,n);return e(),s};let r=history.replaceState;history.replaceState=function(...n){let s=r.apply(this,n);return e(),s},window.addEventListener("popstate",e),window.addEventListener("hashchange",e)}playIncomingSound(){try{if(!this.audioCtx){let n=window.AudioContext||window.webkitAudioContext;this.audioCtx=new n}this.audioCtx.state==="suspended"&&this.audioCtx.resume();let e=this.audioCtx.currentTime,t=this.audioCtx.createOscillator(),r=this.audioCtx.createGain();t.type="sine",t.frequency.setValueAtTime(784,e),t.frequency.setValueAtTime(1046.5,e+.1),r.gain.setValueAtTime(0,e),r.gain.linearRampToValueAtTime(.2,e+.02),r.gain.exponentialRampToValueAtTime(.001,e+.35),t.connect(r),r.connect(this.audioCtx.destination),t.start(e),t.stop(e+.35)}catch{}}subscribeToRealtime(){if(this.conversationId){if(this.realtimeChannel){try{this.supabase.removeChannel(this.realtimeChannel)}catch{}this.realtimeChannel=null}if(this.subscribeToTyping(),!this.legacyData){this.startLiveUpdates();return}this.realtimeChannel=this.supabase.channel(`chatify-widget-${this.conversationId}`).on("postgres_changes",{event:"INSERT",schema:"public",table:"messages",filter:`conversation_id=eq.${this.conversationId}`},e=>this.receiveMessage(e.new)).on("postgres_changes",{event:"UPDATE",schema:"public",table:"messages",filter:`conversation_id=eq.${this.conversationId}`},e=>this.updateMessage(e.new)).on("postgres_changes",{event:"DELETE",schema:"public",table:"messages",filter:`conversation_id=eq.${this.conversationId}`},e=>this.removeMessage(e.old?.id)).on("postgres_changes",{event:"UPDATE",schema:"public",table:"conversations",filter:`id=eq.${this.conversationId}`},e=>this.updateConversationStatus(e.new.status)).subscribe()}}receiveMessage(e){if(e.is_internal||this.messages.some(r=>r.id===e.id))return;let t=this.messages.findIndex(r=>(r.id.startsWith("temp-")||r.pending)&&r.sender_type===e.sender_type&&(r.content===e.content||r.attachment_url===e.attachment_url));if(t!==-1){this.messages[t]=e,this.renderMessages();return}e.sender_type!=="visitor"&&(this.botTyping=!1,this.agentTyping=!1),this.messages.push(e),this.renderMessages(),e.sender_type!=="visitor"&&(this.playIncomingSound(),!this.isOpen||this.activeTab!=="messages"?(this.unreadCount+=1,this.updateUnreadBadge(),this.markMessagesAsDelivered(),this.isOpen||this.showMessagePopup(e)):this.markMessagesAsRead())}updateMessage(e){let t=this.messages.findIndex(n=>n.id===e.id);if(t===-1)return;let r={...this.messages[t],...e};this.sameMessage(this.messages[t],r)||(this.messages[t]=r,this.renderMessages())}sameMessage(e,t){let r=n=>n?Date.parse(n)||n:null;return e.content===t.content&&(e.attachment_url||null)===(t.attachment_url||null)&&r(e.read_at)===r(t.read_at)&&r(e.delivered_at)===r(t.delivered_at)&&JSON.stringify(e.metadata||null)===JSON.stringify(t.metadata||null)}removeMessage(e){if(!e)return;let t=this.messages.length;this.messages=this.messages.filter(r=>r.id!==e),this.messages.length!==t&&this.renderMessages()}updateConversationStatus(e){!e||e===this.conversationStatus||(this.conversationStatus=e,this.renderMessages())}startLiveUpdates(){this.legacyData||(this.sessionTopic&&!this.liveChannel&&(this.liveChannel=this.supabase.channel(this.sessionTopic,{config:{private:!1}}).on("broadcast",{event:"message"},({payload:e})=>this.onLiveMessage(e)).on("broadcast",{event:"conversation"},({payload:e})=>this.onLiveConversation(e)).subscribe(e=>{this.liveConnected=e==="SUBSCRIBED"}),document.addEventListener("visibilitychange",()=>{document.visibilityState==="visible"&&this.pollSoon()})),this.schedulePoll())}onLiveMessage(e){let t=e?.message;if(t?.id){if(t.conversation_id&&t.conversation_id!==this.conversationId){e?.op==="INSERT"&&this.loadPreviousConversations();return}e?.op==="DELETE"?this.removeMessage(t.id):e?.op==="UPDATE"?this.updateMessage(t):this.receiveMessage(t)}}handoffSnapshot(){return[this.handoffStatus,this.aiAssistEnabled,this.assignedAgentId,this.nextOpenLabel,this.expectedWaitText].join("|")}onLiveConversation(e){let t=e?.conversation;if(t?.id)if(t.id===this.conversationId){let r=this.handoffSnapshot(),n=this.conversationStatus;t.handoff_status&&(this.handoffStatus=t.handoff_status),t.ai_assist!==void 0&&(this.aiAssistEnabled=!!t.ai_assist),t.assigned_agent_id!==void 0&&(this.assignedAgentId=t.assigned_agent_id),this.applyHandoffDetails(t),this.updateConversationStatus(t.status),this.conversationStatus===n&&this.handoffSnapshot()!==r&&this.renderMessages()}else!this.conversationId&&!this.forceNewConversation&&t.status!=="closed"&&this.adoptConversation(t.id,t.status)}async adoptConversation(e,t){this.conversationId=e,this.conversationStatus=t||"open";try{localStorage.setItem(`zentry_conversation_id${this.storageSuffix}`,e),localStorage.setItem(`chatify_conversation_id${this.storageSuffix}`,e)}catch{}await this.loadMessageHistory(),this.subscribeToRealtime()}schedulePoll(){if(this.legacyData)return;this.pollTimer&&clearTimeout(this.pollTimer);let e=typeof document<"u"&&document.visibilityState==="hidden",t=this.isOpen&&this.activeTab==="messages",r=e?6e4:this.conversationId?this.liveConnected?3e4:t?4e3:12e3:45e3;this.pollTimer=setTimeout(()=>this.poll(),r)}pollSoon(){this.legacyData||!this.sessionTopic||(this.pollTimer&&clearTimeout(this.pollTimer),this.pollTimer=setTimeout(()=>this.poll(),300))}async poll(){this.pollTimer=null;try{if(this.conversationId)await this.syncMessages();else if(!this.forceNewConversation&&this.visitorToken){let{data:e,error:t}=await this.supabase.rpc("fn_widget_session",{p_workspace_id:this.config.workspaceId,p_visitor_id:this.visitorId,p_token:this.visitorToken});if(t&&/workspace_unavailable/.test(i.errorText(t))){this.container&&this.container.parentNode&&this.container.parentNode.removeChild(this.container);return}let r=e?.conversation;r?.id&&r.status!=="closed"&&!this.conversationId&&await this.adoptConversation(r.id,r.status)}}catch{}this.schedulePoll()}async syncMessages(){let e=this.conversationId;if(!e||this.legacyData)return;let t;try{t=await this.widgetRpc("fn_widget_messages",{p_conversation_id:e})}catch(c){/conversation_not_found/.test(i.errorText(c))&&(this.forgetConversation(),this.renderMessages());return}if(e!==this.conversationId)return;let r=this.handoffSnapshot(),n=Array.isArray(t?.messages)?t.messages:[],s=new Map(n.map(c=>[c.id,c])),a=n.length?n[0].created_at:null;for(let c of[...this.messages])c.id.startsWith("temp-")||c.pending||s.has(c.id)||a&&c.created_at<a||this.removeMessage(c.id);for(let c of n){let l=this.messages.find(h=>h.id===c.id);l?this.sameMessage(l,{...l,...c})||this.updateMessage(c):this.receiveMessage(c)}t?.conversation?.handoff_status&&(this.handoffStatus=t.conversation.handoff_status),t?.conversation?.handoff_summary&&(this.handoffSummary=t.conversation.handoff_summary),t?.conversation?.handoff_reason&&(this.handoffReason=t.conversation.handoff_reason),t?.conversation?.ai_assist!==void 0&&(this.aiAssistEnabled=!!t.conversation.ai_assist),t?.conversation?.assigned_agent_id&&(this.assignedAgentId=t.conversation.assigned_agent_id),this.applyHandoffDetails(t?.conversation);let o=this.conversationStatus;this.updateConversationStatus(t?.conversation?.status),this.conversationStatus===o&&this.handoffSnapshot()!==r&&this.renderMessages()}async loadMessageHistory(){if(!this.conversationId)return;let e=null;if(this.legacyData)e=(await this.supabase.from("messages").select("*").eq("conversation_id",this.conversationId).or("is_internal.is.null,is_internal.eq.false").order("created_at",{ascending:!0})).data;else try{let t=await this.widgetRpc("fn_widget_messages",{p_conversation_id:this.conversationId});e=Array.isArray(t?.messages)?t.messages:[],t?.conversation?.status&&(this.conversationStatus=t.conversation.status),t?.conversation?.handoff_status&&(this.handoffStatus=t.conversation.handoff_status),t?.conversation?.handoff_summary&&(this.handoffSummary=t.conversation.handoff_summary),t?.conversation?.handoff_reason&&(this.handoffReason=t.conversation.handoff_reason),t?.conversation?.ai_assist!==void 0&&(this.aiAssistEnabled=!!t.conversation.ai_assist),t?.conversation?.assigned_agent_id&&(this.assignedAgentId=t.conversation.assigned_agent_id),this.applyHandoffDetails(t?.conversation),t?.conversation?.csat_rating!=null&&(this.csatRated=!0)}catch(t){/conversation_not_found/.test(i.errorText(t))&&(this.forgetConversation(),this.renderMessages());return}if(e){if(this.messages=e,this.renderMessages(),this.isOpen&&this.activeTab==="messages")this.unreadCount=0,this.markMessagesAsRead();else if(this.unreadCount=this.messages.filter(t=>t.sender_type!=="visitor"&&!t.read_at).length,!this.isOpen&&this.unreadCount>0){let t=[...this.messages].reverse().find(r=>r.sender_type!=="visitor"&&!r.read_at);if(t)try{sessionStorage.getItem(`chatify_popup_dismissed_${t.id}`)||this.showMessagePopup(t)}catch{}}this.updateUnreadBadge()}}async markMessagesAsDelivered(){if(this.conversationId){if(!this.legacyData){try{await this.widgetRpc("fn_widget_mark",{p_conversation_id:this.conversationId,p_read:!1})}catch{}return}try{await this.supabase.rpc("fn_mark_messages_delivered",{p_conversation_id:this.conversationId,p_exclude_sender:"visitor"})}catch{}}}async markMessagesAsRead(){if(this.conversationId&&this.messages.some(e=>e.sender_type!=="visitor"&&!e.read_at&&!String(e.id).startsWith("temp-"))){if(!this.legacyData){try{await this.widgetRpc("fn_widget_mark",{p_conversation_id:this.conversationId,p_read:!0})}catch{}return}try{await this.supabase.rpc("fn_mark_messages_read",{p_conversation_id:this.conversationId,p_exclude_sender:"visitor"})}catch{}try{await this.supabase.rpc("fn_mark_conversation_messages_as_read",{p_conversation_id:this.conversationId,p_reader_type:"visitor"})}catch{}}}async ensureConversation(){if(this.conversationId)return this.conversationId;let e=this.config.workspaceId?`_${this.config.workspaceId.slice(0,8)}`:"",t=null,r=null;if(!this.legacyData){let n=await this.widgetRpc("fn_widget_start_conversation",{p_force_new:this.forceNewConversation});this.forceNewConversation=!1,this.conversationId=n.id,this.conversationStatus=n.status||"open";try{localStorage.setItem(`zentry_conversation_id${e}`,n.id),localStorage.setItem(`chatify_conversation_id${e}`,n.id)}catch{}return this.subscribeToRealtime(),n.id}if(this.forceNewConversation)r=new Error("forced new conversation");else{let n=await this.supabase.rpc("fn_get_or_create_conversation",{p_visitor_id:this.visitorId,p_workspace_id:this.config.workspaceId||null});t=n.data,r=n.error}if(this.forceNewConversation=!1,r||!t){console.warn("[Zen-try] fn_get_or_create_conversation fallback:",r);try{await this.supabase.from("visitors").upsert({id:this.visitorId,workspace_id:this.config.workspaceId||null,last_seen:new Date().toISOString(),is_online:!0});let{data:n,error:s}=await this.supabase.from("conversations").insert({visitor_id:this.visitorId,workspace_id:this.config.workspaceId||null,status:"open",ai_mode:"autopilot"}).select().single();if(n)t=n;else throw s||new Error("Failed to create conversation")}catch(n){throw new Error("Failed to create conversation: "+(r?.message||String(n)))}}return this.conversationId=t.id,this.conversationStatus=t.status||"open",localStorage.setItem(`chatify_conversation_id${e}`,t.id),this.subscribeToRealtime(),t.id}async sendMessage(e,t){if(!e.trim()&&!t)return;let r=await this.ensureConversation(),n={id:"temp-"+Date.now(),sender_type:"visitor",content:e.trim()||(t?"Sent a picture":""),attachment_url:t||null,created_at:new Date().toISOString(),pending:!0};this.messages.push(n),this.renderMessages();let s=null,a=null;if(this.legacyData){this.conversationStatus!=="open"&&(this.conversationStatus="open",this.supabase.from("conversations").update({status:"open",closed_at:null,snoozed_until:null,updated_at:new Date().toISOString()}).eq("id",r).then(()=>{}));let o=await this.supabase.from("messages").insert({conversation_id:r,sender_type:"visitor",content:e.trim()||(t?"Sent a picture":""),attachment_url:t||null,is_internal:!1}).select().single();s=o.data,a=o.error}else{this.conversationStatus="open";try{s=await this.widgetRpc("fn_widget_send_message",{p_conversation_id:r,p_content:e.trim(),p_attachment_url:t||null})}catch(o){a=o}}if(a){if(console.error("[Zen-try] Error sending message:",a),String(a?.message||a||"").includes("rate_limited")){this.messages=this.messages.filter(h=>h.id!==n.id);let l=this.shadow?.getElementById("chatifyInput");l&&((!l.value||!l.value.trim())&&(l.value=e),this.adjustTextareaHeight(),l.focus()),this.messages.push({id:"rate-limit-"+Date.now(),sender_type:"agent",content:"You're sending messages too fast. Please wait a moment.",created_at:new Date().toISOString(),metadata:{system_event:"rate_limit"}}),this.renderMessages();return}n.pending=!1,this.renderMessages();return}if(s){let o=this.messages.findIndex(c=>c.id===n.id);o!==-1&&(this.messages[o]=s,this.renderMessages())}if(this.config.workspaceId){let o=setTimeout(()=>this.setBotTyping(!0),700),c=JSON.stringify({conversation_id:r,workspace_id:this.config.workspaceId,message_id:s?.id}),l=d=>fetch(`${d}/api/ai/auto-respond`,{method:"POST",headers:{"Content-Type":"application/json"},body:c}),h=this.config.apiUrl||"";l(h).catch(d=>{if(h===we)throw d;return console.warn("[Zen-try] Reply service unreachable at",h||window.location.origin,"- retrying",we),l(we)}).catch(d=>console.error("[Zen-try] Could not reach the reply service:",d)).finally(()=>{clearTimeout(o),this.setBotTyping(!1)})}}setBotTyping(e){this.botTyping!==e&&(this.botTyping=e,this.renderMessages())}subscribeToTyping(){if(this.typingChannel){try{this.supabase.removeChannel(this.typingChannel)}catch{}this.typingChannel=null}this.conversationId&&(this.typingChannel=this.supabase.channel(`chatify-typing-${this.conversationId}`).on("broadcast",{event:"typing"},e=>{e?.payload?.sender!=="visitor"&&(this.agentTyping=!0,this.agentTypingTimer&&clearTimeout(this.agentTypingTimer),this.agentTypingTimer=setTimeout(()=>{this.agentTyping=!1,this.renderMessages()},4e3),this.renderMessages())}).subscribe())}startNewConversation(){let e=this.config.workspaceId?`_${this.config.workspaceId.slice(0,8)}`:"";if(this.realtimeChannel){try{this.supabase.removeChannel(this.realtimeChannel)}catch{}this.realtimeChannel=null}this.conversationId=null,this.conversationStatus="open",this.forceNewConversation=!0,this.csatRated=!1,this.messages=[],this.unreadCount=0,this.botTyping=!1,this.agentTyping=!1;try{localStorage.removeItem(`chatify_conversation_id${e}`),localStorage.removeItem(`zentry_conversation_id${e}`),sessionStorage.removeItem(`chatify_conversation_id${e}`),sessionStorage.removeItem(`zentry_conversation_id${e}`)}catch{}this.subscribeToTyping(),this.updateUnreadBadge(),this.renderMessages(),this.loadPreviousConversations(),setTimeout(()=>{this.shadow?.getElementById("chatifyTextarea")?.focus({preventScroll:!0})},100)}async loadPreviousConversations(){if(this.visitorId){try{let e=this.legacyData?(await this.supabase.rpc("fn_get_visitor_conversations",{p_visitor_id:this.visitorId,p_workspace_id:this.config.workspaceId||null})).data:await this.widgetRpc("fn_widget_conversations");this.previousConversations=Array.isArray(e)?e:[]}catch{}this.renderPreviousConversations()}}renderPreviousConversations(){let e=this.shadow?.getElementById("cardPrevConvs"),t=this.shadow?.getElementById("prevConvsList");if(!e||!t)return;let r=this.previousConversations.filter(n=>n.id!==this.conversationId&&n.last_message).slice(0,5);if(r.length===0){e.style.display="none";return}e.style.display="block",t.innerHTML=r.map(n=>{let a=(n.last_message?.content||"").replace(/^#{1,6}\s+/gm,"").replace(/\*\*|__|`/g,"").replace(/\s+/g," ").trim()||(n.last_message?.attachment_url?"Sent a picture":"Conversation"),o=this.formatRelativeTime(new Date(n.updated_at||n.created_at)),c=n.status==="closed";return`<button type="button" class="chatify-prev-item" data-id="${this.escapeHTML(n.id)}"><span class="chatify-prev-text"><span class="chatify-prev-snippet">${this.escapeHTML(a.length>70?a.slice(0,70)+"\u2026":a)}</span><span class="chatify-prev-meta">${this.escapeHTML(o)} \xB7 ${c?"Closed":"Open"}</span></span><span class="chatify-prev-chevron">\u203A</span></button>`}).join(""),t.querySelectorAll(".chatify-prev-item").forEach(n=>{n.addEventListener("click",()=>{this.openPreviousConversation(n.getAttribute("data-id")||"")})})}async openPreviousConversation(e){if(!e)return;let t=this.previousConversations.find(n=>n.id===e),r=this.config.workspaceId?`_${this.config.workspaceId.slice(0,8)}`:"";this.conversationId=e,this.conversationStatus=t?.status||"open",this.csatRated=!!t?.csat_rating,this.messages=[],this.botTyping=!1,this.agentTyping=!1;try{localStorage.setItem(`zentry_conversation_id${r}`,e),localStorage.setItem(`chatify_conversation_id${r}`,e)}catch{}this.subscribeToRealtime(),this.switchTab("messages"),await this.loadMessageHistory(),this.renderPreviousConversations()}async submitCSAT(e,t){if(!this.conversationId)return;this.csatRated=!0;let r=typeof e=="number"?e>=4?"good":"bad":e,n=r==="good"?5:1;try{let s=await fetch(`${this.config.apiUrl||""}/api/csat/rate`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({conversation_id:this.conversationId,visitor_id:this.visitorId,visitor_token:this.visitorToken,rating:r,comment:t?t.trim():void 0})});if(!s.ok)throw new Error(`CSAT ${s.status}`)}catch{if(this.legacyData)try{await this.supabase.from("conversations").update({csat_rating:n,csat_feedback:t?t.trim():null}).eq("id",this.conversationId)}catch{}}this.renderMessages()}renderLauncherIconHTML(){let e=this.config.widgetIcon==="custom_logo"||!this.config.widgetIcon&&this.config.showLauncherLogo!==!1&&!!this.config.logoUrl,t=this.safeUrl(this.config.logoUrl,!0);if(e&&t){let r=this.safeUrl(Li||un,!0);return`<img src="${t}" alt="Chat" class="chatify-launcher-icon chatify-custom-logo" onerror="this.src='${r}';this.classList.remove('chatify-custom-logo');" />`}return`<span class="chatify-launcher-icon chatify-preset-icon">${vn(this.config.widgetIcon).svg}</span>`}darkModeCSS(){let e=`
          --w-surface: #101013;
          --w-surface-2: #17171b;
          --w-surface-3: #202026;
          --w-canvas: #0b0b0e;
          --w-ink: #f5f5f3;
          --w-ink-2: #b4b4bc;
          --w-ink-3: #8b8b95;
          --w-line: #232329;
          --w-line-2: #2f2f37;
          --w-success: #34d9a7;
          --w-success-soft: #0c1f1a;
          --w-success-line: #1d453a;
          --w-warn: #e5a742;
          --w-warn-soft: #221a0c;
          --w-warn-line: #4a3717;
          --w-danger: #ff6b86;
          --w-danger-soft: #240f16;
          --w-danger-line: #4d222e;
          --w-glass: rgba(16, 16, 19, 0.84);
          --w-glass-line: rgba(255, 255, 255, 0.08);
          --w-focus: #7a99ff;
          --w-shadow-sm: 0 1px 3px rgba(0,0,0,.5);
          --w-shadow-md: 0 6px 18px rgba(0,0,0,.55);
          --w-shadow-xl: 0 32px 68px rgba(0,0,0,.7), 0 12px 26px rgba(0,0,0,.5);
          color-scheme: dark;`,t=this.config.colorMode||"auto";return t==="light"?"":t==="dark"?`:host { ${e} }`:`@media (prefers-color-scheme: dark) { :host { ${e} } }`}designCSS(){let e=this.config.widgetDesign||"classic";return e==="minimal"?`
      .chatify-home-hero { background: var(--w-surface); color: var(--w-ink); padding-bottom: 18px; border-bottom: 1px solid var(--w-line); }
      .chatify-home-hero::before, .chatify-home-hero::after { display: none; }
      .chatify-home-title { color: var(--w-ink); text-shadow: none; font-size: 24px; }
      .chatify-home-sub { color: var(--w-ink-2); }
      .chatify-home-avatar { background: var(--w-surface-2); border: 1px solid var(--w-line); box-shadow: none; backdrop-filter: none; -webkit-backdrop-filter: none; color: var(--w-ink); }
      .chatify-icon-btn { background: transparent; border-color: var(--w-line); color: var(--w-ink-3); backdrop-filter: none; -webkit-backdrop-filter: none; }
      .chatify-icon-btn:hover { background: var(--w-surface-3); color: var(--w-ink); transform: none; }
      .chatify-home-content { margin-top: 0; border-radius: 0; }
      .chatify-card { border: 1px solid var(--w-line); border-radius: 12px; box-shadow: none; }
      .chatify-card-action:hover { transform: none; box-shadow: none; border-color: var(--w-line-2); }
      .chatify-primary-cta { border-radius: 10px; box-shadow: none; }
      .chatify-primary-cta:hover { transform: none; box-shadow: none; filter: brightness(1.06); }
      .chatify-window { border-radius: 16px; }
      .chatify-launcher { box-shadow: 0 6px 16px rgba(11,11,15,.16); }
      `:e==="solid"?`
      .chatify-home-hero { background: var(--w-brand); color: var(--w-on-brand); }
      .chatify-home-hero::before, .chatify-home-hero::after { display: none; }
      .chatify-home-title, .chatify-home-sub { color: var(--w-on-brand); text-shadow: none; }
      .chatify-home-avatar { border-radius: 14px; box-shadow: none; }
      .chatify-card { border-radius: 16px; box-shadow: 0 2px 10px rgba(11,11,15,.06); }
      .chatify-primary-cta { border-radius: 999px; box-shadow: none; }
      .chatify-header { background: var(--w-brand); border-bottom-color: transparent; }
      .chatify-header-text h3, .chatify-header-text p { color: var(--w-on-brand); }
      .chatify-header .chatify-back-btn, .chatify-header .chatify-close-btn { color: var(--w-on-brand); }
      .chatify-header .chatify-back-btn:hover, .chatify-header .chatify-close-btn:hover { background: rgba(255,255,255,.16); color: var(--w-on-brand); }
      .chatify-header .chatify-avatar { background: rgba(255,255,255,.18); color: var(--w-on-brand); }
      .chatify-launcher, .chatify-launcher::after, .chatify-launcher.is-loading, .chatify-launcher.is-loading::before { border-radius: 18px; }
      `:e==="midnight"?`
      .chatify-home-hero { background: radial-gradient(120% 90% at 85% 0%, var(--w-brand-a28), transparent 60%), #0d0d12; color: #ffffff; }
      .chatify-home-hero::before { display: none; }
      .chatify-home-avatar { background: rgba(255,255,255,.08); border-color: rgba(255,255,255,.14); }
      .chatify-icon-btn { background: rgba(255,255,255,.06); border-color: rgba(255,255,255,.14); }
      .chatify-card { border-radius: 14px; }
      .chatify-primary-cta { border-radius: 10px; }
      .chatify-launcher { background: #0d0d12; color: #ffffff; box-shadow: 0 0 0 2px var(--w-brand), 0 10px 26px rgba(11,11,15,.32); }
      .chatify-launcher:hover { box-shadow: 0 0 0 2px var(--w-brand), 0 16px 34px rgba(11,11,15,.4); }
      `:e==="compact"?`
      .chatify-window { border-radius: 10px; width: 376px; }
      #navHome, .chatify-back-btn, .chatify-bottom-nav { display: none !important; }
      .chatify-header { background: var(--w-brand); border-bottom: none; padding: 14px 16px; }
      .chatify-header-text h3 { color: var(--w-on-brand); font-size: 15px; }
      .chatify-header-text p { color: var(--w-on-brand); opacity: .85; }
      .chatify-header .chatify-close-btn { color: var(--w-on-brand); }
      .chatify-header .chatify-close-btn:hover { background: rgba(255,255,255,.16); color: var(--w-on-brand); }
      .chatify-header .chatify-avatar { background: rgba(255,255,255,.2); color: var(--w-on-brand); }
      .chatify-msg-visitor { background: var(--w-brand); border-radius: 8px; box-shadow: none; }
      .chatify-msg-agent { background: var(--w-surface-3); border: none; border-radius: 8px; box-shadow: none; }
      .chatify-send-btn { border-radius: 6px; }
      .chatify-launcher {
        width: auto; min-width: 56px; height: 50px; padding: 0 20px 0 16px; gap: 8px;
        border-radius: 999px; box-shadow: 0 6px 18px rgba(11,11,15,.18);
      }
      .chatify-launcher::after { border-radius: 999px; }
      .chatify-launcher .chatify-launcher-label { display: inline; font-size: 15px; font-weight: 600; letter-spacing: -.01em; }
      .chatify-launcher.widget-is-open { width: 50px; min-width: 50px; padding: 0; }
      .chatify-launcher.widget-is-open .chatify-launcher-label { display: none; }
      .chatify-launcher-icon.chatify-preset-icon, .chatify-preset-icon svg { width: 22px; height: 22px; }
      `:e==="livechat"?`
      .chatify-window { border-radius: 16px; }
      #navHome, .chatify-back-btn { display: none !important; }
      .chatify-header { background: var(--w-brand); border-bottom: none; padding: 18px 16px 20px; align-items: flex-start; }
      .chatify-header-info { flex-wrap: wrap; row-gap: 10px; }
      .chatify-header .chatify-avatar { display: none; }
      .chatify-header-text { order: 1; flex: 1 0 100%; }
      .chatify-header-text h3 { color: var(--w-on-brand); font-size: 17px; font-weight: 700; }
      .chatify-header-text p { color: var(--w-on-brand); opacity: .9; white-space: normal; }
      .chatify-header .chatify-header-avatars { display: flex; order: 0; }
      .chatify-header-avatars .chatify-mini-avatar { width: 34px; height: 34px; border-color: var(--w-brand); }
      .chatify-header .chatify-close-btn { color: var(--w-on-brand); }
      .chatify-header .chatify-close-btn:hover { background: rgba(255,255,255,.18); color: var(--w-on-brand); }
      .chatify-msg-visitor { background: var(--w-brand); border-radius: 20px 20px 4px 20px; box-shadow: none; }
      .chatify-msg-agent { border-radius: 20px 20px 20px 4px; background: var(--w-surface-2); border: none; box-shadow: none; }
      .chatify-send-btn { border-radius: 50%; }
      .chatify-launcher-status {
        display: block; position: absolute; right: 2px; bottom: 2px; width: 14px; height: 14px;
        border-radius: 50%; background: #a1a1aa; border: 2.5px solid #ffffff;
      }
      .chatify-launcher-status.is-online { background: var(--w-success); }
      .chatify-launcher.widget-is-open .chatify-launcher-status { display: none; }
      `:e==="modern"?`
      .chatify-window { border-radius: 24px; }
      .chatify-home-hero { background: linear-gradient(135deg, var(--w-brand) 0%, var(--w-brand-2) 100%); padding-bottom: 64px; }
      .chatify-home-hero::after { display: none; }
      .chatify-home-title { font-size: 29px; }
      .chatify-home-avatar { width: 46px; height: 46px; border-radius: 50%; padding: 0; overflow: hidden; }
      .chatify-home-content { margin-top: -40px; border-radius: 24px 24px 0 0; }
      .chatify-card { border-radius: 22px; border: none; box-shadow: 0 10px 30px -8px rgba(15,23,42,.18); }
      .chatify-primary-cta { border-radius: 999px; background: linear-gradient(135deg, var(--w-brand), var(--w-brand-2)); box-shadow: 0 8px 20px var(--w-brand-a28); }
      .chatify-header { background: linear-gradient(135deg, var(--w-brand) 0%, var(--w-brand-2) 100%); border-bottom: none; }
      .chatify-header-text h3, .chatify-header-text p { color: var(--w-on-brand); }
      .chatify-header .chatify-back-btn, .chatify-header .chatify-close-btn { color: var(--w-on-brand); }
      .chatify-header .chatify-back-btn:hover, .chatify-header .chatify-close-btn:hover { background: rgba(255,255,255,.18); color: var(--w-on-brand); }
      .chatify-header .chatify-avatar { background: rgba(255,255,255,.22); color: var(--w-on-brand); }
      .chatify-msg-visitor { background: linear-gradient(135deg, var(--w-brand), var(--w-brand-2)); border-radius: 22px 22px 6px 22px; }
      .chatify-msg-agent { border-radius: 22px 22px 22px 6px; border: none; background: var(--w-surface-2); box-shadow: none; }
      .chatify-send-btn { border-radius: 50%; background: linear-gradient(135deg, var(--w-brand), var(--w-brand-2)); }
      .chatify-launcher { border-radius: 20px; background: linear-gradient(135deg, var(--w-brand), var(--w-brand-2)); }
      .chatify-launcher::after, .chatify-launcher.is-loading, .chatify-launcher.is-loading::before { border-radius: 20px; }
      `:""}initDOM(){this.container=document.createElement("div"),this.container.id="zentry-widget-root",this.container.className="zentry-widget-root chatify-widget-root",this.container.setAttribute("data-zentry-root","true"),document.body.appendChild(this.container),this.shadow=this.container.attachShadow({mode:"open"});let e=window.visualViewport;if(e&&this.container){let g=this.container,v=()=>{g.style.setProperty("--w-vvh",`${Math.round(e.height)}px`),g.style.setProperty("--w-vv-top",`${Math.round(e.offsetTop)}px`)};v(),e.addEventListener("resize",v),e.addEventListener("scroll",v)}["keydown","keyup","keypress"].forEach(g=>{this.shadow?.addEventListener(g,v=>{v.stopPropagation()}),this.container?.addEventListener(g,v=>{v.stopPropagation()})}),this.shadow.addEventListener("keydown",g=>{let v=g;if(v.key==="Escape"){let w=this.shadow?.getElementById("chatifyEmojiPicker");if(!!(w&&w.style.display!=="none"&&w.style.display!=="")){v.preventDefault(),this.closeEmojiPicker(),this.shadow?.getElementById("chatifyTextarea")?.focus();return}let L=this.shadow?.getElementById("chatifyImageLightbox");if(!!(L&&L.style.display==="flex")){v.preventDefault(),this.closeLightbox();return}this.isOpen&&(v.preventDefault(),this.close())}});let t=document.createElement("style");t.id="chatify-theme-style",t.textContent=this.generateCSS(),this.shadow.appendChild(t);let r=document.createElement("button");r.className=this.config.workspaceId?"chatify-launcher is-loading":"chatify-launcher",r.id="zentryLauncherBtn",r.setAttribute("data-chatify-launcher","1"),r.setAttribute("aria-label","Open chat"),r.innerHTML=`
      <div class="chatify-badge" id="chatifyBadge">0</div>
      <span id="chatifyIconOpen" style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;">
        ${this.renderLauncherIconHTML()}
      </span>
      <svg id="chatifyIconClose" style="display:none;" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
      <span class="chatify-launcher-label" aria-hidden="true">Chat</span>
      <span class="chatify-launcher-status" id="chatifyLauncherStatus" aria-hidden="true"></span>
    `,r.onclick=()=>this.toggleWindow(),this.shadow.appendChild(r);let n=document.createElement("div");n.className="chatify-message-popup",n.id="chatifyMessagePopup",n.style.display="none",n.innerHTML=`
      <div class="chatify-popup-card" id="chatifyPopupCard" title="Click to view conversation">
        <div class="chatify-popup-avatar-wrap">
          <div class="chatify-popup-avatar" id="chatifyPopupAvatar">TD</div>
          <span class="chatify-popup-status-dot"></span>
        </div>
        <div class="chatify-popup-content">
          <div class="chatify-popup-header">
            <span class="chatify-popup-title" id="chatifyPopupTitle">Trader Care Desk</span>
            <button type="button" class="chatify-popup-close" id="chatifyPopupCloseBtn" title="Dismiss" aria-label="Close message preview">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <p class="chatify-popup-message" id="chatifyPopupMessageText">Hi, how can we help?</p>
        </div>
      </div>
      <div class="chatify-popup-reply-bar" id="chatifyPopupReplyBar">
        <input type="text" class="chatify-popup-input" id="chatifyPopupInput" placeholder="Write your message..." autocomplete="off" />
        <button type="button" class="chatify-popup-send" id="chatifyPopupSendBtn" title="Send message" aria-label="Send message">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </div>
    `,this.shadow.appendChild(n);let s=document.createElement("div");s.className="chatify-window",s.id="chatifyWindow",s.innerHTML=`
      <!-- TAB 1: HOME TAB -->
      <div class="chatify-tab-pane" id="tabHome" style="display: flex;">
        <div class="chatify-home-hero">
          <div class="chatify-brand-row">
            <div class="chatify-home-avatar" id="homeBrandAvatar">
              ${this.renderBrandAvatarHTML(!1)}
            </div>
            <button class="chatify-icon-btn" id="homeCloseBtn" title="Close Messenger">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <h2 class="chatify-home-title" id="homeGreetingTitle">Hello there \u{1F44B}</h2>
          <p class="chatify-home-sub" id="homeGreetingSub">How can our support team help you today?</p>
        </div>

        <div class="chatify-home-content">
          <!-- Active Open Conversation Card (shown when opened conversation exists) -->
          <div class="chatify-card chatify-card-action chatify-open-conv-card" id="cardOpenConv" style="display: none;">
            <div class="chatify-card-head">
              <span class="chatify-status-pill chatify-conv-status-pill" id="openConvStatusPill">
                <span class="chatify-pulse-dot online"></span>
                <span>Active conversation</span>
              </span>
              <span class="chatify-conv-time" id="openConvTime">Just now</span>
            </div>
            <div class="chatify-open-conv-preview">
              <div class="chatify-open-conv-avatar-col">
                <div class="chatify-mini-avatar" id="openConvAvatar" style="background:var(--w-brand); width:34px; height:34px; font-size:13px; margin-left:0; color:var(--w-on-brand); font-weight:700; display:flex; align-items:center; justify-content:center; border-radius:50%; overflow:hidden;">
                  ${this.renderBrandAvatarHTML(!1)}
                </div>
              </div>
              <div class="chatify-open-conv-text-col">
                <div class="chatify-open-conv-sender-row">
                  <span class="chatify-open-conv-sender" id="openConvSender">Support Team</span>
                  <span class="chatify-home-unread-pill" id="openConvUnreadPill" style="display:none;">1 new</span>
                </div>
                <p class="chatify-open-conv-snippet" id="openConvSnippet">Click to view messages...</p>
              </div>
            </div>
            <button class="chatify-primary-cta" id="btnContinueConversation">
              <span id="btnContinueConvText">Continue conversation</span>
              <span class="chatify-cta-badge" id="openConvCtaBadge" style="display:none;">1</span>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </button>
            <button type="button" class="chatify-new-conv-link" id="btnStartNewChat">
              <span>+ Send a new message</span>
            </button>
          </div>

          <!-- Start Chat Card (shown when no conversation exists yet) -->
          <div class="chatify-card chatify-card-action" id="cardStartChat">
            <div class="chatify-card-head">
              <div class="chatify-avatars-stack" id="homeAvatarsStack"></div>
              <span class="chatify-status-pill" id="homeStatusPill">
                <span class="chatify-pulse-dot away"></span>
                <span>We're away, leave a message and we'll reply by email</span>
              </span>
              <span class="chatify-home-unread-pill" id="homeCardUnreadPill" style="display:none;">1 new message</span>
            </div>
            <h4 class="chatify-card-title" id="homeCardTitle">Chat with us</h4>
            <p class="chatify-card-sub" id="homeCardSub">Ask us anything, or share your feedback.</p>
            <button class="chatify-primary-cta" id="btnGoToMessages">
              <span id="btnGoToMessagesText">Chat with us</span>
              <span class="chatify-cta-badge" id="homeCardCtaBadge" style="display:none;">1</span>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </button>
          </div>

          <!-- Previous conversations (shown only when the visitor has others) -->
          <div class="chatify-card chatify-card-prev" id="cardPrevConvs" style="display: none;">
            <div class="chatify-section-title">Previous conversations</div>
            <div class="chatify-prev-list" id="prevConvsList"></div>
          </div>

          <!-- Help Center Quick Search (shown only when workspace has published articles) -->
          <div class="chatify-card chatify-card-help" id="cardHelpSearch" style="display: none;">
            <div class="chatify-section-title" id="homeHelpSectionTitle">Knowledge Base</div>
            <p class="chatify-card-sub" style="margin-bottom:12px;">Search self-service answers and guides:</p>
            <div class="chatify-search-trigger" id="homeSearchTrigger">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <span>Search for help articles...</span>
              <span class="chatify-search-kbd">Search</span>
            </div>
          </div>
        </div>
      </div>

      <!-- TAB 2: MESSAGES TAB (Active Chat Thread) -->
      <div class="chatify-tab-pane" id="tabMessages" style="display: none;">
        <div class="chatify-header">
          <div class="chatify-header-info">
            <button class="chatify-back-btn" id="btnBackToHome" title="Back to Home">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
              </svg>
            </button>
            <div class="chatify-avatar" id="chatifyHeaderAvatar">
              ${this.renderBrandAvatarHTML(!0)}
            </div>
            <div class="chatify-header-text">
              <h3 id="chatifyHeaderTitle">${this.escapeHTML(this.config.title)}</h3>
              <p id="chatifyHeaderSubtitle">${this.escapeHTML(this.config.subtitle)}</p>
            </div>
            <div class="chatify-header-avatars chatify-avatars-stack" id="chatHeaderAvatars" aria-hidden="true"></div>
          </div>
          <div style="display:flex; align-items:center; gap:4px;">
            <button class="chatify-close-btn" id="chatifyNewChatBtn" title="New conversation" style="padding:5px;">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 20h9"></path>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
              </svg>
            </button>
            <button class="chatify-close-btn" id="chatifyCloseBtn" title="Close">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>

        <div class="chatify-body" id="chatifyBody">
          ${this.isPreChatCompleted?"":`
            <div class="chatify-prechat" id="chatifyPreChat">
              <h4>\u{1F44B} Welcome to Live Support</h4>
              <p>Please introduce yourself so our support team can best assist you.</p>
              <div class="chatify-form-group">
                <label>Your Name <span class="chatify-optional-tag">(Optional)</span></label>
                <input type="text" id="chatifyInputName" class="chatify-input" placeholder="e.g. Sarah Connor" />
              </div>
              <div class="chatify-form-group">
                <label>Email Address <span class="chatify-required-tag" style="color:#ef4444; font-weight:700;">*</span></label>
                <input type="email" id="chatifyInputEmail" class="chatify-input" placeholder="sarah@example.com" autocomplete="email" inputmode="email" required aria-required="true" aria-describedby="chatifyEmailError" />
                <div id="chatifyEmailError" class="chatify-field-error" role="alert" aria-live="polite" style="display:none;"></div>
              </div>
              <button class="chatify-start-btn" id="chatifyStartBtn">Start Live Conversation</button>
            </div>
          `}
        </div>

        <!-- Connection banner: shown only while the browser reports it is offline -->
        <div id="chatifyNetBanner" class="chatify-net-banner" role="status" aria-live="polite" hidden>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h.01"/><path d="M8.5 16.43a5 5 0 0 1 7 0"/><path d="M2 8.82a15 15 0 0 1 4.17-2.65"/><path d="M10.66 5c4.01-.36 8.14.9 11.34 3.76"/><path d="M16.85 11.25a10 10 0 0 1 2.22 1.68"/><path d="M5 13a10 10 0 0 1 5.24-2.76"/><path d="m2 2 20 20"/></svg>
          <span id="chatifyNetBannerText">You're offline. Messages will send when you reconnect.</span>
        </div>

        <!-- Attachment card: ready, sending or failed (data-state) -->
        <div id="chatifyAttachmentPreview" class="chatify-attachment-preview" data-state="ready" style="display:none;">
          <img id="chatifyPreviewImg" class="chatify-preview-thumb" src="" alt="" />
          <div class="chatify-preview-info">
            <span id="chatifyPreviewName" class="chatify-preview-name">image.png</span>
            <span id="chatifyPreviewSize" class="chatify-preview-size" aria-live="polite">0 KB</span>
            <span class="chatify-preview-bar" aria-hidden="true"><span></span></span>
          </div>
          <button type="button" id="chatifyPreviewRetry" class="chatify-preview-retry">Retry</button>
          <button type="button" id="chatifyPreviewRemove" class="chatify-preview-remove" title="Remove picture" aria-label="Remove picture">\u2715</button>
        </div>

        <!-- Emoji Picker Popover (WhatsApp Style) -->
        <div id="chatifyEmojiPicker" class="chatify-emoji-popover" style="display:none;">
          <div class="chatify-emoji-header">
            <input type="text" id="chatifyEmojiSearch" class="chatify-emoji-search" placeholder="Search emojis..." />
          </div>
          <div class="chatify-emoji-categories" id="chatifyEmojiCategories"></div>
          <div class="chatify-emoji-grid" id="chatifyEmojiGrid"></div>
        </div>

        <!-- Hidden input for picture upload -->
        <input type="file" id="chatifyImageInput" accept="image/*,.heic,.heif" style="display:none;" />

        <div class="chatify-footer" id="chatifyFooter" style="${this.isPreChatCompleted?"display:flex;":"display:none;"}">
          <div class="chatify-footer-actions">
            <button type="button" id="chatifyImageBtn" class="chatify-action-btn" title="Send picture">
              <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21 15 16 10 5 21"></polyline>
              </svg>
            </button>
            <button type="button" id="chatifyEmojiBtn" class="chatify-action-btn" title="Insert emoji">
              <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
                <line x1="9" y1="9" x2="9.01" y2="9"></line>
                <line x1="15" y1="9" x2="15.01" y2="9"></line>
              </svg>
            </button>
          </div>
          <textarea id="chatifyTextarea" class="chatify-textarea" rows="1" placeholder="Type a message..."></textarea>
          <button id="chatifySendBtn" class="chatify-send-btn" title="Send message">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </div>
      </div>

      <!-- TAB 3: HELP TAB (Knowledge Base) -->
      <div class="chatify-tab-pane" id="tabHelp" style="display: none;">
        <div class="chatify-header">
          <div class="chatify-header-text">
            <h3>Knowledge Base</h3>
            <p>Self-service guides &amp; FAQs</p>
          </div>
          <button class="chatify-close-btn" id="helpCloseBtn" title="Close">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div class="chatify-help-body">
          <div class="chatify-help-search-bar">
            <input type="text" id="helpSearchInput" placeholder="Search answers..." />
          </div>

          <div class="zentry-faq-list chatify-faq-list" id="faqList"></div>
        </div>
      </div>

      <!-- Bottom Intercom Navigation Bar -->
      <nav class="chatify-bottom-nav">
        <button class="chatify-nav-item active" data-tab="home" id="navHome">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
          <span>Home</span>
        </button>
        <button class="chatify-nav-item" data-tab="messages" id="navMessages">
          <div class="nav-msg-icon-wrap">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            <span class="chatify-nav-badge" id="navMsgBadge" style="display:none;">1</span>
          </div>
          <span class="chatify-nav-label-wrap">
            <span id="navMessagesText">Chat</span>
          </span>
        </button>
        <button class="chatify-nav-item" data-tab="help" id="navHelp" style="display:none;">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
          <span>Help</span>
        </button>
      </nav>

      <!-- Image Lightbox Modal -->
      <div id="chatifyImageLightbox" class="chatify-lightbox" style="display:none;">
        <button type="button" id="chatifyLightboxClose" class="chatify-lightbox-close" title="Close">\u2715</button>
        <img id="chatifyLightboxImg" class="chatify-lightbox-img" src="" alt="Enlarged" />
        <a id="chatifyLightboxLink" class="chatify-lightbox-link" href="#" target="_blank" rel="noopener noreferrer">Open original in new tab</a>
      </div>
    `,this.shadow.appendChild(s),this.shadow.getElementById("homeCloseBtn")?.addEventListener("click",()=>this.toggleWindow()),this.shadow.getElementById("chatifyCloseBtn")?.addEventListener("click",()=>this.toggleWindow()),this.shadow.getElementById("chatifyNewChatBtn")?.addEventListener("click",()=>this.startNewConversation()),this.shadow.getElementById("helpCloseBtn")?.addEventListener("click",()=>this.toggleWindow()),this.shadow.querySelectorAll(".chatify-nav-item").forEach(g=>{g.addEventListener("click",v=>{let w=v.currentTarget.getAttribute("data-tab");this.switchTab(w)})}),this.shadow.getElementById("btnGoToMessages")?.addEventListener("click",()=>{this.switchTab("messages")}),this.shadow.getElementById("cardStartChat")?.addEventListener("click",g=>{g.target?.closest("#btnGoToMessages")||this.switchTab("messages")}),this.shadow.getElementById("btnContinueConversation")?.addEventListener("click",()=>{this.switchTab("messages")}),this.shadow.getElementById("cardOpenConv")?.addEventListener("click",g=>{g.target?.closest("#btnContinueConversation, #btnStartNewChat")||this.switchTab("messages")}),this.shadow.getElementById("btnStartNewChat")?.addEventListener("click",g=>{g.stopPropagation(),this.switchTab("messages"),setTimeout(()=>{this.shadow?.getElementById("chatifyTextarea")?.focus({preventScroll:!0})},120)}),this.shadow.getElementById("btnBackToHome")?.addEventListener("click",()=>{this.switchTab("home")}),this.shadow.getElementById("chatifyPopupCloseBtn")?.addEventListener("click",g=>{g.stopPropagation(),this.dismissMessagePopup()}),this.shadow.getElementById("chatifyPopupCard")?.addEventListener("click",g=>{g.target?.closest("#chatifyPopupCloseBtn")||(this.hideMessagePopup(!1),this.open("messages"))});let a=this.shadow.getElementById("chatifyPopupInput"),o=this.shadow.getElementById("chatifyPopupSendBtn");a?.addEventListener("input",()=>{o?.classList.toggle("active",!!a.value.trim())}),a?.addEventListener("keydown",async g=>{g.key==="Enter"&&(g.preventDefault(),await this.sendPopupReply())}),o?.addEventListener("click",async g=>{g.stopPropagation(),await this.sendPopupReply()}),this.shadow.getElementById("homeSearchTrigger")?.addEventListener("click",()=>{this.switchTab("help"),setTimeout(()=>{this.shadow?.getElementById("helpSearchInput")?.focus({preventScroll:!0})},100)}),this.bindFaqListeners(),this.shadow.getElementById("helpSearchInput")?.addEventListener("input",g=>{this.faqSearchQuery=g.target.value,this.renderFaqList()}),this.bindPrechatHandlers();let l=this.shadow.getElementById("chatifySendBtn"),h=this.shadow.getElementById("chatifyTextarea"),d=this.shadow.getElementById("chatifyImageBtn"),f=this.shadow.getElementById("chatifyImageInput"),u=this.shadow.getElementById("chatifyEmojiBtn"),p=this.shadow.getElementById("chatifyPreviewRemove");this.shadow.getElementById("chatifyPreviewRetry")?.addEventListener("click",()=>this.handleSendMessage());let m=this.shadow.getElementById("chatifyLightboxClose"),y=this.shadow.getElementById("chatifyImageLightbox");d?.addEventListener("click",()=>{f?.click()}),f?.addEventListener("change",g=>{let v=g.target.files?.[0];v&&this.handleSelectImage(v)}),p?.addEventListener("click",()=>{this.clearPendingAttachment()}),u?.addEventListener("click",g=>{g.stopPropagation(),this.toggleEmojiPicker()}),this.renderEmojiGrid(),this.shadow.addEventListener("click",g=>{let v=g.target;!v.closest("#chatifyEmojiPicker")&&!v.closest("#chatifyEmojiBtn")&&this.closeEmojiPicker()}),h?.addEventListener("paste",g=>{let v=g.clipboardData?.items;if(v){for(let w=0;w<v.length;w++)if(v[w].type.startsWith("image/")){let T=v[w].getAsFile();if(T){g.preventDefault(),this.handleSelectImage(T);break}}}}),m?.addEventListener("click",()=>this.closeLightbox()),y?.addEventListener("click",g=>{g.target.id==="chatifyImageLightbox"&&this.closeLightbox()}),l?.addEventListener("click",()=>this.handleSendMessage()),h?.addEventListener("input",()=>{this.adjustTextareaHeight()}),h?.addEventListener("keydown",g=>{g.key==="Enter"&&!g.shiftKey?(g.preventDefault(),this.handleSendMessage()):g.key==="Enter"&&g.shiftKey&&setTimeout(()=>this.adjustTextareaHeight(),0)}),this.renderAvatarsStack(this.workspaceAgents),this.updatePresenceAndTexts(),this.presenceInterval||(this.presenceInterval=setInterval(()=>{this.updatePresenceAndTexts()},6e4))}handleSelectImage(e){if(e.size>40*1024*1024){this.showAttachmentProblem(e.name,"This picture is too large. Choose one under 40 MB.");return}if(!Oi(e)){this.showAttachmentProblem(e.name,"Choose a picture (JPEG, PNG, HEIC, WEBP or GIF).");return}this.pendingAttachment?.previewUrl&&URL.revokeObjectURL(this.pendingAttachment.previewUrl);let t=URL.createObjectURL(e);this.pendingAttachment={file:e,previewUrl:t};let r=this.shadow?.getElementById("chatifyAttachmentPreview"),n=this.shadow?.getElementById("chatifyPreviewImg"),s=this.shadow?.getElementById("chatifyPreviewName"),a=this.shadow?.getElementById("chatifyPreviewSize");r&&n&&(n.src=t,s&&(s.textContent=e.name),a&&(a.textContent=`${(e.size/1024).toFixed(0)} KB \xB7 Ready to send`),n.style.display="",r.dataset.state="ready",r.style.display="flex")}setAttachmentState(e,t){let r=this.shadow?.getElementById("chatifyAttachmentPreview"),n=this.shadow?.getElementById("chatifyPreviewSize");r&&(r.dataset.state=e,n&&t&&(n.textContent=t))}showAttachmentProblem(e,t){this.clearPendingAttachment();let r=this.shadow?.getElementById("chatifyAttachmentPreview"),n=this.shadow?.getElementById("chatifyPreviewImg"),s=this.shadow?.getElementById("chatifyPreviewName");r&&(n&&(n.style.display="none"),s&&(s.textContent=e),r.style.display="flex",this.setAttachmentState("failed",t),r.dataset.retry="no")}updateNetworkBanner(e){let t=this.shadow?.getElementById("chatifyNetBanner"),r=this.shadow?.getElementById("chatifyNetBannerText");if(!(!t||!r)){if(this.netBannerTimer&&clearTimeout(this.netBannerTimer),!e){t.dataset.tone="warn",r.textContent="You're offline. Messages will send when you reconnect.",t.hidden=!1;return}t.hidden||(t.dataset.tone="ok",r.textContent="Back online.",this.netBannerTimer=setTimeout(()=>{t.hidden=!0},2500))}}clearPendingAttachment(){this.pendingAttachment?.previewUrl&&URL.revokeObjectURL(this.pendingAttachment.previewUrl),this.pendingAttachment=null;let e=this.shadow?.getElementById("chatifyAttachmentPreview");e&&(e.style.display="none",e.dataset.state="ready",delete e.dataset.retry);let t=this.shadow?.getElementById("chatifyImageInput");t&&(t.value="")}toggleEmojiPicker(){let e=this.shadow?.getElementById("chatifyEmojiPicker");if(!e)return;let t=e.style.display==="block";e.style.display=t?"none":"block"}closeEmojiPicker(){let e=this.shadow?.getElementById("chatifyEmojiPicker");e&&(e.style.display="none")}renderEmojiGrid(){let e=this.shadow?.getElementById("chatifyEmojiGrid"),t=this.shadow?.getElementById("chatifyEmojiCategories");if(!e)return;t&&t.children.length===0&&(t.innerHTML="",_t.forEach(s=>{let a=document.createElement("button");a.type="button",a.className=`chatify-emoji-cat-btn ${s.id===this.activeEmojiCategory?"active":""}`,a.textContent=s.icon,a.title=s.name,a.addEventListener("click",o=>{o.stopPropagation(),this.activeEmojiCategory=s.id,this.shadow?.querySelectorAll(".chatify-emoji-cat-btn").forEach(l=>l.classList.remove("active")),a.classList.add("active");let c=this.shadow?.getElementById("chatifyEmojiSearch");c&&(c.value=""),this.emojiSearchQuery="",this.renderEmojiGrid()}),t.appendChild(a)}),this.shadow?.getElementById("chatifyEmojiSearch")?.addEventListener("input",s=>{this.emojiSearchQuery=s.target.value.toLowerCase().trim(),this.renderEmojiGrid()})),e.innerHTML="";let r=[];if(this.emojiSearchQuery)r=fn;else{let n=_t.find(s=>s.id===this.activeEmojiCategory);r=n?n.emojis:_t[0].emojis}r.forEach(n=>{let s=document.createElement("button");s.type="button",s.className="chatify-emoji-btn",s.textContent=n,s.addEventListener("click",a=>{a.stopPropagation(),this.insertEmoji(n)}),e.appendChild(s)})}adjustTextareaHeight(){let e=this.shadow?.getElementById("chatifyTextarea");if(!e)return;e.style.height="auto";let t=window.getComputedStyle(e),r=parseFloat(t.lineHeight)||19.6,n=parseFloat(t.paddingTop)||11,s=parseFloat(t.paddingBottom)||11,a=parseFloat(t.borderTopWidth)||1,o=parseFloat(t.borderBottomWidth)||1,c=n+s+a+o,l=Math.round(r*1+c),h=Math.round(r*5+c),d=e.scrollHeight;if(d>h)e.style.height=`${h}px`,e.style.overflowY="auto";else{let f=Math.max(l,d);e.style.height=`${f}px`,e.style.overflowY="hidden"}}insertEmoji(e){let t=this.shadow?.getElementById("chatifyTextarea");if(!t)return;let r=t.selectionStart||t.value.length,n=t.selectionEnd||t.value.length,s=t.value;t.value=s.substring(0,r)+e+s.substring(n),t.selectionStart=t.selectionEnd=r+e.length,this.adjustTextareaHeight(),t.focus(),this.closeEmojiPicker()}openLightbox(e){let t=this.shadow?.getElementById("chatifyImageLightbox"),r=this.shadow?.getElementById("chatifyLightboxImg"),n=this.shadow?.getElementById("chatifyLightboxLink");t&&r&&(r.src=e,n&&(n.href=e),t.style.display="flex")}closeLightbox(){let e=this.shadow?.getElementById("chatifyImageLightbox");e&&(e.style.display="none")}switchTab(e){e==="help"&&(this.config.showHelpTab===!1||this.faqs.length===0)&&(e="home"),e==="home"&&Mi(this.config.widgetDesign)&&(e="messages"),this.activeTab=e;let t=this.shadow?.getElementById("tabHome"),r=this.shadow?.getElementById("tabMessages"),n=this.shadow?.getElementById("tabHelp");t&&(t.style.display=e==="home"?"flex":"none"),r&&(r.style.display=e==="messages"?"flex":"none"),n&&(n.style.display=e==="help"?"flex":"none"),this.shadow?.querySelectorAll(".chatify-nav-item").forEach(a=>{a.classList.toggle("active",a.getAttribute("data-tab")===e)});let s=this.config.workspaceId?`_${this.config.workspaceId.slice(0,8)}`:"";try{sessionStorage.setItem(`chatify_widget_tab${s}`,e)}catch{}e==="messages"&&(this.unreadCount=0,this.updateUnreadBadge(),this.markMessagesAsRead(),this.conversationId&&this.pollSoon(),this.scrollToBottom(!1),this.adjustTextareaHeight(),setTimeout(()=>{this.shadow?.getElementById("chatifyTextarea")?.focus({preventScroll:!0})},100))}getReplyTimeText(){return this.config.subtitle&&/(replies|minute|hour|instant|typical|usually|shortly)/i.test(this.config.subtitle)?this.config.subtitle.trim():"Usually replies within 10\u201315 minutes"}checkIsOnline(){let e=this.workspaceAgents.some(s=>s.status==="online"),t=this.config.businessHours,n=!!(t&&t.enabled)&&!this.isOutsideBusinessHours(t);return!!(e||n)}updatePresenceAndTexts(){let e=this.checkIsOnline(),t=this.getReplyTimeText(),r="We're away, leave a message and we'll reply by email",n=this.shadow?.getElementById("homeStatusPill");if(n){n.title=e?"Online":r;let h=e?`<span class="chatify-pulse-dot online"></span> <span>${this.escapeHTML(t)}</span>`:`<span class="chatify-pulse-dot away"></span> <span>${this.escapeHTML(r)}</span>`;n.dataset.rendered!==h&&(n.innerHTML=h,n.dataset.rendered=h)}let s=this.shadow?.getElementById("homeCardSub");s&&(s.textContent=e?"Ask us anything, or share your feedback.":r);let a=this.shadow?.querySelector("#btnGoToMessages span");a&&(a.textContent=e?"Send us a message":"Leave us a message");let o=this.shadow?.getElementById("chatifyHeaderSubtitle");o&&(o.textContent=e?t:r);let c=this.shadow?.querySelector("#chatifyHeaderAvatar .chatify-online-dot");c&&(c.style.display=e?"block":"none"),this.shadow?.getElementById("chatifyLauncherStatus")?.classList.toggle("is-online",e);let l=this.shadow?.querySelector(".chatify-popup-status-dot");l&&(l.style.display=e?"block":"none")}renderAvatarsStack(e){let t=this.shadow?.getElementById("homeAvatarsStack");if(!t)return;t.innerHTML="";let r=["linear-gradient(135deg, #3b82f6, #1d4ed8)","linear-gradient(135deg, #8b5cf6, #6d28d9)","linear-gradient(135deg, #10b981, #047857)","linear-gradient(135deg, #f59e0b, #d97706)","linear-gradient(135deg, #ec4899, #be185d)"],n=e&&e.length>0?e.slice(0,3):[];if(n.length===0){let s=document.createElement("div");s.className="chatify-mini-avatar",s.style.background=r[0];let a=this.safeUrl(this.config.logoUrl,!0);if(a)s.innerHTML=`<img src="${a}" alt="Support" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;" />`;else{let o=this.getSenderInitials(this.config.businessName||this.config.title||"Support");s.textContent=o}t.appendChild(s),this.mirrorHeaderAvatars(t);return}n.forEach((s,a)=>{let o=document.createElement("div");o.className="chatify-mini-avatar",o.style.background=r[a%r.length],o.title=s.name||"Agent";let c=this.safeUrl(s.avatar_url,!0);if(c){let l=document.createElement("img");l.src=c,l.alt=s.name||"Agent",l.style.cssText="width:100%;height:100%;object-fit:cover;border-radius:inherit;",l.onerror=()=>{o.innerHTML="",o.textContent=this.getSenderInitials(s.name||"Agent")},o.appendChild(l)}else o.textContent=this.getSenderInitials(s.name||"Agent");t.appendChild(o)}),this.mirrorHeaderAvatars(t)}mirrorHeaderAvatars(e){let t=this.shadow?.getElementById("chatHeaderAvatars");t&&(t.innerHTML="",e.childNodes.forEach(r=>t.appendChild(r.cloneNode(!0))))}subscribeToAgentsRealtime(){if(!this.config.workspaceId||this.agentsPollTimer)return;let e=async()=>{if(document.visibilityState==="hidden")return;let{data:t,error:r}=await this.supabase.rpc("fn_widget_agents",{p_workspace_id:this.config.workspaceId});if(r){i.isMissingFunction(r)&&this.agentsPollTimer&&(clearInterval(this.agentsPollTimer),this.subscribeToLegacyAgentsRealtime());return}Array.isArray(t)&&(this.workspaceAgents=t,this.renderAvatarsStack(this.workspaceAgents),this.updatePresenceAndTexts())};this.agentsPollTimer=setInterval(()=>{e().catch(()=>{})},6e4)}subscribeToLegacyAgentsRealtime(){this.config.workspaceId&&this.supabase.channel(`chatify-agents-${this.config.workspaceId}`).on("postgres_changes",{event:"*",schema:"public",table:"agents",filter:`workspace_id=eq.${this.config.workspaceId}`},async()=>{try{let{data:e}=await this.supabase.from("agents").select("id, name, avatar_url, status").eq("workspace_id",this.config.workspaceId);e&&(this.workspaceAgents=e,this.renderAvatarsStack(this.workspaceAgents),this.updatePresenceAndTexts())}catch(e){console.warn("[Zen-try] Error updating agent presence:",e)}}).subscribe()}updateThemeAndTexts(){let e=this.shadow?.getElementById("chatify-theme-style");e&&(e.textContent=this.generateCSS());let t=this.shadow?.getElementById("chatifyHeaderTitle");t&&(t.textContent=this.config.title);let r=this.shadow?.getElementById("chatifyHeaderSubtitle");r&&(r.textContent=this.config.subtitle);let n=this.shadow?.getElementById("chatifyPopupTitle");if(n){let w=this.config.businessName||this.config.title||"Trader Care Desk";n.textContent=w;let T=this.shadow?.getElementById("chatifyPopupAvatar");if(T){let L=this.safeUrl(this.config.logoUrl,!0);if(L){let I=this.escapeHTML(this.getSenderInitials(w).replace(/['\\<>\r\n]/g,"").slice(0,10));T.innerHTML=`<img src="${L}" alt="Logo" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.parentElement.textContent='${I}'" />`}else T.querySelector("img")||(T.textContent=this.getSenderInitials(w))}}let s=this.shadow?.getElementById("chatifyIconOpen");s&&(s.innerHTML=this.renderLauncherIconHTML());let a=this.shadow?.getElementById("chatifyHeaderAvatar");a&&(a.innerHTML=this.renderBrandAvatarHTML(!0));let o=this.shadow?.getElementById("homeBrandAvatar");o&&(o.innerHTML=this.renderBrandAvatarHTML(!1));let c=this.shadow?.getElementById("openConvAvatar");c&&(c.innerHTML=this.renderBrandAvatarHTML(!1));let l=this.shadow?.getElementById("homeGreetingTitle");if(l&&this.config.title){let w=this.config.title.replace(/^Welcome to\s+/i,"").replace(/Support!?/i,"").replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}️]+\s*$/u,"").trim();l.textContent=w?`Hello from ${w} \u{1F44B}`:"Hello there \u{1F44B}"}let h=this.shadow?.getElementById("homeGreetingSub");h&&this.config.subtitle&&(h.textContent=this.config.subtitle);let d=this.shadow?.querySelector("#navHelp span");d&&this.config.helpTabLabel&&(d.textContent=this.config.helpTabLabel);let f=this.shadow?.querySelector("#tabHelp .chatify-header-text h3");f&&this.config.helpTabLabel&&(f.textContent=this.config.helpTabLabel);let u=this.shadow?.querySelector("#cardHelpSearch .chatify-section-title");u&&this.config.helpTabLabel&&(u.textContent=this.config.helpTabLabel);let p=this.shadow?.querySelector("#homeSearchTrigger span");p&&this.config.helpTabLabel&&(p.textContent=`\u{1F50D} Search for ${this.config.helpTabLabel.toLowerCase()} articles...`);let m=this.shadow?.getElementById("navHelp"),y=this.shadow?.getElementById("cardHelpSearch"),g=this.shadow?.getElementById("tabHelp"),v=this.faqs.length>0;this.config.showHelpTab===!1||!v?(m&&(m.style.display="none"),y&&(y.style.display="none"),g&&(g.style.display="none"),this.activeTab==="help"&&this.switchTab("home")):(m&&(m.style.display="flex"),y&&(y.style.display="block")),this.renderAvatarsStack(this.workspaceAgents),this.updatePresenceAndTexts()}rgb(e){let t=(e||"").trim().replace("#","");return t.length===3&&(t=t.split("").map(r=>r+r).join("")),/^[0-9a-fA-F]{6}$/.test(t)||(t="2e5bff"),[parseInt(t.slice(0,2),16),parseInt(t.slice(2,4),16),parseInt(t.slice(4,6),16)]}luminance(e){let[t,r,n]=this.rgb(e).map(s=>{let a=s/255;return a<=.03928?a/12.92:Math.pow((a+.055)/1.055,2.4)});return .2126*t+.7152*r+.0722*n}shade(e,t){let[r,n,s]=this.rgb(e),a=t>0?255:0,o=Math.abs(t),c=l=>Math.round(l+(a-l)*o);return`rgb(${c(r)}, ${c(n)}, ${c(s)})`}alpha(e,t){let[r,n,s]=this.rgb(e);return`rgba(${r}, ${n}, ${s}, ${t})`}generateCSS(){let e=this.config.primaryColor||Xt,t=this.luminance(e)>.62?"#0b0b0f":"#ffffff",r=this.shade(e,-.34),n=this.config.position==="bottom-left",s=typeof this.config.offsetBottom=="number"?this.config.offsetBottom:20,a=typeof this.config.offsetSide=="number"?this.config.offsetSide:20,o=typeof this.config.zIndex=="number"?this.config.zIndex:2147483e3,c=s+66,l=s+68;return`
      :host {
        --w-brand: ${e};
        --w-brand-deep: ${r};
        /* Second colour for gradients (Settings \u2192 Chat widget); a darker brand by default. */
        --w-brand-2: ${this.config.secondaryColor||r};
        --w-on-brand: ${t};
        --w-brand-a08: ${this.alpha(e,.08)};
        --w-brand-a16: ${this.alpha(e,.16)};
        --w-brand-a28: ${this.alpha(e,.28)};

        --w-surface: #ffffff;
        --w-surface-2: #f7f7f5;
        --w-surface-3: #efefec;
        --w-canvas: #fbfbf9;

        --w-ink: #0b0b0f;
        --w-ink-2: #4f5057;
        --w-ink-3: #64656c;

        --w-line: #e7e7e3;
        --w-line-2: #d6d6d1;

        --w-success: #0b7a5c;
        --w-success-soft: #e6f6f1;
        --w-success-line: #b8e5d7;
        --w-warn: #8f5a06;
        --w-warn-soft: #fdf3e2;
        --w-warn-line: #f0d9ac;
        --w-danger: #c0233f;
        --w-danger-soft: #fdedf0;
        --w-danger-line: #f7c6d0;

        /* Glass window (Zentry design system: the widget is one of the three
           places glass is allowed). Kept mostly opaque so text contrast holds
           over any host page. */
        --w-glass: rgba(255, 255, 255, 0.86);
        --w-glass-line: rgba(11, 11, 15, 0.08);
        --w-focus: #2850e8;

        --w-r-sm: 10px;
        --w-r-md: 14px;
        --w-r-lg: 18px;
        --w-r-xl: 22px;

        --w-shadow-sm: 0 1px 3px rgba(11,11,15,.07), 0 1px 2px rgba(11,11,15,.04);
        --w-shadow-md: 0 6px 18px rgba(11,11,15,.09), 0 2px 6px rgba(11,11,15,.05);
        --w-shadow-xl: 0 32px 68px rgba(11,11,15,.18), 0 12px 26px rgba(11,11,15,.10);

        --w-ease: cubic-bezier(.22,.61,.36,1);
        --w-ease-out: cubic-bezier(.16,1,.3,1);
        --w-spring: cubic-bezier(.34,1.4,.64,1);

        color-scheme: light;
      }

      ${this.darkModeCSS()}

      /* Visible keyboard focus everywhere inside the widget. */
      :focus-visible {
        outline: 2px solid var(--w-focus);
        outline-offset: 2px;
      }

      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
          "Helvetica Neue", Arial, sans-serif;
        -webkit-font-smoothing: antialiased;
      }

      button { font: inherit; cursor: pointer; }

      ::-webkit-scrollbar { width: 8px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb {
        background: var(--w-line-2);
        border-radius: 999px;
        border: 2px solid transparent;
        background-clip: content-box;
      }

      /* \u2500\u2500 Launcher \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

      .chatify-launcher {
        position: fixed;
        ${n?`left: ${a}px;`:`right: ${a}px;`}
        bottom: ${s}px;
        width: 56px;
        height: 56px;
        border-radius: 50%;
        border: none;
        background: var(--w-brand);
        color: var(--w-on-brand);
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 8px 24px var(--w-brand-a28), 0 2px 8px rgba(11,11,15,.16);
        z-index: ${o};
        transition: transform .28s var(--w-spring), box-shadow .2s var(--w-ease);
      }

      .chatify-launcher:hover {
        transform: scale(1.07) translateY(-1px);
        box-shadow: 0 16px 38px var(--w-brand-a28), 0 6px 14px rgba(11,11,15,.22);
      }

      .chatify-launcher:active { transform: scale(.95); }

      .chatify-launcher.is-loading {
        background: #e7e9ef;
        box-shadow: 0 6px 18px rgba(11,11,15,.10);
        overflow: hidden;
        animation: w-launcher-in .3s var(--w-ease) both;
      }
      .chatify-launcher.is-loading > * { opacity: 0; }
      .chatify-launcher.is-loading::before {
        content: "";
        position: absolute;
        inset: 0;
        border-radius: 50%;
        background: linear-gradient(100deg, transparent 20%, rgba(255,255,255,.75) 50%, transparent 80%);
        transform: translateX(-100%);
        animation: w-launcher-shimmer 1.4s infinite;
      }
      .chatify-launcher-icon,
      .chatify-launcher svg { transition: opacity .2s var(--w-ease); }
      @keyframes w-launcher-shimmer { to { transform: translateX(100%); } }
      @keyframes w-launcher-in { from { opacity: 0; transform: scale(.85); } to { opacity: 1; transform: none; } }

      /* An expanding ring, drawn only while messages are waiting. A launcher
         that pulses permanently is just noise the visitor learns to ignore. */
      .chatify-launcher::after {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: 50%;
        border: 2px solid var(--w-brand);
        opacity: 0;
        pointer-events: none;
      }

      .chatify-launcher.has-unread::after {
        animation: w-halo 2.4s var(--w-ease-out) infinite;
      }

      .chatify-launcher-icon {
        width: 36px;
        height: 36px;
        object-fit: contain;
        display: block;
        pointer-events: none;
        transition: transform .25s var(--w-ease), opacity .18s var(--w-ease);
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.22));
      }

      /* Launcher label (Compact) and online dot (Live chat): hidden unless a design shows them. */
      .chatify-launcher-label, .chatify-launcher-status { display: none; }

      /* Header team photos: shown by the Live chat design only. */
      .chatify-header .chatify-header-avatars { display: none; }

      /* A preset icon: crisp at 28px, no shadow (it blurred the edges). */
      .chatify-launcher-icon.chatify-preset-icon {
        width: 28px;
        height: 28px;
        filter: none;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .chatify-preset-icon svg { display: block; width: 28px; height: 28px; }

      /* A workspace logo fills the whole launcher on white, so any logo
         (square, round, transparent) reads as a finished button. */
      .chatify-launcher-icon.chatify-custom-logo {
        width: 100%;
        height: 100%;
        border-radius: inherit;
        object-fit: cover;
        background: #ffffff;
        padding: 0;
        filter: none;
      }
      /* White behind the logo, so the close cross switches to dark ink. */
      .chatify-launcher:has(.chatify-custom-logo) { background: #ffffff; color: #0b0b0f; }
      .chatify-launcher:has(.chatify-custom-logo) .chatify-badge { z-index: 1; }

      .chatify-launcher:hover .chatify-launcher-icon {
        transform: scale(1.1);
      }

      .chatify-launcher svg {
        width: 25px;
        height: 25px;
        fill: currentColor;
        transition: transform .25s var(--w-ease), opacity .18s var(--w-ease);
      }

      .chatify-badge {
        position: absolute;
        top: -2px;
        ${n?"left: -2px;":"right: -2px;"}
        min-width: 20px;
        height: 20px;
        padding: 0 5px;
        border-radius: 999px;
        background: #e11d48;
        color: #fff;
        font-size: 11px;
        font-weight: 700;
        display: none;
        align-items: center;
        justify-content: center;
        border: 2px solid var(--w-surface);
        animation: w-pop .28s var(--w-spring);
      }

      /* \u2500\u2500 Unread Message Popup (Intercom-style Preview) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

      .chatify-message-popup {
        position: fixed;
        ${n?`left: ${a}px;`:`right: ${a}px;`}
        bottom: ${c}px;
        width: 350px;
        max-width: calc(100vw - 40px);
        display: flex;
        flex-direction: column;
        gap: 8px;
        z-index: ${o-5};
        pointer-events: auto;
        animation: chatifyPopupSlideIn 0.32s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      }

      @keyframes chatifyPopupSlideIn {
        0% {
          opacity: 0;
          transform: translateY(16px) scale(0.96);
        }
        100% {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      .chatify-message-popup.closing {
        animation: chatifyPopupSlideOut 0.2s cubic-bezier(0.4, 0, 1, 1) forwards;
      }

      @keyframes chatifyPopupSlideOut {
        0% {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
        100% {
          opacity: 0;
          transform: translateY(12px) scale(0.96);
        }
      }

      /* Card 1: Top Message Card */
      .chatify-popup-card {
        background: var(--w-surface);
        border-radius: 18px;
        padding: 14px 16px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06);
        display: flex;
        align-items: flex-start;
        gap: 12px;
        cursor: pointer;
        transition: transform 0.18s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.18s cubic-bezier(0.16, 1, 0.3, 1);
        border: 1px solid var(--w-line);
        color: var(--w-ink);
      }

      .chatify-popup-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 14px 34px rgba(0, 0, 0, 0.16), 0 4px 12px rgba(0, 0, 0, 0.08);
      }

      .chatify-popup-avatar-wrap {
        position: relative;
        width: 44px;
        height: 44px;
        flex-shrink: 0;
      }

      .chatify-popup-avatar {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: var(--w-brand);
        color: var(--w-on-brand);
        font-weight: 700;
        font-size: 15px;
        display: flex;
        align-items: center;
        justify-content: center;
        letter-spacing: 0.5px;
        overflow: hidden;
      }

      .chatify-popup-avatar img {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }

      .chatify-popup-status-dot {
        position: absolute;
        bottom: 0px;
        right: 0px;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: var(--w-success);
        border: 2.5px solid var(--w-surface);
      }

      .chatify-popup-content {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
      }

      .chatify-popup-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 3px;
      }

      .chatify-popup-title {
        font-size: 13.5px;
        font-weight: 600;
        color: var(--w-ink-2);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .chatify-popup-close {
        background: transparent;
        border: none;
        color: var(--w-ink-3);
        cursor: pointer;
        padding: 2px;
        margin-right: -4px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 6px;
        transition: color 0.15s, background-color 0.15s;
      }

      .chatify-popup-close:hover {
        color: var(--w-ink);
        background-color: var(--w-surface-3);
      }

      .chatify-popup-message {
        font-size: 15px;
        font-weight: 500;
        color: var(--w-ink);
        line-height: 1.38;
        word-break: break-word;
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      /* Card 2: Bottom Reply Bar */
      .chatify-popup-reply-bar {
        background: var(--w-surface);
        border-radius: 9999px;
        padding: 5px 6px 5px 18px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.10), 0 2px 6px rgba(0, 0, 0, 0.05);
        border: 1px solid var(--w-line);
        display: flex;
        align-items: center;
        gap: 8px;
        transition: box-shadow 0.2s, border-color 0.2s;
      }

      .chatify-popup-reply-bar:focus-within {
        box-shadow: 0 10px 28px rgba(0, 0, 0, 0.14), 0 0 0 2px var(--w-brand);
        border-color: transparent;
      }

      .chatify-popup-input {
        flex: 1;
        border: none;
        outline: none;
        background: transparent;
        font-size: 14px;
        color: var(--w-ink);
        min-width: 0;
        padding: 7px 0;
        font-family: inherit;
      }

      .chatify-popup-input::placeholder {
        color: var(--w-ink-3);
      }

      .chatify-popup-send {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        border: none;
        background: var(--w-surface-3);
        color: var(--w-ink-3);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        flex-shrink: 0;
        transition: background-color 0.2s, color 0.2s, transform 0.15s;
      }

      .chatify-popup-send.active {
        background: var(--w-brand);
        color: var(--w-on-brand);
      }

      .chatify-popup-send:hover {
        transform: scale(1.05);
      }

      .chatify-popup-send:active {
        transform: scale(0.95);
      }

      /* \u2500\u2500 Window \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

      .chatify-window {
        position: fixed;
        ${n?`left: ${a}px;`:`right: ${a}px;`}
        bottom: ${l}px;
        width: 396px;
        max-width: calc(100vw - 40px);
        height: 640px;
        max-height: calc(100vh - 120px);
        background: var(--w-glass);
        backdrop-filter: saturate(160%) blur(18px);
        -webkit-backdrop-filter: saturate(160%) blur(18px);
        border: 1px solid var(--w-glass-line);
        border-radius: var(--w-r-xl);
        box-shadow: var(--w-shadow-xl);
        display: none;
        flex-direction: column;
        overflow: hidden;
        z-index: ${o};
        animation: w-window-in .34s var(--w-ease) both;
      }

      .chatify-avatar-initial {
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        text-transform: uppercase;
        border-radius: inherit;
        background: var(--w-brand);
        color: var(--w-on-brand);
        user-select: none;
      }

      .chatify-system-line {
        align-self: center;
        text-align: center;
        max-width: 88%;
        margin: 8px auto;
        padding: 8px 12px;
        font-size: 12px;
        line-height: 1.5;
        color: var(--w-ink-2);
        background: var(--w-surface-2);
        border: 1px solid var(--w-line);
        border-radius: 12px;
      }

      .chatify-closed-notice {
        align-self: center;
        margin: 14px auto 6px;
        font-size: 12.5px;
        font-weight: 600;
        color: var(--w-ink-2);
        text-align: center;
      }

      .chatify-new-conversation-btn {
        align-self: center;
        margin: 10px auto 14px;
        padding: 10px 18px;
        border: none;
        border-radius: 999px;
        background: var(--w-brand);
        color: var(--w-on-brand);
        font-size: 13px;
        font-weight: 600;
      }

      /* \u2500\u2500 Quick Reply Chips \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

      .chatify-quick-replies {
        display: flex;
        flex-wrap: wrap;
        gap: 7px;
        padding: 2px 0 8px;
        max-width: 82%;
        /* Left-aligned like agent bubbles */
        margin-right: auto;
        animation: w-bubble-in .25s var(--w-ease-out) both;
      }

      .chatify-qr-btn {
        padding: 6px 13px;
        border: 1.5px solid var(--w-brand);
        border-radius: 999px;
        background: var(--w-surface);
        color: var(--w-brand);
        font-size: 12.5px;
        font-weight: 500;
        line-height: 1.4;
        cursor: pointer;
        white-space: nowrap;
        transition:
          background 0.14s ease,
          color 0.14s ease,
          transform 0.12s ease,
          box-shadow 0.14s ease;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
      }

      .chatify-qr-btn:hover {
        background: var(--w-brand);
        color: var(--w-on-brand);
        transform: translateY(-1px);
        box-shadow: 0 3px 8px var(--w-brand-a28);
      }

      .chatify-qr-btn:active {
        transform: translateY(0);
        opacity: 0.88;
      }

      .chatify-typing {
        display: inline-flex !important;
        align-items: center;
        gap: 4px;
        padding: 12px 14px !important;
      }

      .chatify-typing span {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--w-ink-3);
        animation: w-typing 1.2s infinite ease-in-out;
      }

      .chatify-typing span:nth-child(2) { animation-delay: .15s; }
      .chatify-typing span:nth-child(3) { animation-delay: .3s; }

      @keyframes w-typing {
        0%, 60%, 100% { transform: translateY(0); opacity: .4; }
        30% { transform: translateY(-4px); opacity: 1; }
      }

      .chatify-prev-list { display: flex; flex-direction: column; gap: 6px; margin-top: 10px; }

      .chatify-prev-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        width: 100%;
        padding: 10px 12px;
        text-align: left;
        background: var(--w-surface-2);
        border: 1px solid var(--w-line);
        border-radius: 12px;
        color: var(--w-ink);
      }

      .chatify-prev-item:hover { background: var(--w-surface-3); }
      .chatify-prev-text { display: flex; flex-direction: column; min-width: 0; gap: 2px; }
      .chatify-prev-snippet { font-size: 13px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .chatify-prev-meta { font-size: 11.5px; color: var(--w-ink-3); }
      .chatify-prev-chevron { font-size: 18px; color: var(--w-ink-3); }

      @media (max-width: 480px) {
        .chatify-window {
          inset: 0 !important;
          left: 0 !important;
          right: 0 !important;
          top: var(--w-vv-top, 0px) !important;
          bottom: auto !important;
          width: 100vw !important;
          max-width: 100vw !important;
          height: 100% !important;
          height: var(--w-vvh, 100dvh) !important;
          max-height: var(--w-vvh, 100dvh) !important;
          border-radius: 0 !important;
          border: none !important;
          box-shadow: none !important;
          z-index: ${o+1} !important;
        }

        .chatify-launcher.widget-is-open {
          display: none !important;
        }

        .chatify-message-popup {
          left: 12px !important;
          right: 12px !important;
          width: auto !important;
          max-width: calc(100vw - 24px) !important;
          bottom: ${s+64}px !important;
        }

        /* 16px stops iOS from zooming the page when a field is focused. */
        .chatify-textarea,
        .chatify-input {
          font-size: 16px !important;
        }

        .chatify-messages,
        .chatify-body {
          overscroll-behavior: contain;
        }

        .chatify-close-btn,
        .chatify-icon-btn#homeCloseBtn {
          width: 44px !important;
          height: 44px !important;
          min-width: 44px !important;
          min-height: 44px !important;
          border-radius: 50% !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          cursor: pointer !important;
          touch-action: manipulation !important;
        }

        .chatify-close-btn {
          background: var(--w-surface-2) !important;
          color: var(--w-ink) !important;
          border: 1px solid var(--w-line-2) !important;
        }

        .chatify-icon-btn#homeCloseBtn {
          background: rgba(255, 255, 255, 0.25) !important;
          color: #ffffff !important;
          border: 1px solid rgba(255, 255, 255, 0.35) !important;
        }
      }

      .chatify-tab-pane {
        flex: 1;
        min-height: 0;
        flex-direction: column;
        overflow: hidden;
        animation: w-fade .22s var(--w-ease);
      }

      /* \u2500\u2500 Home tab \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

      .chatify-home-hero {
        position: relative;
        isolation: isolate;
        overflow: hidden;
        padding: 24px 22px 56px;
        background: linear-gradient(150deg, var(--w-brand) 0%, var(--w-brand-2) 100%);
        color: #ffffff;
        flex-shrink: 0;
      }

      /* Two offset colour pools that drift against each other. The movement is
         slow and low-contrast on purpose \u2014 it should read as depth, not as an
         animation demanding attention. */
      .chatify-home-hero::before {
        content: '';
        position: absolute;
        inset: -40%;
        z-index: -1;
        background:
          radial-gradient(38% 42% at 22% 26%, rgba(255, 255, 255, 0.30), transparent 62%),
          radial-gradient(34% 38% at 78% 12%, rgba(255, 255, 255, 0.18), transparent 60%),
          radial-gradient(44% 46% at 62% 88%, var(--w-brand-a28), transparent 64%);
        animation: w-aurora 22s var(--w-ease) infinite alternate;
      }

      /* A whisper of grain stops the gradient from banding on wide screens. */
      .chatify-home-hero::after {
        content: '';
        position: absolute;
        inset: 0;
        z-index: -1;
        opacity: 0.055;
        pointer-events: none;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)'/%3E%3C/svg%3E");
      }

      .chatify-brand-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 22px;
      }

      .chatify-home-avatar {
        width: 38px;
        height: 38px;
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.2);
        border: 1.5px solid rgba(255, 255, 255, 0.32);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 7px;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.16);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
      }

      .chatify-home-avatar img {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }

      .chatify-icon-btn {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        border: 1px solid rgba(255, 255, 255, 0.22);
        background: rgba(255, 255, 255, 0.16);
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        transition: all .2s cubic-bezier(0.16, 1, 0.3, 1);
      }

      .chatify-icon-btn:hover {
        background: rgba(255, 255, 255, 0.3);
        transform: scale(1.06);
      }

      .chatify-home-title {
        font-size: 27px;
        font-weight: 700;
        letter-spacing: -0.032em;
        line-height: 1.18;
        color: #ffffff;
        text-wrap: balance;
        text-shadow: 0 1px 12px rgba(0, 0, 0, 0.14);
      }

      .chatify-home-sub {
        margin-top: 6px;
        font-size: 14px;
        line-height: 1.45;
        color: rgba(255, 255, 255, 0.9);
        font-weight: 400;
      }

      /* Each block rises a beat after the one above it. The whole sequence is
         under a third of a second, so it reads as the panel settling rather
         than as something the visitor has to wait for. */
      .chatify-home-content > * {
        animation: w-rise .34s var(--w-ease-out) both;
      }
      .chatify-home-content > *:nth-child(1) { animation-delay: .04s; }
      .chatify-home-content > *:nth-child(2) { animation-delay: .10s; }
      .chatify-home-content > *:nth-child(3) { animation-delay: .16s; }
      .chatify-home-content > *:nth-child(4) { animation-delay: .22s; }

      .chatify-home-content {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        margin-top: -30px;
        padding: 16px;
        background: var(--w-canvas);
        border-radius: 20px 20px 0 0;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      .chatify-card {
        background: var(--w-surface);
        border: 1px solid rgba(0, 0, 0, 0.07);
        border-radius: 18px;
        padding: 18px;
        box-shadow: 0 4px 18px -2px rgba(15, 23, 42, 0.06), 0 10px 28px -4px rgba(15, 23, 42, 0.08);
      }

      .chatify-card-action {
        transition: box-shadow .24s var(--w-ease), transform .24s var(--w-ease);
      }

      .chatify-card-action:hover {
        box-shadow: 0 8px 28px -2px rgba(15, 23, 42, 0.10), 0 18px 42px -6px rgba(15, 23, 42, 0.14);
        transform: translateY(-2px);
        border-color: var(--w-brand-a28);
      }

      .chatify-card-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
      }

      .chatify-avatars-stack {
        display: flex;
        align-items: center;
      }

      .chatify-mini-avatar {
        width: 30px;
        height: 30px;
        border-radius: 50%;
        color: #ffffff;
        font-size: 11px;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px solid var(--w-surface);
        margin-left: -8px;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
      }

      .chatify-mini-avatar:first-child {
        margin-left: 0;
      }

      .chatify-status-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        height: 24px;
        padding: 0 10px;
        border-radius: 999px;
        background: var(--w-surface-2);
        border: 1px solid var(--w-line);
        font-size: 11.5px;
        font-weight: 600;
        color: var(--w-ink-2);
        max-width: calc(100% - 70px);
      }

      .chatify-status-pill span:not(.chatify-pulse-dot) {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .chatify-pulse-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        display: inline-block;
      }

      .chatify-pulse-dot.online {
        background: #10b981;
        box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.25);
      }

      .chatify-pulse-dot.away {
        background: #f59e0b;
        box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.25);
      }

      .chatify-card-title {
        font-size: 17px;
        font-weight: 700;
        color: var(--w-ink);
        letter-spacing: -0.015em;
        margin-bottom: 4px;
      }

      .chatify-card-sub {
        font-size: 13px;
        color: var(--w-ink-2);
        line-height: 1.45;
        margin-bottom: 16px;
      }

      .chatify-primary-cta {
        width: 100%;
        height: 44px;
        border-radius: 12px;
        background: var(--w-brand);
        color: #ffffff;
        font-weight: 600;
        font-size: 14px;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        box-shadow: 0 4px 14px var(--w-brand-a28);
        transition: all .2s cubic-bezier(0.16, 1, 0.3, 1);
      }

      .chatify-primary-cta:hover {
        transform: translateY(-1px);
        box-shadow: 0 6px 20px var(--w-brand-a28);
        filter: brightness(1.04);
      }

      .chatify-primary-cta:active {
        transform: translateY(0);
        filter: brightness(0.98);
      }

      .chatify-home-unread-pill {
        display: none;
        align-items: center;
        gap: 5px;
        height: 24px;
        padding: 0 10px;
        border-radius: 999px;
        background: #ffe4e6;
        color: #e11d48;
        border: 1px solid #fecdd3;
        font-size: 11px;
        font-weight: 700;
        white-space: nowrap;
        animation: w-pop .28s var(--w-spring);
      }

      .chatify-cta-badge {
        min-width: 19px;
        height: 19px;
        line-height: 19px;
        padding: 0 6px;
        border-radius: 999px;
        background: #ffffff;
        color: var(--w-brand);
        font-size: 11.5px;
        font-weight: 800;
        display: none;
        align-items: center;
        justify-content: center;
        margin-left: 4px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.15);
      }

      .chatify-open-conv-card {
        cursor: pointer;
        transition: transform .2s var(--w-spring), box-shadow .2s var(--w-ease);
      }

      .chatify-open-conv-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
      }

      .chatify-conv-status-pill {
        background: #ecfdf5 !important;
        border-color: #a7f3d0 !important;
        color: #047857 !important;
      }

      .chatify-conv-time {
        font-size: 11.5px;
        color: var(--w-ink-3);
        font-weight: 500;
        margin-left: auto;
      }

      .chatify-open-conv-preview {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 10px 12px;
        margin: 10px 0 14px;
        background: var(--w-surface-2);
        border: 1px solid var(--w-line);
        border-radius: 12px;
        text-align: left;
      }

      .chatify-open-conv-avatar-col {
        flex-shrink: 0;
      }

      .chatify-open-conv-text-col {
        flex: 1;
        min-width: 0;
      }

      .chatify-open-conv-sender-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
        margin-bottom: 3px;
      }

      .chatify-open-conv-sender {
        font-size: 13px;
        font-weight: 700;
        color: var(--w-ink);
      }

      .chatify-open-conv-snippet {
        font-size: 12.5px;
        color: var(--w-ink-2);
        line-height: 1.45;
        margin: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
      }

      .chatify-new-conv-link {
        width: 100%;
        background: transparent;
        border: none;
        padding: 8px 0 0;
        margin-top: 6px;
        font-size: 12.5px;
        font-weight: 600;
        color: var(--w-brand);
        cursor: pointer;
        text-align: center;
        transition: opacity .15s;
        display: block;
      }

      .chatify-new-conv-link:hover {
        opacity: 0.8;
        text-decoration: underline;
      }

      .chatify-chips-section {
        margin-top: 4px;
      }

      .chatify-section-title {
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--w-ink-3);
        margin-bottom: 8px;
        padding-left: 2px;
      }

      .chatify-chips-grid {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .chatify-chip {
        width: 100%;
        padding: 11px 14px;
        border-radius: 12px;
        background: var(--w-surface);
        border: 1px solid var(--w-line);
        color: var(--w-ink);
        font-size: 13px;
        font-weight: 500;
        display: flex;
        align-items: center;
        justify-content: space-between;
        cursor: pointer;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
        transition: all .18s var(--w-ease);
      }

      .chatify-chip:hover {
        background: var(--w-brand-a08);
        border-color: var(--w-brand-a28);
        transform: translateX(3px);
        box-shadow: 0 3px 12px rgba(0, 0, 0, 0.06);
      }

      .chatify-chip-arrow {
        color: var(--w-ink-3);
        font-size: 16px;
        font-weight: 600;
        transition: transform .18s var(--w-ease), color .18s var(--w-ease);
      }

      .chatify-chip:hover .chatify-chip-arrow {
        color: var(--w-brand);
        transform: translateX(3px);
      }

      .chatify-search-trigger {
        background: var(--w-surface-2);
        border: 1px solid var(--w-line);
        border-radius: 12px;
        padding: 11px 14px;
        color: var(--w-ink-3);
        font-size: 13px;
        display: flex;
        align-items: center;
        gap: 10px;
        cursor: pointer;
        transition: all .18s var(--w-ease);
      }

      .chatify-search-trigger:hover {
        background: var(--w-surface);
        border-color: var(--w-brand-a28);
        color: var(--w-ink);
      }

      .chatify-search-kbd {
        margin-left: auto;
        font-size: 10px;
        font-weight: 600;
        padding: 2px 7px;
        border-radius: 6px;
        background: var(--w-surface);
        border: 1px solid var(--w-line);
        color: var(--w-ink-3);
      }

      /* \u2500\u2500 Thread header \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

      .chatify-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 13px 16px;
        border-bottom: 1px solid var(--w-line);
        background: var(--w-surface);
        flex-shrink: 0;
      }

      .chatify-header-info { display: flex; align-items: center; gap: 10px; min-width: 0; }

      .chatify-back-btn,
      .chatify-close-btn {
        width: 30px;
        height: 30px;
        border-radius: var(--w-r-sm);
        border: none;
        background: transparent;
        color: var(--w-ink-3);
        font-size: 15px;
        line-height: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition: background .16s var(--w-ease), color .16s var(--w-ease);
      }

      .chatify-back-btn:hover,
      .chatify-close-btn:hover { background: var(--w-surface-3); color: var(--w-ink); }

      .chatify-avatar {
        position: relative;
        width: 34px;
        height: 34px;
        border-radius: 50%;
        background: var(--w-brand);
        color: var(--w-on-brand);
        font-size: 14px;
        font-weight: 700;
        text-transform: uppercase;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .chatify-online-dot {
        position: absolute;
        right: -1px;
        bottom: -1px;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: var(--w-success);
        border: 2px solid var(--w-surface);
      }

      .chatify-header-text { min-width: 0; }

      .chatify-header-text h3 {
        font-size: 14px;
        font-weight: 600;
        letter-spacing: -.012em;
        color: var(--w-ink);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .chatify-header-text p {
        font-size: 12px;
        color: var(--w-ink-3);
        margin-top: 1px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      /* \u2500\u2500 Message body \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

      .chatify-body {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        padding: 16px;
        background: var(--w-canvas);
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .chatify-prechat {
        margin: auto 0;
        background: var(--w-surface);
        border: 1px solid var(--w-line);
        border-radius: var(--w-r-md);
        padding: 20px;
        box-shadow: var(--w-shadow-sm);
        animation: w-rise .35s var(--w-ease) both;
      }

      .chatify-prechat h4 {
        font-size: 16px;
        font-weight: 600;
        letter-spacing: -.014em;
        color: var(--w-ink);
      }

      .chatify-prechat p {
        margin: 5px 0 18px;
        font-size: 13px;
        line-height: 1.55;
        color: var(--w-ink-2);
      }

      .chatify-form-group { margin-bottom: 12px; }

      .chatify-form-group label {
        display: block;
        font-size: 12px;
        font-weight: 600;
        color: var(--w-ink-2);
        margin-bottom: 6px;
      }

      .chatify-input {
        width: 100%;
        height: 42px;
        padding: 0 12px;
        border-radius: var(--w-r-sm);
        border: 1px solid var(--w-line-2);
        background: var(--w-surface);
        color: var(--w-ink);
        font-size: 13.5px;
        outline: none;
        transition: border-color .16s var(--w-ease), box-shadow .16s var(--w-ease);
      }

      .chatify-input::placeholder { color: var(--w-ink-3); }

      .chatify-input.chatify-input-invalid,
      .chatify-input.chatify-input-invalid:focus {
        border-color: #ef4444;
        box-shadow: 0 0 0 3px rgba(239, 68, 68, .14);
      }

      .chatify-field-error {
        margin-top: 6px;
        font-size: 12px;
        line-height: 1.4;
        font-weight: 500;
        color: #dc2626;
      }

      .chatify-input:focus {
        border-color: var(--w-brand);
        box-shadow: 0 0 0 3px var(--w-brand-a16);
      }

      .chatify-start-btn {
        width: 100%;
        height: 44px;
        margin-top: 6px;
        border: none;
        border-radius: var(--w-r-sm);
        background: var(--w-brand);
        color: var(--w-on-brand);
        font-size: 14px;
        font-weight: 600;
        box-shadow: var(--w-shadow-sm);
        transition: filter .16s var(--w-ease), transform .12s var(--w-ease);
      }

      .chatify-start-btn:hover { filter: brightness(1.08); }
      .chatify-start-btn:active { transform: scale(.985); }

      .chatify-optional-tag {
        font-size: 11px;
        font-weight: 400;
        color: var(--w-ink-3);
        margin-left: 4px;
      }

      .chatify-skip-btn {
        width: 100%;
        height: 38px;
        margin-top: 8px;
        background: transparent;
        border: 1px solid var(--w-line-2);
        border-radius: var(--w-r-sm);
        color: var(--w-ink-2);
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        transition: background .16s var(--w-ease), color .16s var(--w-ease), border-color .16s var(--w-ease);
      }

      .chatify-skip-btn:hover {
        background: var(--w-surface-2);
        color: var(--w-brand);
        border-color: var(--w-brand);
      }

      .chatify-message-row {
        display: flex;
        animation: w-bubble-in .3s var(--w-ease-out) both;
      }

      .chatify-msg-visitor,
      .chatify-msg-agent {
        max-width: 82%;
        padding: 10px 13px;
        font-size: 13.5px;
        line-height: 1.55;
      }

      /* pre-wrap belongs on the text node only \u2014 on the bubble it would also
         render the markup's own indentation as blank lines. */
      .chatify-msg-quote {
        display: flex;
        flex-direction: column;
        gap: 1px;
        margin-bottom: 6px;
        padding: 5px 8px;
        border-left: 2px solid currentColor;
        border-radius: 6px;
        background: rgba(127, 127, 127, 0.14);
        opacity: 0.85;
        font-size: 12px;
        line-height: 1.35;
      }
      .chatify-msg-quote-who {
        font-weight: 600;
        font-size: 11px;
        opacity: 0.9;
      }
      .chatify-msg-quote-text {
        /* Two lines is enough to identify the message without burying the
           reply underneath the thing it is replying to. */
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        opacity: 0.85;
      }
      .chatify-msg-text {
        white-space: pre-wrap;
        word-wrap: break-word;
        overflow-wrap: anywhere;
      }

      /* Formatted replies: structure comes from the markup, not whitespace. */
      .chatify-msg-rich { white-space: normal; }
      .chatify-msg-rich > :first-child { margin-top: 0; }
      .chatify-msg-rich > :last-child { margin-bottom: 0; }
      .chatify-msg-rich p { margin: 0 0 8px; }
      .chatify-msg-rich h3, .chatify-msg-rich h4, .chatify-msg-rich h5, .chatify-msg-rich h6 {
        margin: 12px 0 6px;
        font-size: 14px;
        line-height: 1.35;
        font-weight: 700;
        letter-spacing: -0.01em;
        color: var(--w-ink);
      }
      .chatify-msg-rich h5, .chatify-msg-rich h6 { font-size: 13px; }
      .chatify-msg-rich ul, .chatify-msg-rich ol { margin: 4px 0 8px; padding-left: 18px; }
      .chatify-msg-rich li { margin: 0 0 4px; }
      .chatify-msg-rich li::marker { color: var(--w-brand); }
      .chatify-msg-rich strong { font-weight: 650; color: var(--w-ink); }
      .chatify-msg-text a { color: inherit; text-decoration: underline; text-underline-offset: 2px; overflow-wrap: anywhere; }
      .chatify-msg-rich a { color: var(--w-brand); text-decoration: underline; text-underline-offset: 2px; overflow-wrap: anywhere; }
      .chatify-msg-rich hr { border: 0; border-top: 1px solid var(--w-line); margin: 10px 0; }
      .chatify-msg-rich code { font-size: 12px; padding: 1px 4px; border-radius: 4px; background: var(--w-surface-2, rgba(15,23,42,.06)); }

      .chatify-msg-visitor {
        margin-left: auto;
        background: linear-gradient(145deg, var(--w-brand) 0%, var(--w-brand-deep) 130%);
        color: var(--w-on-brand);
        border-radius: 18px 18px 5px 18px;
        box-shadow: 0 2px 10px var(--w-brand-a28), 0 1px 2px rgba(11, 11, 15, 0.10);
      }

      .chatify-msg-agent {
        margin-right: auto;
        background: var(--w-surface);
        color: var(--w-ink);
        border-radius: 18px 18px 18px 5px;
        box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06);
        border: 1px solid var(--w-line);
      }

      .chatify-msg-time {
        margin-top: 4px;
        font-size: 10.5px;
        color: var(--w-ink-3);
        text-align: right;
      }

      .chatify-msg-visitor .chatify-msg-time {
        color: inherit;
        opacity: .78;
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 4px;
      }

      .chatify-tick {
        display: inline-flex;
        align-items: center;
        color: currentColor;
        opacity: .85;
      }

      /* The single place colour carries meaning instead of decoration. */
      .chatify-tick-read {
        color: #53bdeb;
        opacity: 1;
      }

      /* \u2500\u2500 CSAT \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

      .chatify-csat-box {
        margin-top: 6px;
        background: var(--w-surface);
        border: 1px solid var(--w-line);
        border-radius: var(--w-r-md);
        padding: 16px;
        text-align: center;
        box-shadow: var(--w-shadow-sm);
        animation: w-rise .3s var(--w-ease) both;
      }

      .chatify-csat-title {
        font-size: 14px;
        font-weight: 600;
        letter-spacing: -.012em;
        color: var(--w-ink);
      }

      .chatify-csat-sub {
        margin-top: 3px;
        font-size: 12px;
        color: var(--w-ink-3);
      }

      .chatify-csat-emojis {
        margin-top: 12px;
        display: flex;
        justify-content: center;
        gap: 6px;
      }

      .chatify-csat-btn {
        width: 42px;
        height: 42px;
        border-radius: var(--w-r-sm);
        border: 1px solid var(--w-line);
        background: var(--w-surface-2);
        font-size: 20px;
        line-height: 1;
        transition: transform .18s var(--w-spring), border-color .16s var(--w-ease),
          background .16s var(--w-ease);
      }

      .chatify-csat-btn:hover {
        transform: scale(1.16) translateY(-2px);
        border-color: var(--w-brand);
        background: var(--w-brand-a08);
      }

      .chatify-csat-choices {
        margin-top: 12px;
        display: flex;
        gap: 8px;
        justify-content: center;
      }

      .chatify-csat-choice-btn {
        flex: 1;
        padding: 8px 12px;
        border-radius: var(--w-r-sm);
        border: 1px solid var(--w-line);
        background: var(--w-surface-2);
        color: var(--w-ink);
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        transition: all .16s var(--w-ease);
      }

      .chatify-csat-choice-btn:hover {
        border-color: var(--w-line-3);
        background: var(--w-surface-3);
      }

      .chatify-csat-choice-btn.selected-good {
        border-color: var(--w-success);
        background: var(--w-success-soft);
        color: var(--w-success);
      }

      .chatify-csat-choice-btn.selected-bad {
        border-color: var(--w-danger);
        background: var(--w-danger-soft);
        color: var(--w-danger);
      }

      .chatify-csat-comment-wrap {
        margin-top: 10px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .chatify-csat-comment-input {
        width: 100%;
        box-sizing: border-box;
        border-radius: var(--w-r-sm);
        border: 1px solid var(--w-line);
        padding: 8px 10px;
        font-size: 12px;
        resize: none;
        height: 56px;
        background: var(--w-surface);
        color: var(--w-ink);
        font-family: inherit;
        outline: none;
      }

      .chatify-csat-comment-input:focus {
        border-color: var(--w-brand);
      }

      .chatify-csat-submit-btn {
        width: 100%;
        padding: 8px 12px;
        border-radius: var(--w-r-sm);
        background: var(--w-brand);
        color: #ffffff;
        border: none;
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
        transition: opacity .16s var(--w-ease);
      }

      .chatify-csat-submit-btn:hover {
        opacity: 0.9;
      }

      /* \u2500\u2500 Composer \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

      .chatify-footer {
        display: flex;
        align-items: flex-end;
        gap: 8px;
        padding: 12px 14px;
        border-top: 1px solid var(--w-line);
        background: var(--w-surface);
        flex-shrink: 0;
      }

      .chatify-textarea {
        flex: 1;
        box-sizing: border-box;
        height: 44px;
        min-height: 44px;
        max-height: 122px;
        padding: 11px 13px;
        border-radius: var(--w-r-md);
        border: 1px solid var(--w-line-2);
        background: var(--w-surface-2);
        color: var(--w-ink);
        font-size: 13.5px;
        line-height: 1.45;
        resize: none;
        outline: none;
        overflow-y: hidden;
        transition: border-color .16s var(--w-ease), box-shadow .16s var(--w-ease);
      }

      .chatify-textarea::placeholder { color: var(--w-ink-3); }

      .chatify-textarea:focus {
        border-color: var(--w-brand);
        box-shadow: 0 0 0 3px var(--w-brand-a16);
      }

      .chatify-send-btn {
        width: 42px;
        height: 42px;
        flex-shrink: 0;
        border: none;
        border-radius: var(--w-r-md);
        background: var(--w-brand);
        color: var(--w-on-brand);
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: var(--w-shadow-sm);
        transition: filter .16s var(--w-ease), transform .12s var(--w-ease);
      }

      .chatify-send-btn:hover {
        filter: brightness(1.08);
        transform: translateY(-1px) scale(1.04);
        box-shadow: 0 6px 16px var(--w-brand-a28);
      }
      .chatify-send-btn:active { transform: scale(.94); }

      .chatify-send-btn svg { width: 19px; height: 19px; fill: currentColor; }

      .chatify-footer-actions {
        display: flex;
        align-items: center;
        gap: 3px;
        padding-bottom: 5px;
      }

      .chatify-action-btn {
        width: 34px;
        height: 34px;
        border: none;
        border-radius: var(--w-r-sm);
        background: transparent;
        color: var(--w-ink-2);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: background .15s var(--w-ease), color .15s var(--w-ease), transform .12s var(--w-ease);
      }

      .chatify-action-btn:hover {
        background: var(--w-surface-2);
        color: var(--w-brand);
        transform: scale(1.08);
      }

      .chatify-action-btn svg {
        width: 19px;
        height: 19px;
      }

      .chatify-attachment-preview {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 14px;
        background: var(--w-surface-2);
        border-top: 1px solid var(--w-line);
        flex-shrink: 0;
        animation: chatifyFadeIn .15s var(--w-ease);
      }

      .chatify-preview-bar { display: none; height: 3px; margin-top: 5px; border-radius: 999px; background: var(--w-line); overflow: hidden; }
      .chatify-preview-bar > span { display: block; width: 40%; height: 100%; border-radius: inherit; background: var(--w-brand); animation: chatifyIndeterminate 1.1s var(--w-ease) infinite; }
      .chatify-attachment-preview[data-state="sending"] .chatify-preview-bar { display: block; }
      .chatify-attachment-preview[data-state="failed"] { background: var(--w-danger-soft); border-top-color: var(--w-danger-line); }
      .chatify-attachment-preview[data-state="failed"] .chatify-preview-size { color: var(--w-danger); font-weight: 500; white-space: normal; }
      .chatify-preview-retry { display: none; height: 26px; padding: 0 10px; border-radius: 8px; border: 1px solid var(--w-line-2); background: var(--w-surface); color: var(--w-ink); font-size: 12px; font-weight: 600; cursor: pointer; flex-shrink: 0; }
      .chatify-preview-retry:hover { background: var(--w-surface-2); }
      .chatify-attachment-preview[data-state="failed"]:not([data-retry="no"]) .chatify-preview-retry { display: inline-flex; align-items: center; }
      @keyframes chatifyIndeterminate { from { transform: translateX(-100%); } to { transform: translateX(250%); } }

      .chatify-net-banner { display: flex; align-items: center; gap: 8px; padding: 8px 14px; font-size: 12px; font-weight: 500; line-height: 1.35; flex-shrink: 0; border-top: 1px solid; }
      .chatify-net-banner[hidden] { display: none; }
      .chatify-net-banner[data-tone="ok"] svg { display: none; }
      .chatify-net-banner, .chatify-net-banner[data-tone="warn"] { background: var(--w-warn-soft); color: var(--w-warn); border-color: var(--w-warn-line); }
      .chatify-net-banner[data-tone="ok"] { background: var(--w-success-soft); color: var(--w-success); border-color: var(--w-success-line); }

      .chatify-preview-thumb {
        width: 38px;
        height: 38px;
        border-radius: 8px;
        object-fit: cover;
        border: 1px solid var(--w-line);
      }

      .chatify-preview-info {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
      }

      .chatify-preview-name {
        font-size: 12px;
        font-weight: 600;
        color: var(--w-ink);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .chatify-preview-size {
        font-size: 10.5px;
        color: var(--w-ink-3);
      }

      .chatify-preview-remove {
        width: 22px;
        height: 22px;
        border-radius: 50%;
        border: none;
        background: var(--w-line);
        color: var(--w-ink-2);
        font-size: 12px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background .15s;
      }

      .chatify-preview-remove:hover {
        background: var(--w-line-2);
        color: var(--w-ink);
      }

      .chatify-emoji-popover {
        position: absolute;
        bottom: 66px;
        left: 14px;
        z-index: 35;
        background: var(--w-surface);
        border: 1px solid var(--w-line);
        border-radius: 14px;
        padding: 8px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.18);
        width: 295px;
        box-sizing: border-box;
        animation: chatifyFadeIn .15s var(--w-ease);
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .chatify-emoji-header {
        width: 100%;
      }

      .chatify-emoji-search {
        width: 100%;
        box-sizing: border-box;
        padding: 6px 10px;
        font-size: 12.5px;
        border: 1px solid var(--w-line);
        border-radius: 8px;
        background: var(--w-surface-2);
        color: var(--w-ink);
        outline: none;
      }

      .chatify-emoji-search:focus {
        border-color: var(--w-brand);
      }

      .chatify-emoji-categories {
        display: flex;
        align-items: center;
        gap: 2px;
        padding-bottom: 4px;
        border-bottom: 1px solid var(--w-line);
        overflow-x: auto;
      }

      .chatify-emoji-cat-btn {
        background: transparent;
        border: none;
        border-radius: 6px;
        padding: 4px 6px;
        font-size: 15px;
        cursor: pointer;
        opacity: 0.65;
        transition: opacity .15s, background .15s;
        line-height: 1;
      }

      .chatify-emoji-cat-btn:hover {
        opacity: 1;
        background: var(--w-surface-2);
      }

      .chatify-emoji-cat-btn.active {
        opacity: 1;
        background: var(--w-surface-2);
        box-shadow: inset 0 -2px 0 var(--w-brand);
      }

      .chatify-emoji-grid {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 2px;
        max-height: 190px;
        overflow-y: auto;
        padding-right: 2px;
      }

      .chatify-emoji-btn {
        font-size: 19px;
        padding: 5px 2px;
        border: none;
        background: transparent;
        border-radius: 6px;
        cursor: pointer;
        transition: transform .12s, background .15s;
        line-height: 1;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .chatify-emoji-btn:hover {
        background: var(--w-surface-2);
        transform: scale(1.22);
      }

      .chatify-msg-attachment {
        margin-bottom: 6px;
      }

      .chatify-msg-img {
        max-width: 100%;
        max-height: 190px;
        border-radius: 10px;
        object-fit: cover;
        cursor: pointer;
        display: block;
        border: 1px solid rgba(0,0,0,.08);
        transition: opacity .15s, transform .15s;
      }

      .chatify-msg-img:hover {
        opacity: .94;
        transform: scale(1.01);
      }

      .chatify-msg-doc {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 10px;
        background: rgba(0,0,0,0.06);
        border-radius: 8px;
        font-size: 12px;
        text-decoration: underline;
        color: inherit;
      }

      .chatify-lightbox {
        position: absolute;
        inset: 0;
        z-index: 9999;
        background: rgba(0, 0, 0, 0.88);
        backdrop-filter: blur(4px);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 18px;
        animation: chatifyFadeIn .15s var(--w-ease);
      }

      .chatify-lightbox-img {
        max-width: 90%;
        max-height: 80%;
        border-radius: 12px;
        object-fit: contain;
        box-shadow: 0 10px 30px rgba(0,0,0,0.5);
      }

      .chatify-lightbox-close {
        position: absolute;
        top: 14px;
        right: 14px;
        background: rgba(255,255,255,0.18);
        border: none;
        color: #fff;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        cursor: pointer;
        font-size: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background .15s;
      }

      .chatify-lightbox-close:hover {
        background: rgba(255,255,255,0.35);
      }

      .chatify-lightbox-link {
        margin-top: 12px;
        color: #93c5fd;
        font-size: 12px;
        text-decoration: underline;
      }

      @keyframes chatifySpin {
        to { transform: rotate(360deg); }
      }

      /* \u2500\u2500 Help tab \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

      .chatify-help-body {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        padding: 14px;
        background: var(--w-canvas);
      }

      .chatify-help-search-bar { margin-bottom: 12px; }

      .chatify-help-search-bar input {
        width: 100%;
        height: 42px;
        padding: 0 13px;
        border-radius: var(--w-r-sm);
        border: 1px solid var(--w-line-2);
        background: var(--w-surface);
        color: var(--w-ink);
        font-size: 13.5px;
        outline: none;
        transition: border-color .16s var(--w-ease), box-shadow .16s var(--w-ease);
      }

      .chatify-help-search-bar input::placeholder { color: var(--w-ink-3); }

      .chatify-help-search-bar input:focus {
        border-color: var(--w-brand);
        box-shadow: 0 0 0 3px var(--w-brand-a16);
      }

      .zentry-section-list, .chatify-section-list {
        display: flex;
        flex-direction: column;
        gap: 9px;
      }

      .zentry-section-card, .chatify-section-card {
        display: flex;
        align-items: center;
        gap: 12px;
        background: var(--w-surface);
        border: 1px solid var(--w-line);
        border-radius: var(--w-r-md);
        padding: 13px 14px;
        cursor: pointer;
        transition: border-color .16s var(--w-ease), box-shadow .16s var(--w-ease), transform .16s var(--w-ease);
      }

      .zentry-section-card, .chatify-section-card:hover {
        border-color: var(--w-line-2);
        box-shadow: var(--w-shadow-sm);
        transform: translateY(-1px);
      }

      .zentry-section-card, .zentry-section-card-icon, .chatify-section-card-icon {
        width: 36px;
        height: 36px;
        border-radius: 9px;
        background: var(--w-surface-2);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        flex-shrink: 0;
      }

      .zentry-section-card, .zentry-section-card-info, .chatify-section-card-info {
        flex: 1;
        min-width: 0;
      }

      .zentry-section-card, .zentry-section-card-title, .chatify-section-card-title {
        margin: 0;
        font-size: 13.5px;
        font-weight: 600;
        color: var(--w-ink);
        line-height: 1.35;
      }

      .zentry-section-card, .zentry-section-card-desc, .chatify-section-card-desc {
        margin: 3px 0 0;
        font-size: 12px;
        color: var(--w-ink-3);
        line-height: 1.4;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .zentry-section-card, .zentry-section-card-arrow, .chatify-section-card-arrow {
        color: var(--w-ink-3);
        font-size: 18px;
        line-height: 1;
        flex-shrink: 0;
        transition: transform .18s var(--w-ease), color .18s var(--w-ease);
      }

      .zentry-section-card, .chatify-section-card:hover .zentry-section-card, .zentry-section-card-arrow, .chatify-section-card-arrow {
        color: var(--w-brand);
        transform: translateX(2px);
      }

      .zentry-section-back-btn, .chatify-section-back-btn {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        background: none;
        border: none;
        padding: 0 0 12px 0;
        color: var(--w-brand);
        font-size: 12.5px;
        font-weight: 600;
        cursor: pointer;
        transition: opacity .16s var(--w-ease);
      }

      .zentry-section-back-btn, .chatify-section-back-btn:hover {
        opacity: 0.8;
      }

      .zentry-section-view, .zentry-section-view-header, .chatify-section-view-header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 14px;
        padding-bottom: 12px;
        border-bottom: 1px solid var(--w-line);
      }

      .zentry-section-view, .zentry-section-view-icon, .chatify-section-view-icon {
        font-size: 24px;
        flex-shrink: 0;
      }

      .zentry-section-view, .zentry-section-view-text, .chatify-section-view-text h3 {
        margin: 0;
        font-size: 15px;
        font-weight: 700;
        color: var(--w-ink);
      }

      .zentry-section-view, .zentry-section-view-text, .chatify-section-view-text p {
        margin: 2px 0 0;
        font-size: 12px;
        color: var(--w-ink-3);
      }

      .zentry-faq-list, .chatify-faq-list { display: flex; flex-direction: column; gap: 8px; }

      .zentry-faq-item, .chatify-faq-item {
        background: var(--w-surface);
        border: 1px solid var(--w-line);
        border-radius: var(--w-r-md);
        padding: 13px 14px;
        cursor: pointer;
        transition: border-color .16s var(--w-ease), box-shadow .16s var(--w-ease);
      }

      .zentry-faq-item, .chatify-faq-item:hover { border-color: var(--w-line-2); box-shadow: var(--w-shadow-sm); }
      .zentry-faq-item, .chatify-faq-item.open { border-color: var(--w-brand); }

      .zentry-faq-q, .chatify-faq-q {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        font-size: 13.5px;
        font-weight: 600;
        line-height: 1.4;
        color: var(--w-ink);
      }

      .zentry-faq-arrow, .chatify-faq-arrow {
        color: var(--w-ink-3);
        font-size: 17px;
        line-height: 1;
        flex-shrink: 0;
        transition: transform .22s var(--w-ease), color .16s var(--w-ease);
      }

      .zentry-faq-item, .chatify-faq-item.open .zentry-faq-arrow, .chatify-faq-arrow {
        transform: rotate(90deg);
        color: var(--w-brand);
      }

      .zentry-faq-a, .chatify-faq-a {
        max-height: 0;
        overflow: hidden;
        opacity: 0;
        font-size: 13px;
        line-height: 1.6;
        color: var(--w-ink-2);
        transition: max-height .28s var(--w-ease), opacity .22s var(--w-ease),
          margin-top .28s var(--w-ease);
      }

      .zentry-faq-item, .chatify-faq-item.open .zentry-faq-a, .chatify-faq-a {
        max-height: 480px;
        overflow-y: auto;
        opacity: 1;
        margin-top: 9px;
        padding-right: 4px;
      }

      .zentry-faq-markdown, .chatify-faq-markdown {
        font-size: 12.5px;
        line-height: 1.6;
        color: var(--w-ink-2);
      }
      .zentry-faq-markdown, .chatify-faq-markdown p { margin: 0 0 8px 0; }
      .zentry-faq-markdown, .chatify-faq-markdown p:last-child { margin-bottom: 0; }
      .zentry-faq-markdown, .chatify-faq-markdown pre {
        background: var(--w-surface-2, #f1f5f9);
        border: 1px solid var(--w-line);
        border-radius: 6px;
        padding: 8px 10px;
        overflow-x: auto;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 11.5px;
        margin: 8px 0;
      }
      .zentry-faq-markdown, .chatify-faq-markdown code {
        background: var(--w-surface-2, #f1f5f9);
        border-radius: 4px;
        padding: 2px 4px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 11.5px;
      }
      .zentry-faq-markdown, .chatify-faq-markdown a {
        color: var(--w-brand);
        text-decoration: underline;
      }
      .zentry-faq-markdown, .chatify-faq-markdown ul, .zentry-faq-markdown, .chatify-faq-markdown ol {
        margin: 6px 0 8px 18px;
        padding: 0;
      }
      .zentry-faq-markdown, .chatify-faq-markdown li { margin-bottom: 3px; }
      .zentry-faq-markdown, .chatify-faq-markdown blockquote {
        border-left: 3px solid var(--w-brand);
        margin: 8px 0;
        padding-left: 8px;
        color: var(--w-ink-3);
        font-style: italic;
      }
      .zentry-article-ext-link, .chatify-article-ext-link {
        font-size: 11.5px;
        color: var(--w-brand);
        text-decoration: none;
        font-weight: 600;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        transition: opacity .15s;
      }
      .zentry-article-ext-link, .chatify-article-ext-link:hover {
        opacity: 0.8;
        text-decoration: underline;
      }

      /* \u2500\u2500 Bottom navigation \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

      .chatify-bottom-nav {
        display: flex;
        border-top: 1px solid var(--w-line);
        background: var(--w-glass);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        padding: 6px 10px calc(8px + env(safe-area-inset-bottom, 0px));
        flex-shrink: 0;
        height: 64px;
        box-sizing: border-box;
      }

      .chatify-nav-item {
        position: relative;
        flex: 1;
        border: none;
        background: transparent;
        color: #64748b;
        padding: 6px 0 4px;
        border-radius: 12px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 3px;
        font-size: 11.5px;
        font-weight: 500;
        cursor: pointer;
        transition: all .18s var(--w-ease);
      }

      .chatify-nav-item svg {
        transition: transform .2s var(--w-spring), color .18s var(--w-ease);
      }

      .chatify-nav-item:hover {
        color: #1e293b;
        background: rgba(0, 0, 0, 0.03);
      }

      .chatify-nav-item.active {
        color: var(--w-brand);
        font-weight: 700;
      }

      .chatify-nav-item.active svg {
        transform: translateY(-1px) scale(1.08);
      }

      .chatify-nav-item.active::after {
        content: '';
        position: absolute;
        bottom: 2px;
        width: 16px;
        height: 3px;
        border-radius: 999px;
        background: var(--w-brand);
      }

      .nav-msg-icon-wrap { position: relative; display: flex; }

      .chatify-nav-badge {
        position: absolute;
        top: -3px;
        right: -6px;
        min-width: 15px;
        height: 15px;
        padding: 0 4px;
        border-radius: 999px;
        background: #e11d48;
        color: #fff;
        font-size: 9.5px;
        font-weight: 700;
        display: none;
        align-items: center;
        justify-content: center;
        border: 2px solid var(--w-surface);
      }

      .chatify-nav-label-wrap {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
      }

      .chatify-nav-inline-badge {
        min-width: 17px;
        height: 17px;
        line-height: 17px;
        padding: 0 5px;
        border-radius: 999px;
        background: #e11d48;
        color: #fff;
        font-size: 10px;
        font-weight: 700;
        display: none;
        align-items: center;
        justify-content: center;
        box-shadow: 0 1px 3px rgba(225, 29, 72, 0.35);
        animation: w-pop .28s var(--w-spring);
      }

      /* \u2500\u2500 Motion \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

      @keyframes w-bubble-in {
        from { opacity: 0; transform: translateY(8px) scale(.97); }
        to   { opacity: 1; transform: none; }
      }

      @keyframes w-aurora {
        from { transform: translate3d(-4%, -3%, 0) scale(1); }
        to   { transform: translate3d(5%, 4%, 0) scale(1.12); }
      }

      @keyframes w-halo {
        0%        { transform: scale(1);   opacity: .5; }
        70%, 100% { transform: scale(1.7); opacity: 0; }
      }

      @keyframes w-window-in {
        from { opacity: 0; transform: translateY(14px) scale(.985); }
        to   { opacity: 1; transform: none; }
      }

      @keyframes w-rise {
        from { opacity: 0; transform: translateY(7px); }
        to   { opacity: 1; transform: none; }
      }

      @keyframes w-fade { from { opacity: 0; } to { opacity: 1; } }

      @keyframes w-pop {
        from { opacity: 0; transform: scale(.6); }
        to   { opacity: 1; transform: none; }
      }

      /* \u2500\u2500 Handover Card & Agent Sender \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
      .chatify-handover-card {
        margin: 12px 0 14px 0;
        background: var(--w-surface);
        border: 1px solid var(--w-line);
        border-radius: 12px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.02);
        display: flex;
        flex-direction: column;
        animation: w-rise .3s var(--w-ease) both;
        position: relative;
        overflow: hidden;
      }

      .chatify-handover-accent-bar {
        height: 3px;
        width: 100%;
        background: linear-gradient(90deg, var(--w-brand), #3b82f6, var(--w-brand));
        background-size: 200% 100%;
        animation: chatifyHandoverShimmer 2.2s linear infinite;
      }
      .chatify-handover-accent-bar.connected {
        background: #10b981;
        animation: none;
      }
      .chatify-handover-accent-bar.waiting {
        background: var(--w-line-2, var(--w-line));
        animation: none;
      }

      @keyframes chatifyHandoverShimmer {
        0%   { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }

      .chatify-handover-inner {
        display: flex;
        gap: 12px;
        align-items: flex-start;
        padding: 13px 15px;
      }

      .chatify-handover-avatar-wrap {
        position: relative;
        width: 36px;
        height: 36px;
        flex-shrink: 0;
      }

      .chatify-handover-avatar,
      .chatify-handover-face,
      .zentry-agent-joined, .zentry-agent-joined-avatar, .chatify-agent-joined-avatar {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: var(--w-brand);
        color: var(--w-on-brand);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        overflow: hidden;
        border: 2px solid var(--w-surface);
        position: relative;
        flex-shrink: 0;
      }

      .chatify-handover-avatar img,
      .chatify-handover-face img,
      .zentry-agent-joined, .zentry-agent-joined-avatar, .chatify-agent-joined-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .chatify-handover-avatar-dot {
        position: absolute;
        bottom: 0px;
        right: 0px;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        border: 2px solid var(--w-surface);
      }
      .chatify-handover-avatar-dot.online {
        background: #10b981;
      }
      .chatify-handover-avatar-dot.away {
        background: #f59e0b;
      }

      .chatify-handover-body {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 3px;
      }

      .chatify-handover-header-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        flex-wrap: wrap;
      }

      .chatify-handover-heading {
        font-size: 13px;
        font-weight: 650;
        color: var(--w-ink);
        letter-spacing: -0.01em;
      }

      .chatify-handover-status-pill {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: 10.5px;
        font-weight: 600;
        padding: 2px 8px;
        border-radius: 999px;
        background: rgba(59, 130, 246, 0.08);
        color: #2563eb;
        white-space: nowrap;
      }
      .chatify-handover-status-pill.waiting {
        background: rgba(245, 158, 11, 0.1);
        color: #d97706;
      }
      .chatify-handover-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 10px;
        flex-wrap: wrap;
      }
      .chatify-handover-btn-secondary {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 5px 10px;
        font-size: 11px;
        font-weight: 600;
        border-radius: 6px;
        border: 1px solid var(--w-line-2, var(--w-line));
        background: var(--w-surface);
        color: var(--w-ink);
        cursor: pointer;
        transition: background .15s ease;
      }
      .chatify-handover-btn-secondary:hover {
        background: var(--w-surface-2, rgba(0,0,0,0.04));
      }
      .chatify-handover-ai-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 8px;
        font-size: 11px;
        font-weight: 600;
        border-radius: 6px;
        background: rgba(16, 185, 129, 0.1);
        color: #059669;
      }
      .chatify-handover-btn-link {
        border: none;
        background: none;
        color: var(--w-ink-2);
        font-size: 10.5px;
        text-decoration: underline;
        cursor: pointer;
        padding: 0;
      }
      .chatify-handoff-action-btn {
        margin-top: 8px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 7px 12px;
        font-size: 12px;
        font-weight: 600;
        border-radius: 8px;
        border: none;
        background: var(--w-brand);
        color: var(--w-on-brand);
        cursor: pointer;
        transition: opacity .15s ease, transform .15s ease;
      }
      .chatify-handoff-action-btn:hover {
        opacity: 0.9;
        transform: translateY(-1px);
      }
      .chatify-handoff-action-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none;
      }
      .chatify-handover-status-pill.connected {
        background: rgba(16, 185, 129, 0.1);
        color: #059669;
      }

      .chatify-status-pulse {
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background: #2563eb;
        animation: chatifyStatusPulse 1.6s ease-in-out infinite;
      }

      @keyframes chatifyStatusPulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50%      { opacity: 0.35; transform: scale(0.85); }
      }

      .chatify-handover-desc {
        font-size: 12px;
        color: var(--w-ink-2);
        line-height: 1.45;
        margin: 2px 0 0 0;
      }

      .chatify-handover-check {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(16, 185, 129, 0.14);
        color: #047857;
      }

      .chatify-handover-email-notice {
        margin-top: 8px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        color: var(--w-ink-2);
        background: var(--w-surface-2, rgba(0,0,0,0.03));
        border: 1px solid var(--w-line);
        border-radius: 6px;
        padding: 5px 9px;
        line-height: 1.35;
      }
      .chatify-handover-email-notice svg {
        flex-shrink: 0;
        opacity: 0.7;
      }
      .chatify-handover-email-notice strong {
        color: var(--w-ink);
        font-weight: 600;
      }

      .chatify-handover-email-form {
        margin-top: 9px;
        display: flex;
        flex-direction: column;
        gap: 5px;
      }
      .chatify-handover-email-prompt {
        font-size: 11px;
        color: var(--w-ink-2);
        font-weight: 500;
      }
      .chatify-handover-email-row {
        display: flex;
        gap: 6px;
      }
      .chatify-handover-email-input {
        flex: 1;
        min-width: 0;
        padding: 6px 9px;
        font-size: 11.5px;
        border-radius: 6px;
        border: 1px solid var(--w-line-2, var(--w-line));
        background: var(--w-surface);
        color: var(--w-ink);
        outline: none;
      }
      .chatify-handover-email-input:focus {
        border-color: var(--w-brand);
      }
      .chatify-handover-email-btn {
        padding: 6px 11px;
        font-size: 11.5px;
        font-weight: 600;
        border-radius: 6px;
        border: none;
        background: var(--w-brand);
        color: var(--w-on-brand);
        cursor: pointer;
        white-space: nowrap;
      }

      /* "Sara joined the conversation": a centred divider above the first reply. */
      .zentry-agent-joined, .chatify-agent-joined {
        display: flex;
        align-items: center;
        gap: 10px;
        margin: 14px 0 6px;
        font-size: 12px;
        color: var(--w-ink-2);
        animation: w-rise .3s var(--w-ease) both;
      }
      .zentry-agent-joined, .chatify-agent-joined::before,
      .zentry-agent-joined, .chatify-agent-joined::after {
        content: '';
        flex: 1;
        height: 1px;
        background: var(--w-line);
      }
      .zentry-agent-joined, .zentry-agent-joined-avatar, .chatify-agent-joined-avatar {
        width: 22px;
        height: 22px;
        margin-left: 0;
        border-width: 0;
        font-size: 9px;
        overflow: visible;
      }
      .zentry-agent-joined, .zentry-agent-joined-avatar, .chatify-agent-joined-avatar img {
        border-radius: 50%;
      }
      .zentry-agent-joined, .zentry-agent-joined-dot, .chatify-agent-joined-dot {
        position: absolute;
        right: -2px;
        bottom: -2px;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #10b981;
        border: 1.5px solid var(--w-surface);
      }
      .zentry-agent-joined, .zentry-agent-joined-text, .chatify-agent-joined-text {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 70%;
      }
      .zentry-agent-joined, .zentry-agent-joined-text, .chatify-agent-joined-text strong {
        color: var(--w-ink);
        font-weight: 650;
      }
      .zentry-agent-joined, .zentry-agent-joined-time, .chatify-agent-joined-time {
        color: var(--w-ink-3, var(--w-ink-2));
      }

      .chatify-handover-content {
        flex: 1;
        min-width: 0;
      }

      .chatify-handover-title-row {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
      }

      .chatify-handover-title {
        font-size: 13px;
        font-weight: 650;
        color: var(--w-ink);
        letter-spacing: -0.01em;
      }

      .chatify-handover-tag {
        font-size: 9.5px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        padding: 1.5px 6px;
        border-radius: 999px;
        background: rgba(16, 185, 129, 0.14);
        color: #047857;
      }

      .chatify-handover-sub {
        margin-top: 2px;
        font-size: 11.5px;
        color: var(--w-ink-2);
        line-height: 1.35;
      }

      .chatify-agent-sender-name {
        font-size: 11px;
        font-weight: 600;
        color: var(--w-ink-2);
        margin-bottom: 4px;
        display: flex;
        align-items: center;
        gap: 5px;
      }

      .chatify-agent-sender-name .chatify-human-tag {
        font-size: 9px;
        font-weight: 700;
        text-transform: uppercase;
        padding: 1px 5px;
        border-radius: 4px;
        background: var(--w-brand-a08);
        color: var(--w-brand);
      }

      .chatify-agent-sender-name .chatify-ai-tag {
        font-size: 9px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.03em;
        padding: 1px 5px;
        border-radius: 4px;
        background: var(--w-surface-2, rgba(99, 102, 241, 0.1));
        color: var(--w-ink-2);
        border: 1px solid var(--w-line);
      }

      .chatify-handover-email-form {
        display: flex;
        gap: 6px;
        margin-top: 8px;
      }

      .chatify-handover-email-input {
        flex: 1;
        min-width: 0;
        padding: 6px 9px;
        font-size: 12px;
        border-radius: 7px;
        border: 1px solid var(--w-line-2, var(--w-line));
        background: var(--w-surface);
        color: var(--w-ink);
        outline: none;
      }

      .chatify-handover-email-input:focus {
        border-color: var(--w-brand);
      }

      .chatify-handover-email-btn {
        padding: 6px 11px;
        font-size: 11.5px;
        font-weight: 600;
        border-radius: 7px;
        border: none;
        background: var(--w-brand);
        color: var(--w-on-brand);
        cursor: pointer;
        white-space: nowrap;
      }

      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after {
          animation-duration: .01ms !important;
          transition-duration: .01ms !important;
        }
      }
      ${this.designCSS()}
    `}bindPrechatHandlers(){this.shadow?.getElementById("chatifyStartBtn")?.addEventListener("click",()=>this.handleStartPreChat());let t=this.shadow?.getElementById("chatifyInputEmail"),r=this.shadow?.getElementById("chatifyInputName"),n=s=>{s.key==="Enter"&&(s.preventDefault(),this.handleStartPreChat())};t?.addEventListener("keydown",n),r?.addEventListener("keydown",n),t?.addEventListener("blur",()=>{t.value.trim()&&this.validatePrechatEmail()}),t?.addEventListener("input",()=>{t.getAttribute("aria-invalid")==="true"&&this.validatePrechatEmail()})}applyPrechatConfig(){let e=this.prechat;if(!e.enabled||mn(e)){if(!this.isPreChatCompleted){this.isPreChatCompleted=!0,this.shadow?.getElementById("chatifyPreChat")?.remove();let n=this.shadow?.getElementById("chatifyFooter");n&&(n.style.display="flex")}return}let t=this.shadow?.getElementById("chatifyPreChat");if(!t||this.isPreChatCompleted)return;let r=n=>n==="required"?'<span class="chatify-required-tag" style="color:#ef4444; font-weight:700;">*</span>':'<span class="chatify-optional-tag">(Optional)</span>';t.innerHTML=`
      <h4>${this.escapeHTML(e.title)}</h4>
      <p>${this.escapeHTML(e.intro)}</p>
      ${e.name!=="off"?`
      <div class="chatify-form-group">
        <label for="chatifyInputName">Your name ${r(e.name)}</label>
        <input type="text" id="chatifyInputName" class="chatify-input" placeholder="e.g. Sarah Khan" autocomplete="name" ${e.name==="required"?'required aria-required="true"':""} aria-describedby="chatifyNameError" />
        <div id="chatifyNameError" class="chatify-field-error" role="alert" aria-live="polite" style="display:none;"></div>
      </div>`:""}
      ${e.email!=="off"?`
      <div class="chatify-form-group">
        <label for="chatifyInputEmail">Email address ${r(e.email)}</label>
        <input type="email" id="chatifyInputEmail" class="chatify-input" placeholder="sarah@example.com" autocomplete="email" inputmode="email" ${e.email==="required"?'required aria-required="true"':""} aria-describedby="chatifyEmailError" />
        <div id="chatifyEmailError" class="chatify-field-error" role="alert" aria-live="polite" style="display:none;"></div>
      </div>`:""}
      ${e.topics.length?`
      <div class="chatify-form-group">
        <label for="chatifyInputTopic">What is it about? ${r(e.topic_required?"required":"optional")}</label>
        <select id="chatifyInputTopic" class="chatify-input" ${e.topic_required?'required aria-required="true"':""} aria-describedby="chatifyTopicError">
          <option value="">Choose a topic</option>
          ${e.topics.map(n=>`<option value="${this.escapeHTML(n)}">${this.escapeHTML(n)}</option>`).join("")}
        </select>
        <div id="chatifyTopicError" class="chatify-field-error" role="alert" aria-live="polite" style="display:none;"></div>
      </div>`:""}
      <button class="chatify-start-btn" id="chatifyStartBtn">Start conversation</button>
    `,this.bindPrechatHandlers()}setPrechatError(e,t,r){let n=this.shadow?.getElementById(e),s=this.shadow?.getElementById(t);n?.classList.toggle("chatify-input-invalid",!!r),n?.setAttribute("aria-invalid",r?"true":"false"),s&&(s.textContent=r,s.style.display=r?"block":"none")}validatePrechatEmail(){let e=this.shadow?.getElementById("chatifyInputEmail");if(!e||this.prechat.email==="off")return!0;let t=this.shadow?.getElementById("chatifyEmailError"),r=(e?.value||"").trim(),s=r?/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(r)?"":"That doesn't look like a valid email \u2014 try name@company.com.":this.prechat.email==="required"?"Please enter your email so we can follow up.":"";return e&&(e.classList.toggle("chatify-input-invalid",!!s),e.setAttribute("aria-invalid",s?"true":"false")),t&&(t.textContent=s,t.style.display=s?"block":"none"),!s}async handleStartPreChat(){let e=this.shadow?.getElementById("chatifyInputName"),t=this.shadow?.getElementById("chatifyInputEmail"),r=this.shadow?.getElementById("chatifyInputTopic"),n=(t?.value||"").trim(),s=(e?.value||"").trim(),a=(r?.value||"").trim(),o=!!e&&this.prechat.name==="required"&&!s;this.setPrechatError("chatifyInputName","chatifyNameError",o?"Please tell us your name.":"");let c=this.validatePrechatEmail(),l=!!r&&this.prechat.topic_required&&!a;if(this.setPrechatError("chatifyInputTopic","chatifyTopicError",l?"Please choose a topic.":""),o)return e?.focus();if(!c)return t?.focus();if(l)return r?.focus();this.visitorName=s||this.visitorName,this.visitorEmail=n||this.visitorEmail;let h=this.config.workspaceId?`_${this.config.workspaceId.slice(0,8)}`:"";try{this.visitorName&&(localStorage.setItem(`zentry_visitor_name${h}`,this.visitorName),localStorage.setItem(`chatify_visitor_name${h}`,this.visitorName)),this.visitorEmail&&(localStorage.setItem(`zentry_visitor_email${h}`,this.visitorEmail),localStorage.setItem(`chatify_visitor_email${h}`,this.visitorEmail)),localStorage.setItem(`zentry_prechat_done${h}`,"1")}catch{}try{await this.saveVisitorDetails(null)}catch(p){console.warn("[Zen-try] Visitor details not saved:",i.errorText(p))}this.isPreChatCompleted=!0,this.shadow?.getElementById("chatifyPreChat")?.remove();let d=this.shadow?.getElementById("chatifyFooter");d&&(d.style.display="flex");let f=await this.ensureConversation();if(a&&f)try{this.legacyData?await this.supabase.rpc("fn_set_conversation_topic",{p_conversation_id:f,p_visitor_id:this.visitorId,p_topic:a}):await this.widgetRpc("fn_widget_set_topic",{p_conversation_id:f,p_topic:a})}catch{}let u=!this.legacyData;if(this.legacyData){let{data:p}=await this.supabase.from("messages").select("id").eq("conversation_id",f).limit(1);u=!p||p.length===0}if(u){let p=(this.config.businessName||this.config.title||"our company").replace(/^Welcome to\s+/i,"").replace(/\s*Support\s*$/i,"").replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}️]+\s*$/u,"").replace(/^the\s+/i,"").trim()||this.config.businessName||this.config.title||"our company",m=this.config.welcomeText?.trim(),y=m?m.charAt(0).toUpperCase()+m.slice(1):`Welcome to ${p}`,g=null;if(this.legacyData)g=(await this.supabase.from("messages").insert({conversation_id:f,sender_type:"agent",content:y,is_internal:!1,metadata:{is_welcome:!0}}).select().single()).data;else try{g=await this.widgetRpc("fn_widget_welcome",{p_conversation_id:f,p_content:y})}catch{}g&&!this.messages.some(v=>v.id===g.id)&&this.messages.push(g)}this.renderMessages()}async handleSendMessage(){let e=this.shadow?.getElementById("chatifyTextarea"),t=this.shadow?.getElementById("chatifySendBtn");if(!e)return;let r=e.value.trim();if(!r&&!this.pendingAttachment)return;let n=null;if(this.pendingAttachment){t&&(t.disabled=!0,t.innerHTML='<span style="width:16px;height:16px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;display:inline-block;animation:chatifySpin 0.8s linear infinite;"></span>'),this.setAttachmentState("sending","Sending picture\u2026");try{n=await pn(this.pendingAttachment.file,this.config.apiUrl||"",{visitorId:this.visitorId,visitorToken:this.visitorToken})}catch(s){this.setAttachmentState("failed",s?.message||"Couldn't send the picture. Check your connection and try again."),t&&(t.disabled=!1,t.innerHTML='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>');return}finally{t&&(t.disabled=!1,t.innerHTML='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>')}}e.value="",this.adjustTextareaHeight(),this.clearPendingAttachment(),await this.sendMessage(r,n||void 0)}renderMessages(){let e=this.shadow?.getElementById("chatifyBody");if(!e||!this.isPreChatCompleted)return;let t=document.createElement("div"),r=[{label:"\u{1F4B0} Pricing & Plans",value:"What are your pricing plans and features?"},{label:"\u26A1 How it works",value:"How does the AI assistant and live chat work?"},{label:"\u{1F680} Getting Started",value:"How can I set up the chat widget on my website?"},{label:"\u{1F510} Security & Privacy",value:"How do you handle data privacy and security?"},{label:"\u{1F9D1}\u200D\u{1F4BC} Talk to a person",value:"I want to speak with a team member."}];if(this.messages.length===0){let h=document.createElement("div");h.style.cssText="text-align:center; margin:auto 0; padding:0 18px;",h.innerHTML='<p style="color:var(--w-ink); font-size:15px; font-weight:600; letter-spacing:-.012em; margin-bottom:5px;">How can we help?</p><p style="color:var(--w-ink-2); font-size:13px; line-height:1.55; margin-bottom:14px;">Pick a topic below for instant answers, or type your question.</p>';let d=document.createElement("div");d.className="chatify-quick-replies",d.style.cssText="justify-content:center; max-width:100%; margin:0 auto;",r.forEach(f=>{let u=document.createElement("button");u.type="button",u.className="chatify-qr-btn",u.textContent=f.label,u.addEventListener("click",()=>{this.sendMessage(f.value||f.label)}),d.appendChild(u)}),h.appendChild(d),t.appendChild(h),this.commitMessages(e,t),this.renderRecentConversation();return}let n=null,s=[...this.messages].reverse().find(h=>h.sender_type==="ai"&&!h.is_internal)?.id??null;this.messages.forEach(h=>{if(h.is_internal)return;if(this.isHandoverMessage(h)){n=null;let R=(h.content||"").replace(/\n*🔄\s*(?:Connecting you with|Main aapko|میں آپ کو).*$/i,"").trim();if(R&&R!=="We've passed this to our team."){let H=document.createElement("div");H.className="chatify-message-row";let te=document.createElement("div");te.className="chatify-msg-agent";let _=new Date(h.created_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});te.innerHTML=`<div class="chatify-msg-text chatify-msg-rich">${this.formatChatMarkdown(R)}</div><div class="chatify-msg-time">${_}</div>`,H.appendChild(te),t.appendChild(H)}t.appendChild(this.renderHandoverCard(h));return}if(h.metadata?.system_event==="rate_limit"){let R=document.createElement("div");R.className="chatify-system-line",R.textContent=h.content||"You're sending messages too fast. Please wait a moment.",t.appendChild(R);return}if(h.sender_type==="system"){let R=h.metadata||{};if(R.system_event==="agent_joined"){let H=R.assigned_agent_name||null;t.appendChild(this.renderAgentJoinedLine({name:H,avatar:R.assigned_agent_avatar||null},h.created_at)),n=H||"";return}if(h.content){let H=document.createElement("div");H.className="chatify-system-line",H.textContent=h.content,t.appendChild(H)}return}let f=h.metadata?.system_event;if(f==="returned_to_ai"||f==="return_to_ai"){let R=document.createElement("div");R.className="chatify-system-line",R.textContent="Returned to AI assistant",t.appendChild(R);return}let u=h.sender_type==="visitor",p=new Date(h.created_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}),m=document.createElement("div");m.className="chatify-message-row";let y=document.createElement("div");y.className=u?"chatify-msg-visitor":"chatify-msg-agent";let g="";if(this.isHumanReply(h)){let R=this.humanSenderOf(h);(R.name||"")!==n&&(t.appendChild(this.renderAgentJoinedLine(R,h.created_at)),n=R.name||""),g=`<div class="chatify-agent-sender-name"><span>${this.escapeHTML(R.name||"Support")}</span><span class="chatify-human-tag">Agent</span></div>`}else if(!u&&(h.sender_type==="ai"||h.metadata?.is_welcome)){let R=(this.config.businessName||this.config.title||"Support").trim();g=`<div class="chatify-agent-sender-name"><span>${this.escapeHTML(R)}</span><span class="chatify-ai-tag">AI Assistant</span></div>`}let v="",w=h.reply_to_message_id&&h.sender_type!=="ai"?this.messages.find(R=>R.id===h.reply_to_message_id):null,T=w?`<div class="chatify-msg-quote"><span class="chatify-msg-quote-who">${w.sender_type==="visitor"?"You":"Support"}</span><span class="chatify-msg-quote-text">${this.escapeHTML(w.content.length>120?`${w.content.slice(0,120)}\u2026`:w.content)}</span></div>`:"",L="";if(h.attachment_url){let R=this.safeUrl(h.attachment_url);R&&(this.isImageAttachment(h.attachment_url)?L=`<div class="chatify-msg-attachment"><img src="${R}" alt="Attachment" class="chatify-msg-img" /></div>`:L=`<div class="chatify-msg-attachment"><a href="${R}" target="_blank" rel="noopener noreferrer" class="chatify-msg-doc">\u{1F4C4} <span>View Document</span></a></div>`)}let P=!!h.metadata?.is_edited?'<span style="font-size:10px;font-style:italic;opacity:0.75;margin-left:4px;">(edited)</span>':"",Q=!u&&h.metadata?.translation?.translated_text?h.metadata.translation.translated_text:!u&&h.metadata?.translated_text?h.metadata.translated_text:h.content;y.innerHTML=g+T+L+(Q?u?`<div class="chatify-msg-text">${this.linkifyHTML(Q)}</div>`:`<div class="chatify-msg-text chatify-msg-rich">${this.formatChatMarkdown(Q)}</div>`:"")+`<div class="chatify-msg-time">${p}${P}${v}</div>`;let q=y.querySelector(".chatify-msg-img");if(q&&h.attachment_url&&q.addEventListener("click",()=>{this.openLightbox(h.attachment_url)}),m.appendChild(y),t.appendChild(m),!u){if((!!(h.metadata?.handoff_offered||h.metadata?.offer_handoff||h.metadata?.action==="offer_handoff")||this.handoffStatus==="handoff_offered"&&h.sender_type==="ai"&&h.id===s)&&(this.handoffStatus==="bot_active"||this.handoffStatus==="handoff_offered")){let _=document.createElement("button");_.type="button",_.className="chatify-handoff-action-btn",_.innerHTML='<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg><span>Connect to agent</span>',_.addEventListener("click",()=>{this.requestHandoff(_)}),y.appendChild(_)}let H=h.metadata?.quick_replies,te=H&&H.length>0?H:h.metadata?.is_welcome?r:null;if(te&&te.length>0&&!this.messages.some(k=>k.sender_type==="visitor"&&!k.pending&&k.created_at>h.created_at)){let k=document.createElement("div");k.className="chatify-quick-replies",te.slice(0,5).forEach(S=>{let A=document.createElement("button");A.type="button",A.className="chatify-qr-btn",A.textContent=S.label,A.addEventListener("click",()=>{let U=this.shadow?.getElementById("chatifyTextarea");U&&(U.value="",this.adjustTextareaHeight()),this.sendMessage(S.value||S.label)}),k.appendChild(A)}),t.appendChild(k)}}}),!this.messages.some(h=>!h.is_internal&&this.isHandoverMessage(h))&&(this.handoffStatus==="waiting_for_agent"||this.handoffStatus==="offline_queued")&&t.appendChild(this.renderHandoverCard());let o=this.conversationStatus==="closed";if(o){let h=document.createElement("div");h.className="chatify-closed-notice",h.textContent="This conversation was closed",t.appendChild(h)}if(this.conversationStatus==="closed"&&!this.csatRated){let h=document.createElement("div");h.className="chatify-csat-box",h.innerHTML=`
        <div class="chatify-csat-title">How was your support experience?</div>
        <div class="chatify-csat-sub">Please rate the support you received:</div>
        <div class="chatify-csat-choices">
          <button type="button" class="chatify-csat-choice-btn" data-rating="good">
            <span>\u{1F44D}</span><span>Good</span>
          </button>
          <button type="button" class="chatify-csat-choice-btn" data-rating="bad">
            <span>\u{1F44E}</span><span>Bad</span>
          </button>
        </div>
        <div class="chatify-csat-comment-wrap" style="display: none;">
          <textarea class="chatify-csat-comment-input" placeholder="Add an optional comment..."></textarea>
          <button type="button" class="chatify-csat-submit-btn">Submit feedback</button>
        </div>
      `;let d=null,f=h.querySelectorAll(".chatify-csat-choice-btn"),u=h.querySelector(".chatify-csat-comment-wrap"),p=h.querySelector(".chatify-csat-comment-input"),m=h.querySelector(".chatify-csat-submit-btn");f.forEach(y=>{y.addEventListener("click",g=>{let v=g.currentTarget.getAttribute("data-rating");d=v,f.forEach(w=>{w.classList.remove("selected-good","selected-bad")}),y.classList.add(v==="good"?"selected-good":"selected-bad"),u&&(u.style.display="flex")})}),m&&m.addEventListener("click",()=>{if(!d)return;let y=p?p.value.trim():"";this.submitCSAT(d,y)}),t.appendChild(h)}else if(this.csatRated){let h=document.createElement("div");h.style.cssText="text-align:center; padding:12px; font-size:12.5px; color:var(--w-success); font-weight:600;",h.textContent="\u2713 Thank you for rating our support!",t.appendChild(h)}if(o){let h=document.createElement("button");h.type="button",h.className="chatify-new-conversation-btn",h.textContent="Start a new conversation",h.addEventListener("click",()=>this.startNewConversation()),t.appendChild(h)}if(this.botTyping||this.agentTyping){let h=document.createElement("div");h.className="chatify-message-row",h.innerHTML='<div class="chatify-msg-agent chatify-typing" aria-label="Typing"><span></span><span></span><span></span></div>',t.appendChild(h)}let c=null;for(let h=this.messages.length-1;h>=0;h--){let d=this.messages[h];if(this.isHumanReply(d)){c=this.humanSenderOf(d);break}}let l=this.shadow?.getElementById("chatifyHeaderSubtitle");if(!c&&this.isWaitingForAgent()&&l&&(l.textContent="Connecting you to the team\u2026"),c){let h=this.shadow?.getElementById("chatifyHeaderTitle"),d=this.shadow?.getElementById("chatifyHeaderAvatar");if(h&&(h.textContent=c.name||"Support team"),l&&(l.textContent="Support Specialist \xB7 Online"),d&&c.avatar){let f=this.safeUrl(c.avatar,!0);f&&(d.innerHTML=`<img src="${f}" alt="${this.escapeHTML(c.name||"Support team")}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`)}}this.commitMessages(e,t),this.renderRecentConversation()}commitMessages(e,t){let r=t.innerHTML;if(r===this.lastMessagesHtml&&this.lastMessagesTail&&this.lastMessagesTail.parentNode===e)return;let n=this.messages[this.messages.length-1],s=n?n.id:null,a=!!(n&&n.sender_type==="visitor"&&s!==this.lastMessageId),o=e.scrollHeight-e.scrollTop-e.clientHeight<120,c=!this.lastMessagesTail,l=e.scrollTop;e.replaceChildren(...Array.from(t.childNodes)),this.lastMessagesHtml=r,this.lastMessagesTail=e.lastChild,this.lastMessageId=s,e.scrollTop=c||o||a?e.scrollHeight:l}renderTicks(e){let t='<path d="M1 5.2 3.4 7.6 9 2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',r='<path d="M1 5.2 3.4 7.6 9 2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M5.5 5.2 7.9 7.6 13.5 2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>';return e.pending?'<span class="chatify-tick" title="Sending"><svg viewBox="0 0 14 10" width="15" height="11"><circle cx="5" cy="5" r="3.6" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M5 3v2.2l1.5.9" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg></span>':e.read_at?'<span class="chatify-tick chatify-tick-read" title="Read"><svg viewBox="0 0 14 10" width="15" height="11">'+r+"</svg></span>":e.delivered_at?'<span class="chatify-tick" title="Delivered"><svg viewBox="0 0 14 10" width="15" height="11">'+r+"</svg></span>":'<span class="chatify-tick" title="Sent"><svg viewBox="0 0 14 10" width="15" height="11">'+t+"</svg></span>"}unescapeHTML(e){return e.replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#0?39;/g,"'").replace(/&amp;/g,"&")}linkifyHTML(e){return gn(e).map(t=>t.href?`<a href="${this.escapeHTML(t.href)}"${t.href.startsWith("mailto:")?"":' target="_blank"'} rel="noopener noreferrer">${this.escapeHTML(t.text)}</a>`:this.escapeHTML(t.text)).join("")}escapeHTML(e){return e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;")}safeUrl(e,t=!1){if(!e)return"";let r=e.trim();return/^https?:\/\/[^\s"'<>]+/i.test(r)?this.escapeHTML(r):/^\/help\/[a-zA-Z0-9_.\-\/]+$/i.test(r)?this.escapeHTML(r):t&&/^data:image\/(?:png|jpe?g|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=]+$/i.test(r)?this.escapeHTML(r):""}toggleWindow(){this.isOpen=!this.isOpen;let e=this.config.workspaceId?`_${this.config.workspaceId.slice(0,8)}`:"";try{sessionStorage.setItem(`zentry_widget_open${e}`,this.isOpen?"1":"0"),sessionStorage.setItem(`chatify_widget_open${e}`,this.isOpen?"1":"0")}catch{}let t=this.shadow?.getElementById("chatifyWindow"),r=this.shadow?.getElementById("chatifyIconOpen"),n=this.shadow?.getElementById("chatifyIconClose"),s=this.shadow?.getElementById("zentryLauncherBtn")||this.shadow?.getElementById("chatifyLauncherBtn");s&&s.classList.toggle("widget-is-open",this.isOpen),this.container&&this.container.classList.toggle("widget-is-open",this.isOpen),t&&r&&n&&(this.isOpen?(this.hideMessagePopup(!1),t.style.display="flex",this.loadPreviousConversations(),r.style.display="none",n.style.display="block",this.activeTab==="home"&&Mi(this.config.widgetDesign)&&this.switchTab("messages"),this.activeTab==="messages"?(this.unreadCount=0,this.updateUnreadBadge(),this.markMessagesAsRead(),this.scrollToBottom(!1),this.adjustTextareaHeight(),setTimeout(()=>{this.shadow?.getElementById("chatifyTextarea")?.focus({preventScroll:!0})},100)):this.updateUnreadBadge()):(t.style.display="none",r.style.display="flex",n.style.display="none",this.closeEmojiPicker(),this.updateUnreadBadge()))}updateUnreadBadge(){let e=this.shadow?.getElementById("chatifyBadge"),t=this.shadow?.getElementById("navMsgBadge"),r=this.shadow?.getElementById("homeCardUnreadPill"),n=this.shadow?.getElementById("homeCardCtaBadge"),s=this.shadow?.getElementById("homeCardTitle");if((this.shadow?.getElementById("zentryLauncherBtn")||this.shadow?.getElementById("chatifyLauncherBtn"))?.classList.toggle("has-unread",this.unreadCount>0),this.unreadCount>0){let o=this.unreadCount>9?"9+":this.unreadCount.toString();e&&(e.textContent=o,e.style.display="flex"),t&&(t.textContent=o,t.style.display="flex"),r&&(r.textContent=`${this.unreadCount} new ${this.unreadCount===1?"message":"messages"}`,r.style.display="inline-flex"),n&&(n.textContent=o,n.style.display="inline-flex"),s&&(s.textContent=this.unreadCount===1?"You have 1 new reply":`You have ${this.unreadCount} new replies`)}else e&&(e.style.display="none"),t&&(t.style.display="none"),r&&(r.style.display="none"),n&&(n.style.display="none"),s&&(s.textContent="Chat with us");this.renderRecentConversation()}formatRelativeTime(e){let r=Math.floor((new Date().getTime()-e.getTime())/1e3);if(r<60)return"Just now";let n=Math.floor(r/60);if(n<60)return`${n}m ago`;let s=Math.floor(n/60);if(s<24)return`${s}h ago`;let a=Math.floor(s/24);return a===1?"Yesterday":a<7?`${a}d ago`:e.toLocaleDateString([],{month:"short",day:"numeric"})}renderRecentConversation(){let e=this.shadow?.getElementById("cardOpenConv"),t=this.shadow?.getElementById("cardStartChat"),r=this.shadow?.getElementById("openConvSnippet"),n=this.shadow?.getElementById("openConvSender"),s=this.shadow?.getElementById("openConvTime"),a=this.shadow?.getElementById("openConvUnreadPill"),o=this.shadow?.getElementById("openConvCtaBadge"),c=!!(this.messages&&this.messages.length>0);if(!this.conversationId||!c){e&&(e.style.display="none"),t&&(t.style.display="block");return}e&&(e.style.display="block"),t&&(t.style.display="none");let l=[...this.messages].reverse().find(h=>!h.is_internal);if(l){let h=(l.content||"").replace(/^#{1,6}\s+/gm,"").replace(/^\s*[-*•]\s+/gm,"").replace(/\*\*|__|`/g,"").replace(/\s+/g," ").trim();l.attachment_url&&(h=h?`\u{1F4F7} ${h}`:"\u{1F4F7} Sent a picture"),r&&(r.textContent=h||"Active conversation"),n&&(l.sender_type==="visitor"?n.textContent="You":l.sender_type==="ai"?n.textContent="AI Assistant":n.textContent=this.config.title||"Support Team"),s&&l.created_at&&(s.textContent=this.formatRelativeTime(new Date(l.created_at)))}this.unreadCount>0?(a&&(a.textContent=`${this.unreadCount} new`,a.style.display="inline-flex"),o&&(o.textContent=this.unreadCount>9?"9+":this.unreadCount.toString(),o.style.display="inline-flex")):(a&&(a.style.display="none"),o&&(o.style.display="none"))}scrollToBottom(e=!1){let t=this.shadow?.getElementById("chatifyBody");if(!t)return;let r=()=>{e&&typeof t.scrollTo=="function"?t.scrollTo({top:t.scrollHeight,behavior:"smooth"}):t.scrollTop=t.scrollHeight};r(),requestAnimationFrame(()=>r()),setTimeout(r,50),setTimeout(r,200),t.querySelectorAll("img").forEach(s=>{s.complete||(s.addEventListener("load",()=>r(),{once:!0}),s.addEventListener("error",()=>r(),{once:!0}))})}open(e){this.hideMessagePopup(!1),this.isOpen||this.toggleWindow(),e&&this.switchTab(e),this.activeTab==="messages"&&this.scrollToBottom(!1)}close(){this.isOpen&&this.toggleWindow()}toggle(){this.toggleWindow()}openHelp(){if(this.config.showHelpTab===!1||this.faqs.length===0){this.open("home");return}this.open("help"),setTimeout(()=>{this.shadow?.getElementById("helpSearchInput")?.focus({preventScroll:!0})},120)}openMessages(){this.open("messages")}getIsOpen(){return this.isOpen}getBrandInitial(){return((this.config.businessName||this.config.title||"Support").replace(/^Welcome to\s+/i,"").replace(/\s*Support\s*$/i,"").replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}️]+\s*$/u,"").replace(/^the\s+/i,"").trim().charAt(0)||"S").toUpperCase()}renderBrandAvatarHTML(e=!1){let t=this.getBrandInitial(),r=e?'<span class="chatify-online-dot"></span>':"",n=this.safeUrl(this.config.logoUrl,!0);return n?`
        <img src="${n}" alt="Logo" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;" onerror="this.style.display='none';if(this.nextElementSibling){this.nextElementSibling.style.display='flex';}" />
        <span class="chatify-avatar-initial" style="display:none;width:100%;height:100%;border-radius:inherit;background:var(--w-brand);color:var(--w-on-brand);align-items:center;justify-content:center;font-weight:700;font-size:inherit;">${this.escapeHTML(t)}</span>
        ${r}
      `:`
      <span class="chatify-avatar-initial" style="display:flex;width:100%;height:100%;border-radius:inherit;background:var(--w-brand);color:var(--w-on-brand);align-items:center;justify-content:center;font-weight:700;font-size:inherit;">${t}</span>
      ${r}
    `}hasHostModalOrOverlay(){if(typeof document>"u")return!1;try{let e=document.querySelectorAll('dialog[open], [role="dialog"], [role="alertdialog"], [aria-modal="true"]');for(let n=0;n<e.length;n++){let s=e[n];if(this.container&&(s===this.container||this.container.contains(s)))continue;let a=window.getComputedStyle(s);if(a.display!=="none"&&a.visibility!=="hidden"&&a.opacity!=="0"){let o=s.getBoundingClientRect();if(o.width>0&&o.height>0)return!0}}let t=window.innerWidth||document.documentElement.clientWidth||0,r=window.innerHeight||document.documentElement.clientHeight||0;if(t>0&&r>0){let n=document.querySelectorAll('div, section, aside, [class*="modal"], [class*="overlay"], [class*="backdrop"]');for(let s=0;s<n.length;s++){let a=n[s];if(this.container&&(a===this.container||this.container.contains(a)))continue;let o=window.getComputedStyle(a);if((o.position==="fixed"||o.position==="absolute")&&o.display!=="none"&&o.visibility!=="hidden"&&parseFloat(o.opacity||"1")>.05){let l=a.getBoundingClientRect();if(l.width>=t*.7&&l.height>=r*.7)return!0}}}}catch{}return!1}initProactiveWelcome(){if(this.config.enableProactiveWelcome===!1)return;let e=Math.max(8,this.config.proactiveDelaySeconds||8);setTimeout(()=>{if(this.isOpen||this.messages.length>0)return;try{if(sessionStorage.getItem("zentry_proactive_welcome_dismissed")==="1"||sessionStorage.getItem("chatify_proactive_welcome_dismissed")==="1")return}catch{}if(this.hasHostModalOrOverlay())return;let t=(this.config.businessName||this.config.title||"Support").replace(/^Welcome to\s+/i,"").replace(/\s*Support\s*$/i,"").replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}️]+\s*$/u,"").replace(/^the\s+/i,"").trim()||"Support",r=this.config.welcomeText?.trim(),n=r?r.charAt(0).toUpperCase()+r.slice(1):`Welcome to ${t}`;this.showMessagePopup({id:"proactive-welcome",content:n},t)},e*1e3)}isHandoverMessage(e){let t=e.metadata;return t?.system_event==="handover"||t?.system_event?.type==="handover"||!!t?.handover}isHumanReply(e){return e.sender_type==="agent"&&!e.is_internal&&!e.metadata?.is_welcome&&!e.pending}humanSenderOf(e){let t=e.metadata,r=e.sender_id?this.workspaceAgents.find(n=>n.id===e.sender_id):void 0;return{name:t?.sender_name||r?.name||null,avatar:t?.sender_avatar||r?.avatar_url||null}}isWaitingForAgent(){if(this.conversationStatus==="closed")return!1;for(let e=this.messages.length-1;e>=0;e--){let t=this.messages[e];if(this.isHumanReply(t))return!1;if(!t.is_internal&&this.isHandoverMessage(t))return!0}return!1}agentAvatarHtml(e){let t=this.safeUrl(e.avatar??e.avatar_url??null,!0);return t?`<img src="${t}" alt="" />`:this.escapeHTML(this.getSenderInitials(e.name||"Support"))}async requestHandoff(e){if(!(this.handoffConnecting||!this.conversationId)){this.handoffConnecting=!0,e&&(e.disabled=!0,e.textContent="Connecting...");try{let t=await this.widgetRpc("fn_widget_request_handoff",{p_conversation_id:this.conversationId});t&&t.ok?(this.handoffStatus=t.status||"waiting_for_agent",t.next_open?.label&&(this.nextOpenLabel=t.next_open.label)):e&&(e.disabled=!0,e.textContent="Our team is not available right now")}catch(t){console.error("[Zen-try] Error requesting handoff:",t)}finally{this.handoffConnecting=!1,this.renderMessages()}}}applyHandoffDetails(e){let t=e&&typeof e=="object"?e:{};if("estimated_wait_minutes"in t){let r=Number(t.estimated_wait_minutes);this.expectedWaitText=Number.isFinite(r)&&r>0?"~"+r+(r===1?" minute":" minutes"):null}"next_open_label"in t&&(this.nextOpenLabel=typeof t.next_open_label=="string"?t.next_open_label:null),typeof t.assigned_agent_name=="string"&&t.assigned_agent_name&&(this.assignedAgentName=t.assigned_agent_name),!this.visitorEmail&&typeof t.customer_email=="string"&&t.customer_email&&(this.visitorEmail=t.customer_email)}async toggleAiAssist(e){if(this.conversationId)try{let t=await this.widgetRpc("fn_widget_set_ai_assist",{p_conversation_id:this.conversationId,p_enabled:e});t?.ok&&(this.aiAssistEnabled=!!t.ai_assist,this.applyHandoffDetails(t.conversation)),this.renderMessages()}catch(t){console.error("[Zen-try] Error toggling AI assist:",t)}}async markIssueResolved(){if(this.conversationId)try{await this.widgetRpc("fn_widget_mark_resolved",{p_conversation_id:this.conversationId}),this.conversationStatus="closed",this.handoffStatus="resolved",this.renderMessages()}catch(e){console.error("[Zen-try] Error resolving conversation:",e)}}renderHandoverCard(e){let t=document.createElement("div");e&&t.setAttribute("data-handover-msg-id",e.id),t.setAttribute("role","status");let r=this.messages.some(u=>this.isHumanReply(u)&&(!e||u.created_at>e.created_at)),n=(this.visitorEmail||"").trim(),s=e?.metadata||{},a=s.assigned_agent_name||s.system_event?.agent_name||this.assignedAgentName||null,o=s.assigned_agent_avatar||s.system_event?.agent_avatar||null;if(r||this.handoffStatus==="agent_active"){let u=this.messages.find(y=>this.isHumanReply(y)&&(!e||y.created_at>e.created_at)),m=(u?this.humanSenderOf(u):null)?.name||a||"our support team";return t.className="chatify-handover-card connected",t.innerHTML='<div class="chatify-handover-accent-bar connected"></div><div class="chatify-handover-inner"><div class="chatify-handover-check" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></div><div class="chatify-handover-body"><div class="chatify-handover-header-row"><span class="chatify-handover-heading">Connected with '+this.escapeHTML(m)+'</span><span class="chatify-handover-status-pill connected"><span>Active</span></span></div><p class="chatify-handover-desc">You are now chatting live with a real team member.</p></div></div>',t}if(this.conversationStatus==="closed"||this.handoffStatus==="resolved")return t.className="chatify-handover-card waiting",t.innerHTML=`<div class="chatify-handover-accent-bar waiting"></div><div class="chatify-handover-inner"><div class="chatify-handover-body"><div class="chatify-handover-header-row"><span class="chatify-handover-heading">Handed over to support</span></div><p class="chatify-handover-desc">We've saved your request. Our team will follow up.`+(n?" Updates will be sent to <strong>"+this.escapeHTML(n)+"</strong>.":"")+"</p></div></div>",t;let c=this.handoffStatus==="offline_queued",l=this.checkIsOnline(),h=a?{name:a,avatar_url:o,status:"online"}:this.workspaceAgents.find(u=>u.status==="online")||this.workspaceAgents[0]||null,d="";if(h){let u=this.safeUrl(h.avatar_url,!0),p=this.escapeHTML(this.getSenderInitials(h.name||"Support"));d=u?'<div class="chatify-handover-avatar"><img src="'+u+'" alt="" /></div>':'<div class="chatify-handover-avatar">'+p+"</div>"}else d='<div class="chatify-handover-avatar"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg></div>';let f=n?'<div class="chatify-handover-email-notice"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg><span>Updates also sent to <strong>'+this.escapeHTML(n)+"</strong></span></div>":'<form class="chatify-handover-email-form"><span class="chatify-handover-email-prompt">Want an email if you step away?</span><div class="chatify-handover-email-row"><input type="email" class="chatify-handover-email-input" placeholder="Enter your email" required /><button type="submit" class="chatify-handover-email-btn">Notify me</button></div></form>';if(c){let u=!!(this.nextOpenLabel&&!/^as soon as/i.test(this.nextOpenLabel)),p=u?"We're away right now":"The team will get back to you",m=(u?"We'll be back "+this.escapeHTML(this.nextOpenLabel||"")+". ":"Everyone is busy at the moment. ")+(n?"You'll get our reply here and by email.":"You'll get our reply right here."),g='<div class="chatify-handover-actions">'+(this.aiAssistEnabled?'<div class="chatify-handover-ai-badge"><span>\u2728 AI Assist active</span><button type="button" class="chatify-handover-btn-link" id="chatifyPauseAiBtn">Pause</button></div>':'<button type="button" class="chatify-handover-btn-secondary" id="chatifyAskAiBtn">\u2728 Ask AI while you wait</button>')+'<button type="button" class="chatify-handover-btn-secondary" id="chatifyResolvedBtn">\u2713 My issue is solved</button></div>';t.className="chatify-handover-card waiting",t.innerHTML='<div class="chatify-handover-accent-bar waiting"></div><div class="chatify-handover-inner"><div class="chatify-handover-avatar-wrap">'+d+'<span class="chatify-handover-avatar-dot away"></span></div><div class="chatify-handover-body"><div class="chatify-handover-header-row"><span class="chatify-handover-heading">'+p+'</span><span class="chatify-handover-status-pill waiting"><span>'+(u?"Away":"In queue")+'</span></span></div><p class="chatify-handover-desc">'+m+"</p>"+f+g+"</div></div>",setTimeout(()=>{let v=t.querySelector("#chatifyAskAiBtn");v&&v.addEventListener("click",()=>this.toggleAiAssist(!0));let w=t.querySelector("#chatifyPauseAiBtn");w&&w.addEventListener("click",()=>this.toggleAiAssist(!1));let T=t.querySelector("#chatifyResolvedBtn");T&&T.addEventListener("click",()=>this.markIssueResolved())},0)}else{let u=a?"Connecting you to "+this.escapeHTML(a):"You're through to our team",p=this.expectedWaitText?"The team typically replies in "+this.escapeHTML(this.expectedWaitText)+". Stay here and someone will join this chat.":l?"Someone from the team will join this chat in a moment.":"We'll reply right here as soon as someone is free.";t.className="chatify-handover-card connecting",t.innerHTML='<div class="chatify-handover-accent-bar"></div><div class="chatify-handover-inner"><div class="chatify-handover-avatar-wrap">'+d+'<span class="chatify-handover-avatar-dot '+(l?"online":"away")+'"></span></div><div class="chatify-handover-body"><div class="chatify-handover-header-row"><span class="chatify-handover-heading">'+u+'</span><span class="chatify-handover-status-pill"><span class="chatify-status-pulse"></span><span>In queue</span></span></div><p class="chatify-handover-desc">'+p+"</p>"+f+"</div></div>"}if(!n){let u=t.querySelector(".chatify-handover-email-form"),p=t.querySelector(".chatify-handover-email-input");u&&p&&u.addEventListener("submit",m=>{m.preventDefault();let y=p.value.trim();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(y))return;this.visitorEmail=y;let g=this.config.workspaceId?"_"+this.config.workspaceId.slice(0,8):"";try{localStorage.setItem("zentry_visitor_email"+g,y),localStorage.setItem("chatify_visitor_email"+g,y)}catch{}this.saveVisitorDetails(null).catch(()=>{}),this.renderMessages()})}return t}renderAgentJoinedLine(e,t){let r=document.createElement("div");r.className="chatify-agent-joined",r.setAttribute("role","status");let n=new Date(t).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}),s=e.name?`<strong>${this.escapeHTML(e.name)}</strong> joined the conversation`:"A support agent joined the conversation";return r.innerHTML=`<span class="zentry-agent-joined chatify-agent-joined-avatar">${this.agentAvatarHtml(e)}<span class="zentry-agent-joined chatify-agent-joined-dot"></span></span><span class="zentry-agent-joined chatify-agent-joined-text">${s}<span class="zentry-agent-joined chatify-agent-joined-time"> \xB7 ${n}</span></span>`,r}getSenderInitials(e){if(!e)return"TD";let t=e.trim().split(/\s+/).filter(Boolean);return t.length===0?"TD":t.length===1?t[0].slice(0,2).toUpperCase():(t[0][0]+t[t.length-1][0]).toUpperCase()}showMessagePopup(e,t){if(this.isOpen||this.hasHostModalOrOverlay())return;let r=this.shadow?.getElementById("chatifyMessagePopup");if(!r)return;this.popupCloseTimer&&(clearTimeout(this.popupCloseTimer),this.popupCloseTimer=null),this.currentPopupMsgId=e.id||null;let n=t||this.config.businessName||this.config.title||"Trader Care Desk",s=this.getSenderInitials(n),a=this.shadow?.getElementById("chatifyPopupTitle");a&&(a.textContent=n);let o=this.shadow?.getElementById("chatifyPopupAvatar");if(o){let l=this.safeUrl(this.config.logoUrl,!0);if(l){let h=this.escapeHTML(s.replace(/['\\<>\r\n]/g,"").slice(0,10));o.innerHTML=`<img src="${l}" alt="Avatar" onerror="this.parentElement.textContent='${h}'" />`}else o.textContent=s}let c=this.shadow?.getElementById("chatifyPopupMessageText");c&&(c.textContent=e.content||(e.attachment_url?"Sent an attachment \u{1F4CE}":"New message")),r.classList.remove("closing"),r.style.display="flex"}hideMessagePopup(e=!0){let t=this.shadow?.getElementById("chatifyMessagePopup");if(!(!t||t.style.display==="none")){if(!e){t.style.display="none",t.classList.remove("closing");return}t.classList.add("closing"),this.popupCloseTimer&&clearTimeout(this.popupCloseTimer),this.popupCloseTimer=setTimeout(()=>{t.style.display="none",t.classList.remove("closing"),this.popupCloseTimer=null},200)}}dismissMessagePopup(){if(this.currentPopupMsgId)try{sessionStorage.setItem(`zentry_popup_dismissed_${this.currentPopupMsgId}`,"1"),sessionStorage.setItem(`zentry_popup_dismissed_${this.currentPopupMsgId}`,"1"),sessionStorage.setItem(`chatify_popup_dismissed_${this.currentPopupMsgId}`,"1")}catch{}try{sessionStorage.setItem("zentry_proactive_welcome_dismissed","1"),sessionStorage.setItem("zentry_proactive_welcome_dismissed","1"),sessionStorage.setItem("chatify_proactive_welcome_dismissed","1")}catch{}this.hideMessagePopup(!0)}async sendPopupReply(){let e=this.shadow?.getElementById("chatifyPopupInput"),t=this.shadow?.getElementById("chatifyPopupSendBtn"),r=e?.value.trim()||"";r&&(e&&(e.value=""),t?.classList.remove("active"),this.hideMessagePopup(!1),this.open("messages"),await this.sendMessage(r))}showPopup(e,t){this.showMessagePopup({id:"test-"+Date.now(),content:e||"Hi, how can we help?"},t||"Trader Care Desk")}hidePopup(){this.hideMessagePopup(!0)}subscribeToVisitorConversations(e){if(this.visitorId){if(!this.legacyData){this.startLiveUpdates();return}this.supabase.channel(`zen-try-visitor-convs-${this.visitorId}`).on("postgres_changes",{event:"INSERT",schema:"public",table:"conversations",filter:`visitor_id=eq.${this.visitorId}`},async t=>{let r=t.new;r?.id&&(!this.config.workspaceId||r.workspace_id===this.config.workspaceId)&&(this.conversationId=r.id,this.conversationStatus=r.status||"open",localStorage.setItem(`zentry_conversation_id${e}`,r.id),localStorage.setItem(`zentry_conversation_id${e}`,r.id),localStorage.setItem(`chatify_conversation_id${e}`,r.id),await this.loadMessageHistory(),this.subscribeToRealtime())}).subscribe()}}search(e){this.open("help"),this.activeSectionId=null,this.faqSearchQuery=(e||"").trim(),setTimeout(()=>{let t=this.shadow?.getElementById("helpSearchInput");t&&(t.value=e,t.focus()),this.renderFaqList()},100)}async openArticle(e){if(!e)return;this.open("help");let t=e.trim().toLowerCase(),r=this.faqs.find(n=>n.id&&n.id.toLowerCase()===t||n.slug&&n.slug.toLowerCase()===t);if(r){this.activeSectionId=r.sectionId||(this.sections.length>0?this.sections[0].id:null),this.faqSearchQuery="";let n=this.shadow?.getElementById("helpSearchInput");n&&(n.value=""),this.renderFaqList(),setTimeout(()=>{let s=this.shadow?.querySelectorAll(".zentry-faq-item, .chatify-faq-item"),a=null;if(s)for(let o=0;o<s.length;o++){let c=s[o],l=(c.getAttribute("data-id")||"").toLowerCase(),h=(c.getAttribute("data-slug")||"").toLowerCase();if(l===t||h===t){a=c;break}}if(a){let o=a;o.classList.contains("open")||o.classList.add("open"),o.scrollIntoView({behavior:"smooth",block:"center"})}},100)}}bindGlobalTriggers(){typeof document>"u"||document.addEventListener("click",e=>{let t=e.target;if(!t)return;if(t.closest("[data-orbat-help], [data-zentry-help], [data-chatify-help], .orbat-help-trigger, .zentry-help-trigger, .chatify-help-trigger")){if(e.preventDefault(),this.config.showHelpTab===!1||this.faqs.length===0)return;this.openHelp();return}let n=t.closest("[data-orbat-article], [data-zentry-article], [data-chatify-article]");if(n){e.preventDefault();let c=n.getAttribute("data-orbat-article")||n.getAttribute("data-zentry-article")||n.getAttribute("data-chatify-article")||"";c?this.openArticle(c):this.openHelp();return}let s=t.closest("[data-orbat-open], [data-zentry-open], [data-chatify-open], .orbat-open-trigger, .zentry-open-trigger, .chatify-open-trigger");if(s){e.preventDefault();let c=s.getAttribute("data-orbat-tab")||s.getAttribute("data-zentry-tab")||s.getAttribute("data-chatify-tab");this.open(c||"home");return}if(t.closest("[data-orbat-close], [data-zentry-close], [data-chatify-close]")){e.preventDefault(),this.close();return}if(t.closest("[data-orbat-toggle], [data-zentry-toggle], [data-chatify-toggle]")){e.preventDefault(),this.toggle();return}})}initNavbarAutoTrigger(){if(typeof document>"u"||typeof window>"u")return;let e=this.config.navbarTriggerConfig,t="#zentry-widget-root, #chatify-widget-root, #chatifyWidgetContainer, [data-zentry-root]",r="[data-zentry-nav], [data-chatify-nav]",n=()=>{document.querySelectorAll(r).forEach(_=>_.remove()),["zentryNavTriggerBtn","zentryNavTriggerBtnMobile","chatifyNavTriggerBtn","chatifyNavTriggerBtnMobile"].forEach(_=>document.getElementById(_)?.remove()),document.querySelectorAll("[data-zentry-hooked], [data-chatify-hooked]").forEach(_=>{_.removeAttribute("data-zentry-hooked"),_.removeAttribute("data-chatify-hooked")})},s=()=>{let _=this;_.__navObserver?.disconnect(),_.__navObserver=void 0};if(!e||e.enabled!==!0||document.querySelector("[data-zentry-no-nav]")){s(),n();return}let a=e.action||"help";if(a!=="messages"&&!(Array.isArray(this.faqs)&&this.faqs.length>0)){s(),n();return}let o=_=>_.toLowerCase().trim().replace(/^https?:\/\//,"").replace(/\/.*$/,"").replace(/^www\./,""),c=o(window.location.hostname),l=this.config.customDomain?o(this.config.customDomain):"";if(l&&c===l||/(^|\.)(zentryhelp|chatifyhelp)\.com$/.test(c)||window.location.pathname.toLowerCase().startsWith("/help/")){s(),n();return}let h=(this.config.apiUrl||we).replace(/\/$/,""),d=l?`https://${l}`:this.config.workspaceId?`${h}/help/${encodeURIComponent(this.config.workspaceId)}`:"",f=_=>{if(_.closest(r))return!1;let k=(_.getAttribute("href")||"").toLowerCase();return!k||k==="#"||k.startsWith("javascript:")?!1:l!==""&&k.includes(l)||this.config.workspaceId!==null&&k.includes(`/help/${this.config.workspaceId.toLowerCase()}`)||/zentryhelp\.com|chatifyhelp\.com/.test(k)};if(document.querySelector("[data-zentry-help]:not([data-zentry-nav]), [data-chatify-help]:not([data-chatify-nav]), .zentry-help-trigger, header [data-zentry-open], nav [data-zentry-open]")||Array.from(document.querySelectorAll('header a, nav a, [role="navigation"] a')).some(f)){s(),n();return}let u=(e.label||"Help").trim().slice(0,40);if(!u)return;let p=e.position==="start"?"start":"end",m=e.style==="pill"?"pill":"navbar_link",y=_=>!!_.closest(`${t}, footer, aside, [role="contentinfo"], [class*="footer" i], [id*="footer" i], [class*="sidebar" i]`),g=_=>Array.from(_.querySelectorAll("a[href]")).filter(k=>!k.closest(r)&&(k.textContent||"").trim().length>0&&(k.textContent||"").trim().length<=40),v=_=>{let k=window.getComputedStyle(_);return k.display==="none"||k.visibility==="hidden"},w=_=>{if(_.closest('header, [role="banner"]'))return!0;let k=_;for(;k&&k!==document.body;){let S=window.getComputedStyle(k).position;if(S==="fixed"||S==="sticky")return!0;k=k.parentElement}return!1},T=_=>w(_)||_.getBoundingClientRect().top+window.scrollY<260,L=_=>{let k=null,S=A=>{let U=Array.from(A.children).filter(C=>{if(!(C instanceof HTMLElement)||C.matches(r))return!1;let B=C.tagName.toLowerCase();return B==="a"?g(A).includes(C):B==="li"?!!C.querySelector("a[href]"):!1});U.length>=2&&(!k||U.length>k.items.length)&&(k={group:A,items:U})};return S(_),_.querySelectorAll("ul, ol, div, span").forEach(A=>{A.closest("ul ul, ol ol, li ul, li ol")||S(A)}),k},I=()=>{let _=e.target_selector?.trim();if(_)try{let C=document.querySelector(_);if(C&&!C.closest(t))return C}catch{}let k=Array.from(document.querySelectorAll('header nav, nav, [role="navigation"], header ul, .navbar, .navbar-nav, [class*="menu" i], [class*="nav" i]')).filter(C=>!y(C)&&!v(C)&&T(C)),S=new Set(k);document.querySelectorAll("a[href]").forEach(C=>{let B=C.parentElement;if(!B||S.has(B)||B===document.body||(S.add(B),y(B)||v(B)))return;g(B).filter(X=>X.parentElement===B&&!v(X)).length>=3&&(w(B)||B.getBoundingClientRect().top+window.scrollY<160)&&k.push(B)});let A=null,U=-1;for(let C of k){let B=g(C).filter(X=>!v(X));if(B.length<2||B.length>30)continue;let Z=Math.min(B.length,12)*3;(C.tagName==="NAV"||C.getAttribute("role")==="navigation")&&(Z+=10),C.closest('header, [role="banner"]')&&(Z+=15),/mobile|drawer|offcanvas/i.test(`${C.className} ${C.id}`)&&(Z-=25),(Z>U||Z===U&&A&&A.contains(C))&&(A=C,U=Z)}return A},P=_=>{let k=Array.from(document.querySelectorAll('[class*="mobile" i], [id*="mobile" i], [class*="drawer" i], [id*="drawer" i], [class*="offcanvas" i], [class*="off-canvas" i], [class*="hamburger" i] + *, [class*="responsive-menu" i]')).filter(S=>{if(y(S)||_&&(S===_||S.contains(_)||_.contains(S)))return!1;let A=`${typeof S.className=="string"?S.className:""} ${S.id}`;if(!S.closest('header, nav, [role="navigation"], [role="dialog"]')&&!/menu|nav|drawer|offcanvas|off-canvas/i.test(A))return!1;let U=g(S);return U.length>=2&&U.length<=30});return k.find(S=>!k.some(A=>A!==S&&S.contains(A)))||null},Q=/^(active|is-active|current|current-menu-item|current_page_item|selected|router-link-active|router-link-exact-active|aria-current)$/i,q=_=>_?Array.from(_.classList).filter(k=>!Q.test(k)&&!/active|current/i.test(k)).join(" "):"",R=(_,k)=>{let S=document.createElement("a");if(S.textContent=u,S.setAttribute("data-zentry-nav",k),S.setAttribute("data-chatify-nav",k),a==="redirect"&&/^https?:\/\/[^\s"'<>]+$/i.test(d)?(S.href=d,S.target="_blank",S.rel="noopener noreferrer"):(S.href="#",S.setAttribute("role","button"),S.addEventListener("click",A=>{A.preventDefault(),a==="messages"?this.openMessages():this.openHelp()})),m==="pill"){let A=/^#[0-9a-f]{3,8}$/i.test(this.config.primaryColor||"")?this.config.primaryColor:Xt;S.style.cssText=`display:inline-flex;align-items:center;justify-content:center;padding:${k==="mobile"?"6px 14px":"6px 16px"};font-size:14px;font-weight:600;line-height:1.4;border-radius:9999px;background:${A};color:#fff;text-decoration:none;cursor:pointer;white-space:nowrap;align-self:center;`}else if(_){S.className=q(_);try{let A=window.getComputedStyle(_);S.style.color=A.color,S.style.fontFamily=A.fontFamily,S.style.fontSize=A.fontSize,S.style.fontWeight=A.fontWeight,S.style.letterSpacing=A.letterSpacing,S.style.textTransform=A.textTransform,S.style.textDecoration="none",S.style.cursor="pointer"}catch{}}else S.style.cssText="display:inline-flex;align-items:center;font-size:14px;font-weight:500;color:inherit;text-decoration:none;cursor:pointer;padding:6px 12px;";return S},H=(_,k)=>{if(document.querySelector(`[data-zentry-nav="${k}"]`))return;let S=L(_),A=S?.group??_,U=S?.items??[],C=p==="start"?U[0]:U[U.length-1],B=C&&(C.tagName==="A"?C:C.querySelector("a[href]"))||g(_)[0]||null,Z=R(B,k),X=Z;if(C&&C.tagName==="LI"){let ie=document.createElement("li");ie.className=q(C),ie.setAttribute("data-zentry-nav",k),ie.setAttribute("data-chatify-nav",k),ie.appendChild(Z),X=ie}else if(A.tagName==="UL"||A.tagName==="OL"){let ie=document.createElement("li");ie.setAttribute("data-zentry-nav",k),ie.setAttribute("data-chatify-nav",k),ie.appendChild(Z),X=ie}C&&C.parentElement===A?p==="start"?A.insertBefore(X,C):C.after(X):p==="start"&&A.firstChild?A.insertBefore(X,A.firstChild):A.appendChild(X)},te=()=>{let _=I(),k=P(_);_&&H(_,"desktop"),k&&H(k,"mobile")};if(te(),typeof MutationObserver<"u"&&document.body){s();let _=null,k=new MutationObserver(()=>{_&&clearTimeout(_),_=setTimeout(()=>{(!document.querySelector('[data-zentry-nav="desktop"]')||!document.querySelector('[data-zentry-nav="mobile"]'))&&te()},300)});k.observe(document.body,{childList:!0,subtree:!0}),this.__navObserver=k}}};if(typeof window<"u"){let i=()=>{let r=[];return{q:r,open:(...s)=>r.push(["open",s]),close:(...s)=>r.push(["close",s]),toggle:(...s)=>r.push(["toggle",s]),openHelp:(...s)=>r.push(["openHelp",s]),openMessages:(...s)=>r.push(["openMessages",s]),openArticle:(...s)=>r.push(["openArticle",s]),search:(...s)=>r.push(["search",s]),isOpen:()=>!1,resetSession:()=>{},switchTab:(...s)=>r.push(["switchTab",s]),showPopup:(...s)=>r.push(["showPopup",s]),hidePopup:(...s)=>r.push(["hidePopup",s])}},e=window.Zentry||window["Zen-try"]||window.Chatify||i();window.OrbatAI=e,window.Orbat=e,window.Zentry=e,window["Zen-try"]=e,window.Chatify=e;let t=()=>{let r=new Bi;window.__ZentryInstance=r,window.__ChatifyInstance=r;let n=window.Zentry||window["Zen-try"]||window.Chatify,s=Array.isArray(n?.q)?n.q:Array.isArray(n)?n:[],a={open:o=>r.open(o),close:()=>r.close(),toggle:()=>r.toggle(),openHelp:()=>r.openHelp(),openMessages:()=>r.openMessages(),openArticle:o=>r.openArticle(o),search:o=>r.search(o),isOpen:()=>r.getIsOpen(),resetSession:()=>r.resetSession(),switchTab:o=>r.switchTab(o),showPopup:(o,c)=>r.showPopup(o,c),hidePopup:()=>r.hidePopup(),instance:r};if(window.OrbatAI=a,window.Orbat=a,window.Zentry=a,window["Zen-try"]=a,window.Chatify=a,s.length>0){for(let o of s)if(Array.isArray(o)){let[c,l=[]]=o;typeof a[c]=="function"&&a[c](...l)}else if(typeof o=="function")try{o(a)}catch{}}};document.readyState==="loading"?document.addEventListener("DOMContentLoaded",t):t()}})();
