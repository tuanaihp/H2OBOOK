import type { BookDocument, SemanticContentNode } from "@h2obook/content-core";
import type { IngestionPreview, IngestionResult, IngestionSource, IngestionWarning } from "./types";

const uid = () => crypto.randomUUID();
const text = (value: string) => [{ text: value.trim() }];
const node = (type: SemanticContentNode["type"], value = "", attrs: Record<string, unknown> = {}, children: SemanticContentNode[] = []): SemanticContentNode => ({ id: uid(), type, parentId: null, position: 0, text: value ? text(value) : undefined, attrs, children, version: 1 });
const entities = (value: string) => value.replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&lt;/gi,"<").replace(/&gt;/gi,">").replace(/&quot;/gi,'"').replace(/&#39;/gi,"'").replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n)));
export const normalizeText = (value: string) => value.replace(/\r\n?/g,"\n").replace(/[\t\u00a0]+/g," ").replace(/ +\n/g,"\n").replace(/\n{4,}/g,"\n\n\n").trim();
const stripTags = (value: string) => entities(value.replace(/<br\s*\/?\s*>/gi,"\n").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim());

function pushWithPosition(target: SemanticContentNode[], item: SemanticContentNode) { item.position = target.length; target.push(item); }
function parseInline(value: string) { return value.replace(/!\[[^\]]*\]\([^)]*\)/g,"").replace(/\[([^\]]+)\]\(([^)]+)\)/g,"$1").replace(/[*_`~]/g,"").trim(); }

export function parseMarkdown(source: string): SemanticContentNode[] {
  const lines=normalizeText(source).split("\n"); const root:SemanticContentNode[]=[]; let paragraph:string[]=[]; let listItems:string[]=[]; let listOrdered=false;
  const flushParagraph=()=>{const value=paragraph.join(" ").trim();if(value)pushWithPosition(root,node("paragraph",parseInline(value)));paragraph=[];};
  const flushList=()=>{if(listItems.length){const list=node("list","",{ordered:listOrdered},listItems.map((item,index)=>{const child=node("list_item",parseInline(item));child.position=index;return child;}));pushWithPosition(root,list);}listItems=[];};
  for(const raw of lines){const line=raw.trim();
    const heading=/^(#{1,6})\s+(.+)$/.exec(line); if(heading){flushParagraph();flushList();const level=heading[1].length;pushWithPosition(root,node(level===1?"chapter":level===2?"section":"heading",parseInline(heading[2]),{level}));continue;}
    const list=/^([-*+] |\d+[.)]\s+)(.+)$/.exec(line);if(list){flushParagraph();const ordered=/^\d/.test(list[1]);if(listItems.length&&ordered!==listOrdered)flushList();listOrdered=ordered;listItems.push(list[2]);continue;}
    if(/^>\s?/.test(line)){flushParagraph();flushList();pushWithPosition(root,node("quote",parseInline(line.replace(/^>\s?/,""))));continue;}
    const image=/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+["']([^"']+)["'])?\)$/.exec(line);if(image){flushParagraph();flushList();pushWithPosition(root,node("image","",{altText:image[1],sourceUrl:image[2],caption:image[3]??""}));continue;}
    if(/^---+$/.test(line)){flushParagraph();flushList();pushWithPosition(root,node("divider"));continue;}
    if(!line){flushParagraph();flushList();continue;} paragraph.push(line);
  } flushParagraph();flushList();return root;
}

export function parseHtml(source: string): SemanticContentNode[] {
  const clean=source.replace(/<!--[\s\S]*?-->/g,"").replace(/<(script|style|noscript|iframe)[^>]*>[\s\S]*?<\/\1>/gi,"");
  const blocks=[...clean.matchAll(/<(h[1-6]|p|li|blockquote|figcaption|img)([^>]*)>([\s\S]*?)<\/\1>|<img([^>]*)\/?\s*>/gi)];
  const root:SemanticContentNode[]=[]; let pendingList:SemanticContentNode[]=[];
  const flushList=()=>{if(pendingList.length){pushWithPosition(root,node("list","",{ordered:false},pendingList));pendingList=[];}};
  for(const match of blocks){const tag=(match[1]??"img").toLowerCase();const attrs=(match[2]??match[4]??"");const body=match[3]??"";
    if(tag==="li"){const child=node("list_item",stripTags(body));child.position=pendingList.length;pendingList.push(child);continue;}flushList();
    if(tag.startsWith("h")){const level=Number(tag.slice(1));pushWithPosition(root,node(level===1?"chapter":level===2?"section":"heading",stripTags(body),{level}));}
    else if(tag==="p") {const value=stripTags(body);if(value)pushWithPosition(root,node("paragraph",value));}
    else if(tag==="blockquote")pushWithPosition(root,node("quote",stripTags(body)));
    else if(tag==="img"){const src=/\bsrc=["']([^"']+)/i.exec(attrs)?.[1]??"";const alt=/\balt=["']([^"']*)/i.exec(attrs)?.[1]??"";if(src)pushWithPosition(root,node("image","",{sourceUrl:entities(src),altText:entities(alt)}));}
    else if(tag==="figcaption")pushWithPosition(root,node("paragraph",stripTags(body),{role:"caption"}));
  } flushList();
  if(!root.length){const value=stripTags(clean);if(value)pushWithPosition(root,node("paragraph",value));}
  return root;
}

export function parseTranscript(source: string): SemanticContentNode[] {
  const lines=normalizeText(source).split("\n");const root:SemanticContentNode[]=[];let buffer:string[]=[];let timestamp="";
  const flush=()=>{const value=buffer.join(" ").trim();if(value)pushWithPosition(root,node("paragraph",value,timestamp?{timestamp}:{}));buffer=[];timestamp="";};
  for(const raw of lines){const line=raw.trim();if(!line){flush();continue;}const stamp=/^(?:\[)?((?:\d{1,2}:)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?)(?:\])?\s*(?:-->|-|:)?\s*(.*)$/.exec(line);if(stamp){flush();timestamp=stamp[1];if(stamp[2])buffer.push(stamp[2]);continue;}const speaker=/^([\p{L}][\p{L}\s]{1,30}):\s+(.+)$/u.exec(line);if(speaker){flush();pushWithPosition(root,node("paragraph",speaker[2],{speaker:speaker[1]}));continue;}buffer.push(line);}flush();return root;
}

export function parsePlainText(source:string): SemanticContentNode[]{
 const lines=normalizeText(source).split("\n");const root:SemanticContentNode[]=[];let paragraph:string[]=[];const flush=()=>{const value=paragraph.join(" ").trim();if(value)pushWithPosition(root,node("paragraph",value));paragraph=[];};
 for(const raw of lines){const line=raw.trim();if(!line){flush();continue;}const numbered=/^(?:chương|chapter|phần|part)\s+[\divxlc]+[.:\-]?\s*(.*)$/i.test(line);const shortHeading=line.length<90&&(numbered||/^\d+(?:\.\d+)*[.)]?\s+\S+/.test(line)||(/^[\p{Lu}\d\s\-–—:]+$/u.test(line)&&line.length>3));if(shortHeading){flush();pushWithPosition(root,node(numbered?"chapter":"heading",line,{level:numbered?1:3}));}else paragraph.push(line);}flush();return root;
}

export function parseRss(source:string):SemanticContentNode[]{
 const root:SemanticContentNode[]=[];const channelTitle=stripTags(/<channel[^>]*>[\s\S]*?<title[^>]*>([\s\S]*?)<\/title>/i.exec(source)?.[1]??"");if(channelTitle)pushWithPosition(root,node("chapter",channelTitle,{level:1}));
 const items=[...source.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/gi)];for(const item of items){const body=item[1];const title=stripTags(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(body)?.[1]??"Tập podcast");pushWithPosition(root,node("section",title,{level:2}));const description=/<(?:description|content:encoded)[^>]*>([\s\S]*?)<\/(?:description|content:encoded)>/i.exec(body)?.[1]??"";for(const child of parseHtml(description)){child.position=root.length;root.push(child);}const enclosure=/<enclosure[^>]*url=["']([^"']+)/i.exec(body)?.[1];if(enclosure)pushWithPosition(root,node("interactive","",{kind:"audio",sourceUrl:entities(enclosure)}));}
 return root;
}

function sourceNodes(source:IngestionSource){if(source.type==="markdown")return parseMarkdown(source.content);if(source.type==="html"||source.type==="url"||source.type==="google_docs"||source.type==="notion")return parseHtml(source.content);if(source.type.includes("transcript"))return parseTranscript(source.content);if(source.type==="podcast_rss")return parseRss(source.content);return parsePlainText(source.content);}
function calculate(nodes:SemanticContentNode[],content:string){let chapters=0,headings=0,paragraphs=0,lists=0;const walk=(items:SemanticContentNode[])=>items.forEach(item=>{if(item.type==="chapter")chapters++;if(item.type==="heading"||item.type==="section")headings++;if(item.type==="paragraph")paragraphs++;if(item.type==="list")lists++;walk(item.children);});walk(nodes);return{chapters,headings,paragraphs,lists,words:normalizeText(content).split(/\s+/).filter(Boolean).length};}
export function previewIngestion(source:IngestionSource):IngestionPreview {const nodes=sourceNodes(source);const warnings:IngestionWarning[]=[];if(!nodes.length)warnings.push({code:"NO_CONTENT",message:"Không tìm thấy nội dung có thể nhập.",severity:"error"});if(nodes.length>5000)warnings.push({code:"LARGE_DOCUMENT",message:"Tài liệu có hơn 5.000 khối; nên chia nhỏ trước khi nhập.",severity:"warning"});if(!nodes.some(item=>item.type==="chapter"||item.type==="section"))warnings.push({code:"NO_CHAPTERS",message:"Chưa phát hiện chương; có thể phân chương thủ công ở bước xem trước.",severity:"warning"});const guessed=source.title?.trim()||String(nodes.find(item=>item.type==="chapter"||item.type==="section"||item.type==="heading")?.text?.map(span=>span.text).join("")||"Sách mới từ nội dung nhập");return{title:guessed,sourceType:source.type,nodes,warnings,statistics:calculate(nodes,source.content),metadata:{sourceUrl:source.sourceUrl??null,language:source.language??"vi",...(source.metadata??{})}};}
export function ingest(source:IngestionSource,input:{bookId:string;organizationId?:string}):IngestionResult{const preview=previewIngestion(source);const now=new Date().toISOString();const document:BookDocument={id:uid(),bookId:input.bookId,organizationId:input.organizationId,title:preview.title,language:source.language??"vi",root:preview.nodes,metadata:{...preview.metadata,ingestedAt:now,sourceType:source.type},version:1,createdAt:now,updatedAt:now};return{...preview,document};}
