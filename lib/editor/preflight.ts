import type { H2OBook, H2OElement, H2OPage } from "@/types/editor";

export type PreflightSeverity = "error" | "warning" | "info";
export type PreflightIssue = { id: string; severity: PreflightSeverity; rule: string; message: string; pageId?: string; elementId?: string; fix?: string };

function contrast(hexA: string, hexB: string) {
  const lum = (hex: string) => {
    const rgb = hex.replace("#", "").match(/.{2}/g)?.map((item) => parseInt(item,16)/255) ?? [0,0,0];
    const values = rgb.map((value) => value <= .03928 ? value/12.92 : ((value+.055)/1.055)**2.4);
    return values[0]*.2126+values[1]*.7152+values[2]*.0722;
  };
  const a=lum(hexA),b=lum(hexB); return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
}

function textCapacity(element: H2OElement) {
  const font = Math.max(8, element.fontSize ?? 22);
  const charsPerLine = Math.max(1, Math.floor(element.width / (font * .55)));
  const lines = Math.max(1, Math.floor(element.height / (font * (element.lineHeight ?? 1.35))));
  return charsPerLine * lines;
}

function inspectElement(page: H2OPage, element: H2OElement): PreflightIssue[] {
  const issues: PreflightIssue[]=[];
  const base={pageId:page.id,elementId:element.id};
  if(element.x<0||element.y<0||element.x+element.width>page.width||element.y+element.height>page.height)issues.push({id:`bounds:${element.id}`,severity:"error",rule:"page_bounds",message:`${element.name} nằm ngoài phạm vi trang.`,fix:"Đưa thành phần vào vùng trang.",...base});
  if(element.type==="text"){
    const text=(element.text??"").trim();
    if(!text)issues.push({id:`empty:${element.id}`,severity:"warning",rule:"empty_text",message:`${element.name} chưa có nội dung.`,...base});
    if(!element.flowChainId && text.length>textCapacity(element))issues.push({id:`overflow:${element.id}`,severity:"error",rule:"text_overflow",message:`${element.name} có khả năng bị tràn khung.`,fix:"Tăng khung, giảm cỡ chữ hoặc tạo text flow.",...base});
    if(element.flowChainId && element.flowOverflow)issues.push({id:`flow-overflow:${element.id}`,severity:"error",rule:"text_flow_overflow",message:`Chuỗi Text Flow của ${element.name} vẫn còn nội dung chưa được dàn.`,fix:"Thêm khung tiếp nối, tăng kích thước khung hoặc giảm cỡ chữ.",...base});
    if(/^#[0-9a-f]{6}$/i.test(element.fill??"")&&/^#[0-9a-f]{6}$/i.test(page.background)&&contrast(element.fill!,page.background)<4.5)issues.push({id:`contrast:${element.id}`,severity:"warning",rule:"contrast",message:`${element.name} có độ tương phản thấp.`,fix:"Đổi màu chữ hoặc nền để đạt tỷ lệ tối thiểu 4.5:1.",...base});
  }
  if(element.type==="image"){
    if(!element.assetId&&!element.imageUrl)issues.push({id:`asset:${element.id}`,severity:"error",rule:"missing_asset",message:`${element.name} chưa có nguồn ảnh.`,...base});
    if(!element.altText?.trim())issues.push({id:`alt:${element.id}`,severity:"warning",rule:"missing_alt",message:`${element.name} chưa có alt text.`,fix:"Mô tả ngắn nội dung và mục đích của hình.",...base});
    const metadata=element.imageMetadata;
    if(metadata?.pixelWidth&&metadata?.pixelHeight){
      const effectiveX=metadata.pixelWidth*96/Math.max(1,element.width);
      const effectiveY=metadata.pixelHeight*96/Math.max(1,element.height);
      const effective=Math.min(effectiveX,effectiveY);
      if(effective<96)issues.push({id:`dpi-error:${element.id}`,severity:"error",rule:"effective_dpi",message:`${element.name} chỉ còn khoảng ${Math.round(effective)} DPI ở kích thước hiện tại.`,fix:"Giảm kích thước đặt trên trang hoặc dùng ảnh độ phân giải cao hơn.",...base});
      else if(effective<150)issues.push({id:`dpi-warning:${element.id}`,severity:"warning",rule:"effective_dpi",message:`${element.name} có effective DPI khoảng ${Math.round(effective)}, thấp hơn mức khuyến nghị in 150–300 DPI.`,fix:"Giảm kích thước hoặc thay ảnh lớn hơn.",...base});
      if(element.width>metadata.pixelWidth*1.5||element.height>metadata.pixelHeight*1.5)issues.push({id:`upscale:${element.id}`,severity:"warning",rule:"image_upscale",message:`${element.name} đang được phóng lớn quá mức so với số pixel nguồn.`,...base});
      if(metadata.colorProfile&&!/srgb/i.test(metadata.colorProfile))issues.push({id:`profile:${element.id}`,severity:"warning",rule:"color_profile",message:`${element.name} dùng ${metadata.colorProfile}; màu có thể thay đổi khi xuất web hoặc in.`,fix:"Chuyển ảnh sang sRGB hoặc profile in phù hợp.",...base});
    }else if(element.assetId)issues.push({id:`image-metadata:${element.id}`,severity:"info",rule:"image_metadata",message:`${element.name} chưa có metadata pixel/DPI để kiểm tra chất lượng in.`,...base});
  }
  if(element.type==="qr"){
    try { new URL(element.qrValue??""); } catch { issues.push({id:`qr:${element.id}`,severity:"error",rule:"invalid_qr",message:`QR ${element.name} không chứa URL hợp lệ.`,fix:"Nhập URL đầy đủ bắt đầu bằng https://",...base}); }
    if(element.width<120||element.height<120)issues.push({id:`qrsize:${element.id}`,severity:"warning",rule:"qr_size",message:`QR ${element.name} có thể quá nhỏ để in và quét.`,...base});
  }
  return issues;
}

export function runBookPreflight(book: H2OBook) {
  const issues: PreflightIssue[]=[];
  if(!book.title.trim())issues.push({id:"book-title",severity:"error",rule:"metadata",message:"Sách chưa có tiêu đề."});
  if(!book.pages.length)issues.push({id:"book-pages",severity:"error",rule:"empty_book",message:"Sách chưa có trang."});
  const flowChains = new Map<string, Array<{ page: H2OPage; element: H2OElement }>>();
  book.pages.forEach((page)=>{
    if(!page.elements.length)issues.push({id:`page:${page.id}`,severity:"warning",rule:"empty_page",message:`${page.name} đang trống.`,pageId:page.id});
    page.elements.forEach((element)=>{
      issues.push(...inspectElement(page,element));
      if(element.type === "text" && element.flowChainId){
        const frames = flowChains.get(element.flowChainId) ?? [];
        frames.push({ page, element });
        flowChains.set(element.flowChainId, frames);
      }
    });
  });
  flowChains.forEach((frames, chainId)=>{
    const orders = frames.map(({element})=>element.flowOrder).filter((value): value is number=>typeof value === "number");
    if(new Set(orders).size !== orders.length)issues.push({id:`flow-order:${chainId}`,severity:"error",rule:"text_flow_order",message:`Chuỗi Text Flow ${chainId} có thứ tự khung bị trùng.`,fix:"Dàn lại chuỗi Text Flow."});
    if(!frames.some(({element})=>typeof element.flowSourceText === "string"))issues.push({id:`flow-source:${chainId}`,severity:"warning",rule:"text_flow_source",message:`Chuỗi Text Flow ${chainId} chưa có nguồn nội dung gốc.`,fix:"Chọn khung đầu và cập nhật nội dung nguồn."});
    if(frames.length === 1)issues.push({id:`flow-single:${chainId}`,severity:"info",rule:"text_flow_single_frame",message:`Chuỗi Text Flow ${chainId} mới chỉ có một khung.`});
  });
  return { issues, errors:issues.filter((item)=>item.severity==="error").length, warnings:issues.filter((item)=>item.severity==="warning").length, passed:!issues.some((item)=>item.severity==="error") };
}
