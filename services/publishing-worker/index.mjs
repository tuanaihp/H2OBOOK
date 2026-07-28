import { Worker } from "bullmq";
import IORedis from "ioredis";
import { chromium } from "playwright-core";
import JSZip from "jszip";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import crypto from "node:crypto";

const exec = promisify(execFile);
if (!process.env.REDIS_URL) throw new Error("REDIS_URL_REQUIRED");
const connection = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY }
});

async function db(id, patch) {
  await admin.from("publishing_jobs").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
}
async function upload(key, body, type) {
  await s3.send(new PutObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key, Body: body, ContentType: type }));
}
function safeXml(value = "H2OBOOK") {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char]);
}
async function packageZip(type, html, title, bookId) {
  const zip = new JSZip();
  if (type === "epub_reflow" || type === "epub_fixed") {
    zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
    zip.file("META-INF/container.xml", `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`);
    const xhtml = html.replace("<!doctype html>", '<?xml version="1.0" encoding="utf-8"?>').replace("<html", '<html xmlns="http://www.w3.org/1999/xhtml"');
    zip.file("OEBPS/book.xhtml", xhtml);
    zip.file("OEBPS/nav.xhtml", `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Mục lục</title></head><body><nav epub:type="toc"><ol><li><a href="book.xhtml">${safeXml(title)}</a></li></ol></nav></body></html>`);
    const rendition = type === "epub_fixed" ? '<meta property="rendition:layout">pre-paginated</meta>' : '<meta property="rendition:layout">reflowable</meta>';
    zip.file("OEBPS/content.opf", `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id" prefix="rendition: http://www.idpf.org/vocab/rendition/#"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="pub-id">urn:uuid:${bookId}</dc:identifier><dc:title>${safeXml(title)}</dc:title><dc:language>vi</dc:language>${rendition}<meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d{3}Z$/, "Z")}</meta></metadata><manifest><item id="book" href="book.xhtml" media-type="application/xhtml+xml"/><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/></manifest><spine><itemref idref="book"/></spine></package>`);
    return { bytes: await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }), extension: "epub", mime: "application/epub+zip" };
  }
  if (type === "scorm12" || type === "scorm2004") {
    zip.file("index.html", html);
    const manifest = type === "scorm12"
      ? `<?xml version="1.0"?><manifest identifier="h2obook-${bookId}" version="1.2"><organizations default="ORG"><organization identifier="ORG"><title>${safeXml(title)}</title><item identifier="ITEM" identifierref="RES"><title>${safeXml(title)}</title></item></organization></organizations><resources><resource identifier="RES" type="webcontent" adlcp:scormtype="sco" href="index.html" xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"><file href="index.html"/></resource></resources></manifest>`
      : `<?xml version="1.0"?><manifest xmlns="http://www.imsglobal.org/xsd/imscp_v1p1" xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_v1p3" identifier="h2obook-${bookId}"><organizations default="ORG"><organization identifier="ORG"><title>${safeXml(title)}</title><item identifier="ITEM" identifierref="RES"><title>${safeXml(title)}</title></item></organization></organizations><resources><resource identifier="RES" type="webcontent" adlcp:scormType="sco" href="index.html"><file href="index.html"/></resource></resources></manifest>`;
    zip.file("imsmanifest.xml", manifest);
    return { bytes: await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }), extension: "zip", mime: "application/zip" };
  }
  if (type === "xapi") {
    zip.file("index.html", html.replace("</body>", '<script src="xapi-launch.js"></script></body>'));
    zip.file("xapi-launch.js", `(function(){const p=new URLSearchParams(location.search),e=p.get('endpoint')||'',a=p.get('auth')||'';async function send(v,l){if(!e)return;try{await fetch(e.replace(/\\/$/,'')+'/statements',{method:'POST',headers:{'content-type':'application/json','x-experience-api-version':'1.0.3',...(a?{authorization:a}:{})},body:JSON.stringify({actor:{objectType:'Agent',name:p.get('actor_name')||'H2OBOOK Learner',mbox:p.get('actor_mbox')||'mailto:anonymous@h2obook.local'},verb:{id:v,display:{vi:l}},object:{id:'urn:h2obook:${bookId}',definition:{name:{vi:${JSON.stringify(title)}},type:'http://adlnet.gov/expapi/activities/course'}},timestamp:new Date().toISOString()})})}catch{}}send('http://adlnet.gov/expapi/verbs/launched','đã mở');window.H2OBOOK_XAPI={send};})();`);
    zip.file("tincan.xml", `<?xml version="1.0" encoding="utf-8"?><tincan xmlns="http://projecttincan.com/tincan.xsd"><activities><activity id="urn:h2obook:${bookId}" type="http://adlnet.gov/expapi/activities/course"><name lang="vi">${safeXml(title)}</name><launch lang="vi">index.html</launch></activity></activities></tincan>`);
    return { bytes: await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }), extension: "zip", mime: "application/zip" };
  }
  throw new Error(`UNSUPPORTED_PACKAGE_TYPE:${type}`);
}

