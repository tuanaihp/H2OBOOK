import type {ReaderCampaign} from "@h2obook/growth-reader-core";
export const campaignKey=(bookId:string)=>`h2obook-growth-${bookId}`;export const leadKey=(bookId:string)=>`h2obook-lead-${bookId}`;
export function defaultCampaign(bookId:string):ReaderCampaign{return{id:crypto.randomUUID(),bookId,name:"Reader Growth Campaign",enabled:false,previewPages:5,leadGatePage:6,leadFields:["name","email"],downloadRequiresLead:false,ctaPage:10,ctaLabel:"Khám phá khóa học",ctaUrl:"/store",allowedDomains:[],utmCapture:true,crmWebhookEnabled:false};}
export function readCampaign(bookId:string):ReaderCampaign{if(typeof localStorage==='undefined')return defaultCampaign(bookId);try{return{...defaultCampaign(bookId),...JSON.parse(localStorage.getItem(campaignKey(bookId))??'{}')}}catch{return defaultCampaign(bookId)}}
export function saveCampaign(campaign:ReaderCampaign){localStorage.setItem(campaignKey(campaign.bookId),JSON.stringify(campaign));}
export function hasReaderLead(bookId:string){return typeof localStorage!=='undefined'&&Boolean(localStorage.getItem(leadKey(bookId)));}
