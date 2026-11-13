"use strict";(()=>{var Ht=Object.defineProperty;var zt=(a,e)=>{for(var t in e)Ht(a,t,{get:e[t],enumerable:!0})};var q=Object.create(null);q.open="0";q.close="1";q.ping="2";q.pong="3";q.message="4";q.upgrade="5";q.noop="6";var ne=Object.create(null);Object.keys(q).forEach(a=>{ne[q[a]]=a});var ae={type:"error",data:"parser error"};var Ve=typeof Blob=="function"||typeof Blob<"u"&&Object.prototype.toString.call(Blob)==="[object BlobConstructor]",Qe=typeof ArrayBuffer=="function",Ge=a=>typeof ArrayBuffer.isView=="function"?ArrayBuffer.isView(a):a&&a.buffer instanceof ArrayBuffer,se=({type:a,data:e},t,i)=>Ve&&e instanceof Blob?t?i(e):We(e,i):Qe&&(e instanceof ArrayBuffer||Ge(e))?t?i(e):We(new Blob([e]),i):i(q[a]+(e||"")),We=(a,e)=>{let t=new FileReader;return t.onload=function(){let i=t.result.split(",")[1];e("b"+(i||""))},t.readAsDataURL(a)};function Ye(a){return a instanceof Uint8Array?a:a instanceof ArrayBuffer?new Uint8Array(a):new Uint8Array(a.buffer,a.byteOffset,a.byteLength)}var Ie;function Ze(a,e){if(Ve&&a.data instanceof Blob)return a.data.arrayBuffer().then(Ye).then(e);if(Qe&&(a.data instanceof ArrayBuffer||Ge(a.data)))return e(Ye(a.data));se(a,!1,t=>{Ie||(Ie=new TextEncoder),e(Ie.encode(t))})}var Je="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/",re=typeof Uint8Array>"u"?[]:new Uint8Array(256);for(let a=0;a<Je.length;a++)re[Je.charCodeAt(a)]=a;var Ke=a=>{let e=a.length*.75,t=a.length,i,n=0,s,r,o,l;a[a.length-1]==="="&&(e--,a[a.length-2]==="="&&e--);let h=new ArrayBuffer(e),c=new Uint8Array(h);for(i=0;i<t;i+=4)s=re[a.charCodeAt(i)],r=re[a.charCodeAt(i+1)],o=re[a.charCodeAt(i+2)],l=re[a.charCodeAt(i+3)],c[n++]=s<<2|r>>4,c[n++]=(r&15)<<4|o>>2,c[n++]=(o&3)<<6|l&63;return h};var Pt=typeof ArrayBuffer=="function",oe=(a,e)=>{if(typeof a!="string")return{type:"message",data:Xe(a,e)};let t=a.charAt(0);return t==="b"?{type:"message",data:Rt(a.substring(1),e)}:ne[t]?a.length>1?{type:ne[t],data:a.substring(1)}:{type:ne[t]}:ae},Rt=(a,e)=>{if(Pt){let t=Ke(a);return Xe(t,e)}else return{base64:!0,data:a}},Xe=(a,e)=>e==="blob"?a instanceof Blob?a:new Blob([a]):a instanceof ArrayBuffer?a:a.buffer;var et="",tt=(a,e)=>{let t=a.length,i=new Array(t),n=0;a.forEach((s,r)=>{se(s,!1,o=>{i[r]=o,++n===t&&e(i.join(et))})})},it=(a,e)=>{let t=a.split(et),i=[];for(let n=0;n<t.length;n++){let s=oe(t[n],e);if(i.push(s),s.type==="error")break}return i};function nt(){return new TransformStream({transform(a,e){Ze(a,t=>{let i=t.length,n;if(i<126)n=new Uint8Array(1),new DataView(n.buffer).setUint8(0,i);else if(i<65536){n=new Uint8Array(3);let s=new DataView(n.buffer);s.setUint8(0,126),s.setUint16(1,i)}else{n=new Uint8Array(9);let s=new DataView(n.buffer);s.setUint8(0,127),s.setBigUint64(1,BigInt(i))}a.data&&typeof a.data!="string"&&(n[0]|=128),e.enqueue(n),e.enqueue(t)})}})}var Ce;function ye(a){return a.reduce((e,t)=>e+t.length,0)}function ve(a,e){if(a[0].length===e)return a.shift();let t=new Uint8Array(e),i=0;for(let n=0;n<e;n++)t[n]=a[0][i++],i===a[0].length&&(a.shift(),i=0);return a.length&&i<a[0].length&&(a[0]=a[0].slice(i)),t}function at(a,e){Ce||(Ce=new TextDecoder);let t=[],i=0,n=-1,s=!1;return new TransformStream({transform(r,o){for(t.push(r);;){if(i===0){if(ye(t)<1)break;let l=ve(t,1);s=(l[0]&128)===128,n=l[0]&127,n<126?i=3:n===126?i=1:i=2}else if(i===1){if(ye(t)<2)break;let l=ve(t,2);n=new DataView(l.buffer,l.byteOffset,l.length).getUint16(0),i=3}else if(i===2){if(ye(t)<8)break;let l=ve(t,8),h=new DataView(l.buffer,l.byteOffset,l.length),c=h.getUint32(0);if(c>Math.pow(2,21)-1){o.enqueue(ae);break}n=c*Math.pow(2,32)+h.getUint32(4),i=3}else{if(ye(t)<n)break;let l=ve(t,n);o.enqueue(oe(s?l:Ce.decode(l),e)),i=0}if(n===0||n>a){o.enqueue(ae);break}}}})}var Se=4;function I(a){if(a)return qt(a)}function qt(a){for(var e in I.prototype)a[e]=I.prototype[e];return a}I.prototype.on=I.prototype.addEventListener=function(a,e){return this._callbacks=this._callbacks||{},(this._callbacks["$"+a]=this._callbacks["$"+a]||[]).push(e),this};I.prototype.once=function(a,e){function t(){this.off(a,t),e.apply(this,arguments)}return t.fn=e,this.on(a,t),this};I.prototype.off=I.prototype.removeListener=I.prototype.removeAllListeners=I.prototype.removeEventListener=function(a,e){if(this._callbacks=this._callbacks||{},arguments.length==0)return this._callbacks={},this;var t=this._callbacks["$"+a];if(!t)return this;if(arguments.length==1)return delete this._callbacks["$"+a],this;for(var i,n=0;n<t.length;n++)if(i=t[n],i===e||i.fn===e){t.splice(n,1);break}return t.length===0&&delete this._callbacks["$"+a],this};I.prototype.emit=function(a){this._callbacks=this._callbacks||{};for(var e=new Array(arguments.length-1),t=this._callbacks["$"+a],i=1;i<arguments.length;i++)e[i-1]=arguments[i];if(t){t=t.slice(0);for(var i=0,n=t.length;i<n;++i)t[i].apply(this,e)}return this};I.prototype.emitReserved=I.prototype.emit;I.prototype.listeners=function(a){return this._callbacks=this._callbacks||{},this._callbacks["$"+a]||[]};I.prototype.hasListeners=function(a){return!!this.listeners(a).length};var O=typeof Promise=="function"&&typeof Promise.resolve=="function"?e=>Promise.resolve().then(e):(e,t)=>t(e,0),M=typeof self<"u"?self:typeof window<"u"?window:Function("return this")(),st="arraybuffer";function we(a,...e){return e.reduce((t,i)=>(a.hasOwnProperty(i)&&(t[i]=a[i]),t),{})}var $t=M.setTimeout,Nt=M.clearTimeout;function j(a,e){e.useNativeTimers?(a.setTimeoutFn=$t.bind(M),a.clearTimeoutFn=Nt.bind(M)):(a.setTimeoutFn=M.setTimeout.bind(M),a.clearTimeoutFn=M.clearTimeout.bind(M))}var Ot=1.33;function rt(a){return typeof a=="string"?jt(a):Math.ceil((a.byteLength||a.size)*Ot)}function jt(a){let e=0,t=0;for(let i=0,n=a.length;i<n;i++)e=a.charCodeAt(i),e<128?t+=1:e<2048?t+=2:e<55296||e>=57344?t+=3:(i++,t+=4);return t}function be(){return Date.now().toString(36).substring(3)+Math.random().toString(36).substring(2,5)}function ot(a){let e="";for(let t in a)a.hasOwnProperty(t)&&(e.length&&(e+="&"),e+=encodeURIComponent(t)+"="+encodeURIComponent(a[t]));return e}function ct(a){let e={},t=a.split("&");for(let i=0,n=t.length;i<n;i++){let s=t[i].split("=");e[decodeURIComponent(s[0])]=decodeURIComponent(s.slice(1).join("="))}return e}var xe=class extends Error{constructor(e,t,i){super(e),this.description=t,this.context=i,this.type="TransportError"}},U=class extends I{constructor(e){super(),this.writable=!1,j(this,e),this.opts=e,this.query=e.query,this.socket=e.socket,this.supportsBinary=!e.forceBase64}onError(e,t,i){return super.emitReserved("error",new xe(e,t,i)),this}open(){return this.readyState="opening",this.doOpen(),this}close(){return(this.readyState==="opening"||this.readyState==="open")&&(this.doClose(),this.onClose()),this}send(e){this.readyState==="open"&&this.write(e)}onOpen(){this.readyState="open",this.writable=!0,super.emitReserved("open")}onData(e){let t=oe(e,this.socket.binaryType);this.onPacket(t)}onPacket(e){super.emitReserved("packet",e)}onClose(e){this.readyState="closed",super.emitReserved("close",e)}pause(e){}createUri(e,t={}){return e+"://"+this._hostname()+this._port()+this.opts.path+this._query(t)}_hostname(){let e=this.opts.hostname;return e.indexOf(":")===-1?e:"["+e+"]"}_port(){return this.opts.port&&(this.opts.secure&&Number(this.opts.port)!==443||!this.opts.secure&&Number(this.opts.port)!==80)?":"+this.opts.port:""}_query(e){let t=ot(e);return t.length?"?"+t:""}};var ce=class extends U{constructor(){super(...arguments),this._polling=!1}get name(){return"polling"}doOpen(){this._poll()}pause(e){this.readyState="pausing";let t=()=>{this.readyState="paused",e()};if(this._polling||!this.writable){let i=0;this._polling&&(i++,this.once("pollComplete",function(){--i||t()})),this.writable||(i++,this.once("drain",function(){--i||t()}))}else t()}_poll(){this._polling=!0,this.doPoll(),this.emitReserved("poll")}onData(e){let t=i=>{if(this.readyState==="opening"&&i.type==="open"&&this.onOpen(),i.type==="close")return this.onClose({description:"transport closed by the server"}),!1;this.onPacket(i)};it(e,this.socket.binaryType).forEach(t),this.readyState!=="closed"&&(this._polling=!1,this.emitReserved("pollComplete"),this.readyState==="open"&&this._poll())}doClose(){let e=()=>{this.write([{type:"close"}])};this.readyState==="open"?e():this.once("open",e)}write(e){this.writable=!1,tt(e,t=>{this.doWrite(t,()=>{this.writable=!0,this.emitReserved("drain")})})}uri(){let e=this.opts.secure?"https":"http",t=this.query||{};return this.opts.timestampRequests!==!1&&(t[this.opts.timestampParam]=be()),!this.supportsBinary&&!t.sid&&(t.b64=1),this.createUri(e,t)}};var lt=!1;try{lt=typeof XMLHttpRequest<"u"&&"withCredentials"in new XMLHttpRequest}catch{}var ht=lt;function Ut(){}var Ae=class extends ce{constructor(e){if(super(e),typeof location<"u"){let t=location.protocol==="https:",i=location.port;i||(i=t?"443":"80"),this.xd=typeof location<"u"&&e.hostname!==location.hostname||i!==e.port}}doWrite(e,t){let i=this.request({method:"POST",data:e});i.on("success",t),i.on("error",(n,s)=>{this.onError("xhr post error",n,s)})}doPoll(){let e=this.request();e.on("data",this.onData.bind(this)),e.on("error",(t,i)=>{this.onError("xhr poll error",t,i)}),this.pollXhr=e}},D=class a extends I{constructor(e,t,i){super(),this.createRequest=e,j(this,i),this._opts=i,this._method=i.method||"GET",this._uri=t,this._data=i.data!==void 0?i.data:null,this._create()}_create(){var e;let t=we(this._opts,"agent","pfx","key","passphrase","cert","ca","ciphers","rejectUnauthorized","autoUnref");t.xdomain=!!this._opts.xd;let i=this._xhr=this.createRequest(t);try{i.open(this._method,this._uri,!0);try{if(this._opts.extraHeaders){i.setDisableHeaderCheck&&i.setDisableHeaderCheck(!0);for(let n in this._opts.extraHeaders)this._opts.extraHeaders.hasOwnProperty(n)&&i.setRequestHeader(n,this._opts.extraHeaders[n])}}catch{}if(this._method==="POST")try{i.setRequestHeader("Content-type","text/plain;charset=UTF-8")}catch{}try{i.setRequestHeader("Accept","*/*")}catch{}(e=this._opts.cookieJar)===null||e===void 0||e.addCookies(i),"withCredentials"in i&&(i.withCredentials=this._opts.withCredentials),this._opts.requestTimeout&&(i.timeout=this._opts.requestTimeout),i.onreadystatechange=()=>{var n;i.readyState===3&&((n=this._opts.cookieJar)===null||n===void 0||n.parseCookies(i.getResponseHeader("set-cookie"))),i.readyState===4&&(i.status===200||i.status===1223?this._onLoad():this.setTimeoutFn(()=>{this._onError(typeof i.status=="number"?i.status:0)},0))},i.send(this._data)}catch(n){this.setTimeoutFn(()=>{this._onError(n)},0);return}typeof document<"u"&&(this._index=a.requestsCount++,a.requests[this._index]=this)}_onError(e){this.emitReserved("error",e,this._xhr),this._cleanup(!0)}_cleanup(e){if(!(typeof this._xhr>"u"||this._xhr===null)){if(this._xhr.onreadystatechange=Ut,e)try{this._xhr.abort()}catch{}typeof document<"u"&&delete a.requests[this._index],this._xhr=null}}_onLoad(){let e=this._xhr.responseText;e!==null&&(this.emitReserved("data",e),this.emitReserved("success"),this._cleanup())}abort(){this._cleanup()}};D.requestsCount=0;D.requests={};if(typeof document<"u"){if(typeof attachEvent=="function")attachEvent("onunload",dt);else if(typeof addEventListener=="function"){let a="onpagehide"in M?"pagehide":"unload";addEventListener(a,dt,!1)}}function dt(){for(let a in D.requests)D.requests.hasOwnProperty(a)&&D.requests[a].abort()}var Dt=(function(){let a=pt({xdomain:!1});return a&&a.responseType!==null})(),F=class extends Ae{constructor(e){super(e);let t=e&&e.forceBase64;this.supportsBinary=Dt&&!t}request(e={}){return Object.assign(e,{xd:this.xd},this.opts),new D(pt,this.uri(),e)}};function pt(a){let e=a.xdomain;try{if(typeof XMLHttpRequest<"u"&&(!e||ht))return new XMLHttpRequest}catch{}if(!e)try{return new M[["Active"].concat("Object").join("X")]("Microsoft.XMLHTTP")}catch{}}var ft=typeof navigator<"u"&&typeof navigator.product=="string"&&navigator.product.toLowerCase()==="reactnative",Be=class extends U{get name(){return"websocket"}doOpen(){let e=this.uri(),t=this.opts.protocols,i=ft?{}:we(this.opts,"agent","perMessageDeflate","pfx","key","passphrase","cert","ca","ciphers","rejectUnauthorized","localAddress","protocolVersion","origin","maxPayload","family","checkServerIdentity");this.opts.extraHeaders&&(i.headers=this.opts.extraHeaders);try{this.ws=this.createSocket(e,t,i)}catch(n){return this.emitReserved("error",n)}this.ws.binaryType=this.socket.binaryType,this.addEventListeners()}addEventListeners(){this.ws.onopen=()=>{this.opts.autoUnref&&this.ws._socket.unref(),this.onOpen()},this.ws.onclose=e=>this.onClose({description:"websocket connection closed",context:e}),this.ws.onmessage=e=>this.onData(e.data),this.ws.onerror=e=>this.onError("websocket error",e)}write(e){this.writable=!1;for(let t=0;t<e.length;t++){let i=e[t],n=t===e.length-1;se(i,this.supportsBinary,s=>{try{this.doWrite(i,s)}catch{}n&&O(()=>{this.writable=!0,this.emitReserved("drain")},this.setTimeoutFn)})}}doClose(){typeof this.ws<"u"&&(this.ws.onerror=()=>{},this.ws.close(),this.ws=null)}uri(){let e=this.opts.secure?"wss":"ws",t=this.query||{};return this.opts.timestampRequests&&(t[this.opts.timestampParam]=be()),this.supportsBinary||(t.b64=1),this.createUri(e,t)}},Le=M.WebSocket||M.MozWebSocket,W=class extends Be{createSocket(e,t,i){return ft?new Le(e,t,i):t?new Le(e,t):new Le(e)}doWrite(e,t){this.ws.send(t)}};var G=class extends U{get name(){return"webtransport"}doOpen(){try{this._transport=new WebTransport(this.createUri("https"),this.opts.transportOptions[this.name])}catch(e){return this.emitReserved("error",e)}this._transport.closed.then(()=>{this.onClose()}).catch(e=>{this.onError("webtransport error",e)}),this._transport.ready.then(()=>{this._transport.createBidirectionalStream().then(e=>{let t=at(Number.MAX_SAFE_INTEGER,this.socket.binaryType),i=e.readable.pipeThrough(t).getReader(),n=nt();n.readable.pipeTo(e.writable),this._writer=n.writable.getWriter();let s=()=>{i.read().then(({done:o,value:l})=>{o||(this.onPacket(l),s())}).catch(o=>{})};s();let r={type:"open"};this.query.sid&&(r.data=`{"sid":"${this.query.sid}"}`),this._writer.write(r).then(()=>this.onOpen())})})}write(e){this.writable=!1;for(let t=0;t<e.length;t++){let i=e[t],n=t===e.length-1;this._writer.write(i).then(()=>{n&&O(()=>{this.writable=!0,this.emitReserved("drain")},this.setTimeoutFn)})}}doClose(){var e;(e=this._transport)===null||e===void 0||e.close()}};var Me={websocket:W,webtransport:G,polling:F};var Ft=/^(?:(?![^:@\/?#]+:[^:@\/]*@)(http|https|ws|wss):\/\/)?((?:(([^:@\/?#]*)(?::([^:@\/?#]*))?)?@)?((?:[a-f0-9]{0,4}:){2,7}[a-f0-9]{0,4}|[^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/,Wt=["source","protocol","authority","userInfo","user","password","host","port","relative","path","directory","file","query","anchor"];function Z(a){if(a.length>8e3)throw"URI too long";let e=a,t=a.indexOf("["),i=a.indexOf("]");t!=-1&&i!=-1&&(a=a.substring(0,t)+a.substring(t,i).replace(/:/g,";")+a.substring(i,a.length));let n=Ft.exec(a||""),s={},r=14;for(;r--;)s[Wt[r]]=n[r]||"";return t!=-1&&i!=-1&&(s.source=e,s.host=s.host.substring(1,s.host.length-1).replace(/;/g,":"),s.authority=s.authority.replace("[","").replace("]","").replace(/;/g,":"),s.ipv6uri=!0),s.pathNames=Yt(s,s.path),s.queryKey=Vt(s,s.query),s}function Yt(a,e){let t=/\/{2,9}/g,i=e.replace(t,"/").split("/");return(e.slice(0,1)=="/"||e.length===0)&&i.splice(0,1),e.slice(-1)=="/"&&i.splice(i.length-1,1),i}function Vt(a,e){let t={};return e.replace(/(?:^|&)([^&=]*)=?([^&]*)/g,function(i,n,s){n&&(t[n]=s)}),t}var He=typeof addEventListener=="function"&&typeof removeEventListener=="function",ke=[];He&&addEventListener("offline",()=>{ke.forEach(a=>a())},!1);var V=class a extends I{constructor(e,t={}){var i,n;if(super(),this.binaryType=st,this.writeBuffer=[],this._prevBufferLen=0,this._upgrades=[],this._pingInterval=-1,this._pingTimeout=-1,this._maxPayload=-1,this._pingTimeoutTime=1/0,e&&typeof e=="object"&&(t=e,e=null),e){let s=Z(e);t.hostname=s.host,t.secure=s.protocol==="https"||s.protocol==="wss",t.port=s.port,s.query&&(t.query=s.query)}else t.host&&(t.hostname=Z(t.host).host);if(j(this,t),this.secure=t.secure!=null?t.secure:typeof location<"u"&&location.protocol==="https:",t.hostname&&!t.port&&(t.port=this.secure?"443":"80"),this.hostname=t.hostname||(typeof location<"u"?location.hostname:"localhost"),this.port=t.port||(typeof location<"u"&&location.port?location.port:this.secure?"443":"80"),t.transportImplementations&&t.transports)throw new Error("specifying both 'transportImplementations' and 'transports' options is not supported");t.transportImplementations||!((i=t.transports)===null||i===void 0)&&i.length&&typeof t.transports[0]=="function"?(this.transports=[],this._transportsByName=Object.create(null),((n=t.transportImplementations)!==null&&n!==void 0?n:t.transports).forEach(s=>{let r=s.prototype.name;this.transports.push(r),this._transportsByName[r]=s})):(this.transports=t.transports?[...t.transports]:["polling","websocket","webtransport"],this._transportsByName=Me),this.opts=Object.assign({path:"/engine.io",agent:!1,withCredentials:!1,upgrade:!0,timestampParam:"t",rememberUpgrade:!1,addTrailingSlash:!0,rejectUnauthorized:!0,perMessageDeflate:{threshold:1024},transportOptions:{},closeOnBeforeunload:!1},t),this.opts.path=this.opts.path.replace(/\/$/,"")+(this.opts.addTrailingSlash?"/":""),typeof this.opts.query=="string"&&(this.opts.query=ct(this.opts.query)),He&&(this.opts.closeOnBeforeunload&&(this._beforeunloadEventListener=()=>{this.transport&&(this.transport.removeAllListeners(),this.transport.close())},addEventListener("beforeunload",this._beforeunloadEventListener,!1)),this.hostname!=="localhost"&&(this._offlineEventListener=()=>{this._onClose("transport close",{description:"network connection lost"})},ke.push(this._offlineEventListener))),this.opts.withCredentials&&(this._cookieJar=void 0),this._open()}createTransport(e){let t=Object.assign({},this.opts.query);t.EIO=Se,t.transport=e,this.id&&(t.sid=this.id);let i=Object.assign({},this.opts,{query:t,socket:this,hostname:this.hostname,secure:this.secure,port:this.port},this.opts.transportOptions[e]);return new this._transportsByName[e](i)}_open(){if(this.transports.length===0){this.setTimeoutFn(()=>{this.emitReserved("error","No transports available")},0);return}let e=this.opts.rememberUpgrade&&a.priorWebsocketSuccess&&this.transports.indexOf("websocket")!==-1?"websocket":this.transports[0];this.readyState="opening";let t=this.createTransport(e);t.open(),this.setTransport(t)}setTransport(e){this.transport&&this.transport.removeAllListeners(),this.transport=e,e.on("drain",this._onDrain.bind(this)).on("packet",this._onPacket.bind(this)).on("error",this._onError.bind(this)).on("close",t=>this._onClose("transport close",t))}_probe(e){let t=this.createTransport(e),i=!1;a.priorWebsocketSuccess=!1;let n=()=>{i||(t.send([{type:"ping",data:"probe"}]),t.once("packet",f=>{if(!i)if(f.type==="pong"&&f.data==="probe"){if(this.upgrading=!0,this.emitReserved("upgrading",t),!t)return;a.priorWebsocketSuccess=t.name==="websocket",this.transport.pause(()=>{i||this.readyState!=="closed"&&(c(),this.setTransport(t),t.send([{type:"upgrade"}]),this.emitReserved("upgrade",t),t=null,this.upgrading=!1,this.flush())})}else{let b=new Error("probe error");b.transport=t.name,this.emitReserved("upgradeError",b)}}))};function s(){i||(i=!0,c(),t.close(),t=null)}let r=f=>{let b=new Error("probe error: "+f);b.transport=t.name,s(),this.emitReserved("upgradeError",b)};function o(){r("transport closed")}function l(){r("socket closed")}function h(f){t&&f.name!==t.name&&s()}let c=()=>{t.removeListener("open",n),t.removeListener("error",r),t.removeListener("close",o),this.off("close",l),this.off("upgrading",h)};t.once("open",n),t.once("error",r),t.once("close",o),this.once("close",l),this.once("upgrading",h),this._upgrades.indexOf("webtransport")!==-1&&e!=="webtransport"?this.setTimeoutFn(()=>{i||t.open()},200):t.open()}onOpen(){if(this.readyState="open",a.priorWebsocketSuccess=this.transport.name==="websocket",this.emitReserved("open"),this.flush(),this.readyState==="open"&&this.opts.upgrade)for(let e=0;e<this._upgrades.length;e++)this._probe(this._upgrades[e])}_onPacket(e){if(this.readyState==="opening"||this.readyState==="open"||this.readyState==="closing")switch(this.emitReserved("packet",e),this.emitReserved("heartbeat"),e.type){case"open":this.onHandshake(JSON.parse(e.data));break;case"ping":this._sendPacket("pong"),this.emitReserved("ping"),this.emitReserved("pong"),this._resetPingTimeout();break;case"error":let t=new Error("server error");t.code=e.data,this._onError(t);break;case"message":this.emitReserved("data",e.data),this.emitReserved("message",e.data);break}}onHandshake(e){this.emitReserved("handshake",e),this.id=e.sid,this.transport.query.sid=e.sid,this._upgrades=this._filterUpgrades(e.upgrades),this._pingInterval=e.pingInterval,this._pingTimeout=e.pingTimeout,this._maxPayload=e.maxPayload,this.onOpen(),this.readyState!=="closed"&&this._resetPingTimeout()}_resetPingTimeout(){this.clearTimeoutFn(this._pingTimeoutTimer);let e=this._pingInterval+this._pingTimeout;this._pingTimeoutTime=Date.now()+e,this._pingTimeoutTimer=this.setTimeoutFn(()=>{this._onClose("ping timeout")},e),this.opts.autoUnref&&this._pingTimeoutTimer.unref()}_onDrain(){this.writeBuffer.splice(0,this._prevBufferLen),this._prevBufferLen=0,this.writeBuffer.length===0?this.emitReserved("drain"):this.flush()}flush(){if(this.readyState!=="closed"&&this.transport.writable&&!this.upgrading&&this.writeBuffer.length){let e=this._getWritablePackets();this.transport.send(e),this._prevBufferLen=e.length,this.emitReserved("flush")}}_getWritablePackets(){if(!(this._maxPayload&&this.transport.name==="polling"&&this.writeBuffer.length>1))return this.writeBuffer;let t=1;for(let i=0;i<this.writeBuffer.length;i++){let n=this.writeBuffer[i].data;if(n&&(t+=rt(n)),i>0&&t>this._maxPayload)return this.writeBuffer.slice(0,i);t+=2}return this.writeBuffer}_hasPingExpired(){if(!this._pingTimeoutTime)return!0;let e=Date.now()>this._pingTimeoutTime;return e&&(this._pingTimeoutTime=0,O(()=>{this._onClose("ping timeout")},this.setTimeoutFn)),e}write(e,t,i){return this._sendPacket("message",e,t,i),this}send(e,t,i){return this._sendPacket("message",e,t,i),this}_sendPacket(e,t,i,n){if(typeof t=="function"&&(n=t,t=void 0),typeof i=="function"&&(n=i,i=null),this.readyState==="closing"||this.readyState==="closed")return;i=i||{},i.compress=i.compress!==!1;let s={type:e,data:t,options:i};this.emitReserved("packetCreate",s),this.writeBuffer.push(s),n&&this.once("flush",n),this.flush()}close(){let e=()=>{this._onClose("forced close"),this.transport.close()},t=()=>{this.off("upgrade",t),this.off("upgradeError",t),e()},i=()=>{this.once("upgrade",t),this.once("upgradeError",t)};return(this.readyState==="opening"||this.readyState==="open")&&(this.readyState="closing",this.writeBuffer.length?this.once("drain",()=>{this.upgrading?i():e()}):this.upgrading?i():e()),this}_onError(e){if(a.priorWebsocketSuccess=!1,this.opts.tryAllTransports&&this.transports.length>1&&this.readyState==="opening")return this.transports.shift(),this._open();this.emitReserved("error",e),this._onClose("transport error",e)}_onClose(e,t){if(this.readyState==="opening"||this.readyState==="open"||this.readyState==="closing"){if(this.clearTimeoutFn(this._pingTimeoutTimer),this.transport.removeAllListeners("close"),this.transport.close(),this.transport.removeAllListeners(),He&&(this._beforeunloadEventListener&&removeEventListener("beforeunload",this._beforeunloadEventListener,!1),this._offlineEventListener)){let i=ke.indexOf(this._offlineEventListener);i!==-1&&ke.splice(i,1)}this.readyState="closed",this.id=null,this.emitReserved("close",e,t),this.writeBuffer=[],this._prevBufferLen=0}}_filterUpgrades(e){let t=[];for(let i=0;i<e.length;i++)~this.transports.indexOf(e[i])&&t.push(e[i]);return t}};V.protocol=Se;var kn=V.protocol;function ut(a,e="",t){let i=a;t=t||typeof location<"u"&&location,a==null&&(a=t.protocol+"//"+t.host),typeof a=="string"&&(a.charAt(0)==="/"&&(a.charAt(1)==="/"?a=t.protocol+a:a=t.host+a),/^(https?|wss?):\/\//.test(a)||(typeof t<"u"?a=t.protocol+"//"+a:a="https://"+a),i=Z(a)),i.port||(/^(http|ws)$/.test(i.protocol)?i.port="80":/^(http|ws)s$/.test(i.protocol)&&(i.port="443")),i.path=i.path||"/";let s=i.host.indexOf(":")!==-1?"["+i.host+"]":i.host;return i.id=i.protocol+"://"+s+":"+i.port+e,i.href=i.protocol+"://"+s+(t&&t.port===i.port?"":":"+i.port),i}var $e={};zt($e,{Decoder:()=>Re,Encoder:()=>Pe,PacketType:()=>v,isPacketValid:()=>ii,protocol:()=>wt});var Gt=typeof ArrayBuffer=="function",Zt=a=>typeof ArrayBuffer.isView=="function"?ArrayBuffer.isView(a):a.buffer instanceof ArrayBuffer,gt=Object.prototype.toString,Jt=typeof Blob=="function"||typeof Blob<"u"&&gt.call(Blob)==="[object BlobConstructor]",Kt=typeof File=="function"||typeof File<"u"&&gt.call(File)==="[object FileConstructor]";function he(a){return Gt&&(a instanceof ArrayBuffer||Zt(a))||Jt&&a instanceof Blob||Kt&&a instanceof File}function le(a,e){if(!a||typeof a!="object")return!1;if(Array.isArray(a)){for(let t=0,i=a.length;t<i;t++)if(le(a[t]))return!0;return!1}if(he(a))return!0;if(a.toJSON&&typeof a.toJSON=="function"&&arguments.length===1)return le(a.toJSON(),!0);for(let t in a)if(Object.prototype.hasOwnProperty.call(a,t)&&le(a[t]))return!0;return!1}function mt(a){let e=[],t=a.data,i=a;return i.data=_e(t,e),i.attachments=e.length,{packet:i,buffers:e}}function _e(a,e,t){if(!a)return a;if(he(a)){let i={_placeholder:!0,num:e.length};return e.push(a),i}else if(Array.isArray(a)){let i=new Array(a.length);for(let n=0;n<a.length;n++)i[n]=_e(a[n],e);return i}else if(typeof a=="object"&&!(a instanceof Date)){if(a.toJSON&&typeof a.toJSON=="function"&&!t)return _e(a.toJSON(),e,!0);let i={};for(let n in a)Object.prototype.hasOwnProperty.call(a,n)&&(i[n]=_e(a[n],e));return i}return a}function yt(a,e){return a.data=ze(a.data,e),delete a.attachments,a}function ze(a,e){if(!a)return a;if(a&&a._placeholder===!0){if(typeof a.num=="number"&&a.num>=0&&a.num<e.length)return e[a.num];throw new Error("illegal attachments")}else if(Array.isArray(a))for(let t=0;t<a.length;t++)a[t]=ze(a[t],e);else if(typeof a=="object")for(let t in a)Object.prototype.hasOwnProperty.call(a,t)&&(a[t]=ze(a[t],e));return a}var vt=["connect","connect_error","disconnect","disconnecting","newListener","removeListener"],wt=5,v;(function(a){a[a.CONNECT=0]="CONNECT",a[a.DISCONNECT=1]="DISCONNECT",a[a.EVENT=2]="EVENT",a[a.ACK=3]="ACK",a[a.CONNECT_ERROR=4]="CONNECT_ERROR",a[a.BINARY_EVENT=5]="BINARY_EVENT",a[a.BINARY_ACK=6]="BINARY_ACK"})(v||(v={}));var Pe=class{constructor(e){this.replacer=e}encode(e){return(e.type===v.EVENT||e.type===v.ACK)&&le(e)?this.encodeAsBinary({type:e.type===v.EVENT?v.BINARY_EVENT:v.BINARY_ACK,nsp:e.nsp,data:e.data,id:e.id}):[this.encodeAsString(e)]}encodeAsString(e){let t=""+e.type;return(e.type===v.BINARY_EVENT||e.type===v.BINARY_ACK)&&(t+=e.attachments+"-"),e.nsp&&e.nsp!=="/"&&(t+=e.nsp+","),e.id!=null&&(t+=e.id),e.data!=null&&(t+=JSON.stringify(e.data,this.replacer)),t}encodeAsBinary(e){let t=mt(e),i=this.encodeAsString(t.packet),n=t.buffers;return n.unshift(i),n}},Re=class a extends I{constructor(e){super(),this.opts=Object.assign({reviver:void 0,maxAttachments:10},typeof e=="function"?{reviver:e}:e)}add(e){let t;if(typeof e=="string"){if(this.reconstructor)throw new Error("got plaintext data when reconstructing a packet");t=this.decodeString(e);let i=t.type===v.BINARY_EVENT;i||t.type===v.BINARY_ACK?(t.type=i?v.EVENT:v.ACK,this.reconstructor=new qe(t)):super.emitReserved("decoded",t)}else if(he(e)||e.base64)if(this.reconstructor)t=this.reconstructor.takeBinaryData(e),t&&(this.reconstructor=null,super.emitReserved("decoded",t));else throw new Error("got binary data when not reconstructing a packet");else throw new Error("Unknown type: "+e)}decodeString(e){let t=0,i={type:Number(e.charAt(0))};if(v[i.type]===void 0)throw new Error("unknown packet type "+i.type);if(i.type===v.BINARY_EVENT||i.type===v.BINARY_ACK){let s=t+1;for(;e.charAt(++t)!=="-"&&t!=e.length;);let r=e.substring(s,t);if(r!=Number(r)||e.charAt(t)!=="-")throw new Error("Illegal attachments");let o=Number(r);if(!bt(o)||o<1)throw new Error("Illegal attachments");if(o>this.opts.maxAttachments)throw new Error("too many attachments");i.attachments=o}if(e.charAt(t+1)==="/"){let s=t+1;for(;++t&&!(e.charAt(t)===","||t===e.length););i.nsp=e.substring(s,t)}else i.nsp="/";let n=e.charAt(t+1);if(n!==""&&Number(n)==n){let s=t+1;for(;++t;){let r=e.charAt(t);if(r==null||Number(r)!=r){--t;break}if(t===e.length)break}i.id=Number(e.substring(s,t+1))}if(e.charAt(++t)){let s=this.tryParse(e.substr(t));if(a.isPayloadValid(i.type,s))i.data=s;else throw new Error("invalid payload")}return i}tryParse(e){try{return JSON.parse(e,this.opts.reviver)}catch{return!1}}static isPayloadValid(e,t){switch(e){case v.CONNECT:return Te(t);case v.DISCONNECT:return t===void 0;case v.CONNECT_ERROR:return typeof t=="string"||Te(t);case v.EVENT:case v.BINARY_EVENT:return Array.isArray(t)&&(typeof t[0]=="number"||typeof t[0]=="string"&&vt.indexOf(t[0])===-1);case v.ACK:case v.BINARY_ACK:return Array.isArray(t)}}destroy(){this.reconstructor&&(this.reconstructor.finishedReconstruction(),this.reconstructor=null)}},qe=class{constructor(e){this.packet=e,this.buffers=[],this.reconPack=e}takeBinaryData(e){if(this.buffers.push(e),this.buffers.length===this.reconPack.attachments){let t=yt(this.reconPack,this.buffers);return this.finishedReconstruction(),t}return null}finishedReconstruction(){this.reconPack=null,this.buffers=[]}};function Xt(a){return typeof a=="string"}var bt=Number.isInteger||function(a){return typeof a=="number"&&isFinite(a)&&Math.floor(a)===a};function ei(a){return a===void 0||bt(a)}function Te(a){return Object.prototype.toString.call(a)==="[object Object]"}function ti(a,e){switch(a){case v.CONNECT:return e===void 0||Te(e);case v.DISCONNECT:return e===void 0;case v.EVENT:return Array.isArray(e)&&(typeof e[0]=="number"||typeof e[0]=="string"&&vt.indexOf(e[0])===-1);case v.ACK:return Array.isArray(e);case v.CONNECT_ERROR:return typeof e=="string"||Te(e);default:return!1}}function ii(a){return Xt(a.nsp)&&ei(a.id)&&ti(a.type,a.data)}function H(a,e,t){return a.on(e,t),function(){a.off(e,t)}}var ni=Object.freeze({connect:1,connect_error:1,disconnect:1,disconnecting:1,newListener:1,removeListener:1}),J=class extends I{constructor(e,t,i){super(),this.connected=!1,this.recovered=!1,this.receiveBuffer=[],this.sendBuffer=[],this._queue=[],this._queueSeq=0,this.ids=0,this.acks={},this.flags={},this.io=e,this.nsp=t,i&&i.auth&&(this.auth=i.auth),this._opts=Object.assign({},i),this.io._autoConnect&&this.open()}get disconnected(){return!this.connected}subEvents(){if(this.subs)return;let e=this.io;this.subs=[H(e,"open",this.onopen.bind(this)),H(e,"packet",this.onpacket.bind(this)),H(e,"error",this.onerror.bind(this)),H(e,"close",this.onclose.bind(this))]}get active(){return!!this.subs}connect(){return this.connected?this:(this.subEvents(),this.io._reconnecting||this.io.open(),this.io._readyState==="open"&&this.onopen(),this)}open(){return this.connect()}send(...e){return e.unshift("message"),this.emit.apply(this,e),this}emit(e,...t){var i,n,s;if(ni.hasOwnProperty(e))throw new Error('"'+e.toString()+'" is a reserved event name');if(t.unshift(e),this._opts.retries&&!this.flags.fromQueue&&!this.flags.volatile)return this._addToQueue(t),this;let r={type:v.EVENT,data:t};if(r.options={},r.options.compress=this.flags.compress!==!1,typeof t[t.length-1]=="function"){let c=this.ids++,f=t.pop();this._registerAckCallback(c,f),r.id=c}let o=(n=(i=this.io.engine)===null||i===void 0?void 0:i.transport)===null||n===void 0?void 0:n.writable,l=this.connected&&!(!((s=this.io.engine)===null||s===void 0)&&s._hasPingExpired());return this.flags.volatile&&!o||(l?(this.notifyOutgoingListeners(r),this.packet(r)):this.sendBuffer.push(r)),this.flags={},this}_registerAckCallback(e,t){var i;let n=(i=this.flags.timeout)!==null&&i!==void 0?i:this._opts.ackTimeout;if(n===void 0){this.acks[e]=t;return}let s=this.io.setTimeoutFn(()=>{delete this.acks[e];for(let o=0;o<this.sendBuffer.length;o++)this.sendBuffer[o].id===e&&this.sendBuffer.splice(o,1);t.call(this,new Error("operation has timed out"))},n),r=(...o)=>{this.io.clearTimeoutFn(s),t.apply(this,o)};r.withError=!0,this.acks[e]=r}emitWithAck(e,...t){return new Promise((i,n)=>{let s=(r,o)=>r?n(r):i(o);s.withError=!0,t.push(s),this.emit(e,...t)})}_addToQueue(e){let t;typeof e[e.length-1]=="function"&&(t=e.pop());let i={id:this._queueSeq++,tryCount:0,pending:!1,args:e,flags:Object.assign({fromQueue:!0},this.flags)};e.push((n,...s)=>(this._queue[0],n!==null?i.tryCount>this._opts.retries&&(this._queue.shift(),t&&t(n)):(this._queue.shift(),t&&t(null,...s)),i.pending=!1,this._drainQueue())),this._queue.push(i),this._drainQueue()}_drainQueue(e=!1){if(!this.connected||this._queue.length===0)return;let t=this._queue[0];t.pending&&!e||(t.pending=!0,t.tryCount++,this.flags=t.flags,this.emit.apply(this,t.args))}packet(e){e.nsp=this.nsp,this.io._packet(e)}onopen(){typeof this.auth=="function"?this.auth(e=>{this._sendConnectPacket(e)}):this._sendConnectPacket(this.auth)}_sendConnectPacket(e){this.packet({type:v.CONNECT,data:this._pid?Object.assign({pid:this._pid,offset:this._lastOffset},e):e})}onerror(e){this.connected||this.emitReserved("connect_error",e)}onclose(e,t){this.connected=!1,delete this.id,this.emitReserved("disconnect",e,t),this._clearAcks()}_clearAcks(){Object.keys(this.acks).forEach(e=>{if(!this.sendBuffer.some(i=>String(i.id)===e)){let i=this.acks[e];delete this.acks[e],i.withError&&i.call(this,new Error("socket has been disconnected"))}})}onpacket(e){if(e.nsp===this.nsp)switch(e.type){case v.CONNECT:e.data&&e.data.sid?this.onconnect(e.data.sid,e.data.pid):this.emitReserved("connect_error",new Error("It seems you are trying to reach a Socket.IO server in v2.x with a v3.x client, but they are not compatible (more information here: https://socket.io/docs/v3/migrating-from-2-x-to-3-0/)"));break;case v.EVENT:case v.BINARY_EVENT:this.onevent(e);break;case v.ACK:case v.BINARY_ACK:this.onack(e);break;case v.DISCONNECT:this.ondisconnect();break;case v.CONNECT_ERROR:this.destroy();let i=new Error(e.data.message);i.data=e.data.data,this.emitReserved("connect_error",i);break}}onevent(e){let t=e.data||[];e.id!=null&&t.push(this.ack(e.id)),this.connected?this.emitEvent(t):this.receiveBuffer.push(Object.freeze(t))}emitEvent(e){if(this._anyListeners&&this._anyListeners.length){let t=this._anyListeners.slice();for(let i of t)i.apply(this,e)}super.emit.apply(this,e),this._pid&&e.length&&typeof e[e.length-1]=="string"&&(this._lastOffset=e[e.length-1])}ack(e){let t=this,i=!1;return function(...n){i||(i=!0,t.packet({type:v.ACK,id:e,data:n}))}}onack(e){let t=this.acks[e.id];typeof t=="function"&&(delete this.acks[e.id],t.withError&&e.data.unshift(null),t.apply(this,e.data))}onconnect(e,t){this.id=e,this.recovered=t&&this._pid===t,this._pid=t,this.connected=!0,this.emitBuffered(),this._drainQueue(!0),this.emitReserved("connect")}emitBuffered(){this.receiveBuffer.forEach(e=>this.emitEvent(e)),this.receiveBuffer=[],this.sendBuffer.forEach(e=>{this.notifyOutgoingListeners(e),this.packet(e)}),this.sendBuffer=[]}ondisconnect(){this.destroy(),this.onclose("io server disconnect")}destroy(){this.subs&&(this.subs.forEach(e=>e()),this.subs=void 0),this.io._destroy(this)}disconnect(){return this.connected&&this.packet({type:v.DISCONNECT}),this.destroy(),this.connected&&this.onclose("io client disconnect"),this}close(){return this.disconnect()}compress(e){return this.flags.compress=e,this}get volatile(){return this.flags.volatile=!0,this}timeout(e){return this.flags.timeout=e,this}onAny(e){return this._anyListeners=this._anyListeners||[],this._anyListeners.push(e),this}prependAny(e){return this._anyListeners=this._anyListeners||[],this._anyListeners.unshift(e),this}offAny(e){if(!this._anyListeners)return this;if(e){let t=this._anyListeners;for(let i=0;i<t.length;i++)if(e===t[i])return t.splice(i,1),this}else this._anyListeners=[];return this}listenersAny(){return this._anyListeners||[]}onAnyOutgoing(e){return this._anyOutgoingListeners=this._anyOutgoingListeners||[],this._anyOutgoingListeners.push(e),this}prependAnyOutgoing(e){return this._anyOutgoingListeners=this._anyOutgoingListeners||[],this._anyOutgoingListeners.unshift(e),this}offAnyOutgoing(e){if(!this._anyOutgoingListeners)return this;if(e){let t=this._anyOutgoingListeners;for(let i=0;i<t.length;i++)if(e===t[i])return t.splice(i,1),this}else this._anyOutgoingListeners=[];return this}listenersAnyOutgoing(){return this._anyOutgoingListeners||[]}notifyOutgoingListeners(e){if(this._anyOutgoingListeners&&this._anyOutgoingListeners.length){let t=this._anyOutgoingListeners.slice();for(let i of t)i.apply(this,e.data)}}};function Q(a){a=a||{},this.ms=a.min||100,this.max=a.max||1e4,this.factor=a.factor||2,this.jitter=a.jitter>0&&a.jitter<=1?a.jitter:0,this.attempts=0}Q.prototype.duration=function(){var a=this.ms*Math.pow(this.factor,this.attempts++);if(this.jitter){var e=Math.random(),t=Math.floor(e*this.jitter*a);a=(Math.floor(e*10)&1)==0?a-t:a+t}return Math.min(a,this.max)|0};Q.prototype.reset=function(){this.attempts=0};Q.prototype.setMin=function(a){this.ms=a};Q.prototype.setMax=function(a){this.max=a};Q.prototype.setJitter=function(a){this.jitter=a};var K=class extends I{constructor(e,t){var i;super(),this.nsps={},this.subs=[],e&&typeof e=="object"&&(t=e,e=void 0),t=t||{},t.path=t.path||"/socket.io",this.opts=t,j(this,t),this.reconnection(t.reconnection!==!1),this.reconnectionAttempts(t.reconnectionAttempts||1/0),this.reconnectionDelay(t.reconnectionDelay||1e3),this.reconnectionDelayMax(t.reconnectionDelayMax||5e3),this.randomizationFactor((i=t.randomizationFactor)!==null&&i!==void 0?i:.5),this.backoff=new Q({min:this.reconnectionDelay(),max:this.reconnectionDelayMax(),jitter:this.randomizationFactor()}),this.timeout(t.timeout==null?2e4:t.timeout),this._readyState="closed",this.uri=e;let n=t.parser||$e;this.encoder=new n.Encoder,this.decoder=new n.Decoder,this._autoConnect=t.autoConnect!==!1,this._autoConnect&&this.open()}reconnection(e){return arguments.length?(this._reconnection=!!e,e||(this.skipReconnect=!0),this):this._reconnection}reconnectionAttempts(e){return e===void 0?this._reconnectionAttempts:(this._reconnectionAttempts=e,this)}reconnectionDelay(e){var t;return e===void 0?this._reconnectionDelay:(this._reconnectionDelay=e,(t=this.backoff)===null||t===void 0||t.setMin(e),this)}randomizationFactor(e){var t;return e===void 0?this._randomizationFactor:(this._randomizationFactor=e,(t=this.backoff)===null||t===void 0||t.setJitter(e),this)}reconnectionDelayMax(e){var t;return e===void 0?this._reconnectionDelayMax:(this._reconnectionDelayMax=e,(t=this.backoff)===null||t===void 0||t.setMax(e),this)}timeout(e){return arguments.length?(this._timeout=e,this):this._timeout}maybeReconnectOnOpen(){!this._reconnecting&&this._reconnection&&this.backoff.attempts===0&&this.reconnect()}open(e){if(~this._readyState.indexOf("open"))return this;this.engine=new V(this.uri,this.opts);let t=this.engine,i=this;this._readyState="opening",this.skipReconnect=!1;let n=H(t,"open",function(){i.onopen(),e&&e()}),s=o=>{this.cleanup(),this._readyState="closed",this.emitReserved("error",o),e?e(o):this.maybeReconnectOnOpen()},r=H(t,"error",s);if(this._timeout!==!1){let o=this._timeout,l=this.setTimeoutFn(()=>{n(),s(new Error("timeout")),t.close()},o);this.opts.autoUnref&&l.unref(),this.subs.push(()=>{this.clearTimeoutFn(l)})}return this.subs.push(n),this.subs.push(r),this}connect(e){return this.open(e)}onopen(){this.cleanup(),this._readyState="open",this.emitReserved("open");let e=this.engine;this.subs.push(H(e,"ping",this.onping.bind(this)),H(e,"data",this.ondata.bind(this)),H(e,"error",this.onerror.bind(this)),H(e,"close",this.onclose.bind(this)),H(this.decoder,"decoded",this.ondecoded.bind(this)))}onping(){this.emitReserved("ping")}ondata(e){try{this.decoder.add(e)}catch(t){this.onclose("parse error",t)}}ondecoded(e){O(()=>{this.emitReserved("packet",e)},this.setTimeoutFn)}onerror(e){this.emitReserved("error",e)}socket(e,t){let i=this.nsps[e];return i?this._autoConnect&&!i.active&&i.connect():(i=new J(this,e,t),this.nsps[e]=i),i}_destroy(e){let t=Object.keys(this.nsps);for(let i of t)if(this.nsps[i].active)return;this._close()}_packet(e){let t=this.encoder.encode(e);for(let i=0;i<t.length;i++)this.engine.write(t[i],e.options)}cleanup(){this.subs.forEach(e=>e()),this.subs.length=0,this.decoder.destroy()}_close(){this.skipReconnect=!0,this._reconnecting=!1,this.onclose("forced close")}disconnect(){return this._close()}onclose(e,t){var i;this.cleanup(),(i=this.engine)===null||i===void 0||i.close(),this.backoff.reset(),this._readyState="closed",this.emitReserved("close",e,t),this._reconnection&&!this.skipReconnect&&this.reconnect()}reconnect(){if(this._reconnecting||this.skipReconnect)return this;let e=this;if(this.backoff.attempts>=this._reconnectionAttempts)this.backoff.reset(),this.emitReserved("reconnect_failed"),this._reconnecting=!1;else{let t=this.backoff.duration();this._reconnecting=!0;let i=this.setTimeoutFn(()=>{e.skipReconnect||(this.emitReserved("reconnect_attempt",e.backoff.attempts),!e.skipReconnect&&e.open(n=>{n?(e._reconnecting=!1,e.reconnect(),this.emitReserved("reconnect_error",n)):e.onreconnect()}))},t);this.opts.autoUnref&&i.unref(),this.subs.push(()=>{this.clearTimeoutFn(i)})}}onreconnect(){let e=this.backoff.attempts;this._reconnecting=!1,this.backoff.reset(),this.emitReserved("reconnect",e)}};var de={};function pe(a,e){typeof a=="object"&&(e=a,a=void 0),e=e||{};let t=ut(a,e.path||"/socket.io"),i=t.source,n=t.id,s=t.path,r=de[n]&&s in de[n].nsps,o=e.forceNew||e["force new connection"]||e.multiplex===!1||r,l;return o?l=new K(i,e):(de[n]||(de[n]=new K(i,e)),l=de[n]),t.query&&!e.query&&(e.query=t.queryKey),l.socket(t.path,e)}Object.assign(pe,{Manager:K,Socket:J,io:pe,connect:pe});var Ne="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAYAAABccqhmAAAp9UlEQVR4AezB93Oc930g4Ofz7otGAmyg2KlqiSpWddzLxY4T2+NcMpnMJP9ifkjuh+SSmzjtEltWbMuRdLaKKcmqrGInQBLA7n5uct+57OwAJAEQ4C6w7/NEZmo0GqOp0mg0Rlal0WiMrEqj0RhZlUajMbIqjUZjZFUajcbIqjQajZFVaTQaI6vSaDRGVqXRaIysSqPRGFmVRqMxsiqNRmNkVRqNxsiqNBqNkVVpNBojq9JoNEZWpdFojKxKo9EYWbXGvQiEIhAIdPVUqNBChRYqBAKhJxRpZWl1Qk9Ym9AvrF7aHIlEF1100UYHXSRCkUgkUpEaK6o1VisQCHT1BMYxg/3Yj12Yxk5MYQcmMYlJTKJGC4FA6JeKVCRST1pZIBQVwuqFfmHt0sZLdNDGIhZwEzcwh+u4ggs4i0u4jg4SgUCgq0gNtcadhH4TmMIkpjCFKcxgFodxGHuxCzPYgR2YwiQmMYUaLQQqK0skUpFIPWm5QCAQqKxeWC6sTdpYiUQHbSzhFm5hHtdxDRdxFh/hHC5iHvOYxwJu4Sa6CD1pRNUaKwlFhVQEZnAUj+ERPIRD2I9dmMFOtFChQiBQIVAhEAhFuL3UL61OKEJPuruweRKhX1qdMUUikeiiiy7aWMQNXMNlfIrf4n18hE9xWpEIpCKNoFrj/wuEIjCOHdiHB3AcD+FBHMYs9mAaUxjHBGqEIqwsLBeWS4R+qScUqSf0C0Ui9AuDlQiE1Um3l+hiF2ZxGMfwJC7iPE7jI3yCUziPOdzUL42IWuM/BSqMYQIz2IsDeBCP4fN4BIcxhVqRSEUgEAj9QpEIqxP6JUIRegKJcHuhX7h/EqFIPaEI9yYRaKHCOKbxAEJxA5dwCr/GW3gXp3Ee17GANgJpBNRGWyBQocIsHsEX8Swexx5MYxLjGEcLgUDqF4qwsrCyQLqzcHuBcG/C6qWeQLq90BPWL6wsFIlA6EkkxrAP03gIv4tLeBu/xE/xEa4pEom0jdVGUygqzOIIHsajeBQn8BAOYRwtdJFIBEIR+oW1C0UgrU+4N2FtAqknkAYrFGG5FlqYwh4kjmIWR/AQ3scn+BBncQ2p6NqGaqMlFC2MYRyP4yv4Lp7EQVSKUHQRCGsX1iasLBE2Trh3oV8YPoHQLxEYxyN4GF/DJ3gLP8LP8SEW0cWSnrRN1EZHIFDhGJ7AF/B5nMAhzKBCIPQLpNUJGy/cu9D4T6Go9IzjCKZxCF/G63gdJ3EVbT1pG6iNhsAY9uIYXsCLeAkPYj8qBBJhZYHU2C5CEQjMYAazOIYHcRgH8BbO4zq6irTF1ba3UFSYwgn8Eb6FJzGGQCAQ7i70JMJwC43bCT2hZwJHcARP4kX8FX6OdxUd20Btewo90ziI7+AreBGHMY5Kv7Q2YfiExmolwnIVAoG9+Dx24Cn8FL/AGSQSaYuqbU+BMezGQ3gWf4QXsV9P2F5CY6MEEpM4jKM4iH3o4HWcxxK6SFtQbfupUGEPvoZv45s4iF0IRdgeQmM1wuqFnkCii+OYwR4cwl/iBpbQsQXVto9AC+M4gRfxLTyLhzGOliJsD6FxP4RiArN4EYnEz/AuFtC1xdS2jwo7cQDfxPfwEnYhUCFsH2HrCCtLW0coahzDJA4gcQ3nsIiOLaS29QUqTOJx/DG+iqewExUCYfsIW0cgEba+UCRm8Dj+FPvxVziNm0ikLaC2tQVaGMdL+Ca+g0ewD4lAKMLWF7aOsP2EYhx78SwqzOMVvI0FdJCGXG1rC4xjN/4QP8SDGFNUitAT7izcWbo/wtYUlgvLpfsnbLwKiVm8iAcwhtO4gltIQ662NQVq7McX8X28hAOoEQhF2FihSP3CylJj0BJh44SeFnbiGL6HHfhfeA/XkIZYbWuawD58Ab+PP8QMJhEIhOXCnYXVC6S7C6TGoCXCxgoExjGG5zGNWxjDr7CAtiFV23oq7MYJ/Dm+hH1ooUIoAqkn3FlYu7A64e4SobGZUr+wsrQ2gcBePIMZ7MYZXMQ80hCqbR2BFibwIn6IZ/EAxhB6QhG2jrA1hX5p60jrF5ZrYQpH8U208Xd4CzeRSEOktnUEpnAcX8Uf4AB2oNKTGo3NFVYWqDGDZ7Ef53EZH2PJkKkNv0AgcAB/im/hICYQilSExv2WRke4uwo7cBj/DXM4i7YiDYna1hA4gufxVTyKSYR+odHYPGF1AjV24jlcwtv4AJcMkdpwC1So8SS+jqfxgCIUidBodBxv4R/wEv4eZ7CANKRq21OgRhuf49t4EvexjDYCgdBoDLI6uIxT+AbewB4kUqMxJCqDE4pE4Gf4Dt7CR/i/eBE3EUgEUqMxdCo6fIlreBsv42/xFJ5FojGkKoMTikDgJ3gZ/wUv4kM8j4/RRqLRGEKVXoObeAW/i9/Ff8S/43k8h1RjSFUGp6u3gEt4Hb+D1/E6XsdbeAfncRFdpEajMQRqA1dxE+/ht/B3+A/4O/w3vIEruIFUIq03vAKhNjj7MY5DuIBTeBX/A9/B7+MNvI5XsIA2utY25Cp7cQBfwQv4f/EaXsN/xk/xLi7iOrqK1Ghs5tAjce9l3MQFnMIb+E/4Fn6A38M/wVewH7vRQqCycUKBCoEKh3EYj+Mr+HP8Dr6Pb+NpPI7DeAKHMIZKEVZnrL+2sQIT2I89OI5j+Dq+gf8Xz+JP8U18G4/i+ziGQ5hAhVCE1QurldbvHhxEB0/iaXwF/489OO/N0rs883u/e5+39+69994793vv1Z3uVl9u93Xv7q5uV1/d7rvb1e62O45jx7ETJ3ZiB0cChAATwhZCRiChKCGkCCkQEgIJgZAgJJQQkggpECYhIYSUhJCEhBAChISQhBACEkKCEBICCUJICSSEkBCSEBIChJAEQsgIISEg5AghQghCCAlChJAgRNgIIdhIQogQIkRIIQghhISQhBCEkIQI20cIITF9hJAghBD2V4h9CCFsnyGEfQgbhBAiIYTtKYRECDZCCDZC2F8h9hBCCEIIe7eEEBLC9hBC2F4h9hBCiBBC2N9+Yk8hhCCE7SGEEEJChO0nhBD2V4j9CCHsXyH2IYR9CCFsf2F/hRBCiLARIUIIW9hfIdhf2D5CiP0VghBCQthfIYTtJYTtKYSQEIQQQggJIWwfIYQQQggJIewvhLC9hBACIUJICEEIYSNChBACIUJICCEhBCGE/RVCiBAiREghhBCChBDC/gohhBCEEIJAAuF/AQYA7aP9v4V7c7sAAAAASUVORK5CYII=",xt=Ne;var fe=[{id:"smileys",name:"Smileys & Emotions",icon:"\u{1F600}",emojis:["\u{1F600}","\u{1F603}","\u{1F604}","\u{1F601}","\u{1F606}","\u{1F605}","\u{1F602}","\u{1F923}","\u{1F60A}","\u{1F607}","\u{1F642}","\u{1F643}","\u{1F609}","\u{1F60C}","\u{1F60D}","\u{1F970}","\u{1F618}","\u{1F617}","\u{1F619}","\u{1F61A}","\u{1F60B}","\u{1F61B}","\u{1F61C}","\u{1F92A}","\u{1F61D}","\u{1F911}","\u{1F917}","\u{1F92D}","\u{1F92B}","\u{1F914}","\u{1F910}","\u{1F928}","\u{1F610}","\u{1F611}","\u{1F636}","\u{1F60F}","\u{1F612}","\u{1F644}","\u{1F62C}","\u{1F925}","\u{1F60C}","\u{1F614}","\u{1F62A}","\u{1F924}","\u{1F634}","\u{1F637}","\u{1F912}","\u{1F915}","\u{1F922}","\u{1F92E}","\u{1F927}","\u{1F975}","\u{1F976}","\u{1F974}","\u{1F635}","\u{1F92F}","\u{1F920}","\u{1F973}","\u{1F60E}","\u{1F913}","\u{1F9D0}","\u{1F615}","\u{1F61F}","\u{1F641}","\u{1F62E}","\u{1F62F}","\u{1F632}","\u{1F633}","\u{1F97A}","\u{1F626}","\u{1F627}","\u{1F628}","\u{1F630}","\u{1F625}","\u{1F622}","\u{1F62D}","\u{1F631}","\u{1F616}","\u{1F623}","\u{1F61E}","\u{1F613}","\u{1F629}","\u{1F62B}","\u{1F971}","\u{1F624}","\u{1F621}","\u{1F620}","\u{1F92C}","\u{1F608}","\u{1F47F}","\u{1F480}","\u2620\uFE0F","\u{1F4A9}","\u{1F921}","\u{1F479}","\u{1F47A}","\u{1F47B}","\u{1F47D}","\u{1F47E}","\u{1F916}"]},{id:"people",name:"People & Gestures",icon:"\u{1F44B}",emojis:["\u{1F44B}","\u{1F91A}","\u{1F590}\uFE0F","\u270B","\u{1F596}","\u{1F44C}","\u{1F90C}","\u{1F90F}","\u270C\uFE0F","\u{1F91E}","\u{1FAF0}","\u{1F91F}","\u{1F918}","\u{1F919}","\u{1F448}","\u{1F449}","\u{1F446}","\u{1F595}","\u{1F447}","\u261D\uFE0F","\u{1F44D}","\u{1F44E}","\u270A","\u{1F44A}","\u{1F91B}","\u{1F91C}","\u{1F44F}","\u{1F64C}","\u{1F450}","\u{1F932}","\u{1F91D}","\u{1F64F}","\u270D\uFE0F","\u{1F485}","\u{1F933}","\u{1F4AA}","\u{1F9BE}","\u{1F9BF}","\u{1F9B5}","\u{1F9B6}","\u{1F442}","\u{1F9BB}","\u{1F443}","\u{1F9E0}","\u{1FAC0}","\u{1FAC1}","\u{1F9B7}","\u{1F9B4}","\u{1F440}","\u{1F441}\uFE0F","\u{1F445}","\u{1F444}","\u{1F48B}","\u{1FAC2}","\u{1F476}","\u{1F467}","\u{1F9D2}","\u{1F466}","\u{1F469}","\u{1F9D1}","\u{1F468}","\u{1F9D1}\u200D\u{1F9B1}","\u{1F468}\u200D\u{1F9B1}","\u{1F469}\u200D\u{1F9B1}","\u{1F9D1}\u200D\u{1F9B0}","\u{1F468}\u200D\u{1F9B0}","\u{1F469}\u200D\u{1F9B0}","\u{1F471}","\u{1F471}\u200D\u2642\uFE0F","\u{1F471}\u200D\u2640\uFE0F","\u{1F9D1}\u200D\u{1F9B3}","\u{1F468}\u200D\u{1F9B3}","\u{1F469}\u200D\u{1F9B3}","\u{1F9D1}\u200D\u{1F9B2}","\u{1F468}\u200D\u{1F9B2}","\u{1F469}\u200D\u{1F9B2}","\u{1F9D4}","\u{1F9D3}","\u{1F474}","\u{1F475}"]},{id:"hearts",name:"Hearts & Love",icon:"\u2764\uFE0F",emojis:["\u2764\uFE0F","\u{1F9E1}","\u{1F49B}","\u{1F49A}","\u{1F499}","\u{1F49C}","\u{1F5A4}","\u{1F90D}","\u{1F90E}","\u{1F494}","\u2763\uFE0F","\u{1F495}","\u{1F49E}","\u{1F493}","\u{1F497}","\u{1F496}","\u{1F498}","\u{1F49D}","\u{1F49F}","\u{1F48C}","\u{1F48B}","\u{1F48D}","\u{1F48E}","\u{1F490}","\u{1F339}","\u{1F940}","\u{1F33A}","\u{1F338}","\u{1F337}","\u{1F33B}"]},{id:"animals",name:"Animals & Nature",icon:"\u{1F436}",emojis:["\u{1F436}","\u{1F431}","\u{1F42D}","\u{1F439}","\u{1F430}","\u{1F98A}","\u{1F43B}","\u{1F43C}","\u{1F428}","\u{1F42F}","\u{1F981}","\u{1F42E}","\u{1F437}","\u{1F43D}","\u{1F438}","\u{1F435}","\u{1F648}","\u{1F649}","\u{1F64A}","\u{1F412}","\u{1F414}","\u{1F427}","\u{1F426}","\u{1F424}","\u{1F423}","\u{1F425}","\u{1F986}","\u{1F985}","\u{1F989}","\u{1F987}","\u{1F43A}","\u{1F417}","\u{1F434}","\u{1F984}","\u{1F41D}","\u{1FAB1}","\u{1F41B}","\u{1F98B}","\u{1F40C}","\u{1F41E}","\u{1F41C}","\u{1FAB0}","\u{1FAB2}","\u{1FAB3}","\u{1F99F}","\u{1F997}","\u{1F577}\uFE0F","\u{1F578}\uFE0F","\u{1F982}","\u{1F422}","\u{1F40D}","\u{1F98E}","\u{1F996}","\u{1F995}","\u{1F419}","\u{1F991}","\u{1F990}","\u{1F99E}","\u{1F980}","\u{1F421}","\u{1F420}","\u{1F41F}","\u{1F42C}","\u{1F433}","\u{1F40B}","\u{1F988}","\u{1F40A}","\u{1F405}","\u{1F406}","\u{1F993}","\u{1F98D}","\u{1F9A7}","\u{1F9A3}","\u{1F418}","\u{1F99B}","\u{1F98F}","\u{1F42A}","\u{1F42B}","\u{1F992}","\u{1F998}","\u{1F403}","\u{1F402}","\u{1F404}","\u{1F40E}","\u{1F416}","\u{1F40F}","\u{1F411}","\u{1F999}","\u{1F410}","\u{1F98C}","\u{1F415}","\u{1F429}","\u{1F9AE}","\u{1F415}\u200D\u{1F9BA}","\u{1F408}","\u{1F408}\u200D\u2B1B","\u{1F413}","\u{1F983}","\u{1F99A}","\u{1F99C}"]},{id:"food",name:"Food & Drink",icon:"\u{1F355}",emojis:["\u{1F34F}","\u{1F34E}","\u{1F350}","\u{1F34A}","\u{1F34B}","\u{1F34C}","\u{1F349}","\u{1F347}","\u{1F353}","\u{1FAD0}","\u{1F348}","\u{1F352}","\u{1F351}","\u{1F96D}","\u{1F34D}","\u{1F965}","\u{1F95D}","\u{1F345}","\u{1F346}","\u{1F951}","\u{1F966}","\u{1F96C}","\u{1F952}","\u{1F336}\uFE0F","\u{1FAD1}","\u{1F33D}","\u{1F955}","\u{1F9C4}","\u{1F9C5}","\u{1F954}","\u{1F360}","\u{1F950}","\u{1F96F}","\u{1F35E}","\u{1F956}","\u{1F968}","\u{1F9C0}","\u{1F95A}","\u{1F373}","\u{1F9C8}","\u{1F95E}","\u{1F9C7}","\u{1F953}","\u{1F969}","\u{1F357}","\u{1F356}","\u{1F32D}","\u{1F354}","\u{1F35F}","\u{1F355}","\u{1FAD3}","\u{1F96A}","\u{1F959}","\u{1F9C6}","\u{1F32E}","\u{1F32F}","\u{1FAD4}","\u{1F957}","\u{1F958}","\u{1FAD5}","\u{1F372}","\u{1F35C}","\u{1F35D}","\u{1F363}","\u{1F371}","\u{1F95F}","\u{1F364}","\u{1F359}","\u{1F35A}","\u{1F358}","\u{1F366}","\u{1F367}","\u{1F368}","\u{1F369}","\u{1F36A}","\u{1F382}","\u{1F370}","\u{1F9C1}","\u{1F36B}","\u{1F36C}","\u{1F36D}","\u{1F36E}","\u{1F36F}","\u{1F37C}","\u{1F95B}","\u2615","\u{1FAD6}","\u{1F375}","\u{1F376}","\u{1F37E}","\u{1F377}","\u{1F378}","\u{1F379}","\u{1F37A}","\u{1F37B}","\u{1F942}","\u{1F943}","\u{1F964}","\u{1F9C3}","\u{1F9CB}"]},{id:"activity",name:"Activities & Sports",icon:"\u26BD",emojis:["\u26BD","\u{1F3C0}","\u{1F3C8}","\u26BE","\u{1F94E}","\u{1F3BE}","\u{1F3D0}","\u{1F3C9}","\u{1F94F}","\u{1F3B1}","\u{1FA80}","\u{1F3D3}","\u{1F3F8}","\u{1F3D2}","\u{1F3D1}","\u{1F94D}","\u{1F3CF}","\u{1FA83}","\u{1F945}","\u26F3","\u{1FA81}","\u{1F3F9}","\u{1F3A3}","\u{1F93F}","\u{1F94A}","\u{1F94B}","\u{1F3BD}","\u{1F6F9}","\u{1F6FC}","\u{1F6F7}","\u26F8\uFE0F","\u{1F94C}","\u{1F3BF}","\u26F7\uFE0F","\u{1F3C2}","\u{1FA82}","\u{1F3CB}\uFE0F","\u{1F93C}","\u{1F938}","\u{1F93A}","\u26F9\uFE0F","\u{1F93E}","\u{1F9D7}","\u{1F3CC}\uFE0F","\u{1F3C4}","\u{1F3CA}","\u{1F6B4}","\u{1F6B5}","\u{1F3C7}","\u{1F3C6}","\u{1F947}","\u{1F948}","\u{1F949}","\u{1F3C5}","\u{1F396}\uFE0F","\u{1F3F5}\uFE0F","\u{1F397}\uFE0F","\u{1F3AB}","\u{1F39F}\uFE0F","\u{1F3AA}","\u{1F939}","\u{1F3AD}","\u{1FA70}","\u{1F3A8}","\u{1F3AC}","\u{1F3A4}","\u{1F3A7}","\u{1F3BC}","\u{1F3B9}","\u{1F941}","\u{1FA98}","\u{1F3B7}","\u{1F3BA}","\u{1FA97}","\u{1F3B8}","\u{1FA95}","\u{1F3BB}","\u{1F3B2}","\u265F\uFE0F","\u{1F3AF}","\u{1F3B3}","\u{1F3AE}","\u{1F3B0}","\u{1F9E9}","\u{1F3B3}","\u{1F579}\uFE0F","\u{1FA84}","\u{1F52E}","\u{1F0CF}","\u{1F004}"]},{id:"objects",name:"Objects & Tech",icon:"\u{1F4A1}",emojis:["\u{1F4F1}","\u{1F4F2}","\u{1F4BB}","\u2328\uFE0F","\u{1F5A5}\uFE0F","\u{1F5A8}\uFE0F","\u{1F5B1}\uFE0F","\u{1F579}\uFE0F","\u{1F4BD}","\u{1F4BE}","\u{1F4BF}","\u{1F4C0}","\u{1F4F7}","\u{1F4F8}","\u{1F4F9}","\u{1F3A5}","\u{1F4FD}\uFE0F","\u{1F39E}\uFE0F","\u{1F4DE}","\u260E\uFE0F","\u{1F4DF}","\u{1F4E0}","\u{1F4FA}","\u{1F4FB}","\u{1F399}\uFE0F","\u{1F39A}\uFE0F","\u{1F39B}\uFE0F","\u23F1\uFE0F","\u23F2\uFE0F","\u23F0","\u{1F570}\uFE0F","\u231B","\u23F3","\u{1F4E1}","\u{1F50B}","\u{1F50C}","\u{1F4A1}","\u{1F526}","\u{1F56F}\uFE0F","\u{1F9EF}","\u{1F5D1}\uFE0F","\u{1F6E2}\uFE0F","\u{1F6D2}","\u{1F6CD}\uFE0F","\u{1F381}","\u{1F388}","\u{1F38F}","\u{1F380}","\u{1FA84}","\u{1F38A}","\u{1F389}","\u{1F38E}","\u{1F3EE}","\u{1F390}","\u2709\uFE0F","\u{1F4E9}","\u{1F4E8}","\u{1F4E7}","\u{1F4E6}","\u{1F3F7}\uFE0F","\u{1F4EA}","\u{1F4EB}","\u{1F4EC}","\u{1F4ED}","\u{1F4EE}","\u{1F4EF}","\u{1F4DC}","\u{1F4C3}","\u{1F4C4}","\u{1F4D1}","\u{1F9FE}","\u{1F4CA}","\u{1F4C8}","\u{1F4C9}","\u{1F5D2}\uFE0F","\u{1F5D3}\uFE0F","\u{1F4C5}","\u{1F4C6}","\u{1F4C7}","\u{1F4C1}","\u{1F4C2}","\u{1F5C2}\uFE0F","\u{1F5DE}\uFE0F","\u{1F4F0}","\u{1F4D3}","\u{1F4D5}","\u{1F4D7}","\u{1F4D8}","\u{1F4D9}","\u{1F4DA}","\u{1F4D6}","\u{1F516}","\u{1F517}","\u{1F4CE}","\u{1F587}\uFE0F","\u{1F4D0}","\u{1F4CF}","\u{1F4CC}","\u{1F4CD}","\u2702\uFE0F","\u{1F58A}\uFE0F","\u{1F58B}\uFE0F","\u2712\uFE0F","\u{1F58C}\uFE0F","\u{1F58D}\uFE0F","\u{1F4DD}","\u270F\uFE0F","\u{1F50D}","\u{1F50E}","\u{1F512}","\u{1F513}","\u{1F50F}","\u{1F510}","\u{1F511}","\u{1F5DD}\uFE0F","\u{1F528}","\u{1FA93}","\u26CF\uFE0F","\u{1F527}","\u{1FA9B}","\u{1F529}","\u2699\uFE0F","\u{1F5DC}\uFE0F","\u2696\uFE0F","\u{1F9AF}","\u26D3\uFE0F","\u{1FA9D}","\u{1F9F0}","\u{1F9F2}"]},{id:"symbols",name:"Symbols & Badges",icon:"\u2728",emojis:["\u{1F4AF}","\u{1F525}","\u2728","\u26A1","\u2B50","\u{1F31F}","\u{1F4AB}","\u{1F4A5}","\u{1F4A2}","\u{1F4A6}","\u{1F4A8}","\u{1F573}\uFE0F","\u{1F4A3}","\u{1F4AC}","\u{1F5E8}\uFE0F","\u{1F5EF}\uFE0F","\u{1F4AD}","\u{1F4A4}","\u{1F310}","\u{1F514}","\u{1F515}","\u{1F4E3}","\u{1F4E2}","\u26A0\uFE0F","\u26D4","\u{1F6AB}","\u2705","\u274C","\u2B55","\u2757","\u2753","\u2755","\u2754","\u203C\uFE0F","\u2049\uFE0F","\u2714\uFE0F","\u2611\uFE0F","\u2795","\u2796","\u2797","\u2716\uFE0F","\u{1F7F0}","\u267E\uFE0F","\u{1F4B2}","\u{1F4B1}","\xA9\uFE0F","\xAE\uFE0F","\u2122\uFE0F","\u{1F534}","\u{1F7E2}","\u{1F535}","\u{1F7E1}","\u{1F7E0}","\u{1F7E3}","\u26AB","\u26AA","\u{1F7E4}","\u{1F53A}","\u{1F53B}","\u{1F680}"]}],kt=fe.flatMap(a=>a.emojis);var ai=/\.(jpe?g|png|gif|webp|bmp|heic|heif|avif|tiff?)$/i;function Oe(a){return a.type.startsWith("image/")||!a.type&&ai.test(a.name||"")}var si=1920,ri=.82;async function oi(a){if(typeof createImageBitmap=="function")try{let t=await createImageBitmap(a,{imageOrientation:"from-image"});return{width:t.width,height:t.height,draw:(i,n,s)=>i.drawImage(t,0,0,n,s)}}catch{}let e=URL.createObjectURL(a);try{let t=await new Promise((i,n)=>{let s=new Image;s.onload=()=>i(s),s.onerror=n,s.src=e});return{width:t.naturalWidth,height:t.naturalHeight,draw:(i,n,s)=>i.drawImage(t,0,0,n,s)}}catch{return null}finally{setTimeout(()=>URL.revokeObjectURL(e),1e3)}}async function ci(a){return Promise.race([li(a),new Promise(e=>setTimeout(()=>e(a),1e4))])}async function li(a){try{let e=(a.type||"").toLowerCase();if(e==="image/gif"||e==="image/svg+xml"||e==="image/png"&&a.size<1.5*1024*1024||a.size<400*1024&&/jpe?g|webp/.test(e))return a;let t=await oi(a);if(!t||!t.width||!t.height)return a;let i=Math.min(1,si/Math.max(t.width,t.height)),n=Math.max(1,Math.round(t.width*i)),s=Math.max(1,Math.round(t.height*i)),r=document.createElement("canvas");r.width=n,r.height=s;let o=r.getContext("2d");if(!o)return a;o.fillStyle="#ffffff",o.fillRect(0,0,n,s),t.draw(o,n,s);let l=await new Promise(c=>r.toBlob(c,"image/jpeg",ri));if(!l||l.size>=a.size)return a;let h=(a.name||"photo").replace(/\.[^.]+$/,"")||"photo";return new File([l],`${h}.jpg`,{type:"image/jpeg",lastModified:Date.now()})}catch{return a}}async function hi(a,e,t){let i={};t?.visitorId&&(i["x-zentry-visitor"]=t.visitorId),t?.visitorToken&&(i["x-zentry-visitor-token"]=t.visitorToken);let n=await fetch(`${a}/api/upload/sign`,{method:"POST",headers:i});if(!n.ok)throw new Error(`sign ${n.status}`);let s=await n.json(),r=new FormData;r.append("file",e),r.append("api_key",s.apiKey),r.append("timestamp",String(s.timestamp)),r.append("signature",s.signature),r.append("folder",s.folder),r.append("allowed_formats",s.allowedFormats);let o=await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(s.cloudName)}/image/upload`,{method:"POST",body:r}),l=await o.json().catch(()=>({}));if(!o.ok||!l?.secure_url)throw new Error(l?.error?.message||`Cloudinary ${o.status}`);return l.secure_url.replace(/\.(heic|heif|avif|bmp|tiff?)$/i,".jpg")}async function di(a,e,t){let i=new FormData;i.append("file",e);let n={};t?.visitorId&&(n["x-zentry-visitor"]=t.visitorId),t?.visitorToken&&(n["x-zentry-visitor-token"]=t.visitorToken);let s=await fetch(`${a}/api/upload`,{method:"POST",headers:n,body:i}),r=await s.json().catch(()=>({}));if(!s.ok||!r?.url)throw s.status===413?new Error("This picture is too large. Please choose a smaller one."):new Error(r?.error||`Upload failed (${s.status})`);return r.url}async function _t(a,e,t){let i=typeof e=="string"?e:"",n=typeof e=="object"&&e!==null?e:t,s=Oe(a),r=s?await ci(a):a;if(s)try{return await hi(i,r,n)}catch(o){console.warn("[upload] direct upload failed, trying the server route:",o)}try{return await di(i,r,n)}catch(o){let l=o instanceof Error?o.message:"";throw new Error(l&&!/^Upload failed|^sign|^Cloudinary/.test(l)?l:"Couldn't send the picture. Please check your connection and try again.")}}var pi="com|net|org|io|co|ai|app|dev|site|online|store|shop|tech|info|biz|me|xyz|tv|cc|us|uk|ca|au|de|fr|in|pk|ae|sa|eu|gov|edu",ue=new RegExp([String.raw`[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}`,String.raw`https?:\/\/[^\s<>"']+`,String.raw`www\.[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+[^\s<>"']*`,String.raw`(?:[A-Za-z0-9-]+\.)+(?:${pi})(?![\w-])(?:[/?#][^\s<>"']*)?`].join("|"),"gi");function fi(a){let e=a;for(;;){let t=e[e.length-1];if(!t)return e;if(`.,;:!?'"*`.includes(t)){e=e.slice(0,-1);continue}if(t===")"&&(e.match(/\(/g)||[]).length<(e.match(/\)/g)||[]).length){e=e.slice(0,-1);continue}if(t==="]"&&(e.match(/\[/g)||[]).length<(e.match(/\]/g)||[]).length){e=e.slice(0,-1);continue}return e}}function Tt(a){let e=[],t=0;ue.lastIndex=0;for(let i=ue.exec(a);i;i=ue.exec(a)){let n=i.index;if(!/^(https?:\/\/|www\.)/i.test(i[0])&&!i[0].includes("@")&&n>0&&/[\w@./-]/.test(a[n-1])){ue.lastIndex=n+1;continue}let s=fi(i[0]);if(!s)continue;let r=n+s.length;ue.lastIndex=r;let o;s.includes("@")&&!/^https?:\/\//i.test(s)&&!s.includes("/")?o=`mailto:${s}`:/^https?:\/\//i.test(s)?o=s:o=`https://${s}`,n>t&&e.push({text:a.slice(t,n)}),e.push({text:s,href:o}),t=r}return t<a.length&&e.push({text:a.slice(t)}),e}var ge={enabled:!0,title:"Welcome! \u{1F44B}",intro:"Tell us a little about yourself so the right person can help.",name:"optional",email:"required",topics:[],topic_required:!1},ui=["off","optional","required"];function je(a){let e=a&&typeof a=="object"?a:{},t=(s,r)=>ui.includes(s)?s:r,i=(s,r,o)=>typeof s=="string"&&s.trim()?s.trim().slice(0,o):r,n=Array.isArray(e.topics)?Array.from(new Set(e.topics.map(s=>String(s??"").trim().slice(0,40)).filter(Boolean))).slice(0,12):[];return{enabled:typeof e.enabled=="boolean"?e.enabled:ge.enabled,title:i(e.title,ge.title,80),intro:i(e.intro,ge.intro,240),name:t(e.name,ge.name),email:t(e.email,ge.email),topics:n,topic_required:!!e.topic_required&&n.length>0}}function Et(a){return a.name==="off"&&a.email==="off"&&a.topics.length===0}var X=a=>`<svg viewBox="0 0 24 24" width="28" height="28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">${a}</svg>`,It=[{id:"smile_bubble",label:"Smile",svg:X('<path fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="M6 3h12a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-6.2l-4.13 3.1A1.05 1.05 0 0 1 6 20.26V18a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Zm2.3 7.7a.95.95 0 0 0-.43 1.27A4.7 4.7 0 0 0 12 14.6a4.7 4.7 0 0 0 4.13-2.63.95.95 0 1 0-1.7-.84A2.8 2.8 0 0 1 12 12.7a2.8 2.8 0 0 1-2.43-1.57.95.95 0 0 0-1.27-.43Z"/>')},{id:"dots_bubble",label:"Typing",svg:X('<path fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="M12 3c4.97 0 9 3.58 9 8s-4.03 8-9 8c-.97 0-1.9-.14-2.78-.39l-3.9 1.73a.8.8 0 0 1-1.09-.94l.85-3.17A7.6 7.6 0 0 1 3 11c0-4.42 4.03-8 9-8ZM8 12.3a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6Zm4 0a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6Zm5.3-1.3a1.3 1.3 0 1 1-2.6 0 1.3 1.3 0 0 1 2.6 0Z"/>')},{id:"double_bubble",label:"Conversation",svg:X('<path fill="currentColor" opacity=".5" d="M10 2.5h9A2.5 2.5 0 0 1 21.5 5v5.5A2.5 2.5 0 0 1 19 13h-.6v1.9a.5.5 0 0 1-.83.37L15.6 13H10a2.5 2.5 0 0 1-2.5-2.5V5A2.5 2.5 0 0 1 10 2.5Z"/><path fill="currentColor" d="M5 8.5h9a2.5 2.5 0 0 1 2.5 2.5v5a2.5 2.5 0 0 1-2.5 2.5H9.4l-2.97 2.27a.5.5 0 0 1-.83-.4V18.5H5A2.5 2.5 0 0 1 2.5 16v-5A2.5 2.5 0 0 1 5 8.5Z"/>')},{id:"smile_line",label:"Message",svg:X('<path fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="M6 3h12a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-6.2l-4.13 3.1A1.05 1.05 0 0 1 6 20.26V18a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Zm1.75 5a1 1 0 0 0 0 2h8.5a1 1 0 1 0 0-2h-8.5Zm0 4a1 1 0 1 0 0 2h5a1 1 0 1 0 0-2h-5Z"/>')},{id:"headset",label:"Support",svg:X('<path d="M4.5 14v-2a7.5 7.5 0 0 1 15 0v2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><rect x="3" y="12.5" width="5" height="6.5" rx="2.2" fill="currentColor"/><rect x="16" y="12.5" width="5" height="6.5" rx="2.2" fill="currentColor"/><path d="M18.5 19v.4a2.6 2.6 0 0 1-2.6 2.6H13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>')},{id:"help",label:"Help",svg:X('<path fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="M12 2.5a9.5 9.5 0 1 1 0 19 9.5 9.5 0 0 1 0-19Zm0 13.6a1.15 1.15 0 1 0 0 2.3 1.15 1.15 0 0 0 0-2.3Zm.1-9.6c-1.9 0-3.4 1.2-3.65 2.95a.95.95 0 0 0 1.88.27c.1-.75.8-1.32 1.75-1.32 1.02 0 1.72.62 1.72 1.42 0 .62-.33.98-1.15 1.48-.98.6-1.65 1.27-1.65 2.5v.3a.95.95 0 1 0 1.9 0v-.25c0-.45.2-.68.9-1.11 1-.62 1.9-1.42 1.9-2.94 0-1.9-1.6-3.3-3.6-3.3Z"/>')}];function Ct(a){return It.find(e=>e.id===a)||It[0]}var St=[{id:"classic",label:"Messenger",description:"A home screen with a gradient header, cards and tabs. Like Intercom."},{id:"compact",label:"Compact",description:"Opens straight into the chat, slim header, a labelled launcher. Like Zendesk.",chatFirst:!0},{id:"livechat",label:"Live chat",description:"Straight into the chat, team photos and online status up top. Like Tawk.to.",chatFirst:!0},{id:"modern",label:"Modern",description:"Two-colour gradient, very round cards and bubbles. Like Chatway."},{id:"minimal",label:"Minimal",description:"White header, hairline borders, colour only on actions. Quiet and modern."},{id:"solid",label:"Solid",description:"Flat brand-colour header, rounded launcher and pill buttons. Bold and friendly."},{id:"midnight",label:"Midnight",description:"Dark header and launcher with your colour as the accent. Premium."}];function Ue(a){return St.some(e=>e.id===a)}function De(a){return St.some(e=>e.id===a&&e.chatFirst)}function At(a){return a==="auto"||a==="light"||a==="dark"}function Lt(a){return typeof a=="string"&&/^#[0-9a-f]{6}$/i.test(a)}function Bt(a){if(!a)return"";let e=a.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");return e=e.replace(/```(?:[a-zA-Z0-9_-]+)?\n([\s\S]*?)```/g,(i,n)=>`<pre class="zentry-code-block chatify-code-block"><code>${n.trim()}</code></pre>`),e=e.replace(/`([^`\n]+)`/g,'<code class="zentry-inline-code chatify-inline-code">$1</code>'),e=e.replace(/!\[([^\]]*)\]\((https?:\/\/(?:(?!&(?:quot|#0?39|apos|lt|gt);)[^\s)"'<>])+)\)/g,'<img src="$2" alt="$1" class="zentry-art-img chatify-art-img" style="max-width:100%;border-radius:6px;margin:6px 0;" />'),e=e.replace(/\[([^\]]+)\]\((https?:\/\/(?:(?!&(?:quot|#0?39|apos|lt|gt);)[^\s)"'<>])+|mailto:(?:(?!&(?:quot|#0?39|apos|lt|gt);)[^\s)"'<>])+)\)/g,'<a href="$2" target="_blank" rel="noopener noreferrer" class="zentry-art-link chatify-art-link">$1</a>'),e=e.replace(/^#### (.*$)/gim,'<h5 style="margin:10px 0 4px;font-size:12.5px;font-weight:700;color:var(--w-ink);">$1</h5>'),e=e.replace(/^### (.*$)/gim,'<h4 style="margin:12px 0 4px;font-size:13px;font-weight:700;color:var(--w-ink);">$1</h4>'),e=e.replace(/^## (.*$)/gim,'<h3 style="margin:14px 0 6px;font-size:14px;font-weight:700;color:var(--w-ink);">$1</h3>'),e=e.replace(/^# (.*$)/gim,'<h2 style="margin:16px 0 6px;font-size:15px;font-weight:700;color:var(--w-ink);">$1</h2>'),e=e.replace(/\*\*\*([^*]+)\*\*\*/g,"<strong><em>$1</em></strong>"),e=e.replace(/\*\*([^*]+)\*\*/g,"<strong>$1</strong>"),e=e.replace(/__([^_]+)__/g,"<strong>$1</strong>"),e=e.replace(/\*([^*\s](?:[^*]*?[^*\s])?)\*/g,"<em>$1</em>"),e=e.replace(/(^|\s)_([^_]+)_(\s|$|[.,!?;:])/g,"$1<em>$2</em>$3"),e=e.replace(/^(&gt;|>)\s?(.*$)/gim,'<blockquote style="border-left:3px solid var(--w-brand);margin:6px 0;padding-left:8px;color:var(--w-ink-2);font-style:italic;">$2</blockquote>'),e=e.replace(/((?:^(?:[-*]\s+.+)(?:\n|$))+)/gm,i=>`<ul style="margin:6px 0 8px 18px;padding:0;">${i.trim().split(`
`).map(s=>s.replace(/^[-*]\s+/,"").trim()).filter(Boolean).map(s=>`<li style="margin-bottom:3px;">${s}</li>`).join("")}</ul>`),e=e.replace(/((?:^\d+\.\s+.+(?:\n|$))+)/gm,i=>`<ol style="margin:6px 0 8px 18px;padding:0;">${i.trim().split(`
`).map(s=>s.replace(/^\d+\.\s+/,"").trim()).filter(Boolean).map(s=>`<li style="margin-bottom:3px;">${s}</li>`).join("")}</ol>`),e=e.split(/\n\s*\n/).map(i=>{let n=i.trim();return n?n.startsWith("<h")||n.startsWith("<pre")||n.startsWith("<ul")||n.startsWith("<ol")||n.startsWith("<blockquote")?n:`<p style="margin:0 0 8px 0;line-height:1.55;">${n.replace(/\n/g,"<br/>")}</p>`:""}).join(""),e}var Ee="#2e5bff";var Y="https://orbatai.com",Mt=new Set(["chat-system-wabd.vercel.app"]),gi=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,Fe=class a{constructor(){this.container=null;this.shadow=null;this.conversationId=null;this.conversationStatus="open";this.visitorName="";this.visitorEmail="";this.handoffStatus="bot_active";this.handoffSummary=null;this.handoffReason=null;this.assignedAgentId=null;this.assignedAgentName=null;this.expectedWaitText=null;this.nextOpenLabel=null;this.aiAssistEnabled=!1;this.handoffConnecting=!1;this.isOpen=!1;this.activeTab="home";this.unreadCount=0;this.messages=[];this.faqs=[];this.sections=[];this.activeSectionId=null;this.faqSearchQuery="";this.isPreChatCompleted=!1;this.prechat=je(void 0);this.csatRated=!1;this.pendingAttachment=null;this.netBannerTimer=null;this.activeEmojiCategory="smileys";this.emojiSearchQuery="";this.currentPopupMsgId=null;this.popupCloseTimer=null;this.workspaceAgents=[];this.presenceInterval=null;this.audioCtx=null;this.botTyping=!1;this.agentTyping=!1;this.agentTypingTimer=null;this.forceNewConversation=!1;this.storageSuffix="";this.visitorToken=null;this.sessionTopic=null;this.sessionConversation=null;this.sessionPromise=null;this.liveSocket=null;this.liveConnected=!1;this.visibilityListenerBound=!1;this.pollTimer=null;this.agentsPollTimer=null;this.previousConversations=[];this.pageEnteredAt=Date.now();this.lastReportedUrl=typeof window<"u"?window.location.href:"";this.referrerSource=typeof document<"u"&&document.referrer||"";this.routeChangeDebounceTimer=null;this.lastMessagesHtml="";this.lastMessagesTail=null;this.lastMessageId=null;this.config=this.parseConfig();let e=this.config.workspaceId?`_${this.config.workspaceId.slice(0,8)}`:"";this.storageSuffix=e,this.visitorId=this.getOrCreateVisitorId(e);try{this.visitorToken=localStorage.getItem(`zentry_visitor_token${e}`)}catch{}this.conversationId=localStorage.getItem(`zentry_conversation_id${e}`)||localStorage.getItem(`zentry_conversation_id${e}`)||localStorage.getItem(`chatify_conversation_id${e}`),this.visitorName=localStorage.getItem(`zentry_visitor_name${e}`)||localStorage.getItem(`zentry_visitor_name${e}`)||localStorage.getItem(`chatify_visitor_name${e}`)||"",this.visitorEmail=localStorage.getItem(`zentry_visitor_email${e}`)||localStorage.getItem(`zentry_visitor_email${e}`)||localStorage.getItem(`chatify_visitor_email${e}`)||"";let t=!1;try{t=localStorage.getItem(`zentry_prechat_done${e}`)==="1"}catch{}(this.visitorEmail||t)&&(this.isPreChatCompleted=!0),this.initDOM(),this.fetchWorkspaceSettingsAndApply().then(async i=>{if((this.shadow?.getElementById("zentryLauncherBtn")||this.shadow?.getElementById("chatifyLauncherBtn"))?.classList.remove("is-loading"),i===!1||(this.bindGlobalTriggers(),!await this.ensureSession()))return;this.initVisitorTracking(),this.initSPANavigationTracking();let s=this.sessionConversation;if(!this.conversationId&&s?.id){this.conversationId=s.id,this.conversationStatus=s.status||"open";try{localStorage.setItem(`zentry_conversation_id${e}`,s.id),localStorage.setItem(`chatify_conversation_id${e}`,s.id)}catch{}}this.conversationId&&await this.loadMessageHistory(),this.conversationId?this.subscribeToRealtime():this.visitorId&&this.subscribeToVisitorConversations(e);try{let r=sessionStorage.getItem(`zentry_widget_open${e}`)||sessionStorage.getItem(`zentry_widget_open${e}`)||sessionStorage.getItem(`chatify_widget_open${e}`),o=sessionStorage.getItem(`zentry_widget_tab${e}`)||sessionStorage.getItem(`zentry_widget_tab${e}`)||sessionStorage.getItem(`chatify_widget_tab${e}`);r==="1"&&(this.open(o||"messages"),this.scrollToBottom(!1))}catch{}this.initProactiveWelcome(),this.loadPreviousConversations()})}getTimeOnPage(){return Math.max(0,Math.round((Date.now()-this.pageEnteredAt)/1e3))}isImageAttachment(e){return e?e.includes("cloudinary.com")&&(e.includes("/image/upload/")||!e.includes("/raw/upload/"))?!0:!!e.match(/\.(jpeg|jpg|png|webp|gif|svg|avif|bmp)(\?.*)?$/i):!1}parseConfig(){let e=document.currentScript;e||(e=document.querySelector('script[src*="widget.js"]'));let t=typeof window<"u"?new URLSearchParams(window.location.search):null,i=t?.get("workspaceId")||t?.get("ws")||t?.get("zentry_workspace")||t?.get("chatify_workspace"),n=t?.get("logo")||t?.get("logoUrl")||t?.get("logo_url"),s=t?.get("show_launcher_logo")??t?.get("launcher_logo"),r=t?.get("widget_icon")||t?.get("icon"),o=e?.getAttribute("data-api-url")||"";if(!o&&e?.src)try{let l=new URL(e.src);l.origin&&l.origin!=="null"&&(o=Mt.has(l.hostname)?Y:l.origin)}catch{}if(!o&&typeof window<"u"){let l=window.location.hostname;(l==="localhost"||l==="127.0.0.1")&&(o=window.location.origin)}o||(o=Y);try{Mt.has(new URL(o).hostname)&&(o=Y)}catch{}return{workspaceId:i||e?.getAttribute("data-workspace-id")||null,backendUrl:e?.getAttribute("data-backend-url")||t?.get("backend_url")||void 0,title:e?.getAttribute("data-title")||"Support Team",subtitle:e?.getAttribute("data-subtitle")||"We reply in under 5 minutes",primaryColor:e?.getAttribute("data-color")||Ee,position:e?.getAttribute("data-position")||"bottom-right",helpTabLabel:e?.getAttribute("data-help-label")||"Help",showHelpTab:e?.getAttribute("data-show-help")!=="false",helpTabIcon:e?.getAttribute("data-help-icon")||"\u{1F4D6}",logoUrl:n||e?.getAttribute("data-logo-url")||e?.getAttribute("data-logo")||void 0,showLauncherLogo:s!==null?s!=="false":e?.getAttribute("data-show-launcher-logo")!=="false",widgetIcon:r||e?.getAttribute("data-widget-icon")||e?.getAttribute("data-icon")||void 0,widgetDesign:(()=>{let l=t?.get("widget_design")||e?.getAttribute("data-design");return Ue(l)?l:void 0})(),welcomeText:e?.getAttribute("data-welcome-text")||void 0,businessName:e?.getAttribute("data-business-name")||e?.getAttribute("data-company-name")||void 0,customDomain:e?.getAttribute("data-custom-domain")||void 0,apiUrl:o,offsetBottom:e?.hasAttribute("data-offset-bottom")?parseInt(e.getAttribute("data-offset-bottom"),10):20,offsetSide:e?.hasAttribute("data-offset-side")?parseInt(e.getAttribute("data-offset-side"),10):20,zIndex:e?.hasAttribute("data-z-index")?parseInt(e.getAttribute("data-z-index"),10):2147483e3,enableProactiveWelcome:e?.getAttribute("data-enable-proactive-welcome")!=="false"&&e?.getAttribute("data-proactive-welcome")!=="false",proactiveDelaySeconds:Math.max(8,parseInt(e?.getAttribute("data-proactive-delay")||"8",10))}}resetSession(){let e=this.config.workspaceId?`_${this.config.workspaceId.slice(0,8)}`:"";localStorage.removeItem(`zentry_visitor_id${e}`),localStorage.removeItem(`zentry_visitor_token${e}`),localStorage.removeItem(`zentry_prechat_done${e}`),localStorage.removeItem(`zentry_conversation_id${e}`),localStorage.removeItem(`zentry_visitor_name${e}`),localStorage.removeItem(`zentry_visitor_email${e}`),localStorage.removeItem(`zentry_visitor_id${e}`),localStorage.removeItem(`chatify_visitor_id${e}`),localStorage.removeItem(`zentry_conversation_id${e}`),localStorage.removeItem(`chatify_conversation_id${e}`),localStorage.removeItem(`zentry_visitor_name${e}`),localStorage.removeItem(`chatify_visitor_name${e}`),localStorage.removeItem(`zentry_visitor_email${e}`),localStorage.removeItem(`chatify_visitor_email${e}`),window.location.reload()}async fetchWorkspaceSettingsAndApply(){if(!this.config.workspaceId)return!0;try{let{data:e,error:t}=await this.rpcCall("fn_get_workspace_config",{p_workspace_id:this.config.workspaceId}),i=typeof t?.status=="number"?t.status:void 0,n=String(t?.message||""),s=!t&&!e||i===403||i===404||/workspace_unavailable|not_found/i.test(n);if(t&&!s)return console.warn("[Zen-try] Temporary error fetching workspace config; keeping launcher visible:",t),!0;if(s||!e)return console.warn("[Zen-try] Workspace is suspended, inactive, or not found. Widget will not load."),this.container&&this.container.parentNode&&this.container.parentNode.removeChild(this.container),!1;if(e.name&&(this.config.businessName=e.name),e.plan==="enterprise"||e.plan==="legacy"){let r=this.shadow?.getElementById("zentryBrandingBadge");r&&(r.style.display="none")}return e.brand_color&&(this.config.primaryColor=e.brand_color),e.greeting_title&&(this.config.title=e.greeting_title),e.greeting_message&&(this.config.subtitle=e.greeting_message,this.config.welcomeText=e.greeting_message),typeof e.launcher_offset_bottom=="number"?this.config.offsetBottom=e.launcher_offset_bottom:e.navbar_trigger_config?.launcher_offset_bottom!==void 0&&(this.config.offsetBottom=Number(e.navbar_trigger_config.launcher_offset_bottom)),typeof e.launcher_offset_side=="number"?this.config.offsetSide=e.launcher_offset_side:e.navbar_trigger_config?.launcher_offset_side!==void 0&&(this.config.offsetSide=Number(e.navbar_trigger_config.launcher_offset_side)),typeof e.widget_z_index=="number"?this.config.zIndex=e.widget_z_index:e.navbar_trigger_config?.widget_z_index!==void 0&&(this.config.zIndex=Number(e.navbar_trigger_config.widget_z_index)),typeof e.enable_proactive_welcome=="boolean"?this.config.enableProactiveWelcome=e.enable_proactive_welcome:e.navbar_trigger_config?.enable_proactive_welcome!==void 0&&(this.config.enableProactiveWelcome=!!e.navbar_trigger_config.enable_proactive_welcome),typeof e.proactive_delay_seconds=="number"?this.config.proactiveDelaySeconds=Math.max(8,e.proactive_delay_seconds):e.navbar_trigger_config?.proactive_delay_seconds!==void 0&&(this.config.proactiveDelaySeconds=Math.max(8,Number(e.navbar_trigger_config.proactive_delay_seconds))),e.widget_position&&(this.config.position=e.widget_position==="left"?"bottom-left":"bottom-right"),e.help_center_tab_label&&(this.config.helpTabLabel=e.help_center_tab_label),e.logo_url&&(this.config.logoUrl=e.logo_url),typeof e.show_launcher_logo=="boolean"&&(this.config.showLauncherLogo=e.show_launcher_logo),e.navbar_trigger_config?.widget_icon?this.config.widgetIcon=e.navbar_trigger_config.widget_icon:e.widget_icon&&(this.config.widgetIcon=e.widget_icon),Ue(e.navbar_trigger_config?.widget_design)&&(this.config.widgetDesign=e.navbar_trigger_config.widget_design),Lt(e.navbar_trigger_config?.widget_secondary_color)&&(this.config.secondaryColor=e.navbar_trigger_config.widget_secondary_color),At(e.navbar_trigger_config?.widget_color_mode)&&(this.config.colorMode=e.navbar_trigger_config.widget_color_mode),this.prechat=je(e.navbar_trigger_config?.prechat),this.applyPrechatConfig(),e.greeting_title&&(this.config.greetingTitle=e.greeting_title),typeof e.show_help_tab=="boolean"&&(this.config.showHelpTab=e.show_help_tab),e.help_center_tab_icon&&(this.config.helpTabIcon=e.help_center_tab_icon),e.custom_domain&&(e.custom_domain_status==="live"||e.custom_domain_status==="verified")&&(this.config.customDomain=e.custom_domain),e.slug&&(this.config.helpSlug=e.slug),!this.config.backendUrl&&e.socket_url&&(this.config.backendUrl=String(e.socket_url)),e.navbar_trigger_config&&(this.config.navbarTriggerConfig=e.navbar_trigger_config),e.business_hours&&(this.config.businessHours=e.business_hours),Array.isArray(e.agents)&&(this.workspaceAgents=e.agents),this.initNavbarAutoTrigger(),this.updateThemeAndTexts(),this.renderAvatarsStack(this.workspaceAgents),this.updatePresenceAndTexts(),this.subscribeToAgentsRealtime(),await this.loadWorkspaceArticles(),!0}catch(e){return console.warn("[Zen-try] Could not fetch workspace config:",e),!0}}isOutsideBusinessHours(e){if(!e||!e.enabled||!e.schedule)return!1;try{let t=new Date,i=e.timezone||"UTC",n=new Intl.DateTimeFormat("en-US",{weekday:"long",timeZone:i}).format(t).toLowerCase(),s=e.schedule[n];if(!s||!s.enabled)return!0;let r=new Intl.DateTimeFormat("en-GB",{hour:"2-digit",minute:"2-digit",hour12:!1,timeZone:i}).format(t);return r<s.start||r>s.end}catch{return!1}}async loadWorkspaceArticles(){if(!this.config.workspaceId){this.sections=[],this.faqs=[],this.renderFaqList();return}try{let e=[],t=[],i=(this.config.apiUrl||"").replace(/\/$/,"");if(i)try{let h=await fetch(`${i}/api/widget/help?workspaceId=${encodeURIComponent(this.config.workspaceId)}`,{cache:"no-store"});if(h.ok){let c=await h.json().catch(()=>null),f=c&&typeof c=="object"&&"data"in c?c.data:c;f&&(e=f.articles||[],t=f.sections||[])}}catch(h){console.warn("[Zen-try] Failed to fetch help articles:",h)}this.faqs=e.map(h=>({id:h.id,slug:h.slug,q:h.title,summary:h.summary||"",a:h.content,category:h.section?.name||h.section_id&&h.category||"Other",icon:h.section?.icon||"\u{1F4DA}",sectionId:h.section_id||null,order_index:h.order_index??0}));let n={},s=0;this.faqs.forEach(h=>{h.sectionId?n[h.sectionId]=(n[h.sectionId]||0)+1:s++});let r=t.filter(h=>(n[h.id]||0)>0).map(h=>({id:h.id,name:h.name,description:h.description||null,icon:h.icon||"\u{1F4DA}",order_index:h.order_index??0,slug:h.slug||"",articleCount:n[h.id]||0})),o=new Set,l=[];for(let h of r){let c=(h.name||"").trim().toLowerCase();c&&!o.has(c)&&(o.add(c),l.push(h))}if(s>0){let h="Other";o.has("other")&&(h="More Articles"),o.add(h.toLowerCase()),l.push({id:"__other__",name:h,description:null,icon:"\u{1F4DA}",order_index:9999,slug:"other",articleCount:s})}this.sections=l,this.renderFaqList(),this.updateThemeAndTexts(),this.initNavbarAutoTrigger()}catch(e){console.warn("[Zen-try] Failed to fetch dynamic articles or sections:",e),this.sections=[],this.faqs=[],this.renderFaqList(),this.updateThemeAndTexts(),this.initNavbarAutoTrigger()}}formatChatMarkdown(e){let t=l=>{let h=this.escapeHTML(l);return h=h.replace(/`([^`]+)`/g,'<code class="zentry-inline-code chatify-inline-code">$1</code>'),h=h.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)"'<>]+|mailto:[^\s)"'<>]+)\)/g,'<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'),h=h.split(/(<a\b[^>]*>[\s\S]*?<\/a>|<[^>]+>)/).map((c,f)=>f%2?c:this.linkifyHTML(this.unescapeHTML(c))).join(""),h=h.replace(/\*\*([^*]+?)\*\*/g,"<strong>$1</strong>"),h=h.replace(/(^|[^*\w])\*(?!\s)([^*]+?)\*(?!\w)/g,"$1<em>$2</em>"),h},i=[],n=null,s=[],r=()=>{s.length&&i.push(`<p>${s.map(t).join("<br/>")}</p>`),s=[]},o=()=>{n&&i.push(`<${n.tag}>${n.items.map(l=>`<li>${l}</li>`).join("")}</${n.tag}>`),n=null};for(let l of e.replace(/\r\n/g,`
`).split(`
`)){let h=l.trim(),c=h.match(/^(#{1,4})\s+(.+)$/),f=h.match(/^[-*•]\s+(.+)$/),b=h.match(/^\d+[.)]\s+(.+)$/);if(!h)r(),o();else if(c){r(),o();let g=Math.min(Math.max(c[1].length,2)+1,5);i.push(`<h${g}>${t(c[2].replace(/\*\*/g,""))}</h${g}>`)}else if(/^(-{3,}|\*{3,})$/.test(h))r(),o(),i.push("<hr/>");else if(f||b){r();let g=f?"ul":"ol";n&&n.tag!==g&&o(),n||(n={tag:g,items:[]}),n.items.push(t((f||b)[1]))}else n&&/^\s{2,}/.test(l)?n.items[n.items.length-1]+=`<br/>${t(h)}`:(o(),s.push(h))}return r(),o(),i.join("")}formatMarkdownToHtml(e){return Bt(e)}renderArticleItem(e,t,i){let n=encodeURIComponent(e.slug||e.id||""),s="";this.config.workspaceId&&n&&(this.config.customDomain?s=`https://${this.config.customDomain.replace(/^https?:\/\//i,"").replace(/\/$/,"")}/${n}`:s=`${(this.config.apiUrl||Y).replace(/\/$/,"")}/help/${encodeURIComponent(this.config.workspaceId)}/${n}`);let r=this.safeUrl(s);return`
      <div class="zentry-faq-item chatify-faq-item" data-idx="${t}" data-id="${this.escapeHTML(e.id||"")}" data-slug="${this.escapeHTML(e.slug||"")}">
        ${i&&e.category?`
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
            ${r?`
              <a href="${r}" target="_blank" rel="noopener noreferrer" class="zentry-article-ext-link chatify-article-ext-link" title="Open full article in dedicated Help Center">
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
    `}renderFaqList(){let e=this.shadow?.getElementById("faqList");if(!e)return;let t=this.shadow?.getElementById("cardHelpSearch");if(t&&(t.style.display=this.config.showHelpTab!==!1&&this.faqs.length>0?"block":"none"),this.faqs.length===0){e.innerHTML="";return}let i=(this.faqSearchQuery||"").toLowerCase().trim();if(i){let r=this.faqs.filter(o=>o.q.toLowerCase().includes(i)||o.summary&&o.summary.toLowerCase().includes(i)||o.a.toLowerCase().includes(i)||o.category&&o.category.toLowerCase().includes(i));if(r.length===0){e.innerHTML=`
          <div id="faqNoResults" style="padding: 32px 16px; text-align: center; color: var(--w-ink-3); font-size: 13px;">
            <div style="font-size: 24px; margin-bottom: 8px;">\u{1F50D}</div>
            <p style="margin: 0; font-weight: 500;">No articles match &ldquo;${this.escapeHTML(i)}&rdquo;.</p>
          </div>
        `;return}e.innerHTML=`
        <div style="font-size: 11.5px; font-weight: 600; color: var(--w-ink-3); margin-bottom: 10px; padding-left: 2px;">
          ${r.length} article${r.length===1?"":"s"} found
        </div>
        <div class="zentry-faq-list chatify-faq-list">
          ${r.map((o,l)=>this.renderArticleItem(o,l,!0)).join("")}
        </div>
      `,this.bindFaqListeners();return}if(!this.activeSectionId){if(this.sections.length===0){e.innerHTML=`
          <div class="zentry-faq-list chatify-faq-list">
            ${this.faqs.map((r,o)=>this.renderArticleItem(r,o,!0)).join("")}
          </div>
        `,this.bindFaqListeners();return}e.innerHTML=`
        <div class="zentry-section-list chatify-section-list">
          ${this.sections.map(r=>`
            <div class="zentry-section-card chatify-section-card" data-section-id="${this.escapeHTML(r.id)}">
              <div class="zentry-section-card chatify-section-card-icon">${this.escapeHTML(r.icon||"\u{1F4DA}")}</div>
              <div class="zentry-section-card chatify-section-card-info">
                <h4 class="zentry-section-card chatify-section-card-title">${this.escapeHTML(r.name)}</h4>
                <p class="zentry-section-card chatify-section-card-desc">
                  ${r.description?this.escapeHTML(r.description):`${r.articleCount||0} article${(r.articleCount||0)===1?"":"s"}`}
                </p>
              </div>
              <span class="zentry-section-card chatify-section-card-arrow">\u203A</span>
            </div>
          `).join("")}
        </div>
      `,this.bindFaqListeners();return}let n=this.sections.find(r=>r.id===this.activeSectionId)||{id:this.activeSectionId,name:"Articles",icon:"\u{1F4DA}",description:null,articleCount:0},s=this.faqs.filter(r=>r.sectionId===this.activeSectionId||this.activeSectionId==="__other__"&&!r.sectionId);e.innerHTML=`
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
          `:s.map((r,o)=>this.renderArticleItem(r,o,!1)).join("")}
        </div>
      </div>
    `,this.bindFaqListeners()}bindFaqListeners(){let e=this.shadow?.getElementById("faqBackToSections");e&&(e.onclick=()=>{this.activeSectionId=null,this.renderFaqList()}),this.shadow?.querySelectorAll(".zentry-section-card, .chatify-section-card").forEach(t=>{t.onclick=()=>{let i=t.getAttribute("data-section-id");i&&(this.activeSectionId=i,this.renderFaqList())}}),this.shadow?.querySelectorAll(".zentry-faq-item, .chatify-faq-item").forEach(t=>{t.onclick=i=>{i.target.closest(".zentry-vote-btn, .chatify-vote-btn")||i.target.closest(".zentry-article-ext-link, .chatify-article-ext-link")||t.classList.toggle("open")}}),this.shadow?.querySelectorAll(".zentry-vote-btn, .chatify-vote-btn").forEach(t=>{t.onclick=async i=>{i.stopPropagation();let n=i.currentTarget,s=n.getAttribute("data-art-id"),r=n.getAttribute("data-helpful")==="true",o=n.closest(".zentry-vote-group, .chatify-vote-group");if(o&&(o.innerHTML='<span style="font-size:11px; color:var(--w-brand); font-weight:600;">\u2713 Feedback sent</span>'),s&&this.config.workspaceId)try{await this.rpcCall("fn_submit_article_feedback",{p_article_id:s,p_workspace_id:this.config.workspaceId,p_visitor_id:this.visitorId,p_is_helpful:r,p_feedback_text:null})}catch{}}})}getOrCreateVisitorId(e){let t=localStorage.getItem(`zentry_visitor_id${e}`)||localStorage.getItem(`chatify_visitor_id${e}`);return!t||!gi.test(t)?(t=this.newVisitorId(),localStorage.setItem(`zentry_visitor_id${e}`,t),localStorage.setItem(`chatify_visitor_id${e}`,t)):localStorage.setItem(`zentry_visitor_id${e}`,t),t}newVisitorId(){try{if(typeof crypto<"u"&&typeof crypto.randomUUID=="function")return crypto.randomUUID()}catch{}return"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,e=>{let t=Math.random()*16|0;return(e==="x"?t:t&3|8).toString(16)})}static errorText(e){return String(e?.message||e||"")}async rpcCall(e,t={}){let i=(this.config.apiUrl||"").replace(/\/$/,"");if(!i)return{data:null,error:{message:"Widget API URL is not configured."}};try{let n=await fetch(`${i}/api/widget/rpc/${encodeURIComponent(e)}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(t)}),s=await n.json().catch(()=>null);return n.ok?{data:(s&&typeof s=="object"&&"data"in s?s.data:s)??null,error:null}:{data:null,error:{message:s?.message||s?.error||`HTTP ${n.status}`,code:n.status===429?"P0001":void 0,status:n.status}}}catch(n){return{data:null,error:{message:n?.message||"Network error reaching widget API."}}}}ensureSession(){return this.config.workspaceId?this.visitorToken&&this.sessionTopic?Promise.resolve(!0):(this.sessionPromise||(this.sessionPromise=this.openSession().finally(()=>{this.sessionPromise=null})),this.sessionPromise):Promise.resolve(!1)}async openSession(){if(!this.config.workspaceId)return!1;for(let e=0;e<3;e++){let t=null,i=null;try{let n=await this.rpcCall("fn_widget_session",{p_workspace_id:this.config.workspaceId,p_visitor_id:this.visitorId,p_token:this.visitorToken});t=n.data,i=n.error}catch(n){i=n}if(!i&&t){if(t.token){this.visitorToken=t.token;try{localStorage.setItem(`zentry_visitor_token${this.storageSuffix}`,t.token)}catch{}}return this.sessionTopic=t.topic||null,this.sessionConversation=t.conversation||null,!0}if(/workspace_unavailable/.test(a.errorText(i)))return this.container&&this.container.parentNode&&this.container.parentNode.removeChild(this.container),!1;if(!/visitor_session_invalid/.test(a.errorText(i)))return console.warn("[Zen-try] Could not start the chat session:",a.errorText(i)),!1;if(e===0){await new Promise(s=>setTimeout(s,400));let n=null;try{n=localStorage.getItem(`zentry_visitor_token${this.storageSuffix}`)}catch{}if(n&&n!==this.visitorToken){this.visitorToken=n;continue}}this.resetVisitorIdentity()}return!1}resetVisitorIdentity(){let e=this.storageSuffix;this.visitorId=this.newVisitorId(),this.visitorToken=null,this.sessionTopic=null,this.sessionConversation=null,this.forgetConversation();try{localStorage.setItem(`zentry_visitor_id${e}`,this.visitorId),localStorage.setItem(`chatify_visitor_id${e}`,this.visitorId),localStorage.removeItem(`zentry_visitor_token${e}`)}catch{}}forgetConversation(){let e=this.storageSuffix;this.conversationId=null,this.conversationStatus="open",this.messages=[];try{localStorage.removeItem(`zentry_conversation_id${e}`),localStorage.removeItem(`chatify_conversation_id${e}`)}catch{}}async widgetRpc(e,t={}){if(!await this.ensureSession())throw new Error("Chat session unavailable");let{data:i,error:n}=await this.rpcCall(e,{p_visitor_id:this.visitorId,p_token:this.visitorToken,...t});if(n)throw/visitor_session_invalid/.test(n.message||"")&&(this.sessionTopic=null),n;return i}async saveVisitorDetails(e){await this.widgetRpc("fn_widget_update_visitor",{p_name:this.visitorName||null,p_email:this.visitorEmail||null,p_current_url:window.location.href,p_user_agent:navigator.userAgent,p_location:e})}async initVisitorTracking(){this.pageEnteredAt=Date.now(),this.lastReportedUrl=window.location.href,this.referrerSource=document.referrer||"";let e=Intl.DateTimeFormat().resolvedOptions().timeZone||"Unknown";try{try{await this.saveVisitorDetails(e)}catch(i){console.warn("[Zen-try] Visitor details not saved:",a.errorText(i))}await this.recordPage(window.location.href,document.title||null,0);try{await this.widgetRpc("fn_widget_update_meta",{p_timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||null,p_language:navigator.language||null})}catch{}}catch(i){console.warn("[Zen-try] Visitor tracking error:",i)}(async()=>{try{let i=await fetch(`${this.config.apiUrl||""}/api/visitor/geo`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({visitor_id:this.visitorId,visitor_token:this.visitorToken}),signal:AbortSignal.timeout(6e3)}),n=i.ok?await i.json():null;n?.location&&await this.saveVisitorDetails(n.location)}catch{}})(),setInterval(()=>{this.sendHeartbeat()},2e4);let t=()=>{try{if(!this.visitorToken)return;let i=(this.config.apiUrl||"").replace(/\/$/,"");if(!i)return;fetch(`${i}/api/widget/offline`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({p_visitor_id:this.visitorId,p_token:this.visitorToken}),keepalive:!0}).catch(()=>{})}catch{}};window.addEventListener("beforeunload",t),window.addEventListener("offline",()=>this.updateNetworkBanner(!1)),window.addEventListener("online",()=>this.updateNetworkBanner(!0)),window.addEventListener("pagehide",t)}async sendHeartbeat(){try{let e={p_current_url:window.location.href,p_page_title:document.title||null,p_referrer:this.referrerSource||null,p_time_on_page:this.getTimeOnPage()};await this.widgetRpc("fn_widget_heartbeat",e)}catch{}}async recordPage(e,t,i){try{await this.widgetRpc("fn_widget_record_page",{p_url:e,p_title:t,p_referrer:this.referrerSource||null,p_duration_seconds:i})}catch{}}initSPANavigationTracking(){let e=()=>{window.location.href!==this.lastReportedUrl&&(this.routeChangeDebounceTimer&&clearTimeout(this.routeChangeDebounceTimer),this.routeChangeDebounceTimer=setTimeout(async()=>{let s=window.location.href;if(s===this.lastReportedUrl)return;let r=this.getTimeOnPage(),o=this.lastReportedUrl;this.pageEnteredAt=Date.now(),this.referrerSource=o||this.referrerSource,this.lastReportedUrl=s;let l=document.title||null;await this.recordPage(s,l,r)},500))},t=history.pushState;history.pushState=function(...n){let s=t.apply(this,n);return e(),s};let i=history.replaceState;history.replaceState=function(...n){let s=i.apply(this,n);return e(),s},window.addEventListener("popstate",e),window.addEventListener("hashchange",e)}playIncomingSound(){try{if(!this.audioCtx){let n=window.AudioContext||window.webkitAudioContext;this.audioCtx=new n}this.audioCtx.state==="suspended"&&this.audioCtx.resume();let e=this.audioCtx.currentTime,t=this.audioCtx.createOscillator(),i=this.audioCtx.createGain();t.type="sine",t.frequency.setValueAtTime(784,e),t.frequency.setValueAtTime(1046.5,e+.1),i.gain.setValueAtTime(0,e),i.gain.linearRampToValueAtTime(.2,e+.02),i.gain.exponentialRampToValueAtTime(.001,e+.35),t.connect(i),i.connect(this.audioCtx.destination),t.start(e),t.stop(e+.35)}catch{}}subscribeToRealtime(){this.conversationId&&(this.startLiveUpdates(),this.liveSocket?.connected&&this.liveSocket.emit("conversation:join",{conversationId:this.conversationId}))}receiveMessage(e){if(e.is_internal||this.messages.some(i=>i.id===e.id))return;let t=this.messages.findIndex(i=>(i.id.startsWith("temp-")||i.pending)&&i.sender_type===e.sender_type&&(i.content===e.content||i.attachment_url===e.attachment_url));if(t!==-1){this.messages[t]=e,this.renderMessages();return}e.sender_type!=="visitor"&&(this.botTyping=!1,this.agentTyping=!1),this.messages.push(e),this.renderMessages(),e.sender_type!=="visitor"&&(this.playIncomingSound(),!this.isOpen||this.activeTab!=="messages"?(this.unreadCount+=1,this.updateUnreadBadge(),this.markMessagesAsDelivered(),this.isOpen||this.showMessagePopup(e)):this.markMessagesAsRead())}updateMessage(e){let t=this.messages.findIndex(n=>n.id===e.id);if(t===-1)return;let i={...this.messages[t],...e};this.sameMessage(this.messages[t],i)||(this.messages[t]=i,this.renderMessages())}sameMessage(e,t){let i=n=>n?Date.parse(n)||n:null;return e.content===t.content&&(e.attachment_url||null)===(t.attachment_url||null)&&i(e.read_at)===i(t.read_at)&&i(e.delivered_at)===i(t.delivered_at)&&JSON.stringify(e.metadata||null)===JSON.stringify(t.metadata||null)}removeMessage(e){if(!e)return;let t=this.messages.length;this.messages=this.messages.filter(i=>i.id!==e),this.messages.length!==t&&this.renderMessages()}updateConversationStatus(e){!e||e===this.conversationStatus||(this.conversationStatus=e,this.renderMessages())}startLiveUpdates(){let e=(this.config.backendUrl||"").trim().replace(/\/+$/,""),t=e?e.replace(/\/api\/v1$/,""):"";if(t&&!this.liveSocket&&this.visitorToken&&this.config.workspaceId)try{this.liveSocket=pe(`${t}/realtime`,{auth:{visitorId:this.visitorId,visitorToken:this.visitorToken,workspaceId:this.config.workspaceId},transports:["websocket","polling"],reconnection:!0,reconnectionAttempts:5,reconnectionDelay:2e3}),this.liveSocket.on("connect",()=>{this.liveConnected=!0,this.conversationId&&this.liveSocket?.emit("conversation:join",{conversationId:this.conversationId})}),this.liveSocket.on("disconnect",()=>{this.liveConnected=!1}),this.liveSocket.on("message:new",i=>{i&&this.onLiveMessage({op:"INSERT",message:i})}),this.liveSocket.on("message:updated",i=>{i&&this.onLiveMessage({op:"UPDATE",message:i})}),this.liveSocket.on("message:deleted",i=>{i?.id&&this.onLiveMessage({op:"DELETE",message:{id:i.id,conversation_id:i.conversationId}})}),this.liveSocket.on("conversation:updated",i=>{i&&this.onLiveConversation({op:"UPDATE",conversation:i})}),this.liveSocket.on("typing:update",i=>{i?.conversationId!==this.conversationId||i?.userId===this.visitorId||(i?.isTyping?(this.agentTyping=!0,this.agentTypingTimer&&clearTimeout(this.agentTypingTimer),this.agentTypingTimer=setTimeout(()=>{this.agentTyping=!1,this.renderMessages()},4e3)):(this.agentTypingTimer&&clearTimeout(this.agentTypingTimer),this.agentTyping=!1),this.renderMessages())})}catch{this.liveSocket=null}this.visibilityListenerBound||(this.visibilityListenerBound=!0,document.addEventListener("visibilitychange",()=>{document.visibilityState==="visible"&&this.pollSoon()})),this.schedulePoll()}onLiveMessage(e){let t=e?.message;if(t?.id){if(t.conversation_id&&t.conversation_id!==this.conversationId){e?.op==="INSERT"&&this.loadPreviousConversations();return}e?.op==="DELETE"?this.removeMessage(t.id):e?.op==="UPDATE"?this.updateMessage(t):this.receiveMessage(t)}}handoffSnapshot(){return[this.handoffStatus,this.aiAssistEnabled,this.assignedAgentId,this.nextOpenLabel,this.expectedWaitText].join("|")}onLiveConversation(e){let t=e?.conversation;if(t?.id)if(t.id===this.conversationId){let i=this.handoffSnapshot(),n=this.conversationStatus;t.handoff_status&&(this.handoffStatus=t.handoff_status),t.ai_assist!==void 0&&(this.aiAssistEnabled=!!t.ai_assist),t.assigned_agent_id!==void 0&&(this.assignedAgentId=t.assigned_agent_id),this.applyHandoffDetails(t),this.updateConversationStatus(t.status),this.conversationStatus===n&&this.handoffSnapshot()!==i&&this.renderMessages()}else!this.conversationId&&!this.forceNewConversation&&t.status!=="closed"&&this.adoptConversation(t.id,t.status)}async adoptConversation(e,t){this.conversationId=e,this.conversationStatus=t||"open";try{localStorage.setItem(`zentry_conversation_id${this.storageSuffix}`,e),localStorage.setItem(`chatify_conversation_id${this.storageSuffix}`,e)}catch{}await this.loadMessageHistory(),this.subscribeToRealtime()}schedulePoll(){this.pollTimer&&clearTimeout(this.pollTimer);let e=typeof document<"u"&&document.visibilityState==="hidden",t=this.isOpen&&this.activeTab==="messages",i=e?6e4:this.conversationId?this.liveConnected?3e4:t?4e3:12e3:45e3;this.pollTimer=setTimeout(()=>this.poll(),i)}pollSoon(){this.sessionTopic&&(this.pollTimer&&clearTimeout(this.pollTimer),this.pollTimer=setTimeout(()=>this.poll(),300))}async poll(){this.pollTimer=null;try{if(this.conversationId)await this.syncMessages();else if(!this.forceNewConversation&&this.visitorToken){let{data:e,error:t}=await this.rpcCall("fn_widget_session",{p_workspace_id:this.config.workspaceId,p_visitor_id:this.visitorId,p_token:this.visitorToken});if(t&&/workspace_unavailable/.test(a.errorText(t))){this.container&&this.container.parentNode&&this.container.parentNode.removeChild(this.container);return}let i=e?.conversation;i?.id&&i.status!=="closed"&&!this.conversationId&&await this.adoptConversation(i.id,i.status)}}catch{}this.schedulePoll()}async syncMessages(){let e=this.conversationId;if(!e)return;let t;try{t=await this.widgetRpc("fn_widget_messages",{p_conversation_id:e})}catch(l){/conversation_not_found/.test(a.errorText(l))&&(this.forgetConversation(),this.renderMessages());return}if(e!==this.conversationId)return;let i=this.handoffSnapshot(),n=Array.isArray(t?.messages)?t.messages:[],s=new Map(n.map(l=>[l.id,l])),r=n.length?n[0].created_at:null;for(let l of[...this.messages])l.id.startsWith("temp-")||l.pending||s.has(l.id)||r&&l.created_at<r||this.removeMessage(l.id);for(let l of n){let h=this.messages.find(c=>c.id===l.id);h?this.sameMessage(h,{...h,...l})||this.updateMessage(l):this.receiveMessage(l)}t?.conversation?.handoff_status&&(this.handoffStatus=t.conversation.handoff_status),t?.conversation?.handoff_summary&&(this.handoffSummary=t.conversation.handoff_summary),t?.conversation?.handoff_reason&&(this.handoffReason=t.conversation.handoff_reason),t?.conversation?.ai_assist!==void 0&&(this.aiAssistEnabled=!!t.conversation.ai_assist),t?.conversation?.assigned_agent_id&&(this.assignedAgentId=t.conversation.assigned_agent_id),this.applyHandoffDetails(t?.conversation);let o=this.conversationStatus;this.updateConversationStatus(t?.conversation?.status),this.conversationStatus===o&&this.handoffSnapshot()!==i&&this.renderMessages()}async loadMessageHistory(){if(!this.conversationId)return;let e=null;try{let t=await this.widgetRpc("fn_widget_messages",{p_conversation_id:this.conversationId});e=Array.isArray(t?.messages)?t.messages:[],t?.conversation?.status&&(this.conversationStatus=t.conversation.status),t?.conversation?.handoff_status&&(this.handoffStatus=t.conversation.handoff_status),t?.conversation?.handoff_summary&&(this.handoffSummary=t.conversation.handoff_summary),t?.conversation?.handoff_reason&&(this.handoffReason=t.conversation.handoff_reason),t?.conversation?.ai_assist!==void 0&&(this.aiAssistEnabled=!!t.conversation.ai_assist),t?.conversation?.assigned_agent_id&&(this.assignedAgentId=t.conversation.assigned_agent_id),this.applyHandoffDetails(t?.conversation),t?.conversation?.csat_rating!=null&&(this.csatRated=!0)}catch(t){/conversation_not_found/.test(a.errorText(t))&&(this.forgetConversation(),this.renderMessages());return}if(e){if(this.messages=e,this.renderMessages(),this.isOpen&&this.activeTab==="messages")this.unreadCount=0,this.markMessagesAsRead();else if(this.unreadCount=this.messages.filter(t=>t.sender_type!=="visitor"&&!t.read_at).length,!this.isOpen&&this.unreadCount>0){let t=[...this.messages].reverse().find(i=>i.sender_type!=="visitor"&&!i.read_at);if(t)try{sessionStorage.getItem(`chatify_popup_dismissed_${t.id}`)||this.showMessagePopup(t)}catch{}}this.updateUnreadBadge()}}async markMessagesAsDelivered(){if(this.conversationId)try{await this.widgetRpc("fn_widget_mark",{p_conversation_id:this.conversationId,p_read:!1})}catch{}}async markMessagesAsRead(){if(this.conversationId&&this.messages.some(e=>e.sender_type!=="visitor"&&!e.read_at&&!String(e.id).startsWith("temp-")))try{await this.widgetRpc("fn_widget_mark",{p_conversation_id:this.conversationId,p_read:!0})}catch{}}async ensureConversation(){if(this.conversationId)return this.conversationId;let e=this.config.workspaceId?`_${this.config.workspaceId.slice(0,8)}`:"",t=await this.widgetRpc("fn_widget_start_conversation",{p_force_new:this.forceNewConversation});this.forceNewConversation=!1,this.conversationId=t.id,this.conversationStatus=t.status||"open";try{localStorage.setItem(`zentry_conversation_id${e}`,t.id),localStorage.setItem(`chatify_conversation_id${e}`,t.id)}catch{}return this.subscribeToRealtime(),t.id}async sendMessage(e,t){if(!e.trim()&&!t)return;let i=await this.ensureConversation(),n={id:"temp-"+Date.now(),sender_type:"visitor",content:e.trim()||(t?"Sent a picture":""),attachment_url:t||null,created_at:new Date().toISOString(),pending:!0};this.messages.push(n),this.renderMessages();let s=null,r=null;this.conversationStatus="open";try{s=await this.widgetRpc("fn_widget_send_message",{p_conversation_id:i,p_content:e.trim(),p_attachment_url:t||null})}catch(o){r=o}if(r){if(console.error("[Zen-try] Error sending message:",r),String(r?.message||r||"").includes("rate_limited")){this.messages=this.messages.filter(c=>c.id!==n.id);let h=this.shadow?.getElementById("chatifyInput");h&&((!h.value||!h.value.trim())&&(h.value=e),this.adjustTextareaHeight(),h.focus()),this.messages.push({id:"rate-limit-"+Date.now(),sender_type:"agent",content:"You're sending messages too fast. Please wait a moment.",created_at:new Date().toISOString(),metadata:{system_event:"rate_limit"}}),this.renderMessages();return}n.pending=!1,this.renderMessages();return}if(s){let o=this.messages.findIndex(l=>l.id===n.id);o!==-1&&(this.messages[o]=s,this.renderMessages())}if(this.config.workspaceId){let o=setTimeout(()=>this.setBotTyping(!0),700),l=JSON.stringify({conversation_id:i,workspace_id:this.config.workspaceId,message_id:s?.id,...this.visitorToken?{visitor_token:this.visitorToken}:{}}),h=f=>fetch(`${f}/api/ai/auto-respond`,{method:"POST",headers:{"Content-Type":"application/json"},body:l}),c=this.config.apiUrl||"";h(c).catch(f=>{if(c===Y)throw f;return console.warn("[Zen-try] Reply service unreachable at",c||window.location.origin,"- retrying",Y),h(Y)}).catch(f=>console.error("[Zen-try] Could not reach the reply service:",f)).finally(()=>{clearTimeout(o),this.setBotTyping(!1)})}}setBotTyping(e){this.botTyping!==e&&(this.botTyping=e,this.renderMessages())}subscribeToTyping(){this.conversationId&&this.liveSocket?.connected&&this.liveSocket.emit("conversation:join",{conversationId:this.conversationId})}startNewConversation(){let e=this.config.workspaceId?`_${this.config.workspaceId.slice(0,8)}`:"",t=this.conversationId;t&&this.liveSocket?.connected&&this.liveSocket.emit("conversation:leave",{conversationId:t}),this.conversationId=null,this.conversationStatus="open",this.forceNewConversation=!0,this.csatRated=!1,this.messages=[],this.unreadCount=0,this.botTyping=!1,this.agentTyping=!1;try{localStorage.removeItem(`chatify_conversation_id${e}`),localStorage.removeItem(`zentry_conversation_id${e}`),sessionStorage.removeItem(`chatify_conversation_id${e}`),sessionStorage.removeItem(`zentry_conversation_id${e}`)}catch{}this.subscribeToTyping(),this.updateUnreadBadge(),this.renderMessages(),this.loadPreviousConversations(),setTimeout(()=>{this.shadow?.getElementById("chatifyTextarea")?.focus({preventScroll:!0})},100)}async loadPreviousConversations(){if(this.visitorId){try{let e=await this.widgetRpc("fn_widget_conversations");this.previousConversations=Array.isArray(e)?e:[]}catch{}this.renderPreviousConversations()}}renderPreviousConversations(){let e=this.shadow?.getElementById("cardPrevConvs"),t=this.shadow?.getElementById("prevConvsList");if(!e||!t)return;let i=this.previousConversations.filter(n=>n.id!==this.conversationId&&n.last_message).slice(0,5);if(i.length===0){e.style.display="none";return}e.style.display="block",t.innerHTML=i.map(n=>{let r=(n.last_message?.content||"").replace(/^#{1,6}\s+/gm,"").replace(/\*\*|__|`/g,"").replace(/\s+/g," ").trim()||(n.last_message?.attachment_url?"Sent a picture":"Conversation"),o=this.formatRelativeTime(new Date(n.updated_at||n.created_at)),l=n.status==="closed";return`<button type="button" class="chatify-prev-item" data-id="${this.escapeHTML(n.id)}"><span class="chatify-prev-text"><span class="chatify-prev-snippet">${this.escapeHTML(r.length>70?r.slice(0,70)+"\u2026":r)}</span><span class="chatify-prev-meta">${this.escapeHTML(o)} \xB7 ${l?"Closed":"Open"}</span></span><span class="chatify-prev-chevron">\u203A</span></button>`}).join(""),t.querySelectorAll(".chatify-prev-item").forEach(n=>{n.addEventListener("click",()=>{this.openPreviousConversation(n.getAttribute("data-id")||"")})})}async openPreviousConversation(e){if(!e)return;let t=this.previousConversations.find(n=>n.id===e),i=this.config.workspaceId?`_${this.config.workspaceId.slice(0,8)}`:"";this.conversationId=e,this.conversationStatus=t?.status||"open",this.csatRated=!!t?.csat_rating,this.messages=[],this.botTyping=!1,this.agentTyping=!1;try{localStorage.setItem(`zentry_conversation_id${i}`,e),localStorage.setItem(`chatify_conversation_id${i}`,e)}catch{}this.subscribeToRealtime(),this.switchTab("messages"),await this.loadMessageHistory(),this.renderPreviousConversations()}async submitCSAT(e,t){if(!this.conversationId)return;this.csatRated=!0;let i=typeof e=="number"?e>=4?"good":"bad":e,n=i==="good"?5:1;try{let s=await fetch(`${this.config.apiUrl||""}/api/csat/rate`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({conversation_id:this.conversationId,visitor_id:this.visitorId,visitor_token:this.visitorToken,rating:i,comment:t?t.trim():void 0})});if(!s.ok)throw new Error(`CSAT ${s.status}`)}catch(s){console.warn("[Zen-try] Failed to save CSAT rating:",s)}this.renderMessages()}renderLauncherIconHTML(){let e=this.config.widgetIcon==="custom_logo"||!this.config.widgetIcon&&this.config.showLauncherLogo!==!1&&!!this.config.logoUrl,t=this.safeUrl(this.config.logoUrl,!0);if(e&&t){let i=this.safeUrl(Ne||xt,!0);return`<img src="${t}" alt="Chat" class="chatify-launcher-icon chatify-custom-logo" onerror="this.src='${i}';this.classList.remove('chatify-custom-logo');" />`}return`<span class="chatify-launcher-icon chatify-preset-icon">${Ct(this.config.widgetIcon).svg}</span>`}darkModeCSS(){let e=`
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
      `:""}initDOM(){this.container=document.createElement("div"),this.container.id="zentry-widget-root",this.container.className="zentry-widget-root chatify-widget-root",this.container.setAttribute("data-zentry-root","true"),document.body.appendChild(this.container),this.shadow=this.container.attachShadow({mode:"open"});let e=window.visualViewport;if(e&&this.container){let d=this.container,w=()=>{d.style.setProperty("--w-vvh",`${Math.round(e.height)}px`),d.style.setProperty("--w-vv-top",`${Math.round(e.offsetTop)}px`)};w(),e.addEventListener("resize",w),e.addEventListener("scroll",w)}["keydown","keyup","keypress"].forEach(d=>{this.shadow?.addEventListener(d,w=>{w.stopPropagation()}),this.container?.addEventListener(d,w=>{w.stopPropagation()})}),this.shadow.addEventListener("keydown",d=>{let w=d;if(w.key==="Escape"){let _=this.shadow?.getElementById("chatifyEmojiPicker");if(!!(_&&_.style.display!=="none"&&_.style.display!=="")){w.preventDefault(),this.closeEmojiPicker(),this.shadow?.getElementById("chatifyTextarea")?.focus();return}let z=this.shadow?.getElementById("chatifyImageLightbox");if(!!(z&&z.style.display==="flex")){w.preventDefault(),this.closeLightbox();return}this.isOpen&&(w.preventDefault(),this.close())}});let t=document.createElement("style");t.id="chatify-theme-style",t.textContent=this.generateCSS(),this.shadow.appendChild(t);let i=document.createElement("button");i.className=this.config.workspaceId?"chatify-launcher is-loading":"chatify-launcher",i.id="zentryLauncherBtn",i.setAttribute("data-chatify-launcher","1"),i.setAttribute("aria-label","Open chat"),i.innerHTML=`
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
    `,i.onclick=()=>this.toggleWindow(),this.shadow.appendChild(i);let n=document.createElement("div");n.className="chatify-message-popup",n.id="chatifyMessagePopup",n.style.display="none",n.innerHTML=`
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
    `,this.shadow.appendChild(s),this.shadow.getElementById("homeCloseBtn")?.addEventListener("click",()=>this.toggleWindow()),this.shadow.getElementById("chatifyCloseBtn")?.addEventListener("click",()=>this.toggleWindow()),this.shadow.getElementById("chatifyNewChatBtn")?.addEventListener("click",()=>this.startNewConversation()),this.shadow.getElementById("helpCloseBtn")?.addEventListener("click",()=>this.toggleWindow()),this.shadow.querySelectorAll(".chatify-nav-item").forEach(d=>{d.addEventListener("click",w=>{let _=w.currentTarget.getAttribute("data-tab");this.switchTab(_)})}),this.shadow.getElementById("btnGoToMessages")?.addEventListener("click",()=>{this.switchTab("messages")}),this.shadow.getElementById("cardStartChat")?.addEventListener("click",d=>{d.target?.closest("#btnGoToMessages")||this.switchTab("messages")}),this.shadow.getElementById("btnContinueConversation")?.addEventListener("click",()=>{this.switchTab("messages")}),this.shadow.getElementById("cardOpenConv")?.addEventListener("click",d=>{d.target?.closest("#btnContinueConversation, #btnStartNewChat")||this.switchTab("messages")}),this.shadow.getElementById("btnStartNewChat")?.addEventListener("click",d=>{d.stopPropagation(),this.switchTab("messages"),setTimeout(()=>{this.shadow?.getElementById("chatifyTextarea")?.focus({preventScroll:!0})},120)}),this.shadow.getElementById("btnBackToHome")?.addEventListener("click",()=>{this.switchTab("home")}),this.shadow.getElementById("chatifyPopupCloseBtn")?.addEventListener("click",d=>{d.stopPropagation(),this.dismissMessagePopup()}),this.shadow.getElementById("chatifyPopupCard")?.addEventListener("click",d=>{d.target?.closest("#chatifyPopupCloseBtn")||(this.hideMessagePopup(!1),this.open("messages"))});let r=this.shadow.getElementById("chatifyPopupInput"),o=this.shadow.getElementById("chatifyPopupSendBtn");r?.addEventListener("input",()=>{o?.classList.toggle("active",!!r.value.trim())}),r?.addEventListener("keydown",async d=>{d.key==="Enter"&&(d.preventDefault(),await this.sendPopupReply())}),o?.addEventListener("click",async d=>{d.stopPropagation(),await this.sendPopupReply()}),this.shadow.getElementById("homeSearchTrigger")?.addEventListener("click",()=>{this.switchTab("help"),setTimeout(()=>{this.shadow?.getElementById("helpSearchInput")?.focus({preventScroll:!0})},100)}),this.bindFaqListeners(),this.shadow.getElementById("helpSearchInput")?.addEventListener("input",d=>{this.faqSearchQuery=d.target.value,this.renderFaqList()}),this.bindPrechatHandlers();let h=this.shadow.getElementById("chatifySendBtn"),c=this.shadow.getElementById("chatifyTextarea"),f=this.shadow.getElementById("chatifyImageBtn"),b=this.shadow.getElementById("chatifyImageInput"),g=this.shadow.getElementById("chatifyEmojiBtn"),E=this.shadow.getElementById("chatifyPreviewRemove");this.shadow.getElementById("chatifyPreviewRetry")?.addEventListener("click",()=>this.handleSendMessage());let C=this.shadow.getElementById("chatifyLightboxClose"),k=this.shadow.getElementById("chatifyImageLightbox");f?.addEventListener("click",()=>{b?.click()}),b?.addEventListener("change",d=>{let w=d.target.files?.[0];w&&this.handleSelectImage(w)}),E?.addEventListener("click",()=>{this.clearPendingAttachment()}),g?.addEventListener("click",d=>{d.stopPropagation(),this.toggleEmojiPicker()}),this.renderEmojiGrid(),this.shadow.addEventListener("click",d=>{let w=d.target;!w.closest("#chatifyEmojiPicker")&&!w.closest("#chatifyEmojiBtn")&&this.closeEmojiPicker()}),c?.addEventListener("paste",d=>{let w=d.clipboardData?.items;if(w){for(let _=0;_<w.length;_++)if(w[_].type.startsWith("image/")){let B=w[_].getAsFile();if(B){d.preventDefault(),this.handleSelectImage(B);break}}}}),C?.addEventListener("click",()=>this.closeLightbox()),k?.addEventListener("click",d=>{d.target.id==="chatifyImageLightbox"&&this.closeLightbox()}),h?.addEventListener("click",()=>this.handleSendMessage()),c?.addEventListener("input",()=>{this.adjustTextareaHeight()}),c?.addEventListener("keydown",d=>{d.key==="Enter"&&!d.shiftKey?(d.preventDefault(),this.handleSendMessage()):d.key==="Enter"&&d.shiftKey&&setTimeout(()=>this.adjustTextareaHeight(),0)}),this.renderAvatarsStack(this.workspaceAgents),this.updatePresenceAndTexts(),this.presenceInterval||(this.presenceInterval=setInterval(()=>{this.updatePresenceAndTexts()},6e4))}handleSelectImage(e){if(e.size>40*1024*1024){this.showAttachmentProblem(e.name,"This picture is too large. Choose one under 40 MB.");return}if(!Oe(e)){this.showAttachmentProblem(e.name,"Choose a picture (JPEG, PNG, HEIC, WEBP or GIF).");return}this.pendingAttachment?.previewUrl&&URL.revokeObjectURL(this.pendingAttachment.previewUrl);let t=URL.createObjectURL(e);this.pendingAttachment={file:e,previewUrl:t};let i=this.shadow?.getElementById("chatifyAttachmentPreview"),n=this.shadow?.getElementById("chatifyPreviewImg"),s=this.shadow?.getElementById("chatifyPreviewName"),r=this.shadow?.getElementById("chatifyPreviewSize");i&&n&&(n.src=t,s&&(s.textContent=e.name),r&&(r.textContent=`${(e.size/1024).toFixed(0)} KB \xB7 Ready to send`),n.style.display="",i.dataset.state="ready",i.style.display="flex")}setAttachmentState(e,t){let i=this.shadow?.getElementById("chatifyAttachmentPreview"),n=this.shadow?.getElementById("chatifyPreviewSize");i&&(i.dataset.state=e,n&&t&&(n.textContent=t))}showAttachmentProblem(e,t){this.clearPendingAttachment();let i=this.shadow?.getElementById("chatifyAttachmentPreview"),n=this.shadow?.getElementById("chatifyPreviewImg"),s=this.shadow?.getElementById("chatifyPreviewName");i&&(n&&(n.style.display="none"),s&&(s.textContent=e),i.style.display="flex",this.setAttachmentState("failed",t),i.dataset.retry="no")}updateNetworkBanner(e){let t=this.shadow?.getElementById("chatifyNetBanner"),i=this.shadow?.getElementById("chatifyNetBannerText");if(!(!t||!i)){if(this.netBannerTimer&&clearTimeout(this.netBannerTimer),!e){t.dataset.tone="warn",i.textContent="You're offline. Messages will send when you reconnect.",t.hidden=!1;return}t.hidden||(t.dataset.tone="ok",i.textContent="Back online.",this.netBannerTimer=setTimeout(()=>{t.hidden=!0},2500))}}clearPendingAttachment(){this.pendingAttachment?.previewUrl&&URL.revokeObjectURL(this.pendingAttachment.previewUrl),this.pendingAttachment=null;let e=this.shadow?.getElementById("chatifyAttachmentPreview");e&&(e.style.display="none",e.dataset.state="ready",delete e.dataset.retry);let t=this.shadow?.getElementById("chatifyImageInput");t&&(t.value="")}toggleEmojiPicker(){let e=this.shadow?.getElementById("chatifyEmojiPicker");if(!e)return;let t=e.style.display==="block";e.style.display=t?"none":"block"}closeEmojiPicker(){let e=this.shadow?.getElementById("chatifyEmojiPicker");e&&(e.style.display="none")}renderEmojiGrid(){let e=this.shadow?.getElementById("chatifyEmojiGrid"),t=this.shadow?.getElementById("chatifyEmojiCategories");if(!e)return;t&&t.children.length===0&&(t.innerHTML="",fe.forEach(s=>{let r=document.createElement("button");r.type="button",r.className=`chatify-emoji-cat-btn ${s.id===this.activeEmojiCategory?"active":""}`,r.textContent=s.icon,r.title=s.name,r.addEventListener("click",o=>{o.stopPropagation(),this.activeEmojiCategory=s.id,this.shadow?.querySelectorAll(".chatify-emoji-cat-btn").forEach(h=>h.classList.remove("active")),r.classList.add("active");let l=this.shadow?.getElementById("chatifyEmojiSearch");l&&(l.value=""),this.emojiSearchQuery="",this.renderEmojiGrid()}),t.appendChild(r)}),this.shadow?.getElementById("chatifyEmojiSearch")?.addEventListener("input",s=>{this.emojiSearchQuery=s.target.value.toLowerCase().trim(),this.renderEmojiGrid()})),e.innerHTML="";let i=[];if(this.emojiSearchQuery)i=kt;else{let n=fe.find(s=>s.id===this.activeEmojiCategory);i=n?n.emojis:fe[0].emojis}i.forEach(n=>{let s=document.createElement("button");s.type="button",s.className="chatify-emoji-btn",s.textContent=n,s.addEventListener("click",r=>{r.stopPropagation(),this.insertEmoji(n)}),e.appendChild(s)})}adjustTextareaHeight(){let e=this.shadow?.getElementById("chatifyTextarea");if(!e)return;e.style.height="auto";let t=window.getComputedStyle(e),i=parseFloat(t.lineHeight)||19.6,n=parseFloat(t.paddingTop)||11,s=parseFloat(t.paddingBottom)||11,r=parseFloat(t.borderTopWidth)||1,o=parseFloat(t.borderBottomWidth)||1,l=n+s+r+o,h=Math.round(i*1+l),c=Math.round(i*5+l),f=e.scrollHeight;if(f>c)e.style.height=`${c}px`,e.style.overflowY="auto";else{let b=Math.max(h,f);e.style.height=`${b}px`,e.style.overflowY="hidden"}}insertEmoji(e){let t=this.shadow?.getElementById("chatifyTextarea");if(!t)return;let i=t.selectionStart||t.value.length,n=t.selectionEnd||t.value.length,s=t.value;t.value=s.substring(0,i)+e+s.substring(n),t.selectionStart=t.selectionEnd=i+e.length,this.adjustTextareaHeight(),t.focus(),this.closeEmojiPicker()}openLightbox(e){let t=this.shadow?.getElementById("chatifyImageLightbox"),i=this.shadow?.getElementById("chatifyLightboxImg"),n=this.shadow?.getElementById("chatifyLightboxLink");t&&i&&(i.src=e,n&&(n.href=e),t.style.display="flex")}closeLightbox(){let e=this.shadow?.getElementById("chatifyImageLightbox");e&&(e.style.display="none")}switchTab(e){e==="help"&&(this.config.showHelpTab===!1||this.faqs.length===0)&&(e="home"),e==="home"&&De(this.config.widgetDesign)&&(e="messages"),this.activeTab=e;let t=this.shadow?.getElementById("tabHome"),i=this.shadow?.getElementById("tabMessages"),n=this.shadow?.getElementById("tabHelp");t&&(t.style.display=e==="home"?"flex":"none"),i&&(i.style.display=e==="messages"?"flex":"none"),n&&(n.style.display=e==="help"?"flex":"none"),this.shadow?.querySelectorAll(".chatify-nav-item").forEach(r=>{r.classList.toggle("active",r.getAttribute("data-tab")===e)});let s=this.config.workspaceId?`_${this.config.workspaceId.slice(0,8)}`:"";try{sessionStorage.setItem(`chatify_widget_tab${s}`,e)}catch{}e==="messages"&&(this.unreadCount=0,this.updateUnreadBadge(),this.markMessagesAsRead(),this.conversationId&&this.pollSoon(),this.scrollToBottom(!1),this.adjustTextareaHeight(),setTimeout(()=>{this.shadow?.getElementById("chatifyTextarea")?.focus({preventScroll:!0})},100))}getReplyTimeText(){return this.config.subtitle&&/(replies|minute|hour|instant|typical|usually|shortly)/i.test(this.config.subtitle)?this.config.subtitle.trim():"Usually replies within 10\u201315 minutes"}checkIsOnline(){let e=this.workspaceAgents.some(s=>s.status==="online"),t=this.config.businessHours,n=!!(t&&t.enabled)&&!this.isOutsideBusinessHours(t);return!!(e||n)}updatePresenceAndTexts(){let e=this.checkIsOnline(),t=this.getReplyTimeText(),i="We're away, leave a message and we'll reply by email",n=this.shadow?.getElementById("homeStatusPill");if(n){n.title=e?"Online":i;let c=e?`<span class="chatify-pulse-dot online"></span> <span>${this.escapeHTML(t)}</span>`:`<span class="chatify-pulse-dot away"></span> <span>${this.escapeHTML(i)}</span>`;n.dataset.rendered!==c&&(n.innerHTML=c,n.dataset.rendered=c)}let s=this.shadow?.getElementById("homeCardSub");s&&(s.textContent=e?"Ask us anything, or share your feedback.":i);let r=this.shadow?.querySelector("#btnGoToMessages span");r&&(r.textContent=e?"Send us a message":"Leave us a message");let o=this.shadow?.getElementById("chatifyHeaderSubtitle");o&&(o.textContent=e?t:i);let l=this.shadow?.querySelector("#chatifyHeaderAvatar .chatify-online-dot");l&&(l.style.display=e?"block":"none"),this.shadow?.getElementById("chatifyLauncherStatus")?.classList.toggle("is-online",e);let h=this.shadow?.querySelector(".chatify-popup-status-dot");h&&(h.style.display=e?"block":"none")}renderAvatarsStack(e){let t=this.shadow?.getElementById("homeAvatarsStack");if(!t)return;t.innerHTML="";let i=["linear-gradient(135deg, #3b82f6, #1d4ed8)","linear-gradient(135deg, #8b5cf6, #6d28d9)","linear-gradient(135deg, #10b981, #047857)","linear-gradient(135deg, #f59e0b, #d97706)","linear-gradient(135deg, #ec4899, #be185d)"],n=e&&e.length>0?e.slice(0,3):[];if(n.length===0){let s=document.createElement("div");s.className="chatify-mini-avatar",s.style.background=i[0];let r=this.safeUrl(this.config.logoUrl,!0);if(r)s.innerHTML=`<img src="${r}" alt="Support" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;" />`;else{let o=this.getSenderInitials(this.config.businessName||this.config.title||"Support");s.textContent=o}t.appendChild(s),this.mirrorHeaderAvatars(t);return}n.forEach((s,r)=>{let o=document.createElement("div");o.className="chatify-mini-avatar",o.style.background=i[r%i.length],o.title=s.name||"Agent";let l=this.safeUrl(s.avatar_url,!0);if(l){let h=document.createElement("img");h.src=l,h.alt=s.name||"Agent",h.style.cssText="width:100%;height:100%;object-fit:cover;border-radius:inherit;",h.onerror=()=>{o.innerHTML="",o.textContent=this.getSenderInitials(s.name||"Agent")},o.appendChild(h)}else o.textContent=this.getSenderInitials(s.name||"Agent");t.appendChild(o)}),this.mirrorHeaderAvatars(t)}mirrorHeaderAvatars(e){let t=this.shadow?.getElementById("chatHeaderAvatars");t&&(t.innerHTML="",e.childNodes.forEach(i=>t.appendChild(i.cloneNode(!0))))}subscribeToAgentsRealtime(){if(!this.config.workspaceId||this.agentsPollTimer)return;let e=async()=>{if(document.visibilityState==="hidden")return;let{data:t,error:i}=await this.rpcCall("fn_widget_agents",{p_workspace_id:this.config.workspaceId});i||Array.isArray(t)&&(this.workspaceAgents=t,this.renderAvatarsStack(this.workspaceAgents),this.updatePresenceAndTexts())};this.agentsPollTimer=setInterval(()=>{e().catch(()=>{})},6e4)}updateThemeAndTexts(){let e=this.shadow?.getElementById("chatify-theme-style");e&&(e.textContent=this.generateCSS());let t=this.shadow?.getElementById("chatifyHeaderTitle");t&&(t.textContent=this.config.title);let i=this.shadow?.getElementById("chatifyHeaderSubtitle");i&&(i.textContent=this.config.subtitle);let n=this.shadow?.getElementById("chatifyPopupTitle");if(n){let _=this.config.businessName||this.config.title||"Trader Care Desk";n.textContent=_;let B=this.shadow?.getElementById("chatifyPopupAvatar");if(B){let z=this.safeUrl(this.config.logoUrl,!0);if(z){let ee=this.escapeHTML(this.getSenderInitials(_).replace(/['\\<>\r\n]/g,"").slice(0,10));B.innerHTML=`<img src="${z}" alt="Logo" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.parentElement.textContent='${ee}'" />`}else B.querySelector("img")||(B.textContent=this.getSenderInitials(_))}}let s=this.shadow?.getElementById("chatifyIconOpen");s&&(s.innerHTML=this.renderLauncherIconHTML());let r=this.shadow?.getElementById("chatifyHeaderAvatar");r&&(r.innerHTML=this.renderBrandAvatarHTML(!0));let o=this.shadow?.getElementById("homeBrandAvatar");o&&(o.innerHTML=this.renderBrandAvatarHTML(!1));let l=this.shadow?.getElementById("openConvAvatar");l&&(l.innerHTML=this.renderBrandAvatarHTML(!1));let h=this.shadow?.getElementById("homeGreetingTitle");if(h&&this.config.title){let _=this.config.title.replace(/^Welcome to\s+/i,"").replace(/Support!?/i,"").replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}️]+\s*$/u,"").trim();h.textContent=_?`Hello from ${_} \u{1F44B}`:"Hello there \u{1F44B}"}let c=this.shadow?.getElementById("homeGreetingSub");c&&this.config.subtitle&&(c.textContent=this.config.subtitle);let f=this.shadow?.querySelector("#navHelp span");f&&this.config.helpTabLabel&&(f.textContent=this.config.helpTabLabel);let b=this.shadow?.querySelector("#tabHelp .chatify-header-text h3");b&&this.config.helpTabLabel&&(b.textContent=this.config.helpTabLabel);let g=this.shadow?.querySelector("#cardHelpSearch .chatify-section-title");g&&this.config.helpTabLabel&&(g.textContent=this.config.helpTabLabel);let E=this.shadow?.querySelector("#homeSearchTrigger span");E&&this.config.helpTabLabel&&(E.textContent=`\u{1F50D} Search for ${this.config.helpTabLabel.toLowerCase()} articles...`);let C=this.shadow?.getElementById("navHelp"),k=this.shadow?.getElementById("cardHelpSearch"),d=this.shadow?.getElementById("tabHelp"),w=this.faqs.length>0;this.config.showHelpTab===!1||!w?(C&&(C.style.display="none"),k&&(k.style.display="none"),d&&(d.style.display="none"),this.activeTab==="help"&&this.switchTab("home")):(C&&(C.style.display="flex"),k&&(k.style.display="block")),this.renderAvatarsStack(this.workspaceAgents),this.updatePresenceAndTexts()}rgb(e){let t=(e||"").trim().replace("#","");return t.length===3&&(t=t.split("").map(i=>i+i).join("")),/^[0-9a-fA-F]{6}$/.test(t)||(t="2e5bff"),[parseInt(t.slice(0,2),16),parseInt(t.slice(2,4),16),parseInt(t.slice(4,6),16)]}luminance(e){let[t,i,n]=this.rgb(e).map(s=>{let r=s/255;return r<=.03928?r/12.92:Math.pow((r+.055)/1.055,2.4)});return .2126*t+.7152*i+.0722*n}shade(e,t){let[i,n,s]=this.rgb(e),r=t>0?255:0,o=Math.abs(t),l=h=>Math.round(h+(r-h)*o);return`rgb(${l(i)}, ${l(n)}, ${l(s)})`}alpha(e,t){let[i,n,s]=this.rgb(e);return`rgba(${i}, ${n}, ${s}, ${t})`}generateCSS(){let e=this.config.primaryColor||Ee,t=this.luminance(e)>.62?"#0b0b0f":"#ffffff",i=this.shade(e,-.34),n=this.config.position==="bottom-left",s=typeof this.config.offsetBottom=="number"?this.config.offsetBottom:20,r=typeof this.config.offsetSide=="number"?this.config.offsetSide:20,o=typeof this.config.zIndex=="number"?this.config.zIndex:2147483e3,l=s+66,h=s+68;return`
      :host {
        --w-brand: ${e};
        --w-brand-deep: ${i};
        /* Second colour for gradients (Settings \u2192 Chat widget); a darker brand by default. */
        --w-brand-2: ${this.config.secondaryColor||i};
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
        ${n?`left: ${r}px;`:`right: ${r}px;`}
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
        ${n?`left: ${r}px;`:`right: ${r}px;`}
        bottom: ${l}px;
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
        ${n?`left: ${r}px;`:`right: ${r}px;`}
        bottom: ${h}px;
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
    `}bindPrechatHandlers(){this.shadow?.getElementById("chatifyStartBtn")?.addEventListener("click",()=>this.handleStartPreChat());let t=this.shadow?.getElementById("chatifyInputEmail"),i=this.shadow?.getElementById("chatifyInputName"),n=s=>{s.key==="Enter"&&(s.preventDefault(),this.handleStartPreChat())};t?.addEventListener("keydown",n),i?.addEventListener("keydown",n),t?.addEventListener("blur",()=>{t.value.trim()&&this.validatePrechatEmail()}),t?.addEventListener("input",()=>{t.getAttribute("aria-invalid")==="true"&&this.validatePrechatEmail()})}applyPrechatConfig(){let e=this.prechat;if(!e.enabled||Et(e)){if(!this.isPreChatCompleted){this.isPreChatCompleted=!0,this.shadow?.getElementById("chatifyPreChat")?.remove();let n=this.shadow?.getElementById("chatifyFooter");n&&(n.style.display="flex")}return}let t=this.shadow?.getElementById("chatifyPreChat");if(!t||this.isPreChatCompleted)return;let i=n=>n==="required"?'<span class="chatify-required-tag" style="color:#ef4444; font-weight:700;">*</span>':'<span class="chatify-optional-tag">(Optional)</span>';t.innerHTML=`
      <h4>${this.escapeHTML(e.title)}</h4>
      <p>${this.escapeHTML(e.intro)}</p>
      ${e.name!=="off"?`
      <div class="chatify-form-group">
        <label for="chatifyInputName">Your name ${i(e.name)}</label>
        <input type="text" id="chatifyInputName" class="chatify-input" placeholder="e.g. Sarah Khan" autocomplete="name" ${e.name==="required"?'required aria-required="true"':""} aria-describedby="chatifyNameError" />
        <div id="chatifyNameError" class="chatify-field-error" role="alert" aria-live="polite" style="display:none;"></div>
      </div>`:""}
      ${e.email!=="off"?`
      <div class="chatify-form-group">
        <label for="chatifyInputEmail">Email address ${i(e.email)}</label>
        <input type="email" id="chatifyInputEmail" class="chatify-input" placeholder="sarah@example.com" autocomplete="email" inputmode="email" ${e.email==="required"?'required aria-required="true"':""} aria-describedby="chatifyEmailError" />
        <div id="chatifyEmailError" class="chatify-field-error" role="alert" aria-live="polite" style="display:none;"></div>
      </div>`:""}
      ${e.topics.length?`
      <div class="chatify-form-group">
        <label for="chatifyInputTopic">What is it about? ${i(e.topic_required?"required":"optional")}</label>
        <select id="chatifyInputTopic" class="chatify-input" ${e.topic_required?'required aria-required="true"':""} aria-describedby="chatifyTopicError">
          <option value="">Choose a topic</option>
          ${e.topics.map(n=>`<option value="${this.escapeHTML(n)}">${this.escapeHTML(n)}</option>`).join("")}
        </select>
        <div id="chatifyTopicError" class="chatify-field-error" role="alert" aria-live="polite" style="display:none;"></div>
      </div>`:""}
      <button class="chatify-start-btn" id="chatifyStartBtn">Start conversation</button>
    `,this.bindPrechatHandlers()}setPrechatError(e,t,i){let n=this.shadow?.getElementById(e),s=this.shadow?.getElementById(t);n?.classList.toggle("chatify-input-invalid",!!i),n?.setAttribute("aria-invalid",i?"true":"false"),s&&(s.textContent=i,s.style.display=i?"block":"none")}validatePrechatEmail(){let e=this.shadow?.getElementById("chatifyInputEmail");if(!e||this.prechat.email==="off")return!0;let t=this.shadow?.getElementById("chatifyEmailError"),i=(e?.value||"").trim(),s=i?/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(i)?"":"That doesn't look like a valid email \u2014 try name@company.com.":this.prechat.email==="required"?"Please enter your email so we can follow up.":"";return e&&(e.classList.toggle("chatify-input-invalid",!!s),e.setAttribute("aria-invalid",s?"true":"false")),t&&(t.textContent=s,t.style.display=s?"block":"none"),!s}async handleStartPreChat(){let e=this.shadow?.getElementById("chatifyInputName"),t=this.shadow?.getElementById("chatifyInputEmail"),i=this.shadow?.getElementById("chatifyInputTopic"),n=(t?.value||"").trim(),s=(e?.value||"").trim(),r=(i?.value||"").trim(),o=!!e&&this.prechat.name==="required"&&!s;this.setPrechatError("chatifyInputName","chatifyNameError",o?"Please tell us your name.":"");let l=this.validatePrechatEmail(),h=!!i&&this.prechat.topic_required&&!r;if(this.setPrechatError("chatifyInputTopic","chatifyTopicError",h?"Please choose a topic.":""),o)return e?.focus();if(!l)return t?.focus();if(h)return i?.focus();this.visitorName=s||this.visitorName,this.visitorEmail=n||this.visitorEmail;let c=this.config.workspaceId?`_${this.config.workspaceId.slice(0,8)}`:"";try{this.visitorName&&(localStorage.setItem(`zentry_visitor_name${c}`,this.visitorName),localStorage.setItem(`chatify_visitor_name${c}`,this.visitorName)),this.visitorEmail&&(localStorage.setItem(`zentry_visitor_email${c}`,this.visitorEmail),localStorage.setItem(`chatify_visitor_email${c}`,this.visitorEmail)),localStorage.setItem(`zentry_prechat_done${c}`,"1")}catch{}try{await this.saveVisitorDetails(null)}catch(d){console.warn("[Zen-try] Visitor details not saved:",a.errorText(d))}this.isPreChatCompleted=!0,this.shadow?.getElementById("chatifyPreChat")?.remove();let f=this.shadow?.getElementById("chatifyFooter");f&&(f.style.display="flex");let b=await this.ensureConversation();if(r&&b)try{await this.widgetRpc("fn_widget_set_topic",{p_conversation_id:b,p_topic:r})}catch{}let g=(this.config.businessName||this.config.title||"our company").replace(/^Welcome to\s+/i,"").replace(/\s*Support\s*$/i,"").replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}️]+\s*$/u,"").replace(/^the\s+/i,"").trim()||this.config.businessName||this.config.title||"our company",E=this.config.welcomeText?.trim(),C=E?E.charAt(0).toUpperCase()+E.slice(1):`Welcome to ${g}`,k=null;try{k=await this.widgetRpc("fn_widget_welcome",{p_conversation_id:b,p_content:C})}catch{}k&&!this.messages.some(d=>d.id===k.id)&&this.messages.push(k),this.renderMessages()}async handleSendMessage(){let e=this.shadow?.getElementById("chatifyTextarea"),t=this.shadow?.getElementById("chatifySendBtn");if(!e)return;let i=e.value.trim();if(!i&&!this.pendingAttachment)return;let n=null;if(this.pendingAttachment){t&&(t.disabled=!0,t.innerHTML='<span style="width:16px;height:16px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;display:inline-block;animation:chatifySpin 0.8s linear infinite;"></span>'),this.setAttachmentState("sending","Sending picture\u2026");try{n=await _t(this.pendingAttachment.file,this.config.apiUrl||"",{visitorId:this.visitorId,visitorToken:this.visitorToken})}catch(s){this.setAttachmentState("failed",s?.message||"Couldn't send the picture. Check your connection and try again."),t&&(t.disabled=!1,t.innerHTML='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>');return}finally{t&&(t.disabled=!1,t.innerHTML='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>')}}e.value="",this.adjustTextareaHeight(),this.clearPendingAttachment(),await this.sendMessage(i,n||void 0)}renderMessages(){let e=this.shadow?.getElementById("chatifyBody");if(!e||!this.isPreChatCompleted)return;let t=document.createElement("div"),i=[{label:"\u{1F4B0} Pricing & Plans",value:"What are your pricing plans and features?"},{label:"\u26A1 How it works",value:"How does the AI assistant and live chat work?"},{label:"\u{1F680} Getting Started",value:"How can I set up the chat widget on my website?"},{label:"\u{1F510} Security & Privacy",value:"How do you handle data privacy and security?"},{label:"\u{1F9D1}\u200D\u{1F4BC} Talk to a person",value:"I want to speak with a team member."}];if(this.messages.length===0){let c=document.createElement("div");c.style.cssText="text-align:center; margin:auto 0; padding:0 18px;",c.innerHTML='<p style="color:var(--w-ink); font-size:15px; font-weight:600; letter-spacing:-.012em; margin-bottom:5px;">How can we help?</p><p style="color:var(--w-ink-2); font-size:13px; line-height:1.55; margin-bottom:14px;">Pick a topic below for instant answers, or type your question.</p>';let f=document.createElement("div");f.className="chatify-quick-replies",f.style.cssText="justify-content:center; max-width:100%; margin:0 auto;",i.forEach(b=>{let g=document.createElement("button");g.type="button",g.className="chatify-qr-btn",g.textContent=b.label,g.addEventListener("click",()=>{this.sendMessage(b.value||b.label)}),f.appendChild(g)}),c.appendChild(f),t.appendChild(c),this.commitMessages(e,t),this.renderRecentConversation();return}let n=null,s=[...this.messages].reverse().find(c=>c.sender_type==="ai"&&!c.is_internal)?.id??null;this.messages.forEach(c=>{if(c.is_internal)return;if(this.isHandoverMessage(c)){n=null;let T=(c.content||"").replace(/\n*🔄\s*(?:Connecting you with|Main aapko|میں آپ کو).*$/i,"").trim();if(T&&T!=="We've passed this to our team."){let A=document.createElement("div");A.className="chatify-message-row";let $=document.createElement("div");$.className="chatify-msg-agent";let p=new Date(c.created_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});$.innerHTML=`<div class="chatify-msg-text chatify-msg-rich">${this.formatChatMarkdown(T)}</div><div class="chatify-msg-time">${p}</div>`,A.appendChild($),t.appendChild(A)}t.appendChild(this.renderHandoverCard(c));return}if(c.metadata?.system_event==="rate_limit"){let T=document.createElement("div");T.className="chatify-system-line",T.textContent=c.content||"You're sending messages too fast. Please wait a moment.",t.appendChild(T);return}if(c.sender_type==="system"){let T=c.metadata||{};if(T.system_event==="agent_joined"){let A=T.assigned_agent_name||null;t.appendChild(this.renderAgentJoinedLine({name:A,avatar:T.assigned_agent_avatar||null},c.created_at)),n=A||"";return}if(c.content){let A=document.createElement("div");A.className="chatify-system-line",A.textContent=c.content,t.appendChild(A)}return}let b=c.metadata?.system_event;if(b==="returned_to_ai"||b==="return_to_ai"){let T=document.createElement("div");T.className="chatify-system-line",T.textContent="Returned to AI assistant",t.appendChild(T);return}let g=c.sender_type==="visitor",E=new Date(c.created_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}),C=document.createElement("div");C.className="chatify-message-row";let k=document.createElement("div");k.className=g?"chatify-msg-visitor":"chatify-msg-agent";let d="";if(this.isHumanReply(c)){let T=this.humanSenderOf(c);(T.name||"")!==n&&(t.appendChild(this.renderAgentJoinedLine(T,c.created_at)),n=T.name||""),d=`<div class="chatify-agent-sender-name"><span>${this.escapeHTML(T.name||"Support")}</span><span class="chatify-human-tag">Agent</span></div>`}else if(!g&&(c.sender_type==="ai"||c.metadata?.is_welcome)){let T=(this.config.businessName||this.config.title||"Support").trim();d=`<div class="chatify-agent-sender-name"><span>${this.escapeHTML(T)}</span><span class="chatify-ai-tag">AI Assistant</span></div>`}let w="",_=c.reply_to_message_id&&c.sender_type!=="ai"?this.messages.find(T=>T.id===c.reply_to_message_id):null,B=_?`<div class="chatify-msg-quote"><span class="chatify-msg-quote-who">${_.sender_type==="visitor"?"You":"Support"}</span><span class="chatify-msg-quote-text">${this.escapeHTML(_.content.length>120?`${_.content.slice(0,120)}\u2026`:_.content)}</span></div>`:"",z="";if(c.attachment_url){let T=this.safeUrl(c.attachment_url);T&&(this.isImageAttachment(c.attachment_url)?z=`<div class="chatify-msg-attachment"><img src="${T}" alt="Attachment" class="chatify-msg-img" /></div>`:z=`<div class="chatify-msg-attachment"><a href="${T}" target="_blank" rel="noopener noreferrer" class="chatify-msg-doc">\u{1F4C4} <span>View Document</span></a></div>`)}let me=!!c.metadata?.is_edited?'<span style="font-size:10px;font-style:italic;opacity:0.75;margin-left:4px;">(edited)</span>':"",te=!g&&c.metadata?.translation?.translated_text?c.metadata.translation.translated_text:!g&&c.metadata?.translated_text?c.metadata.translated_text:c.content;k.innerHTML=d+B+z+(te?g?`<div class="chatify-msg-text">${this.linkifyHTML(te)}</div>`:`<div class="chatify-msg-text chatify-msg-rich">${this.formatChatMarkdown(te)}</div>`:"")+`<div class="chatify-msg-time">${E}${me}${w}</div>`;let ie=k.querySelector(".chatify-msg-img");if(ie&&c.attachment_url&&ie.addEventListener("click",()=>{this.openLightbox(c.attachment_url)}),C.appendChild(k),t.appendChild(C),!g){if((!!(c.metadata?.handoff_offered||c.metadata?.offer_handoff||c.metadata?.action==="offer_handoff")||this.handoffStatus==="handoff_offered"&&c.sender_type==="ai"&&c.id===s)&&(this.handoffStatus==="bot_active"||this.handoffStatus==="handoff_offered")){let p=document.createElement("button");p.type="button",p.className="chatify-handoff-action-btn",p.innerHTML='<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg><span>Connect to agent</span>',p.addEventListener("click",()=>{this.requestHandoff(p)}),k.appendChild(p)}let A=c.metadata?.quick_replies,$=A&&A.length>0?A:c.metadata?.is_welcome?i:null;if($&&$.length>0&&!this.messages.some(u=>u.sender_type==="visitor"&&!u.pending&&u.created_at>c.created_at)){let u=document.createElement("div");u.className="chatify-quick-replies",$.slice(0,5).forEach(m=>{let y=document.createElement("button");y.type="button",y.className="chatify-qr-btn",y.textContent=m.label,y.addEventListener("click",()=>{let L=this.shadow?.getElementById("chatifyTextarea");L&&(L.value="",this.adjustTextareaHeight()),this.sendMessage(m.value||m.label)}),u.appendChild(y)}),t.appendChild(u)}}}),!this.messages.some(c=>!c.is_internal&&this.isHandoverMessage(c))&&(this.handoffStatus==="waiting_for_agent"||this.handoffStatus==="offline_queued")&&t.appendChild(this.renderHandoverCard());let o=this.conversationStatus==="closed";if(o){let c=document.createElement("div");c.className="chatify-closed-notice",c.textContent="This conversation was closed",t.appendChild(c)}if(this.conversationStatus==="closed"&&!this.csatRated){let c=document.createElement("div");c.className="chatify-csat-box",c.innerHTML=`
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
      `;let f=null,b=c.querySelectorAll(".chatify-csat-choice-btn"),g=c.querySelector(".chatify-csat-comment-wrap"),E=c.querySelector(".chatify-csat-comment-input"),C=c.querySelector(".chatify-csat-submit-btn");b.forEach(k=>{k.addEventListener("click",d=>{let w=d.currentTarget.getAttribute("data-rating");f=w,b.forEach(_=>{_.classList.remove("selected-good","selected-bad")}),k.classList.add(w==="good"?"selected-good":"selected-bad"),g&&(g.style.display="flex")})}),C&&C.addEventListener("click",()=>{if(!f)return;let k=E?E.value.trim():"";this.submitCSAT(f,k)}),t.appendChild(c)}else if(this.csatRated){let c=document.createElement("div");c.style.cssText="text-align:center; padding:12px; font-size:12.5px; color:var(--w-success); font-weight:600;",c.textContent="\u2713 Thank you for rating our support!",t.appendChild(c)}if(o){let c=document.createElement("button");c.type="button",c.className="chatify-new-conversation-btn",c.textContent="Start a new conversation",c.addEventListener("click",()=>this.startNewConversation()),t.appendChild(c)}if(this.botTyping||this.agentTyping){let c=document.createElement("div");c.className="chatify-message-row",c.innerHTML='<div class="chatify-msg-agent chatify-typing" aria-label="Typing"><span></span><span></span><span></span></div>',t.appendChild(c)}let l=null;for(let c=this.messages.length-1;c>=0;c--){let f=this.messages[c];if(this.isHumanReply(f)){l=this.humanSenderOf(f);break}}let h=this.shadow?.getElementById("chatifyHeaderSubtitle");if(!l&&this.isWaitingForAgent()&&h&&(h.textContent="Connecting you to the team\u2026"),l){let c=this.shadow?.getElementById("chatifyHeaderTitle"),f=this.shadow?.getElementById("chatifyHeaderAvatar");if(c&&(c.textContent=l.name||"Support team"),h&&(h.textContent="Support Specialist \xB7 Online"),f&&l.avatar){let b=this.safeUrl(l.avatar,!0);b&&(f.innerHTML=`<img src="${b}" alt="${this.escapeHTML(l.name||"Support team")}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`)}}this.commitMessages(e,t),this.renderRecentConversation()}commitMessages(e,t){let i=t.innerHTML;if(i===this.lastMessagesHtml&&this.lastMessagesTail&&this.lastMessagesTail.parentNode===e)return;let n=this.messages[this.messages.length-1],s=n?n.id:null,r=!!(n&&n.sender_type==="visitor"&&s!==this.lastMessageId),o=e.scrollHeight-e.scrollTop-e.clientHeight<120,l=!this.lastMessagesTail,h=e.scrollTop;e.replaceChildren(...Array.from(t.childNodes)),this.lastMessagesHtml=i,this.lastMessagesTail=e.lastChild,this.lastMessageId=s,e.scrollTop=l||o||r?e.scrollHeight:h}renderTicks(e){let t='<path d="M1 5.2 3.4 7.6 9 2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',i='<path d="M1 5.2 3.4 7.6 9 2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M5.5 5.2 7.9 7.6 13.5 2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>';return e.pending?'<span class="chatify-tick" title="Sending"><svg viewBox="0 0 14 10" width="15" height="11"><circle cx="5" cy="5" r="3.6" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M5 3v2.2l1.5.9" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg></span>':e.read_at?'<span class="chatify-tick chatify-tick-read" title="Read"><svg viewBox="0 0 14 10" width="15" height="11">'+i+"</svg></span>":e.delivered_at?'<span class="chatify-tick" title="Delivered"><svg viewBox="0 0 14 10" width="15" height="11">'+i+"</svg></span>":'<span class="chatify-tick" title="Sent"><svg viewBox="0 0 14 10" width="15" height="11">'+t+"</svg></span>"}unescapeHTML(e){return e.replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#0?39;/g,"'").replace(/&amp;/g,"&")}linkifyHTML(e){return Tt(e).map(t=>t.href?`<a href="${this.escapeHTML(t.href)}"${t.href.startsWith("mailto:")?"":' target="_blank"'} rel="noopener noreferrer">${this.escapeHTML(t.text)}</a>`:this.escapeHTML(t.text)).join("")}escapeHTML(e){return e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;")}safeUrl(e,t=!1){if(!e)return"";let i=e.trim();return/^https?:\/\/[^\s"'<>]+/i.test(i)?this.escapeHTML(i):/^\/help\/[a-zA-Z0-9_.\-\/]+$/i.test(i)?this.escapeHTML(i):t&&/^data:image\/(?:png|jpe?g|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=]+$/i.test(i)?this.escapeHTML(i):""}toggleWindow(){this.isOpen=!this.isOpen;let e=this.config.workspaceId?`_${this.config.workspaceId.slice(0,8)}`:"";try{sessionStorage.setItem(`zentry_widget_open${e}`,this.isOpen?"1":"0"),sessionStorage.setItem(`chatify_widget_open${e}`,this.isOpen?"1":"0")}catch{}let t=this.shadow?.getElementById("chatifyWindow"),i=this.shadow?.getElementById("chatifyIconOpen"),n=this.shadow?.getElementById("chatifyIconClose"),s=this.shadow?.getElementById("zentryLauncherBtn")||this.shadow?.getElementById("chatifyLauncherBtn");s&&s.classList.toggle("widget-is-open",this.isOpen),this.container&&this.container.classList.toggle("widget-is-open",this.isOpen),t&&i&&n&&(this.isOpen?(this.hideMessagePopup(!1),t.style.display="flex",this.loadPreviousConversations(),i.style.display="none",n.style.display="block",this.activeTab==="home"&&De(this.config.widgetDesign)&&this.switchTab("messages"),this.activeTab==="messages"?(this.unreadCount=0,this.updateUnreadBadge(),this.markMessagesAsRead(),this.scrollToBottom(!1),this.adjustTextareaHeight(),setTimeout(()=>{this.shadow?.getElementById("chatifyTextarea")?.focus({preventScroll:!0})},100)):this.updateUnreadBadge()):(t.style.display="none",i.style.display="flex",n.style.display="none",this.closeEmojiPicker(),this.updateUnreadBadge()))}updateUnreadBadge(){let e=this.shadow?.getElementById("chatifyBadge"),t=this.shadow?.getElementById("navMsgBadge"),i=this.shadow?.getElementById("homeCardUnreadPill"),n=this.shadow?.getElementById("homeCardCtaBadge"),s=this.shadow?.getElementById("homeCardTitle");if((this.shadow?.getElementById("zentryLauncherBtn")||this.shadow?.getElementById("chatifyLauncherBtn"))?.classList.toggle("has-unread",this.unreadCount>0),this.unreadCount>0){let o=this.unreadCount>9?"9+":this.unreadCount.toString();e&&(e.textContent=o,e.style.display="flex"),t&&(t.textContent=o,t.style.display="flex"),i&&(i.textContent=`${this.unreadCount} new ${this.unreadCount===1?"message":"messages"}`,i.style.display="inline-flex"),n&&(n.textContent=o,n.style.display="inline-flex"),s&&(s.textContent=this.unreadCount===1?"You have 1 new reply":`You have ${this.unreadCount} new replies`)}else e&&(e.style.display="none"),t&&(t.style.display="none"),i&&(i.style.display="none"),n&&(n.style.display="none"),s&&(s.textContent="Chat with us");this.renderRecentConversation()}formatRelativeTime(e){let i=Math.floor((new Date().getTime()-e.getTime())/1e3);if(i<60)return"Just now";let n=Math.floor(i/60);if(n<60)return`${n}m ago`;let s=Math.floor(n/60);if(s<24)return`${s}h ago`;let r=Math.floor(s/24);return r===1?"Yesterday":r<7?`${r}d ago`:e.toLocaleDateString([],{month:"short",day:"numeric"})}renderRecentConversation(){let e=this.shadow?.getElementById("cardOpenConv"),t=this.shadow?.getElementById("cardStartChat"),i=this.shadow?.getElementById("openConvSnippet"),n=this.shadow?.getElementById("openConvSender"),s=this.shadow?.getElementById("openConvTime"),r=this.shadow?.getElementById("openConvUnreadPill"),o=this.shadow?.getElementById("openConvCtaBadge"),l=!!(this.messages&&this.messages.length>0);if(!this.conversationId||!l){e&&(e.style.display="none"),t&&(t.style.display="block");return}e&&(e.style.display="block"),t&&(t.style.display="none");let h=[...this.messages].reverse().find(c=>!c.is_internal);if(h){let c=(h.content||"").replace(/^#{1,6}\s+/gm,"").replace(/^\s*[-*•]\s+/gm,"").replace(/\*\*|__|`/g,"").replace(/\s+/g," ").trim();h.attachment_url&&(c=c?`\u{1F4F7} ${c}`:"\u{1F4F7} Sent a picture"),i&&(i.textContent=c||"Active conversation"),n&&(h.sender_type==="visitor"?n.textContent="You":h.sender_type==="ai"?n.textContent="AI Assistant":n.textContent=this.config.title||"Support Team"),s&&h.created_at&&(s.textContent=this.formatRelativeTime(new Date(h.created_at)))}this.unreadCount>0?(r&&(r.textContent=`${this.unreadCount} new`,r.style.display="inline-flex"),o&&(o.textContent=this.unreadCount>9?"9+":this.unreadCount.toString(),o.style.display="inline-flex")):(r&&(r.style.display="none"),o&&(o.style.display="none"))}scrollToBottom(e=!1){let t=this.shadow?.getElementById("chatifyBody");if(!t)return;let i=()=>{e&&typeof t.scrollTo=="function"?t.scrollTo({top:t.scrollHeight,behavior:"smooth"}):t.scrollTop=t.scrollHeight};i(),requestAnimationFrame(()=>i()),setTimeout(i,50),setTimeout(i,200),t.querySelectorAll("img").forEach(s=>{s.complete||(s.addEventListener("load",()=>i(),{once:!0}),s.addEventListener("error",()=>i(),{once:!0}))})}open(e){this.hideMessagePopup(!1),this.isOpen||this.toggleWindow(),e&&this.switchTab(e),this.activeTab==="messages"&&this.scrollToBottom(!1)}close(){this.isOpen&&this.toggleWindow()}toggle(){this.toggleWindow()}openHelp(){if(this.config.showHelpTab===!1||this.faqs.length===0){this.open("home");return}this.open("help"),setTimeout(()=>{this.shadow?.getElementById("helpSearchInput")?.focus({preventScroll:!0})},120)}openMessages(){this.open("messages")}getIsOpen(){return this.isOpen}getBrandInitial(){return((this.config.businessName||this.config.title||"Support").replace(/^Welcome to\s+/i,"").replace(/\s*Support\s*$/i,"").replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}️]+\s*$/u,"").replace(/^the\s+/i,"").trim().charAt(0)||"S").toUpperCase()}renderBrandAvatarHTML(e=!1){let t=this.getBrandInitial(),i=e?'<span class="chatify-online-dot"></span>':"",n=this.safeUrl(this.config.logoUrl,!0);return n?`
        <img src="${n}" alt="Logo" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;" onerror="this.style.display='none';if(this.nextElementSibling){this.nextElementSibling.style.display='flex';}" />
        <span class="chatify-avatar-initial" style="display:none;width:100%;height:100%;border-radius:inherit;background:var(--w-brand);color:var(--w-on-brand);align-items:center;justify-content:center;font-weight:700;font-size:inherit;">${this.escapeHTML(t)}</span>
        ${i}
      `:`
      <span class="chatify-avatar-initial" style="display:flex;width:100%;height:100%;border-radius:inherit;background:var(--w-brand);color:var(--w-on-brand);align-items:center;justify-content:center;font-weight:700;font-size:inherit;">${t}</span>
      ${i}
    `}hasHostModalOrOverlay(){if(typeof document>"u")return!1;try{let e=document.querySelectorAll('dialog[open], [role="dialog"], [role="alertdialog"], [aria-modal="true"]');for(let n=0;n<e.length;n++){let s=e[n];if(this.container&&(s===this.container||this.container.contains(s)))continue;let r=window.getComputedStyle(s);if(r.display!=="none"&&r.visibility!=="hidden"&&r.opacity!=="0"){let o=s.getBoundingClientRect();if(o.width>0&&o.height>0)return!0}}let t=window.innerWidth||document.documentElement.clientWidth||0,i=window.innerHeight||document.documentElement.clientHeight||0;if(t>0&&i>0){let n=document.querySelectorAll('div, section, aside, [class*="modal"], [class*="overlay"], [class*="backdrop"]');for(let s=0;s<n.length;s++){let r=n[s];if(this.container&&(r===this.container||this.container.contains(r)))continue;let o=window.getComputedStyle(r);if((o.position==="fixed"||o.position==="absolute")&&o.display!=="none"&&o.visibility!=="hidden"&&parseFloat(o.opacity||"1")>.05){let h=r.getBoundingClientRect();if(h.width>=t*.7&&h.height>=i*.7)return!0}}}}catch{}return!1}initProactiveWelcome(){if(this.config.enableProactiveWelcome===!1)return;let e=Math.max(8,this.config.proactiveDelaySeconds||8);setTimeout(()=>{if(this.isOpen||this.messages.length>0)return;try{if(sessionStorage.getItem("zentry_proactive_welcome_dismissed")==="1"||sessionStorage.getItem("chatify_proactive_welcome_dismissed")==="1")return}catch{}if(this.hasHostModalOrOverlay())return;let t=(this.config.businessName||this.config.title||"Support").replace(/^Welcome to\s+/i,"").replace(/\s*Support\s*$/i,"").replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}️]+\s*$/u,"").replace(/^the\s+/i,"").trim()||"Support",i=this.config.welcomeText?.trim(),n=i?i.charAt(0).toUpperCase()+i.slice(1):`Welcome to ${t}`;this.showMessagePopup({id:"proactive-welcome",content:n},t)},e*1e3)}isHandoverMessage(e){let t=e.metadata;return t?.system_event==="handover"||t?.system_event?.type==="handover"||!!t?.handover}isHumanReply(e){return e.sender_type==="agent"&&!e.is_internal&&!e.metadata?.is_welcome&&!e.pending}humanSenderOf(e){let t=e.metadata,i=e.sender_id?this.workspaceAgents.find(n=>n.id===e.sender_id):void 0;return{name:t?.sender_name||i?.name||null,avatar:t?.sender_avatar||i?.avatar_url||null}}isWaitingForAgent(){if(this.conversationStatus==="closed")return!1;for(let e=this.messages.length-1;e>=0;e--){let t=this.messages[e];if(this.isHumanReply(t))return!1;if(!t.is_internal&&this.isHandoverMessage(t))return!0}return!1}agentAvatarHtml(e){let t=this.safeUrl(e.avatar??e.avatar_url??null,!0);return t?`<img src="${t}" alt="" />`:this.escapeHTML(this.getSenderInitials(e.name||"Support"))}async requestHandoff(e){if(!(this.handoffConnecting||!this.conversationId)){this.handoffConnecting=!0,e&&(e.disabled=!0,e.textContent="Connecting...");try{let t=await this.widgetRpc("fn_widget_request_handoff",{p_conversation_id:this.conversationId});t&&t.ok?(this.handoffStatus=t.status||"waiting_for_agent",t.next_open?.label&&(this.nextOpenLabel=t.next_open.label)):e&&(e.disabled=!0,e.textContent="Our team is not available right now")}catch(t){console.error("[Zen-try] Error requesting handoff:",t)}finally{this.handoffConnecting=!1,this.renderMessages()}}}applyHandoffDetails(e){let t=e&&typeof e=="object"?e:{};if("estimated_wait_minutes"in t){let i=Number(t.estimated_wait_minutes);this.expectedWaitText=Number.isFinite(i)&&i>0?"~"+i+(i===1?" minute":" minutes"):null}"next_open_label"in t&&(this.nextOpenLabel=typeof t.next_open_label=="string"?t.next_open_label:null),typeof t.assigned_agent_name=="string"&&t.assigned_agent_name&&(this.assignedAgentName=t.assigned_agent_name),!this.visitorEmail&&typeof t.customer_email=="string"&&t.customer_email&&(this.visitorEmail=t.customer_email)}async toggleAiAssist(e){if(this.conversationId)try{let t=await this.widgetRpc("fn_widget_set_ai_assist",{p_conversation_id:this.conversationId,p_enabled:e});t?.ok&&(this.aiAssistEnabled=!!t.ai_assist,this.applyHandoffDetails(t.conversation)),this.renderMessages()}catch(t){console.error("[Zen-try] Error toggling AI assist:",t)}}async markIssueResolved(){if(this.conversationId)try{await this.widgetRpc("fn_widget_mark_resolved",{p_conversation_id:this.conversationId}),this.conversationStatus="closed",this.handoffStatus="resolved",this.renderMessages()}catch(e){console.error("[Zen-try] Error resolving conversation:",e)}}renderHandoverCard(e){let t=document.createElement("div");e&&t.setAttribute("data-handover-msg-id",e.id),t.setAttribute("role","status");let i=this.messages.some(g=>this.isHumanReply(g)&&(!e||g.created_at>e.created_at)),n=(this.visitorEmail||"").trim(),s=e?.metadata||{},r=s.assigned_agent_name||s.system_event?.agent_name||this.assignedAgentName||null,o=s.assigned_agent_avatar||s.system_event?.agent_avatar||null;if(i||this.handoffStatus==="agent_active"){let g=this.messages.find(k=>this.isHumanReply(k)&&(!e||k.created_at>e.created_at)),C=(g?this.humanSenderOf(g):null)?.name||r||"our support team";return t.className="chatify-handover-card connected",t.innerHTML='<div class="chatify-handover-accent-bar connected"></div><div class="chatify-handover-inner"><div class="chatify-handover-check" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></div><div class="chatify-handover-body"><div class="chatify-handover-header-row"><span class="chatify-handover-heading">Connected with '+this.escapeHTML(C)+'</span><span class="chatify-handover-status-pill connected"><span>Active</span></span></div><p class="chatify-handover-desc">You are now chatting live with a real team member.</p></div></div>',t}if(this.conversationStatus==="closed"||this.handoffStatus==="resolved")return t.className="chatify-handover-card waiting",t.innerHTML=`<div class="chatify-handover-accent-bar waiting"></div><div class="chatify-handover-inner"><div class="chatify-handover-body"><div class="chatify-handover-header-row"><span class="chatify-handover-heading">Handed over to support</span></div><p class="chatify-handover-desc">We've saved your request. Our team will follow up.`+(n?" Updates will be sent to <strong>"+this.escapeHTML(n)+"</strong>.":"")+"</p></div></div>",t;let l=this.handoffStatus==="offline_queued",h=this.checkIsOnline(),c=r?{name:r,avatar_url:o,status:"online"}:this.workspaceAgents.find(g=>g.status==="online")||this.workspaceAgents[0]||null,f="";if(c){let g=this.safeUrl(c.avatar_url,!0),E=this.escapeHTML(this.getSenderInitials(c.name||"Support"));f=g?'<div class="chatify-handover-avatar"><img src="'+g+'" alt="" /></div>':'<div class="chatify-handover-avatar">'+E+"</div>"}else f='<div class="chatify-handover-avatar"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg></div>';let b=n?'<div class="chatify-handover-email-notice"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg><span>Updates also sent to <strong>'+this.escapeHTML(n)+"</strong></span></div>":'<form class="chatify-handover-email-form"><span class="chatify-handover-email-prompt">Want an email if you step away?</span><div class="chatify-handover-email-row"><input type="email" class="chatify-handover-email-input" placeholder="Enter your email" required /><button type="submit" class="chatify-handover-email-btn">Notify me</button></div></form>';if(l){let g=!!(this.nextOpenLabel&&!/^as soon as/i.test(this.nextOpenLabel)),E=g?"We're away right now":"The team will get back to you",C=(g?"We'll be back "+this.escapeHTML(this.nextOpenLabel||"")+". ":"Everyone is busy at the moment. ")+(n?"You'll get our reply here and by email.":"You'll get our reply right here."),d='<div class="chatify-handover-actions">'+(this.aiAssistEnabled?'<div class="chatify-handover-ai-badge"><span>\u2728 AI Assist active</span><button type="button" class="chatify-handover-btn-link" id="chatifyPauseAiBtn">Pause</button></div>':'<button type="button" class="chatify-handover-btn-secondary" id="chatifyAskAiBtn">\u2728 Ask AI while you wait</button>')+'<button type="button" class="chatify-handover-btn-secondary" id="chatifyResolvedBtn">\u2713 My issue is solved</button></div>';t.className="chatify-handover-card waiting",t.innerHTML='<div class="chatify-handover-accent-bar waiting"></div><div class="chatify-handover-inner"><div class="chatify-handover-avatar-wrap">'+f+'<span class="chatify-handover-avatar-dot away"></span></div><div class="chatify-handover-body"><div class="chatify-handover-header-row"><span class="chatify-handover-heading">'+E+'</span><span class="chatify-handover-status-pill waiting"><span>'+(g?"Away":"In queue")+'</span></span></div><p class="chatify-handover-desc">'+C+"</p>"+b+d+"</div></div>",setTimeout(()=>{let w=t.querySelector("#chatifyAskAiBtn");w&&w.addEventListener("click",()=>this.toggleAiAssist(!0));let _=t.querySelector("#chatifyPauseAiBtn");_&&_.addEventListener("click",()=>this.toggleAiAssist(!1));let B=t.querySelector("#chatifyResolvedBtn");B&&B.addEventListener("click",()=>this.markIssueResolved())},0)}else{let g=r?"Connecting you to "+this.escapeHTML(r):"You're through to our team",E=this.expectedWaitText?"The team typically replies in "+this.escapeHTML(this.expectedWaitText)+". Stay here and someone will join this chat.":h?"Someone from the team will join this chat in a moment.":"We'll reply right here as soon as someone is free.";t.className="chatify-handover-card connecting",t.innerHTML='<div class="chatify-handover-accent-bar"></div><div class="chatify-handover-inner"><div class="chatify-handover-avatar-wrap">'+f+'<span class="chatify-handover-avatar-dot '+(h?"online":"away")+'"></span></div><div class="chatify-handover-body"><div class="chatify-handover-header-row"><span class="chatify-handover-heading">'+g+'</span><span class="chatify-handover-status-pill"><span class="chatify-status-pulse"></span><span>In queue</span></span></div><p class="chatify-handover-desc">'+E+"</p>"+b+"</div></div>"}if(!n){let g=t.querySelector(".chatify-handover-email-form"),E=t.querySelector(".chatify-handover-email-input");g&&E&&g.addEventListener("submit",C=>{C.preventDefault();let k=E.value.trim();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(k))return;this.visitorEmail=k;let d=this.config.workspaceId?"_"+this.config.workspaceId.slice(0,8):"";try{localStorage.setItem("zentry_visitor_email"+d,k),localStorage.setItem("chatify_visitor_email"+d,k)}catch{}this.saveVisitorDetails(null).catch(()=>{}),this.renderMessages()})}return t}renderAgentJoinedLine(e,t){let i=document.createElement("div");i.className="chatify-agent-joined",i.setAttribute("role","status");let n=new Date(t).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}),s=e.name?`<strong>${this.escapeHTML(e.name)}</strong> joined the conversation`:"A support agent joined the conversation";return i.innerHTML=`<span class="zentry-agent-joined chatify-agent-joined-avatar">${this.agentAvatarHtml(e)}<span class="zentry-agent-joined chatify-agent-joined-dot"></span></span><span class="zentry-agent-joined chatify-agent-joined-text">${s}<span class="zentry-agent-joined chatify-agent-joined-time"> \xB7 ${n}</span></span>`,i}getSenderInitials(e){if(!e)return"TD";let t=e.trim().split(/\s+/).filter(Boolean);return t.length===0?"TD":t.length===1?t[0].slice(0,2).toUpperCase():(t[0][0]+t[t.length-1][0]).toUpperCase()}showMessagePopup(e,t){if(this.isOpen||this.hasHostModalOrOverlay())return;let i=this.shadow?.getElementById("chatifyMessagePopup");if(!i)return;this.popupCloseTimer&&(clearTimeout(this.popupCloseTimer),this.popupCloseTimer=null),this.currentPopupMsgId=e.id||null;let n=t||this.config.businessName||this.config.title||"Trader Care Desk",s=this.getSenderInitials(n),r=this.shadow?.getElementById("chatifyPopupTitle");r&&(r.textContent=n);let o=this.shadow?.getElementById("chatifyPopupAvatar");if(o){let h=this.safeUrl(this.config.logoUrl,!0);if(h){let c=this.escapeHTML(s.replace(/['\\<>\r\n]/g,"").slice(0,10));o.innerHTML=`<img src="${h}" alt="Avatar" onerror="this.parentElement.textContent='${c}'" />`}else o.textContent=s}let l=this.shadow?.getElementById("chatifyPopupMessageText");l&&(l.textContent=e.content||(e.attachment_url?"Sent an attachment \u{1F4CE}":"New message")),i.classList.remove("closing"),i.style.display="flex"}hideMessagePopup(e=!0){let t=this.shadow?.getElementById("chatifyMessagePopup");if(!(!t||t.style.display==="none")){if(!e){t.style.display="none",t.classList.remove("closing");return}t.classList.add("closing"),this.popupCloseTimer&&clearTimeout(this.popupCloseTimer),this.popupCloseTimer=setTimeout(()=>{t.style.display="none",t.classList.remove("closing"),this.popupCloseTimer=null},200)}}dismissMessagePopup(){if(this.currentPopupMsgId)try{sessionStorage.setItem(`zentry_popup_dismissed_${this.currentPopupMsgId}`,"1"),sessionStorage.setItem(`zentry_popup_dismissed_${this.currentPopupMsgId}`,"1"),sessionStorage.setItem(`chatify_popup_dismissed_${this.currentPopupMsgId}`,"1")}catch{}try{sessionStorage.setItem("zentry_proactive_welcome_dismissed","1"),sessionStorage.setItem("zentry_proactive_welcome_dismissed","1"),sessionStorage.setItem("chatify_proactive_welcome_dismissed","1")}catch{}this.hideMessagePopup(!0)}async sendPopupReply(){let e=this.shadow?.getElementById("chatifyPopupInput"),t=this.shadow?.getElementById("chatifyPopupSendBtn"),i=e?.value.trim()||"";i&&(e&&(e.value=""),t?.classList.remove("active"),this.hideMessagePopup(!1),this.open("messages"),await this.sendMessage(i))}showPopup(e,t){this.showMessagePopup({id:"test-"+Date.now(),content:e||"Hi, how can we help?"},t||"Trader Care Desk")}hidePopup(){this.hideMessagePopup(!0)}subscribeToVisitorConversations(e){this.visitorId&&this.startLiveUpdates()}search(e){this.open("help"),this.activeSectionId=null,this.faqSearchQuery=(e||"").trim(),setTimeout(()=>{let t=this.shadow?.getElementById("helpSearchInput");t&&(t.value=e,t.focus()),this.renderFaqList()},100)}async openArticle(e){if(!e)return;this.open("help");let t=e.trim().toLowerCase(),i=this.faqs.find(n=>n.id&&n.id.toLowerCase()===t||n.slug&&n.slug.toLowerCase()===t);if(i){this.activeSectionId=i.sectionId||(this.sections.length>0?this.sections[0].id:null),this.faqSearchQuery="";let n=this.shadow?.getElementById("helpSearchInput");n&&(n.value=""),this.renderFaqList(),setTimeout(()=>{let s=this.shadow?.querySelectorAll(".zentry-faq-item, .chatify-faq-item"),r=null;if(s)for(let o=0;o<s.length;o++){let l=s[o],h=(l.getAttribute("data-id")||"").toLowerCase(),c=(l.getAttribute("data-slug")||"").toLowerCase();if(h===t||c===t){r=l;break}}if(r){let o=r;o.classList.contains("open")||o.classList.add("open"),o.scrollIntoView({behavior:"smooth",block:"center"})}},100)}}bindGlobalTriggers(){typeof document>"u"||document.addEventListener("click",e=>{let t=e.target;if(!t)return;if(t.closest("[data-orbat-help], [data-zentry-help], [data-chatify-help], .orbat-help-trigger, .zentry-help-trigger, .chatify-help-trigger")){if(e.preventDefault(),this.config.showHelpTab===!1||this.faqs.length===0)return;this.openHelp();return}let n=t.closest("[data-orbat-article], [data-zentry-article], [data-chatify-article]");if(n){e.preventDefault();let l=n.getAttribute("data-orbat-article")||n.getAttribute("data-zentry-article")||n.getAttribute("data-chatify-article")||"";l?this.openArticle(l):this.openHelp();return}let s=t.closest("[data-orbat-open], [data-zentry-open], [data-chatify-open], .orbat-open-trigger, .zentry-open-trigger, .chatify-open-trigger");if(s){e.preventDefault();let l=s.getAttribute("data-orbat-tab")||s.getAttribute("data-zentry-tab")||s.getAttribute("data-chatify-tab");this.open(l||"home");return}if(t.closest("[data-orbat-close], [data-zentry-close], [data-chatify-close]")){e.preventDefault(),this.close();return}if(t.closest("[data-orbat-toggle], [data-zentry-toggle], [data-chatify-toggle]")){e.preventDefault(),this.toggle();return}})}initNavbarAutoTrigger(){if(typeof document>"u"||typeof window>"u")return;let e=this.config.navbarTriggerConfig,t="#zentry-widget-root, #chatify-widget-root, #chatifyWidgetContainer, [data-zentry-root]",i="[data-zentry-nav], [data-chatify-nav]",n=()=>{document.querySelectorAll(i).forEach(p=>p.remove()),["zentryNavTriggerBtn","zentryNavTriggerBtnMobile","chatifyNavTriggerBtn","chatifyNavTriggerBtnMobile"].forEach(p=>document.getElementById(p)?.remove()),document.querySelectorAll("[data-zentry-hooked], [data-chatify-hooked]").forEach(p=>{p.removeAttribute("data-zentry-hooked"),p.removeAttribute("data-chatify-hooked")})},s=()=>{let p=this;p.__navObserver?.disconnect(),p.__navObserver=void 0};if(!e||e.enabled!==!0||document.querySelector("[data-zentry-no-nav]")){s(),n();return}let r=e.action||"help";if(r!=="messages"&&!(Array.isArray(this.faqs)&&this.faqs.length>0)){s(),n();return}let o=p=>p.toLowerCase().trim().replace(/^https?:\/\//,"").replace(/\/.*$/,"").replace(/^www\./,""),l=o(window.location.hostname),h=this.config.customDomain?o(this.config.customDomain):"";if(h&&l===h||/(^|\.)(zentryhelp|chatifyhelp)\.com$/.test(l)||window.location.pathname.toLowerCase().startsWith("/help/")){s(),n();return}let c=(this.config.apiUrl||Y).replace(/\/$/,""),f=h?`https://${h}`:this.config.workspaceId?`${c}/help/${encodeURIComponent(this.config.workspaceId)}`:"",b=p=>{if(p.closest(i))return!1;let u=(p.getAttribute("href")||"").toLowerCase();return!u||u==="#"||u.startsWith("javascript:")?!1:h!==""&&u.includes(h)||this.config.workspaceId!==null&&u.includes(`/help/${this.config.workspaceId.toLowerCase()}`)||/zentryhelp\.com|chatifyhelp\.com/.test(u)};if(document.querySelector("[data-zentry-help]:not([data-zentry-nav]), [data-chatify-help]:not([data-chatify-nav]), .zentry-help-trigger, header [data-zentry-open], nav [data-zentry-open]")||Array.from(document.querySelectorAll('header a, nav a, [role="navigation"] a')).some(b)){s(),n();return}let g=(e.label||"Help").trim().slice(0,40);if(!g)return;let E=e.position==="start"?"start":"end",C=e.style==="pill"?"pill":"navbar_link",k=p=>!!p.closest(`${t}, footer, aside, [role="contentinfo"], [class*="footer" i], [id*="footer" i], [class*="sidebar" i]`),d=p=>Array.from(p.querySelectorAll("a[href]")).filter(u=>!u.closest(i)&&(u.textContent||"").trim().length>0&&(u.textContent||"").trim().length<=40),w=p=>{let u=window.getComputedStyle(p);return u.display==="none"||u.visibility==="hidden"},_=p=>{if(p.closest('header, [role="banner"]'))return!0;let u=p;for(;u&&u!==document.body;){let m=window.getComputedStyle(u).position;if(m==="fixed"||m==="sticky")return!0;u=u.parentElement}return!1},B=p=>_(p)||p.getBoundingClientRect().top+window.scrollY<260,z=p=>{let u=null,m=y=>{let L=Array.from(y.children).filter(x=>{if(!(x instanceof HTMLElement)||x.matches(i))return!1;let S=x.tagName.toLowerCase();return S==="a"?d(y).includes(x):S==="li"?!!x.querySelector("a[href]"):!1});L.length>=2&&(!u||L.length>u.items.length)&&(u={group:y,items:L})};return m(p),p.querySelectorAll("ul, ol, div, span").forEach(y=>{y.closest("ul ul, ol ol, li ul, li ol")||m(y)}),u},ee=()=>{let p=e.target_selector?.trim();if(p)try{let x=document.querySelector(p);if(x&&!x.closest(t))return x}catch{}let u=Array.from(document.querySelectorAll('header nav, nav, [role="navigation"], header ul, .navbar, .navbar-nav, [class*="menu" i], [class*="nav" i]')).filter(x=>!k(x)&&!w(x)&&B(x)),m=new Set(u);document.querySelectorAll("a[href]").forEach(x=>{let S=x.parentElement;if(!S||m.has(S)||S===document.body||(m.add(S),k(S)||w(S)))return;d(S).filter(R=>R.parentElement===S&&!w(R)).length>=3&&(_(S)||S.getBoundingClientRect().top+window.scrollY<160)&&u.push(S)});let y=null,L=-1;for(let x of u){let S=d(x).filter(R=>!w(R));if(S.length<2||S.length>30)continue;let P=Math.min(S.length,12)*3;(x.tagName==="NAV"||x.getAttribute("role")==="navigation")&&(P+=10),x.closest('header, [role="banner"]')&&(P+=15),/mobile|drawer|offcanvas/i.test(`${x.className} ${x.id}`)&&(P-=25),(P>L||P===L&&y&&y.contains(x))&&(y=x,L=P)}return y},me=p=>{let u=Array.from(document.querySelectorAll('[class*="mobile" i], [id*="mobile" i], [class*="drawer" i], [id*="drawer" i], [class*="offcanvas" i], [class*="off-canvas" i], [class*="hamburger" i] + *, [class*="responsive-menu" i]')).filter(m=>{if(k(m)||p&&(m===p||m.contains(p)||p.contains(m)))return!1;let y=`${typeof m.className=="string"?m.className:""} ${m.id}`;if(!m.closest('header, nav, [role="navigation"], [role="dialog"]')&&!/menu|nav|drawer|offcanvas|off-canvas/i.test(y))return!1;let L=d(m);return L.length>=2&&L.length<=30});return u.find(m=>!u.some(y=>y!==m&&m.contains(y)))||null},te=/^(active|is-active|current|current-menu-item|current_page_item|selected|router-link-active|router-link-exact-active|aria-current)$/i,ie=p=>p?Array.from(p.classList).filter(u=>!te.test(u)&&!/active|current/i.test(u)).join(" "):"",T=(p,u)=>{let m=document.createElement("a");if(m.textContent=g,m.setAttribute("data-zentry-nav",u),m.setAttribute("data-chatify-nav",u),r==="redirect"&&/^https?:\/\/[^\s"'<>]+$/i.test(f)?(m.href=f,m.target="_blank",m.rel="noopener noreferrer"):(m.href="#",m.setAttribute("role","button"),m.addEventListener("click",y=>{y.preventDefault(),r==="messages"?this.openMessages():this.openHelp()})),C==="pill"){let y=/^#[0-9a-f]{3,8}$/i.test(this.config.primaryColor||"")?this.config.primaryColor:Ee;m.style.cssText=`display:inline-flex;align-items:center;justify-content:center;padding:${u==="mobile"?"6px 14px":"6px 16px"};font-size:14px;font-weight:600;line-height:1.4;border-radius:9999px;background:${y};color:#fff;text-decoration:none;cursor:pointer;white-space:nowrap;align-self:center;`}else if(p){m.className=ie(p);try{let y=window.getComputedStyle(p);m.style.color=y.color,m.style.fontFamily=y.fontFamily,m.style.fontSize=y.fontSize,m.style.fontWeight=y.fontWeight,m.style.letterSpacing=y.letterSpacing,m.style.textTransform=y.textTransform,m.style.textDecoration="none",m.style.cursor="pointer"}catch{}}else m.style.cssText="display:inline-flex;align-items:center;font-size:14px;font-weight:500;color:inherit;text-decoration:none;cursor:pointer;padding:6px 12px;";return m},A=(p,u)=>{if(document.querySelector(`[data-zentry-nav="${u}"]`))return;let m=z(p),y=m?.group??p,L=m?.items??[],x=E==="start"?L[0]:L[L.length-1],S=x&&(x.tagName==="A"?x:x.querySelector("a[href]"))||d(p)[0]||null,P=T(S,u),R=P;if(x&&x.tagName==="LI"){let N=document.createElement("li");N.className=ie(x),N.setAttribute("data-zentry-nav",u),N.setAttribute("data-chatify-nav",u),N.appendChild(P),R=N}else if(y.tagName==="UL"||y.tagName==="OL"){let N=document.createElement("li");N.setAttribute("data-zentry-nav",u),N.setAttribute("data-chatify-nav",u),N.appendChild(P),R=N}x&&x.parentElement===y?E==="start"?y.insertBefore(R,x):x.after(R):E==="start"&&y.firstChild?y.insertBefore(R,y.firstChild):y.appendChild(R)},$=()=>{let p=ee(),u=me(p);p&&A(p,"desktop"),u&&A(u,"mobile")};if($(),typeof MutationObserver<"u"&&document.body){s();let p=null,u=new MutationObserver(()=>{p&&clearTimeout(p),p=setTimeout(()=>{(!document.querySelector('[data-zentry-nav="desktop"]')||!document.querySelector('[data-zentry-nav="mobile"]'))&&$()},300)});u.observe(document.body,{childList:!0,subtree:!0}),this.__navObserver=u}}};if(typeof window<"u"){let a=()=>{let i=[];return{q:i,open:(...s)=>i.push(["open",s]),close:(...s)=>i.push(["close",s]),toggle:(...s)=>i.push(["toggle",s]),openHelp:(...s)=>i.push(["openHelp",s]),openMessages:(...s)=>i.push(["openMessages",s]),openArticle:(...s)=>i.push(["openArticle",s]),search:(...s)=>i.push(["search",s]),isOpen:()=>!1,resetSession:()=>{},switchTab:(...s)=>i.push(["switchTab",s]),showPopup:(...s)=>i.push(["showPopup",s]),hidePopup:(...s)=>i.push(["hidePopup",s])}},e=window.Zentry||window["Zen-try"]||window.Chatify||a();window.OrbatAI=e,window.Orbat=e,window.Zentry=e,window["Zen-try"]=e,window.Chatify=e;let t=()=>{let i=new Fe;window.__ZentryInstance=i,window.__ChatifyInstance=i;let n=window.Zentry||window["Zen-try"]||window.Chatify,s=Array.isArray(n?.q)?n.q:Array.isArray(n)?n:[],r={open:o=>i.open(o),close:()=>i.close(),toggle:()=>i.toggle(),openHelp:()=>i.openHelp(),openMessages:()=>i.openMessages(),openArticle:o=>i.openArticle(o),search:o=>i.search(o),isOpen:()=>i.getIsOpen(),resetSession:()=>i.resetSession(),switchTab:o=>i.switchTab(o),showPopup:(o,l)=>i.showPopup(o,l),hidePopup:()=>i.hidePopup(),instance:i};if(window.OrbatAI=r,window.Orbat=r,window.Zentry=r,window["Zen-try"]=r,window.Chatify=r,s.length>0){for(let o of s)if(Array.isArray(o)){let[l,h=[]]=o;typeof r[l]=="function"&&r[l](...h)}else if(typeof o=="function")try{o(r)}catch{}}};document.readyState==="loading"?document.addEventListener("DOMContentLoaded",t):t()}})();