const worker = new Worker("h2obook-publishing", async (job) => {
  const data = job.data;
  await db(data.databaseJobId, { status: "processing", started_at: new Date().toISOString(), progress: 5 });
  await job.updateProgress(5);
  const dir = await mkdtemp(path.join(tmpdir(), "h2obook-publish-"));
  try {
    if (!data.html) throw new Error("HTML_INPUT_REQUIRED");
    let bytes;
    let extension;
    let mime;
    if (data.type === "pdf_web" || data.type === "pdf_print") {
      const htmlPath = path.join(dir, "book.html");
      const pdfPath = path.join(dir, "book.pdf");
      await writeFile(htmlPath, data.html, "utf8");
      const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium", args: ["--no-sandbox"] });
      const page = await browser.newPage();
      await page.goto(`file://${htmlPath}`, { waitUntil: "networkidle" });
      await page.pdf({ path: pdfPath, printBackground: true, preferCSSPageSize: true, tagged: true, outline: true });
      await browser.close();
      await job.updateProgress(70);
      let finalPath = pdfPath;
      if (data.type === "pdf_print" && process.env.GHOSTSCRIPT_PATH) {
        const pdfx = path.join(dir, "book-pdfx.pdf");
        await exec(process.env.GHOSTSCRIPT_PATH, ["-dBATCH", "-dNOPAUSE", "-sDEVICE=pdfwrite", "-dPDFX", "-sOutputFile=" + pdfx, pdfPath]);
        finalPath = pdfx;
      }
      bytes = await readFile(finalPath);
      extension = "pdf";
      mime = "application/pdf";
    } else {
      const packaged = await packageZip(data.type, data.html, data.title || "H2OBOOK", data.bookId);
      bytes = packaged.bytes;
      extension = packaged.extension;
      mime = packaged.mime;
      await job.updateProgress(75);
    }
    const checksum = crypto.createHash("sha256").update(bytes).digest("hex");
    const key = `${data.organizationId}/publishing/${data.bookId}/${crypto.randomUUID()}.${extension}`;
    await upload(key, bytes, mime);
    const { data: artifact, error } = await admin.from("publishing_artifacts").insert({ organization_id: data.organizationId, publishing_job_id: data.databaseJobId, book_id: data.bookId, format: data.type, storage_key: key, mime_type: mime, size_bytes: bytes.length, checksum, metadata: { profileId: data.profileId, generatedBy: "publishing-worker-4.11" } }).select().single();
    if (error) throw error;
    await db(data.databaseJobId, { status: "completed", progress: 100, completed_at: new Date().toISOString(), output: { artifactId: artifact.id, storageKey: key } });
    await job.updateProgress(100);
    return artifact;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}, { connection, concurrency: Number(process.env.PUBLISHING_WORKER_CONCURRENCY ?? 1) });

worker.on("failed", async (job, error) => {
  console.error(error);
  if (job) await db(job.data.databaseJobId, { status: "failed", error_message: error.message });
});
console.log("H2OBOOK publishing worker 4.11 started");
