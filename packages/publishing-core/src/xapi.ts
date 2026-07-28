import JSZip from "jszip";
import type { BookDocument } from "@h2obook/content-core";
import { renderSemanticHtml } from "./html";
import type { ExportProfile } from "./types";

const xml = (value: string) => value.replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;"
})[char]!);

/**
 * Creates an xAPI launch package. The package works without an LRS and starts
 * sending statements only when an endpoint/auth configuration is supplied at launch time.
 */
export async function buildXapiPackage(document: BookDocument, profile: ExportProfile) {
  const zip = new JSZip();
  const bookHtml = renderSemanticHtml(document, profile).replace(
    "</body>",
    `<script src="xapi-launch.js"></script></body>`
  );
  const activityId = `urn:h2obook:${document.id}`;
  zip.file("index.html", bookHtml);
  zip.file("xapi-launch.js", `
(function(){
  const params = new URLSearchParams(location.search);
  const endpoint = params.get('endpoint') || sessionStorage.getItem('h2obook_xapi_endpoint') || '';
  const auth = params.get('auth') || sessionStorage.getItem('h2obook_xapi_auth') || '';
  const actorName = params.get('actor_name') || 'H2OBOOK Learner';
  const actorMbox = params.get('actor_mbox') || 'mailto:anonymous@h2obook.local';
  if(params.get('endpoint')) sessionStorage.setItem('h2obook_xapi_endpoint', endpoint);
  if(params.get('auth')) sessionStorage.setItem('h2obook_xapi_auth', auth);
  async function send(verbId, verbLabel, result){
    if(!endpoint) return;
    const statement={actor:{objectType:'Agent',name:actorName,mbox:actorMbox},verb:{id:verbId,display:{'vi':verbLabel}},object:{id:'${activityId}',definition:{name:{'vi':${JSON.stringify(document.title)}},type:'http://adlnet.gov/expapi/activities/course'}},result:result||undefined,timestamp:new Date().toISOString()};
    try{await fetch(endpoint.replace(/\/$/,'')+'/statements',{method:'POST',headers:{'content-type':'application/json','x-experience-api-version':'1.0.3',...(auth?{authorization:auth}:{})},body:JSON.stringify(statement)});}catch(error){console.warn('xAPI statement was queued only in the browser session',error);}
  }
  send('http://adlnet.gov/expapi/verbs/launched','đã mở');
  addEventListener('beforeunload',()=>send('http://adlnet.gov/expapi/verbs/experienced','đã trải nghiệm',{completion:false}));
  window.H2OBOOK_XAPI={send};
})();`);
  zip.file("tincan.xml", `<?xml version="1.0" encoding="utf-8"?>
<tincan xmlns="http://projecttincan.com/tincan.xsd">
  <activities><activity id="${xml(activityId)}" type="http://adlnet.gov/expapi/activities/course"><name lang="vi">${xml(document.title)}</name><launch lang="vi">index.html</launch></activity></activities>
</tincan>`);
  zip.file("README.txt", "H2OBOOK xAPI package. Launch index.html with optional endpoint, auth, actor_name and actor_mbox query parameters. Without an LRS the content still works normally.");
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}
