export type PublishingJobType="pdf_web"|"pdf_print"|"epub_reflow"|"epub_fixed"|"scorm12"|"scorm2004"|"xapi";
export async function enqueuePublishingJob(input:{organizationId:string;databaseJobId:string;bookId:string;profileId:string;type:PublishingJobType;html?:string;title?:string}){
  if(!process.env.REDIS_URL)throw new Error("REDIS_NOT_CONFIGURED");
  const [{Queue},IORedisModule]=await Promise.all([import("bullmq"),import("ioredis")]);
  const connection=new IORedisModule.default(process.env.REDIS_URL,{maxRetriesPerRequest:null});
  const queue=new Queue("h2obook-publishing",{connection});
  const job=await queue.add(input.type,input,{attempts:3,backoff:{type:"exponential",delay:3000},removeOnComplete:100,removeOnFail:300});
  await queue.close();await connection.quit();return String(job.id);
}
