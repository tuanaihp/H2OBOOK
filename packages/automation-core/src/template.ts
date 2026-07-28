import type { DataRow } from "./csv";
export type TemplateField={key:string;required:boolean;occurrences:number};
const token=/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;const condition=/\{\{#if\s+([a-zA-Z0-9_.-]+)\s*\}\}([\s\S]*?)\{\{\/if\}\}/g;
export function findTemplateFields(value:unknown){const source=JSON.stringify(value);const map=new Map<string,number>();for(const match of source.matchAll(token))map.set(match[1],(map.get(match[1])??0)+1);return[...map.entries()].map(([key,occurrences])=>({key,occurrences,required:true} satisfies TemplateField));}
export function resolveTemplateString(source:string,row:DataRow){return source.replace(condition,(_,key,body)=>String(row[key]??'').trim()?body:'').replace(token,(_,key)=>row[key]??'');}
export function resolveTemplate<T>(value:T,row:DataRow):T{const serialized=JSON.stringify(value);return JSON.parse(resolveTemplateString(serialized,row)) as T;}
export function validateRows(rows:DataRow[],fields:TemplateField[]){return rows.map((row,index)=>({index,row,missing:fields.filter(field=>field.required&&!String(row[field.key]??'').trim()).map(field=>field.key)}));}
