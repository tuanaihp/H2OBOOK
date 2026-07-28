export type ExportFormat = "html" | "pdf_web" | "pdf_print" | "epub_reflow" | "epub_fixed" | "scorm12" | "scorm2004" | "xapi";
export type ExportProfile = {
  id: string;
  name: string;
  format: ExportFormat;
  page: { width: number; height: number; unit: "mm" | "px" | "pt"; margin: number; bleed: number };
  typography: { bodyFont: string; headingFont: string; baseSize: number; lineHeight: number };
  print?: { cropMarks: boolean; colorMode: "rgb" | "cmyk"; pdfx?: "PDF/X-1a" | "PDF/X-4"; iccProfile?: string };
  accessibility: { tagged: boolean; language: string };
};

export const exportProfiles: ExportProfile[] = [
  { id:"web",name:"Web Reader",format:"html",page:{width:794,height:1123,unit:"px",margin:0,bleed:0},typography:{bodyFont:"Arial",headingFont:"Georgia",baseSize:18,lineHeight:1.6},accessibility:{tagged:true,language:"vi"}},
  { id:"pdf-web",name:"PDF Web",format:"pdf_web",page:{width:210,height:297,unit:"mm",margin:16,bleed:0},typography:{bodyFont:"Arial",headingFont:"Georgia",baseSize:11,lineHeight:1.55},accessibility:{tagged:true,language:"vi"}},
  { id:"pdf-print-a4",name:"PDF Print A4",format:"pdf_print",page:{width:210,height:297,unit:"mm",margin:16,bleed:3},typography:{bodyFont:"Arial",headingFont:"Georgia",baseSize:10.5,lineHeight:1.5},print:{cropMarks:true,colorMode:"cmyk",pdfx:"PDF/X-4"},accessibility:{tagged:true,language:"vi"}},
  { id:"epub-reflow",name:"EPUB 3 Reflowable",format:"epub_reflow",page:{width:0,height:0,unit:"px",margin:0,bleed:0},typography:{bodyFont:"serif",headingFont:"serif",baseSize:18,lineHeight:1.65},accessibility:{tagged:true,language:"vi"}},
  { id:"epub-fixed",name:"EPUB 3 Fixed Layout",format:"epub_fixed",page:{width:794,height:1123,unit:"px",margin:0,bleed:0},typography:{bodyFont:"Arial",headingFont:"Georgia",baseSize:18,lineHeight:1.4},accessibility:{tagged:true,language:"vi"}},
  { id:"scorm12",name:"SCORM 1.2",format:"scorm12",page:{width:0,height:0,unit:"px",margin:0,bleed:0},typography:{bodyFont:"Arial",headingFont:"Georgia",baseSize:18,lineHeight:1.6},accessibility:{tagged:true,language:"vi"}},
  { id:"scorm2004",name:"SCORM 2004",format:"scorm2004",page:{width:0,height:0,unit:"px",margin:0,bleed:0},typography:{bodyFont:"Arial",headingFont:"Georgia",baseSize:18,lineHeight:1.6},accessibility:{tagged:true,language:"vi"}},
  { id:"xapi",name:"xAPI / Tin Can",format:"xapi",page:{width:0,height:0,unit:"px",margin:0,bleed:0},typography:{bodyFont:"Arial",headingFont:"Georgia",baseSize:18,lineHeight:1.6},accessibility:{tagged:true,language:"vi"}}
];
